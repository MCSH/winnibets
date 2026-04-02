"""ID document parsing: OCR via Ollama vision model, MRZ validation, name matching."""

import base64
import re
import unicodedata

import httpx

from app.config import settings


async def extract_text_from_image(
    image_bytes: bytes, document_type: str
) -> str:
    """Send base64-encoded image to Ollama vision model and return extracted text."""
    b64 = base64.b64encode(image_bytes).decode("ascii")

    if document_type == "passport":
        prompt = (
            "Extract all text from this passport image. "
            "Include the full name on a line starting with 'NAME:' and "
            "reproduce the Machine Readable Zone (MRZ) lines exactly as printed "
            "(two lines of 44 characters each)."
        )
    else:
        prompt = (
            "Extract all text from this driver's license image. "
            "Include the full name on a line starting with 'NAME:'."
        )

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.ollama_base_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "images": [b64],
                "stream": False,
            },
        )
        resp.raise_for_status()
        return resp.json()["response"]


# ---------------------------------------------------------------------------
# MRZ parsing and validation (ICAO 9303 TD3 — passport)
# ---------------------------------------------------------------------------

_MRZ_WEIGHTS = [7, 3, 1]
_MRZ_CHAR_VALUES = {c: i for i, c in enumerate("0123456789")}
_MRZ_CHAR_VALUES["<"] = 0
for _i, _c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ", start=10):
    _MRZ_CHAR_VALUES[_c] = _i


def _mrz_check_digit(field: str) -> int:
    """Compute a single MRZ check digit using the 7-3-1 weight algorithm."""
    total = 0
    for i, ch in enumerate(field):
        val = _MRZ_CHAR_VALUES.get(ch.upper(), 0)
        total += val * _MRZ_WEIGHTS[i % 3]
    return total % 10


def parse_and_validate_mrz(text: str) -> dict:
    """Extract TD3 MRZ (2x44 chars) from OCR text and validate check digits.

    Returns a dict with keys: valid, fields (dict of parsed fields),
    errors (list of check digit failures).
    """
    # Find two consecutive lines of exactly 44 characters
    lines = text.splitlines()
    mrz_lines = []
    for line in lines:
        stripped = line.strip().replace(" ", "")
        if len(stripped) == 44 and re.match(r"^[A-Z0-9<]+$", stripped):
            mrz_lines.append(stripped)
            if len(mrz_lines) == 2:
                break
        else:
            mrz_lines = []

    if len(mrz_lines) != 2:
        return {"valid": False, "fields": {}, "errors": ["MRZ lines not found"]}

    line1, line2 = mrz_lines

    # Line 1: P<ISSUING_STATE<SURNAME<<GIVEN_NAMES<<<...
    names_part = line1[5:]
    parts = names_part.split("<<", 1)
    surname = parts[0].replace("<", " ").strip()
    given_names = parts[1].replace("<", " ").strip() if len(parts) > 1 else ""

    # Line 2 fields
    passport_number = line2[0:9]
    passport_check = int(line2[9])
    nationality = line2[10:13].replace("<", "")
    dob = line2[13:19]
    dob_check = int(line2[19])
    sex = line2[20]
    expiry = line2[21:27]
    expiry_check = int(line2[27])
    personal_number = line2[28:42]
    personal_check = int(line2[42])
    overall_field = line2[0:10] + line2[13:20] + line2[21:43]
    overall_check = int(line2[43])

    fields = {
        "surname": surname,
        "given_names": given_names,
        "passport_number": passport_number.replace("<", ""),
        "nationality": nationality,
        "date_of_birth": dob,
        "sex": sex,
        "expiry_date": expiry,
    }

    errors = []
    if _mrz_check_digit(passport_number) != passport_check:
        errors.append("passport_number")
    if _mrz_check_digit(dob) != dob_check:
        errors.append("date_of_birth")
    if _mrz_check_digit(expiry) != expiry_check:
        errors.append("expiry_date")
    if _mrz_check_digit(personal_number) != personal_check:
        errors.append("personal_number")
    if _mrz_check_digit(overall_field) != overall_check:
        errors.append("overall")

    return {"valid": len(errors) == 0, "fields": fields, "errors": errors}


# ---------------------------------------------------------------------------
# Name extraction and matching
# ---------------------------------------------------------------------------


def extract_name_from_text(text: str) -> str | None:
    """Find a 'NAME:' line in OCR output and return the name."""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.upper().startswith("NAME:"):
            name = stripped[5:].strip()
            if name:
                return name
    return None


def _normalize_name(name: str) -> str:
    """Lowercase, strip accents, remove non-alpha/space."""
    nfkd = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-z\s]", "", stripped.lower()).strip()


def _bigram_set(s: str) -> set[str]:
    """Return set of character bigrams."""
    return {s[i : i + 2] for i in range(len(s) - 1)} if len(s) >= 2 else {s}


def names_match(provided: str, extracted: str, threshold: float = 0.5) -> bool:
    """Check if two names match using token-subset then bigram Jaccard fallback."""
    p = _normalize_name(provided)
    e = _normalize_name(extracted)

    if not p or not e:
        return False

    p_tokens = set(p.split())
    e_tokens = set(e.split())

    # Token-subset: all provided tokens appear in extracted (or vice versa)
    if p_tokens <= e_tokens or e_tokens <= p_tokens:
        return True

    # Bigram Jaccard similarity fallback
    p_bigrams = _bigram_set(p.replace(" ", ""))
    e_bigrams = _bigram_set(e.replace(" ", ""))
    if not p_bigrams or not e_bigrams:
        return p == e
    jaccard = len(p_bigrams & e_bigrams) / len(p_bigrams | e_bigrams)
    return jaccard >= threshold
