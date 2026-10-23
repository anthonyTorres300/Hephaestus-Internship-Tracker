import Image from "next/image";
import { cn } from "@/lib/utils";

// An anvil throwing forge sparks: Hephaestus's workshop in one gold shape. Matches src/app/icon.svg.
export function BrandMark({ className }: { className?: string }) {
  return <Image src="/hephaestus-mark.svg" alt="" aria-hidden width={36} height={36} className={cn("size-9 shrink-0", className)} />;
}
