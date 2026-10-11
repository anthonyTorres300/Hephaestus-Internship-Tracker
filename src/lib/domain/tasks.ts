import { DateTime } from "luxon";
import { addDays, localDateIn } from "./dates";

export type TaskClass = "overdue" | "today" | "next7" | "later" | "closed";

export interface TaskLike {
  state: "pending" | "completed" | "dismissed";
  due_date: string | null;
  due_at: string | null;
}

export function classifyTask(task: TaskLike, now: Date, tz: string): TaskClass {
  if (task.state !== "pending") return "closed";
  const today = localDateIn(now, tz);
  let localDue: string;
  if (task.due_at) {
    const instant = DateTime.fromISO(task.due_at, { setZone: true });
    if (!instant.isValid) return "later";
    if (instant.toMillis() < now.getTime()) return "overdue";
    localDue = instant.setZone(tz).toISODate()!;
  } else if (task.due_date) {
    localDue = task.due_date;
    if (localDue < today) return "overdue";
  } else {
    return "later";
  }
  if (localDue === today) return "today";
  return localDue <= addDays(today, 7) ? "next7" : "later";
}

const ORDER: Record<TaskClass, number> = { overdue: 0, today: 1, next7: 2, later: 3, closed: 4 };

function dueMillis(task: TaskLike, tz: string): number {
  if (task.due_at) return DateTime.fromISO(task.due_at).toMillis();
  if (task.due_date) return DateTime.fromISO(task.due_date, { zone: tz }).toMillis();
  return Number.POSITIVE_INFINITY;
}

export function sortTasks<T extends TaskLike>(tasks: readonly T[], now: Date, tz: string): T[] {
  return tasks
    .map((t) => ({ t, c: ORDER[classifyTask(t, now, tz)], d: dueMillis(t, tz) }))
    .sort((a, b) => a.c - b.c || (a.d === b.d ? 0 : a.d < b.d ? -1 : 1))
    .map((x) => x.t);
}
