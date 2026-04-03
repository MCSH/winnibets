"""SQLAlchemy models for users, magic links, pending bets, and persisted chain blocks."""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Boolean,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Normalized identifier: lowercased email or E.164 phone number.
    identifier = Column(String(255), unique=True, nullable=False)
    identifier_type = Column(String(10), nullable=False)  # "email" or "phone"
    nickname = Column(String(255), nullable=True)
    beer_balance = Column(Integer, nullable=False, default=10)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    magic_links = relationship("MagicLink", back_populates="user")
    pending_bets = relationship(
        "PendingBet",
        back_populates="initiator",
        foreign_keys="PendingBet.initiator_id",
    )


class MagicLink(Base):
    __tablename__ = "magic_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    # Optional: link a pending bet to this magic link (for bet acceptance flow)
    pending_bet_id = Column(Integer, ForeignKey("pending_bets.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="magic_links")
    pending_bet = relationship("PendingBet", foreign_keys=[pending_bet_id])


class PendingBet(Base):
    __tablename__ = "pending_bets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    initiator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # FK to the counterparty user. The counterparty user is always created
    # at bet-creation time (find-or-create) so this is never null.
    counterparty_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # FR4 requires the counterparty to review the terms before accepting, so
    # hidden bet terms must be stored temporarily while pending. After the bet
    # is accepted/declined/expired, the plaintext is scrubbed and replaced with
    # the SHA-256 hash to satisfy FR12 (no persisting hidden bet terms after
    # the block is committed).
    bet_terms = Column(Text, nullable=False)
    amount = Column(String(100), nullable=True)  # optional wager amount (free-text)
    beer_wager = Column(Integer, nullable=True)  # optional beer wager
    visibility = Column(String(10), nullable=False)  # "visible" or "hidden"
    status = Column(
        String(20), default="pending", nullable=False
    )  # pending, accepted, declined, expired
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    initiator = relationship(
        "User", back_populates="pending_bets", foreign_keys=[initiator_id]
    )
    counterparty = relationship("User", foreign_keys=[counterparty_user_id])


class ChainBlock(Base):
    """Persisted copy of blockchain blocks for durability.

    NOTE: This model is intentionally not written to yet. The current
    implementation uses an in-memory blockchain (app.blockchain.Blockchain).
    Persisting blocks to this table is deferred to a future phase when
    durability across restarts is required.
    """

    __tablename__ = "chain_blocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    index = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False)
    data = Column(Text, nullable=False)  # JSON-serialized block data
    previous_hash = Column(String(64), nullable=False)
    hash = Column(String(64), unique=True, nullable=False, index=True)


class Contact(Base):
    """Private named contacts. Each user can assign friendly names to identifiers."""

    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    identifier = Column(String(255), nullable=False)
    identifier_type = Column(String(10), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    owner = relationship("User", foreign_keys=[owner_id])

    __table_args__ = (
        UniqueConstraint("owner_id", "identifier", name="uq_contact_owner_identifier"),
    )


class BetResolution(Base):
    """Proposed and accepted bet resolutions.

    One party proposes a result (winner + optional note). The other party
    accepts or rejects. If accepted, a new block is committed to the chain.
    """

    __tablename__ = "bet_resolutions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bet_id = Column(Integer, ForeignKey("pending_bets.id"), nullable=False)
    proposed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=True)
    status = Column(
        String(20), default="pending", nullable=False
    )  # pending, accepted, rejected
    block_hash = Column(String(64), nullable=True)  # set when accepted and committed
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    bet = relationship("PendingBet", foreign_keys=[bet_id])
    proposed_by = relationship("User", foreign_keys=[proposed_by_id])
    winner = relationship("User", foreign_keys=[winner_id])


class IDVerification(Base):
    """ID document verification results."""

    __tablename__ = "id_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_type = Column(String(20), nullable=False)  # "passport" or "drivers_license"
    provided_name = Column(String(255), nullable=False)
    extracted_name = Column(String(255), nullable=True)
    mrz_valid = Column(Boolean, nullable=True)
    name_match = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False)  # "verified", "failed"
    failure_reason = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", foreign_keys=[user_id])


class SessionToken(Base):
    """Active user sessions created after magic link verification."""

    __tablename__ = "session_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User")
