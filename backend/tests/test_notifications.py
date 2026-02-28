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
        self.emails_sent = []
        self.sms_sent = []
        self._fail_first = fail_first
        self._call_count = 0

    def send_email(self, to, subject, body):
        self._call_count += 1
        if self._fail_first and self._call_count == 1:
            return False
        self.emails_sent.append({"to": to, "subject": subject, "body": body})
        return True

    def send_sms(self, to, body):
        self._call_count += 1
        if self._fail_first and self._call_count == 1:
            return False
        self.sms_sent.append({"to": to, "body": body})
        return True


class FailingBackend:
    """Always fails."""

    def send_email(self, to, subject, body):
        return False

    def send_sms(self, to, body):
        return False


class ExplodingBackend:
    """Raises exceptions."""

    def send_email(self, to, subject, body):
        raise ConnectionError("SMTP down")

    def send_sms(self, to, body):
        raise ConnectionError("Twilio down")


class TestNotificationService:
    def setup_method(self):
        self._original = get_backend()

    def teardown_method(self):
        set_backend(self._original)

    def test_send_email_notification(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is True
        assert len(fake.emails_sent) == 1
        assert fake.emails_sent[0]["to"] == "test@x.com"

    def test_send_sms_notification(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("+1234", "phone", "Subject", "Body")
        assert result is True
        assert len(fake.sms_sent) == 1

    def test_retry_on_first_failure(self):
        fake = FakeBackend(fail_first=True)
        set_backend(fake)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is True
        # First call fails, second succeeds
        assert len(fake.emails_sent) == 1

    def test_return_false_on_persistent_failure(self):
        fail = FailingBackend()
        set_backend(fail)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is False

    def test_return_false_on_exception(self):
        exploding = ExplodingBackend()
        set_backend(exploding)
        result = send_notification("test@x.com", "email", "Subject", "Body")
        assert result is False

    def test_unknown_identifier_type_returns_false(self):
        fake = FakeBackend()
        set_backend(fake)
        result = send_notification("test", "carrier_pigeon", "Subject", "Body")
        assert result is False

    def test_hidden_bet_notification_does_not_contain_plaintext(self, client):
        """FR8: Hidden-bet notifications include only the terms hash."""
        # This is tested at the integration level via the bet flow.
        # The notification body is constructed in the bets router.
        # Here we verify the notification backend receives the correct content.
        fake = FakeBackend()
        set_backend(fake)

        # Create a hidden bet via the API and accept it
        from tests.test_bets import _get_session_token

        session = _get_session_token(client, "notifhid@test.com")
        client.post(
            "/bets",
            json={
                "bet_terms": "Do not reveal these secret terms in notification",
                "counterparty_identifier": "notifcp@test.com",
                "counterparty_identifier_type": "email",
                "visibility": "hidden",
            },
            headers={"Authorization": f"Bearer {session}"},
        )

        # Accept the bet
        resp = client.get("/auth/_test/latest-token?identifier=notifcp@test.com")
        cp_token = resp.json()["token"]
        resp = client.get(f"/auth/verify?token={cp_token}")
        cp_session = resp.json()["session_token"]

        # Clear tracked notifications before acceptance
        fake.emails_sent.clear()
        fake.sms_sent.clear()

        resp = client.post(
            "/bets/1/respond",
            json={"accept": True},
            headers={"Authorization": f"Bearer {cp_session}"},
        )
        assert resp.status_code == 200

        # Check that no notification body contains the plaintext
        for email in fake.emails_sent:
            assert "Do not reveal these secret terms in notification" not in email["body"]
            assert "Terms hash:" in email["body"]

        set_backend(self._original)
