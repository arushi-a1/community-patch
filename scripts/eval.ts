/**
 * Run the evaluation set and print a measured report.
 *   npm run eval
 * Uses the deterministic local provider by default. To evaluate Bedrock,
 * set PATCH_AI_PROVIDER=bedrock and the Bedrock env vars (see .env.example).
 */
import { runEval } from "../src/eval/runner";
import { LocalAIService } from "../src/services/ai.local";

async function main() {
  // Default to local; Bedrock would be wired via container in a server context.
  const report = await runEval(new LocalAIService());

  console.log(`\nPATCH evaluation — provider: ${report.provider}`);
  console.log("=".repeat(56));
  for (const r of report.results) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(`\n[${icon}] ${r.id}`);
    for (const c of r.checks) {
      const mark = c.pass ? "  ok " : "  xx ";
      console.log(`${mark}${c.name}${c.detail && !c.pass ? ` — ${c.detail}` : ""}`);
    }
  }
  console.log("\n" + "=".repeat(56));
  console.log(`Result: ${report.passed}/${report.total} cases passed.`);
  if (report.passed !== report.total) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Eval failed:", e);
  process.exit(1);
});
