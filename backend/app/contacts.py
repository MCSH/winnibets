"""Private named contacts CRUD."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.hashing import normalize_identifier
from app.models import Contact, User
from app.schemas import (  # noqa: E402
    ContactCreate,
    ContactResponse,
    ContactSuggestion,
    ContactUpdate,
    ContactsResolveRequest,
    ContactsResolveResponse,
)

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactResponse])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all contacts for the current user."""
    contacts = (
        db.query(Contact)
        .filter(Contact.owner_id == current_user.id)
        .order_by(Contact.name)
        .all()
    )
    return [
        ContactResponse(
            id=c.id,
            identifier=c.identifier,
            identifier_type=c.identifier_type,
            name=c.name,
        )
        for c in contacts
    ]


@router.post("", response_model=ContactResponse, status_code=201)
def create_contact(
    body: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a new contact."""
    normalized = normalize_identifier(body.identifier)

    existing = (
        db.query(Contact)
        .filter(
            Contact.owner_id == current_user.id,
            Contact.identifier == normalized,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "DUPLICATE_CONTACT",
                "message": "You already have a contact with this identifier",
            },
        )

    contact = Contact(
        owner_id=current_user.id,
        identifier=normalized,
        identifier_type=body.identifier_type.value,
        name=body.name.strip(),
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)

    return ContactResponse(
        id=contact.id,
        identifier=contact.identifier,
        identifier_type=contact.identifier_type,
        name=contact.name,
    )


@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a contact's name."""
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.owner_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=404,
            detail={"code": "CONTACT_NOT_FOUND", "message": "Contact not found"},
        )

    contact.name = body.name.strip()
    db.commit()
    db.refresh(contact)

    return ContactResponse(
        id=contact.id,
        identifier=contact.identifier,
        identifier_type=contact.identifier_type,
        name=contact.name,
    )


@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a contact."""
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.owner_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=404,
            detail={"code": "CONTACT_NOT_FOUND", "message": "Contact not found"},
        )

    db.delete(contact)
    db.commit()


@router.post("/resolve", response_model=ContactsResolveResponse)
def resolve_contacts(
    body: ContactsResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve a list of identifiers to contact names. Returns a map of identifier -> name."""
    if not body.identifiers:
        return ContactsResolveResponse(names={})

    normalized = [normalize_identifier(i) for i in body.identifiers]
    contacts = (
        db.query(Contact)
        .filter(
            Contact.owner_id == current_user.id,
            Contact.identifier.in_(normalized),
        )
        .all()
    )

    names = {c.identifier: c.name for c in contacts}
    return ContactsResolveResponse(names=names)


@router.get("/suggestions", response_model=list[ContactSuggestion])
def suggest_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return identifiers the user has interacted with that aren't saved as contacts yet."""
    from app.models import PendingBet

    # Get all identifiers the user has bet with (as initiator or counterparty)
    initiated = (
        db.query(PendingBet).filter(PendingBet.initiator_id == current_user.id).all()
    )
    received = (
        db.query(PendingBet)
        .filter(PendingBet.counterparty_user_id == current_user.id)
        .all()
    )

    # Collect the other party's user IDs
    other_user_ids: set[int] = set()
    for bet in initiated:
        other_user_ids.add(bet.counterparty_user_id)
    for bet in received:
        other_user_ids.add(bet.initiator_id)

    if not other_user_ids:
        return []

    # Look up the actual users
    other_users = db.query(User).filter(User.id.in_(other_user_ids)).all()

    # Get existing contacts for this owner
    saved = {
        c.identifier
        for c in db.query(Contact).filter(Contact.owner_id == current_user.id).all()
    }

    # Filter out already-saved contacts and self
    suggestions = []
    for u in other_users:
        if u.identifier not in saved and u.identifier != current_user.identifier:
            suggestions.append(
                ContactSuggestion(
                    identifier=u.identifier,
                    identifier_type=u.identifier_type,
                )
            )

    return suggestions
