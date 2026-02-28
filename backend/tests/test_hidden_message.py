"""Tests for hidden message submission (FR2, FR3, FR12)."""

import hashlib

import pytest


def _get_session_token(client, phone="+15551000000"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": phone, "identifier_type": "phone"},
    )
    from urllib.parse import quote
    resp = client.get(f"/auth/_test/latest-token?identifier={quote(phone, safe='')}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestHiddenMessageSubmission:
    """FR2: Submit plaintext, get hash back, block committed."""

    def test_submit_hidden_message_returns_hashes(self, client):
        session = _get_session_token(client)
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "My secret prediction"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "message_hash" in body
        assert "block_hash" in body
        assert "block_index" in body
        assert "timestamp" in body

    def test_message_hash_matches_sha256_of_plaintext(self, client):
        session = _get_session_token(client)
        plaintext = "This is a test message for hashing"
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": plaintext},
            headers={"Authorization": f"Bearer {session}"},
        )
        expected_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
        assert resp.json()["message_hash"] == expected_hash

    def test_block_index_increments(self, client):
        session = _get_session_token(client)
        r1 = client.post(
            "/messages/hidden",
            json={"plaintext": "First"},
            headers={"Authorization": f"Bearer {session}"},
        )
        r2 = client.post(
            "/messages/hidden",
            json={"plaintext": "Second"},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert r2.json()["block_index"] == r1.json()["block_index"] + 1

    def test_empty_plaintext_rejected(self, client):
        session = _get_session_token(client)
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": ""},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 422

    def test_whitespace_only_plaintext_rejected(self, client):
        session = _get_session_token(client)
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "   \n\t  "},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 422

    def test_unauthenticated_request_rejected(self, client):
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "No auth"},
        )
        assert resp.status_code == 401


class TestHiddenMessageOnChainData:
    """FR3: Block stores identity_hash, message_hash, timestamp, type. No plaintext."""

    def test_block_contains_required_fields(self, client):
        session = _get_session_token(client)
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "Check the block data"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["type"] == "hidden_message"
        assert "identity_hash" in data
        assert "message_hash" in data
        assert "timestamp" in data

    def test_block_does_not_contain_plaintext(self, client):
        session = _get_session_token(client)
        plaintext = "Super secret message nobody should see"
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": plaintext},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert plaintext not in str(data)

    def test_block_does_not_contain_raw_phone(self, client):
        phone = "+15559876543"
        session = _get_session_token(client, phone=phone)
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": "Check for raw phone"},
            headers={"Authorization": f"Bearer {session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert phone not in str(data)


class TestPlaintextNonRetention:
    """FR12: Plaintext must not be logged, cached, or persisted."""

    def test_plaintext_not_in_response_except_as_hash(self, client):
        session = _get_session_token(client)
        plaintext = "unique_plaintext_12345_never_store_me"
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": plaintext},
            headers={"Authorization": f"Bearer {session}"},
        )
        body = resp.json()
        assert plaintext not in str(body)
        expected_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
        assert body["message_hash"] == expected_hash
