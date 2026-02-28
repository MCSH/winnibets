"""Tests for notification service (FR8)."""

import pytest

from app.notifications import (
    LoggingNotificationBackend,
    send_notification,
    set_backend,
    get_backend,
)


class FakeBackend:
    """Track notification calls for testing."""

    def __init__(self, fail_first=False):
        self.sms_sent = []
        self._fail_first = fail_first
        self._call_count = 0

    def send_sms(self, to, body):
        self._call_count += 1
        if self._fail_first and self._call_count == 1:
            return False
        self.sms_sent.append({"to": to, "body": body})
        return True


class FailingBackend:
    """Always fails."""

    def send_sms(self, to, body):
        return False


class ExplodingBackend:
    """Raises exceptions."""

    def send_sms(self, to, body):
        raise ConnectionError("Twilio down")


class TestNotificationService:
    def setup_method(self):
        self._original = get_backend()

    def teardown_method(self):
        set_backend(self._original)

    def test_send_sms_notification(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is True
        assert len(fake.sms_sent) == 1
        assert fake.sms_sent[0]["to"] == "+1234"

    def test_retry_on_first_failure(self):
        fake = FakeBackend(fail_first=True)
        set_backend(fake)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is True
        assert len(fake.sms_sent) == 1

    def test_return_false_on_persistent_failure(self):
        fail = FailingBackend()
        set_backend(fail)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is False

    def test_return_false_on_exception(self):
        exploding = ExplodingBackend()
        set_backend(exploding)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is False

    def test_unsupported_identifier_type_returns_false(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is False

    def test_unknown_identifier_type_returns_false(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("test", "carrier_pigeon", "Subject", "Body")
        assert result is False

    def test_hidden_bet_notification_does_not_contain_plaintext(self, client):
        """FR8: Hidden-bet notifications include only the terms hash."""
        fake = FakeBackend()
        set_backend(fake)

        from tests.test_bets import _get_session_token

        session = _get_session_token(client, "+15550001111", "phone")
        client.post(
            "/bets",
            json={
                "bet_terms": "Do not reveal these secret terms in notification",
                "counterparty_identifier": "+15550002222",
                "counterparty_identifier_type": "phone",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )

        resp = client.get("/auth/_test/latest-token?identifier=%2B15550002222")
        cp_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        fake.sms_sent.clear()

        resp = client.post(
            "/bets/1/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200

        for sms in fake.sms_sent:
            assert "Do not reveal these secret terms in notification" not in sms["body"]
            assert "Terms hash:" in sms["body"]

        set_backend(self._original)
