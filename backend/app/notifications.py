"""Notification service for SMS (Twilio) and email (SendGrid) delivery.

Uses pluggable backends. In production, the Twilio backend is activated
when WINNIBETS_TWILIO_ACCOUNT_SID is set, and the SendGrid backend when
WINNIBETS_SENDGRID_API_KEY is set. Otherwise falls back to logging backends.
"""

import logging
from typing import Protocol

logger = logging.getLogger(__name__)


class SMSBackend(Protocol):
    """Protocol for SMS delivery backends."""

    def send_sms(self, to: str, body: str) -> bool: ...


class EmailBackend(Protocol):
    """Protocol for email delivery backends."""

    def send_email(self, to: str, subject: str, body: str) -> bool: ...


class LoggingSMSBackend:
    """Development/test backend that logs instead of sending SMS."""

    def send_sms(self, to: str, body: str) -> bool:
        logger.info("SMS to=%s", to)
        return True


class LoggingEmailBackend:
    """Development/test backend that logs instead of sending email."""

    def send_email(self, to: str, subject: str, body: str) -> bool:
        logger.info("Email to=%s subject=%s", to, subject)
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


class SendGridEmailBackend:
    """Production backend that sends email via SendGrid."""

    def __init__(self, api_key: str, from_email: str) -> None:
        self._api_key = api_key
        self._from_email = from_email

    def send_email(self, to: str, subject: str, body: str) -> bool:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=self._from_email,
                to_emails=to,
                subject=subject,
                plain_text_content=body,
            )
            sg = SendGridAPIClient(self._api_key)
            response = sg.send(message)
            logger.info("Email sent status=%s to=%s", response.status_code, to)
            return 200 <= response.status_code < 300
        except Exception:
            logger.exception("SendGrid email delivery failed to=%s", to)
            return False


def _create_default_sms_backend() -> SMSBackend:
    from app.config import settings

    if settings.twilio_account_sid:
        logger.info("Twilio configured — using TwilioNotificationBackend")
        return TwilioNotificationBackend(
            settings.twilio_account_sid,
            settings.twilio_auth_token,
            settings.twilio_phone_number,
        )
    logger.info("Twilio not configured — using LoggingSMSBackend")
    return LoggingSMSBackend()


def _create_default_email_backend() -> EmailBackend:
    from app.config import settings

    if settings.sendgrid_api_key:
        logger.info("SendGrid configured — using SendGridEmailBackend")
        return SendGridEmailBackend(
            settings.sendgrid_api_key,
            settings.sendgrid_from_email,
        )
    logger.info("SendGrid not configured — using LoggingEmailBackend")
    return LoggingEmailBackend()


# Module-level singletons; swapped in tests and production config.
_sms_backend: SMSBackend | None = None
_email_backend: EmailBackend | None = None

# Backward-compatible aliases
NotificationBackend = SMSBackend


def set_backend(backend: SMSBackend) -> None:
    global _sms_backend
    _sms_backend = backend


def set_email_backend(backend: EmailBackend) -> None:
    global _email_backend
    _email_backend = backend


def get_backend() -> SMSBackend:
    global _sms_backend
    if _sms_backend is None:
        _sms_backend = _create_default_sms_backend()
    return _sms_backend


def get_email_backend() -> EmailBackend:
    global _email_backend
    if _email_backend is None:
        _email_backend = _create_default_email_backend()
    return _email_backend


def send_notification(
    identifier: str,
    identifier_type: str,
    subject: str,
    body: str,
) -> bool:
    """Send a notification via SMS or email based on identifier_type.

    Returns True if delivery succeeded, False otherwise.
    On failure, retries once before giving up (FR8: retry once, then log failure).
    """
    try:
        if identifier_type == "phone":
            backend = get_backend()
            success = backend.send_sms(identifier, body)
            if not success:
                logger.warning("SMS delivery failed, retrying once")
                success = backend.send_sms(identifier, body)
            if not success:
                logger.error("SMS delivery failed after retry to=%s", identifier)
            return success
        elif identifier_type == "email":
            backend = get_email_backend()
            success = backend.send_email(identifier, subject, body)
            if not success:
                logger.warning("Email delivery failed, retrying once")
                success = backend.send_email(identifier, subject, body)
            if not success:
                logger.error("Email delivery failed after retry to=%s", identifier)
            return success
        else:
            logger.error("Unsupported identifier_type=%s", identifier_type)
            return False
    except Exception:
        logger.exception("Notification delivery error to=%s", identifier)
        return False
