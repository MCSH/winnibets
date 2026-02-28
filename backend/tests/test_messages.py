"""Tests for unified message submission endpoint (POST /messages)."""

import hashlib
from urllib.parse import quote


def _get_session_token(client, phone="+15552000000"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": phone, "identifier_type": "phone"},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={quote(phone, safe='')}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestOpenMessageSubmission:
    def test_submit_open_message_returns_201(self, client):
        session = _get_session_token(client)
        resp = client.post(
            "/messages",
            json={"plaintext": "Hello world", "visibility": "visible"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["visibility"] == "visible"
        assert "message_hash" in body
        assert "block_hash" in body
        assert "block_index" in body
        assert "timestamp" in body

    def test_open_message_block_contains_plaintext(self, client):
        session = _get_session_token(client)
        plaintext = "This message is public"
        resp = client.post(
            "/messages",
            json={"plaintext": plaintext, "visibility": "visible"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["type"] == "open_message"
        assert data["message"] == plaintext

    def test_open_message_includes_message_hash(self, client):
        session = _get_session_token(client)
        plaintext = "Verifiable content"
        resp = client.post(
            "/messages",
            json={"plaintext": plaintext, "visibility": "visible"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        expected = hashlib.sha256(plaintext.encode()).hexdigest()
        assert data["message_hash"] == expected

    def test_open_message_identity_is_hashed(self, client):
        phone = "+15552001001"
        session = _get_session_token(client, phone)
        resp = client.post(
            "/messages",
            json={"plaintext": "Check identity", "visibility": "visible"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert phone not in str(data)
        assert "identity_hash" in data


class TestHiddenMessageViaUnifiedEndpoint:
    def test_submit_hidden_via_unified(self, client):
        session = _get_session_token(client, "+15552002000")
        resp = client.post(
            "/messages",
            json={"plaintext": "Secret stuff", "visibility": "hidden"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201
        assert resp.json()["visibility"] == "hidden"

    def test_hidden_block_does_not_contain_plaintext(self, client):
        session = _get_session_token(client, "+15552002001")
        plaintext = "Do not store this on chain"
        resp = client.post(
            "/messages",
            json={"plaintext": plaintext, "visibility": "hidden"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["type"] == "hidden_message"
        assert plaintext not in str(data)
        assert "message_hash" in data


class TestUnifiedMessageValidation:
    def test_empty_plaintext_rejected(self, client):
        session = _get_session_token(client, "+15552003000")
        resp = client.post(
            "/messages",
            json={"plaintext": "", "visibility": "visible"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 422

    def test_missing_visibility_rejected(self, client):
        session = _get_session_token(client, "+15552003001")
        resp = client.post(
            "/messages",
            json={"plaintext": "No visibility field"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 422

    def test_unauthenticated_rejected(self, client):
        resp = client.post(
            "/messages",
            json={"plaintext": "No auth", "visibility": "visible"},
        )
        assert resp.status_code == 401
