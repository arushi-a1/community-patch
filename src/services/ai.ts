/**
 * AIService interface. Producers: the deterministic local analyzer (always
 * available) and the Bedrock adapter. Both return a strictly-validated
 * Interpretation. The core product never depends on AI being available (FR-13).
 */
import { Interpretation } from "@/domain/interpretation";

export interface AnalyzeInput {
  text: string;
  locationHint?: string;
  deadlineHint?: string;
  now?: Date;
}

export interface AIService {
  /** Name of the active provider, for honest UI labeling / diagnostics. */
  readonly provider: "local" | "bedrock";
  /** Interpret a free-text problem into a validated Interpretation. */
  interpret(input: AnalyzeInput): Promise<Interpretation>;
}
