"""Hidden message submission router (FR2, FR3, FR12)."""

import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.hashing import hash_content, hash_identity
from app.models import User
from app.notifications import send_notification
from app.rate_limit import check_rate_limit
from app.schemas import HiddenMessageRequest, HiddenMessageResponse

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/hidden", response_model=HiddenMessageResponse, status_code=201)
def submit_hidden_message(
    body: HiddenMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """FR2: Submit a hidden message. The plaintext is hashed and discarded.

    FR12: The plaintext is NEVER written to disk, database, or logs.
    We compute the hash immediately, then let the local variable fall out of scope.
    """
    # FR11: Rate limiting
    check_rate_limit(current_user.id, "submission")

    # Compute hashes immediately
    message_hash = hash_content(body.plaintext)
    identity_hash = hash_identity(current_user.identifier)

    # Discard plaintext reference -- after this point, we never use body.plaintext again.
    # (Python GC will collect the string; we do not persist it.)

    # Build block data per FR3
    block_data = {
        "type": "hidden_message",
        "identity_hash": identity_hash,
        "message_hash": message_hash,
        "timestamp": time.time(),
    }

    # Commit to blockchain
    from app.main import blockchain

    block = blockchain.add_block(block_data)

    # Send notification (FR8)
    send_notification(
        identifier=current_user.identifier,
        identifier_type=current_user.identifier_type,
        subject="Hidden message recorded",
        body=(
            f"Your hidden message has been recorded on the chain.\n"
            f"Block hash: {block.hash}\n"
            f"Message hash: {message_hash}\n"
            f"Timestamp: {block.timestamp}"
        ),
    )

    return HiddenMessageResponse(
        message_hash=message_hash,
        block_hash=block.hash,
        block_index=block.index,
        timestamp=block.timestamp,
    )
