"""Bet creation, acceptance, decline, and expiry (FR4, FR5, FR6, FR7)."""

import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.hashing import hash_content, hash_identity, normalize_identifier
from app.models import MagicLink, PendingBet, User
from app.notifications import send_notification
from app.rate_limit import check_rate_limit
from app.schemas import (
    BetAcceptRequest,
    BetAcceptResponse,
    BetCreateRequest,
    BetCreateResponse,
    BetResolveRequest,
    BetResolveRespondRequest,
    BetResolveRespondResponse,
    BetResolveResponse,
    PendingBetSummary,
)

router = APIRouter(prefix="/bets", tags=["bets"])


def _generate_token() -> str:
    import secrets

    return secrets.token_urlsafe(32)


@router.post("", response_model=BetCreateResponse, status_code=201)
def create_bet(
    body: BetCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """FR4: Create a bet and send an invitation to the counterparty."""
    cp_normalized = normalize_identifier(body.counterparty_identifier)

    # Edge case: counterparty same as initiator
    if cp_normalized == current_user.identifier:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SELF_BET",
                "message": "Cannot create a bet with yourself",
            },
        )

    # Find or create counterparty user (needed for FK and magic link)
    cp_user = db.query(User).filter(User.identifier == cp_normalized).first()
    if cp_user is None:
        cp_user = User(
            identifier=cp_normalized,
            identifier_type=body.counterparty_identifier_type.value,
        )
        db.add(cp_user)
        db.commit()
        db.refresh(cp_user)

    # Edge case: duplicate pending bet (same initiator, same counterparty, same terms)
    existing = (
        db.query(PendingBet)
        .filter(
            PendingBet.initiator_id == current_user.id,
            PendingBet.counterparty_user_id == cp_user.id,
            PendingBet.bet_terms == body.bet_terms,
            PendingBet.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "DUPLICATE_BET",
                "message": "A pending bet with identical terms already exists for this counterparty",
            },
        )

    # FR11: Rate limiting for bet invitations.
    # Placed after validation so invalid requests (self-bet, duplicate) do not
    # consume rate limit slots.
    check_rate_limit(current_user.id, "bet_invitation")

    # Validate beer wager
    beer_wager = body.beer_wager
    if beer_wager is not None:
        if beer_wager < 1:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_WAGER", "message": "Beer wager must be at least 1"},
            )
        if beer_wager > current_user.beer_balance:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INSUFFICIENT_BEERS",
                    "message": f"You only have {current_user.beer_balance} beers",
                },
            )

    # Fixed 72-hour expiry
    expires_at = datetime.now(timezone.utc) + timedelta(hours=72)

    # Create pending bet (off-chain per FR4)
    pending_bet = PendingBet(
        initiator_id=current_user.id,
        counterparty_user_id=cp_user.id,
        bet_terms=body.bet_terms,
        amount=body.amount.strip() if body.amount and body.amount.strip() else None,
        beer_wager=beer_wager,
        visibility=body.visibility.value,
        expires_at=expires_at,
    )

    # Escrow: deduct beers from initiator
    if beer_wager:
        current_user.beer_balance -= beer_wager
    db.add(pending_bet)
    db.commit()
    db.refresh(pending_bet)

    # Generate magic link for counterparty (linked to this bet)
    token = _generate_token()
    magic_link = MagicLink(
        token=token,
        user_id=cp_user.id,
        expires_at=expires_at,
        pending_bet_id=pending_bet.id,
    )
    db.add(magic_link)
    db.commit()

    # Send invitation to counterparty (FR4: terms always visible in notification).
    # Use identity hash prefix instead of raw identifier for privacy.
    initiator_label = f"user {hash_identity(current_user.identifier)[:8]}"
    link_url = f"{settings.magic_link_base_url}/auth/verify?token={token}"
    amount_text = f"\nAmount: {pending_bet.amount}" if pending_bet.amount else ""
    send_notification(
        identifier=cp_normalized,
        identifier_type=body.counterparty_identifier_type.value,
        subject="You have been invited to a bet!",
        body=(
            f"You have been invited to a bet by {initiator_label}.\n\n"
            f"Terms: {body.bet_terms}{amount_text}\n\n"
            f"Click here to review and respond: {link_url}"
        ),
    )

    return BetCreateResponse(
        bet_id=pending_bet.id, message="Bet created and invitation sent"
    )


@router.get("/pending", response_model=list[PendingBetSummary])
def list_pending_bets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pending bets where the current user is the counterparty."""
    now = datetime.now(timezone.utc)
    bets = (
        db.query(PendingBet)
        .filter(
            PendingBet.counterparty_user_id == current_user.id,
            PendingBet.status == "pending",
            PendingBet.expires_at > now,
        )
        .order_by(PendingBet.created_at.desc())
        .all()
    )
    results = []
    for bet in bets:
        initiator = db.query(User).filter(User.id == bet.initiator_id).first()
        results.append(
            PendingBetSummary(
                bet_id=bet.id,
                bet_terms=bet.bet_terms,
                amount=bet.amount,
                beer_wager=bet.beer_wager,
                visibility=bet.visibility,
                initiator_identifier=initiator.identifier if initiator else "unknown",
                initiator_identifier_type=initiator.identifier_type
                if initiator
                else "unknown",
                expires_at=bet.expires_at.isoformat(),
                created_at=bet.created_at.isoformat(),
            )
        )
    return results


@router.post("/{bet_id}/respond", response_model=BetAcceptResponse)
def respond_to_bet(
    bet_id: int,
    body: BetAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """FR5: Counterparty accepts or declines the bet."""
    pending_bet = db.query(PendingBet).filter(PendingBet.id == bet_id).first()

    if pending_bet is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "BET_NOT_FOUND", "message": "Bet not found"},
        )

    if pending_bet.status != "pending":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BET_NOT_PENDING",
                "message": f"Bet is already {pending_bet.status}",
            },
        )

    # Verify the current user is the counterparty (using FK, not raw identifier)
    if current_user.id != pending_bet.counterparty_user_id:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "NOT_COUNTERPARTY",
                "message": "Only the designated counterparty can respond to this bet",
            },
        )

    # Check expiry
    if pending_bet.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        pending_bet.status = "expired"
        # Refund initiator's escrowed beers
        if pending_bet.beer_wager:
            initiator_for_refund = db.query(User).filter(User.id == pending_bet.initiator_id).first()
            if initiator_for_refund:
                initiator_for_refund.beer_balance += pending_bet.beer_wager
        # FR12: Scrub hidden bet plaintext on inline expiry detection
        _scrub_hidden_bet_terms(pending_bet)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail={"code": "BET_EXPIRED", "message": "This bet has expired"},
        )

    initiator = db.query(User).filter(User.id == pending_bet.initiator_id).first()

    if body.accept:
        # Escrow: deduct beers from counterparty
        if pending_bet.beer_wager:
            if pending_bet.beer_wager > current_user.beer_balance:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "INSUFFICIENT_BEERS",
                        "message": f"You only have {current_user.beer_balance} beers",
                    },
                )
            current_user.beer_balance -= pending_bet.beer_wager

        # Accept: commit to chain (FR6)
        pending_bet.status = "accepted"

        block_data = _build_bet_block_data(pending_bet, initiator, current_user)

        # Notify both parties (FR8) -- must happen before scrubbing terms
        from app.main import blockchain

        block = blockchain.add_block(block_data)
        _notify_bet_participants(pending_bet, initiator, current_user, block)

        # FR12: Scrub hidden bet plaintext from the DB now that the block is committed.
        _scrub_hidden_bet_terms(pending_bet)
        db.commit()

        return BetAcceptResponse(
            status="accepted",
            block_hash=block.hash,
            block_index=block.index,
            timestamp=block.timestamp,
        )
    else:
        # Refund initiator's escrowed beers
        if pending_bet.beer_wager:
            initiator.beer_balance += pending_bet.beer_wager

        # FR5: Decline -> notify initiator, then delete the pending bet row.
        send_notification(
            identifier=initiator.identifier,
            identifier_type=initiator.identifier_type,
            subject="Bet declined",
            body="Your bet was declined by another user.",
        )

        db.delete(pending_bet)
        db.commit()

        return BetAcceptResponse(status="declined")


def _scrub_hidden_bet_terms(pending_bet: PendingBet) -> None:
    """FR12: Replace hidden bet plaintext with its hash after resolution.

    For hidden-visibility bets, the plaintext terms are only stored temporarily
    while the bet is pending (so the counterparty can review them per FR4).
    After accept/decline/expire, the plaintext must not persist.
    """
    if pending_bet.visibility == "hidden":
        pending_bet.bet_terms = (
            f"[scrubbed:sha256:{hash_content(pending_bet.bet_terms)}]"
        )


def _build_bet_block_data(
    pending_bet: PendingBet,
    initiator: User,
    counterparty: User,
) -> dict:
    """Build the block data for a bet per FR6."""
    data = {
        "type": "bet",
        "initiator_identity_hash": hash_identity(initiator.identifier),
        "counterparty_identity_hash": hash_identity(counterparty.identifier),
        "visibility": pending_bet.visibility,
        "timestamp": time.time(),
    }

    if pending_bet.visibility == "visible":
        data["bet_terms"] = pending_bet.bet_terms
    else:
        # Hidden bet: store hash only, discard plaintext (FR6, FR12)
        data["bet_terms_hash"] = hash_content(pending_bet.bet_terms)

    if pending_bet.amount:
        data["amount"] = pending_bet.amount
    if pending_bet.beer_wager:
        data["beer_wager"] = pending_bet.beer_wager

    return data


def _notify_bet_participants(
    pending_bet: PendingBet,
    initiator: User,
    counterparty: User,
    block,
) -> None:
    """Send notifications to both bet participants (FR8)."""
    if pending_bet.visibility == "visible":
        terms_info = f"Terms: {pending_bet.bet_terms}"
    else:
        terms_info = (
            f"Terms: {pending_bet.bet_terms}\n"
            f"Terms hash: {hash_content(pending_bet.bet_terms)}"
        )

    body_text = (
        f"A bet has been recorded on the chain.\n"
        f"Block hash: {block.hash}\n"
        f"Timestamp: {block.timestamp}\n"
        f"{terms_info}"
    )

    for user in [initiator, counterparty]:
        send_notification(
            identifier=user.identifier,
            identifier_type=user.identifier_type,
            subject="Bet recorded on chain",
            body=body_text,
        )


def _verify_service_secret(x_service_secret: str | None = Header(None)) -> None:
    """Verify the service secret for internal/admin endpoints.

    Requires the WINNIBETS_SERVICE_SECRET env var to be set and a matching
    X-Service-Secret header to be provided.
    """
    if not settings.service_secret:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "SERVICE_SECRET_NOT_CONFIGURED",
                "message": "Service secret not configured",
            },
        )
    if x_service_secret != settings.service_secret:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Invalid service secret"},
        )


@router.post("/_expire")
def expire_pending_bets(
    db: Session = Depends(get_db),
    _auth: None = Depends(_verify_service_secret),
):
    """FR7: Cancel expired pending bets. Called by scheduler/cron.

    Requires X-Service-Secret header matching WINNIBETS_SERVICE_SECRET.
    """
    now = datetime.now(timezone.utc)
    expired_bets = (
        db.query(PendingBet)
        .filter(
            PendingBet.status == "pending",
            PendingBet.expires_at < now,
        )
        .all()
    )

    for bet in expired_bets:
        bet.status = "expired"
        initiator = db.query(User).filter(User.id == bet.initiator_id).first()
        if initiator:
            # Refund initiator's escrowed beers
            if bet.beer_wager:
                initiator.beer_balance += bet.beer_wager
            send_notification(
                identifier=initiator.identifier,
                identifier_type=initiator.identifier_type,
                subject="Bet expired",
                body=f"Your bet (ID: {bet.id}) has expired because the counterparty did not respond.",
            )
        # FR12: Scrub hidden bet plaintext after expiry
        _scrub_hidden_bet_terms(bet)

    db.commit()
    return {"expired_count": len(expired_bets)}


# --- Bet resolution ---


def _get_accepted_bet_and_verify_participant(
    bet_id: int, db: Session, current_user: User
) -> tuple[PendingBet, User, User]:
    """Load an accepted bet and verify the current user is a participant.

    Returns (bet, initiator, counterparty).
    """

    bet = db.query(PendingBet).filter(PendingBet.id == bet_id).first()
    if bet is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "BET_NOT_FOUND", "message": "Bet not found"},
        )
    if bet.status != "accepted":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BET_NOT_ACCEPTED",
                "message": "Only accepted bets can be resolved",
            },
        )
    if current_user.id not in (bet.initiator_id, bet.counterparty_user_id):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "NOT_PARTICIPANT",
                "message": "Only bet participants can resolve a bet",
            },
        )

    initiator = db.query(User).filter(User.id == bet.initiator_id).first()
    counterparty = db.query(User).filter(User.id == bet.counterparty_user_id).first()
    return bet, initiator, counterparty


@router.post("/{bet_id}/resolve", response_model=BetResolveResponse, status_code=201)
def propose_resolution(
    bet_id: int,
    body: BetResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Propose a result for an accepted bet. The other party must confirm."""
    from app.models import BetResolution

    bet, initiator, counterparty = _get_accepted_bet_and_verify_participant(
        bet_id, db, current_user
    )

    # Check for existing pending resolution
    existing = (
        db.query(BetResolution)
        .filter(
            BetResolution.bet_id == bet_id,
            BetResolution.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "RESOLUTION_ALREADY_PENDING",
                "message": "A resolution proposal is already pending for this bet",
            },
        )

    # Check if already resolved
    accepted = (
        db.query(BetResolution)
        .filter(
            BetResolution.bet_id == bet_id,
            BetResolution.status == "accepted",
        )
        .first()
    )
    if accepted:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BET_ALREADY_RESOLVED",
                "message": "This bet has already been resolved",
            },
        )

    # Determine winner user ID from the winner side
    winner_id = (
        bet.initiator_id
        if body.winner.value == "initiator"
        else bet.counterparty_user_id
    )

    resolution = BetResolution(
        bet_id=bet_id,
        proposed_by_id=current_user.id,
        winner_id=winner_id,
        note=body.note,
    )
    db.add(resolution)
    db.commit()
    db.refresh(resolution)

    # Notify the other party
    other_user = counterparty if current_user.id == bet.initiator_id else initiator
    proposer_label = f"user {hash_identity(current_user.identifier)[:8]}"
    winner_label = "themselves" if winner_id == current_user.id else "you"
    note_text = f"\nNote: {body.note}" if body.note else ""
    send_notification(
        identifier=other_user.identifier,
        identifier_type=other_user.identifier_type,
        subject="Bet resolution proposed",
        body=(
            f"{proposer_label} has proposed a resolution for your bet.\n"
            f"Proposed winner: {winner_label}{note_text}\n\n"
            f"Log in to accept or reject this resolution."
        ),
    )

    return BetResolveResponse(
        resolution_id=resolution.id,
        message="Resolution proposed and notification sent",
    )


@router.post(
    "/{bet_id}/resolve/respond",
    response_model=BetResolveRespondResponse,
)
def respond_to_resolution(
    bet_id: int,
    body: BetResolveRespondRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept or reject a pending resolution proposal."""
    from app.models import BetResolution

    bet, initiator, counterparty = _get_accepted_bet_and_verify_participant(
        bet_id, db, current_user
    )

    resolution = (
        db.query(BetResolution)
        .filter(
            BetResolution.bet_id == bet_id,
            BetResolution.status == "pending",
        )
        .first()
    )
    if resolution is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NO_PENDING_RESOLUTION",
                "message": "No pending resolution for this bet",
            },
        )

    # The responder must be the other party (not the proposer)
    if current_user.id == resolution.proposed_by_id:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "CANNOT_RESPOND_OWN",
                "message": "You cannot accept or reject your own resolution proposal",
            },
        )

    if body.accept:
        resolution.status = "accepted"
        resolution.resolved_at = datetime.now(timezone.utc)

        # Transfer escrowed beers to winner
        if bet.beer_wager:
            winner_user = db.query(User).filter(User.id == resolution.winner_id).first()
            winner_user.beer_balance += bet.beer_wager * 2

        # Determine winner identity hash
        winner = db.query(User).filter(User.id == resolution.winner_id).first()

        block_data = {
            "type": "bet_resolution",
            "bet_block_type": "bet",
            "initiator_identity_hash": hash_identity(initiator.identifier),
            "counterparty_identity_hash": hash_identity(counterparty.identifier),
            "winner_identity_hash": hash_identity(winner.identifier),
            "winner_side": "initiator"
            if resolution.winner_id == bet.initiator_id
            else "counterparty",
            "timestamp": time.time(),
        }
        if resolution.note:
            block_data["note"] = resolution.note

        from app.main import blockchain

        block = blockchain.add_block(block_data)
        resolution.block_hash = block.hash
        db.commit()

        # Notify both parties
        winner_side = (
            "initiator" if resolution.winner_id == bet.initiator_id else "counterparty"
        )
        note_text = f"\nNote: {resolution.note}" if resolution.note else ""
        body_text = (
            f"A bet resolution has been recorded on the chain.\n"
            f"Winner: {winner_side}{note_text}\n"
            f"Block hash: {block.hash}\n"
            f"Timestamp: {block.timestamp}"
        )
        for user in [initiator, counterparty]:
            send_notification(
                identifier=user.identifier,
                identifier_type=user.identifier_type,
                subject="Bet resolved",
                body=body_text,
            )

        return BetResolveRespondResponse(
            status="accepted",
            block_hash=block.hash,
            block_index=block.index,
            timestamp=block.timestamp,
        )
    else:
        resolution.status = "rejected"
        db.commit()

        # Notify the proposer
        proposer = db.query(User).filter(User.id == resolution.proposed_by_id).first()
        send_notification(
            identifier=proposer.identifier,
            identifier_type=proposer.identifier_type,
            subject="Resolution rejected",
            body="Your proposed bet resolution was rejected by the other party.",
        )

        return BetResolveRespondResponse(status="rejected")
