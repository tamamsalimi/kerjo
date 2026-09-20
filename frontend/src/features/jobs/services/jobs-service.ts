import { mediaUrl, request, uploadImage } from "@/src/services/http-client";

export function createJob(job: any) {
  return request<any>("/jobs", { method: "POST", body: job });
}

export async function uploadJobPhoto(jobId: string, uri: string): Promise<{ url: string; job: any }> {
  const data = await uploadImage(uri, `/jobs/${jobId}/photos`);
  return { url: mediaUrl(data.url), job: data.job };
}
