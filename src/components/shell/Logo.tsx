export function Logo({ className, variant = "dark" }: { className?: string; variant?: "dark" | "light" }) {
  const wordColor = variant === "light" ? "#f4efe3" : "var(--color-ink)";
  const tile = variant === "light" ? "#5c6f4b" : "var(--color-brand)"; // sage tile
  const leaf = variant === "light" ? "#b14a6b" : "var(--color-accent)"; // berry leaf
  const stitch = variant === "light" ? "#2f3b2a" : "#fff";
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden>
        <rect x="1" y="1" width="24" height="24" rx="7" fill={tile} />
        {/* a stitched "patch" leaf */}
        <path
          d="M13 6c3.2 1.2 5 3.6 5 6.8 0 3.4-2.4 6-5.2 7.2-2.8-1.2-5.2-3.8-5.2-7.2C7.6 9.4 9.6 7.1 13 6Z"
          fill={leaf}
        />
        <path d="M13 8.5v9" stroke={stitch} strokeWidth="1.3" strokeLinecap="round" strokeDasharray="1.4 1.8" />
      </svg>
      <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: wordColor }}>
        PATCH
      </span>
    </span>
  );
}
