"""Tests for blockchain core: block creation, chain append, lookup, integrity."""

import time

import pytest

from app.blockchain import Block, Blockchain


class TestBlock:
    """Tests for individual block creation and hashing."""

    def test_genesis_block_has_index_zero(self):
        chain = Blockchain()
        genesis = chain.chain[0]
        assert genesis.index == 0

    def test_genesis_block_previous_hash_is_zero_string(self):
        chain = Blockchain()
        genesis = chain.chain[0]
        assert genesis.previous_hash == "0"

    def test_block_hash_is_deterministic(self):
        block = Block(
            index=1,
            timestamp=1000000.0,
            data={"type": "hidden_message", "message_hash": "abc123"},
            previous_hash="0000",
        )
        hash1 = block.compute_hash()
        hash2 = block.compute_hash()
        assert hash1 == hash2

    def test_block_hash_changes_with_different_data(self):
        block1 = Block(
            index=1,
            timestamp=1000000.0,
            data={"message_hash": "abc"},
            previous_hash="0000",
        )
        block2 = Block(
            index=1,
            timestamp=1000000.0,
            data={"message_hash": "xyz"},
            previous_hash="0000",
        )
        assert block1.compute_hash() != block2.compute_hash()

    def test_block_hash_is_sha256_hex(self):
        block = Block(
            index=0,
            timestamp=1000000.0,
            data={},
            previous_hash="0",
        )
        h = block.compute_hash()
        assert len(h) == 64  # SHA-256 hex digest length
        assert all(c in "0123456789abcdef" for c in h)


class TestBlockchain:
    """Tests for blockchain operations: append, lookup, integrity."""

    def test_new_chain_has_genesis_block(self):
        chain = Blockchain()
        assert len(chain.chain) == 1

    def test_append_block_increases_length(self):
        chain = Blockchain()
        data = {"type": "hidden_message", "message_hash": "abc"}
        chain.add_block(data)
        assert len(chain.chain) == 2

    def test_appended_block_links_to_previous(self):
        chain = Blockchain()
        chain.add_block({"type": "hidden_message", "message_hash": "abc"})
        block = chain.chain[1]
        genesis = chain.chain[0]
        assert block.previous_hash == genesis.hash

    def test_appended_block_has_correct_index(self):
        chain = Blockchain()
        chain.add_block({"data": "first"})
        chain.add_block({"data": "second"})
        assert chain.chain[1].index == 1
        assert chain.chain[2].index == 2

    def test_appended_block_has_timestamp(self):
        chain = Blockchain()
        before = time.time()
        chain.add_block({"data": "test"})
        after = time.time()
        block = chain.chain[1]
        assert before <= block.timestamp <= after

    def test_appended_block_stores_data(self):
        chain = Blockchain()
        data = {"type": "hidden_message", "identity_hash": "id1", "message_hash": "m1"}
        chain.add_block(data)
        assert chain.chain[1].data == data

    def test_add_block_returns_the_new_block(self):
        chain = Blockchain()
        block = chain.add_block({"type": "test"})
        assert block.index == 1
        assert block.hash is not None

    def test_lookup_by_hash_returns_block(self):
        chain = Blockchain()
        block = chain.add_block({"type": "test"})
        found = chain.get_block_by_hash(block.hash)
        assert found is not None
        assert found.index == block.index
        assert found.data == block.data

    def test_lookup_by_hash_returns_none_for_unknown(self):
        chain = Blockchain()
        assert chain.get_block_by_hash("nonexistent") is None

    def test_integrity_check_passes_on_valid_chain(self):
        chain = Blockchain()
        chain.add_block({"data": "a"})
        chain.add_block({"data": "b"})
        chain.add_block({"data": "c"})
        valid, info = chain.verify_integrity()
        assert valid is True
        assert info["blocks"] == 4  # genesis + 3

    def test_integrity_check_fails_on_tampered_data(self):
        chain = Blockchain()
        chain.add_block({"data": "a"})
        chain.add_block({"data": "b"})
        # Tamper with block 1's data
        chain.chain[1].data = {"data": "tampered"}
        valid, info = chain.verify_integrity()
        assert valid is False
        assert info["first_invalid_block"] == 1

    def test_integrity_check_fails_on_tampered_hash_linkage(self):
        chain = Blockchain()
        chain.add_block({"data": "a"})
        chain.add_block({"data": "b"})
        # Break linkage: change block 2's previous_hash
        chain.chain[2].previous_hash = "0000broken"
        valid, info = chain.verify_integrity()
        assert valid is False
        assert info["first_invalid_block"] == 2

    def test_multiple_blocks_integrity(self):
        """Chain with 100 blocks should pass integrity check."""
        chain = Blockchain()
        for i in range(100):
            chain.add_block({"index": i})
        valid, info = chain.verify_integrity()
        assert valid is True
        assert info["blocks"] == 101
