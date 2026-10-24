/**
 * Deterministic safety guard for problem submissions. PATCH must not help
 * facilitate clearly unsafe or disallowed requests (requirements §9: "requests
 * that cannot safely be fulfilled"). This is a conservative, rule-based gate
 * that runs BEFORE retrieval, independent of the AI. It errs toward a clear,
 * honest refusal with a redirect rather than silently returning matches.
 *
 * It is intentionally narrow: it targets a small set of high-confidence unsafe
 * patterns (impaired driving, weapons, medical emergencies) and otherwise lets
 * ordinary community requests through.
 */

export interface SafetyVerdict {
  allowed: boolean;
  /** User-facing explanation when blocked. */
  message?: string;
  /** Optional redirect guidance (e.g. emergency services). */
  guidance?: string;
}

interface Rule {
  test: RegExp;
  message: string;
  guidance?: string;
}

const RULES: Rule[] = [
  {
    // Impaired / drunk driving assistance.
    test: /\b(drunk|been drinking|intoxicated|wasted|high)\b[\s\S]{0,60}\b(driv\w*|ride|car|lift)\b|\b(driv\w*|ride|lift)\b[\s\S]{0,60}\b(drunk|been drinking|intoxicated|wasted)\b/i,
    message:
      "PATCH can't help arrange a ride while someone is impaired — it isn't safe.",
    guidance:
      "Please use a licensed taxi or rideshare, call a sober friend, or contact campus safety. In an emergency, call 911.",
  },
  {
    // Weapons / dangerous items.
    test: /\b(gun|firearm|ammunition|explosive|weapon|knife to hurt|taser)\b/i,
    message: "PATCH can't help source weapons or anything that could cause harm.",
  },
  {
    // Medical emergency — redirect, don't try to "match" a resource.
    test: /\b(overdose|not breathing|chest pain|heart attack|suicid|self[- ]harm|bleeding badly|unconscious)\b/i,
    message: "This sounds like it may be an emergency. PATCH isn't the right tool for this.",
    guidance: "Please contact emergency services (911) or the 988 Suicide & Crisis Lifeline right away.",
  },
  {
    // Clearly illicit.
    test: /\b(fake id|counterfeit|steal|break into|pick a lock to get into)\b/i,
    message: "PATCH can't help with anything illegal.",
  },
];

export function checkSafety(text: string): SafetyVerdict {
  for (const rule of RULES) {
    if (rule.test.test(text)) {
      return { allowed: false, message: rule.message, guidance: rule.guidance };
    }
  }
  return { allowed: true };
}
