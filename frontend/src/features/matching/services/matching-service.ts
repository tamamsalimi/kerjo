import { request } from "@/src/services/http-client";

export function postSwipe(
  targetType: string,
  targetId: string,
  direction: string,
  screeningAnswers?: string[],
  jobId?: string,
) {
  return request<{ matched: boolean; match?: any }>("/swipe", {
    method: "POST",
    body: {
      target_type: targetType,
      target_id: targetId,
      direction,
      screening_answers: screeningAnswers,
      job_id: jobId,
    },
  });
}

export function undoSwipe(targetType: string, targetId: string) {
  return request<{ ok: boolean }>("/swipe/undo", {
    method: "POST",
    body: { target_type: targetType, target_id: targetId },
  });
}

export function recycleSkippedSwipes(targetType: "job" | "worker") {
  return request<{ ok: boolean; recycled: number }>("/swipe/recycle", {
    method: "POST",
    body: { target_type: targetType },
  });
}

export function fetchMatches() {
  return request<any[]>("/matches");
}

export function fetchUnreadCount() {
  return request<{ count: number }>("/matches/unread-count");
}

export function fetchApplicants() {
  return request<any[]>("/applicants");
}

export function fetchMatch(id: string) {
  return request<any>(`/matches/${id}`);
}

export function completeJob(matchId: string) {
  return request<{ ok: boolean }>(`/matches/${matchId}/complete`, { method: "POST" });
}

export function submitReview(matchId: string, rating: number, comment: string) {
  return request<any>(`/matches/${matchId}/review`, {
    method: "POST",
    body: { rating, comment },
  });
}
