"""ID verification router."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.id_parser import (
    extract_name_from_text,
    extract_text_from_image,
    names_match,
    parse_and_validate_mrz,
)
from app.models import IDVerification, User
from app.rate_limit import check_rate_limit
from app.schemas import DocumentType, IDVerificationResponse, VerificationStatusResponse

router = APIRouter(prefix="/verification", tags=["verification"])

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/verify", response_model=IDVerificationResponse)
async def verify_id(
    image: UploadFile = File(...),
    document_type: DocumentType = Form(...),
    provided_name: str = Form(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an ID document image for verification."""
    check_rate_limit(user.id, "submission")

    if not provided_name or not provided_name.strip():
        raise HTTPException(status_code=422, detail="Name must not be empty")

    if image.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_FILE_TYPE",
                "message": f"File type {image.content_type} not allowed. Use JPEG, PNG, or WebP.",
            },
        )

    image_bytes = await image.read()
    if len(image_bytes) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": "File must be under 10 MB.",
            },
        )

    # Call Ollama vision model
    try:
        ocr_text = await extract_text_from_image(image_bytes, document_type.value)
    except Exception as exc:
        record = IDVerification(
            user_id=user.id,
            document_type=document_type.value,
            provided_name=provided_name.strip(),
            status="failed",
            name_match=False,
            failure_reason=f"OCR failed: {exc}",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return _to_response(record)

    # Extract name from OCR text
    extracted_name = extract_name_from_text(ocr_text)

    # MRZ validation for passports
    mrz_valid = None
    if document_type == DocumentType.passport:
        mrz_result = parse_and_validate_mrz(ocr_text)
        mrz_valid = mrz_result["valid"]
        # Use MRZ name if no NAME: line found
        if not extracted_name and mrz_result["fields"]:
            fields = mrz_result["fields"]
            extracted_name = f"{fields.get('given_names', '')} {fields.get('surname', '')}".strip()

    # Name matching
    name_ok = False
    if extracted_name:
        name_ok = names_match(provided_name.strip(), extracted_name)

    # Determine status
    failure_reasons = []
    if not extracted_name:
        failure_reasons.append("Could not extract name from document")
    if not name_ok and extracted_name:
        failure_reasons.append("Name mismatch")
    if document_type == DocumentType.passport and mrz_valid is False:
        failure_reasons.append("MRZ checksum invalid")

    status = "verified" if name_ok and (mrz_valid is not False) else "failed"
    failure_reason = "; ".join(failure_reasons) if failure_reasons else None

    record = IDVerification(
        user_id=user.id,
        document_type=document_type.value,
        provided_name=provided_name.strip(),
        extracted_name=extracted_name,
        mrz_valid=mrz_valid,
        name_match=name_ok,
        status=status,
        failure_reason=failure_reason,
    )
    db.add(record)

    if status == "verified" and extracted_name:
        user.nickname = extracted_name

    db.commit()
    db.refresh(record)

    return _to_response(record)


@router.get("/status", response_model=VerificationStatusResponse)
def get_verification_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the latest verification result for the current user."""
    record = (
        db.query(IDVerification)
        .filter(IDVerification.user_id == user.id)
        .order_by(IDVerification.created_at.desc())
        .first()
    )
    if not record:
        return VerificationStatusResponse(status="none")

    return VerificationStatusResponse(
        status=record.status,
        document_type=record.document_type,
        provided_name=record.provided_name,
        extracted_name=record.extracted_name,
        mrz_valid=record.mrz_valid,
        name_match=record.name_match,
        failure_reason=record.failure_reason,
        created_at=record.created_at.isoformat(),
    )


def _to_response(record: IDVerification) -> IDVerificationResponse:
    return IDVerificationResponse(
        status=record.status,
        document_type=record.document_type,
        provided_name=record.provided_name,
        extracted_name=record.extracted_name,
        mrz_valid=record.mrz_valid,
        name_match=record.name_match,
        failure_reason=record.failure_reason,
        created_at=record.created_at.isoformat(),
    )
