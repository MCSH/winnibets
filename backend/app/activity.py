"""User activity endpoint: on-chain blocks and bets involving the current user."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.hashing import hash_identity
from app.models import PendingBet, User
from app.schemas import ActivityResponse, ActivityBlock, ActivityBet

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("/my", response_model=ActivityResponse)
def my_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all on-chain blocks and bets involving the current user."""
    from app.main import blockchain

    identity_hash = hash_identity(current_user.identifier)

    # Scan the chain for blocks involving this user
    user_blocks: list[ActivityBlock] = []
    for block in blockchain.chain:
        data = block.data
        record_type = data.get("type", "unknown")
        if record_type == "genesis":
            continue

        is_mine = False
        role = "author"

        if record_type in ("hidden_message", "open_message"):
            if data.get("identity_hash") == identity_hash:
                is_mine = True
        elif record_type == "bet":
            if data.get("initiator_identity_hash") == identity_hash:
                is_mine = True
                role = "initiator"
            elif data.get("counterparty_identity_hash") == identity_hash:
                is_mine = True
                role = "counterparty"

        if is_mine:
            user_blocks.append(
                ActivityBlock(
                    block_index=block.index,
                    block_hash=block.hash,
                    timestamp=block.timestamp,
                    record_type=record_type,
                    role=role,
                    data=data,
                )
            )

    # Reverse so newest first
    user_blocks.reverse()

    # Get bets the user initiated or is counterparty on (all statuses)
    bets = (
        db.query(PendingBet)
        .filter(
            (PendingBet.initiator_id == current_user.id)
            | (PendingBet.counterparty_user_id == current_user.id)
        )
        .order_by(PendingBet.created_at.desc())
        .all()
    )

    now = datetime.now(timezone.utc)
    activity_bets: list[ActivityBet] = []
    for bet in bets:
        initiator = db.query(User).filter(User.id == bet.initiator_id).first()
        counterparty = (
            db.query(User).filter(User.id == bet.counterparty_user_id).first()
        )
        is_initiator = bet.initiator_id == current_user.id

        # Check if expired but not yet marked
        status = bet.status
        if status == "pending":
            expires = (
                bet.expires_at.replace(tzinfo=timezone.utc)
                if bet.expires_at.tzinfo is None
                else bet.expires_at
            )
            if expires < now:
                status = "expired"

        activity_bets.append(
            ActivityBet(
                bet_id=bet.id,
                bet_terms=bet.bet_terms,
                visibility=bet.visibility,
                status=status,
                role="initiator" if is_initiator else "counterparty",
                counterparty_identifier=counterparty.identifier
                if counterparty and is_initiator
                else None,
                counterparty_identifier_type=counterparty.identifier_type
                if counterparty and is_initiator
                else None,
                initiator_identifier=initiator.identifier
                if initiator and not is_initiator
                else None,
                initiator_identifier_type=initiator.identifier_type
                if initiator and not is_initiator
                else None,
                expires_at=bet.expires_at.isoformat(),
                created_at=bet.created_at.isoformat(),
            )
        )

    return ActivityResponse(
        blocks=user_blocks,
        bets=activity_bets,
    )
