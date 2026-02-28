"""Tests for GET /blocks/list (paginated block browsing)."""

from urllib.parse import quote


def _get_session_token(client, phone="+15553000000"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": phone, "identifier_type": "phone"},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={quote(phone, safe='')}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestBlockList:
    def test_list_returns_genesis(self, client):
        resp = client.get("/blocks/list")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert body["blocks"][0]["record_type"] == "genesis"

    def test_no_auth_required(self, client):
        """GET /blocks/list works without Authorization header."""
        resp = client.get("/blocks/list")
        assert resp.status_code == 200

    def test_pagination_offset_limit(self, client):
        session = _get_session_token(client)
        for i in range(5):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"Block list test {i}"},
                headers={"Authorization": f"Bearer {session}"},
            )

        resp = client.get("/blocks/list?offset=0&limit=2")
        body = resp.json()
        assert len(body["blocks"]) == 2
        assert body["offset"] == 0
        assert body["limit"] == 2
        assert body["total"] == 6  # genesis + 5

        resp = client.get("/blocks/list?offset=2&limit=2")
        body = resp.json()
        assert len(body["blocks"]) == 2
        assert body["blocks"][0]["block_index"] == 2

    def test_default_limit(self, client):
        resp = client.get("/blocks/list")
        body = resp.json()
        assert body["limit"] == 20

    def test_limit_capped_at_100(self, client):
        resp = client.get("/blocks/list?limit=500")
        body = resp.json()
        assert body["limit"] == 100

    def test_offset_beyond_chain(self, client):
        resp = client.get("/blocks/list?offset=99999")
        body = resp.json()
        assert body["blocks"] == []
        assert body["total"] >= 1

    def test_includes_all_block_types(self, client):
        session = _get_session_token(client, "+15553001000")
        # hidden message
        client.post(
            "/messages/hidden",
            json={"plaintext": "Hidden"},
            headers={"Authorization": f"Bearer {session}"},
        )
        # open message
        client.post(
            "/messages",
            json={"plaintext": "Open", "visibility": "visible"},
            headers={"Authorization": f"Bearer {session}"},
        )

        resp = client.get("/blocks/list?limit=100")
        types = {b["record_type"] for b in resp.json()["blocks"]}
        assert "genesis" in types
        assert "hidden_message" in types
        assert "open_message" in types

    def test_block_data_matches_lookup(self, client):
        session = _get_session_token(client, "+15553002000")
        client.post(
            "/messages/hidden",
            json={"plaintext": "Cross check"},
            headers={"Authorization": f"Bearer {session}"},
        )

        list_resp = client.get("/blocks/list?offset=1&limit=1")
        listed = list_resp.json()["blocks"][0]

        lookup_resp = client.get(f"/blocks/{listed['block_hash']}")
        looked_up = lookup_resp.json()

        assert listed["block_index"] == looked_up["block_index"]
        assert listed["record_type"] == looked_up["record_type"]
        assert listed["data"] == looked_up["data"]
