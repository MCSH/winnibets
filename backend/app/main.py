"""FastAPI application entry point."""

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.blockchain import Block, Blockchain
from app.database import SessionLocal, create_tables
from app.models import ChainBlock

logger = logging.getLogger(__name__)


def _persist_block(block: Block) -> None:
    """Save a new block to the ChainBlock table."""
    db = SessionLocal()
    try:
        row = ChainBlock(
            index=block.index,
            timestamp=block.timestamp,
            data=json.dumps(block.data, sort_keys=True),
            previous_hash=block.previous_hash,
            hash=block.hash,
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to persist block %d", block.index)
    finally:
        db.close()


def _load_chain() -> Blockchain:
    """Create a Blockchain, loading any persisted blocks from the DB."""
    chain = Blockchain(on_new_block=_persist_block)

    db = SessionLocal()
    try:
        rows = db.query(ChainBlock).order_by(ChainBlock.index).all()
        if rows:
            blocks = []
            for row in rows:
                b = Block(
                    index=row.index,
                    timestamp=row.timestamp,
                    data=json.loads(row.data),
                    previous_hash=row.previous_hash,
                )
                # Verify the hash matches what was stored
                if b.hash != row.hash:
                    logger.error(
                        "Hash mismatch for block %d: computed=%s stored=%s",
                        row.index,
                        b.hash,
                        row.hash,
                    )
                blocks.append(b)
            chain.load_persisted_blocks(blocks)
        else:
            # First run — persist the genesis block
            genesis = chain.chain[0]
            _persist_block(genesis)
    finally:
        db.close()

    return chain


# Singleton blockchain instance (loaded after tables are created)
blockchain: Blockchain = Blockchain()


def _reset_blockchain() -> None:
    """Reset the blockchain (for test isolation only)."""
    global blockchain
    blockchain = Blockchain()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global blockchain
    create_tables()
    blockchain = _load_chain()
    logger.info("Blockchain loaded with %d blocks", len(blockchain.chain))
    yield


app = FastAPI(
    title="WinniBets Community Blockchain Ledger",
    description="Hidden Messages & Bets on a private blockchain",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.auth import router as auth_router  # noqa: E402
from app.messages import router as messages_router  # noqa: E402
from app.blocks import router as blocks_router  # noqa: E402
from app.bets import router as bets_router  # noqa: E402
from app.activity import router as activity_router  # noqa: E402
from app.contacts import router as contacts_router  # noqa: E402

app.include_router(auth_router)
app.include_router(messages_router)
app.include_router(blocks_router)
app.include_router(bets_router)
app.include_router(activity_router)
app.include_router(contacts_router)
