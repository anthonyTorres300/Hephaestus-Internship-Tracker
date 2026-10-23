import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type Status } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TONE: Record<Status, string> = {
  saved: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:bg-slate-400/15 dark:text-slate-200 dark:ring-slate-400/30",
  prepared: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:bg-slate-400/15 dark:text-slate-200 dark:ring-slate-400/30",
  applied: "bg-sky-500/10 text-sky-800 ring-1 ring-sky-600/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/30",
  screening:
    "bg-indigo-500/10 text-indigo-800 ring-1 ring-indigo-600/25 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-400/30",
  assessment:
    "bg-violet-500/10 text-violet-800 ring-1 ring-violet-600/25 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/30",
  interview: "bg-amber-500/10 text-amber-900 ring-1 ring-amber-600/25 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30",
  offer:
    "bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-600/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/30",
  accepted:
    "bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-600/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/30",
  rejected: "bg-rose-500/10 text-rose-800 ring-1 ring-rose-600/25 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-400/30",
  withdrawn: "bg-zinc-500/10 text-zinc-700 ring-1 ring-zinc-500/25 dark:bg-zinc-400/15 dark:text-zinc-200 dark:ring-zinc-400/30",
  ghosted: "bg-zinc-500/10 text-zinc-700 ring-1 ring-zinc-500/25 dark:bg-zinc-400/15 dark:text-zinc-200 dark:ring-zinc-400/30",
};

// Status is always conveyed by its text label; color is supplementary.
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(TONE[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
