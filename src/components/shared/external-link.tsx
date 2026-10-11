import { ExternalLink as Icon } from "lucide-react";

// Opening a link never changes application state.
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!/^https?:\/\//i.test(href)) return <span>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1 underline underline-offset-2"
    >
      {children}
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
