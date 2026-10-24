import { FixFlow } from "@/components/fix/FixFlow";

export const metadata = { title: "Request a fix — PATCH" };

export default async function FixPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Let&apos;s find your fix
        </h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">
          Describe what you need. PATCH finds real, feasible options nearby.
        </p>
      </div>
      <FixFlow autofocus initialText={q} autoRun={Boolean(q)} />
    </div>
  );
}
