import { useSyncExternalStore } from "react";

let recentJob: any | null = null;
const listeners = new Set<() => void>();

export function setRecentJob(job: any | null) {
  recentJob = job;
  listeners.forEach((listener) => listener());
}

export function useRecentJob() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => recentJob,
    () => recentJob,
  );
}
