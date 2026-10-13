"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckboxField, Field, FormAlert, SelectField, SubmitButton, TextField, type FormState } from "@/components/forms/fields";
import { Textarea } from "@/components/ui/textarea";
import { logAttemptAction } from "./actions";
import { LONG_DURATION } from "@/lib/validation/practice";
import type { DsaTopic } from "@/lib/data/types";

export function AttemptForm({
  topics,
  language,
  nowLocal,
  knownTitles,
  onDone,
  prefill,
}: {
  topics: DsaTopic[];
  language: string;
  nowLocal: string;
  knownTitles: string[];
  onDone?: () => void;
  prefill?: { title: string; url: string; difficulty?: "easy" | "medium" | "hard"; topicIds?: number[] };
}) {
  const [state, action] = useActionState<FormState, FormData>(logAttemptAction, {});
  const [minutes, setMinutes] = useState("");
  const long = Number(minutes) > LONG_DURATION;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") {
      ref.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);
  return (
    <form ref={ref} action={action} onReset={() => setMinutes("")} className="grid gap-4">
      <FormAlert state={state} />
      <p className="text-xs text-muted-foreground">
        Only title, result and date are required. Topics and difficulty can be filled in later.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Problem title" name="title" state={state} required>
          <input
            id="f-title"
            name="title"
            list="known-titles"
            required
            maxLength={200}
            defaultValue={state.values?.title ?? prefill?.title}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          />
          <datalist id="known-titles">
            {knownTitles.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <TextField
          label="LeetCode link"
          name="url"
          type="url"
          state={state}
          defaultValue={prefill?.url}
          hint="Optional. Helps recognize the same problem later."
        />
        <SelectField
          label="Result"
          name="result"
          required
          state={state}
          placeholder="Choose…"
          options={[
            { value: "solved_independently", label: "Solved independently" },
            { value: "solved_with_hints", label: "Solved with hints" },
            { value: "reviewed_solution", label: "Reviewed the solution" },
            { value: "unsolved", label: "Unsolved" },
          ]}
        />
        <TextField
          label={`When (${"local"})`}
          name="practiced_local"
          type="datetime-local"
          required
          state={state}
          defaultValue={nowLocal}
        />
        <SelectField
          label="Difficulty"
          name="difficulty"
          state={state}
          defaultValue={prefill?.difficulty ?? "unknown"}
          options={[
            { value: "unknown", label: "Unknown" },
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" },
          ]}
        />
        <SelectField
          label="Confidence (1–5)"
          name="confidence"
          state={state}
          placeholder="Not rated"
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
        />
        <TextField
          label="Minutes"
          name="duration_minutes"
          type="number"
          min={0}
          max={240}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          state={state}
        />
        <TextField label="Language" name="language" state={state} defaultValue={language} />
        <TextField label="Review again on" name="next_review_date" type="date" state={state} />
      </div>
      <CheckboxField name="duration_unknown" label="I don't know how long it took" />
      {long ? (
        <CheckboxField
          name="confirm_long"
          label={`Yes, ${minutes} minutes is correct`}
          hint="Over 3 hours looks unusual, so please confirm."
        />
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Topics</legend>
        <div className="grid gap-1 sm:grid-cols-3">
          {topics.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="topic_ids"
                value={t.id}
                defaultChecked={prefill?.topicIds?.includes(t.id)}
                className="size-4 accent-primary"
              />{" "}
              {t.title}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Notes" name="notes" state={state}>
        <Textarea id="f-notes" name="notes" rows={2} maxLength={5000} />
      </Field>
      <div>
        <SubmitButton pendingText="Logging…">Log attempt</SubmitButton>
      </div>
    </form>
  );
}
