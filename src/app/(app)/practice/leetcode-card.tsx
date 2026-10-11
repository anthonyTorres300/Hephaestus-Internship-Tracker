import { ExternalLink } from "@/components/shared/external-link";
import { PieBreakdown } from "@/components/charts/pie-breakdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { topWithOther } from "@/lib/ui/chart-colors";
import type { LeetCodeResult } from "@/lib/leetcode/client";
import { DIFFICULTY_COLORS } from "@/lib/leetcode/view";
import { fmtDate } from "@/lib/ui/format";
import { LeetCodeConnectForm, LeetCodeDisconnectButton } from "./leetcode-forms";
import { ContestLine } from "./leetcode-charts";
import { ActivityHeatmap } from "./leetcode-heatmap";

const LABEL = "text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase";
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));

export function LeetCodeCard({ username, result, tz }: { username: string | null; result: LeetCodeResult | null; tz: string }) {
  if (!username) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>LeetCode</CardTitle>
          <CardDescription>
            Connect your username to see solved totals, an activity heatmap, topics, languages and contest rating. Only your public profile
            is read, never a password or cookie.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <LeetCodeConnectForm />
        </CardContent>
      </Card>
    );
  }

  if (!result?.ok) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>LeetCode · {username}</CardTitle>
          <CardDescription>
            {result?.reason === "not_found"
              ? "LeetCode has no public profile with this username any more."
              : "LeetCode did not respond just now. Reload in a minute; nothing is lost."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeetCodeDisconnectButton />
        </CardContent>
      </Card>
    );
  }

  const p = result.profile;
  const difficulty = [
    {
      name: "Easy",
      value: p.solved.easy,
      color: DIFFICULTY_COLORS.easy,
      detail: `/ ${num(p.available.easy)} · ${pct(p.solved.easy, p.available.easy)}`,
    },
    {
      name: "Medium",
      value: p.solved.medium,
      color: DIFFICULTY_COLORS.medium,
      detail: `/ ${num(p.available.medium)} · ${pct(p.solved.medium, p.available.medium)}`,
    },
    {
      name: "Hard",
      value: p.solved.hard,
      color: DIFFICULTY_COLORS.hard,
      detail: `/ ${num(p.available.hard)} · ${pct(p.solved.hard, p.available.hard)}`,
    },
  ];
  const figures = [
    {
      label: "Acceptance",
      value: pct(p.submissions.accepted, p.submissions.total),
      hint: `${num(p.submissions.accepted)} accepted of ${num(p.submissions.total)} submissions`,
    },
    { label: "Active days", value: p.activeDays ? num(p.activeDays) : "—", hint: "Days with a submission in the last year" },
    { label: "Streak", value: p.streak ? `${p.streak}d` : "—", hint: "Current consecutive days with a submission" },
    { label: "Global rank", value: num(p.ranking), hint: "LeetCode global ranking" },
    {
      label: "Contest",
      value: p.contest?.rating ? String(Math.round(p.contest.rating)) : "—",
      hint: p.contest ? `${p.contest.attended} contests attended` : "No contests yet",
    },
    { label: "Badges", value: String(p.badges.length), hint: p.badges.join(", ") || "No badges yet" },
  ];
  const topics = topWithOther(
    p.tags.map((t) => ({ name: t.name, value: t.count })),
    5,
  );
  const languages = topWithOther(
    p.languages.map((l) => ({ name: l.name, value: l.count })),
    4,
  );
  const hasContest = !!p.contest && p.contest.history.length > 1;

  return (
    <section aria-label="LeetCode insights" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl">LeetCode</h2>
        <div className="flex items-center gap-3 text-sm">
          <ExternalLink href={`https://leetcode.com/u/${p.username}/`}>{p.username}</ExternalLink>
          <LeetCodeDisconnectButton />
        </div>
      </div>

      <Card size="sm">
        <CardContent className="grid items-center gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
          <PieBreakdown title="Solved by difficulty" data={difficulty} size={128} centerValue={p.solved.all} centerLabel="solved" />
          <div className="grid gap-4">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-4">
              {figures.map((f) => (
                <div key={f.label} className="grid gap-0.5" title={f.hint}>
                  <dt className={LABEL}>{f.label}</dt>
                  <dd className="text-2xl font-light tracking-tight tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
            {p.badges.length ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Badges">
                {p.badges.map((b) => (
                  <li key={b} className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs text-primary ring-1 ring-primary/30">
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent>
          {p.calendar.length ? (
            <ActivityHeatmap calendar={p.calendar} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No submissions in the last year, or LeetCode is not sharing the activity calendar for this profile.
            </p>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="grid gap-6 md:grid-cols-2 md:divide-x md:divide-white/10">
          <div className="grid gap-3">
            <h3 className={LABEL}>Top topics</h3>
            <PieBreakdown title="Problems solved by topic" data={topics} size={112} empty="No topic data yet" />
          </div>
          <div className="grid gap-3 md:pl-6">
            <h3 className={LABEL}>Languages</h3>
            <PieBreakdown title="Problems solved by language" data={languages} size={112} empty="No language data yet" />
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className={hasContest ? "grid gap-6 md:grid-cols-2 md:divide-x md:divide-white/10" : undefined}>
          {hasContest ? (
            <div className="grid min-w-0 gap-3">
              <h3 className={LABEL}>
                Contest rating{" "}
                <span className="font-normal tracking-normal normal-case">
                  · {p.contest!.attended} contests{p.contest!.topPercentage != null ? ` · top ${p.contest!.topPercentage}%` : ""}
                </span>
              </h3>
              <ContestLine data={p.contest!.history} />
            </div>
          ) : null}
          <div className={hasContest ? "grid min-w-0 content-start gap-3 md:pl-6" : "grid gap-3"}>
            <h3 className={LABEL}>Recent accepted</h3>
            {p.recent.length ? (
              <ul className="grid gap-1.5 text-sm">
                {p.recent.slice(0, 6).map((r, i) => (
                  <li key={`${r.slug}-${i}`} className="flex items-center justify-between gap-3">
                    <ExternalLink href={`https://leetcode.com/problems/${r.slug}/`}>{r.title}</ExternalLink>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(r.at, tz)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent accepted submissions are public.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        From LeetCode&apos;s public profile, refreshed every few minutes. Unofficial, so it may stop working. Not mixed into your manual
        log.
      </p>
    </section>
  );
}
