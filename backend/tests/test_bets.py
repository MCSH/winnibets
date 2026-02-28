"""Tests for bet creation, acceptance, decline, and expiry (FR4, FR5, FR6, FR7)."""

import hashlib
import time

import pytest


def _get_session_token(client, email="betuser@test.com"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": email, "identifier_type": "email"},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={email}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestBetCreation:
    """FR4: A verified user creates a bet and invites a counterparty."""

    def test_create_visible_bet(self, client):
        session = _get_session_token(client, "initiator@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "I bet it rains tomorrow",
                "counterparty_identifier": "counter@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "bet_id" in body
        assert body["message"] == "Bet created and invitation sent"

    def test_create_hidden_bet(self, client):
        session = _get_session_token(client, "hinit@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Secret bet terms",
                "counterparty_identifier": "hcounter@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201

    def test_create_bet_with_phone_counterparty(self, client):
        session = _get_session_token(client, "phoneinit@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Phone bet",
                "counterparty_identifier": "+14155559999",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201

    def test_create_bet_self_counterparty_rejected(self, client):
        """Edge case: counterparty is the same as initiator."""
        session = _get_session_token(client, "self@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Bet with myself",
                "counterparty_identifier": "self@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 400

    def test_create_duplicate_bet_rejected(self, client):
        """Edge case: duplicate pending bet with same initiator and terms."""
        session = _get_session_token(client, "dup@test.com")
        payload = {
            "bet_terms": "Exact same terms",
            "counterparty_identifier": "dupcp@test.com",
            "counterparty_identifier_type": "email",
            "visibility": "visible",
        }
        r1 = client.post("/bets", json=payload, headers={"Authorization": f"Bearer {session}"})
        assert r1.status_code == 201
        r2 = client.post("/bets", json=payload, headers={"Authorization": f"Bearer {session}"})
        assert r2.status_code == 400

    def test_create_bet_unauthenticated(self, client):
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "No auth bet",
                "counterparty_identifier": "noauth@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
        )
        assert resp.status_code == 401

    def test_create_bet_empty_terms_rejected(self, client):
        session = _get_session_token(client, "empty@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "",
                "counterparty_identifier": "someone@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 422

    def test_pending_bet_not_on_chain(self, client):
        """FR4: Pending bet is NOT recorded on-chain."""
        session = _get_session_token(client, "pending@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Not yet on chain",
                "counterparty_identifier": "pendcp@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        # Check chain integrity -- should only have genesis block (no bet blocks)
        resp = client.get("/blocks/")
        assert resp.json()["blocks"] == 1  # Only genesis


class TestBetAcceptance:
    """FR5: Counterparty accepts or declines the bet."""

    def _create_bet_and_get_acceptance_token(self, client):
        """Helper: create a bet and retrieve the acceptance magic link token."""
        session = _get_session_token(client, "acceptinit@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "I bet the sun rises tomorrow",
                "counterparty_identifier": "acceptcp@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        # Get the magic link token sent to counterparty
        resp = client.get("/auth/_test/latest-token?identifier=acceptcp@test.com")
        cp_token = resp.json()["token"]

        return bet_id, cp_token

    def test_accept_bet_commits_block(self, client):
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        # Counterparty verifies via magic link
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        # Accept the bet
        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "accepted"
        assert "block_hash" in body
        assert body["block_hash"] is not None

    def test_decline_bet_no_block(self, client):
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": False},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "declined"
        assert body["block_hash"] is None

    def test_accept_bet_creates_correct_block_data_visible(self, client):
        """FR6: Visible bet block stores plaintext terms."""
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        block_hash = resp.json()["block_hash"]

        # Look up the block
        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["type"] == "bet"
        assert data["visibility"] == "visible"
        assert data["bet_terms"] == "I bet the sun rises tomorrow"
        assert "bet_terms_hash" not in data
        assert "initiator_identity_hash" in data
        assert "counterparty_identity_hash" in data

    def test_accept_hidden_bet_creates_correct_block_data(self, client):
        """FR6: Hidden bet block stores hash, not plaintext."""
        session = _get_session_token(client, "hbetinit@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Hidden bet secret terms",
                "counterparty_identifier": "hbetcp@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        # Get counterparty token and accept
        resp = client.get("/auth/_test/latest-token?identifier=hbetcp@test.com")
        cp_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["type"] == "bet"
        assert data["visibility"] == "hidden"
        assert "bet_terms" not in data  # No plaintext
        expected_hash = hashlib.sha256("Hidden bet secret terms".encode()).hexdigest()
        assert data["bet_terms_hash"] == expected_hash

    def test_block_does_not_contain_raw_identifiers(self, client):
        """NFR5: No raw emails/phones on chain."""
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data_str = str(resp.json()["data"])
        assert "acceptinit@test.com" not in data_str
        assert "acceptcp@test.com" not in data_str

    def test_only_counterparty_can_accept(self, client):
        """Only the designated counterparty can accept the bet."""
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        # A different user tries to accept
        other_session = _get_session_token(client, "other@test.com")
        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {other_session}"},
        )
        assert resp.status_code == 403

    def test_hidden_bet_terms_scrubbed_after_accept(self, client, db_session):
        """FR12: Hidden bet plaintext is scrubbed from DB after acceptance."""
        session = _get_session_token(client, "scrubacc@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Scrub me after accept",
                "counterparty_identifier": "scrubcp@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        # Accept the bet
        resp = client.get("/auth/_test/latest-token?identifier=scrubcp@test.com")
        cp_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]
        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200

        # Check the DB: plaintext should be scrubbed
        from app.models import PendingBet
        bet = db_session.query(PendingBet).filter(PendingBet.id == bet_id).first()
        assert bet is not None
        assert "Scrub me after accept" not in bet.bet_terms
        assert "[scrubbed:sha256:" in bet.bet_terms

    def test_declined_bet_deleted_from_db(self, client, db_session):
        """FR5: Declined bet is deleted from the database."""
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": False},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200

        # Bet row should be deleted from the database
        from app.models import PendingBet
        bet = db_session.query(PendingBet).filter(PendingBet.id == bet_id).first()
        assert bet is None


class TestBetExpiry:
    """FR7: Bets expire if counterparty doesn't respond."""

    def test_expire_pending_bets(self, client):
        """Expired bets are cancelled via the expiry endpoint."""
        session = _get_session_token(client, "expinit@test.com")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "This will expire",
                "counterparty_identifier": "expcp@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "visible",
                "expiry_hours": 0,  # Expire immediately
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        # Trigger expiry check (requires service secret)
        resp = client.post(
            "/bets/_expire",
            headers={"X-Service-Secret": "test-service-secret"},
        )
        assert resp.status_code == 200
        assert resp.json()["expired_count"] >= 1

    def test_expire_without_service_secret_returns_403(self, client):
        """Expiry endpoint requires authentication via service secret."""
        resp = client.post("/bets/_expire")
        assert resp.status_code == 403

    def test_expire_with_wrong_service_secret_returns_403(self, client):
        """Expiry endpoint rejects wrong service secret."""
        resp = client.post(
            "/bets/_expire",
            headers={"X-Service-Secret": "wrong-secret"},
        )
        assert resp.status_code == 403
