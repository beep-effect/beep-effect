/**
 * TURB-01 slice 1b first-parent replay: which commits stop forcing a full Test Unit run once the
 * remaining "no current workspace owner" paths (the skill tree and its lock, the harness ledger,
 * the Biome identity config, the check-census baseline and the root-package projection) have
 * owner rows in `CoverageScope.ts`.
 *
 * Run from the repository root:
 *
 *   bun goals/hosted-setup-tax/ops/turb-01b-replay.ts [--head <ref>] [--before-ref <ref>] [--commits 1000] [--out <json>]
 *
 * `--head` and `--before-ref` default to the merge base of `HEAD` and `origin/main`. The corpus is
 * the last N first-parent commits of `--head`, each with the files it changed against its first
 * parent (`git log --first-parent -m --name-only`); the receipt records its sha256.
 *
 * Each commit is planned twice over the checkout's workspace owners:
 *
 * - `before`: the planner exactly as it stood at `--before-ref`. Its `CoverageScope.ts` is written
 *   beside the current one for the run (and removed after the import), so it shares every sibling
 *   module and plans with the rows that ref had, hand-written rows included;
 * - `after`: the checkout's planner.
 *
 * A newly mapped file matches a row pattern of `COVERAGE_SCANNED_OWNER_ROWS` that the before
 * planner's `COVERAGE_GENERATED_STANDARDS_OWNER_ROWS` did not have. The replay fails (exit 1) when
 *
 * - a commit that shrank from `full` had a full reason other than a newly mapped file's;
 * - a commit that stays `full` lost a reason other than a newly mapped file's, or gained one;
 * - a commit that was not `full` changed without touching a newly mapped file, became `full`, or
 *   lost a selected package.
 *
 * A commit that was not `full` and gained packages through a newly mapped file is reported as
 * widened, not as a failure: a tree's scanned readers apply to every file in it, including a file
 * that already had a narrower hand-written row.
 *
 * Partition counts are the Test Unit partitions the coverage planner's selection alone allocates
 * (`plannedCiLanePartitions`); Turbo's own `--affected` selection can add more on a real run.
 *
 * Output: JSON receipt on stdout, also written to `--out` when given.
 */
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
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

type OwnerRow = readonly [string, string, string];

type PlannerModule = {
  readonly COVERAGE_GENERATED_STANDARDS_OWNER_ROWS: ReadonlyArray<OwnerRow>;
  readonly planCoverageAffectedScope: (owners: ReadonlyArray<unknown>, files: ReadonlyArray<string>) => Scope;
};

type CurrentPlannerModule = PlannerModule & {
  readonly COVERAGE_SCANNED_OWNER_ROWS: ReadonlyArray<OwnerRow>;
  readonly workspaceCoverageScopeOwners: (
    repoRoot: string
  ) => Effect.Effect<ReadonlyArray<unknown>, unknown, NodeServices.NodeServices>;
};

type CiLaneModule = {
  readonly plannedCiLanePartitions: (
    laneId: "test-unit",
    taskPackageNames: ReadonlyArray<string>,
    selectedTaskPackageNames: ReadonlyArray<string>
  ) => ReadonlyArray<string>;
};

const root = process.cwd();
const mergeBase = (await Bun.$`git -C ${root} merge-base HEAD origin/main`.text()).trim();
const head = argument("--head", mergeBase);
const beforeRef = argument("--before-ref", mergeBase);
const commits = Number(argument("--commits", "1000"));
const out = argument("--out", "");

const scopeDirectory = join(root, "packages/tooling/tool/cli/src/commands/Quality/internal");
const scopeSource = "packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts";
const beforeModulePath = join(scopeDirectory, "CoverageScope.turb-01b-before.ts");

const after: CurrentPlannerModule = await import(join(root, scopeSource));
const beforeSha = (await Bun.$`git -C ${root} rev-parse ${beforeRef}`.text()).trim();
writeFileSync(beforeModulePath, await Bun.$`git -C ${root} show ${beforeSha}:${scopeSource}`.text());
const before: PlannerModule = await import(beforeModulePath).finally(() => rmSync(beforeModulePath, { force: true }));
const ciLane: CiLaneModule = await import(join(root, "packages/tooling/tool/cli/src/commands/Ci/CiLane.ts"));

const owners = await Effect.runPromise(
  after.workspaceCoverageScopeOwners(root).pipe(Effect.provide(NodeServices.layer))
);

// Test Unit task packages: workspace manifests with a `test` script, labs excluded (CiLane does the same).
const taskPackageNames = (await Bun.$`git -C ${root} ls-files ${"*package.json"}`.text())
  .split("\n")
  .filter((file) => file.length > 0 && file !== "package.json" && !file.startsWith("apps/labs/"))
  .flatMap((file) => {
    const manifest = JSON.parse(readFileSync(join(root, file), "utf8")) as {
      readonly name?: string;
      readonly scripts?: Readonly<Record<string, string>>;
    };
    return manifest.name !== undefined && manifest.scripts?.test !== undefined ? [manifest.name] : [];
  })
  .sort();

const partitionsFor = (scope: Scope): number =>
  scope._tag === "selected"
    ? ciLane.plannedCiLanePartitions("test-unit", taskPackageNames, [
        ...scope.packageNames,
        ...scope.dependentPackageNames,
      ]).length
    : scope._tag === "noop"
      ? 0
      : ciLane.plannedCiLanePartitions("test-unit", taskPackageNames, taskPackageNames).length;

// A changed file a row maps, by the same glob the planner compiles (directory rows end in `/**`).
const matchesPattern = (file: string, pattern: string): boolean =>
  pattern.endsWith("/**") ? file.startsWith(pattern.slice(0, -2)) : file === pattern;
const beforePatterns = new Set(before.COVERAGE_GENERATED_STANDARDS_OWNER_ROWS.map(([, pattern]) => pattern));
const newRows = after.COVERAGE_SCANNED_OWNER_ROWS.filter(([, pattern]) => !beforePatterns.has(pattern));
const newPatterns = [...new Set(newRows.map(([, pattern]) => pattern))];
const isNewlyMapped = (file: string): boolean => newPatterns.some((pattern) => matchesPattern(file, pattern));
const reasonFile = (reason: string): string => reason.slice(0, reason.lastIndexOf(": "));
const isNewlyMappedReason = (reason: string): boolean =>
  reason.endsWith(": no current workspace owner") && isNewlyMapped(reasonFile(reason));

const corpusText =
  await Bun.$`git -C ${root} log --first-parent -m --name-only --format=@@%H -n ${commits} ${head}`.text();
const corpus = corpusText
  .split("@@")
  .filter((block) => block.trim().length > 0)
  .map((block) => {
    const [sha = "", ...files] = block.split("\n").filter((line) => line.length > 0);
    return { sha, files };
  });

const describeScope = (scope: Scope): string =>
  scope._tag === "selected"
    ? `selected ${scope.packageNames.length}+${scope.dependentPackageNames.length}`
    : scope._tag;
const selectedNames = (scope: Scope): ReadonlyArray<string> =>
  scope._tag === "selected" ? [...new Set([...scope.packageNames, ...scope.dependentPackageNames])].sort() : [];

type Entry = {
  readonly sha: string;
  readonly newlyMappedFiles: ReadonlyArray<string>;
  readonly before: string;
  readonly after: string;
  readonly partitionsBefore: number;
  readonly partitionsAfter: number;
  readonly selectedPackages: ReadonlyArray<string>;
};
const shrunk: Array<Entry> = [];
const widened: Array<Entry & { readonly addedPackages: ReadonlyArray<string> }> = [];
const violations: Array<{ readonly sha: string; readonly reason: string }> = [];
let fullBefore = 0;
let fullAfter = 0;
let touchesNewlyMapped = 0;
let fullLostNewlyMappedReasons = 0;

for (const { sha, files } of corpus) {
  const newlyMappedFiles = files.filter(isNewlyMapped);
  if (newlyMappedFiles.length > 0) touchesNewlyMapped += 1;
  const planBefore = before.planCoverageAffectedScope(owners, files);
  const planAfter = after.planCoverageAffectedScope(owners, files);
  if (planBefore._tag === "full") fullBefore += 1;
  if (planAfter._tag === "full") fullAfter += 1;
  if (JSON.stringify(planBefore) === JSON.stringify(planAfter)) continue;
  const entry: Entry = {
    sha,
    newlyMappedFiles,
    before: describeScope(planBefore),
    after: describeScope(planAfter),
    partitionsBefore: partitionsFor(planBefore),
    partitionsAfter: partitionsFor(planAfter),
    selectedPackages: selectedNames(planAfter),
  };
  if (planBefore._tag === "full") {
    if (planAfter._tag === "full") {
      const remaining = planBefore.reasons.filter((reason) => !isNewlyMappedReason(reason));
      if (JSON.stringify(remaining) === JSON.stringify(planAfter.reasons)) fullLostNewlyMappedReasons += 1;
      else violations.push({ sha, reason: "full reasons changed beyond the newly mapped files" });
    } else if (planBefore.reasons.every(isNewlyMappedReason)) {
      shrunk.push(entry);
    } else {
      violations.push({ sha, reason: "shrank although a file that is not newly mapped forced full" });
    }
    continue;
  }
  const lost = selectedNames(planBefore).filter((name) => !selectedNames(planAfter).includes(name));
  if (planAfter._tag === "full" || newlyMappedFiles.length === 0 || lost.length > 0) {
    violations.push({ sha, reason: `plan changed from ${entry.before} to ${entry.after}` });
    continue;
  }
  widened.push({
    ...entry,
    addedPackages: selectedNames(planAfter).filter((name) => !selectedNames(planBefore).includes(name)),
  });
}

const fullPartitions = partitionsFor({ _tag: "full", reasons: [] });
const receipt = {
  schema: "hosted-setup-tax/turb-01b-replay/v1",
  head: (await Bun.$`git -C ${root} rev-parse ${head}`.text()).trim(),
  beforeRef: beforeSha,
  commitsRequested: commits,
  commitsReplayed: corpus.length,
  corpusSha256: createHash("sha256").update(corpusText).digest("hex"),
  ownerCount: owners.length,
  testUnitPartitions: fullPartitions,
  newRows,
  touchesNewlyMappedFile: touchesNewlyMapped,
  fullBefore,
  fullAfter,
  shrunk: shrunk.length,
  shrunkToNoop: shrunk.filter((entry) => entry.after === "noop").length,
  shrunkPartitionsSaved: shrunk.reduce((total, entry) => total + entry.partitionsBefore - entry.partitionsAfter, 0),
  stillFullWithFewerReasons: fullLostNewlyMappedReasons,
  widened: widened.length,
  widenedPartitionsAdded: widened.reduce((total, entry) => total + entry.partitionsAfter - entry.partitionsBefore, 0),
  violations,
  shrunkCommits: shrunk,
  widenedCommits: widened,
};
const json = `${JSON.stringify(receipt, null, 2)}\n`;
if (out.length > 0) writeFileSync(out, json);
process.stdout.write(json);
process.exit(violations.length === 0 ? 0 : 1);
