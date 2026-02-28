"""Tests for block lookup (FR9) and chain integrity (FR10) endpoints."""

import pytest


def _get_session_token(client, email="block@test.com"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": email, "identifier_type": "email"},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={email}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestBlockLookup:
    """FR9: Any user can query a block by hash."""

    def test_lookup_existing_block(self, client):
        session = _get_session_token(client)
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "For lookup test"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        # Lookup without auth (public endpoint)
        resp = client.get(f"/blocks/{block_hash}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["block_index"] >= 1
        assert body["record_type"] == "hidden_message"
        assert "data" in body

    def test_lookup_returns_identity_hashes_not_raw(self, client):
        session = _get_session_token(client, "lookup@test.com")
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "Identity check"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert "lookup@test.com" not in str(data)
        assert "identity_hash" in data

    def test_lookup_unknown_hash_returns_404(self, client):
        resp = client.get("/blocks/0000000000000000000000000000000000000000000000000000000000000000")
        assert resp.status_code == 404

    def test_lookup_visible_bet_shows_terms(self, client):
        """FR9: visible bets show the bet terms."""
        session = _get_session_token(client, "vbet@test.com")
        client.post(
            "/bets",
            json={
                "bet_terms": "Visible terms for lookup",
                "counterparty_identifier": "vbetcp@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        # Accept the bet
        resp = client.get("/auth/_test/latest-token?identifier=vbetcp@test.com")
        cp_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]
        resp = client.post(
            "/bets/1/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["bet_terms"] == "Visible terms for lookup"

    def test_lookup_hidden_bet_shows_hash_only(self, client):
        """FR9: hidden bets show only the content hash."""
        session = _get_session_token(client, "hbet@test.com")
        client.post(
            "/bets",
            json={
                "bet_terms": "Hidden terms for lookup test",
                "counterparty_identifier": "hbetcp2@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=hbetcp2@test.com")
        cp_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]
        resp = client.post(
            "/bets/1/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert "bet_terms" not in data
        assert "bet_terms_hash" in data
        assert "Hidden terms for lookup test" not in str(data)


class TestChainIntegrity:
    """FR10: Chain integrity verification endpoint."""

    def test_integrity_check_on_fresh_chain(self, client):
        resp = client.get("/blocks/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["blocks"] == 1  # Genesis only

    def test_integrity_check_after_messages(self, client):
        session = _get_session_token(client)
        for i in range(5):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"Integrity test {i}"},
                headers={"Authorization": f"Bearer {session}"},
            )

        resp = client.get("/blocks/")
        body = resp.json()
        assert body["valid"] is True
        assert body["blocks"] == 6  # Genesis + 5

    def test_integrity_response_schema(self, client):
        """NFR9: Consistent JSON schema."""
        resp = client.get("/blocks/")
        body = resp.json()
        assert "valid" in body
        assert "blocks" in body
