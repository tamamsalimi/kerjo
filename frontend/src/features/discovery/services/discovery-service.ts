import { buildQueryString, request } from "@/src/services/http-client";
import type { Coordinates, Filters } from "@/src/types/filters";

export function fetchBrowseAccess() {
  return request<{
    can_browse_jobs: boolean;
    can_browse_workers: boolean;
  }>("/browse/access");
}

export function fetchJobs(filters: Filters, coordinates?: Coordinates | null) {
  return request<any[]>(`/jobs${buildQueryString({
    ...filters,
    categories: filters.categories.join(","),
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
  })}`);
}

export function fetchWorkers(filters: Filters, coordinates?: Coordinates | null) {
  return request<any[]>(`/workers${buildQueryString({
    ...filters,
    categories: filters.categories.join(","),
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
  })}`);
}

export function fetchJob(id: string) {
  return request<any>(`/jobs/${id}`);
}
