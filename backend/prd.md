# Product Requirements Document
## Community Blockchain Ledger — Hidden Messages & Bets

## 1. Overview
A Python-based blockchain system that allows community members to record tamper-proof entries after verifying their identity via email or phone number using magic links. The system supports two record types: **hidden messages** (the block stores a hash of the submitter's identity and a hash of the message; the plaintext is never stored) and **bets** (a two-party agreement where one user initiates and the counterparty accepts via an email or SMS invitation before the bet is finalized on-chain). Bets can be recorded with visible terms or with hidden terms (hash-only), at the initiator's choice. Every participant receives a notification through their registered channel (email or SMS) whenever a record involving them is committed.

> **Assumptions:**
> - The blockchain is a private/permissioned chain operated by us, not a public chain like Ethereum.
> - Python 3.10+ is the target runtime.
> - "Magic link" means a one-time, time-limited URL sent via email or SMS — no passwords or OAuth.
> - SMS delivery will use a third-party provider (e.g., Twilio).
> - Email delivery will use a transactional email service (e.g., SendGrid, SES, or SMTP).
> - A single user account is tied to one verified email OR one verified phone number (not both required, but both allowed).
> - Bets have exactly two parties; multi-party bets are out of scope.
> - "Recorded on the chain" means appended as a block with proof-of-work or proof-of-authority consensus among our nodes — not mined by external parties.
> - The system exposes a REST/HTTP API; a frontend UI is out of scope for this PRD.
> - Identity hashes use SHA-256 of the normalized identifier (lowercased email or E.164 phone number).

## 2. Problem Statement
- **Current state:** Community members who want to prove that a message existed at a certain time, or formalize a bet with another person, rely on informal channels (screenshots, chat logs, verbal agreements) that are trivially forgeable and lack auditability.
- **Pain / friction:** There is no lightweight, self-service way for non-technical users to create a cryptographic proof of a statement or a two-party wager without trusting a centralized third party or managing wallets/keys.
- **Why now:** Growing community demand for provable commitments (predictions, bets, sealed statements) and the availability of simple verification flows (magic links) that eliminate password friction.

## 3. Goals & Success Metrics

**Primary KPIs:**

| KPI | Baseline | Target |
|-----|----------|--------|
| Verified users (30-day) | Unknown (to be baselined) | Proposed: 500 within first 90 days |
| Records committed per week | 0 | Proposed: 100/week by month 3 |
| Magic-link verification success rate | Unknown (to be baselined) | Proposed: ≥ 95% |
| Bet acceptance rate (accepted / invited) | Unknown (to be baselined) | Proposed: ≥ 40% |

**Secondary metrics:**
- Median time from magic-link send to verified session: < 60 seconds
- Notification delivery success rate: ≥ 98%
- Chain integrity check pass rate: 100% (no tampered blocks)

## 4. Target Users

**Primary persona:**
- **Who:** Community member — non-technical individual who wants to record a provable statement or formalize a bet with a friend.
- **Context:** Accesses the system via API or a thin client. Has an email address or phone number. No crypto wallet or blockchain experience expected.

**Secondary persona:**
- **Who:** Bet counterparty — a person who may not yet be registered but receives an invitation (email/SMS) to accept a bet.
- **Context:** Receives a link, verifies identity, reviews the bet terms, and accepts or declines. May become a primary user afterward.

## 5. User Stories
- As a community member, I want to verify my identity with just my email or phone number so that I can start using the system without creating a password.
- As a verified user, I want to submit a hidden message so that only the hash is stored on the blockchain and I retain the only copy of the original text.
- As a verified user, I want to receive a cryptographic receipt (block hash + timestamp) after my hidden message is recorded so that I can later prove the message existed at that time.
- As a verified user, I want to create a bet with specific terms and invite another person via their email or phone number so that we can formalize our wager.
- As a bet initiator, I want to choose whether the bet terms are stored in plaintext or as a hash so that I can control the privacy of the wager.
- As a bet counterparty, I want to receive a notification with the bet terms and a magic link so that I can review and accept or decline the bet without pre-registering.
- As a bet participant, I want the bet to be recorded on the chain only after both parties have accepted so that neither side can claim the bet was unilateral.
- As a participant in any record, I want to be notified via my registered channel (email or SMS) when a block involving me is committed so that I have confirmation.
- As a user, I want to look up a record by its block hash so that I can verify its existence and timestamp on the chain.

## 6. Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR1 | **Magic-link registration/login:** Users submit an email or phone number. The system sends a one-time magic link valid for 15 minutes. Clicking/visiting the link creates or resumes a session. | Link expires after 15 min or first use. Session token returned on successful verification. Expired/reused link returns 401. |
| FR2 | **Hidden message submission:** A verified user submits plaintext via API. The system computes SHA-256 of the plaintext, discards the plaintext from memory/storage, and commits a block containing: `{ type: "hidden_message", identity_hash: SHA256(user_email_or_phone), message_hash: SHA256(plaintext), timestamp }`. | Plaintext never written to disk or database. Response includes the message hash and block hash. Block committed within 30 seconds. |
| FR3 | **On-chain data — hidden messages:** Each hidden-message block stores exactly: (a) `identity_hash` — SHA-256 of the submitter's normalized email or E.164 phone number, (b) `message_hash` — SHA-256 of the plaintext message, (c) `timestamp`, (d) `type: "hidden_message"`. No plaintext or raw identifiers are stored on-chain. | Block payload matches schema. Raw email/phone and message plaintext are absent from the block and all storage layers. |
| FR4 | **Bet creation:** A verified user submits bet terms (text description, optional expiry date), a counterparty identifier (email or phone), and a `visibility` flag (`"visible"` or `"hidden"`). The system stores the pending bet off-chain and sends an invitation to the counterparty. | Pending bet is not recorded on-chain. Counterparty receives email/SMS within 60 seconds containing bet terms (always visible in the notification regardless of visibility flag) and a magic link to accept. |
| FR5 | **Bet acceptance:** The counterparty clicks the magic link, verifies identity (auto-registered if new), reviews terms, and accepts or declines. On acceptance, the bet is committed to the chain. | Declining notifies the initiator and deletes the pending bet. Accepting commits a block per FR6. |
| FR6 | **On-chain data — bets:** Each bet block stores: (a) `initiator_identity_hash` — SHA-256 of the initiator's normalized email/phone, (b) `counterparty_identity_hash` — SHA-256 of the counterparty's normalized email/phone, (c) `bet_terms` — plaintext of the bet terms if `visibility == "visible"`, OR `bet_terms_hash` — SHA-256 of the bet terms if `visibility == "hidden"`, (d) `visibility` — `"visible"` or `"hidden"`, (e) `timestamp`, (f) `type: "bet"`. | Visible bets: block contains readable terms and no terms hash. Hidden bets: block contains terms hash only and no plaintext terms. Both: identity is always hashed, never raw. |
| FR7 | **Bet expiry:** If the counterparty does not respond within 72 hours (or a user-specified deadline), the bet is automatically cancelled and the initiator is notified. | Cron/scheduler cancels expired pending bets. Initiator receives a notification. No block is created. |
| FR8 | **Notifications:** On every chain commit involving a user, the system sends a notification via the user's registered channel (email or SMS) containing: record type, block hash, timestamp, and (for visible bets) the bet terms summary. | Notification sent within 60 seconds of block commit. Delivery status logged. Hidden-bet notifications include only the terms hash, not the plaintext. |
| FR9 | **Record lookup:** Any user (verified or not) can query a block by hash and receive: block index, timestamp, record type, identity hashes of participants, and (for visible bets) the bet terms or (for hidden bets / hidden messages) the relevant content hash. | Returns 404 for unknown hashes. Never exposes raw email/phone. Hidden content is shown only as its hash. |
| FR10 | **Chain integrity verification endpoint:** An endpoint that walks the chain and verifies every block's hash linkage and returns pass/fail. | Returns `{ "valid": true, "blocks": N }` or `{ "valid": false, "first_invalid_block": index }`. |
| FR11 | **Rate limiting:** Each verified user is limited to 20 record submissions per hour and 10 bet invitations per hour. | Exceeding limit returns 429 with `Retry-After` header. |
| FR12 | **Plaintext non-retention guarantee:** The system must not log, cache, or persist the plaintext of hidden messages or hidden bet terms at any layer (application logs, request logs, database) after the block is committed. | Audit of logging config confirms no plaintext leakage. Plaintext param is explicitly excluded from request logging middleware. |

## 7. Non-Functional Requirements

| ID | Category | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| NFR1 | Performance | Block commit latency ≤ 5 seconds under normal load | p95 commit latency < 5s with ≤ 100 concurrent users |
| NFR2 | Security | Magic links are single-use, cryptographically random (≥ 128 bits entropy), and expire after 15 minutes | Token entropy verified; replay returns 401; expiry enforced |
| NFR3 | Security | All API traffic over TLS 1.2+ | Non-TLS requests rejected or redirected |
| NFR4 | Privacy | Hidden message plaintext and hidden bet terms never touch persistent storage (disk, DB, logs) | Code review + integration test that inspects all storage layers post-submission |
| NFR5 | Privacy | Raw email addresses and phone numbers are never stored on-chain; only their SHA-256 hashes appear in blocks | Chain inspection confirms no raw identifiers in any block payload |
| NFR6 | Reliability | System available ≥ 99.5% monthly (excluding scheduled maintenance) | Uptime measured by external health check |
| NFR7 | Scalability | Chain supports ≥ 100,000 blocks without degradation in lookup or append performance | Load test with 100K blocks: append < 5s, lookup < 500ms |
| NFR8 | Compliance | N/A (no specific regulatory requirement identified) | — |
| NFR9 | Accessibility | API responses follow consistent JSON schema with human-readable error messages | OpenAPI spec passes validation; error responses include `code` and `message` fields |

## 8. UX Considerations
- **Platforms:** REST API (Python backend). No frontend UI in this scope — consumers may be CLI tools, bots, or a future web/mobile client.
- **Key screens/states (API-equivalent):**
  - Verification flow: request magic link → pending → verified session
  - Hidden message flow: submit → hash returned → block committed → notification sent
  - Bet flow: create (choose visible/hidden) → invitation sent → pending acceptance → accepted/declined/expired → block committed (if accepted) → notifications sent
- **Edge cases:**
  - User submits empty or whitespace-only hidden message → reject with 400.
  - Counterparty email/phone is the same as initiator → reject with 400.
  - Counterparty already has a pending bet from the same initiator with identical terms → reject as duplicate.
  - Magic link clicked after expiry → clear error message with option to request a new link.
  - Notification delivery fails (bounce/undeliverable) → retry once, then log failure; do not block chain commit.

## 9. Dependencies
- **SMS provider:** Twilio (or equivalent) for phone verification and SMS notifications.
- **Email provider:** SendGrid, AWS SES, or SMTP relay for email verification and notifications.
- **Hashing:** Python `hashlib` (SHA-256) — standard library, no external dependency.
- **Task queue / scheduler:** Celery + Redis (or equivalent) for async notification delivery and bet expiry checks.
- **Persistent storage:** PostgreSQL or SQLite for user accounts, pending bets, and chain blocks.
- **Python web framework:** FastAPI or Flask for the REST API layer.

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SMS/email provider downtime delays verifications and notifications | M | H | Queue outbound messages with retry; support fallback provider |
| Plaintext leaks via application logs or error traces | L | H | Strip plaintext from all log formatters; add integration test that greps logs post-submission |
| Chain data corruption or loss (disk failure) | L | H | Periodic chain backup; integrity check endpoint runs on schedule; consider replication |
| Abuse: spam bets or hidden messages to flood the chain | M | M | Rate limiting (FR11); require verification before any action |
| Magic link interception (email/SMS compromise) | L | H | Links are single-use and short-lived; encourage email providers with TLS; future: add optional PIN confirmation |
| Counterparty never responds to bet invitation | H | L | Auto-expiry (FR7) ensures pending bets don't linger indefinitely |
| Rainbow-table attack on identity hashes (email/phone are low-entropy) | M | M | Salt identity hashes with a system-wide secret before storing on-chain; document salt management |

## 11. Out of Scope
- Frontend web or mobile UI (API only in this phase).
- Public/decentralized blockchain (e.g., Ethereum, Solana). This is a private chain.
- Multi-party bets (> 2 participants).
- Bet resolution or outcome adjudication — the system records the bet, not who won.
- Payment processing or staking real money on bets.
- File or media attachments in hidden messages (text only).
- Password-based authentication (magic links only).
- User profile management beyond email/phone.
- Analytics dashboard or admin UI.
- GDPR right-to-erasure for on-chain data (blocks are immutable by design; this tension is deferred).

## 12. Rollout Strategy
- **Testing plan:**
  - Unit tests for chain operations (block creation, hash linkage, integrity check).
  - Unit tests for magic-link generation, expiry, and single-use enforcement.
  - Integration tests for full flows: verification → hidden message → notification; verification → bet creation → acceptance → notification.
  - Integration test confirming plaintext non-retention (submit hidden message, inspect all storage/logs).
  - Integration test confirming on-chain block payloads match FR3/FR6 schemas (no raw identifiers, correct hash fields).
  - Load test with simulated 100 concurrent users and 100K blocks.
- **Beta / phased rollout:**
  - Phase 1: Internal team only — validate core chain + magic-link flow.
  - Phase 2: Invite-only beta with 50 community members — hidden messages only.
  - Phase 3: Open beta — enable bets (visible and hidden), monitor acceptance rates and notification delivery.
- **Monitoring & rollback:**
  - Monitor: block commit latency, notification delivery rate, magic-link conversion rate, error rates (5xx).
  - Chain integrity check runs every hour via scheduled task.
  - Rollback trigger: integrity check failure, plaintext leakage detected, or notification delivery rate < 90% for 1 hour.
