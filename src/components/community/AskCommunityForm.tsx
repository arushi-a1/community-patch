"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandHeart } from "lucide-react";
import { Category } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { CATEGORY_LABELS } from "@/components/lib/labels";

const ZONES = [
  "Central Campus",
  "North Campus",
  "South Campus",
  "East Campus",
  "West Campus",
  "U-District",
  "Montlake",
];

export function AskCommunityForm({
  initialTitle = "",
  initialDescription = "",
  initialCategory = Category.OTHER_HELP,
  onPosted,
}: {
  initialTitle?: string;
  initialDescription?: string;
  initialCategory?: Category;
  onPosted?: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState<"CRITICAL" | "SOON" | "FLEXIBLE">("FLEXIBLE");
  const [zone, setZone] = useState("Central");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.info("Tell the community what you need.");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createCommunityRequest({
        title: title.trim(),
        description: description.trim(),
        category,
        quantity,
        urgency,
        location: { label: zone, zone },
      });
      toast.success("Posted. Nearby neighbors have been notified.");
      if (onPosted) onPosted(created.id);
      else router.push(`/community/requests/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post your request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="flex flex-col gap-4 p-5">
        <Field label="What do you need?" htmlFor="ct" hint="Even if no one's listed it yet — a neighbor can bring it.">
          <Input
            id="ct"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. a pencil for a quiz, 4 folding chairs, a jump start"
          />
        </Field>
        <Field label="Any details?" htmlFor="cd">
          <Textarea
            id="cd"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="When and where, and anything that helps someone say yes."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" htmlFor="cc">
            <Select id="cc" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How many?" htmlFor="cq">
            <Input
              id="cq"
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Urgency" htmlFor="cu">
            <Select id="cu" value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)}>
              <option value="CRITICAL">Right now</option>
              <option value="SOON">Today</option>
              <option value="FLEXIBLE">Whenever</option>
            </Select>
          </Field>
        </div>
        <Field label="Which area?" htmlFor="cz" hint="Approximate — used to notify nearby neighbors. Never your exact address.">
          <Select id="cz" value={zone} onChange={(e) => setZone(e.target.value)}>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            <HandHeart className="h-4 w-4" aria-hidden />
            Post to the community
          </Button>
        </div>
      </Card>
    </form>
  );
}
