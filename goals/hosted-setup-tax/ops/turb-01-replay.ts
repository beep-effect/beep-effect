/**
 * TURB-01 slice 1 first-parent replay: which commits stop forcing a full Test Unit run once the
 * generated standards files have owner rows in `CoverageScope.ts`.
 *
 * Run from the repository root:
 *
 *   bun goals/hosted-setup-tax/ops/turb-01-replay.ts [--head 5e09d90a6da] [--commits 727] [--out <json>]
 *
 * The corpus is rebuilt from this repository's own history: the last N first-parent commits of
 * `--head`, each with the files it changed against its first parent (`git log --first-parent -m
 * --name-only`). The receipt records the head, the count and the sha256 of the corpus text, so a
 * rerun proves it replayed the same corpus.
 *
 * Each commit is planned twice by the checkout's `planCoverageAffectedScope` over the checkout's
 * workspace owners:
 *
 * - `after`: the changed files as they are;
 * - `before`: every file a generated-standards row maps is renamed to an unmapped standards path,
 *   which is exactly what the planner did with it before the rows (the "no current workspace
 *   owner" fallback).
 *
 * The replay fails (exit 1) unless every commit whose plan changed was `full` before, is not
 * `full` after, and had only mapped files among its full reasons; it also fails if a commit that
 * was not `full` changed at all. Owners come from the current checkout, not from each commit's
 * tree, so a package that did not exist yet is still an owner; the comparison is between the two
 * planner variants over the same owners.
 *
 * Output: JSON receipt on stdout, also written to `--out` when given.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";

const argument = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};

type Scope =
  | { readonly _tag: "full"; readonly reasons: ReadonlyArray<string> }
  | {
      readonly _tag: "selected";
      readonly packageNames: ReadonlyArray<string>;
      readonly dependentPackageNames: ReadonlyArray<string>;
    }
  | { readonly _tag: "noop" };

type CoverageScopeModule = {
  readonly COVERAGE_GENERATED_STANDARDS_OWNER_ROWS: ReadonlyArray<readonly [string, string, string]>;
  readonly planCoverageAffectedScope: (owners: ReadonlyArray<unknown>, files: ReadonlyArray<string>) => Scope;
  readonly workspaceCoverageScopeOwners: (
    repoRoot: string
  ) => Effect.Effect<ReadonlyArray<unknown>, unknown, NodeServices.NodeServices>;
};

const root = process.cwd();
const head = argument("--head", "5e09d90a6da");
const commits = Number(argument("--commits", "727"));
const out = argument("--out", "");
const UNMAPPED_PREFIX = "standards/.turb-01-unmapped/";

const scopeModule: CoverageScopeModule = await import(
  join(root, "packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts")
);
const owners = await Effect.runPromise(
  scopeModule.workspaceCoverageScopeOwners(root).pipe(Effect.provide(NodeServices.layer))
);

const corpusText =
  await Bun.$`git -C ${root} log --first-parent -m --name-only --format=@@%H -n ${commits} ${head}`.text();
const corpus = corpusText
  .split("@@")
  .filter((block) => block.trim().length > 0)
  .map((block) => {
    const [sha = "", ...files] = block.split("\n").filter((line) => line.length > 0);
    return { sha, files };
  });

// A changed file a row maps, by the same glob the planner compiles (directory rows end in `/**`).
const rowPatterns = scopeModule.COVERAGE_GENERATED_STANDARDS_OWNER_ROWS.map(([, pattern]) => pattern);
const isMapped = (file: string): boolean =>
  rowPatterns.some((pattern) =>
    pattern.endsWith("/**") ? file.startsWith(`${pattern.slice(0, -2)}`) : file === pattern
  );

const describeScope = (scope: Scope): string =>
  scope._tag === "selected"
    ? `selected ${scope.packageNames.length}+${scope.dependentPackageNames.length}`
    : scope._tag;

const changed: Array<{
  readonly sha: string;
  readonly mappedFiles: ReadonlyArray<string>;
  readonly before: string;
  readonly after: string;
  readonly selectedPackages: ReadonlyArray<string>;
  readonly dependentPackages: ReadonlyArray<string>;
}> = [];
const violations: Array<{ readonly sha: string; readonly reason: string }> = [];
let fullBefore = 0;
let fullAfter = 0;
let touchesMapped = 0;

for (const { sha, files } of corpus) {
  const mappedFiles = files.filter(isMapped);
  if (mappedFiles.length > 0) touchesMapped += 1;
  const before = scopeModule.planCoverageAffectedScope(
    owners,
    files.map((file) => (isMapped(file) ? `${UNMAPPED_PREFIX}${file}` : file))
  );
  const after = scopeModule.planCoverageAffectedScope(owners, files);
  if (before._tag === "full") fullBefore += 1;
  if (after._tag === "full") fullAfter += 1;
  if (JSON.stringify(before) === JSON.stringify(after)) continue;
  if (before._tag !== "full") {
    violations.push({ sha, reason: `plan changed from ${describeScope(before)} to ${describeScope(after)}` });
    continue;
  }
  if (after._tag === "full") {
    // Still full: the mapped files left the reasons, nothing else changed.
    const remaining = before.reasons.filter((reason) => !reason.startsWith(UNMAPPED_PREFIX));
    if (JSON.stringify(remaining) !== JSON.stringify(after.reasons)) {
      violations.push({ sha, reason: "full reasons changed beyond the mapped files" });
    }
    continue;
  }
  if (!before.reasons.every((reason) => reason.startsWith(UNMAPPED_PREFIX))) {
    violations.push({ sha, reason: "shrank although a non-mapped file forced full" });
    continue;
  }
  changed.push({
    sha,
    mappedFiles,
    before: describeScope(before),
    after: describeScope(after),
    selectedPackages: after._tag === "selected" ? after.packageNames : [],
    dependentPackages: after._tag === "selected" ? after.dependentPackageNames : [],
  });
}

const receipt = {
  schema: "hosted-setup-tax/turb-01-replay/v1",
  head,
  commitsRequested: commits,
  commitsReplayed: corpus.length,
  corpusSha256: createHash("sha256").update(corpusText).digest("hex"),
  ownerCount: owners.length,
  rows: scopeModule.COVERAGE_GENERATED_STANDARDS_OWNER_ROWS,
  touchesMappedFile: touchesMapped,
  fullBefore,
  fullAfter,
  shrunk: changed.length,
  shrunkToNoop: changed.filter((entry) => entry.after === "noop").length,
  violations,
  shrunkCommits: changed,
};
const json = `${JSON.stringify(receipt, null, 2)}\n`;
if (out.length > 0) writeFileSync(out, json);
process.stdout.write(json);
process.exit(violations.length === 0 ? 0 : 1);
