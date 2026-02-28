"""Authentication router: magic link generation, verification, and session management."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.hashing import normalize_identifier
from app.models import MagicLink, SessionToken, User
from app.notifications import send_notification
from app.schemas import (
    MagicLinkRequest,
    MagicLinkResponse,
    UserResponse,
    VerifyResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_token() -> str:
    """Generate a cryptographically random token with >= 128 bits entropy (NFR2).

    Uses 32 bytes (256 bits) of randomness encoded as URL-safe base64.
    """
    return secrets.token_urlsafe(32)



@router.post("/magic-link", response_model=MagicLinkResponse)
def request_magic_link(
    body: MagicLinkRequest,
    db: Session = Depends(get_db),
):
    """FR1: Send a magic link to the user's email or phone."""
    normalized = normalize_identifier(body.identifier)

    if not normalized:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_IDENTIFIER", "message": "Identifier must not be empty"},
        )

    # Find or create user
    user = db.query(User).filter(User.identifier == normalized).first()
    if user is None:
        user = User(identifier=normalized, identifier_type=body.identifier_type.value)
        db.add(user)
        db.commit()
        db.refresh(user)

    # Generate magic link token
    token = _generate_token()
    magic_link = MagicLink(
        token=token,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(minutes=settings.magic_link_expiry_minutes),
    )
    db.add(magic_link)
    db.commit()

    # Send the magic link via email/SMS
    link_url = f"{settings.magic_link_base_url}/auth/verify?token={token}"
    send_notification(
        identifier=user.identifier,
        identifier_type=user.identifier_type,
        subject="Your magic link",
        body=f"Click here to verify: {link_url}",
    )

    return MagicLinkResponse(message="Magic link sent")


@router.get("/verify", response_model=VerifyResponse)
def verify_magic_link(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """FR1: Verify a magic link token and return a session token."""
    magic_link = db.query(MagicLink).filter(MagicLink.token == token).first()

    if magic_link is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "Invalid or expired magic link"},
        )

    if magic_link.used:
        raise HTTPException(
            status_code=401,
            detail={"code": "TOKEN_USED", "message": "Magic link has already been used"},
        )

    if magic_link.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=401,
            detail={"code": "TOKEN_EXPIRED", "message": "Magic link has expired"},
        )

    # Mark as used (single-use enforcement, NFR2)
    magic_link.used = True
    db.commit()

    # Create session token
    session_token_str = _generate_token()
    session_token = SessionToken(
        token=session_token_str,
        user_id=magic_link.user_id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.session_token_expiry_hours),
    )
    db.add(session_token)
    db.commit()

    return VerifyResponse(session_token=session_token_str)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user's info."""
    return UserResponse(
        identifier=current_user.identifier,
        identifier_type=current_user.identifier_type,
    )


# --- Test-only endpoints (only registered when WINNIBETS_DEBUG=true) ---

if settings.debug:

    @router.get("/_test/latest-token")
    def test_get_latest_token(
        identifier: str = Query(...),
        db: Session = Depends(get_db),
    ):
        """Test helper: return the latest magic link token for a given identifier."""
        normalized = normalize_identifier(identifier)
        user = db.query(User).filter(User.identifier == normalized).first()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        link = (
            db.query(MagicLink)
            .filter(MagicLink.user_id == user.id)
            .order_by(MagicLink.id.desc())
            .first()
        )
        if link is None:
            raise HTTPException(status_code=404, detail="No magic link found")
        return {"token": link.token}

    @router.post("/_test/expire-token")
    def test_expire_token(
        body: dict,
        db: Session = Depends(get_db),
    ):
        """Test helper: force-expire a magic link token."""
        link = db.query(MagicLink).filter(MagicLink.token == body["token"]).first()
        if link is None:
            raise HTTPException(status_code=404, detail="Token not found")
        link.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()
        return {"message": "Token expired"}
