// API client for Kerjo. Reads base URL from env, attaches bearer token.

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL as string) + "/api";

export const AUTH_TOKEN_KEY = "kerjo_session_token";

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    throw new ApiError(401, "Unauthorized");
  }
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// ---- Auth ----
export async function exchangeSession(session_id: string) {
  return request<{ session_token: string; user: any }>("/auth/session", {
    method: "POST",
    body: { session_id },
    auth: false,
  });
}

export async function fetchMe() {
  return request<any>("/auth/me");
}

export async function logoutApi() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

// ---- Browse ----
function qs(params: Record<string, any>): string {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return s ? `?${s}` : "";
}

export type Filters = {
  category: string;
  job_type: string;
  max_distance: number;
  pay_bracket: string;
  experience: string;
};

export async function fetchJobs(f: Filters) {
  return request<any[]>(`/jobs${qs(f)}`);
}

export async function fetchWorkers(f: Filters) {
  return request<any[]>(`/workers${qs(f)}`);
}

export async function fetchWorker(id: string) {
  return request<any>(`/workers/${id}`);
}

export async function fetchJob(id: string) {
  return request<any>(`/jobs/${id}`);
}

// ---- Swipe / match ----
export async function postSwipe(target_type: string, target_id: string, direction: string) {
  return request<{ matched: boolean; match?: any }>("/swipe", {
    method: "POST",
    body: { target_type, target_id, direction },
  });
}

export async function fetchMatches() {
  return request<any[]>("/matches");
}

export async function fetchMatch(id: string) {
  return request<any>(`/matches/${id}`);
}

export async function fetchMessages(matchId: string) {
  return request<any[]>(`/matches/${matchId}/messages`);
}

export async function sendMessage(matchId: string, text: string) {
  return request<any[]>(`/matches/${matchId}/messages`, { method: "POST", body: { text } });
}

export async function completeJob(matchId: string) {
  return request<{ ok: boolean }>(`/matches/${matchId}/complete`, { method: "POST" });
}

export async function submitReview(matchId: string, rating: number, comment: string) {
  return request<any>(`/matches/${matchId}/review`, {
    method: "POST",
    body: { rating, comment },
  });
}

// ---- Profile / jobs ----
export async function getProfile() {
  return request<any>("/profile");
}

export async function saveProfile(profile: any) {
  return request<any>("/profile", { method: "POST", body: profile });
}

export async function createJob(job: any) {
  return request<any>("/jobs", { method: "POST", body: job });
}
