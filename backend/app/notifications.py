"""Notification service for SMS delivery via Twilio.

Uses a pluggable backend. In production, the Twilio backend is activated
automatically when WINNIBETS_TWILIO_ACCOUNT_SID is set. Otherwise falls
back to a logging backend for development and testing.
"""

import logging
from typing import Protocol

logger = logging.getLogger(__name__)


class NotificationBackend(Protocol):
    """Protocol for notification delivery backends."""

    def send_sms(self, to: str, body: str) -> bool: ...


class LoggingNotificationBackend:
    """Development/test backend that logs instead of sending."""

    def send_sms(self, to: str, body: str) -> bool:
        logger.info("SMS to=%s", to)
        return True


class TwilioNotificationBackend:
    """Production backend that sends SMS via Twilio."""

    def __init__(self, account_sid: str, auth_token: str, from_number: str) -> None:
        from twilio.rest import Client

        self._client = Client(account_sid, auth_token)
        self._from_number = from_number

    def send_sms(self, to: str, body: str) -> bool:
        try:
            message = self._client.messages.create(
                to=to,
                from_=self._from_number,
                body=body,
            )
            logger.info("SMS sent sid=%s to=%s", message.sid, to)
            return True
        except Exception:
            logger.exception("Twilio SMS delivery failed to=%s", to)
            return False


def _create_default_backend() -> NotificationBackend:
    from app.config import settings

    if settings.twilio_account_sid:
        logger.info("Twilio configured — using TwilioNotificationBackend")
        return TwilioNotificationBackend(
            settings.twilio_account_sid,
            settings.twilio_auth_token,
            settings.twilio_phone_number,
        )
    logger.info("Twilio not configured — using LoggingNotificationBackend")
    return LoggingNotificationBackend()


# Module-level singleton; swapped in tests and production config.
_backend: NotificationBackend | None = None


def set_backend(backend: NotificationBackend) -> None:
    global _backend
    _backend = backend


def get_backend() -> NotificationBackend:
    global _backend
    if _backend is None:
        _backend = _create_default_backend()
    return _backend


def send_notification(
    identifier: str,
    identifier_type: str,
    subject: str,
    body: str,
) -> bool:
    """Send a notification via SMS.

    Returns True if delivery succeeded, False otherwise.
    On failure, retries once before giving up (FR8: retry once, then log failure).
    """
    backend = get_backend()
    try:
        if identifier_type != "phone":
            logger.error("Unsupported identifier_type=%s (only phone supported)", identifier_type)
            return False

        success = backend.send_sms(identifier, body)

        if not success:
            # Retry once per FR8
            logger.warning("SMS delivery failed, retrying once")
            success = backend.send_sms(identifier, body)

        if not success:
            logger.error("SMS delivery failed after retry to=%s", identifier)

        return success
    except Exception:
        logger.exception("SMS delivery error to=%s", identifier)
        return False
