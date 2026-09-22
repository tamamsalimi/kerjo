import { request, uploadImage } from "@/src/services/http-client";

export function getProfile() {
  return request<any>("/profile");
}

export function saveProfile(profile: any) {
  return request<any>("/profile", { method: "POST", body: profile });
}

export function fetchProfileHistory() {
  return request<any>("/profile/history");
}

export function fetchWorker(id: string) {
  return request<any>(`/workers/${id}`);
}

export async function uploadProfilePhoto(uri: string): Promise<string> {
  const data = await uploadImage(uri, "/profile/photos");
  return data.url;
}
