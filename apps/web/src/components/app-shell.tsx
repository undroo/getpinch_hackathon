"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Menu,
  Users,
  X,
  ClipboardList,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GYM_NAME } from "@/lib/constants";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/flex-members", label: "Flex Members", icon: Shield },
  { href: "/actions", label: "Actions", icon: ClipboardList },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link
      href="/"
      className="text-xl font-bold tracking-[-0.03em] text-text-primary"
    >
      Retain<span className="font-extrabold text-brand-primary">IQ+</span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-bg-elevated text-text-primary"
                : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-sm bg-brand-primary" />
            )}
            <Icon
              className={cn(
                "h-4 w-4 transition-colors",
                active ? "text-brand-primary" : undefined,
              )}
              strokeWidth={1.5}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <Logo />
      </div>

      <SidebarNav onNavigate={onNavigate} />

      <div className="mt-auto border-t border-border-subtle px-5 py-4">
        <p className="truncate text-xs font-medium text-text-secondary">
          {GYM_NAME}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">Powered by Pinch</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMemberOffer = pathname.startsWith("/offer");

  if (isMemberOffer) {
    return <div className="min-h-screen bg-surface-gradient">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-gradient">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border-subtle bg-bg-surface md:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-60 border-r border-border-subtle bg-bg-surface shadow-modal">
            <div className="flex justify-end p-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-subtle bg-bg-base/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </header>

        <main
          key={pathname}
          className="animate-page-enter mx-auto w-full max-w-content px-4 py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
