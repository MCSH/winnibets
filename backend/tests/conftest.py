"""Shared test fixtures."""

import os
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Enable debug mode BEFORE importing app modules so that test-only endpoints
# are registered (they are guarded behind settings.debug).
os.environ.setdefault("WINNIBETS_DEBUG", "true")
# Set a service secret for testing the authenticated expiry endpoint.
os.environ.setdefault("WINNIBETS_SERVICE_SECRET", "test-service-secret")

from app.models import Base, MagicLink, User
from app.database import get_db
from app.hashing import normalize_identifier
from app.main import app


@pytest.fixture
def db_engine():
    """Create an in-memory SQLite engine with StaticPool so all connections
    share the same in-memory database."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    """Provide a transactional database session for tests."""
    TestSession = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_engine):
    """FastAPI test client with overridden DB dependency."""
    TestSession = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    from app.main import _reset_blockchain
    from app.rate_limit import _reset as _reset_rate_limit

    with TestClient(app) as c:
        # Reset AFTER lifespan starts so _load_chain() doesn't leak blocks
        _reset_blockchain()
        _reset_rate_limit()
        yield c

    app.dependency_overrides.clear()
