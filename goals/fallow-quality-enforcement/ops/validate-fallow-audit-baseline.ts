#!/usr/bin/env bun

import * as NodeURL from "node:url";

type JsonRecord = Record<string, unknown>;

const textDecoder = new TextDecoder();
const repoRoot = NodeURL.fileURLToPath(new URL("../../../", import.meta.url));

// Post-remediation contract (goals/fallow-zero-dead-code): the audit lane is
// blocking under the new-only gate, so a clean branch must introduce no
// dead-code or complexity, and the dead-code lane must hold at zero.
//
// Duplication is source-aware (FallowQuality.command.ts): introduced duplication
// confined to test/config files is idiomatic boilerplate fallow cannot
// selectively ignore and is advisory, so the raw audit `verdict` may be "warn"
// and `attribution.duplication_introduced` may be non-zero. The pinned
// duplication contract is therefore "zero SOURCE-involving introduced clone
// groups". Inherited-adjacent counts vary by branch and are not pinned.
const expectedAuditSummary = {
  dead_code_issues: 0,
  dead_code_introduced: 0,
  complexity_introduced: 0,
  source_duplication_introduced: 0,
} as const;

// Count introduced duplication clone groups with at least one instance under a
// package/app `src/` tree — the blocking subset the wrapper enforces.
const sourceInvolvingIntroducedDuplication = (audit: JsonRecord): number => {
  const duplication = audit.duplication;
  if (duplication === null || typeof duplication !== "object") {
    return 0;
  }
  const groups = (duplication as JsonRecord).clone_groups;
  if (!Array.isArray(groups)) {
    return 0;
  }
  return groups.filter((group) => {
    if (group === null || typeof group !== "object") {
      return false;
    }
    const record = group as JsonRecord;
    if (record.introduced !== true || !Array.isArray(record.instances)) {
      return false;
    }
    return record.instances.some((instance) => {
      const file = instance !== null && typeof instance === "object" ? (instance as JsonRecord).file : undefined;
      return typeof file === "string" && file.replace(/\\/gu, "/").includes("/src/");
    });
  }).length;
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const asRecord = (value: unknown, label: string): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : fail(`${label}: expected object`);

const extractJsonObject = (text: string, label: string): JsonRecord => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    return fail(`${label}: no JSON object found in command output`);
  }
  try {
    return asRecord(JSON.parse(text.slice(start, end + 1)), label);
  } catch (error) {
    return fail(`${label}: JSON parse failed: ${String(error)}`);
  }
};

const expectEqual = (label: string, actual: unknown, expected: unknown): void => {
  if (actual !== expected) {
    fail(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
};

const expectAtLeast = (label: string, actual: unknown, expected: number): void => {
  if (typeof actual !== "number" || actual < expected) {
    fail(`${label}: expected at least ${expected}, got ${String(actual)}`);
  }
};

const result = Bun.spawnSync(["bun", "run", "fallow:audit", "--", "--base", "origin/main", "--gate", "new-only"], {
  cwd: repoRoot,
  stdout: "pipe",
  stderr: "pipe",
});

expectEqual("fallow audit exit", result.exitCode, 0);

const output = `${textDecoder.decode(result.stdout)}\n${textDecoder.decode(result.stderr)}`;
const audit = extractJsonObject(output, "fallow audit");
const summary = asRecord(audit.summary, "fallow audit.summary");
const attribution = asRecord(audit.attribution, "fallow audit.attribution");

expectEqual("fallow audit attribution gate", attribution.gate, "new-only");
expectAtLeast("fallow audit changed_files_count", audit.changed_files_count, 0);
expectEqual("fallow audit summary.dead_code_issues", summary.dead_code_issues, expectedAuditSummary.dead_code_issues);
expectEqual(
  "fallow audit attribution.dead_code_introduced",
  attribution.dead_code_introduced,
  expectedAuditSummary.dead_code_introduced
);
expectEqual(
  "fallow audit attribution.complexity_introduced",
  attribution.complexity_introduced,
  expectedAuditSummary.complexity_introduced
);
expectEqual(
  "fallow audit source-involving introduced duplication",
  sourceInvolvingIntroducedDuplication(audit),
  expectedAuditSummary.source_duplication_introduced
);

console.log("fallow audit baseline holds the zero-source-duplication contract");
