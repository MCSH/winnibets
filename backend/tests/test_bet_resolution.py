"""Tests for bet resolution: propose, accept, reject."""

from urllib.parse import quote



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


def _create_and_accept_bet(client, initiator_phone, counterparty_phone):
    """Helper: create a bet and have the counterparty accept it. Returns (bet_id, initiator_session, cp_session)."""
    initiator_session = _get_session_token(client, initiator_phone)
    resp = client.post(
        "/bets",
        json={
            "bet_terms": "I bet the sun rises tomorrow",
            "counterparty_identifier": counterparty_phone,
            "counterparty_identifier_type": "phone",
            "visibility": "visible",
        },
        headers={"Authorization": f"Bearer {initiator_session}"},
    )
    bet_id = resp.json()["bet_id"]

    resp = client.get(
        f"/auth/_test/latest-token?identifier={quote(counterparty_phone, safe='')}"
    )
    cp_token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={cp_token}")
    cp_session = resp.json()["session_token"]

    resp = client.post(
        f"/bets/{bet_id}/respond",
        json={"accept": True},
        headers={"Authorization": f"Bearer {cp_session}"},
    )
    assert resp.status_code == 200

    return bet_id, initiator_session, cp_session


class TestProposeResolution:
    """Proposing a bet resolution."""

    def test_initiator_can_propose(self, client):
        bet_id, init_session, _ = _create_and_accept_bet(
            client, "+15556001001", "+15556001002"
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator", "note": "I clearly won"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "resolution_id" in body
        assert body["message"] == "Resolution proposed and notification sent"

    def test_counterparty_can_propose(self, client):
        bet_id, _, cp_session = _create_and_accept_bet(
            client, "+15556002001", "+15556002002"
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "counterparty"},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 201

    def test_cannot_propose_on_pending_bet(self, client):
        """Only accepted bets can be resolved."""
        init_session = _get_session_token(client, "+15556003001")
        resp = client.post(
            "/bets",
            json={
                "bet_terms": "Still pending",
                "counterparty_identifier": "+15556003002",
                "counterparty_identifier_type": "phone",
                "visibility": "visible",
            },
            headers={"Authorization": f"Bearer {init_session}"},
        )
        bet_id = resp.json()["bet_id"]

        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "BET_NOT_ACCEPTED"

    def test_non_participant_cannot_propose(self, client):
        bet_id, _, _ = _create_and_accept_bet(client, "+15556004001", "+15556004002")
        other_session = _get_session_token(client, "+15556004003")
        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {other_session}"},
        )
        assert resp.status_code == 403

    def test_duplicate_pending_resolution_rejected(self, client):
        bet_id, init_session, _ = _create_and_accept_bet(
            client, "+15556005001", "+15556005002"
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        assert resp.status_code == 201

        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "counterparty"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "RESOLUTION_ALREADY_PENDING"


class TestRespondToResolution:
    """Accepting or rejecting a resolution proposal."""

    def test_accept_resolution_commits_block(self, client):
        bet_id, init_session, cp_session = _create_and_accept_bet(
            client, "+15557001001", "+15557001002"
        )
        # Initiator proposes
        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator", "note": "Won fair and square"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        assert resp.status_code == 201

        # Counterparty accepts
        resp = client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "accepted"
        assert body["block_hash"] is not None
        assert body["block_index"] is not None

    def test_accept_resolution_block_data(self, client):
        bet_id, init_session, cp_session = _create_and_accept_bet(
            client, "+15557002001", "+15557002002"
        )
        client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "counterparty", "note": "They won"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        block_hash = resp.json()["block_hash"]

        # Verify block data
        resp = client.get(f"/blocks/{block_hash}")
        data = resp.json()["data"]
        assert data["type"] == "bet_resolution"
        assert data["winner_side"] == "counterparty"
        assert data["note"] == "They won"
        assert "initiator_identity_hash" in data
        assert "counterparty_identity_hash" in data
        assert "winner_identity_hash" in data

    def test_reject_resolution(self, client):
        bet_id, init_session, cp_session = _create_and_accept_bet(
            client, "+15557003001", "+15557003002"
        )
        client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": False},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"
        assert resp.json()["block_hash"] is None

    def test_proposer_cannot_accept_own_resolution(self, client):
        bet_id, init_session, _ = _create_and_accept_bet(
            client, "+15557004001", "+15557004002"
        )
        client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "CANNOT_RESPOND_OWN"

    def test_no_pending_resolution_returns_404(self, client):
        bet_id, _, cp_session = _create_and_accept_bet(
            client, "+15557005001", "+15557005002"
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 404

    def test_can_propose_again_after_rejection(self, client):
        bet_id, init_session, cp_session = _create_and_accept_bet(
            client, "+15557006001", "+15557006002"
        )
        # First proposal
        client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        # Reject
        client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": False},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        # Second proposal (should work)
        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "counterparty"},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 201

    def test_cannot_propose_after_accepted_resolution(self, client):
        bet_id, init_session, cp_session = _create_and_accept_bet(
            client, "+15557007001", "+15557007002"
        )
        client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        # Try to propose again
        resp = client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "counterparty"},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "BET_ALREADY_RESOLVED"

    def test_resolution_block_has_no_raw_identifiers(self, client):
        bet_id, init_session, cp_session = _create_and_accept_bet(
            client, "+15557008001", "+15557008002"
        )
        client.post(
            f"/bets/{bet_id}/resolve",
            json={"winner": "initiator"},
            headers={"Authorization": f"Bearer {init_session}"},
        )
        resp = client.post(
            f"/bets/{bet_id}/resolve/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        block_hash = resp.json()["block_hash"]

        resp = client.get(f"/blocks/{block_hash}")
        data_str = str(resp.json()["data"])
        assert "+15557008001" not in data_str
        assert "+15557008002" not in data_str
