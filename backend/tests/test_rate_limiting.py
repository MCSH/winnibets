"""Tests for rate limiting (FR11)."""

import pytest


def _get_session_token(client, email="ratelimit@test.com"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": email, "identifier_type": "email"},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={email}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestSubmissionRateLimit:
    """FR11: 20 record submissions per hour per user."""

    def test_submissions_within_limit_succeed(self, client):
        session = _get_session_token(client, "rl_ok@test.com")
        for i in range(5):
            resp = client.post(
                "/messages/hidden",
                json={"plaintext": f"Rate limit test {i}"},
                headers={"Authorization": f"Bearer {session}"},
            )
            assert resp.status_code == 201

    def test_submissions_exceeding_limit_return_429(self, client):
        session = _get_session_token(client, "rl_exceed@test.com")
        # Submit 20 messages (the limit)
        for i in range(20):
            resp = client.post(
                "/messages/hidden",
                json={"plaintext": f"Msg {i}"},
                headers={"Authorization": f"Bearer {session}"},
            )
            assert resp.status_code == 201, f"Failed on message {i}: {resp.json()}"

        # The 21st should be rate-limited
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "One too many"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers

    def test_rate_limit_is_per_user(self, client):
        """Different users have independent limits."""
        session1 = _get_session_token(client, "rl_user1@test.com")
        session2 = _get_session_token(client, "rl_user2@test.com")

        # User 1 hits the limit
        for i in range(20):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"User1 msg {i}"},
                headers={"Authorization": f"Bearer {session1}"},
            )

        # User 1 is blocked
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "User1 blocked"},
            headers={"Authorization": f"Bearer {session1}"},
        )
        assert resp.status_code == 429

        # User 2 can still submit
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "User2 ok"},
            headers={"Authorization": f"Bearer {session2}"},
        )
        assert resp.status_code == 201


class TestBetInvitationRateLimit:
    """FR11: 10 bet invitations per hour per user."""

    def test_bet_invitations_exceeding_limit_return_429(self, client):
        session = _get_session_token(client, "rl_bet@test.com")
        for i in range(10):
            resp = client.post(
                "/bets",
                json={
                    "bet_terms": f"Bet {i}",
                    "counterparty_identifier": f"cp{i}@test.com",
                    "counterparty_identifier_type": "email",
                    "visibility": "visible",
                },
                headers={"Authorization": f"Bearer {session}"},
            )
            assert resp.status_code == 201, f"Failed on bet {i}: {resp.json()}"

        # The 11th should be rate-limited
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "One too many",
                "counterparty_identifier": "cpextra@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers
