"use client";

import { useRef } from "react";

// GET search form that re-runs the search when a dropdown or checkbox changes; text boxes still wait for Enter / the button.
export function AutoSubmitForm(props: React.ComponentProps<"form">) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      {...props}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        // Unnamed controls (e.g. the open/close toggle for the filter panel) never trigger a search.
        if (t.name && (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio")) ref.current?.requestSubmit();
      }}
    />
  );
}
