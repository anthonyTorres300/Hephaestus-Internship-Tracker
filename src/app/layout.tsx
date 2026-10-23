import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hephaestus", template: "%s · Hephaestus" },
  description: "A private workspace to track internship applications, follow-ups, resumes and coding practice.",
  // The app provides its own appearance; prevent Dark Reader from rewriting DOM attributes before hydration.
  other: { "darkreader-lock": "true" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
