import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/" className="flex items-center gap-3 font-heading text-4xl tracking-tight">
        <BrandMark className="size-14" />
        Hephaestus
      </Link>
      <main id="main" className="w-full max-w-md">
        <div className="meander mb-3" aria-hidden />
        {children}
      </main>
      <p className="text-xs text-muted-foreground">
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
      </p>
    </div>
  );
}
