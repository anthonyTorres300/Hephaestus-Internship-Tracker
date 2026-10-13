"use client";

import Form from "next/form";
import { useRef } from "react";

// GET search form that re-runs the search when a dropdown or checkbox changes; text boxes still wait for Enter / the button.
export function AutoSubmitForm({ method, action, ...props }: React.ComponentProps<"form">) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <Form
      action={action ?? ""}
      {...(method && method !== "get" ? { method } : {})}
      ref={ref}
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        if (e.defaultPrevented) return;
        const t = e.target as unknown as HTMLInputElement;
        // Unnamed controls (e.g. the open/close toggle for the filter panel) never trigger a search.
        if (t.name && (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio")) ref.current?.requestSubmit();
      }}
    />
  );
}
