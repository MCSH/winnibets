const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg =
      body?.detail?.message ?? body?.detail?.[0]?.msg ?? res.statusText;
    const code = body?.detail?.code ?? `HTTP_${res.status}`;
    const err = new Error(msg) as Error & {
      code: string;
      status: number;
      retryAfter?: number;
    };
    err.code = code;
    err.status = res.status;
    if (res.status === 429) {
      err.retryAfter = Number(res.headers.get("Retry-After") ?? 60);
    }
    throw err;
  }

  return res.json() as Promise<T>;
}

// --- Auth ---

export function requestMagicLink(
  identifier: string,
  identifier_type: "phone" | "email" = "phone",
) {
  return request<{ message: string }>("/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ identifier, identifier_type }),
  });
}

export function verifyToken(token: string) {
  return request<{ session_token: string; pending_bet_id?: number }>(
    `/auth/verify?token=${encodeURIComponent(token)}`,
  );
}

export function getMe() {
  return request<{ identifier: string; identifier_type: string; nickname?: string; beer_balance: number }>("/auth/me");
}

// --- Messages ---

export function submitHiddenMessage(plaintext: string) {
  return request<{
    message_hash: string;
    block_hash: string;
    block_index: number;
    timestamp: number;
  }>("/messages/hidden", {
    method: "POST",
    body: JSON.stringify({ plaintext }),
  });
}

export function submitMessage(
  plaintext: string,
  visibility: "visible" | "hidden",
) {
  return request<{
    message_hash: string;
    block_hash: string;
    block_index: number;
    timestamp: number;
    visibility: string;
  }>("/messages", {
    method: "POST",
    body: JSON.stringify({ plaintext, visibility }),
  });
}

// --- Bets ---

export function createBet(params: {
  bet_terms: string;
  counterparty_identifier: string;
  counterparty_identifier_type: "phone" | "email";
  visibility: "visible" | "hidden";
  amount?: string;
  beer_wager?: number;
}) {
  return request<{ bet_id: number; message: string }>("/bets", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface PendingBet {
  bet_id: number;
  bet_terms: string;
  visibility: string;
  initiator_identifier: string;
  initiator_identifier_type: string;
  expires_at: string;
  created_at: string;
}

export function listPendingBets() {
  return request<PendingBet[]>("/bets/pending");
}

export function respondToBet(betId: number, accept: boolean) {
  return request<{
    status: "accepted" | "declined";
    block_hash?: string;
    block_index?: number;
    timestamp?: number;
  }>(`/bets/${betId}/respond`, {
    method: "POST",
    body: JSON.stringify({ accept }),
  });
}

// --- Bet Resolution ---

export function proposeResolution(
  betId: number,
  winner: "initiator" | "counterparty",
  note?: string,
) {
  return request<{ resolution_id: number; message: string }>(
    `/bets/${betId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ winner, note: note || undefined }),
    },
  );
}

export function respondToResolution(betId: number, accept: boolean) {
  return request<{
    status: "accepted" | "rejected";
    block_hash?: string;
    block_index?: number;
    timestamp?: number;
  }>(`/bets/${betId}/resolve/respond`, {
    method: "POST",
    body: JSON.stringify({ accept }),
  });
}

// --- Activity ---

export interface ActivityBlock {
  block_index: number;
  block_hash: string;
  timestamp: number;
  record_type: string;
  role: string;
  data: Record<string, unknown>;
}

export interface BetResolution {
  resolution_id: number;
  bet_id: number;
  proposed_by: "initiator" | "counterparty";
  winner: "initiator" | "counterparty";
  note?: string;
  status: "pending" | "accepted" | "rejected";
  block_hash?: string;
  resolved_at?: string;
  created_at: string;
}

export interface ActivityBet {
  bet_id: number;
  bet_terms: string;
  amount?: string;
  beer_wager?: number;
  visibility: string;
  status: string;
  role: string;
  counterparty_identifier?: string;
  counterparty_identifier_type?: string;
  counterparty_nickname?: string;
  initiator_identifier?: string;
  initiator_identifier_type?: string;
  initiator_nickname?: string;
  expires_at: string;
  created_at: string;
  resolution?: BetResolution;
}

export function getMyActivity() {
  return request<{
    blocks: ActivityBlock[];
    bets: ActivityBet[];
  }>("/activity/my");
}

// --- Contacts ---

export interface Contact {
  id: number;
  identifier: string;
  identifier_type: string;
  name: string;
}

export function listContacts() {
  return request<Contact[]>("/contacts");
}

export function createContact(params: {
  identifier: string;
  identifier_type: "phone" | "email";
  name: string;
}) {
  return request<Contact>("/contacts", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateContact(contactId: number, name: string) {
  return request<Contact>(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function deleteContact(contactId: number) {
  return request<void>(`/contacts/${contactId}`, { method: "DELETE" });
}

export interface ContactSuggestion {
  identifier: string;
  identifier_type: string;
}

export function getContactSuggestions() {
  return request<ContactSuggestion[]>("/contacts/suggestions");
}

export function resolveContacts(identifiers: string[]) {
  return request<{ names: Record<string, string> }>("/contacts/resolve", {
    method: "POST",
    body: JSON.stringify({ identifiers }),
  });
}

// --- ID Verification ---

export interface IDVerificationResult {
  status: "verified" | "failed";
  document_type: string;
  provided_name: string;
  extracted_name?: string;
  mrz_valid?: boolean;
  name_match: boolean;
  failure_reason?: string;
  created_at: string;
}

export interface VerificationStatus {
  status: "verified" | "failed" | "none";
  document_type?: string;
  provided_name?: string;
  extracted_name?: string;
  mrz_valid?: boolean;
  name_match?: boolean;
  failure_reason?: string;
  created_at?: string;
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg =
      body?.detail?.message ?? body?.detail?.[0]?.msg ?? res.statusText;
    const code = body?.detail?.code ?? `HTTP_${res.status}`;
    const err = new Error(msg) as Error & {
      code: string;
      status: number;
      retryAfter?: number;
    };
    err.code = code;
    err.status = res.status;
    if (res.status === 429) {
      err.retryAfter = Number(res.headers.get("Retry-After") ?? 60);
    }
    throw err;
  }

  return res.json() as Promise<T>;
}

export function verifyID(
  image: File,
  documentType: "passport" | "drivers_license",
  providedName: string,
) {
  const fd = new FormData();
  fd.append("image", image);
  fd.append("document_type", documentType);
  fd.append("provided_name", providedName);
  return uploadRequest<IDVerificationResult>("/verification/verify", fd);
}

export function getVerificationStatus() {
  return request<VerificationStatus>("/verification/status");
}

// --- Public Profiles ---

export interface PublicProfile {
  identity_hash: string;
  nickname?: string;
  beer_balance: number;
  verified: boolean;
  stats: {
    bets: number;
    wins: number;
    losses: number;
    on_chain: number;
  };
}

export function getPublicProfile(identityHash: string) {
  return request<PublicProfile>(`/profiles/${identityHash}`);
}

// --- Blocks ---

export function lookupBlock(blockHash: string) {
  return request<{
    block_index: number;
    timestamp: number;
    record_type: string;
    data: Record<string, unknown>;
  }>(`/blocks/${blockHash}`);
}

export function verifyIntegrity() {
  return request<{
    valid: boolean;
    blocks?: number;
    first_invalid_block?: number;
  }>("/blocks/");
}

export interface BlockSummary {
  block_index: number;
  block_hash: string;
  timestamp: number;
  record_type: string;
  data: Record<string, unknown>;
}

export function listBlocks(offset = 0, limit = 20) {
  return request<{
    blocks: BlockSummary[];
    total: number;
    offset: number;
    limit: number;
    nicknames: Record<string, string>;
  }>(`/blocks/list?offset=${offset}&limit=${limit}`);
}
