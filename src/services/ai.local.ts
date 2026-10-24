/**
 * Local AI adapter — wraps the deterministic analyzer. Zero external
 * dependencies; this is the default provider and the fallback for Bedrock.
 */
import { analyzeProblemDeterministic, Interpretation } from "@/domain/interpretation";
import { AIService, AnalyzeInput } from "./ai";

export class LocalAIService implements AIService {
  readonly provider = "local" as const;

  async interpret(input: AnalyzeInput): Promise<Interpretation> {
    return analyzeProblemDeterministic(input.text, {
      now: input.now,
      locationHint: input.locationHint,
      deadlineHint: input.deadlineHint,
    });
  }
}
