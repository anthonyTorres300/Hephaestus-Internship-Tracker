"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormAlert, PasswordField, TextField, type FormState } from "@/components/forms/fields";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/forms/fields";
import { saveNameAction } from "../actions";

export function PasswordResetButton({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <input type="hidden" name="email" value={email} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Sending…" : "Email me a reset link"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: fd.get("password"), confirm: fd.get("confirm") }),
      });
      if (res.status === 202) {
        router.push("/login?deleted=1");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setState({ status: "error", message: body?.error?.message ?? "Could not start deletion." });
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="grid max-w-sm gap-3">
      <FormAlert state={state} />
      <PasswordField label="Re-enter your password" name="password" autoComplete="current-password" required />
      <TextField label="Type DELETE to confirm" name="confirm" required pattern="DELETE" autoComplete="off" />
      <div>
        <Button type="submit" variant="destructive" disabled={busy}>
          {busy ? "Requesting…" : "Delete my account"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        After you confirm you will be signed out everywhere. Log in again any time to see deletion progress.
      </p>
    </form>
  );
}

export function NameForm({ initial }: { initial: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveNameAction, {});
  return (
    <form action={action} className="grid max-w-sm gap-3">
      <FormAlert state={state} />
      <TextField
        label="Your name"
        name="name"
        state={state}
        defaultValue={initial}
        maxLength={40}
        autoComplete="given-name"
        hint="Shown in the greeting and the top bar. Only you see it."
      />
      <div>
        <SubmitButton size="sm" pendingText="Saving…">
          Save name
        </SubmitButton>
      </div>
    </form>
  );
}
