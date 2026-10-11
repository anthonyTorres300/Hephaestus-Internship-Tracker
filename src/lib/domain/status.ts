export const STATUSES = [
  "saved",
  "prepared",
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "ghosted",
] as const;

export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved",
  prepared: "Prepared",
  applied: "Applied",
  screening: "Screening",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};

const UNSUBMITTED: readonly Status[] = ["saved", "prepared"];
const CLOSED: readonly Status[] = ["rejected", "withdrawn", "ghosted"];
const REOPEN_TARGETS: readonly Status[] = ["applied", "screening", "assessment", "interview", "offer"];

export const isSubmittedStatus = (s: Status): boolean => !UNSUBMITTED.includes(s);

export interface MoveResult {
  ok: boolean;
  reason?: "cannot_unsubmit" | "reason_required";
  noop?: true;
}

export function canMoveTo(from: Status, to: Status, reason?: string): MoveResult {
  if (from === to) return { ok: true, noop: true };
  if (isSubmittedStatus(from) && !isSubmittedStatus(to)) return { ok: false, reason: "cannot_unsubmit" };
  if (CLOSED.includes(from) && REOPEN_TARGETS.includes(to) && !reason?.trim()) {
    return { ok: false, reason: "reason_required" };
  }
  return { ok: true };
}
