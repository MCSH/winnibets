"""Tests for ID verification feature."""

import io

import pytest

from app.id_parser import _mrz_check_digit, names_match, parse_and_validate_mrz
from app.models import MagicLink, User


def _get_session_token(client, identifier="+15555550100", identifier_type="phone"):
    """Create a user via magic link flow and return a Bearer token."""
    from urllib.parse import quote

    client.post(
        "/auth/magic-link",
        json={"identifier": identifier, "identifier_type": identifier_type},
    )
    resp = client.get(
        f"/auth/_test/latest-token?identifier={quote(identifier, safe='')}"
    )
    token = resp.json()["token"]
    resp = client.get(f"/auth/verify?token={token}")
    return resp.json()["session_token"]


class TestMRZChecksum:
    """Unit tests for MRZ check digit computation."""

    def test_icao_specimen_passport_number(self):
        # ICAO Doc 9303 specimen: L898902C3 -> check digit 6
        assert _mrz_check_digit("L898902C3") == 6

    def test_numeric_field(self):
        # 740812 -> check digit 2
        assert _mrz_check_digit("740812") == 2

    def test_all_fillers(self):
        # All '<' should give 0
        assert _mrz_check_digit("<<<<<") == 0

    def test_valid_mrz_parsing(self):
        # ICAO specimen MRZ
        line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
        line2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
        text = f"Some header\n{line1}\n{line2}\nSome footer"
        result = parse_and_validate_mrz(text)
        assert result["valid"] is True
        assert result["fields"]["surname"] == "ERIKSSON"
        assert result["fields"]["given_names"] == "ANNA MARIA"
        assert result["fields"]["passport_number"] == "L898902C3"
        assert result["errors"] == []

    def test_invalid_mrz_bad_check_digit(self):
        # Corrupt the passport number check digit
        line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
        line2 = "L898902C30UTO7408122F1204159ZE184226B<<<<<10"  # 0 instead of 6
        text = f"{line1}\n{line2}"
        result = parse_and_validate_mrz(text)
        assert result["valid"] is False
        assert "passport_number" in result["errors"]

    def test_no_mrz_found(self):
        result = parse_and_validate_mrz("Just some random text\nNo MRZ here")
        assert result["valid"] is False
        assert "MRZ lines not found" in result["errors"]


class TestNameMatching:
    """Unit tests for name matching logic."""

    def test_exact_match(self):
        assert names_match("John Doe", "John Doe") is True

    def test_case_insensitive(self):
        assert names_match("john doe", "JOHN DOE") is True

    def test_middle_name_subset(self):
        assert names_match("John Doe", "John Michael Doe") is True

    def test_reversed_order(self):
        assert names_match("Doe John", "John Doe") is True

    def test_mismatch(self):
        assert names_match("John Doe", "Jane Smith") is False

    def test_empty_strings(self):
        assert names_match("", "John Doe") is False
        assert names_match("John Doe", "") is False


class TestVerificationEndpoint:
    """Integration tests for POST /verification/verify."""

    def _make_fake_image(self):
        """Create a minimal JPEG-like bytes object."""
        return b"\xff\xd8\xff\xe0" + b"\x00" * 100

    def _monkeypatch_ollama(self, monkeypatch, response_text):
        """Monkeypatch the Ollama call to return a fixed response."""

        async def fake_extract(image_bytes, document_type):
            return response_text

        monkeypatch.setattr(
            "app.verification.extract_text_from_image", fake_extract
        )

    def test_passport_success(self, client, monkeypatch):
        token = _get_session_token(client, "+15555550201")

        mrz_line1 = "P<UTODOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<" # 44 chars
        mrz_line2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10" # 44 chars
        ocr_text = f"NAME: John Doe\n{mrz_line1}\n{mrz_line2}"
        self._monkeypatch_ollama(monkeypatch, ocr_text)

        resp = client.post(
            "/verification/verify",
            data={"document_type": "passport", "provided_name": "John Doe"},
            files={"image": ("passport.jpg", self._make_fake_image(), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "verified"
        assert body["name_match"] is True
        assert body["extracted_name"] == "John Doe"

    def test_drivers_license_success(self, client, monkeypatch):
        token = _get_session_token(client, "+15555550202")

        self._monkeypatch_ollama(monkeypatch, "NAME: Jane Smith\nDL: D1234567")

        resp = client.post(
            "/verification/verify",
            data={"document_type": "drivers_license", "provided_name": "Jane Smith"},
            files={"image": ("dl.jpg", self._make_fake_image(), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "verified"
        assert body["name_match"] is True
        assert body["mrz_valid"] is None  # No MRZ for DL

    def test_name_mismatch(self, client, monkeypatch):
        token = _get_session_token(client, "+15555550203")

        self._monkeypatch_ollama(monkeypatch, "NAME: Jane Smith")

        resp = client.post(
            "/verification/verify",
            data={"document_type": "drivers_license", "provided_name": "Bob Jones"},
            files={"image": ("dl.jpg", self._make_fake_image(), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "failed"
        assert body["name_match"] is False
        assert "Name mismatch" in body["failure_reason"]

    def test_invalid_file_type(self, client):
        token = _get_session_token(client, "+15555550204")

        resp = client.post(
            "/verification/verify",
            data={"document_type": "passport", "provided_name": "John Doe"},
            files={"image": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "INVALID_FILE_TYPE" in resp.json()["detail"]["code"]

    def test_auth_required(self, client):
        resp = client.post(
            "/verification/verify",
            data={"document_type": "passport", "provided_name": "John Doe"},
            files={"image": ("passport.jpg", b"\xff\xd8\xff\xe0", "image/jpeg")},
        )
        assert resp.status_code == 401

    def test_status_none(self, client):
        token = _get_session_token(client, "+15555550205")

        resp = client.get(
            "/verification/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "none"

    def test_status_after_verification(self, client, monkeypatch):
        token = _get_session_token(client, "+15555550206")

        self._monkeypatch_ollama(monkeypatch, "NAME: Alice Wonderland")

        client.post(
            "/verification/verify",
            data={"document_type": "drivers_license", "provided_name": "Alice Wonderland"},
            files={"image": ("dl.png", self._make_fake_image(), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = client.get(
            "/verification/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "verified"
        assert body["provided_name"] == "Alice Wonderland"
