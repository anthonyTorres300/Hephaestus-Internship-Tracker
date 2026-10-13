"use client";

import { QuickActions } from "./quick-actions";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/forms/fields";
import { CompanyLogo } from "@/components/shared/company-logo";
import { StatusBadge } from "@/components/shared/status-badge";
import { STATUSES, STATUS_LABEL, canMoveTo, isSubmittedStatus, type Status } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { bulkUpdateAction, type BulkInput } from "./actions";

export interface ListApp {
  id: string;
  revision: number;
  portal?: string | null;
  status: Status;
  company_name: string;
  url?: string | null;
  role_title: string;
  priority: string;
  sub: string;
  seasonText: string;
}

function SortHead({
  label,
  k,
  sort,
  dir,
  hrefs,
  className,
}: {
  label: string;
  k: string;
  sort: string;
  dir: string;
  hrefs: Record<string, string>;
  className?: string;
}) {
  const on = sort === k;
  const Icon = !on ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={hrefs[k]}
        scroll={false}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground",
          on ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !on && "opacity-50")} aria-hidden />
      </Link>
    </TableHead>
  );
}

export function ApplicationsList({
  apps,
  today,
  seasons,
  canBulk,
  sort,
  dir,
  sortHrefs,
}: {
  apps: ListApp[];
  today: string;
  /** Every season the user can pick: the target season plus their own. */
  seasons: { key: string; label: string }[];
  canBulk: boolean;
  sort: string;
  dir: string;
  sortHrefs: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ name: "", year: String(new Date().getFullYear() + 1) });
  const [dialog, setDialog] = useState<{ to: Status; needsSubmission: boolean; needsReason: boolean } | null>(null);
  const [form, setForm] = useState({ reason: "", attested: false, dateKnown: "unknown", day: "", month: "" });

  const chosen = useMemo(() => apps.filter((a) => selected.has(a.id)), [apps, selected]);
  const allOn = apps.length > 0 && chosen.length === apps.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(apps.map((a) => a.id)));

  async function run(input: Omit<BulkInput, "ids">) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await bulkUpdateAction({ ids: chosen.map((a) => a.id), ...input });
      if (!res.ok) {
        setMsg({ kind: "error", text: res.message });
        return false;
      }
      setMsg({ kind: res.failed ? "error" : "ok", text: res.message });
      setSelected(new Set());
      startTransition(() => router.refresh());
      return true;
    } catch {
      setMsg({ kind: "error", text: "Network error. Nothing was changed." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function chooseStatus(to: Status) {
    const needsSubmission = isSubmittedStatus(to) && chosen.some((a) => !isSubmittedStatus(a.status));
    const needsReason = chosen.some((a) => {
      const c = canMoveTo(a.status, to);
      return !c.ok && c.reason === "reason_required";
    });
    if (needsSubmission || needsReason) {
      setForm({ reason: "", attested: false, dateKnown: "unknown", day: "", month: "" });
      setDialog({ to, needsSubmission, needsReason });
      return;
    }
    void run({ set: "status", value: to });
  }

  async function confirmDialog() {
    if (!dialog) return;
    if (dialog.needsSubmission && !form.attested) return setMsg({ kind: "error", text: "Confirm that you submitted these applications." });
    if (dialog.needsSubmission && form.dateKnown === "day" && !form.day)
      return setMsg({ kind: "error", text: "Choose the submission date." });
    if (dialog.needsSubmission && form.dateKnown === "month" && !form.month)
      return setMsg({ kind: "error", text: "Choose the submission month." });
    if (dialog.needsReason && !form.reason.trim())
      return setMsg({ kind: "error", text: "A reason is required to reopen closed applications." });
    const ok = await run({
      set: "status",
      value: dialog.to,
      reason: form.reason,
      attested: form.attested,
      date_known: form.dateKnown,
      submitted_day: form.day || undefined,
      submitted_month: form.month || undefined,
    });
    if (ok) setDialog(null);
  }

  function chooseSeason(v: string) {
    if (v === "none") void run({ set: "season", value: "none" });
    else if (v === "custom") setCustomOpen(true);
    else {
      const i = v.lastIndexOf(":");
      const [season, year] = [v.slice(0, i), v.slice(i + 1)];
      void run({ set: "season", value: season, year: Number(year) });
    }
  }

  // While anything is selected, clicking a row toggles it instead of opening it, so a near-miss never navigates away.
  const rowClick = (id: string) => (e: React.MouseEvent) => {
    if (selected.size === 0) return;
    e.preventDefault();
    toggle(id);
  };

  const check = (a: ListApp) =>
    canBulk ? (
      <label className="relative z-10 flex cursor-pointer items-center justify-center self-stretch p-3 -m-3">
        <input
          type="checkbox"
          className="size-5 cursor-pointer accent-primary"
          checked={selected.has(a.id)}
          onChange={() => toggle(a.id)}
          aria-label={`Select ${a.company_name} – ${a.role_title}`}
        />
      </label>
    ) : null;

  return (
    <>
      <div aria-live="polite">
        {msg ? (
          <p
            role={msg.kind === "error" ? "alert" : "status"}
            className={cn(
              "mb-3 rounded-md border p-3 text-sm",
              msg.kind === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
            )}
          >
            {msg.text}
          </p>
        ) : null}
      </div>

      {canBulk && chosen.length === 0 && apps.length > 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Tick the boxes to change status, priority or season for many applications at once.
        </p>
      ) : null}

      {canBulk && chosen.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-16 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-card p-3 ring-1 ring-primary/50"
        >
          <span className="mr-1 flex items-center gap-2 text-sm font-medium">
            {busy ? <Spinner /> : null}
            {chosen.length} selected
          </span>
          <NativeSelect
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && chooseStatus(e.target.value as Status)}
            aria-label="Set status"
            className="h-8 w-36 text-xs"
          >
            <option value="">Set status…</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && void run({ set: "priority", value: e.target.value })}
            aria-label="Set priority"
            className="h-8 w-32 text-xs"
          >
            <option value="">Set priority…</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </NativeSelect>
          <NativeSelect
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && chooseSeason(e.target.value)}
            aria-label="Set season"
            className="h-8 w-36 text-xs"
          >
            <option value="">Set season…</option>
            {seasons.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
            <option value="custom">+ New season…</option>
            <option value="none">Unclassified</option>
          </NativeSelect>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ set: "archive" })}>
            Archive
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => run({ set: "trash" })}>
            Trash
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(new Set())} className="ml-auto">
            Clear
          </Button>
        </div>
      ) : null}

      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  {canBulk ? (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={allOn}
                        onChange={toggleAll}
                        aria-label="Select all on this page"
                      />
                    </TableHead>
                  ) : null}
                  <SortHead className="w-[20%]" label="Company" k="company_name" sort={sort} dir={dir} hrefs={sortHrefs} />
                  <TableHead className="w-[26%]">Role</TableHead>
                  <SortHead className="w-[24%]" label="Status" k="status" sort={sort} dir={dir} hrefs={sortHrefs} />
                  <SortHead className="w-[16%]" label="Submitted" k="submitted_key" sort={sort} dir={dir} hrefs={sortHrefs} />
                  <SortHead
                    className="hidden xl:table-cell w-[10%]"
                    label="Priority"
                    k="priority"
                    sort={sort}
                    dir={dir}
                    hrefs={sortHrefs}
                  />
                  <TableHead className="hidden xl:table-cell w-[12%]">Season</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id} className={cn("relative cursor-pointer", selected.has(a.id) && "bg-primary/5")}>
                    {canBulk ? (
                      <TableCell className="w-12 p-0">
                        <div className="flex p-3">{check(a)}</div>
                      </TableCell>
                    ) : null}
                    <TableCell className="font-medium whitespace-normal break-words">
                      <Link
                        className="flex items-center gap-3 underline-offset-2 outline-none  hover:underline focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                        href={`/applications/${a.id}`}
                        onClick={rowClick(a.id)}
                      >
                        <CompanyLogo company={a.company_name} applyUrl={a.url} size="xs" />
                        {a.company_name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal break-words">{a.role_title}</TableCell>
                    <TableCell>
                      {canBulk ? (
                        <QuickActions
                          id={a.id}
                          revision={a.revision}
                          status={a.status}
                          company={a.company_name}
                          portal={a.portal}
                          today={today}
                        />
                      ) : (
                        <StatusBadge status={a.status} />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">{a.sub}</TableCell>
                    <TableCell className="hidden xl:table-cell capitalize">{a.priority}</TableCell>
                    <TableCell className="hidden xl:table-cell whitespace-normal">{a.seasonText}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden">
        <label className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          Sort by
          <NativeSelect
            value={`${sort}:${dir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              router.push(sortHrefs[k].replace(/dir=(asc|desc)/, `dir=${d}`));
            }}
            className="h-8 w-52 text-xs"
          >
            {[
              ["company_name", "Company"],
              ["status", "Status"],
              ["submitted_key", "Date submitted"],
              ["priority", "Priority"],
            ].flatMap(([k, l]) => [
              <option key={`${k}:asc`} value={`${k}:asc`}>
                {l} ↑
              </option>,
              <option key={`${k}:desc`} value={`${k}:desc`}>
                {l} ↓
              </option>,
            ])}
          </NativeSelect>
        </label>
        {canBulk ? (
          <label className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="size-4 accent-primary" checked={allOn} onChange={toggleAll} />
            Select all on this page
          </label>
        ) : null}
        <ul className="grid gap-3">
          {apps.map((a) => (
            <li
              key={a.id}
              className={cn(
                "relative grid grid-cols-[auto_1fr] items-start gap-3 rounded-lg bg-card border p-4",
                selected.has(a.id) && "border-primary/60 bg-primary/5",
              )}
            >
              {check(a)}
              <Link
                href={`/applications/${a.id}`}
                onClick={rowClick(a.id)}
                className="grid min-w-0 flex-1 gap-1 outline-none  focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                <span className="flex items-center gap-2 font-medium">
                  <CompanyLogo company={a.company_name} applyUrl={a.url} size="xs" />
                  {a.company_name}
                </span>
                <span className="text-sm">{a.role_title}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {!canBulk ? <StatusBadge status={a.status} /> : null} {a.sub} · <span className="capitalize">{a.priority}</span> priority
                </span>
              </Link>
              {canBulk ? (
                <div className="col-span-2">
                  <QuickActions
                    id={a.id}
                    revision={a.revision}
                    status={a.status}
                    company={a.company_name}
                    portal={a.portal}
                    today={today}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={customOpen} onOpenChange={(o) => !busy && setCustomOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {chosen.length} application{chosen.length === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>Use any name, such as “Co-op” or “Spring semester”, plus a year.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cs-name">Season name</Label>
              <Input
                id="cs-name"
                value={custom.name}
                maxLength={30}
                onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                placeholder="Co-op"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cs-year">Year</Label>
              <Input
                id="cs-year"
                type="number"
                min={2000}
                max={2100}
                value={custom.year}
                onChange={(e) => setCustom({ ...custom, year: e.target.value })}
              />
            </div>
          </div>
          {msg?.kind === "error" ? (
            <p role="alert" className="text-xs text-destructive">
              {msg.text}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || !custom.name.trim()}
              onClick={async () => {
                if (await run({ set: "season", value: custom.name, year: Number(custom.year) })) setCustomOpen(false);
              }}
            >
              {busy ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && !busy && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {chosen.length} application{chosen.length === 1 ? "" : "s"} to {dialog ? STATUS_LABEL[dialog.to] : ""}
            </DialogTitle>
            <DialogDescription>
              {dialog?.needsSubmission
                ? "Moving past Prepared means you submitted these applications. Confirm, and give one date for all of them (or mark it unknown)."
                : "Reopening closed applications needs a reason for the timeline. Applications that cannot make this move are skipped."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {dialog?.needsSubmission ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="bk-known">Date is known as</Label>
                  <NativeSelect id="bk-known" value={form.dateKnown} onChange={(e) => setForm({ ...form, dateKnown: e.target.value })}>
                    <option value="unknown">Unknown</option>
                    <option value="day">An exact day</option>
                    <option value="month">Month only</option>
                  </NativeSelect>
                </div>
                {form.dateKnown === "day" ? (
                  <Input
                    type="date"
                    aria-label="Submitted on"
                    value={form.day}
                    onChange={(e) => setForm({ ...form, day: e.target.value })}
                  />
                ) : null}
                {form.dateKnown === "month" ? (
                  <Input
                    type="month"
                    aria-label="Submitted in"
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: e.target.value })}
                  />
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={form.attested}
                    onChange={(e) => setForm({ ...form, attested: e.target.checked })}
                  />
                  I confirm I submitted these applications.
                </label>
              </>
            ) : null}
            {dialog?.needsReason ? (
              <div className="grid gap-1.5">
                <Label htmlFor="bk-reason">Reason</Label>
                <Input
                  id="bk-reason"
                  value={form.reason}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. They reopened the roles"
                />
              </div>
            ) : null}
            {msg?.kind === "error" ? (
              <p role="alert" className="text-xs text-destructive">
                {msg.text}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirmDialog} disabled={busy}>
              {busy ? (
                <>
                  <Spinner /> Moving…
                </>
              ) : (
                "Move"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
