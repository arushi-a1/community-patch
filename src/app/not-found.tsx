import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold text-[var(--color-ink)]">Nothing here</h1>
      <p className="max-w-sm text-[var(--color-ink-soft)]">
        That page or resource couldn&apos;t be found. It may have been removed or is no longer available.
      </p>
      <Link href="/">
        <Button>Back home</Button>
      </Link>
    </div>
  );
}
