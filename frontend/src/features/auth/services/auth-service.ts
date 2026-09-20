import { request, uploadImage } from "@/src/services/http-client";

export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";

export type VerificationView = {
  phone: string;
  nik_masked: string;
  has_ktp_photo: boolean;
  has_face_photo: boolean;
  status: VerificationStatus;
  rejection_reason: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  verified_at?: string | null;
};

export function exchangeGoogleToken(idToken: string) {
  return request<{ session_token: string; user: any }>("/auth/google", {
    method: "POST",
    body: { id_token: idToken },
    auth: false,
  });
}

export function fetchMe() {
  return request<any>("/auth/me");
}

export function logoutApi() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function fetchVerification() {
  return request<VerificationView>("/verification");
}

export function submitVerification(phone: string, nik: string) {
  return request<VerificationView>("/verification", {
    method: "POST",
    body: { phone, nik },
  });
}

export async function uploadVerificationDocument(uri: string, kind: "ktp" | "face"): Promise<void> {
  await uploadImage(uri, `/verification/documents/${kind}`);
}
