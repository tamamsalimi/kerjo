import { mediaUrl, request, uploadImage } from "@/src/services/http-client";

export function createJob(job: any) {
  return request<any>("/jobs", { method: "POST", body: job });
}

export function fetchJobForEdit(jobId: string) {
  return request<any>(`/jobs/${jobId}/edit`);
}

export function updateJob(jobId: string, job: any) {
  return request<any>(`/jobs/${jobId}`, { method: "PUT", body: job });
}

export async function uploadJobPhoto(
  jobId: string,
  uri: string,
): Promise<{ url: string; storedUrl: string; job: any }> {
  const data = await uploadImage(uri, `/jobs/${jobId}/photos`);
  return { url: mediaUrl(data.url), storedUrl: data.url, job: data.job };
}
