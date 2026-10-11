import { describe, expect, it } from "vitest";
import {
  canMoveTo,
  classifyTask,
  formatInstant,
  formatPartialDate,
  isSubmittedStatus,
  isValidPartialDate,
  isValidTimezone,
  localDateIn,
  mondayOf,
  partialDateToIso,
  sortTasks,
  type TaskLike,
} from "@/lib/domain";

describe("partial dates", () => {
  it("formats by precision without inventing a day", () => {
    expect(formatPartialDate({ precision: "month", year: 2024, month: 9 })).toBe("September 2024");
    expect(formatPartialDate({ precision: "day", year: 2025, month: 10, day: 8 })).toBe("Oct 8, 2025");
    expect(formatPartialDate({ precision: "year", year: 2025 })).toBe("2025");
    expect(formatPartialDate({ precision: "unknown" })).toBe("Unknown date");
  });
  it("validates", () => {
    expect(isValidPartialDate({ precision: "day", year: 2025, month: 2, day: 30 })).toBe(false);
    expect(isValidPartialDate({ precision: "day", year: 2024, month: 2, day: 29 })).toBe(true);
    expect(isValidPartialDate({ precision: "month", year: 2024, month: 13 })).toBe(false);
    expect(isValidPartialDate({ precision: "month", year: 2024 })).toBe(false);
    expect(isValidPartialDate({ precision: "unknown" })).toBe(true);
  });
  it("converts to ISO only for day precision", () => {
    expect(partialDateToIso({ precision: "day", year: 2025, month: 1, day: 5 })).toBe("2025-01-05");
    expect(partialDateToIso({ precision: "month", year: 2025, month: 1 })).toBeNull();
  });
  it("local date follows the zone and Monday is week start", () => {
    const t = new Date("2027-03-15T02:30:00Z");
    expect(localDateIn(t, "America/Puerto_Rico")).toBe("2027-03-14");
    expect(localDateIn(t, "UTC")).toBe("2027-03-15");
    expect(mondayOf("2027-03-14")).toBe("2027-03-08");
    expect(mondayOf("2027-03-15")).toBe("2027-03-15");
  });
  it("validates timezones and formats instants", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
    expect(formatInstant("2027-03-15T02:30:00Z", "America/Puerto_Rico")).toContain("Mar 14, 2027");
  });
});

describe("status transitions", () => {
  it("is not a rigid linear flow", () => {
    expect(canMoveTo("saved", "interview").ok).toBe(true);
    expect(canMoveTo("applied", "offer").ok).toBe(true);
    expect(canMoveTo("interview", "screening").ok).toBe(true);
  });
  it("blocks unsubmitting", () => {
    expect(canMoveTo("applied", "saved")).toEqual({ ok: false, reason: "cannot_unsubmit" });
    expect(canMoveTo("rejected", "prepared").reason).toBe("cannot_unsubmit");
    expect(isSubmittedStatus("prepared")).toBe(false);
    expect(isSubmittedStatus("ghosted")).toBe(true);
  });
  it("requires a reason to reopen", () => {
    for (const from of ["rejected", "withdrawn", "ghosted"] as const) {
      expect(canMoveTo(from, "interview")).toEqual({ ok: false, reason: "reason_required" });
    }
    expect(canMoveTo("rejected", "interview", "They reached back out").ok).toBe(true);
    expect(canMoveTo("rejected", "interview", "  ").ok).toBe(false);
    expect(canMoveTo("applied", "rejected").ok).toBe(true);
  });
  it("same status is a noop", () => {
    expect(canMoveTo("applied", "applied")).toEqual({ ok: true, noop: true });
  });
});

const task = (p: Partial<TaskLike>): TaskLike => ({ state: "pending", due_date: null, due_at: null, ...p });

describe("classifyTask in America/Puerto_Rico", () => {
  const tz = "America/Puerto_Rico";
  const now = new Date("2026-10-10T16:00:00Z");
  it("date-only: due today is today, overdue the day after", () => {
    expect(classifyTask(task({ due_date: "2026-10-10" }), now, tz)).toBe("today");
    expect(classifyTask(task({ due_date: "2026-10-09" }), now, tz)).toBe("overdue");
    expect(classifyTask(task({ due_date: "2026-10-17" }), now, tz)).toBe("next7");
    expect(classifyTask(task({ due_date: "2026-10-18" }), now, tz)).toBe("later");
  });
  it("uses the local date, not UTC, to decide", () => {
    const lateEvening = new Date("2026-10-11T02:00:00Z");
    expect(classifyTask(task({ due_date: "2026-10-10" }), lateEvening, tz)).toBe("today");
    expect(classifyTask(task({ due_date: "2026-10-10" }), lateEvening, "UTC")).toBe("overdue");
  });
  it("timed: overdue only after the exact instant", () => {
    expect(classifyTask(task({ due_at: "2026-10-10T16:00:00Z" }), now, tz)).toBe("today");
    expect(classifyTask(task({ due_at: "2026-10-10T15:59:59Z" }), now, tz)).toBe("overdue");
    expect(classifyTask(task({ due_at: "2026-10-11T03:00:00Z" }), now, tz)).toBe("today");
    expect(classifyTask(task({ due_at: "2026-10-11T04:00:00Z" }), now, tz)).toBe("next7");
  });
  it("closed and undated", () => {
    expect(classifyTask(task({ state: "completed", due_date: "2020-01-01" }), now, tz)).toBe("closed");
    expect(classifyTask(task({ state: "dismissed" }), now, tz)).toBe("closed");
    expect(classifyTask(task({}), now, tz)).toBe("later");
  });
});

describe("classifyTask across the March 2027 DST change in America/New_York", () => {
  const tz = "America/New_York";
  it("deadline just before local midnight (EST, day before DST) stays today then turns overdue", () => {
    const due = task({ due_at: "2027-03-14T04:59:00Z" }); // 11:59 PM EST on Mar 13
    expect(classifyTask(due, new Date("2027-03-14T04:58:00Z"), tz)).toBe("today");
    expect(classifyTask(due, new Date("2027-03-14T05:00:00Z"), tz)).toBe("overdue");
  });
  it("just after local midnight belongs to the next local day", () => {
    const due = task({ due_at: "2027-03-14T05:01:00Z" }); // 12:01 AM EST Mar 14
    expect(classifyTask(due, new Date("2027-03-14T04:00:00Z"), tz)).toBe("next7");
    expect(classifyTask(due, new Date("2027-03-14T05:00:30Z"), tz)).toBe("today");
  });
  it("local midnight after the change is 04:00Z", () => {
    expect(localDateIn(new Date("2027-03-15T03:59:00Z"), tz)).toBe("2027-03-14");
    expect(localDateIn(new Date("2027-03-15T04:00:00Z"), tz)).toBe("2027-03-15");
    const dueDay = task({ due_date: "2027-03-14" });
    expect(classifyTask(dueDay, new Date("2027-03-15T03:59:00Z"), tz)).toBe("today");
    expect(classifyTask(dueDay, new Date("2027-03-15T04:00:00Z"), tz)).toBe("overdue");
  });
  it("the 7-day window is counted in calendar days over the 23-hour day", () => {
    const now = new Date("2027-03-13T15:00:00Z");
    expect(classifyTask(task({ due_date: "2027-03-20" }), now, tz)).toBe("next7");
    expect(classifyTask(task({ due_date: "2027-03-21" }), now, tz)).toBe("later");
    expect(classifyTask(task({ due_at: "2027-03-21T03:59:00Z" }), now, tz)).toBe("next7");
  });
});

describe("sortTasks", () => {
  it("orders overdue, today, next7, later, closed and is stable", () => {
    const tz = "America/Puerto_Rico";
    const now = new Date("2026-10-10T16:00:00Z");
    const t = (id: string, p: Partial<TaskLike>) => ({ id, ...task(p) });
    const sorted = sortTasks(
      [
        t("later", { due_date: "2026-12-01" }),
        t("done", { state: "completed", due_date: "2026-10-01" }),
        t("n7", { due_date: "2026-10-14" }),
        t("today", { due_date: "2026-10-10" }),
        t("od-b", { due_date: "2026-10-08" }),
        t("od-a", { due_date: "2026-10-01" }),
        t("same1", { due_date: "2026-10-14" }),
      ],
      now,
      tz,
    );
    expect(sorted.map((x) => x.id)).toEqual(["od-a", "od-b", "today", "n7", "same1", "later", "done"]);
  });
});
