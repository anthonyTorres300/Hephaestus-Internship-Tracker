import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function AdminNav({ active }: { active: "sources" | "runs" | "users" }) {
  return (
    <nav aria-label="Admin sections" className="mb-6 flex gap-2">
      {(["sources", "runs", "users"] as const).map((s) => (
        <Link
          key={s}
          href={`/admin/${s}`}
          aria-current={active === s ? "page" : undefined}
          className={buttonVariants({ variant: active === s ? "default" : "outline", size: "sm" })}
        >
          {s[0].toUpperCase() + s.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
