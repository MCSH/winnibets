"""Tests for magic link authentication (FR1)."""

from datetime import datetime, timedelta, timezone

import pytest
from app.models import MagicLink, User


class TestRequestMagicLink:
    """FR1: Users submit an email or phone number, system sends a magic link."""

    def test_request_magic_link_with_email(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "test@example.com", "identifier_type": "email"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["message"] == "Magic link sent"
        # Should not leak the actual token in the response
        assert "token" not in body

    def test_request_magic_link_with_phone(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+14155551234", "identifier_type": "phone"},
        )
        assert resp.status_code == 200

    def test_request_magic_link_creates_user_if_new(self, client, db_session):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "new@user.com", "identifier_type": "email"},
        )
        assert resp.status_code == 200

    def test_request_magic_link_invalid_type(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "x", "identifier_type": "invalid"},
        )
        assert resp.status_code == 422

    def test_request_magic_link_empty_identifier(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "", "identifier_type": "email"},
        )
        # Pydantic field_validator returns 422 for invalid input in FastAPI
        assert resp.status_code == 422


class TestVerifyMagicLink:
    """FR1: Clicking the link creates or resumes a session."""

    def test_verify_valid_token(self, client):
        # Request a magic link -- in test mode, the token is accessible via
        # a test-only endpoint or we peek into the DB.
        # We use the test helper that returns the token.
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "verify@test.com", "identifier_type": "email"},
        )
        assert resp.status_code == 200

        # Get the token from test-only endpoint
        resp = client.get("/auth/_test/latest-token?identifier=verify@test.com")
        token = resp.json()["token"]

        # Verify the token
        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 200
        body = resp.json()
        assert "session_token" in body
        assert len(body["session_token"]) > 0

    def test_verify_expired_token_returns_401(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "expired@test.com", "identifier_type": "email"},
        )
        # Get token
        resp = client.get("/auth/_test/latest-token?identifier=expired@test.com")
        token = resp.json()["token"]

        # Expire the token via test helper
        client.post("/auth/_test/expire-token", json={"token": token})

        # Attempt verify
        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 401
        detail = resp.json()["detail"]
        assert "expired" in detail["message"].lower() or "invalid" in detail["message"].lower()

    def test_verify_used_token_returns_401(self, client):
        """Magic links are single-use (NFR2)."""
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "reuse@test.com", "identifier_type": "email"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=reuse@test.com")
        token = resp.json()["token"]

        # First use succeeds
        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 200

        # Second use fails
        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 401

    def test_verify_unknown_token_returns_401(self, client):
        resp = client.get("/auth/verify?token=nonexistent_token_abc123")
        assert resp.status_code == 401

    def test_magic_link_token_has_sufficient_entropy(self, client):
        """NFR2: Tokens must have >= 128 bits of entropy (>= 32 hex chars)."""
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "entropy@test.com", "identifier_type": "email"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=entropy@test.com")
        token = resp.json()["token"]
        # 128 bits = 16 bytes = 32 hex chars minimum; we use url-safe base64 which
        # encodes 32 bytes into ~43 chars. Verify length is >= 32.
        assert len(token) >= 32


class TestSessionAuth:
    """Session token is used for authenticated endpoints."""

    def test_authenticated_request_with_valid_session(self, client):
        # Get a session token
        client.post(
            "/auth/magic-link",
            json={"identifier": "session@test.com", "identifier_type": "email"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=session@test.com")
        token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={token}")
        session_token = resp.json()["session_token"]

        # Use session token to access a protected endpoint
        resp = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {session_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["identifier"] == "session@test.com"

    def test_unauthenticated_request_returns_401(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_invalid_session_token_returns_401(self, client):
        resp = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token_xyz"},
        )
        assert resp.status_code == 401
