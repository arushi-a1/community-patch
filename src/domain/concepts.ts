/**
 * Concept / synonym map for the deterministic analyzer.
 *
 * The weakness this fixes: a pure keyword matcher can't connect "Band-Aid" or
 * "bleeding" to a "first-aid kit", or "cut my finger" to first aid, because the
 * words don't literally overlap with resource tags. This module maps everyday
 * language (and underlying needs) to canonical CONCEPTS, each of which carries:
 *   - the resource terms/tags that actually satisfy the need,
 *   - a target category,
 *   - a human-readable need phrase (so summaries read like real English),
 *   - optional request type + urgency hints,
 *   - optional safety flag.
 *
 * This is the deterministic analogue of what Bedrock does semantically. When
 * Bedrock is configured it produces richer interpretations; this guarantees the
 * product works well WITHOUT it (FR-13).
 */
import { Category } from "./types";

export interface Concept {
  id: string;
  /** Patterns that indicate this concept (matched case-insensitively). */
  triggers: RegExp[];
  /** Canonical search terms that map to real resource tags/titles. */
  searchTerms: string[];
  /** Capabilities the matcher should look for. */
  capabilities: string[];
  /** Target category for retrieval. */
  category: Category;
  /** Natural-language description of the underlying need. */
  need: string;
  /** Short noun phrase for the summary, e.g. "a first-aid kit". */
  nounPhrase: string;
  requestType?: "ITEM" | "ASSISTANCE";
  /** Attributes to attach (e.g. exam-context). */
  attributes?: string[];
  /** When present, surfaces a gentle safety note. */
  safetyNote?: string;
}

/**
 * Ordered by specificity — more specific concepts first so e.g. "USB-C adapter"
 * wins over a generic "cable".
 */
export const CONCEPTS: Concept[] = [
  // --- First aid / health (the signature correctness fix) ------------------
  {
    id: "first-aid",
    triggers: [
      /band[\s-]?aid/i,
      /bandage/i,
      /\bbleeding\b/i,
      /\bcut (my|his|her|their|a)\b/i,
      /\bscrape\b/i,
      /first[\s-]?aid/i,
      /\bgauze\b/i,
      /antiseptic|disinfect/i,
      /\bblister\b/i,
      /\bwound\b/i,
    ],
    searchTerms: ["first aid", "bandage", "band-aid", "safety", "kit"],
    capabilities: ["first aid"],
    category: Category.OTHER_HELP,
    need: "Find first-aid supplies for a minor injury.",
    nounPhrase: "first-aid supplies",
    requestType: "ITEM",
    safetyNote:
      "For anything beyond a minor scrape — deep or heavy bleeding, a wound that won't close, or if you feel faint — please seek medical care; in an emergency call 911.",
  },

  // --- Display / adapters --------------------------------------------------
  {
    id: "usbc-to-display",
    triggers: [
      /usb[\s-]?c.*(hdmi|projector|display|monitor|screen|tv)/i,
      /(hdmi|projector|display|monitor).*usb[\s-]?c/i,
      /\badapter\b/i,
      /\bdongle\b/i,
    ],
    searchTerms: ["adapter", "hub", "usb-c", "hdmi", "dongle"],
    capabilities: ["adapter", "video out"],
    category: Category.ELECTRONICS_ADAPTERS,
    need: "Find an adapter or hub to connect your device to a display.",
    nounPhrase: "a compatible adapter or hub",
    requestType: "ITEM",
  },

  // --- Power / charging ----------------------------------------------------
  {
    id: "charge-device",
    triggers: [
      /charg(er|ing|e)\b/i,
      /\bpower\b.*\b(bank|up)\b/i,
      /\bbattery\b/i,
      /(laptop|phone|device).*(die|dying|dead|low battery)/i,
      /\bplug\b/i,
    ],
    searchTerms: ["charger", "power", "battery", "power bank", "cable"],
    capabilities: ["power"],
    category: Category.CHARGERS_BATTERIES,
    need: "Find a charger or power source for your device.",
    nounPhrase: "a charger",
    requestType: "ITEM",
  },

  // --- Calculators / school supplies --------------------------------------
  {
    id: "calculator",
    triggers: [/calculator/i, /\bcalc\b/i],
    searchTerms: ["calculator", "scientific", "math"],
    capabilities: ["calculator"],
    category: Category.SCHOOL_SUPPLIES,
    need: "Find a calculator you can borrow.",
    nounPhrase: "a calculator",
    requestType: "ITEM",
  },
  {
    id: "writing-supplies",
    triggers: [/\bpen\b|\bpencil\b|notebook|paper|stapler|scissors|highlighter/i, /\bsupplies\b/i],
    searchTerms: ["supplies", "stapler", "markers", "pen", "paper"],
    capabilities: ["supplies"],
    category: Category.SCHOOL_SUPPLIES,
    need: "Find school or office supplies.",
    nounPhrase: "the supplies you need",
    requestType: "ITEM",
  },

  // --- Tools / repair ------------------------------------------------------
  {
    id: "tighten-screw",
    triggers: [
      /screw(driver)?/i,
      /loose (screw|chair|handle|hinge|leg)/i,
      /tighten/i,
      /\bhex\b|\ballen\b/i,
    ],
    searchTerms: ["screwdriver", "tool", "hex", "allen", "repair"],
    capabilities: ["screwdriver", "tool"],
    category: Category.TOOLS_REPAIR,
    need: "Find the right tool to make a small repair.",
    nounPhrase: "a suitable tool",
    requestType: "ITEM",
  },
  {
    id: "measure",
    triggers: [/tape measure|measur(e|ing)|how (long|wide|big)/i],
    searchTerms: ["tape measure", "measure", "tool"],
    capabilities: ["measure"],
    category: Category.TOOLS_REPAIR,
    need: "Find something to measure with.",
    nounPhrase: "a tape measure",
    requestType: "ITEM",
  },

  // --- Weather -------------------------------------------------------------
  {
    id: "rain",
    triggers: [/umbrella|raining|pouring|downpour|get wet|soaked|\brain\b/i, /poncho/i],
    searchTerms: ["umbrella", "rain", "poncho", "weather"],
    capabilities: ["rain protection"],
    category: Category.OUTDOOR_WEATHER,
    need: "Find something to stay dry in the rain.",
    nounPhrase: "an umbrella",
    requestType: "ITEM",
  },

  // --- Event equipment -----------------------------------------------------
  {
    id: "tables",
    triggers: [/folding table|\btable(s)?\b/i],
    searchTerms: ["folding table", "table", "event"],
    capabilities: ["table"],
    category: Category.EVENT_EQUIPMENT,
    need: "Find a table for your event.",
    nounPhrase: "a folding table",
    requestType: "ITEM",
  },
  {
    id: "projector",
    triggers: [/projector/i],
    searchTerms: ["projector", "hdmi", "event", "presentation"],
    capabilities: ["projector"],
    category: Category.EVENT_EQUIPMENT,
    need: "Find a projector for your presentation.",
    nounPhrase: "a projector",
    requestType: "ITEM",
  },
  {
    id: "audio",
    triggers: [/microphone|\bmic\b|speaker|amplif|\baudio\b|\bsound\b/i],
    searchTerms: ["microphone", "mic", "audio", "event"],
    capabilities: ["audio"],
    category: Category.EVENT_EQUIPMENT,
    need: "Find audio equipment for your event.",
    nounPhrase: "a microphone",
    requestType: "ITEM",
  },
  {
    id: "present-clicker",
    triggers: [/clicker|presenter|slide(s)? remote|advance slides/i],
    searchTerms: ["clicker", "presenter", "presentation", "remote"],
    capabilities: ["presentation"],
    category: Category.EVENT_EQUIPMENT,
    need: "Find a presentation clicker.",
    nounPhrase: "a presentation clicker",
    requestType: "ITEM",
  },
  {
    id: "power-extension",
    triggers: [/extension cord|\bpower strip\b|reach an outlet|too far from (the )?outlet/i],
    searchTerms: ["extension cord", "cord", "power", "event"],
    capabilities: ["power"],
    category: Category.EVENT_EQUIPMENT,
    need: "Find a way to reach a power outlet.",
    nounPhrase: "an extension cord",
    requestType: "ITEM",
  },

  // --- Moving / physical help (ASSISTANCE) ---------------------------------
  {
    id: "carry-move",
    triggers: [
      /carry|move|moving|haul|\bboxes\b|\blift\b/i,
      /pair of hands|extra hands|another (person|body)/i,
      /\bdolly\b|hand truck|\bcart\b/i,
    ],
    searchTerms: ["help", "move", "boxes", "cart", "dolly", "hands"],
    capabilities: ["physical help", "moving"],
    category: Category.MOVING_PHYSICAL,
    need: "Find a hand (or the gear) to move things.",
    nounPhrase: "help moving things",
    requestType: "ASSISTANCE",
  },
  {
    id: "setup-help",
    triggers: [/set ?up|setting up|tear ?down|arrange chairs|event help/i],
    searchTerms: ["help", "setup", "tables", "event", "hands"],
    capabilities: ["physical help"],
    category: Category.MOVING_PHYSICAL,
    need: "Find someone to help set up your event.",
    nounPhrase: "a hand setting up",
    requestType: "ASSISTANCE",
  },

  // --- Kitchen -------------------------------------------------------------
  {
    id: "hot-water",
    triggers: [/kettle|hot water|boil|\btea\b|\bcoffee\b|\burn\b/i],
    searchTerms: ["kettle", "coffee", "kitchen", "hot water"],
    capabilities: ["kitchen"],
    category: Category.KITCHEN_HOUSEHOLD,
    need: "Find kitchen gear for hot drinks.",
    nounPhrase: "an electric kettle",
    requestType: "ITEM",
  },

  // --- Other help ----------------------------------------------------------
  {
    id: "sewing",
    triggers: [/sew(ing)?|button fell|rip(ped)? (my|a)|torn|hem|needle and thread/i],
    searchTerms: ["sewing", "repair", "kit"],
    capabilities: ["sewing"],
    category: Category.OTHER_HELP,
    need: "Find a sewing kit for a quick fix.",
    nounPhrase: "a sewing kit",
    requestType: "ITEM",
  },
  {
    id: "notes-academic",
    triggers: [/notes|missed (a |the )?lecture|study help|tutor/i],
    searchTerms: ["notes", "help", "study", "lecture"],
    capabilities: ["academic help"],
    category: Category.OTHER_HELP,
    need: "Find help with notes or studying.",
    nounPhrase: "help with notes",
    requestType: "ASSISTANCE",
  },
];

export interface ConceptMatch {
  concept: Concept;
  /** Number of distinct trigger patterns that matched (confidence proxy). */
  hits: number;
  /** Final ranking score after intent-based adjustments. */
  score: number;
}

/**
 * Explicit "I need a person to help me" language. When present, assistance
 * concepts should outrank item concepts even if an item noun also appears —
 * "another pair of hands to help set up tables" is a request for HELP, not a
 * request to borrow a table.
 */
const HELP_INTENT_RE =
  /\b(pair of hands|extra hands|another (person|body|pair)|someone to|a hand\b|help me|help us|help (set|carry|move|lift|load|unload)|volunteer)\b/i;

/** Return matching concepts, most-confident first. */
export function matchConcepts(text: string): ConceptMatch[] {
  const helpIntent = HELP_INTENT_RE.test(text);
  const matches: ConceptMatch[] = [];

  for (const concept of CONCEPTS) {
    let hits = 0;
    for (const re of concept.triggers) {
      if (re.test(text)) hits += 1;
    }
    if (hits === 0) continue;

    let score = hits;
    // Boost assistance concepts when the user is explicitly asking for help.
    if (helpIntent && concept.requestType === "ASSISTANCE") score += 5;
    // Slightly demote item concepts in an explicit help-intent context so an
    // incidental noun ("tables") doesn't hijack an assistance request.
    if (helpIntent && concept.requestType === "ITEM") score -= 1;

    matches.push({ concept, hits, score });
  }

  // Higher score first; preserve declaration order on ties.
  return matches.sort((a, b) => b.score - a.score);
}
