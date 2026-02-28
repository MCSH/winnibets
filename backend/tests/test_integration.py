"""End-to-end integration tests covering full flows from the PRD."""

import hashlib

import pytest


def _get_session_token(client, identifier, identifier_type="email"):
    """Helper: register/login and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": identifier, "identifier_type": identifier_type},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={identifier}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestFullHiddenMessageFlow:
    """Integration: verification -> hidden message -> notification -> lookup."""

    def test_full_hidden_message_flow(self, client):
        # Step 1: Request magic link
        resp = client.post(
            "/auth/magic-link",
            json={"identifier": "alice@example.com", "identifier_type": "email"},
        )
        assert resp.status_code == 200

        # Step 2: Verify magic link
        resp = client.get("/auth/_test/latest-token?identifier=alice@example.com")
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

        # Verify the message hash
        expected_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        assert msg_data["message_hash"] == expected_hash

        # Step 4: Look up the block
        resp = client.get(f"/blocks/{msg_data['block_hash']}")
        assert resp.status_code == 200
        block = resp.json()
        assert block["record_type"] == "hidden_message"
        assert block["data"]["message_hash"] == expected_hash
        # Plaintext NEVER appears in block data
        assert plaintext not in str(block["data"])
        # Raw email NEVER appears in block data
        assert "alice@example.com" not in str(block["data"])

        # Step 5: Verify chain integrity
        resp = client.get("/blocks/")
        assert resp.json()["valid"] is True


class TestFullVisibleBetFlow:
    """Integration: verification -> bet creation -> acceptance -> lookup."""

    def test_full_visible_bet_flow(self, client):
        # Alice creates the bet
        alice_session = _get_session_token(client, "alice_bet@example.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "I bet it snows in July",
                "counterparty_identifier": "bob_bet@example.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {alice_session}"},
        )
        assert resp.status_code == 201
        bet_id = resp.json()["bet_id"]

        # Bet is NOT on chain yet
        resp = client.get("/blocks/")
        assert resp.json()["blocks"] == 1  # Only genesis

        # Bob receives invitation and verifies
        resp = client.get("/auth/_test/latest-token?identifier=bob_bet@example.com")
        bob_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={bob_token}")
        bob_session = resp.json()["session_token"]

        # Bob accepts the bet
        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {bob_session}"},
        )
        assert resp.status_code == 200
        accept_data = resp.json()
        assert accept_data["status"] == "accepted"
        assert accept_data["block_hash"] is not None

        # Block is now on chain
        resp = client.get(f"/blocks/{accept_data['block_hash']}")
        assert resp.status_code == 200
        block = resp.json()
        assert block["data"]["type"] == "bet"
        assert block["data"]["visibility"] == "visible"
        assert block["data"]["bet_terms"] == "I bet it snows in July"
        # No raw identifiers
        assert "alice_bet@example.com" not in str(block["data"])
        assert "bob_bet@example.com" not in str(block["data"])

        # Chain is still valid
        resp = client.get("/blocks/")
        assert resp.json()["valid"] is True
        assert resp.json()["blocks"] == 2  # Genesis + bet


class TestFullHiddenBetFlow:
    """Integration: hidden bet creation -> acceptance -> only hash on chain."""

    def test_full_hidden_bet_flow(self, client):
        alice_session = _get_session_token(client, "alice_hbet@example.com")
        terms = "Secret wager about something"
        resp = client.post(
            "/bets",
            json={
                "bet_terms": terms,
                "counterparty_identifier": "bob_hbet@example.com",
                "counterparty_identifier_type": "email",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {alice_session}"},
        )
        assert resp.status_code == 201
        bet_id = resp.json()["bet_id"]

        # Bob accepts
        resp = client.get("/auth/_test/latest-token?identifier=bob_hbet@example.com")
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

        # Verify block data
        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["type"] == "bet"
        assert data["visibility"] == "hidden"
        # Plaintext terms NOT on chain
        assert "bet_terms" not in data
        # Only the hash
        assert data["bet_terms_hash"] == hashlib.sha256(terms.encode()).hexdigest()


class TestBetDeclineFlow:
    """Integration: bet creation -> decline -> no block."""

    def test_decline_bet_notifies_initiator_no_block(self, client):
        alice_session = _get_session_token(client, "alice_dec@example.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "This will be declined",
                "counterparty_identifier": "bob_dec@example.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {alice_session}"},
        )
        bet_id = resp.json()["bet_id"]

        # Bob declines
        resp = client.get("/auth/_test/latest-token?identifier=bob_dec@example.com")
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

        # Chain still has only genesis
        resp = client.get("/blocks/")
        assert resp.json()["blocks"] == 1


class TestChainIntegrityAcrossOperations:
    """Integration: multiple operations, chain stays valid."""

    def test_chain_valid_after_mixed_operations(self, client):
        alice = _get_session_token(client, "alice_mix@example.com")

        # Submit 3 hidden messages
        for i in range(3):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"Message {i}"},
                headers={"Authorization": f"Bearer {alice}"},
            )

        # Create and accept a bet
        client.post(
            "/bets",
            json={
                "bet_terms": "Mix bet",
                "counterparty_identifier": "bob_mix@example.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {alice}"},
        )
        resp = client.get("/auth/_test/latest-token?identifier=bob_mix@example.com")
        bob_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={bob_token}")
        bob_session = resp.json()["session_token"]
        client.post(
            "/bets/1/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {bob_session}"},
        )

        # Submit 2 more hidden messages
        for i in range(2):
            client.post(
                "/messages/hidden",
                json={"plaintext": f"After bet {i}"},
                headers={"Authorization": f"Bearer {alice}"},
            )

        # Verify chain integrity
        resp = client.get("/blocks/")
        body = resp.json()
        assert body["valid"] is True
        assert body["blocks"] == 7  # genesis + 3 messages + 1 bet + 2 messages
