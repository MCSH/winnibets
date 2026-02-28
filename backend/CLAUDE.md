# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
source .venv/bin/activate
pytest                          # all tests
pytest tests/test_bets.py -v    # one file
pytest -k "test_accept"         # by name pattern
uvicorn app.main:app --reload   # dev server on :8000
```

## Architecture

FastAPI app with an in-memory blockchain, SQLAlchemy/SQLite persistence for users and pending bets, Twilio SMS and SendGrid email for notifications.

**Request flow:** Client → FastAPI router → `get_current_user` dependency (Bearer token) → business logic → blockchain/DB → notification

**Key singletons** (in `app/main.py`):
- `blockchain` — the chain instance, reset in tests via `_reset_blockchain()`
- SMS notification backend — auto-selected in `app/notifications.py`, overridden in tests via `set_backend()`
- Email notification backend — auto-selected in `app/notifications.py`, overridden in tests via `set_email_backend()`
- Rate limiter state — module-level dict in `app/rate_limit.py`, reset in tests via `_reset()`

**On-chain block data schemas** (defined in FR3/FR6 of `prd.md`):
- Hidden message: `{ type, identity_hash, message_hash, timestamp }`
- Visible bet: `{ type, initiator_identity_hash, counterparty_identity_hash, bet_terms, visibility, timestamp }`
- Hidden bet: `{ type, initiator_identity_hash, counterparty_identity_hash, bet_terms_hash, visibility, timestamp }`

**Privacy invariants:**
- Raw phone numbers never appear in blockchain blocks — only salted SHA-256 hashes
- Hidden message plaintext is never persisted anywhere
- Hidden bet terms are scrubbed from `PendingBet.bet_terms` after resolution with `[scrubbed:sha256:<hash>]`
- The `send_notification` function is the only place raw identifiers are used (for SMS/email delivery)

## Module Map

| Module | Role |
|--------|------|
| `auth.py` | Magic link + session endpoints. Test endpoints guarded by `settings.debug` |
| `bets.py` | Bet CRUD + expiry. `_verify_service_secret()` protects cron endpoint |
| `messages.py` | Hidden message submission. Hashes plaintext, discards it, commits block |
| `blocks.py` | Public block lookup + chain integrity check |
| `blockchain.py` | `Block` and `Blockchain` classes. Thread-safe `add_block()` |
| `notifications.py` | Dual backends: SMS (`Twilio`/`LoggingSMS`) + Email (`SendGrid`/`LoggingEmail`). Routes by `identifier_type` |
| `rate_limit.py` | Sliding-window rate limiter, per-user per-action |
| `hashing.py` | `hash_identity()` (salted), `hash_content()` (unsalted), `normalize_identifier()` |
| `schemas.py` | Pydantic models. `IdentifierType` enum: phone + email |
| `models.py` | SQLAlchemy: User, MagicLink, SessionToken, PendingBet, ChainBlock |
| `deps.py` | `get_current_user` FastAPI dependency |
| `config.py` | `Settings` via pydantic-settings, `WINNIBETS_` env prefix |
| `database.py` | Engine, session factory, `create_tables()` |
