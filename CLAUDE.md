# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WinniBets is a private community blockchain ledger for hidden messages and two-party bets. Authentication via Twilio SMS or SendGrid email magic links. The PRD is at `backend/prd.md` and the API spec is at `openapi.yml`.

## Repository Structure

```
├── backend/          # Python FastAPI backend (primary codebase)
│   ├── app/          # Application code
│   ├── tests/        # Test suite (119+ tests)
│   ├── pyproject.toml
│   └── prd.md        # Product requirements
├── openapi.yml       # OpenAPI 3.1.0 spec (phone + email)
└── frontend/         # React + Vite + Tailwind frontend
```

## Commands

```bash
# From backend/ directory:
source .venv/bin/activate

# Run all tests
pytest

# Run a specific test file or test
pytest tests/test_auth.py
pytest tests/test_bets.py::TestBetAcceptance::test_accept_bet_commits_block

# Run dev server
uvicorn app.main:app --reload

# Deploy backend to production
rsync -avz --exclude='.venv' --exclude='__pycache__' --exclude='*.egg-info' --exclude='.ship' --exclude='*.db' --exclude='.env' backend/ winnibets:/opt/winnibets-backend/
ssh winnibets "systemctl restart winnibets"

# Deploy frontend to production
cd frontend && npm run build
rsync -avz --delete frontend/dist/ winnibets:/var/www/winnibets/
```

Production: API at `https://api.winnibets.com`, frontend at `https://winnibets.com` (Caddy reverse proxy, auto-HTTPS).
- Backend served from `/opt/winnibets-backend/` on the server
- Frontend served from `/var/www/winnibets/` on the server (static files via Caddy)

## Architecture

**Blockchain** (`app/blockchain.py`): In-memory chain with SHA-256 hash linkage, thread-safe via `threading.Lock`. Singleton instance in `app/main.py`. `ChainBlock` SQLAlchemy model exists for future persistence but is not yet wired up — chain data is lost on restart.

**Auth flow** (`app/auth.py`): Phone or email → magic link (SMS via Twilio or email via SendGrid) → single-use token verification → session token (Bearer). Test-only endpoints (`/_test/latest-token`, `/_test/expire-token`) are guarded behind `settings.debug`.

**Two record types on-chain:**
- **Hidden messages** (`app/messages.py`): Plaintext hashed immediately and discarded. Block stores `identity_hash` + `message_hash` only.
- **Bets** (`app/bets.py`): Stored off-chain as `PendingBet` until counterparty accepts. Visible bets store terms in plaintext on-chain; hidden bets store only the hash. Hidden bet terms are scrubbed from DB after resolution (accept/decline/expire).

**Identity hashing** (`app/hashing.py`): Salted SHA-256 (`salt:identifier`). Content hashing is unsalted so users can independently verify.

**Notifications** (`app/notifications.py`): Dual pluggable backends — SMS via `TwilioNotificationBackend` (when `WINNIBETS_TWILIO_ACCOUNT_SID` is set) and email via `SendGridEmailBackend` (when `WINNIBETS_SENDGRID_API_KEY` is set). Falls back to logging backends for each. `send_notification()` routes to the right backend based on `identifier_type`.

**Rate limiting** (`app/rate_limit.py`): In-memory sliding window, per-user. 20 submissions/hr, 10 bet invitations/hr. Returns 429 with `Retry-After`.

## Configuration

All env vars prefixed `WINNIBETS_` (via pydantic-settings). Key ones:

- `WINNIBETS_IDENTITY_HASH_SALT` — salt for on-chain identity hashes
- `WINNIBETS_SERVICE_SECRET` — required for `POST /bets/_expire` (cron endpoint, checked via `X-Service-Secret` header)
- `WINNIBETS_TWILIO_ACCOUNT_SID`, `_AUTH_TOKEN`, `_PHONE_NUMBER` — SMS delivery
- `WINNIBETS_SENDGRID_API_KEY`, `_FROM_EMAIL` — email delivery via SendGrid
- `WINNIBETS_DEBUG` — enables test-only endpoints (never in production)

## Testing Conventions

- Tests use in-memory SQLite and a fresh blockchain per test (via `conftest.py` fixtures)
- `_get_session_token()` helper in most test files: creates user via magic link and returns a Bearer token
- Phone numbers in tests use `+1555XXXXXXX` format with unique numbers per test to avoid collisions
- URL-encode `+` as `%2B` when passing phone numbers as query params
- The `identifier_type` enum accepts `"phone"` and `"email"`
