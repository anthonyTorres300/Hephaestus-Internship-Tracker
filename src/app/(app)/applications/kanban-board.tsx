"use client";

import Link from "next/link";
import { ApplicationDrawer } from "@/components/applications/application-drawer";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/forms/fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { STATUSES, STATUS_LABEL, canMoveTo, isSubmittedStatus, type Status } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { moveStatusAction } from "./actions";

export interface BoardApp {
  id: string;
  revision: number;
  status: Status;
  company_name: string;
  role_title: string;
  priority: string;
  sub: string;
}

interface Pending {
  id: string;
  to: Status;
  needsSubmission: boolean;
  needsReason: boolean;
}

export function KanbanBoard({ apps, truncated }: { apps: BoardApp[]; truncated: boolean }) {
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [cards, setCards] = useState(apps);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ reason: "", attested: false, dateKnown: "day", day: "", month: "" });

  async function commit(id: string, to: Status, extra: Record<string, unknown> = {}) {
    const card = cards.find((c) => c.id === id);
    if (!card) return false;
    const from = card.status;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: to } : c)));
    setBusy(true);
    try {
      const res = await moveStatusAction({ id, revision: card.revision, status: to, idem: crypto.randomUUID(), ...extra });
      if (!res.ok) {
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: from } : c)));
        setMessage({ kind: "error", text: res.message });
        return false;
      }
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: to, revision: res.revision } : c)));
      setMessage({ kind: "ok", text: `${card.company_name} moved to ${STATUS_LABEL[to]}.` });
      return true;
    } catch {
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: from } : c)));
      setMessage({ kind: "error", text: "Network error. The card was put back." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function requestMove(id: string, to: Status) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    const check = canMoveTo(card.status, to);
    if (!check.ok && check.reason === "cannot_unsubmit") {
      setMessage({ kind: "error", text: "A submitted application cannot go back to Saved or Prepared." });
      return;
    }
    const needsSubmission = !isSubmittedStatus(card.status) && isSubmittedStatus(to);
    const needsReason = !check.ok && check.reason === "reason_required";
    if (needsSubmission || needsReason) {
      setForm({ reason: "", attested: false, dateKnown: "day", day: "", month: "" });
      setPending({ id, to, needsSubmission, needsReason });
      return;
    }
    void commit(id, to);
  }

  async function submitPending() {
    if (!pending) return;
    if (pending.needsSubmission && !form.attested)
      return setMessage({ kind: "error", text: "Confirm that you submitted this application." });
    if (pending.needsSubmission && form.dateKnown === "day" && !form.day)
      return setMessage({ kind: "error", text: "Choose the submission date, or mark it unknown." });
    if (pending.needsSubmission && form.dateKnown === "month" && !form.month)
      return setMessage({ kind: "error", text: "Choose the submission month." });
    if (pending.needsReason && !form.reason.trim())
      return setMessage({ kind: "error", text: "A reason is required to reopen an application." });
    const ok = await commit(pending.id, pending.to, {
      reason: form.reason.trim() || undefined,
      attested: form.attested,
      date_known: form.dateKnown,
      submitted_day: form.day || undefined,
      submitted_month: form.month || undefined,
    });
    if (ok) setPending(null);
  }

  const byStatus = (s: Status) => cards.filter((c) => c.status === s);
  const pendingCard = pending ? cards.find((c) => c.id === pending.id) : null;

  return (
    <div className="grid gap-3">
      <ApplicationDrawer key={drawerId ?? "closed"} id={drawerId} onClose={() => setDrawerId(null)} />
      <p className="text-xs text-muted-foreground">
        Drag a card to another column, or use the “Move to” menu on a card. Moves use the same rules as the status form and are saved right
        away.
        {truncated ? " Showing the first 1,000 matches; narrow the filters to see the rest." : ""}
      </p>
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-md border p-3 text-sm",
            message.kind === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
          )}
        >
          {message.text}
        </p>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="flex min-w-max items-start gap-3">
          {STATUSES.map((status) => {
            const list = byStatus(status);
            return (
              <section
                key={status}
                aria-label={`${STATUS_LABEL[status]} column, ${list.length} application${list.length === 1 ? "" : "s"}`}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOver(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === status ? null : o));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  setOver(null);
                  setDragId(null);
                  if (id) requestMove(id, status);
                }}
                className={cn(
                  "shrink-0 rounded-lg bg-card p-3 ring-1 ring-border transition-colors",
                  list.length ? "w-60" : "w-36",
                  over === status && "bg-primary/10 ring-2 ring-primary/60",
                )}
              >
                <header className="mb-3 flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="text-lg font-light tabular-nums">{list.length}</span>
                </header>
                <ul className="grid min-h-16 gap-2">
                  {list.length === 0 ? (
                    <li className="grid h-16 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                      Drop here
                    </li>
                  ) : null}
                  {list.map((c) => (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(c.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={cn(
                        "group relative cursor-grab rounded-md bg-muted/60 p-3 text-sm ring-1 ring-border active:cursor-grabbing",
                        dragId === c.id && "opacity-40",
                      )}
                    >
                      <Link
                        href={`/applications/${c.id}`}
                        onClick={(event) => {
                          if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                            event.preventDefault();
                            setDrawerId(c.id);
                          }
                        }}
                        draggable={false}
                        className="block font-semibold underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                      >
                        {c.company_name}
                      </Link>
                      <p className="text-muted-foreground">{c.role_title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.sub} · <span className="capitalize">{c.priority}</span>
                      </p>
                      <label className="relative z-10 mt-2 grid gap-1 text-xs text-muted-foreground transition-opacity focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                        <span className="sr-only">Move {c.company_name} to</span>
                        <NativeSelect
                          value=""
                          disabled={busy}
                          onChange={(e) => e.target.value && requestMove(c.id, e.target.value as Status)}
                          aria-label={`Move ${c.company_name} to another column`}
                          className="h-7 text-xs"
                        >
                          <option value="">Move to…</option>
                          {STATUSES.filter((s) => s !== c.status).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {pendingCard?.company_name} to {pending ? STATUS_LABEL[pending.to] : ""}
            </DialogTitle>
            <DialogDescription>
              {pending?.needsSubmission
                ? "Moving past Prepared means you submitted this application. Please confirm and give the date."
                : "Reopening a closed application needs a reason for the timeline."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {pending?.needsSubmission ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="kb-known">Date is known as</Label>
                  <NativeSelect id="kb-known" value={form.dateKnown} onChange={(e) => setForm({ ...form, dateKnown: e.target.value })}>
                    <option value="day">An exact day</option>
                    <option value="month">Month only</option>
                    <option value="unknown">Unknown</option>
                  </NativeSelect>
                </div>
                {form.dateKnown === "day" ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="kb-day">Submitted on</Label>
                    <Input id="kb-day" type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
                  </div>
                ) : null}
                {form.dateKnown === "month" ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="kb-month">Submitted in</Label>
                    <Input id="kb-month" type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={form.attested}
                    onChange={(e) => setForm({ ...form, attested: e.target.checked })}
                  />
                  I confirm I submitted this application.
                </label>
              </>
            ) : null}
            {pending?.needsReason ? (
              <div className="grid gap-1.5">
                <Label htmlFor="kb-reason">Reason</Label>
                <Input
                  id="kb-reason"
                  value={form.reason}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. They reopened the role"
                />
              </div>
            ) : null}
            {message?.kind === "error" ? (
              <p role="alert" className="text-xs text-destructive">
                {message.text}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitPending} disabled={busy}>
              {busy ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
