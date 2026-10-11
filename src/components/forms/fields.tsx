"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FormState = {
  status?: "idle" | "ok" | "error";
  message?: string;
  fields?: Record<string, string[]>;
  values?: Record<string, string>;
};

export function SubmitButton({
  children,
  pendingText = "Saving…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormAlert({ state }: { state: FormState | undefined }) {
  if (!state?.message) return null;
  const ok = state.status === "ok";
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        ok
          ? "border-emerald-600/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{state.message}</span>
    </div>
  );
}

export function Field({
  label,
  name,
  state,
  hint,
  className,
  children,
  required,
}: {
  label: string;
  name: string;
  state?: FormState;
  hint?: string;
  className?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  const err = state?.fields?.[name]?.[0];
  const id = `f-${name}`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !err ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {err ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">
          {err}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  state,
  hint,
  required,
  className,
  ...input
}: { label: string; name: string; state?: FormState; hint?: string; className?: string } & Omit<React.ComponentProps<"input">, "name">) {
  const err = state?.fields?.[name]?.[0];
  return (
    <Field label={label} name={name} state={state} hint={hint} required={required} className={className}>
      <Input
        id={`f-${name}`}
        name={name}
        required={required}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `f-${name}-err` : hint ? `f-${name}-hint` : undefined}
        defaultValue={state?.values?.[name] ?? (input.defaultValue as string | undefined)}
        {...input}
      />
    </Field>
  );
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(function NativeSelect(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
});

export function SelectField({
  label,
  name,
  state,
  options,
  hint,
  required,
  className,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  state?: FormState;
  hint?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  const err = state?.fields?.[name]?.[0];
  return (
    <Field label={label} name={name} state={state} hint={hint} required={required} className={className}>
      <NativeSelect
        id={`f-${name}`}
        name={name}
        required={required}
        defaultValue={state?.values?.[name] ?? defaultValue ?? ""}
        aria-invalid={err ? true : undefined}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  hint,
  required,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={`f-${name}`}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        required={required}
        className="mt-1 size-4 rounded border-input accent-primary"
      />
      <div className="grid gap-0.5">
        <Label htmlFor={`f-${name}`} className="font-normal">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function PasswordField({
  label,
  name,
  state,
  hint,
  required,
  className,
  ...input
}: { label: string; name: string; state?: FormState; hint?: string; className?: string } & Omit<
  React.ComponentProps<"input">,
  "name" | "type"
>) {
  const [shown, setShown] = React.useState(false);
  const err = state?.fields?.[name]?.[0];
  return (
    <Field label={label} name={name} state={state} hint={hint} required={required} className={className}>
      <div className="relative">
        <Input
          id={`f-${name}`}
          name={name}
          type={shown ? "text" : "password"}
          required={required}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `f-${name}-err` : hint ? `f-${name}-hint` : undefined}
          className="pr-10"
          {...input}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </Field>
  );
}
