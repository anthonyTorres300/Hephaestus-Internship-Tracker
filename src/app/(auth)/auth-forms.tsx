"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordField, CheckboxField, FormAlert, SubmitButton, TextField, type FormState } from "@/components/forms/fields";
import { forgotPasswordAction, loginAction, resendVerificationAction, resetPasswordAction, signUpAction } from "./actions";

const init: FormState = {};

export function LoginForm({ next, linkError, deleted }: { next?: string; linkError?: boolean; deleted?: boolean }) {
  const [state, action] = useActionState(loginAction, init);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          {linkError ? <FormAlert state={{ status: "error", message: "That link is invalid or has expired. Request a new one." }} /> : null}
          {deleted ? (
            <FormAlert
              state={{ status: "ok", message: "Deletion requested. Your data is no longer accessible. Log in again to see progress." }}
            />
          ) : null}
          <FormAlert state={state} />
          <input type="hidden" name="next" value={next ?? ""} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required state={state} />
          <PasswordField label="Password" name="password" autoComplete="current-password" required state={state} />
          <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
          <div className="flex justify-between text-sm">
            <Link href="/forgot-password" className="underline">
              Forgot password?
            </Link>
            <Link href="/signup" className="underline">
              Create account
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignupForm({ open }: { open: boolean }) {
  const [state, action] = useActionState(signUpAction, init);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          {open
            ? "Your workspace is private to you. You will verify your email before you start."
            : "Registration is currently limited to invited testers."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <FormAlert state={state} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required state={state} disabled={!open} />
          <PasswordField
            label="Password"
            name="password"

            autoComplete="new-password"
            required
            minLength={10}
            hint="At least 10 characters."
            state={state}
            disabled={!open}
          />
          <CheckboxField
            name="terms"
            required
            label="I accept the Terms and Privacy Policy."
            hint="Links open the full documents in the footer."
          />
          <SubmitButton pendingText="Creating…" disabled={!open}>
            Create account
          </SubmitButton>
          <p className="text-sm">
            Already registered?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, init);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>We will email a link if the account exists.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <FormAlert state={state} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required state={state} />
          <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
          <Link href="/login" className="text-sm underline">
            Back to log in
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}

export function ResendForm({ email }: { email?: string }) {
  const [state, action] = useActionState(resendVerificationAction, init);
  return (
    <form action={action} className="grid gap-4">
      <FormAlert state={state} />
      <TextField label="Email" name="email" type="email" autoComplete="email" defaultValue={email} required state={state} />
      <SubmitButton pendingText="Sending…">Resend verification email</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(resetPasswordAction, init);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <FormAlert state={state} />
          <PasswordField
            label="New password"
            name="password"

            autoComplete="new-password"
            required
            minLength={10}
            state={state}
          />
          <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" required state={state} />
          <SubmitButton pendingText="Updating…">Update password</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
