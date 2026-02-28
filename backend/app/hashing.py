"""Hashing utilities for identity and content hashing."""

import hashlib

from app.config import settings


def hash_identity(identifier: str) -> str:
    """Compute salted SHA-256 of a normalized identifier (email or phone).

    Salting mitigates rainbow-table attacks on low-entropy identifiers
    (see PRD Risk section).
    """
    normalized = identifier.strip().lower()
    salted = f"{settings.identity_hash_salt}:{normalized}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def hash_content(plaintext: str) -> str:
    """Compute SHA-256 of plaintext content (message or bet terms).

    No salt is applied here because the user needs to be able to independently
    recompute this hash from their retained copy of the plaintext.
    """
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def normalize_identifier(identifier: str) -> str:
    """Normalize an identifier: lowercase email, strip phone."""
    return identifier.strip().lower()
