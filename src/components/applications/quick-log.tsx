"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ApplicationForm, type FormInitial, type SeasonOption } from "@/app/(app)/applications/application-form";
import { confirmSubmissionAction } from "@/app/(app)/applications/actions";
import { FormAlert, SubmitButton, TextField, CheckboxField } from "@/components/forms/fields";
import { useActionState } from "react";
import { localDateIn } from "@/lib/domain/dates";
import type { ApplyIntent, ApplicationSaveState } from "@/lib/applications/types";
import { FollowUpShortcuts } from "./follow-up-shortcuts";
const QuickLogContext = createContext<{ open: (initial?: FormInitial) => void; track: (intent: ApplyIntent) => void } | null>(null);
export const useQuickLog = () => useContext(QuickLogContext);

export function QuickLogButton() {
  const workflow = useQuickLog();
  return workflow ? (
    <Button size="sm" variant="outline" className="ml-auto md:ml-0" onClick={() => workflow.open()} aria-label="Quick log application">
      <Plus aria-hidden />
      <span>Quick Log</span>
    </Button>
  ) : null;
}
function ConfirmExisting({ intent, today, onSaved }: { intent: ApplyIntent; today: string; onSaved: () => void }) {
  const [idem] = useState(() => crypto.randomUUID());
  const [state, action] = useActionState<ApplicationSaveState, FormData>(confirmSubmissionAction, {});
  useEffect(() => {
    if (state.applicationId) onSaved();
  }, [state.applicationId, onSaved]);
  return state.applicationId ? (
    <div className="grid gap-3">
      <FormAlert state={state} />
      <FollowUpShortcuts applicationId={state.applicationId} today={today} />
    </div>
  ) : (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <input type="hidden" name="application_id" value={intent.applicationId} />
      <input type="hidden" name="idem" value={idem} />
      <TextField label="Submitted on" name="submitted_day" type="date" defaultValue={today} required />
      <CheckboxField label="I submitted this application." name="attested" required />
      <SubmitButton>Record submission</SubmitButton>
    </form>
  );
}
export function QuickLogProvider({
  children,
  userId,
  timezone,
  season,
  year,
  seasons,
  saveAction,
}: {
  children: ReactNode;
  userId: string;
  timezone: string;
  season: string;
  year: number;
  seasons: SeasonOption[];
  saveAction?: (state: ApplicationSaveState, fd: FormData) => Promise<ApplicationSaveState>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<FormInitial>();
  const [epoch, setEpoch] = useState(0);
  const [returned, setReturned] = useState<ApplyIntent | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const pending = useRef<(ApplyIntent & { left: boolean; createdAt: number }) | null>(null);
  const key = `application-return:v1:${userId}`;
  const start = useCallback(
    (values?: FormInitial) => {
      const [y, m, d] = localDateIn(new Date(), timezone).split("-").map(Number);
      setInitial({
        status: "applied",
        submitted_precision: "day",
        submitted_year: y,
        submitted_month: m,
        submitted_day: d,
        season,
        season_year: year,
        ...values,
      });
      setEpoch((value) => value + 1);
      setOpen(true);
    },
    [timezone, season, year],
  );
  const track = useCallback(
    (intent: ApplyIntent) => {
      pending.current = { ...intent, left: false, createdAt: Date.now() };
      try {
        sessionStorage.setItem(key, JSON.stringify(pending.current));
      } catch {}
    },
    [key],
  );
  function dismissReturn() {
    pending.current = null;
    try {
      sessionStorage.removeItem(key);
    } catch {}
    setReturned(null);
    setConfirmed(false);
  }
  useEffect(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (
        raw &&
        typeof raw.application_url === "string" &&
        /^https?:\/\//.test(raw.application_url) &&
        Date.now() - raw.createdAt < 86400000
      )
        pending.current = raw;
    } catch {}
    const leave = () => {
      if (pending.current) {
        pending.current.left = true;
        try {
          sessionStorage.setItem(key, JSON.stringify(pending.current));
        } catch {}
      }
    };
    const back = () => {
      if (pending.current?.left && !document.querySelector('[role="dialog"]')) {
        setConfirmed(false);
        setReturned(pending.current);
      }
    };
    const visibility = () => (document.visibilityState === "hidden" ? leave() : back());
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", visibility);
    if (pending.current?.left) back();
    const observer = new MutationObserver(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) back();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [key]);
  const refresh = useCallback(() => router.refresh(), [router]);
  return (
    <QuickLogContext.Provider value={{ open: start, track }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quick Log</DialogTitle>
            <DialogDescription>Log an application here. Applied today is the default; review the details before saving.</DialogDescription>
          </DialogHeader>
          <ApplicationForm
            key={epoch}
            mode="create"
            saveAction={saveAction}
            initial={initial}
            draftScope={userId}
            compact
            timezone={timezone}
            seasons={seasons}
            defaultYear={year}
            onSaved={(_, fields) => {
              if (
                !pending.current ||
                !(
                  (fields?.job_id && fields.job_id === pending.current.job_id) ||
                  fields?.application_url === pending.current.application_url
                )
              )
                return;
              pending.current = null;
              try {
                sessionStorage.removeItem(key);
              } catch {}
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!returned}
        onOpenChange={(next) => {
          if (!next) dismissReturn();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Did you submit?</DialogTitle>
            <DialogDescription>
              You returned from {returned?.company_name ?? "the employer's application page"}
              {returned?.role_title ? ` · ${returned.role_title}` : ""}.
            </DialogDescription>
          </DialogHeader>
          {returned?.applicationId && confirmed ? (
            <ConfirmExisting intent={returned} today={localDateIn(new Date(), timezone)} onSaved={refresh} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Confirm submission to update your tracker.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    if (!returned) return;
                    if (returned.applicationId) setConfirmed(true);
                    else {
                      const values = {
                        company_name: returned.company_name,
                        role_title: returned.role_title,
                        application_url: returned.application_url,
                        job_id: returned.job_id,
                      };
                      dismissReturn();
                      start(values);
                    }
                  }}
                >
                  Yes, I submitted
                </Button>
                <Button variant="outline" onClick={dismissReturn}>
                  Not yet
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </QuickLogContext.Provider>
  );
}
export function ApplyLink({ intent, children, className }: { intent: ApplyIntent; children: ReactNode; className?: string }) {
  const workflow = useQuickLog();
  return (
    <a
      href={intent.application_url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={className}
      onClick={() => workflow?.track(intent)}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
