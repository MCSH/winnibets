"""Block lookup and chain integrity endpoints (FR9, FR10)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.hashing import hash_identity
from app.models import User
from app.schemas import BlockListResponse, BlockLookupResponse, BlockSummary, IntegrityResponse

router = APIRouter(prefix="/blocks", tags=["blocks"])

_IDENTITY_HASH_KEYS = {
    "identity_hash",
    "initiator_identity_hash",
    "counterparty_identity_hash",
}


def _collect_identity_hashes(blocks_data: list[dict]) -> set[str]:
    """Extract all identity hashes from a list of block data dicts."""
    hashes: set[str] = set()
    for data in blocks_data:
        for key in _IDENTITY_HASH_KEYS:
            val = data.get(key)
            if val and isinstance(val, str):
                hashes.add(val)
    return hashes


def _resolve_nicknames(identity_hashes: set[str], db: Session) -> dict[str, str]:
    """Map identity hashes to nicknames for users that have one."""
    if not identity_hashes:
        return {}
    users = db.query(User).filter(User.nickname.isnot(None)).all()
    hash_to_nick: dict[str, str] = {}
    for user in users:
        h = hash_identity(user.identifier)
        if h in identity_hashes:
            hash_to_nick[h] = user.nickname
    return hash_to_nick


@router.get("/list", response_model=BlockListResponse)
def list_blocks(offset: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """Browse the blockchain. Public endpoint (no auth required).

    Returns paginated blocks with offset/limit. Default page size is 20, max 100.
    """
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100
    if offset < 0:
        offset = 0

    from app.main import blockchain

    blocks, total = blockchain.get_blocks(offset, limit)

    blocks_data = [b.data for b in blocks]
    identity_hashes = _collect_identity_hashes(blocks_data)
    nicknames = _resolve_nicknames(identity_hashes, db)

    return BlockListResponse(
        blocks=[
            BlockSummary(
                block_index=b.index,
                block_hash=b.hash,
                timestamp=b.timestamp,
                record_type=b.data.get("type", "unknown"),
                data=b.data,
            )
            for b in blocks
        ],
        total=total,
        offset=offset,
        limit=limit,
        nicknames=nicknames,
    )


@router.get("/{block_hash}", response_model=BlockLookupResponse)
def lookup_block(block_hash: str):
    """FR9: Look up a block by its hash. Public endpoint (no auth required)."""
    from app.main import blockchain

    block = blockchain.get_block_by_hash(block_hash)
    if block is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "BLOCK_NOT_FOUND", "message": "Block not found"},
        )

    record_type = block.data.get("type", "unknown")

    return BlockLookupResponse(
        block_index=block.index,
        timestamp=block.timestamp,
        record_type=record_type,
        data=block.data,
    )


@router.get("/", response_model=IntegrityResponse)
def verify_chain_integrity():
    """FR10: Walk the chain and verify every block's hash linkage."""
    from app.main import blockchain

    valid, info = blockchain.verify_integrity()

    if valid:
        return IntegrityResponse(valid=True, blocks=info["blocks"])
    else:
        return IntegrityResponse(
            valid=False, first_invalid_block=info["first_invalid_block"]
        )
