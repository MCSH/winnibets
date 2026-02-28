"""Notification service for email and SMS delivery.

Uses a pluggable backend. The default implementation logs notifications
rather than sending them, suitable for development and testing.
Production deployments should swap in a real email/SMS provider.
"""

import logging
from typing import Protocol

logger = logging.getLogger(__name__)


class NotificationBackend(Protocol):
    """Protocol for notification delivery backends."""

    def send_email(self, to: str, subject: str, body: str) -> bool: ...
    def send_sms(self, to: str, body: str) -> bool: ...


class LoggingNotificationBackend:
    """Development/test backend that logs instead of sending."""

    def send_email(self, to: str, subject: str, body: str) -> bool:
        logger.info("EMAIL to=%s subject=%s", to, subject)
        return True

    def send_sms(self, to: str, body: str) -> bool:
        logger.info("SMS to=%s", to)
        return True


# Module-level singleton; swapped in tests and production config.
_backend: NotificationBackend = LoggingNotificationBackend()


def set_backend(backend: NotificationBackend) -> None:
    global _backend
    _backend = backend


def get_backend() -> NotificationBackend:
    return _backend


def send_notification(
    identifier: str,
    identifier_type: str,
    subject: str,
    body: str,
) -> bool:
    """Send a notification via the user's registered channel.

    Returns True if delivery succeeded, False otherwise.
    On failure, retries once before giving up (FR8: retry once, then log failure).
    """
    try:
        if identifier_type == "email":
            success = _backend.send_email(identifier, subject, body)
        elif identifier_type == "phone":
            success = _backend.send_sms(identifier, body)
        else:
            logger.error("Unknown identifier_type=%s", identifier_type)
            return False

        if not success:
            # Retry once per FR8
            logger.warning("Notification delivery failed, retrying once")
            if identifier_type == "email":
                success = _backend.send_email(identifier, subject, body)
            else:
                success = _backend.send_sms(identifier, body)

        if not success:
            logger.error("Notification delivery failed after retry to=%s", identifier)

        return success
    except Exception:
        logger.exception("Notification delivery error to=%s", identifier)
        return False
