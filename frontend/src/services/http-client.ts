import { Platform } from "react-native";

function apiBase(): string {
  const envBase = String(process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") + "/api";
  if (Platform.OS !== "web" || typeof window === "undefined") return envBase;
  const { origin } = window.location;
  if (origin.startsWith("https://") || origin.includes(":8090")) {
    return `${origin}/api`;
  }
  return envBase;
}

export const AUTH_TOKEN_KEY = "kerjo_session_token";

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
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

  const response = await fetch(apiBase() + path, {
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
  const backendURL = String(process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
  const publicOrigin =
    Platform.OS === "web" && typeof window !== "undefined"
      && (window.location.origin.startsWith("https://") || window.location.origin.includes(":8090"))
      ? window.location.origin
      : backendURL;
  if (pathOrUrl.startsWith("http")) {
    try {
      const source = new URL(pathOrUrl);
      const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"]);
      if (localHosts.has(source.hostname)) {
        return publicOrigin + source.pathname + source.search;
      }
    } catch {
      return pathOrUrl;
    }
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return publicOrigin + path;
}

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.8;

function blobFromDataURL(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /data:([^;]+)/.exec(header)?.[1] || "image/jpeg";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

async function blobFromUri(uri: string): Promise<Blob> {
  if (uri.startsWith("data:")) {
    return blobFromDataURL(uri);
  }
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not read image");
  }
  return response.blob();
}

async function imageFromBlob(blob: Blob): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { width: bitmap.width, height: bitmap.height, draw: bitmap };
    } catch {}
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode image"));
      element.src = objectUrl;
    });
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, draw: image };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressImageBlob(blob: Blob): Promise<Blob> {
  if (typeof document === "undefined") {
    return blob;
  }
  const source = await imageFromBlob(blob);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height, 1));
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    return blob;
  }
  context.drawImage(source.draw, 0, 0, canvas.width, canvas.height);
  if (typeof ImageBitmap !== "undefined" && source.draw instanceof ImageBitmap) {
    source.draw.close();
  }
  const compressed = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });
  return compressed ?? blob;
}

function appendImageFile(form: FormData, blob: Blob) {
  const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  if (typeof File === "function") {
    form.append("file", new File([blob], "photo.jpg", { type }));
    return;
  }
  form.append("file", blob, "photo.jpg");
}

export async function persistLocalImage(uri: string): Promise<string> {
  if (!uri || uri.startsWith("data:") || uri.startsWith("file:") || uri.startsWith("content:")) {
    return uri;
  }
  if (Platform.OS !== "web" || typeof document === "undefined") return uri;
  const compressed = await compressImageBlob(await blobFromUri(uri));
  return URL.createObjectURL(compressed);
}

export async function uploadImage(uri: string, path: string): Promise<any> {
  const form = new FormData();
  if (Platform.OS === "web") {
    const source = await blobFromUri(uri);
    const payload = source.type === "image/jpeg" && source.size < 1_500_000
      ? source
      : await compressImageBlob(source);
    appendImageFile(form, payload);
  } else {
    const persisted = await persistLocalImage(uri);
    const name = persisted.split("/").pop() || "photo.jpg";
    const match = /\.(\w+)$/.exec(name);
    const type = match ? `image/${match[1].toLowerCase()}` : "image/jpeg";
    form.append("file", { uri: persisted, name, type } as any);
  }
  const headers: Record<string, string> = {};
  if (inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;
  const response = await fetch(apiBase() + path, { method: "POST", headers, body: form });
  if (!response.ok) {
    let detail = "Upload failed";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {}
    throw new ApiError(response.status, detail);
  }
  return response.json();
}
