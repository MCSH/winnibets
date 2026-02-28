"""Tests for SQLAlchemy database models."""

import time
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, User, MagicLink, PendingBet, ChainBlock


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database and return a session."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


class TestUserModel:
    def test_create_user_with_email(self, db_session):
        user = User(identifier="test@example.com", identifier_type="email")
        db_session.add(user)
        db_session.commit()
        assert user.id is not None
        assert user.identifier == "test@example.com"
        assert user.identifier_type == "email"

    def test_create_user_with_phone(self, db_session):
        user = User(identifier="+14155551234", identifier_type="phone")
        db_session.add(user)
        db_session.commit()
        assert user.identifier_type == "phone"

    def test_user_has_created_at(self, db_session):
        user = User(identifier="a@b.com", identifier_type="email")
        db_session.add(user)
        db_session.commit()
        assert user.created_at is not None

    def test_user_identifier_is_unique(self, db_session):
        u1 = User(identifier="dup@test.com", identifier_type="email")
        u2 = User(identifier="dup@test.com", identifier_type="email")
        db_session.add(u1)
        db_session.commit()
        db_session.add(u2)
        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()


class TestMagicLinkModel:
    def test_create_magic_link(self, db_session):
        user = User(identifier="ml@test.com", identifier_type="email")
        db_session.add(user)
        db_session.commit()

        link = MagicLink(
            token="abc123",
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
        db_session.add(link)
        db_session.commit()
        assert link.id is not None
        assert link.used is False

    def test_magic_link_token_is_unique(self, db_session):
        user = User(identifier="ml2@test.com", identifier_type="email")
        db_session.add(user)
        db_session.commit()

        l1 = MagicLink(
            token="same_token",
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
        l2 = MagicLink(
            token="same_token",
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
        db_session.add(l1)
        db_session.commit()
        db_session.add(l2)
        with pytest.raises(Exception):
            db_session.commit()


class TestPendingBetModel:
    def test_create_pending_bet(self, db_session):
        initiator = User(identifier="init@test.com", identifier_type="email")
        counterparty = User(identifier="+14155559999", identifier_type="phone")
        db_session.add_all([initiator, counterparty])
        db_session.commit()

        bet = PendingBet(
            initiator_id=initiator.id,
            counterparty_user_id=counterparty.id,
            bet_terms="I bet it rains tomorrow",
            visibility="visible",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=72),
        )
        db_session.add(bet)
        db_session.commit()
        assert bet.id is not None
        assert bet.status == "pending"

    def test_pending_bet_visibility_hidden(self, db_session):
        user = User(identifier="h@test.com", identifier_type="email")
        cp = User(identifier="cp@test.com", identifier_type="email")
        db_session.add_all([user, cp])
        db_session.commit()

        bet = PendingBet(
            initiator_id=user.id,
            counterparty_user_id=cp.id,
            bet_terms="Secret bet terms",
            visibility="hidden",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=72),
        )
        db_session.add(bet)
        db_session.commit()
        assert bet.visibility == "hidden"

    def test_pending_bet_statuses(self, db_session):
        user = User(identifier="st@test.com", identifier_type="email")
        cp = User(identifier="cp2@test.com", identifier_type="email")
        db_session.add_all([user, cp])
        db_session.commit()

        bet = PendingBet(
            initiator_id=user.id,
            counterparty_user_id=cp.id,
            bet_terms="Some terms",
            visibility="visible",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=72),
        )
        db_session.add(bet)
        db_session.commit()
        assert bet.status == "pending"

        bet.status = "accepted"
        db_session.commit()
        assert bet.status == "accepted"


class TestChainBlockModel:
    def test_create_chain_block(self, db_session):
        block = ChainBlock(
            index=0,
            timestamp=time.time(),
            data='{"type": "genesis"}',
            previous_hash="0",
            hash="abc123hash",
        )
        db_session.add(block)
        db_session.commit()
        assert block.id is not None

    def test_chain_block_hash_unique(self, db_session):
        ts = time.time()
        b1 = ChainBlock(
            index=0, timestamp=ts, data="{}", previous_hash="0", hash="same_hash"
        )
        b2 = ChainBlock(
            index=1, timestamp=ts, data="{}", previous_hash="same_hash", hash="same_hash"
        )
        db_session.add(b1)
        db_session.commit()
        db_session.add(b2)
        with pytest.raises(Exception):
            db_session.commit()
