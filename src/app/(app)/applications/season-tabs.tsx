"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { createSeasonAction, deleteSeasonAction } from "./actions";

export interface SeasonTabItem {
  key: string;
  label: string;
  n: number;
  href: string;
  /** Set only for empty seasons the user created. */
  remove?: { name: string; year: number };
}

// One row: the target season, the user's own seasons, Unclassified, All history, then "+ New season".
// `newHref` contains the literal token __SEASON__, replaced with the new season's key once it exists.
export function SeasonTabs({
  items,
  current,
  newHref,
  fallbackHref,
  defaultYear,
}: {
  items: SeasonTabItem[];
  current: string;
  newHref: string;
  fallbackHref: string;
  defaultYear: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(defaultYear));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await createSeasonAction({ name, year: Number(year) });
      if (!res.ok) return setError(res.message);
      setOpen(false);
      setName("");
      router.push(newHref.replace("__SEASON__", encodeURIComponent(res.key)));
    } catch {
      setError("Network error. Nothing was created.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: SeasonTabItem) {
    if (!item.remove) return;
    const res = await deleteSeasonAction(item.remove);
    if (!res.ok) return window.alert(res.message ?? "Could not remove the season.");
    if (current === item.key) router.push(fallbackHref);
    else startTransition(() => router.refresh());
  }

  return (
    <>
      {items.map((t) => {
        const active = current === t.key;
        const variant = active ? "default" : "outline";
        return (
          <span key={t.key} className="inline-flex shrink-0">
            <Link
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(buttonVariants({ variant, size: "sm" }), t.remove && "rounded-r-none")}
            >
              {t.label} ({t.n})
            </Link>
            {t.remove ? (
              <button
                type="button"
                onClick={() => remove(t)}
                aria-label={`Remove empty season ${t.label}`}
                title="Remove this empty season"
                className={cn(buttonVariants({ variant, size: "sm" }), "rounded-l-none border-l-0 px-1.5")}
              >
                <X aria-hidden />
              </button>
            ) : null}
          </span>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="shrink-0 border border-dashed border-primary/50 text-primary hover:text-primary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden /> New season
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>New season</DialogTitle>
              <DialogDescription>
                Give it any name and a year, like “Summer” 2026 or “Co-op” 2027. It gets its own tab, and you can sort applications into it.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div className="grid gap-1.5">
                <Label htmlFor="ns-name">Name</Label>
                <Input id="ns-name" value={name} maxLength={30} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Summer" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ns-year">Year</Label>
                <Input id="ns-year" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? (
                  <>
                    <Spinner /> Creating…
                  </>
                ) : (
                  "Create season"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
