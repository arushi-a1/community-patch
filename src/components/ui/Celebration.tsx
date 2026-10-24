"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Sparkles, PartyPopper } from "lucide-react";

interface CelebrationPayload {
  title: string;
  /** e.g. "+25 PATCH Points" */
  subtitle?: string;
  /** Optional newly-earned badge name. */
  badge?: string;
}

interface CelebrationApi {
  celebrate: (payload: CelebrationPayload) => void;
}

const CelebrationContext = createContext<CelebrationApi | null>(null);

export function useCelebration(): CelebrationApi {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error("useCelebration must be used within CelebrationProvider");
  return ctx;
}

// Confetti pieces in the warm palette.
const CONFETTI_COLORS = ["#c06a4e", "#b14a6b", "#c2862c", "#5c6f4b", "#e7c06a", "#8a9b6e"];

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const celebrate = useCallback((p: CelebrationPayload) => {
    setPayload(p);
    setTimeout(() => setPayload(null), 3200);
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {payload && (
        <div
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
          role="status"
          aria-live="assertive"
        >
          {/* Confetti (skipped under reduced motion) */}
          {!reduced && (
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 36 }).map((_, i) => {
                const left = (i * 97) % 100;
                const delay = (i % 10) * 0.08;
                const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
                const size = 6 + (i % 4) * 2;
                return (
                  <span
                    key={i}
                    className="patch-confetti absolute top-[-20px] rounded-[2px]"
                    style={{
                      left: `${left}%`,
                      width: size,
                      height: size * 1.6,
                      background: color,
                      animationDelay: `${delay}s`,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Card */}
          <div className="patch-celebrate relative mx-4 flex max-w-xs flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] px-7 py-6 text-center shadow-[var(--shadow-lift)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-weak)] text-[var(--color-accent)]">
              <PartyPopper className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">{payload.title}</h3>
            {payload.subtitle && (
              <p className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)]">
                <Sparkles className="h-4 w-4" aria-hidden />
                {payload.subtitle}
              </p>
            )}
            {payload.badge && (
              <p className="mt-1 rounded-full bg-[var(--color-brand-weak)] px-3 py-1 text-sm font-medium text-[var(--color-brand)]">
                New badge: {payload.badge}
              </p>
            )}
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  );
}
