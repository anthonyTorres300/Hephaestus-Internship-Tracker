import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";
import { buttonVariants } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-lg tracking-tight">
            <BrandMark />
            Hephaestus
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Log in
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground md:px-8">
          <span>Listings are community-maintained and unverified.</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
            <Link href="/terms" className="underline">
              Terms
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}
