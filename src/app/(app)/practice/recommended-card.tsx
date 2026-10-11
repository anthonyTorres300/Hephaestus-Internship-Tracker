import Link from "next/link";
import { ExternalLink } from "@/components/shared/external-link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TOPIC_TITLES } from "@/lib/leetcode/catalog";
import type { Recommendation } from "@/lib/leetcode/recommend";
import { DIFFICULTY_COLORS } from "@/lib/leetcode/view";

const LABEL = "text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase";

export function RecommendedCard({ recs, connected }: { recs: Recommendation[]; connected: boolean }) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={LABEL}>Recommended next</h2>
          <p className="text-xs text-muted-foreground">
            {connected
              ? "Based on your practice log and LeetCode profile."
              : "Based on your practice log. Connect LeetCode below for sharper picks."}
          </p>
        </div>

        {recs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have covered everything on the curated list at your level. Log a few attempts or widen your difficulty and check back.
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {recs.map((r) => (
              <li key={r.problem.slug} className="flex items-start justify-between gap-3 rounded-md bg-white/5 p-3">
                <div className="grid min-w-0 gap-1 text-sm">
                  <ExternalLink href={`https://leetcode.com/problems/${r.problem.slug}/`}>{r.problem.title}</ExternalLink>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="size-2 rounded-sm" style={{ background: DIFFICULTY_COLORS[r.problem.difficulty] }} />
                      <span className="capitalize">{r.problem.difficulty}</span>
                    </span>
                    <span>{TOPIC_TITLES[r.problem.topic]}</span>
                  </p>
                  <p className="text-xs text-foreground/70">{r.reason}</p>
                </div>
                <Link
                  href={`/practice?log=${r.problem.slug}`}
                  scroll={false}
                  aria-label={`Log an attempt for ${r.problem.title}`}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}
                >
                  Log
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
