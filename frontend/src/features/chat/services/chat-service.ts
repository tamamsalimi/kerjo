import { request } from "@/src/services/http-client";

export function markMatchRead(matchId: string) {
  return request<{ ok: boolean }>(`/matches/${matchId}/read`, { method: "POST" });
}

export function scheduleMeeting(matchId: string, kind: string, when: string, note: string) {
  return request<any[]>(`/matches/${matchId}/schedule`, {
    method: "POST",
    body: { kind, when, note },
  });
}

export function respondSchedule(matchId: string, scheduleId: string, accept: boolean) {
  return request<any[]>(`/matches/${matchId}/schedule/${scheduleId}/respond`, {
    method: "POST",
    body: { accept },
  });
}

export function fetchMessages(matchId: string) {
  return request<any[]>(`/matches/${matchId}/messages`);
}

export function sendMessage(matchId: string, text: string) {
  return request<any[]>(`/matches/${matchId}/messages`, {
    method: "POST",
    body: { text },
  });
}
