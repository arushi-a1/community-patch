/**
 * Evaluation runner. Executes the eval set against the fix pipeline + seed data
 * and reports measured pass/fail per behavioral expectation. Importantly, it
 * MEASURES results rather than asserting an accuracy number up front.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalRepository } from "@/services/repository.local";
import { LocalAIService } from "@/services/ai.local";
import { AIService } from "@/services/ai";
import { buildSeed } from "@/seed/data";
import { runFix } from "@/services/fixService";
import { EVAL_CASES, EvalCase } from "./cases";

export interface CaseResult {
  id: string;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
  pass: boolean;
}

export interface EvalReport {
  provider: string;
  total: number;
  passed: number;
  results: CaseResult[];
}

async function seededRepo(): Promise<LocalRepository> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "patch-eval-"));
  const repo = new LocalRepository(dir);
  const { users, resources, requests } = buildSeed(new Date());
  await repo.loadSeed({
    users: Object.fromEntries(users.map((u) => [u.id, u])),
    resources: Object.fromEntries(resources.map((r) => [r.id, r])),
    requests: Object.fromEntries(requests.map((r) => [r.id, r])),
  });
  return repo;
}

export async function runEval(ai: AIService = new LocalAIService()): Promise<EvalReport> {
  const repo = await seededRepo();
  const results: CaseResult[] = [];

  for (const c of EVAL_CASES) {
    const checks = await evaluateCase(repo, ai, c);
    const pass = checks.every((ch) => ch.pass);
    results.push({ id: c.id, checks, pass });
  }

  const passed = results.filter((r) => r.pass).length;
  return { provider: ai.provider, total: results.length, passed, results };
}

async function evaluateCase(
  repo: LocalRepository,
  ai: AIService,
  c: EvalCase,
): Promise<CaseResult["checks"]> {
  const location =
    c.requesterLat != null && c.requesterLng != null
      ? { label: "Your location", zone: c.requesterZone ?? "Central", lat: c.requesterLat, lng: c.requesterLng }
      : c.requesterZone
        ? { label: "Your location", zone: c.requesterZone }
        : undefined;

  const result = await runFix(repo, ai, {
    text: c.text,
    communityId: "campus-demo",
    requesterId: "user-maya",
    requesterLocation: location,
  });

  const checks: CaseResult["checks"] = [];
  const matchIds = result.matches.map((m) => m.resource.id);

  if (c.expect.requestType) {
    checks.push({
      name: `requestType=${c.expect.requestType}`,
      pass: result.interpretation.request_type === c.expect.requestType,
      detail: `got ${result.interpretation.request_type}`,
    });
  }

  if (c.expect.mustMatchAny) {
    const ok = c.expect.mustMatchAny.some((id) => matchIds.includes(id));
    checks.push({
      name: `matches any of [${c.expect.mustMatchAny.join(", ")}]`,
      pass: ok,
      detail: `got [${matchIds.join(", ")}]`,
    });
  }

  if (c.expect.mustNotMatch) {
    const bad = c.expect.mustNotMatch.filter((id) => matchIds.includes(id));
    checks.push({
      name: `excludes [${c.expect.mustNotMatch.join(", ")}]`,
      pass: bad.length === 0,
      detail: bad.length ? `wrongly included [${bad.join(", ")}]` : undefined,
    });
  }

  if (c.expect.expectNoMatch) {
    checks.push({
      name: "no primary match (honest)",
      pass: result.matches.length === 0,
      detail: `got ${result.matches.length} matches`,
    });
  }

  if (c.expect.expectAlternative) {
    checks.push({
      name: "at least one alternative",
      pass: result.alternatives.length > 0,
      detail: `got ${result.alternatives.length}`,
    });
  }

  // Universal grounding check: every returned resource must actually exist.
  const allReturned = [
    ...result.matches.map((m) => m.resource.id),
    ...result.alternatives.map((a) => a.resource.id),
  ];
  let grounded = true;
  for (const id of allReturned) {
    if (!(await repo.getResource(id))) grounded = false;
  }
  checks.push({ name: "all results are real resources (grounded)", pass: grounded });

  return checks;
}
