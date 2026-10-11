import { cn } from "@/lib/utils";

// An anvil throwing forge sparks: Hephaestus's workshop in one gold shape.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" fill="none" className={cn("size-9 shrink-0 text-primary", className)}>
      <path
        d="M3 12.2C6.4 12 8.6 10.8 10 9.4H26.6V13.4H21.8C21.8 16.2 22.8 18.4 25 19.4V23.6H8V19.4C10.2 18.4 11.2 16.2 11.2 13.4H10C8.4 13.4 6 13 3 12.2Z"
        fill="currentColor"
      />
      <path d="M13 6.2L12 3.4M18 6V2.6M23 6.2L24.2 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
