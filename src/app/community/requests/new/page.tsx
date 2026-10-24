import { AskCommunityForm } from "@/components/community/AskCommunityForm";
import { Category } from "@/domain/types";

export const metadata = { title: "Ask the community — PATCH" };

function coerceCategory(v: string | undefined): Category {
  if (v && v in Category) return v as Category;
  return Category.OTHER_HELP;
}

export default async function NewCommunityRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; description?: string; category?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Ask the community
        </h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">
          Need something that isn&apos;t listed? Post it here and a neighbor nearby can step up.
        </p>
      </div>
      <AskCommunityForm
        initialTitle={sp.title ?? ""}
        initialDescription={sp.description ?? ""}
        initialCategory={coerceCategory(sp.category)}
      />
    </div>
  );
}
