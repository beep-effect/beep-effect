/**
 * Mechanical clone-agnostic reference rewrite runner (knowledge-surface-automation, Workstream A).
 *
 * Applies the reviewed literal rewrite rules in `scripts/knowledge-refs-rewrite.rules.json` to the
 * working tree. Each rule pins the file it touches, the exact substring it replaces, and the number
 * of occurrences it expects, so the pass is reviewable, re-runnable, and fails loudly on drift:
 *
 * - occurrences == count  -> apply the replacement
 * - occurrences == 0      -> already applied; skip (idempotent re-run)
 * - anything else         -> report and exit non-zero without writing that file
 *
 * Run with: `bun scripts/knowledge-refs-rewrite.ts [--dry-run]`
 * The standing proof that the pass stays applied is `bun run beep knowledge refs --check`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type RewriteRule = {
  readonly path: string;
  readonly find: string;
  readonly replace: string;
  readonly count: number;
  readonly note?: string;
};

type RulesFile = {
  readonly schemaVersion: "knowledge-refs-rewrite/v1";
  readonly rules: ReadonlyArray<RewriteRule>;
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const rulesPath = join(repoRoot, "scripts", "knowledge-refs-rewrite.rules.json");
const rulesFile: RulesFile = JSON.parse(readFileSync(rulesPath, "utf8"));

if (rulesFile.schemaVersion !== "knowledge-refs-rewrite/v1") {
  console.error(`unexpected schemaVersion: ${String(rulesFile.schemaVersion)}`);
  process.exit(1);
}

const countOccurrences = (haystack: string, needle: string): number => {
  let total = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    total += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return total;
};

const byPath = new Map<string, Array<RewriteRule>>();
for (const rule of rulesFile.rules) {
  const bucket = byPath.get(rule.path) ?? [];
  bucket.push(rule);
  byPath.set(rule.path, bucket);
}

let applied = 0;
let skipped = 0;
const failures: Array<string> = [];

for (const [path, rules] of byPath) {
  const filePath = join(repoRoot, path);
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    failures.push(`${path}: unreadable`);
    continue;
  }
  let nextText = text;
  let fileFailed = false;
  for (const rule of rules) {
    const occurrences = countOccurrences(nextText, rule.find);
    if (occurrences === 0) {
      skipped += 1;
      continue;
    }
    if (occurrences !== rule.count) {
      failures.push(
        `${path}: expected ${rule.count} occurrence(s) of ${JSON.stringify(rule.find)}, found ${occurrences}`
      );
      fileFailed = true;
      continue;
    }
    nextText = nextText.split(rule.find).join(rule.replace);
    applied += 1;
  }
  if (!fileFailed && nextText !== text && !dryRun) {
    writeFileSync(filePath, nextText);
  }
}

console.log(`knowledge-refs-rewrite: ${applied} applied, ${skipped} already-applied${dryRun ? " (dry run)" : ""}`);
if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  process.exit(1);
}
