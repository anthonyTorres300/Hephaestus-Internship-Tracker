import { Loader2 } from "lucide-react";
import { cn } from "cn";

/** Small inline loading indicator. Decorative unless `label` is given. */
function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex">
      <Loader2 aria-hidden className={cn("size-4 animate-spin", className)} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export { Spinner };
