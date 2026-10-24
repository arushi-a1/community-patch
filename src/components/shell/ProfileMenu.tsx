"use client";
import { useState } from "react";
import Link from "next/link";
import { UserRound, ChevronDown, RefreshCw, Award } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/components/lib/api";
import { cn } from "@/components/ui/cn";

export function ProfileMenu() {
  const { actorId, users, devMode, switchUser } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = users.find((u) => u.id === actorId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pl-1 pr-2.5 text-sm text-[var(--color-cream)] hover:bg-white/20"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
        <span className="hidden max-w-[120px] truncate font-medium text-[var(--color-cream)] sm:block">
          {current?.displayName ?? "Account"}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--color-cream-soft)]" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="absolute right-0 z-50 mt-2 w-60 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-lift)]"
            role="menu"
          >
            {devMode && (
              <>
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                  Demo: act as
                </p>
                <div className="max-h-56 overflow-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      role="menuitemradio"
                      aria-checked={u.id === actorId}
                      onClick={async () => {
                        await switchUser(u.id);
                        setOpen(false);
                        toast.info(`Now acting as ${u.displayName}`);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[var(--radius-control)] px-2 py-1.5 text-left text-sm hover:bg-[var(--color-accent-weak)]",
                        u.id === actorId && "font-semibold text-[var(--color-brand)]",
                      )}
                    >
                      {u.displayName}
                      {u.id === actorId && <span className="text-xs">active</span>}
                    </button>
                  ))}
                </div>
                <div className="my-1 border-t border-[var(--color-line)]" />
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.reset();
                      toast.success("Demo data reset.");
                      setOpen(false);
                      setTimeout(() => window.location.reload(), 300);
                    } catch {
                      toast.error("Could not reset demo data.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-left text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-accent-weak)]"
                >
                  <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} aria-hidden />
                  Reset demo data
                </button>
              </>
            )}
            {!devMode && (
              <p className="px-2 py-1.5 text-sm text-[var(--color-ink-soft)]">
                Signed in as {current?.displayName ?? "member"}.
              </p>
            )}
            <Link
              href="/points"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2 rounded-[var(--radius-control)] border-t border-[var(--color-line)] px-2 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-brand-weak)]"
            >
              <Award className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
              PATCH Points & badges
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
