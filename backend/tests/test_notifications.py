"""Tests for notification service (FR8)."""

import pytest

from app.notifications import (
    LoggingSMSBackend,
    LoggingEmailBackend,
    send_notification,
    set_backend,
    set_email_backend,
    get_backend,
    get_email_backend,
)


class FakeBackend:
    """Track SMS notification calls for testing."""

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


class FakeEmailBackend:
    """Track email notification calls for testing."""

    def __init__(self, fail_first=False):
        self.emails_sent = []
        self._fail_first = fail_first
        self._call_count = 0

    def send_email(self, to, subject, body):
        self._call_count += 1
        if self._fail_first and self._call_count == 1:
            return False
        self.emails_sent.append({"to": to, "subject": subject, "body": body})
        return True


class FailingBackend:
    """Always fails."""

    def send_sms(self, to, body):
        return False


class FailingEmailBackend:
    """Always fails."""

    def send_email(self, to, subject, body):
        return False


class ExplodingBackend:
    """Raises exceptions."""

    def send_sms(self, to, body):
        raise ConnectionError("Twilio down")


class ExplodingEmailBackend:
    """Raises exceptions."""

    def send_email(self, to, subject, body):
        raise ConnectionError("SendGrid down")


class TestNotificationService:
    def setup_method(self):
        self._original_sms = get_backend()
        self._original_email = get_email_backend()

    def teardown_method(self):
        set_backend(self._original_sms)
        set_email_backend(self._original_email)

    def test_send_sms_notification(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is True
        assert len(fake.sms_sent) == 1
        assert fake.sms_sent[0]["to"] == "+1234"

    def test_send_email_notification(self):
        fake = FakeEmailBackend()
        set_email_backend(fake)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is True
        assert len(fake.emails_sent) == 1
        assert fake.emails_sent[0]["to"] == "test@x.com"
        assert fake.emails_sent[0]["subject"] == "Subject"

    def test_retry_on_first_failure(self):
        fake = FakeBackend(fail_first=True)
        set_backend(fake)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is True
        assert len(fake.sms_sent) == 1

    def test_retry_email_on_first_failure(self):
        fake = FakeEmailBackend(fail_first=True)
        set_email_backend(fake)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is True
        assert len(fake.emails_sent) == 1

    def test_return_false_on_persistent_failure(self):
        fail = FailingBackend()
        set_backend(fail)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is False

    def test_return_false_on_persistent_email_failure(self):
        fail = FailingEmailBackend()
        set_email_backend(fail)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is False

    def test_return_false_on_exception(self):
        exploding = ExplodingBackend()
        set_backend(exploding)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is False

    def test_return_false_on_email_exception(self):
        exploding = ExplodingEmailBackend()
        set_email_backend(exploding)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is False

    def test_unknown_identifier_type_returns_false(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("test", "carrier_pigeon", "Subject", "Body")
        assert result is False

    def test_email_routes_to_email_backend_not_sms(self):
        fake_sms = FakeBackend()
        fake_email = FakeEmailBackend()
        set_backend(fake_sms)
        set_email_backend(fake_email)
        send_notification("test@x.com", "email", "Subject", "Body")
        assert len(fake_sms.sms_sent) == 0
        assert len(fake_email.emails_sent) == 1

    def test_phone_routes_to_sms_backend_not_email(self):
        fake_sms = FakeBackend()
        fake_email = FakeEmailBackend()
        set_backend(fake_sms)
        set_email_backend(fake_email)
        send_notification("+1234", "phone", "Subject", "Body")
        assert len(fake_sms.sms_sent) == 1
        assert len(fake_email.emails_sent) == 0

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

        set_backend(self._original_sms)
        set_email_backend(self._original_email)
