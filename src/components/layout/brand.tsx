import { cn } from "@/lib/utils";

// An anvil throwing forge sparks: Hephaestus's workshop in one gold shape. Matches src/app/icon.svg.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" fill="none" className={cn("size-9 shrink-0 text-primary", className)}>
      <g transform="translate(0.5 0)">
        <path
          d="M4 30C13 29.5 17 26.5 19.5 23H56V31H46.5C46.5 36.5 48.5 40.5 52.5 42.5V48H15.5V42.5C19.5 40.5 21.5 36.5 21.5 31H19.5C15.5 31 9.5 30.5 4 30Z"
          fill="currentColor"
        />
        <rect x="11" y="48" width="48" height="7" rx="2" fill="currentColor" />
        <path d="M29 17.5L25.5 9M38 16.5V6.5M47 17.5L50.5 9" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
