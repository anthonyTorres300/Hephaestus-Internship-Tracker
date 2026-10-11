"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, TextField, type FormState } from "@/components/forms/fields";
import { saveLeetCodeAction } from "./actions";

export function LeetCodeConnectForm() {
  const [state, action] = useActionState<FormState, FormData>(saveLeetCodeAction, {});
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <TextField
        label="LeetCode username"
        name="username"
        state={state}
        required
        maxLength={30}
        autoComplete="off"
        placeholder="e.g. neetcode"
        hint="Your public profile name, from leetcode.com/u/<username>. No password needed."
      />
      <div>
        <SubmitButton size="sm" pendingText="Connecting…">
          Connect
        </SubmitButton>
      </div>
    </form>
  );
}

export function LeetCodeDisconnectButton() {
  const [state, action] = useActionState<FormState, FormData>(saveLeetCodeAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="username" value="" />
      <SubmitButton size="sm" variant="ghost" pendingText="…">
        Disconnect
      </SubmitButton>
      {state.status === "error" ? (
        <span role="alert" className="text-xs text-destructive">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
