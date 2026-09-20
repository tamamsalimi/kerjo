import { Platform } from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL as string) + "/api";

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

export async function request<T>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;

  const response = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    throw new ApiError(401, "Unauthorized");
  }
  if (!response.ok) {
    let detail = "Request failed";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {}
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function buildQueryString(params: Record<string, unknown>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `?${query}` : "";
}

export function mediaUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return (process.env.EXPO_PUBLIC_BACKEND_URL as string) + pathOrUrl;
}

export async function uploadImage(uri: string, path: string): Promise<any> {
  const name = uri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(name);
  const type = match ? `image/${match[1].toLowerCase()}` : "image/jpeg";
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  const headers: Record<string, string> = {};
  if (inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;
  const response = await fetch(API_BASE + path, { method: "POST", headers, body: form });
  if (!response.ok) throw new ApiError(response.status, "Upload failed");
  return response.json();
}
