import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-64" />
        <Spinner className="size-5 text-muted-foreground" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
