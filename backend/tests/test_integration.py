"""End-to-end integration tests covering full flows from the PRD."""

import hashlib
from urllib.parse import quote

import pytest


def _get_session_token(client, phone, identifier_type="phone"):
    """Helper: register/login and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": phone, "identifier_type": identifier_type},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={quote(phone, safe='')}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestFullHiddenMessageFlow:
    """Integration: verification -> hidden message -> notification -> lookup."""

    def test_full_hidden_message_flow(self, client):
        # Step 1: Request magic link
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "+15556001001", "identifier_type": "phone"},
        )
        assert resp.status_code == 200

        # Step 2: Verify magic link
        resp = client.get("/auth/_test/latest-token?identifier=%2B15556001001")
        token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 200
        session = resp.json()["session_token"]

        # Step 3: Submit hidden message
        plaintext = "The answer to everything is 42"
        resp = client.post(
            "/messages/hidden",
            json={"plaintext": plaintext},
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201
        msg_data = resp.json()

        expected_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        assert msg_data["message_hash"] == expected_hash

        # Step 4: Look up the block
        resp = client.get(f"/blocks/{msg_data['block_hash']}")
        assert resp.status_code == 200
        block = resp.json()
        assert block["record_type"] == "hidden_message"
        assert block["data"]["message_hash"] == expected_hash
        assert plaintext not in str(block["data"])
        assert "+15556001001" not in str(block["data"])

        # Step 5: Verify chain integrity
        resp = client.get("/blocks/")
        assert resp.json()["valid"] is True


class TestFullVisibleBetFlow:
    """Integration: verification -> bet creation -> acceptance -> lookup."""

    def test_full_visible_bet_flow(self, client):
        alice_session = _get_session_token(client, "+15556002001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "I bet it snows in July",
                "counterparty_identifier": "+15556002002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {alice_session}"},
        )
        assert resp.status_code == 201
        bet_id = resp.json()["bet_id"]

        resp = client.get("/blocks/")
        assert resp.json()["blocks"] == 1  # Only genesis

        resp = client.get("/auth/_test/latest-token?identifier=%2B15556002002")
        bob_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={bob_token}")
        bob_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {bob_session}"},
        )
        assert resp.status_code == 200
        accept_data = resp.json()
        assert accept_data["status"] == "accepted"
        assert accept_data["block_hash"] is not None

        resp = client.get(f"/blocks/{accept_data['block_hash']}")
        assert resp.status_code == 200
        block = resp.json()
        assert block["data"]["type"] == "bet"
        assert block["data"]["visibility"] == "visible"
        assert block["data"]["bet_terms"] == "I bet it snows in July"
        assert "+15556002001" not in str(block["data"])
        assert "+15556002002" not in str(block["data"])

        resp = client.get("/blocks/")
        assert resp.json()["valid"] is True
        assert resp.json()["blocks"] == 2  # Genesis + bet


class TestFullHiddenBetFlow:
    """Integration: hidden bet creation -> acceptance -> only hash on chain."""

    def test_full_hidden_bet_flow(self, client):
        alice_session = _get_session_token(client, "+15556003001")
        terms = "Secret wager about something"
        resp = client.post(
            "/bets",
            json={
                "bet_terms": terms,
                "counterparty_identifier": "+15556003002",
                "counterparty_identifier_type": "phone",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {alice_session}"},
        )
        assert resp.status_code == 201
        bet_id = resp.json()["bet_id"]

        resp = client.get("/auth/_test/latest-token?identifier=%2B15556003002")
        bob_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={bob_token}")
        bob_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {bob_session}"},
        )
        assert resp.status_code == 200
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["type"] == "bet"
        assert data["visibility"] == "hidden"
        assert "bet_terms" not in data
        assert data["bet_terms_hash"] == hashlib.sha256(terms.encode()).hexdigest()


class TestBetDeclineFlow:
    """Integration: bet creation -> decline -> no block."""

    def test_decline_bet_notifies_initiator_no_block(self, client):
        alice_session = _get_session_token(client, "+15556004001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "This will be declined",
                "counterparty_identifier": "+15556004002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {alice_session}"},
        )
        bet_id = resp.json()["bet_id"]

        resp = client.get("/auth/_test/latest-token?identifier=%2B15556004002")
        bob_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={bob_token}")
        bob_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": False},
            headers={"Authorization": f"Bearer {bob_session}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "declined"

        resp = client.get("/blocks/")
        assert resp.json()["blocks"] == 1


class TestChainIntegrityAcrossOperations:
    """Integration: multiple operations, chain stays valid."""

    def test_chain_valid_after_mixed_operations(self, client):
        alice = _get_session_token(client, "+15556005001")

        for i in range(3):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"Message {i}"},
                headers={"Authorization": f"Bearer {alice}"},
            )

        client.post(
            "/bets",
            json={
                "bet_terms": "Mix bet",
                "counterparty_identifier": "+15556005002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {alice}"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=%2B15556005002")
        bob_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={bob_token}")
        bob_session = resp.json()["session_token"]
        client.post(
            "/bets/1/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {bob_session}"},
        )

        for i in range(2):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"After bet {i}"},
                headers={"Authorization": f"Bearer {alice}"},
            )

        resp = client.get("/blocks/")
        body = resp.json()
        assert body["valid"] is True
        assert body["blocks"] == 7  # genesis + 3 messages + 1 bet + 2 messages
