"""Public user profile lookup by identity hash."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.hashing import hash_identity
from app.models import BetResolution, IDVerification, PendingBet, User

router = APIRouter(prefix="/profiles", tags=["profiles"])


class PublicProfile(BaseModel):
    identity_hash: str
    nickname: Optional[str] = None
    beer_balance: int = 10
    verified: bool = False
    avatar_seed: int = 0
    stats: dict


class LeaderboardEntry(BaseModel):
    identity_hash: str
    nickname: Optional[str] = None
    beer_balance: int = 10
    verified: bool = False
    avatar_seed: int = 0
    bets: int = 0
    wins: int = 0
    losses: int = 0


@router.get("/leaderboard/list", response_model=list[LeaderboardEntry])
def get_leaderboard(db: Session = Depends(get_db)):
    """Return all users with at least one bet, with stats."""
    users = db.query(User).all()

    # Preload all resolutions
    all_resolutions = db.query(BetResolution).filter(BetResolution.status == "accepted").all()
    resolution_map: dict[int, BetResolution] = {}
    for r in all_resolutions:
        resolution_map[r.bet_id] = r

    # Preload verified user IDs
    verified_ids = {
        v.user_id
        for v in db.query(IDVerification).filter(IDVerification.status == "verified").all()
    }

    entries: list[LeaderboardEntry] = []
    for user in users:
        bets = (
            db.query(PendingBet)
            .filter(
                (PendingBet.initiator_id == user.id)
                | (PendingBet.counterparty_user_id == user.id)
            )
            .all()
        )
        if not bets:
            continue

        wins = 0
        losses = 0
        for bet in bets:
            res = resolution_map.get(bet.id)
            if res:
                if res.winner_id == user.id:
                    wins += 1
                else:
                    losses += 1

        entries.append(
            LeaderboardEntry(
                identity_hash=hash_identity(user.identifier),
                nickname=user.nickname,
                beer_balance=user.beer_balance,
                verified=user.id in verified_ids,
                avatar_seed=user.avatar_seed,
                bets=len(bets),
                wins=wins,
                losses=losses,
            )
        )

    return entries


@router.get("/{identity_hash}", response_model=PublicProfile)
def get_public_profile(identity_hash: str, db: Session = Depends(get_db)):
    """Look up a user's public profile by their identity hash."""
    # Find the user whose identifier hashes to this value
    users = db.query(User).all()
    target = None
    for user in users:
        if hash_identity(user.identifier) == identity_hash:
            target = user
            break

    if target is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_NOT_FOUND", "message": "No user found for this identity hash"},
        )

    # Check verification status
    verification = (
        db.query(IDVerification)
        .filter(IDVerification.user_id == target.id, IDVerification.status == "verified")
        .first()
    )

    # Count stats from bets
    bets = (
        db.query(PendingBet)
        .filter(
            (PendingBet.initiator_id == target.id)
            | (PendingBet.counterparty_user_id == target.id)
        )
        .all()
    )

    wins = 0
    losses = 0
    for bet in bets:
        resolution = (
            db.query(BetResolution)
            .filter(BetResolution.bet_id == bet.id, BetResolution.status == "accepted")
            .first()
        )
        if resolution:
            if resolution.winner_id == target.id:
                wins += 1
            else:
                losses += 1

    # Count on-chain blocks
    from app.main import blockchain

    block_count = 0
    for block in blockchain.chain:
        data = block.data
        if data.get("identity_hash") == identity_hash:
            block_count += 1
        elif data.get("initiator_identity_hash") == identity_hash:
            block_count += 1
        elif data.get("counterparty_identity_hash") == identity_hash:
            block_count += 1

    return PublicProfile(
        identity_hash=identity_hash,
        nickname=target.nickname,
        beer_balance=target.beer_balance,
        verified=verification is not None,
        avatar_seed=target.avatar_seed,
        stats={
            "bets": len(bets),
            "wins": wins,
            "losses": losses,
            "on_chain": block_count,
        },
    )
