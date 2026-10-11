import { cn } from "@/lib/utils";

// A pill-shaped checkbox/radio. The native input stays in the form (so it submits and is keyboard-accessible); the pill is just its skin.
export function Chip({
  type,
  name,
  value,
  checked,
  children,
  className,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  checked: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className="cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm leading-none whitespace-nowrap text-muted-foreground ring-1 ring-white/10 transition-colors hover:text-foreground peer-checked:bg-primary/15 peer-checked:text-primary peer-checked:ring-primary/40 peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          className,
        )}
      >
        {children}
      </span>
    </label>
  );
}
