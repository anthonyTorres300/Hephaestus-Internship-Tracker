import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto grid max-w-md gap-3 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">It may have been moved, deleted, or it may not belong to your account.</p>
      <div>
        <Link href="/" className={buttonVariants()}>
          Go home
        </Link>
      </div>
    </main>
  );
}
