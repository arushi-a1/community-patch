"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Users, ListChecks, Package, Sparkles, Map as MapIcon, MessageCircle } from "lucide-react";
import { Logo } from "./Logo";
import { ProfileMenu } from "./ProfileMenu";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

const NAV = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/community", label: "Community", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/activity", label: "My Activity", icon: ListChecks },
  { href: "/resources", label: "My Resources", icon: Package },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen">
      {/* Top navigation (deep forest-olive — anchors the sage palette) */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-brand-deep)] bg-[var(--color-brand-deep)] text-[var(--color-cream)]">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-4">
          <Link href="/" aria-label="PATCH home" className="shrink-0">
            <Logo variant="light" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-white/15 text-white"
                    : "text-[var(--color-cream-soft)] hover:bg-white/10 hover:text-white",
                )}
                aria-current={isActive(href) ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/fix" className="hidden sm:block">
              <Button size="sm">
                <Sparkles className="h-4 w-4" aria-hidden />
                Request a fix
              </Button>
            </Link>
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1120px] px-4 pb-28 pt-6 md:pb-12">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-surface)] md:hidden"
        aria-label="Primary mobile"
      >
        <div className="mx-auto grid max-w-[560px] grid-cols-5">
          <MobileTab href="/discover" label="Discover" icon={Compass} active={isActive("/discover")} />
          <MobileTab href="/community" label="Community" icon={Users} active={isActive("/community")} />
          <MobileFixTab active={isActive("/fix")} />
          <MobileTab href="/activity" label="Activity" icon={ListChecks} active={isActive("/activity")} />
          <MobileTab href="/resources" label="Resources" icon={Package} active={isActive("/resources")} />
        </div>
      </nav>
    </div>
  );
}

function MobileTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Compass;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
        active ? "text-[var(--color-brand)]" : "text-[var(--color-ink-soft)]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {label}
    </Link>
  );
}

function MobileFixTab({ active }: { active: boolean }) {
  return (
    <Link href="/fix" className="flex flex-col items-center justify-center" aria-label="Request a fix">
      <span
        className={cn(
          "-mt-4 flex h-12 w-12 items-center justify-center rounded-full border-4 border-[var(--color-canvas)] shadow-[var(--shadow-soft)]",
          "bg-[var(--color-accent)] text-white",
          active && "bg-[var(--color-brand)]",
        )}
      >
        <Sparkles className="h-5 w-5" aria-hidden />
      </span>
      <span className="mt-0.5 text-[11px] font-semibold text-[var(--color-brand)]">Fix</span>
    </Link>
  );
}
