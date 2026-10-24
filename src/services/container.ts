/**
 * Dependency container. Selects persistence + AI adapters from environment.
 * Local mode is the default and requires no AWS credentials.
 *
 *   PATCH_PERSISTENCE = "local" (default) | "dynamo"
 *   PATCH_AI_PROVIDER = "local" (default) | "bedrock"
 */
import { AIService } from "./ai";
import { LocalAIService } from "./ai.local";
import { Repository } from "./repository";
import { LocalRepository } from "./repository.local";
import { logger } from "./logger";

let repoSingleton: Repository | null = null;
let aiSingleton: AIService | null = null;

export function getRepository(): Repository {
  if (repoSingleton) return repoSingleton;
  const mode = process.env.PATCH_PERSISTENCE ?? "local";
  if (mode === "dynamo") {
    // Lazy require so the DynamoDB SDK stays optional for local installs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DynamoRepository } = require("./repository.dynamo") as typeof import("./repository.dynamo");
    logger.info("Using DynamoDB repository.");
    repoSingleton = new DynamoRepository();
  } else {
    repoSingleton = new LocalRepository();
  }
  return repoSingleton;
}

export function getAIService(): AIService {
  if (aiSingleton) return aiSingleton;
  const provider = process.env.PATCH_AI_PROVIDER ?? "local";
  if (provider === "bedrock") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BedrockAIService } = require("./ai.bedrock") as typeof import("./ai.bedrock");
    logger.info("Using Bedrock AI provider.");
    aiSingleton = new BedrockAIService();
  } else {
    aiSingleton = new LocalAIService();
  }
  return aiSingleton;
}

export function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.PATCH_DEV_TOOLS === "1";
}

/** Test helper to reset singletons between suites. */
export function __resetContainer() {
  repoSingleton = null;
  aiSingleton = null;
}
