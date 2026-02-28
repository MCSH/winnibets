"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "sqlite:///./winnibets.db"
    # Secret used to salt identity hashes before storing on-chain (Risk mitigation
    # for rainbow-table attacks on low-entropy email/phone values).
    identity_hash_salt: str = "change-me-in-production"
    # Magic link settings
    magic_link_expiry_minutes: int = 15
    magic_link_base_url: str = "http://localhost:8000"
    # Session token expiry
    session_token_expiry_hours: int = 24
    # Bet defaults
    bet_default_expiry_hours: int = 72
    # Rate limits
    rate_limit_submissions_per_hour: int = 20
    rate_limit_bet_invitations_per_hour: int = 10
    # Debug mode: when True, test-only endpoints are registered
    debug: bool = False
    # Service secret for internal/admin endpoints (e.g., bet expiry cron)
    service_secret: str = ""
    # Twilio SMS
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    model_config = {"env_prefix": "WINNIBETS_"}


settings = Settings()
