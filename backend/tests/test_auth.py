"""Tests for magic link authentication (FR1)."""

from datetime import datetime, timedelta, timezone

import pytest
from app.models import MagicLink, User


class TestRequestMagicLink:
    """FR1: Users submit a phone number, system sends a magic link."""

    def test_request_magic_link_with_phone(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+14155551234", "identifier_type": "phone"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["message"] == "Magic link sent"
        assert "token" not in body

    def test_request_magic_link_creates_user_if_new(self, client, db_session):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+14155559999", "identifier_type": "phone"},
        )
        assert resp.status_code == 200

    def test_request_magic_link_invalid_type(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+14155551234", "identifier_type": "email"},
        )
        assert resp.status_code == 422

    def test_request_magic_link_empty_identifier(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "", "identifier_type": "phone"},
        )
        assert resp.status_code == 422


class TestVerifyMagicLink:
    """FR1: Clicking the link creates or resumes a session."""

    def test_verify_valid_token(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+15550010001", "identifier_type": "phone"},
        )
        assert resp.status_code == 200

        resp = client.get("/auth/_test/latest-token?identifier=%2B15550010001")
        token = resp.json()["token"]

        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 200
        body = resp.json()
        assert "session_token" in body
        assert len(body["session_token"]) > 0

    def test_verify_expired_token_returns_401(self, client):
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+15550010002", "identifier_type": "phone"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=%2B15550010002")
        token = resp.json()["token"]

        client.post("/auth/_test/expire-token", json={"token": token})

        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 401
        detail = resp.json()["detail"]
        assert "expired" in detail["message"].lower() or "invalid" in detail["message"].lower()

    def test_verify_used_token_returns_401(self, client):
        """Magic links are single-use (NFR2)."""
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+15550010003", "identifier_type": "phone"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=%2B15550010003")
        token = resp.json()["token"]

        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 200

        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 401

    def test_verify_unknown_token_returns_401(self, client):
        resp = client.get("/auth/verify?token=nonexistent_token_abc123")
        assert resp.status_code == 401

    def test_magic_link_token_has_sufficient_entropy(self, client):
        """NFR2: Tokens must have >= 128 bits of entropy."""
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+15550010004", "identifier_type": "phone"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=%2B15550010004")
        token = resp.json()["token"]
        assert len(token) >= 32


class TestSessionAuth:
    """Session token is used for authenticated endpoints."""

    def test_authenticated_request_with_valid_session(self, client):
        client.post(
            "/auth/magic-link",
            json={"identifier": "+15550010005", "identifier_type": "phone"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=%2B15550010005")
        token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={token}")
        session_token = resp.json()["session_token"]

        resp = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {session_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["identifier"] == "+15550010005"

    def test_unauthenticated_request_returns_401(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_invalid_session_token_returns_401(self, client):
        resp = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token_xyz"},
        )
        assert resp.status_code == 401
