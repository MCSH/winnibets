const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("token");
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

export function requestMagicLink(identifier: string) {
  return request<{ message: string }>("/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ identifier, identifier_type: "phone" }),
  });
}

export function verifyToken(token: string) {
  return request<{ session_token: string }>(
    `/auth/verify?token=${encodeURIComponent(token)}`,
  );
}

export function getMe() {
  return request<{ identifier: string; identifier_type: string }>("/auth/me");
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

// --- Bets ---

export function createBet(params: {
  bet_terms: string;
  counterparty_identifier: string;
  counterparty_identifier_type: "phone";
  visibility: "visible" | "hidden";
  expiry_hours?: number;
}) {
  return request<{ bet_id: number; message: string }>("/bets", {
    method: "POST",
    body: JSON.stringify(params),
  });
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
