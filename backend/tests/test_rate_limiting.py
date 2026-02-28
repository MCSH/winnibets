"""Tests for rate limiting (FR11)."""

import pytest
from urllib.parse import quote


def _get_session_token(client, phone="+15557000000"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": phone, "identifier_type": "phone"},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={quote(phone, safe='')}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestSubmissionRateLimit:
    """FR11: 20 record submissions per hour per user."""

    def test_submissions_within_limit_succeed(self, client):
        session = _get_session_token(client, "+15557001001")
        for i in range(5):
            resp = client.post(
                "/messages/hidden",
                json={"plaintext": f"Rate limit test {i}"},
                headers={"Authorization": f"Bearer {session}"},
            )
            assert resp.status_code == 201

    def test_submissions_exceeding_limit_return_429(self, client):
        session = _get_session_token(client, "+15557002001")
        for i in range(20):
            resp = client.post(
                "/messages/hidden",
                json={"plaintext": f"Msg {i}"},
                headers={"Authorization": f"Bearer {session}"},
            )
            assert resp.status_code == 201, f"Failed on message {i}: {resp.json()}"

        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "One too many"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers

    def test_rate_limit_is_per_user(self, client):
        """Different users have independent limits."""
        session1 = _get_session_token(client, "+15557003001")
        session2 = _get_session_token(client, "+15557003002")

        for i in range(20):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"User1 msg {i}"},
                headers={"Authorization": f"Bearer {session1}"},
            )

        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "User1 blocked"},
            headers={"Authorization": f"Bearer {session1}"},
        )
        assert resp.status_code == 429

        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "User2 ok"},
            headers={"Authorization": f"Bearer {session2}"},
        )
        assert resp.status_code == 201


class TestBetInvitationRateLimit:
    """FR11: 10 bet invitations per hour per user."""

    def test_bet_invitations_exceeding_limit_return_429(self, client):
        session = _get_session_token(client, "+15557004001")
        for i in range(10):
            resp = client.post(
                "/bets",
                json={
                    "bet_terms": f"Bet {i}",
                    "counterparty_identifier": f"+1555700{4100 + i}",
                    "counterparty_identifier_type": "phone",
                    "visibility": "visible",
                },
                headers={"Authorization": f"Bearer {session}"},
            )
            assert resp.status_code == 201, f"Failed on bet {i}: {resp.json()}"

        resp = client.post(
            "/bets",
            json={
                "bet_terms": "One too many",
                "counterparty_identifier": "+15557009999",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers
