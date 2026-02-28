"""Core blockchain: Block and Blockchain classes.

This is a private/permissioned chain. Blocks are appended with
proof-of-authority (single-node authority in this implementation).
Blocks are persisted to the ChainBlock SQLAlchemy table for durability.
"""

import hashlib
import json
import logging
import threading
import time
from typing import Any, Callable

logger = logging.getLogger(__name__)


class Block:
    """A single block in the chain."""

    def __init__(
        self,
        index: int,
        timestamp: float,
        data: dict[str, Any],
        previous_hash: str,
    ) -> None:
        self.index = index
        self.timestamp = timestamp
        self.data = data
        self.previous_hash = previous_hash
        self.hash: str = self.compute_hash()

    def compute_hash(self) -> str:
        """Return SHA-256 hex digest of block contents."""
        block_content = json.dumps(
            {
                "index": self.index,
                "timestamp": self.timestamp,
                "data": self.data,
                "previous_hash": self.previous_hash,
            },
            sort_keys=True,
        )
        return hashlib.sha256(block_content.encode("utf-8")).hexdigest()


# Type alias for the persistence callback
PersistCallback = Callable[[Block], None]


class Blockchain:
    """Blockchain with append, lookup, integrity verification, and optional persistence."""

    def __init__(self, on_new_block: PersistCallback | None = None) -> None:
        self._lock = threading.Lock()
        self.chain: list[Block] = []
        self._hash_index: dict[str, int] = {}
        self._on_new_block = on_new_block
        self._create_genesis_block()

    def _create_genesis_block(self) -> None:
        genesis = Block(
            index=0,
            timestamp=0.0,
            data={"type": "genesis"},
            previous_hash="0",
        )
        self.chain.append(genesis)
        self._hash_index[genesis.hash] = 0

    def load_persisted_blocks(self, blocks: list[Block]) -> None:
        """Replace the in-memory chain with previously persisted blocks.

        Called once at startup before any new blocks are added.
        The provided blocks must include the genesis block and be in order.
        """
        with self._lock:
            self.chain = blocks
            self._hash_index = {b.hash: b.index for b in blocks}
            logger.info("Loaded %d persisted blocks", len(blocks))

    def add_block(self, data: dict[str, Any]) -> Block:
        """Create and append a new block with the given data. Returns the new block.

        Thread-safe: uses a lock to prevent concurrent modifications.
        """
        with self._lock:
            previous_block = self.chain[-1]
            new_block = Block(
                index=len(self.chain),
                timestamp=time.time(),
                data=data,
                previous_hash=previous_block.hash,
            )
            self.chain.append(new_block)
            self._hash_index[new_block.hash] = new_block.index

        # Persist outside the lock to avoid holding it during DB I/O
        if self._on_new_block:
            try:
                self._on_new_block(new_block)
            except Exception:
                logger.exception("Failed to persist block %d", new_block.index)

        return new_block

    def get_block_by_hash(self, block_hash: str) -> Block | None:
        """Look up a block by its hash. Returns None if not found."""
        idx = self._hash_index.get(block_hash)
        if idx is not None:
            return self.chain[idx]
        return None

    def get_blocks(self, offset: int = 0, limit: int = 20) -> tuple[list[Block], int]:
        """Return a slice of the chain and the total block count."""
        total = len(self.chain)
        if offset >= total:
            return [], total
        end = min(offset + limit, total)
        return self.chain[offset:end], total

    def verify_integrity(self) -> tuple[bool, dict[str, Any]]:
        """Walk the chain and verify hash linkage for every block.

        Returns (True, {"blocks": N}) if valid, or
        (False, {"first_invalid_block": index}) on the first invalid block.
        """
        for i in range(len(self.chain)):
            block = self.chain[i]
            # Verify the stored hash matches recomputed hash
            if block.hash != block.compute_hash():
                return False, {"first_invalid_block": i}
            # Verify linkage to previous block (skip genesis)
            if i > 0:
                if block.previous_hash != self.chain[i - 1].hash:
                    return False, {"first_invalid_block": i}
        return True, {"blocks": len(self.chain)}
