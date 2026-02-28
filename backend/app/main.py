"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.blockchain import Blockchain
from app.database import create_tables


# Singleton blockchain instance
blockchain = Blockchain()


def _reset_blockchain() -> None:
    """Reset the blockchain (for test isolation only)."""
    global blockchain
    blockchain = Blockchain()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
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

app.include_router(auth_router)
app.include_router(messages_router)
app.include_router(blocks_router)
app.include_router(bets_router)
