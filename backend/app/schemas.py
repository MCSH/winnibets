"""Pydantic request/response schemas."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator


class IdentifierType(str, Enum):
    phone = "phone"


class Visibility(str, Enum):
    visible = "visible"
    hidden = "hidden"


# --- Auth schemas ---


class MagicLinkRequest(BaseModel):
    identifier: str
    identifier_type: IdentifierType

    @field_validator("identifier")
    @classmethod
    def identifier_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Identifier must not be empty")
        return v.strip()


class MagicLinkResponse(BaseModel):
    message: str


class VerifyResponse(BaseModel):
    session_token: str


class UserResponse(BaseModel):
    identifier: str
    identifier_type: str


# --- Hidden message schemas ---


class HiddenMessageRequest(BaseModel):
    plaintext: str

    @field_validator("plaintext")
    @classmethod
    def plaintext_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message must not be empty or whitespace-only")
        return v


class HiddenMessageResponse(BaseModel):
    message_hash: str
    block_hash: str
    block_index: int
    timestamp: float


# --- Bet schemas ---


class BetCreateRequest(BaseModel):
    bet_terms: str
    counterparty_identifier: str
    counterparty_identifier_type: IdentifierType
    visibility: Visibility
    expiry_hours: Optional[int] = None  # Defaults to 72 hours

    @field_validator("bet_terms")
    @classmethod
    def terms_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Bet terms must not be empty")
        return v

    @field_validator("counterparty_identifier")
    @classmethod
    def counterparty_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Counterparty identifier must not be empty")
        return v.strip()


class BetCreateResponse(BaseModel):
    bet_id: int
    message: str


class BetAcceptRequest(BaseModel):
    accept: bool


class BetAcceptResponse(BaseModel):
    status: str
    block_hash: Optional[str] = None
    block_index: Optional[int] = None
    timestamp: Optional[float] = None


# --- Block lookup schemas ---


class BlockLookupResponse(BaseModel):
    block_index: int
    timestamp: float
    record_type: str
    data: dict


# --- Integrity check schemas ---


class IntegrityResponse(BaseModel):
    valid: bool
    blocks: Optional[int] = None
    first_invalid_block: Optional[int] = None


