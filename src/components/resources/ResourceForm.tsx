"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, HandHelping } from "lucide-react";
import {
  Category,
  Port,
  PublicResource,
  ResourceCondition,
  ResourceType,
} from "@/domain/types";
import { api } from "@/components/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { CATEGORY_LABELS } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

const PORTS = Object.values(Port);

/**
 * Shared create/edit form for resources. In "edit" mode the type is fixed
 * (changing item↔assistance would invalidate compatibility/condition) and the
 * resource is updated via PATCH; pickup instructions aren't prefilled because
 * the public projection never exposes them.
 */
export function ResourceForm({ existing }: { existing?: PublicResource }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(existing);

  const [type, setType] = useState<ResourceType>(existing?.resourceType ?? ResourceType.ITEM);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState<Category>(existing?.category ?? Category.ELECTRONICS_ADAPTERS);
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [condition, setCondition] = useState<ResourceCondition>(
    existing?.condition ?? ResourceCondition.GOOD,
  );
  const [label, setLabel] = useState(existing?.location.label ?? "");
  const [zone, setZone] = useState(existing?.location.zone ?? "Central Campus");
  const [lendingRules, setLendingRules] = useState(existing?.lendingRules ?? "");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [sourcePorts, setSourcePorts] = useState<string[]>(existing?.compatibility.sourcePorts ?? []);
  const [sinkPorts, setSinkPorts] = useState<string[]>(existing?.compatibility.sinkPorts ?? []);
  const [busy, setBusy] = useState(false);

  const isItem = type === ResourceType.ITEM;

  const togglePort = (set: React.Dispatch<React.SetStateAction<string[]>>, p: string) =>
    set((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2 || zone.trim().length < 1 || label.trim().length < 1) {
      toast.info("Add a title and a location first.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
        condition: isItem ? condition : ResourceCondition.NA,
        location: { label: label.trim(), zone: zone.trim() },
        lendingRules: lendingRules.trim(),
        compatibility: {
          sourcePorts: isItem ? sourcePorts : [],
          sinkPorts: isItem ? sinkPorts : [],
          attributes: existing?.compatibility.attributes ?? [],
        },
      };

      if (editing && existing) {
        const patch: Record<string, unknown> = { ...payload };
        if (pickupInstructions.trim()) patch.pickupInstructions = pickupInstructions.trim();
        await api.updateResource(existing.id, patch);
        toast.success("Resource updated.");
        router.push(`/resources/${existing.id}`);
      } else {
        const created = await api.createResource({
          ...payload,
          resourceType: type,
          exclusive: isItem,
          pickupInstructions: pickupInstructions.trim(),
          availabilityWindows: [],
        });
        toast.success("Resource listed.");
        router.push(`/resources/${created.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save resource.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          {editing ? "Edit resource" : "List a resource"}
        </h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">
          {editing ? "Update the details neighbors see." : "Share an item, or offer a hand."}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5">
        {/* Type toggle (fixed while editing) */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: ResourceType.ITEM, label: "An item", icon: Package },
            { v: ResourceType.ASSISTANCE, label: "Assistance", icon: HandHelping },
          ].map(({ v, label: l, icon: Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => !editing && setType(v)}
              disabled={editing}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-card)] border p-4 text-left transition-colors",
                type === v
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-weak)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-accent-weak)]/50",
                editing && "cursor-not-allowed opacity-70",
              )}
              aria-pressed={type === v}
            >
              <Icon className="h-5 w-5 text-[var(--color-brand)]" aria-hidden />
              <span className="font-medium text-[var(--color-ink)]">{l}</span>
            </button>
          ))}
        </div>

        <Card className="flex flex-col gap-4 p-5">
          <Field label="Title" htmlFor="title">
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={isItem ? "e.g. USB-C to HDMI adapter" : "e.g. Help setting up event tables"} />
          </Field>
          <Field label="Description" htmlFor="desc">
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="What is it, and how can it help?" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="cat">
              <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            {isItem && (
              <Field label="Condition" htmlFor="cond">
                <Select id="cond" value={condition} onChange={(e) => setCondition(e.target.value as ResourceCondition)}>
                  <option value={ResourceCondition.NEW}>New</option>
                  <option value={ResourceCondition.GOOD}>Good</option>
                  <option value={ResourceCondition.FAIR}>Fair</option>
                  <option value={ResourceCondition.WORN}>Worn</option>
                </Select>
              </Field>
            )}
          </div>
          <Field label="Tags" htmlFor="tags" hint="Comma-separated. Helps PATCH match your resource.">
            <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="adapter, usb-c, hdmi" />
          </Field>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location (place)" htmlFor="loc" hint="A named place, not your home address.">
              <Input id="loc" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Suzzallo Library" />
            </Field>
            <Field label="Zone" htmlFor="zone">
              <Input id="zone" value={zone} onChange={(e) => setZone(e.target.value)} maxLength={60} placeholder="e.g. Central Campus" />
            </Field>
          </div>
          <Field label="Lending rules" htmlFor="rules">
            <Input id="rules" value={lendingRules} onChange={(e) => setLendingRules(e.target.value)} maxLength={500} placeholder="e.g. Return same day" />
          </Field>
          <Field
            label="Pickup instructions"
            htmlFor="pickup"
            hint={editing ? "Shared only after you accept a request. Leave blank to keep the current value." : "Shared only after you accept a request."}
          >
            <Input id="pickup" value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} maxLength={500} placeholder="e.g. Union info desk, loaner bin A3" />
          </Field>
        </Card>

        {isItem && (
          <Card className="flex flex-col gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">Compatibility (optional)</p>
              <p className="text-xs text-[var(--color-ink-soft)]">
                For adapters/cables: which ports it accepts (input) and provides (output).
              </p>
            </div>
            <PortPicker label="Accepts (input)" selected={sourcePorts} onToggle={(p) => togglePort(setSourcePorts, p)} />
            <PortPicker label="Provides (output)" selected={sinkPorts} onToggle={(p) => togglePort(setSinkPorts, p)} />
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {editing ? "Save changes" : "List resource"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PortPicker({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: string[];
  onToggle: (p: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--color-ink-soft)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PORTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            aria-pressed={selected.includes(p)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
              selected.includes(p)
                ? "border-[var(--color-accent)] bg-[var(--color-accent-weak)] text-[var(--color-brand)]"
                : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-accent-weak)]/40",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
