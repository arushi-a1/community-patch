/**
 * Problem interpretation (FR-4). Produces a strictly-validated structured
 * Interpretation from untrusted free text. Two producers share this schema:
 *   - the deterministic analyzer here (always available, no AI), and
 *   - the Bedrock adapter (services/ai.bedrock.ts), whose output is validated
 *     against this exact schema and discarded if invalid.
 *
 * SECURITY: user text is untrusted data. Nothing here lets text or model output
 * drive queries, authz, or state directly — the analyzer only produces search
 * hints and structured fields that the deterministic pipeline re-grounds.
 */
import { z } from "zod";
import { INPUT_LIMITS } from "./config";
import { Category, Port } from "./types";
import { matchConcepts, Concept } from "./concepts";

// RequestType is defined here (interpretation-specific), not in types.ts.
export const RequestType = {
  ITEM: "ITEM",
  ASSISTANCE: "ASSISTANCE",
  UNKNOWN: "UNKNOWN",
} as const;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];

export const Urgency = {
  CRITICAL: "CRITICAL",
  SOON: "SOON",
  FLEXIBLE: "FLEXIBLE",
} as const;
export type Urgency = (typeof Urgency)[keyof typeof Urgency];

export const InterpretationSchema = z.object({
  problem_summary: z.string().min(1).max(300),
  underlying_need: z.string().min(1).max(300),
  request_type: z.enum([
    RequestType.ITEM,
    RequestType.ASSISTANCE,
    RequestType.UNKNOWN,
  ]),
  required_capabilities: z.array(z.string().max(60)).max(12).default([]),
  item_constraints: z.array(z.string().max(60)).max(12).default([]),
  /** Structured compatibility the matcher can reason about. */
  compatibility_constraints: z
    .object({
      sourcePorts: z.array(z.string()).default([]),
      sinkPorts: z.array(z.string()).default([]),
      attributes: z.array(z.string()).default([]),
    })
    .default({ sourcePorts: [], sinkPorts: [], attributes: [] }),
  location_context: z.string().max(120).optional(),
  /** ISO datetime deadline when derivable. */
  deadline: z.string().datetime().optional(),
  urgency: z.enum([Urgency.CRITICAL, Urgency.SOON, Urgency.FLEXIBLE]),
  suggested_search_terms: z.array(z.string().max(40)).max(20).default([]),
  possible_alternatives: z.array(z.string().max(80)).max(8).default([]),
  /** At most one concise clarifying question, only when genuinely ambiguous. */
  clarifying_question: z.string().max(200).optional(),
  /** Quantity requested when stated, e.g. "three tables" -> 3. */
  quantity: z.number().int().min(1).max(100).optional(),
  /** Gentle, non-emergency safety note when the request implies risk. */
  safety_note: z.string().max(400).optional(),
  /** Canonical concept ids that matched (diagnostics + retrieval hints). */
  concepts: z.array(z.string().max(40)).max(6).default([]),
  /** Which producer generated this interpretation (for honest UI labeling). */
  source: z.enum(["rule-based", "ai"]).default("rule-based"),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

// ---------------------------------------------------------------------------
// Input sanitization (bounded, control-char stripped) — SR §3.
// ---------------------------------------------------------------------------

export function sanitizeProblemText(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
  return stripped.trim().slice(0, INPUT_LIMITS.problemText);
}

// ---------------------------------------------------------------------------
// Deterministic analyzer — rule/keyword based, always available (FR-13).
// ---------------------------------------------------------------------------

const PORT_PATTERNS: Array<{ re: RegExp; port: string }> = [
  { re: /usb[\s-]?c|type[\s-]?c|thunderbolt/i, port: Port.USB_C },
  { re: /usb[\s-]?a|usb(?!\s*-?\s*c)/i, port: Port.USB_A },
  { re: /hdmi/i, port: Port.HDMI },
  { re: /vga/i, port: Port.VGA },
  { re: /displayport|\bdp\b/i, port: Port.DISPLAYPORT },
  { re: /lightning/i, port: Port.LIGHTNING },
  { re: /micro[\s-]?usb/i, port: Port.MICRO_USB },
  { re: /ethernet|rj45/i, port: Port.ETHERNET },
  { re: /3\.5\s?mm|headphone|aux/i, port: Port.AUX_3_5MM },
];

const CATEGORY_HINTS: Array<{ re: RegExp; category: Category; terms: string[] }> = [
  { re: /adapter|dongle|hdmi|usb-?c|vga|displayport|hub|convert/i, category: Category.ELECTRONICS_ADAPTERS, terms: ["adapter", "hub"] },
  { re: /charger|charging|battery|power ?bank|cable|cord(?! ?table)/i, category: Category.CHARGERS_BATTERIES, terms: ["charger", "battery"] },
  { re: /calculator|pen|pencil|notebook|paper|stapler|scissors|supplies/i, category: Category.SCHOOL_SUPPLIES, terms: ["calculator", "supplies"] },
  { re: /screwdriver|wrench|hammer|drill|tool|tighten|repair|fix a/i, category: Category.TOOLS_REPAIR, terms: ["screwdriver", "tool"] },
  { re: /kettle|pot|pan|utensil|kitchen|cookware|microwave/i, category: Category.KITCHEN_HOUSEHOLD, terms: ["kitchen"] },
  { re: /projector|microphone|mic|clicker|tripod|folding table|extension cord|speaker|stage|event/i, category: Category.EVENT_EQUIPMENT, terms: ["event equipment"] },
  { re: /umbrella|rain|jacket|poncho|weather|cold|gloves/i, category: Category.OUTDOOR_WEATHER, terms: ["umbrella", "weather gear"] },
  { re: /carry|move|moving|boxes|lift|haul|dolly|cart/i, category: Category.MOVING_PHYSICAL, terms: ["moving help"] },
  { re: /help|hand|volunteer|assist|set ?up|setup/i, category: Category.OTHER_HELP, terms: ["assistance"] },
];

const ASSISTANCE_RE = /\b(help|hand|hands|assist|volunteer|carry|move|moving|set ?up|setup|lift|haul)\b/i;
const ITEM_RE = /\b(adapter|charger|calculator|umbrella|screwdriver|table|cord|cable|hub|projector|microphone|clicker|tripod|battery|power ?bank)\b/i;

const STOPWORDS = new Set([
  "the","a","an","to","for","and","or","with","my","our","we","i","need","needs",
  "is","are","in","on","at","of","it","that","this","please","help","can","you",
  "me","us","be","have","has","get","got","now","asap","right","away","soon",
  "something","came","up","lets","let","fix","find","there","their","so","but",
  "minutes","minute","mins","min","hour","hours","hr","afternoon","morning",
  "evening","today","tonight","immediately",
]);

interface DeadlineResult {
  deadline?: string;
  urgency: Urgency;
}

/** Derive a deadline + urgency from the text relative to `now`. */
export function deriveDeadline(text: string, now: Date = new Date()): DeadlineResult {
  const t = text.toLowerCase();

  const inMinutes = t.match(/(\d{1,3})\s*(?:min(?:ute)?s?)\b/);
  if (inMinutes) {
    const mins = Math.min(parseInt(inMinutes[1]!, 10), 600);
    const d = new Date(now.getTime() + mins * 60_000);
    return { deadline: d.toISOString(), urgency: mins <= 60 ? Urgency.CRITICAL : Urgency.SOON };
  }
  const inHours = t.match(/(\d{1,2})\s*(?:hour|hr)s?\b/);
  if (inHours) {
    const hrs = Math.min(parseInt(inHours[1]!, 10), 48);
    const d = new Date(now.getTime() + hrs * 3_600_000);
    return { deadline: d.toISOString(), urgency: hrs <= 2 ? Urgency.SOON : Urgency.FLEXIBLE };
  }
  if (/\b(immediately|right now|asap|right away|urgent)\b/.test(t)) {
    return { deadline: new Date(now.getTime() + 15 * 60_000).toISOString(), urgency: Urgency.CRITICAL };
  }
  if (/\b(this afternoon|later today|tonight|this evening)\b/.test(t)) {
    const d = new Date(now);
    d.setHours(17, 0, 0, 0);
    if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
    return { deadline: d.toISOString(), urgency: Urgency.SOON };
  }
  if (/\b(this morning)\b/.test(t)) {
    const d = new Date(now);
    d.setHours(11, 0, 0, 0);
    return { deadline: d.toISOString(), urgency: Urgency.SOON };
  }
  return { urgency: Urgency.FLEXIBLE };
}

function detectPorts(text: string): string[] {
  const found = new Set<string>();
  for (const { re, port } of PORT_PATTERNS) {
    if (re.test(text)) found.add(port);
  }
  return [...found];
}

/**
 * Classify ports into source (the device the user HAS) and sink (what they
 * want to reach). We use linguistic cues: "laptop only has X", "projector
 * uses Y", "connect X to Y". Falls back to leaving both lists populated.
 */
function classifyPorts(text: string, ports: string[]): { source: string[]; sink: string[] } {
  const t = text.toLowerCase();
  const source = new Set<string>();
  const sink = new Set<string>();

  // "laptop ... usb-c", "only has usb-c" => the thing they plug FROM
  const hasMatch = t.match(/(?:only has|has only|laptop\D{0,20}|device\D{0,20}|source\D{0,20})(usb[\s-]?c|usb[\s-]?a|hdmi|vga|displayport|lightning|micro[\s-]?usb)/i);
  // "projector uses hdmi", "tv uses hdmi", "needs hdmi" => the thing they plug INTO
  const usesMatch = t.match(/(?:uses|needs|requires|port is|is)\s*(hdmi|vga|displayport|usb[\s-]?c|usb[\s-]?a|ethernet)/i);

  if (hasMatch) {
    for (const { re, port } of PORT_PATTERNS) if (re.test(hasMatch[1]!)) source.add(port);
  }
  if (usesMatch) {
    for (const { re, port } of PORT_PATTERNS) if (re.test(usesMatch[1]!)) sink.add(port);
  }

  // "connect X to Y" ordering
  const connect = t.match(/connect\D{0,20}(usb[\s-]?c|usb[\s-]?a|hdmi|vga|displayport)\D{0,20}to\D{0,20}(usb[\s-]?c|usb[\s-]?a|hdmi|vga|displayport)/i);
  if (connect) {
    for (const { re, port } of PORT_PATTERNS) {
      if (re.test(connect[1]!)) source.add(port);
      if (re.test(connect[2]!)) sink.add(port);
    }
  }

  // If we couldn't classify, make a best-effort split: USB-C/A/Lightning tend
  // to be the source (device side); HDMI/VGA/DP tend to be the sink (display).
  if (source.size === 0 && sink.size === 0) {
    for (const p of ports) {
      if (p === Port.USB_C || p === Port.USB_A || p === Port.LIGHTNING || p === Port.MICRO_USB) source.add(p);
      else sink.add(p);
    }
  }
  return { source: [...source], sink: [...sink] };
}

function extractLocation(text: string): string | undefined {
  const m = text.match(/\b(?:at|in|near|by)\s+the\s+([a-z][a-z\s]{2,40}?)(?:\.|,|;|$|\s+(?:and|but|so|we|i|our|the))/i)
    || text.match(/\b(?:at|in|near|by)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/);
  if (m) return m[1]!.trim();
  return undefined;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, few: 3, several: 3,
};

/** Extract a requested quantity, e.g. "three tables", "2 chairs". */
export function extractQuantity(text: string): number | undefined {
  const digit = text.match(/\b(\d{1,3})\s+(?:[a-z-]+\s+){0,2}?[a-z]+\b/i);
  if (digit) {
    const n = parseInt(digit[1]!, 10);
    if (n >= 1 && n <= 100) return n;
  }
  const word = text.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|couple|few|several)\s+[a-z]+/);
  if (word) return NUMBER_WORDS[word[1]!];
  return undefined;
}

function fallbackNounPhrase(terms: string[], requestType: RequestType): string {
  const subject = terms[0];
  if (!subject) return requestType === RequestType.ASSISTANCE ? "a helping hand" : "what you need";
  return `a ${subject}`;
}

function keywordTerms(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 12);
}

/**
 * Produce a validated Interpretation deterministically. Pure and testable.
 */
export function analyzeProblemDeterministic(
  rawText: string,
  opts: { now?: Date; locationHint?: string; requestTypeHint?: RequestType; deadlineHint?: string } = {},
): Interpretation {
  const text = sanitizeProblemText(rawText);
  const now = opts.now ?? new Date();

  const ports = detectPorts(text);
  const { source, sink } = classifyPorts(text, ports);

  // ---- Concept understanding (the semantic layer) ----
  // Map everyday language to canonical concepts. This is what lets us connect
  // "Band-Aid"/"bleeding" to first-aid supplies, "loose screw" to a tool, etc.
  const conceptMatches = matchConcepts(text);
  const primaryConcept: Concept | undefined = conceptMatches[0]?.concept;
  const conceptIds = conceptMatches.slice(0, 6).map((c) => c.concept.id);

  // Category hints (legacy keyword layer) still help broaden search terms.
  const cats = CATEGORY_HINTS.filter((h) => h.re.test(text));
  const catTerms = cats.flatMap((c) => c.terms);

  // Request type: concept wins, then explicit hint, then keyword heuristics.
  let requestType: RequestType = opts.requestTypeHint ?? RequestType.UNKNOWN;
  if (primaryConcept?.requestType) {
    requestType = primaryConcept.requestType as RequestType;
  }
  if (requestType === RequestType.UNKNOWN) {
    const assistance = ASSISTANCE_RE.test(text) && !ITEM_RE.test(text);
    const item = ITEM_RE.test(text);
    if (assistance) requestType = RequestType.ASSISTANCE;
    else if (item) requestType = RequestType.ITEM;
    if (/\b(carry|move|moving|set ?up|setup|lift|haul|hands?)\b/.test(text) && !/\b(table|cord|adapter|charger)\b/.test(text)) {
      requestType = RequestType.ASSISTANCE;
    }
  }

  const { deadline: derivedDeadline, urgency } = deriveDeadline(text, now);
  const deadline = opts.deadlineHint ?? derivedDeadline;

  // Quantity, e.g. "three tables", "2 chairs".
  const quantity = extractQuantity(text);

  // Search terms: concept terms first (high precision), then keyword/category.
  const conceptTerms = conceptMatches.flatMap((c) => c.concept.searchTerms);
  const conceptCaps = conceptMatches.flatMap((c) => c.concept.capabilities);
  const terms = [...new Set([...conceptTerms, ...keywordTerms(text), ...catTerms])].slice(0, 16);

  // Compatibility attributes worth surfacing (exam permission, wattage).
  const attributes: string[] = [...(primaryConcept?.attributes ?? [])];
  if (/\bexam\b/i.test(text)) attributes.push("exam-context");
  const watt = text.match(/(\d{2,3})\s*w(?:att)?\b/i);
  if (watt) attributes.push(`${watt[1]}W`);

  const possibleAlternatives: string[] = [];
  if (sink.includes(Port.HDMI) && source.includes(Port.USB_C)) {
    possibleAlternatives.push("USB-C hub with HDMI output", "a nearby room with compatible equipment");
  }

  // Clarifying question only when genuinely ambiguous (no concept + sparse terms).
  let clarifyingQuestion: string | undefined;
  if (!primaryConcept && requestType === RequestType.UNKNOWN && terms.length <= 1) {
    clarifyingQuestion = "Could you say a bit more about what you need and by when?";
  }

  const locationContext = opts.locationHint ?? extractLocation(text);

  // Build a readable need + summary. The concept gives a proper noun phrase so
  // summaries read like real English instead of "...compatible bleeding."
  const nounPhrase = primaryConcept?.nounPhrase ?? fallbackNounPhrase(terms, requestType);
  const underlyingNeed = primaryConcept
    ? primaryConcept.need
    : requestType === RequestType.ASSISTANCE
      ? `Find a nearby person who can help with ${nounPhrase}.`
      : `Find ${nounPhrase} nearby that's available to borrow.`;

  const candidate = {
    problem_summary: text.length > 0 ? text.slice(0, 200) : "No description provided.",
    underlying_need: underlyingNeed,
    request_type: requestType,
    required_capabilities: [...new Set([...conceptCaps, ...catTerms])].slice(0, 8),
    item_constraints: attributes.filter((a) => a !== "exam-context"),
    compatibility_constraints: {
      sourcePorts: source,
      sinkPorts: sink,
      attributes,
    },
    location_context: locationContext,
    deadline,
    urgency,
    suggested_search_terms: terms,
    possible_alternatives: possibleAlternatives,
    clarifying_question: clarifyingQuestion,
    quantity,
    safety_note: primaryConcept?.safetyNote,
    concepts: conceptIds,
    source: "rule-based" as const,
  };

  // Validate our own output too — guarantees the invariant holds for both producers.
  return InterpretationSchema.parse(candidate);
}

/**
 * Validate arbitrary (e.g. model-produced) interpretation JSON. Returns the
 * parsed Interpretation or null if invalid (caller falls back deterministically).
 */
export function validateInterpretation(input: unknown): Interpretation | null {
  const result = InterpretationSchema.safeParse(input);
  return result.success ? result.data : null;
}
