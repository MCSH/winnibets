"""Tests for block lookup (FR9) and chain integrity (FR10) endpoints."""

import pytest
from urllib.parse import quote


def _get_session_token(client, phone="+15558000000"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": phone, "identifier_type": "phone"},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={quote(phone, safe='')}")
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

        resp = client.get(f"/blocks/{block_hash}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["block_index"] >= 1
        assert body["record_type"] == "hidden_message"
        assert "data" in body

    def test_lookup_returns_identity_hashes_not_raw(self, client):
        phone = "+15558001001"
        session = _get_session_token(client, phone)
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "Identity check"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert phone not in str(data)
        assert "identity_hash" in data

    def test_lookup_unknown_hash_returns_404(self, client):
        resp = client.get("/blocks/0000000000000000000000000000000000000000000000000000000000000000")
        assert resp.status_code == 404

    def test_lookup_visible_bet_shows_terms(self, client):
        """FR9: visible bets show the bet terms."""
        session = _get_session_token(client, "+15558002001")
        client.post(
            "/bets",
            json={
                "bet_terms": "Visible terms for lookup",
                "counterparty_identifier": "+15558002002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=%2B15558002002")
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
        session = _get_session_token(client, "+15558003001")
        client.post(
            "/bets",
            json={
                "bet_terms": "Hidden terms for lookup test",
                "counterparty_identifier": "+15558003002",
                "counterparty_identifier_type": "phone",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=%2B15558003002")
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
