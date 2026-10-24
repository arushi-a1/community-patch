import { describe, it, expect } from "vitest";
import { runEval } from "@/eval/runner";
import { LocalAIService } from "@/services/ai.local";

describe("AI/matching evaluation set (deterministic provider)", () => {
  it("passes every behavioral case", async () => {
    const report = await runEval(new LocalAIService());
    const failing = report.results.filter((r) => !r.pass);
    if (failing.length) {
      // Surface detail for debugging.
      const detail = failing
        .map((f) => `${f.id}: ${f.checks.filter((c) => !c.pass).map((c) => `${c.name} (${c.detail ?? ""})`).join("; ")}`)
        .join("\n");
      throw new Error(`Eval failures:\n${detail}`);
    }
    expect(report.passed).toBe(report.total);
  });
});
