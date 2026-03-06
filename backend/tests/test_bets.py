"""Tests for bet creation, acceptance, decline, and expiry (FR4, FR5, FR6, FR7)."""

import hashlib
import time
from urllib.parse import quote

import pytest


def _get_session_token(client, phone="+15552000000", identifier_type="phone"):
    """Helper: register and get a session token."""
    client.post(
        "/auth/magic-link",
        json={"identifier": phone, "identifier_type": identifier_type},
    )
    resp = client.get(f"/auth/_test/latest-token?identifier={quote(phone, safe='')}")
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestBetCreation:
    """FR4: A verified user creates a bet and invites a counterparty."""

    def test_create_visible_bet(self, client):
        session = _get_session_token(client, "+15552001001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "I bet it rains tomorrow",
                "counterparty_identifier": "+15552001002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "bet_id" in body
        assert body["message"] == "Bet created and invitation sent"

    def test_create_hidden_bet(self, client):
        session = _get_session_token(client, "+15552002001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Secret bet terms",
                "counterparty_identifier": "+15552002002",
                "counterparty_identifier_type": "phone",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 201

    def test_create_bet_self_counterparty_rejected(self, client):
        """Edge case: counterparty is the same as initiator."""
        session = _get_session_token(client, "+15552003001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Bet with myself",
                "counterparty_identifier": "+15552003001",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 400

    def test_create_duplicate_bet_rejected(self, client):
        """Edge case: duplicate pending bet with same initiator and terms."""
        session = _get_session_token(client, "+15552004001")
        payload = {
            "bet_terms": "Exact same terms",
            "counterparty_identifier": "+15552004002",
            "counterparty_identifier_type": "phone",
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
                "counterparty_identifier": "+15552005002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
        )
        assert resp.status_code == 401

    def test_create_bet_empty_terms_rejected(self, client):
        session = _get_session_token(client, "+15552006001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "",
                "counterparty_identifier": "+15552006002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        assert resp.status_code == 422

    def test_pending_bet_not_on_chain(self, client):
        """FR4: Pending bet is NOT recorded on-chain."""
        session = _get_session_token(client, "+15552007001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Not yet on chain",
                "counterparty_identifier": "+15552007002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        resp = client.get("/blocks/")
        assert resp.json()["blocks"] == 1  # Only genesis


class TestBetAcceptance:
    """FR5: Counterparty accepts or declines the bet."""

    def _create_bet_and_get_acceptance_token(self, client):
        """Helper: create a bet and retrieve the acceptance magic link token."""
        session = _get_session_token(client, "+15553001001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "I bet the sun rises tomorrow",
                "counterparty_identifier": "+15553001002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        resp = client.get("/auth/_test/latest-token?identifier=%2B15553001002")
        cp_token = resp.json()["token"]

        return bet_id, cp_token

    def test_accept_bet_commits_block(self, client):
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

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
        session = _get_session_token(client, "+15553002001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Hidden bet secret terms",
                "counterparty_identifier": "+15553002002",
                "counterparty_identifier_type": "phone",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        resp = client.get("/auth/_test/latest-token?identifier=%2B15553002002")
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
        assert "bet_terms" not in data
        expected_hash = hashlib.sha256("Hidden bet secret terms".encode()).hexdigest()
        assert data["bet_terms_hash"] == expected_hash

    def test_block_does_not_contain_raw_identifiers(self, client):
        """NFR5: No raw phone numbers on chain."""
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
        assert "+15553001001" not in data_str
        assert "+15553001002" not in data_str

    def test_only_counterparty_can_accept(self, client):
        """Only the designated counterparty can accept the bet."""
        bet_id, cp_token = self._create_bet_and_get_acceptance_token(client)

        other_session = _get_session_token(client, "+15553003001")
        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {other_session}"},
        )
        assert resp.status_code == 403

    def test_hidden_bet_terms_scrubbed_after_accept(self, client, db_session):
        """FR12: Hidden bet plaintext is scrubbed from DB after acceptance."""
        session = _get_session_token(client, "+15553004001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Scrub me after accept",
                "counterparty_identifier": "+15553004002",
                "counterparty_identifier_type": "phone",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        resp = client.get("/auth/_test/latest-token?identifier=%2B15553004002")
        cp_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]
        resp = client.post(
            f"/bets/{bet_id}/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200

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

        from app.models import PendingBet
        bet = db_session.query(PendingBet).filter(PendingBet.id == bet_id).first()
        assert bet is None


class TestBetExpiry:
    """FR7: Bets expire if counterparty doesn't respond."""

    def test_expire_pending_bets(self, client, db_session):
        """Expired bets are cancelled via the expiry endpoint."""
        from datetime import datetime, timezone
        from app.models import PendingBet

        session = _get_session_token(client, "+15554001001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "This will expire",
                "counterparty_identifier": "+15554001002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {session}"},
        )
        bet_id = resp.json()["bet_id"]

        # Backdate expires_at so the bet is already expired
        bet = db_session.query(PendingBet).filter(PendingBet.id == bet_id).first()
        bet.expires_at = datetime(2000, 1, 1, tzinfo=timezone.utc)
        db_session.commit()

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
