import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type Status } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TONE: Record<Status, string> = {
  saved: "bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/30",
  prepared: "bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/30",
  applied: "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30",
  screening: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30",
  assessment: "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30",
  interview: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30",
  offer: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30",
  accepted: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30",
  rejected: "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30",
  withdrawn: "bg-zinc-500/20 text-zinc-200 ring-1 ring-zinc-400/30",
  ghosted: "bg-zinc-500/20 text-zinc-200 ring-1 ring-zinc-400/30",
};

// Status is always conveyed by its text label; color is supplementary.
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(TONE[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
