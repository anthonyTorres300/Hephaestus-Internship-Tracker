"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Code2, LayoutDashboard, ListChecks, ChevronDown, Menu, Settings, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/brand";
import { QuickLogButton } from "@/components/applications/quick-log";
import { NavProgress } from "@/components/layout/nav-progress";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: ListChecks },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/practice", label: "Practice", icon: Code2 },
];
const ADMIN_NAV = [{ href: "/admin/sources", label: "Admin", icon: ShieldCheck }];

function useActive() {
  const pathname = usePathname();
  return (href: string) => {
    const section = "/" + href.split("/")[1];
    return pathname === href || pathname.startsWith(section + "/") || pathname === section;
  };
}

function NavLinks({ isAdmin, orientation, onNavigate }: { isAdmin: boolean; orientation: "row" | "column"; onNavigate?: () => void }) {
  const isActive = useActive();
  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;
  return (
    <ul className={cn("flex gap-1", orientation === "column" ? "flex-col" : "h-full flex-row items-stretch")}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <li key={href} className={orientation === "row" ? "h-full" : undefined}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 h-full items-center gap-2 px-2 py-2 text-[10px] font-semibold lg:px-3 lg:text-xs tracking-[0.14em] text-muted-foreground uppercase outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
              )}
            >
              <Icon className={cn("size-4", orientation === "row" && "hidden")} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-heading text-lg tracking-tight">
      <BrandMark />
      Hephaestus
    </Link>
  );
}

function UserMenu({ name, email, logout }: { name: string; email: string; logout: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const onAccount = pathname.startsWith("/settings");
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-md py-1 pr-2.5 pl-1 text-sm font-semibold outline-none transition-colors hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-ring/50",
          (open || onAccount) && "bg-white/5",
        )}
      >
        <span
          className="grid size-7 place-items-center rounded-full border border-primary/60 text-xs font-semibold text-primary"
          aria-hidden
        >
          {(name[0] ?? "?").toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate lg:inline">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 grid w-56 gap-0.5 rounded-md bg-popover p-1.5 text-sm shadow-xl ring-1 ring-white/15"
        >
          <p className="truncate px-3 py-2 text-xs text-muted-foreground" title={email}>
            {email}
          </p>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            <Settings className="size-4" aria-hidden /> Account
          </Link>
          <div
            role="none"
            className="[&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-3 [&_button]:font-normal [&_button:hover]:bg-white/10"
          >
            {logout}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({
  children,
  name,
  email,
  isAdmin,
  logout,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
  isAdmin: boolean;
  logout: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const activeSection = "/" + path.split("/")[1];
  return (
    <div className="min-h-screen">
      <NavProgress />
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:px-8 lg:gap-4">
          <Brand />
          <nav aria-label="Primary" className="ml-2 hidden h-full flex-1 md:block">
            <NavLinks isAdmin={isAdmin} orientation="row" />
          </nav>
          <QuickLogButton />
          <div className="hidden md:block">
            <UserMenu name={name} email={email} logout={logout} />
          </div>

          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation menu" />}>
                <Menu aria-hidden />
              </SheetTrigger>
              <SheetContent side="right" className="p-4">
                <SheetTitle className="py-2">Hephaestus</SheetTitle>
                <nav aria-label="Primary mobile">
                  <NavLinks isAdmin={isAdmin} orientation="column" onNavigate={() => setOpen(false)} />
                </nav>
                <div className="mt-auto grid gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    {name} · {email}
                  </span>
                  <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm text-foreground">
                    <Settings className="size-4" aria-hidden /> Account
                  </Link>
                  {logout}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="meander mt-1" aria-hidden />
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 md:px-8 md:py-8">
        {children}
      </main>
      <nav
        aria-label="Phone navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-4 gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={activeSection === href ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px]",
                activeSection === href ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
