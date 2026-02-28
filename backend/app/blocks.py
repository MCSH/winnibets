"""Block lookup and chain integrity endpoints (FR9, FR10)."""

from fastapi import APIRouter, HTTPException

from app.schemas import BlockLookupResponse, IntegrityResponse

router = APIRouter(prefix="/blocks", tags=["blocks"])


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
