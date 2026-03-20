"""Pydantic request/response schemas."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator


class IdentifierType(str, Enum):
    phone = "phone"
    email = "email"


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
    pending_bet_id: Optional[int] = None


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


class PendingBetSummary(BaseModel):
    bet_id: int
    bet_terms: str
    visibility: str
    initiator_identifier: str
    initiator_identifier_type: str
    expires_at: str
    created_at: str


# --- Unified message schemas ---


class MessageRequest(BaseModel):
    plaintext: str
    visibility: Visibility

    @field_validator("plaintext")
    @classmethod
    def plaintext_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message must not be empty or whitespace-only")
        return v


class MessageResponse(BaseModel):
    message_hash: str
    block_hash: str
    block_index: int
    timestamp: float
    visibility: str


# --- Block lookup schemas ---


class BlockLookupResponse(BaseModel):
    block_index: int
    timestamp: float
    record_type: str
    data: dict


class BlockSummary(BaseModel):
    block_index: int
    block_hash: str
    timestamp: float
    record_type: str
    data: dict


class BlockListResponse(BaseModel):
    blocks: list[BlockSummary]
    total: int
    offset: int
    limit: int


# --- Integrity check schemas ---


class IntegrityResponse(BaseModel):
    valid: bool
    blocks: Optional[int] = None
    first_invalid_block: Optional[int] = None


# --- Activity schemas ---


class ActivityBlock(BaseModel):
    block_index: int
    block_hash: str
    timestamp: float
    record_type: str
    role: str  # "author", "initiator", "counterparty"
    data: dict


class BetResolutionSummary(BaseModel):
    resolution_id: int
    bet_id: int
    proposed_by: str  # "initiator" or "counterparty"
    winner: str  # "initiator" or "counterparty"
    note: Optional[str] = None
    status: str  # "pending", "accepted", "rejected"
    block_hash: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str


class ActivityBet(BaseModel):
    bet_id: int
    bet_terms: str
    visibility: str
    status: str  # "pending", "accepted", "declined", "expired"
    role: str  # "initiator" or "counterparty"
    counterparty_identifier: Optional[str] = None
    counterparty_identifier_type: Optional[str] = None
    initiator_identifier: Optional[str] = None
    initiator_identifier_type: Optional[str] = None
    expires_at: str
    created_at: str
    resolution: Optional[BetResolutionSummary] = None


class ActivityResponse(BaseModel):
    blocks: list[ActivityBlock]
    bets: list[ActivityBet]


# --- Contact schemas ---


class WinnerSide(str, Enum):
    initiator = "initiator"
    counterparty = "counterparty"


class BetResolveRequest(BaseModel):
    winner: WinnerSide
    note: Optional[str] = None


class BetResolveResponse(BaseModel):
    resolution_id: int
    message: str


class BetResolveRespondRequest(BaseModel):
    accept: bool


class BetResolveRespondResponse(BaseModel):
    status: str
    block_hash: Optional[str] = None
    block_index: Optional[int] = None
    timestamp: Optional[float] = None


class ContactCreate(BaseModel):
    identifier: str
    identifier_type: IdentifierType
    name: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name must not be empty")
        return v

    @field_validator("identifier")
    @classmethod
    def identifier_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Identifier must not be empty")
        return v.strip()


class ContactUpdate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name must not be empty")
        return v


class ContactResponse(BaseModel):
    id: int
    identifier: str
    identifier_type: str
    name: str


class ContactsResolveRequest(BaseModel):
    identifiers: list[str]


class ContactsResolveResponse(BaseModel):
    names: dict[str, str]


class ContactSuggestion(BaseModel):
    identifier: str
    identifier_type: str
