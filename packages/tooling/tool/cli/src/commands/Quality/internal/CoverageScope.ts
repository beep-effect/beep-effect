/**
 * Safe pull-request scope planning for the coverage regression lane.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, MutableHashMap, MutableHashSet, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { isLabsWorkspacePath } from "../../../internal/cli/Labs/index.ts";
import { QualityTaskConfigurationError } from "../Quality.errors.ts";
import { discoverWorkspacePackages } from "./QualityArtifactSupport.ts";
import type { FileSystem } from "effect";
import type { PackageJson } from "./QualityArtifactSupport.ts";

const $I = $RepoCliId.create("commands/Quality/internal/CoverageScope");

// Mirrors `coverageRegressionBaselinePath` in CoverageRegression.ts, which
// imports this module; the literal stays here to keep the dependency one-way.
const COVERAGE_BASELINE_PATH = "standards/coverage.regression-baseline.jsonc";

const COVERAGE_FULL_INPUT_FILES = [
  ".bun-version",
  "bun.lock",
  "package.json",
  COVERAGE_BASELINE_PATH,
  "packages/tooling/tool/cli/src/commands/Quality/Quality.errors.ts",
  "packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts",
  "packages/tooling/tool/cli/src/commands/Quality/Tasks.ts",
  "packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts",
  "packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts",
  "packages/tooling/tool/cli/src/internal/repo-run/ChangedFiles.ts",
  "turbo.json",
  "tsconfig.base.json",
  "tsconfig.json",
  "tsconfig.packages.json",
  "vitest.config.ts",
] as const;

const COVERAGE_FULL_INPUT_PREFIXES = [
  ".github/",
  "packages/tooling/test-kit/",
  "packages/tooling/tool/cli/src/commands/Ci/",
  "packages/tooling/tool/cli/src/commands/Quality/internal/Coverage",
  "packages/tooling/tool/cli/src/internal/artifacts/",
  "packages/tooling/tool/cli/src/internal/process/",
  "packages/tooling/tool/cli/src/internal/ratchet/",
] as const;

const COVERAGE_NOOP_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
] as const;

const COVERAGE_NOOP_PREFIXES = [".changeset/", "docs/", "explorations/", "goals/", "research/"] as const;

// These tracked goal artifacts are executable test inputs, not documentation.
// Keep the mapping next to the no-op policy so a goal-only change can remain
// scoped without hiding the package whose tests consume the fixture.
const COVERAGE_REPOSITORY_FIXTURE_OWNER_FILES: ReadonlyArray<readonly [string, string]> = [
  ["goals/fallow-quality-enforcement/research/feature-matrix.jsonc", "@beep/repo-cli"],
];

const COVERAGE_REPOSITORY_FIXTURE_OWNER_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["goals/speed-loop/ops/runner-burst/", "@beep/repo-cli"],
];

// Seconds observed in the correctness-green Coverage Regression run for PR
// #707 (run 31766791221, job 94664247028). These measured long poles account
// for roughly 60% of the package test time and override the older profile
// below; retaining the older map for the tail avoids replacing evidence with
// estimates for packages whose live duration remained small.
const COVERAGE_LIVE_TASK_WEIGHT_SECONDS: Readonly<Record<string, number>> = {
  "@beep/db-admin": 88.16,
  "@beep/dock": 66.52,
  "@beep/documents-server": 69.82,
  "@beep/editor": 57.06,
  "@beep/epistemic-server": 47.49,
  "@beep/epistemic-use-cases": 48.28,
  "@beep/law-practice-server": 103.9,
  "@beep/lexical-schema": 87.89,
  "@beep/lint-rules": 42.2,
  "@beep/nlp": 49.24,
  "@beep/nlp-processing": 48.09,
  "@beep/observability": 85.07,
  "@beep/ontology-client": 54.64,
  "@beep/professional-desktop": 279.09,
  "@beep/repo-ai-metrics": 79.94,
  "@beep/repo-cli": 720.62,
  "@beep/repo-utils": 605.03,
  "@beep/schema": 83.53,
  "@beep/test-utils": 49.55,
  "@beep/wink": 48.1,
} as const;

// Seconds observed in the accepted zero-cache Coverage Regression run for
// PR #684 (run 31727475076, job 94539333691). Unlisted packages use the
// conservative default below. The weights influence placement only; every
// current coverage owner is still assigned exactly once.
const COVERAGE_TASK_WEIGHT_SECONDS: Readonly<Record<string, number>> = {
  "@beep/acp": 13.4,
  "@beep/agents-client": 22.8,
  "@beep/agents-domain": 9.29,
  "@beep/agents-server": 22.7,
  "@beep/agents-tables": 12.4,
  "@beep/agents-use-cases": 11.5,
  "@beep/ai-provider-cli": 11.9,
  "@beep/ai-sync": 9.82,
  "@beep/anthropic": 9.37,
  "@beep/api-transport": 8.11,
  "@beep/architecture-lab-client": 7.88,
  "@beep/architecture-lab-config": 7.62,
  "@beep/architecture-lab-domain": 9.52,
  "@beep/architecture-lab-proof": 15.7,
  "@beep/architecture-lab-server": 11.3,
  "@beep/architecture-lab-tables": 7.91,
  "@beep/architecture-lab-ui": 8.82,
  "@beep/architecture-lab-use-cases": 9.13,
  "@beep/box": 10.8,
  "@beep/chalk": 7.54,
  "@beep/colors": 14.5,
  "@beep/cosmos": 7.45,
  "@beep/data": 3.02,
  "@beep/db-admin": 35,
  "@beep/discord": 7.24,
  "@beep/doc-text": 13,
  "@beep/dock": 25.1,
  "@beep/dock-react": 21.6,
  "@beep/documents-domain": 12,
  "@beep/documents-server": 28.2,
  "@beep/documents-tables": 17.6,
  "@beep/documents-use-cases": 17.6,
  "@beep/drizzle": 7.93,
  "@beep/duckdb": 8.85,
  "@beep/ecfr": 7.99,
  "@beep/editor": 34.2,
  "@beep/effect-drizzle": 4.78,
  "@beep/epistemic-client": 10.1,
  "@beep/epistemic-config": 13,
  "@beep/epistemic-domain": 13.8,
  "@beep/epistemic-server": 20.2,
  "@beep/epistemic-tables": 13.8,
  "@beep/epistemic-ui": 15.8,
  "@beep/epistemic-use-cases": 18.5,
  "@beep/exiftool": 14.3,
  "@beep/face-detection": 7.91,
  "@beep/fc-runs": 1.13,
  "@beep/ffmpeg": 11.6,
  "@beep/file-processing": 13.1,
  "@beep/firecrawl": 8.93,
  "@beep/gov-legal-mcp": 13.4,
  "@beep/govinfo": 8.45,
  "@beep/html": 44.5,
  "@beep/hubspot": 9.95,
  "@beep/identity": 3.63,
  "@beep/langextract": 17.2,
  "@beep/law-practice-domain": 16.5,
  "@beep/law-practice-server": 51.7,
  "@beep/law-practice-tables": 18.4,
  "@beep/law-practice-use-cases": 15.8,
  "@beep/lexical-schema": 126,
  "@beep/libpff": 14.4,
  "@beep/lint-rules": 23.1,
  "@beep/m365": 8.88,
  "@beep/m365-mcp": 8.15,
  "@beep/mcp-kit": 12.8,
  "@beep/md": 20.3,
  "@beep/n3": 7.87,
  "@beep/nlp": 16.1,
  "@beep/nlp-mcp": 13.8,
  "@beep/nlp-processing": 22.7,
  "@beep/obs": 11.6,
  "@beep/observability": 34.7,
  "@beep/oip-web": 15.4,
  "@beep/onepassword-cli": 8.1,
  "@beep/ontology": 11,
  "@beep/ontology-client": 19.8,
  "@beep/ontology-config": 1.45,
  "@beep/ontology-domain": 1.95,
  "@beep/ontology-server": 19.5,
  "@beep/ontology-ui": 13.8,
  "@beep/ontology-use-cases": 18.8,
  "@beep/openai-compat": 19.1,
  "@beep/openclaw": 12.5,
  "@beep/oxigraph": 9.67,
  "@beep/pacer": 17.1,
  "@beep/pandoc-ast": 14.3,
  "@beep/pglite": 15.5,
  "@beep/phoenix": 8.15,
  "@beep/postgres": 12.1,
  "@beep/pretext": 10.8,
  "@beep/repo-cli": 768,
  "@beep/professional-desktop": 88,
  "@beep/provenance": 7.63,
  "@beep/qa-capture": 19.6,
  "@beep/rdf": 8.34,
  "@beep/rdf-canonize": 8.72,
  "@beep/repo-ai-metrics": 41.6,
  "@beep/repo-configs": 20.6,
  "@beep/repo-docgen": 16.1,
  "@beep/repo-utils": 449,
  "@beep/runpod": 24.2,
  "@beep/sanity": 8.68,
  "@beep/schema": 27.2,
  "@beep/semantic-web": 14.2,
  "@beep/shacl": 9.83,
  "@beep/shared-domain": 15.8,
  "@beep/shared-tables": 7.63,
  "@beep/tailscale": 9.75,
  "@beep/test-utils": 33.2,
  "@beep/tika": 16.6,
  "@beep/types": 0.888,
  "@beep/ui": 15.9,
  "@beep/uspto": 7.63,
  "@beep/uspto-mcp": 10.8,
  "@beep/utils": 2.97,
  "@beep/venice-ai": 8.72,
  "@beep/wink": 27.9,
  "@beep/workspace-domain": 10.3,
  "@beep/workspace-server": 20.3,
  "@beep/workspace-tables": 13.3,
  "@beep/workspace-use-cases": 14,
  "@beep/xai": 8.95,
} as const;

const DEFAULT_COVERAGE_TASK_WEIGHT_SECONDS = 15;

const isExactFile = (candidates: ReadonlyArray<string>, filePath: string): boolean =>
  A.some(candidates, (candidate) => candidate === filePath);

const hasPrefix = (prefixes: ReadonlyArray<string>, filePath: string): boolean =>
  A.some(prefixes, (prefix) => Str.startsWith(prefix)(filePath));

/**
 * Workspace metadata needed to map a changed file to a coverage owner.
 *
 * **Details**
 *
 * `workspaceDependencies` lists the workspace-internal packages this owner
 * depends on across every `package.json` dependency bucket. The planner
 * inverts those edges to select dependents of a changed owner. It defaults to
 * no edges so an owner built without graph knowledge stays a leaf.
 *
 * **Example** (Describe one coverage owner)
 *
 * ```ts
 * import { CoverageScopeOwner } from "@beep/repo-cli/test/Quality"
 *
 * const owner = CoverageScopeOwner.make({
 *   packageName: "@beep/schema",
 *   packagePath: "packages/foundation/modeling/schema",
 *   hasCoverage: true,
 *   workspaceDependencies: ["@beep/utils"]
 * })
 * console.log(owner.workspaceDependencies)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageScopeOwner extends S.Class<CoverageScopeOwner>($I`CoverageScopeOwner`)(
  {
    hasCoverage: S.Boolean,
    packageName: S.String,
    packagePath: S.String,
    workspaceDependencies: S.Array(S.String).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<string>>([])),
  },
  $I.annote("CoverageScopeOwner", {
    description:
      "Workspace path, coverage capability, and workspace-internal dependencies used by pull-request scope planning.",
  })
) {}

const workspacePackageHasCoverage = (scripts: Readonly<Record<string, string>> | undefined): boolean =>
  pipe(scripts ?? {}, R.get("coverage"), O.isSome);

const WORKSPACE_ROOT_PACKAGE_PATH = ".";

const isWorkspaceRootPackage = (info: { readonly path: string }): boolean => info.path === WORKSPACE_ROOT_PACKAGE_PATH;

const PACKAGE_JSON_DEPENDENCY_BUCKETS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

// Every dependency name declared in any bucket, restricted to names that are
// workspace packages. Bucket kind is irrelevant to coverage: a devDependency
// can change a dependent's measured behaviour exactly like a runtime one.
const workspaceDependencyNames = (
  packageJson: PackageJson,
  workspaceNames: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<string> =>
  pipe(
    PACKAGE_JSON_DEPENDENCY_BUCKETS,
    A.flatMap((bucket) => R.keys(packageJson[bucket] ?? {})),
    A.filter((name) => MutableHashSet.has(workspaceNames, name) && name !== packageJson.name),
    A.dedupe,
    A.sort(Order.String)
  );

/**
 * Discover the workspace owners consumed by affected coverage planning.
 *
 * **Details**
 *
 * Both affected coverage execution and unscoped baseline writes use this
 * function, so package ownership and coverage-script detection cannot drift
 * between the two planners.
 *
 * **Example** (Build the shared owner effect)
 *
 * ```ts
 * import { workspaceCoverageScopeOwners } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(workspaceCoverageScopeOwners(process.cwd()))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root containing the workspace manifest.
 * @returns Sorted workspace owners and their coverage capability.
 * @category utilities
 * @since 0.0.0
 */
export const workspaceCoverageScopeOwners = Effect.fn("CoverageScope.workspaceCoverageScopeOwners")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<CoverageScopeOwner>,
  QualityTaskConfigurationError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const packageMap = yield* discoverWorkspacePackages(repoRoot, path).pipe(
    QualityTaskConfigurationError.mapError("Failed to discover workspace packages for coverage scope planning.")
  );
  const workspaceNames = MutableHashSet.fromIterable(MutableHashMap.keys(packageMap));

  return pipe(
    A.fromIterable(MutableHashMap.values(packageMap)),
    // The repository root declares a `coverage` script (the aggregate runner)
    // and depends on workspace packages, so it would otherwise be selected as
    // a dependent of nearly everything and recurse into the root task.
    A.filter((info) => !isWorkspaceRootPackage(info)),
    A.map((info) =>
      CoverageScopeOwner.make({
        hasCoverage: workspacePackageHasCoverage(info.packageJson.scripts),
        packageName: info.name,
        packagePath: info.path,
        workspaceDependencies: workspaceDependencyNames(info.packageJson, workspaceNames),
      })
    ),
    A.sort(Order.mapInput(Order.String, (owner: CoverageScopeOwner) => owner.packageName))
  );
});

class CoverageFullScope extends S.TaggedClass<CoverageFullScope>($I`CoverageFullScope`)(
  "full",
  { reasons: S.Array(S.String) },
  $I.annote("CoverageFullScope", {
    description: "Coverage plan that falls back to the complete workspace because a global or unknown input changed.",
  })
) {}

class CoverageSelectedScope extends S.TaggedClass<CoverageSelectedScope>($I`CoverageSelectedScope`)(
  "selected",
  {
    packageNames: S.Array(S.String),
    dependentPackageNames: S.Array(S.String).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<string>>([])),
  },
  $I.annote("CoverageSelectedScope", {
    description:
      "Coverage plan containing every coverage owner to measure: the directly changed owners plus the coverage-bearing workspace dependents listed in dependentPackageNames.",
  })
) {}

class CoverageNoopScope extends S.TaggedClass<CoverageNoopScope>($I`CoverageNoopScope`)(
  "noop",
  {},
  $I.annote("CoverageNoopScope", {
    description: "Coverage plan for a change set with no coverage-bearing or global inputs.",
  })
) {}

/**
 * Pull-request coverage scope: complete fallback, exact owners, or no work.
 *
 * **Example** (Decode a no-op scope)
 *
 * ```ts
 * import { CoverageAffectedScope } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * const scope = S.decodeUnknownSync(CoverageAffectedScope)({ _tag: "noop" })
 * console.log(scope._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoverageAffectedScope = S.Union([CoverageFullScope, CoverageSelectedScope, CoverageNoopScope]).pipe(
  $I.annoteSchema("CoverageAffectedScope", {
    description: "Safe coverage execution scope derived from pull-request changed files.",
  })
);

/**
 * Pull-request coverage scope: complete fallback, exact owners, or no work.
 *
 * @see {@link CoverageAffectedScope} for the runtime schema and variants.
 * @category models
 * @since 0.0.0
 */
export type CoverageAffectedScope = typeof CoverageAffectedScope.Type;

/**
 * One stable full-run coverage shard and its estimated hosted weight.
 *
 * **Example** (Inspect a shard)
 *
 * ```ts
 * import { CoverageFullShard } from "@beep/repo-cli/test/Quality"
 *
 * const shard = CoverageFullShard.make({ index: 1, packageNames: ["@beep/schema"], weightSeconds: 15 })
 * console.log(shard.packageNames)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageFullShard extends S.Class<CoverageFullShard>($I`CoverageFullShard`)(
  {
    index: S.Int,
    packageNames: S.Array(S.String),
    weightSeconds: S.Finite,
  },
  $I.annote("CoverageFullShard", {
    description: "Deterministic least-loaded coverage shard derived from hosted task weights.",
  })
) {}

type MutableCoverageShard = {
  readonly index: number;
  readonly packageNames: Array<string>;
  weightSeconds: number;
};

const coverageTaskWeightSeconds = (packageName: string): number =>
  pipe(
    O.fromUndefinedOr(COVERAGE_LIVE_TASK_WEIGHT_SECONDS[packageName]),
    O.orElse(() => O.fromUndefinedOr(COVERAGE_TASK_WEIGHT_SECONDS[packageName])),
    O.getOrElse(() => DEFAULT_COVERAGE_TASK_WEIGHT_SECONDS)
  );

const packageByWeightDescending = Order.combine(
  Order.mapInput(Order.Number, (packageName: string) => -coverageTaskWeightSeconds(packageName)),
  Order.String
);

const shardByWeightAscending = Order.combine(
  Order.mapInput(Order.Number, (shard: MutableCoverageShard) => shard.weightSeconds),
  Order.mapInput(Order.Number, (shard: MutableCoverageShard) => shard.index)
);

/**
 * Partition package names into deterministic least-loaded full-run shards.
 *
 * **Example** (Plan two coverage shards)
 *
 * ```ts
 * import { planCoverageFullShards } from "@beep/repo-cli/test/Quality"
 *
 * const shards = planCoverageFullShards(["@beep/schema", "@beep/types"], 2)
 * console.log(shards.length)
 * ```
 *
 * @param packageNames - Current workspace owners that define coverage.
 * @param shardCount - Positive number of in-job shards.
 * @returns Shards sorted by stable one-based index.
 * @category utilities
 * @since 0.0.0
 */
export const planCoverageFullShards: {
  (shardCount: number): (packageNames: ReadonlyArray<string>) => ReadonlyArray<CoverageFullShard>;
  (packageNames: ReadonlyArray<string>, shardCount: number): ReadonlyArray<CoverageFullShard>;
} = dual(2, (packageNames: ReadonlyArray<string>, shardCount: number): ReadonlyArray<CoverageFullShard> => {
  const count = Math.max(1, Math.floor(shardCount));
  const shards = A.makeBy(
    count,
    (index): MutableCoverageShard => ({
      index: index + 1,
      packageNames: [],
      weightSeconds: 0,
    })
  );

  for (const packageName of A.sort(A.dedupe(packageNames), packageByWeightDescending)) {
    const shard = A.sort(shards, shardByWeightAscending)[0];
    if (shard !== undefined) {
      shard.packageNames.push(packageName);
      shard.weightSeconds += coverageTaskWeightSeconds(packageName);
    }
  }

  return pipe(
    shards,
    A.map((shard) =>
      CoverageFullShard.make({
        index: shard.index,
        packageNames: A.sort(shard.packageNames, Order.String),
        weightSeconds: shard.weightSeconds,
      })
    ),
    A.sort(Order.mapInput(Order.Number, (shard: CoverageFullShard) => shard.index))
  );
});

const byPackagePathLengthDescending = Order.mapInput(
  Order.Number,
  (owner: CoverageScopeOwner) => -Str.length(owner.packagePath)
);

const ownerForFile = (owners: ReadonlyArray<CoverageScopeOwner>, filePath: string): O.Option<CoverageScopeOwner> =>
  A.findFirst(
    pipe(owners, A.sort(byPackagePathLengthDescending)),
    (owner) => filePath === owner.packagePath || Str.startsWith(`${owner.packagePath}/`)(filePath)
  );

const isGlobalCoverageInput = (filePath: string): boolean =>
  isExactFile(COVERAGE_FULL_INPUT_FILES, filePath) || hasPrefix(COVERAGE_FULL_INPUT_PREFIXES, filePath);

// `standards/` mixes executable policy inputs (`*.jsonc` baselines and
// inventories that tests read) with authored documentation; only the Markdown
// is coverage-inert. A decision-log edit forced two full runs on 2026-08-24.
const isStandardsDocument = (filePath: string): boolean =>
  Str.startsWith("standards/")(filePath) && Str.endsWith(".md")(filePath);

const isCoverageNoopInput = (filePath: string): boolean =>
  isExactFile(COVERAGE_NOOP_FILES, filePath) ||
  hasPrefix(COVERAGE_NOOP_PREFIXES, filePath) ||
  isStandardsDocument(filePath);

const repositoryFixtureOwnerNameForFile = (filePath: string): O.Option<string> =>
  pipe(
    COVERAGE_REPOSITORY_FIXTURE_OWNER_FILES,
    A.findFirst(([fixturePath]) => fixturePath === filePath),
    O.orElse(() =>
      pipe(
        COVERAGE_REPOSITORY_FIXTURE_OWNER_PREFIXES,
        A.findFirst(([prefix]) => Str.startsWith(prefix)(filePath))
      )
    ),
    O.map(([, packageName]) => packageName)
  );

const repositoryFixtureCoverageOwnerForFile = (
  owners: ReadonlyArray<CoverageScopeOwner>,
  filePath: string
): O.Option<CoverageScopeOwner> =>
  pipe(
    repositoryFixtureOwnerNameForFile(filePath),
    O.flatMap((packageName) => A.findFirst(owners, (owner) => owner.packageName === packageName && owner.hasCoverage))
  );

const packageJsonPath = (owner: CoverageScopeOwner): string => `${owner.packagePath}/package.json`;

const fullReasonForFile = (owners: ReadonlyArray<CoverageScopeOwner>, filePath: string): O.Option<string> => {
  if (isGlobalCoverageInput(filePath)) {
    return O.some(`${filePath}: global coverage input changed`);
  }

  // Lab-app paths are coverage-inert (goals/lab-apps-lifecycle D2): a lab-only
  // change must neither force a full run ("no current workspace owner" /
  // package-identity reasons) nor join a selected scope.
  if (isLabsWorkspacePath(filePath)) {
    return O.none();
  }

  if (O.isSome(repositoryFixtureOwnerNameForFile(filePath))) {
    return O.isSome(repositoryFixtureCoverageOwnerForFile(owners, filePath))
      ? O.none()
      : O.some(`${filePath}: configured repository fixture coverage owner is unavailable`);
  }

  if (isCoverageNoopInput(filePath)) {
    return O.none();
  }

  return pipe(
    ownerForFile(owners, filePath),
    O.match({
      onNone: () => O.some(`${filePath}: no current workspace owner`),
      onSome: (owner) =>
        filePath === packageJsonPath(owner)
          ? O.some(`${filePath}: package identity or coverage task may have changed`)
          : O.none(),
    })
  );
};

const isMeasurableOwner = (owner: CoverageScopeOwner): boolean =>
  owner.hasCoverage && !isLabsWorkspacePath(owner.packagePath);

const selectedOwnerForFile = (owners: ReadonlyArray<CoverageScopeOwner>, filePath: string): O.Option<string> =>
  pipe(
    repositoryFixtureCoverageOwnerForFile(owners, filePath),
    O.orElse(() => ownerForFile(owners, filePath)),
    O.filter(isMeasurableOwner),
    O.map((owner) => owner.packageName)
  );

// A package's own test tree is not part of what dependents import, so a
// change confined to it cannot alter a dependent's measured behaviour.
const isOwnerTestPath = (owner: CoverageScopeOwner, filePath: string): boolean =>
  Str.startsWith(`${owner.packagePath}/test/`)(filePath);

// Owners whose exported surface may have changed. Coverage capability is not
// required here: a package without a coverage task can still change what its
// coverage-bearing dependents execute. Lab paths stay coverage-inert
// (lab-apps-lifecycle D2) and repository fixtures only feed their owner's own
// tests, so neither seeds dependents.
const dependentSeedOwnerForFile = (owners: ReadonlyArray<CoverageScopeOwner>, filePath: string): O.Option<string> =>
  pipe(
    ownerForFile(owners, filePath),
    O.filter((owner) => !isLabsWorkspacePath(owner.packagePath) && !isOwnerTestPath(owner, filePath)),
    O.map((owner) => owner.packageName)
  );

const dependentsByPackageName = (
  owners: ReadonlyArray<CoverageScopeOwner>
): MutableHashMap.MutableHashMap<string, ReadonlyArray<string>> => {
  const dependents = MutableHashMap.empty<string, ReadonlyArray<string>>();
  for (const owner of owners) {
    for (const dependency of owner.workspaceDependencies) {
      MutableHashMap.set(
        dependents,
        dependency,
        A.append(O.getOrElse(MutableHashMap.get(dependents, dependency), A.empty<string>), owner.packageName)
      );
    }
  }
  return dependents;
};

/**
 * Collect the coverage-bearing workspace packages that transitively depend on
 * the given seed packages.
 *
 * **Details**
 *
 * Edges come from each owner's `workspaceDependencies`; the closure walks the
 * inverted graph from every seed and keeps only measurable owners (coverage
 * task present, not a lab). Seeds are never returned, even when they depend on
 * one another, so the result composes with the directly changed owners by
 * plain union.
 *
 * **Example** (Find one transitive dependent)
 *
 * ```ts
 * import { coverageDependentOwners, CoverageScopeOwner } from "@beep/repo-cli/test/Quality"
 *
 * const owners = [
 *   CoverageScopeOwner.make({ packageName: "@beep/md", packagePath: "packages/md", hasCoverage: true }),
 *   CoverageScopeOwner.make({
 *     packageName: "@beep/pandoc-ast",
 *     packagePath: "packages/pandoc-ast",
 *     hasCoverage: true,
 *     workspaceDependencies: ["@beep/md"]
 *   })
 * ]
 * console.log(coverageDependentOwners(owners, ["@beep/md"])) // ["@beep/pandoc-ast"]
 * ```
 *
 * @param owners - Current workspace packages with their workspace-internal dependencies.
 * @param seedPackageNames - Package names whose exported surface may have changed.
 * @returns Sorted unique measurable dependents, excluding the seeds themselves.
 * @category utilities
 * @since 0.0.0
 */
export const coverageDependentOwners: {
  (seedPackageNames: ReadonlyArray<string>): (owners: ReadonlyArray<CoverageScopeOwner>) => ReadonlyArray<string>;
  (owners: ReadonlyArray<CoverageScopeOwner>, seedPackageNames: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(
  2,
  (owners: ReadonlyArray<CoverageScopeOwner>, seedPackageNames: ReadonlyArray<string>): ReadonlyArray<string> => {
    const dependents = dependentsByPackageName(owners);
    const visited = MutableHashSet.fromIterable(seedPackageNames);
    const pending = A.copy(seedPackageNames);
    const reached = MutableHashSet.empty<string>();

    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      for (const dependent of O.getOrElse(MutableHashMap.get(dependents, next), A.empty<string>)) {
        if (!MutableHashSet.has(visited, dependent)) {
          MutableHashSet.add(visited, dependent);
          MutableHashSet.add(reached, dependent);
          pending.push(dependent);
        }
      }
    }

    const measurable = MutableHashSet.fromIterable(
      pipe(
        owners,
        A.filter(isMeasurableOwner),
        A.map((owner) => owner.packageName)
      )
    );
    return pipe(
      A.fromIterable(reached),
      A.filter((packageName) => MutableHashSet.has(measurable, packageName)),
      A.sort(Order.String)
    );
  }
);

/**
 * Sum the hosted task weights of the given coverage owners.
 *
 * **Details**
 *
 * Uses the same live and profiled per-package seconds that place owners into
 * full-run shards, so an executor can compare a selected scope against the
 * single-invocation budget with the planner's own currency.
 *
 * **Example** (Weigh two owners)
 *
 * ```ts
 * import { coverageScopeWeightSeconds } from "@beep/repo-cli/test/Quality"
 *
 * console.log(coverageScopeWeightSeconds(["@beep/schema", "@beep/types"]) > 0) // true
 * ```
 *
 * @param packageNames - Coverage owners to weigh; duplicates count once.
 * @returns Estimated sequential seconds for the owners.
 * @category utilities
 * @since 0.0.0
 */
export const coverageScopeWeightSeconds = (packageNames: ReadonlyArray<string>): number =>
  pipe(
    A.dedupe(packageNames),
    A.map(coverageTaskWeightSeconds),
    A.reduce(0, (total, weight) => total + weight)
  );

/**
 * Map changed files to the coverage-owning workspace packages whose measured
 * baseline rows may be adopted.
 *
 * **Details**
 *
 * Every changed path is mapped through the same package and repository-fixture
 * ownership rules used by {@link planCoverageAffectedScope}. The result is
 * deduplicated and sorted independently of full-run classification.
 *
 * **Gotchas**
 *
 * A full-run planner verdict changes which packages are measured, never which
 * rows this owner list permits a baseline write to adopt. Only
 * `--replace-all` expands adoption to the whole measured document.
 *
 * **Example** (Keep a manifest owner in the adoption set)
 *
 * ```ts
 * import { changedCoverageOwners, CoverageScopeOwner } from "@beep/repo-cli/test/Quality"
 *
 * const owner = CoverageScopeOwner.make({
 *   packageName: "@beep/example",
 *   packagePath: "packages/example",
 *   hasCoverage: true
 * })
 * console.log(changedCoverageOwners([owner], ["packages/example/package.json"])) // ["@beep/example"]
 * ```
 *
 * @param owners - Current workspace packages and whether each defines coverage.
 * @param changedFiles - Sorted or unsorted repository-relative changed paths.
 * @returns Sorted unique coverage owners for all changed files.
 * @category utilities
 * @since 0.0.0
 */
export const changedCoverageOwners: {
  (changedFiles: ReadonlyArray<string>): (owners: ReadonlyArray<CoverageScopeOwner>) => ReadonlyArray<string>;
  (owners: ReadonlyArray<CoverageScopeOwner>, changedFiles: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(
  2,
  (owners: ReadonlyArray<CoverageScopeOwner>, changedFiles: ReadonlyArray<string>): ReadonlyArray<string> =>
    pipe(
      A.getSomes(A.map(changedFiles, (filePath) => selectedOwnerForFile(owners, filePath))),
      A.dedupe,
      A.sort(Order.String)
    )
);

const dependentSeedOwners = (
  owners: ReadonlyArray<CoverageScopeOwner>,
  changedFiles: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    A.getSomes(A.map(changedFiles, (filePath) => dependentSeedOwnerForFile(owners, filePath))),
    A.dedupe,
    A.sort(Order.String)
  );

/**
 * Derive a conservative coverage plan from changed files and current workspace owners.
 *
 * **Details**
 *
 * Global coverage inputs, unknown paths, shared test-kit changes, and package
 * manifest changes force a full run. Otherwise the selection is the directly
 * changed owners that define coverage plus every coverage-bearing workspace
 * package that transitively depends on a changed owner whose non-test files
 * changed ({@link coverageDependentOwners}). A dependent that was never
 * measured on the pull request used to surface only in the full run on `main`,
 * turning `main` red after the merge.
 *
 * **Gotchas**
 *
 * A full verdict controls measurement breadth only. Baseline adoption remains
 * the package owners returned by {@link changedCoverageOwners} unless the
 * operator explicitly passes `--replace-all`; dependents are measured and
 * compared, never adopted.
 *
 * **Example** (Select a changed owner and its dependent)
 *
 * ```ts
 * import { CoverageScopeOwner, planCoverageAffectedScope } from "@beep/repo-cli/test/Quality"
 *
 * const owners = [
 *   CoverageScopeOwner.make({
 *     packageName: "@beep/schema",
 *     packagePath: "packages/foundation/modeling/schema",
 *     hasCoverage: true
 *   }),
 *   CoverageScopeOwner.make({
 *     packageName: "@beep/identity",
 *     packagePath: "packages/foundation/identity",
 *     hasCoverage: true,
 *     workspaceDependencies: ["@beep/schema"]
 *   })
 * ]
 * const scope = planCoverageAffectedScope(owners, ["packages/foundation/modeling/schema/src/index.ts"])
 * console.log(scope._tag === "selected" ? scope.packageNames : scope._tag) // ["@beep/identity", "@beep/schema"]
 * ```
 *
 * @param owners - Current workspace packages, their coverage capability, and workspace dependencies.
 * @param changedFiles - Sorted or unsorted repository-relative changed paths.
 * @returns A deterministic full, selected, or no-op scope.
 * @category utilities
 * @since 0.0.0
 */
export const planCoverageAffectedScope: {
  (changedFiles: ReadonlyArray<string>): (owners: ReadonlyArray<CoverageScopeOwner>) => CoverageAffectedScope;
  (owners: ReadonlyArray<CoverageScopeOwner>, changedFiles: ReadonlyArray<string>): CoverageAffectedScope;
} = dual(
  2,
  (owners: ReadonlyArray<CoverageScopeOwner>, changedFiles: ReadonlyArray<string>): CoverageAffectedScope =>
    planCoverageAffectedScopeWithBaseline(owners, changedFiles, O.none())
);

const isCoverageBaselinePath = (filePath: string): boolean => filePath === COVERAGE_BASELINE_PATH;

/**
 * Which coverage-baseline rows a pull request changed, split by direction.
 *
 * **Details**
 *
 * `present` names rows that exist in the working copy and were added or
 * changed; `removed` names rows that exist only at the comparison base. The
 * split matters to the planner: a present row must name a measurable package
 * (an unknown name is a typo the full run has to surface, since `main`'s
 * unscoped run would otherwise fail it as a missing summary), while a removed
 * row for a package that left the workspace is pruned by the writer and needs
 * no run.
 *
 * **Example** (One changed row)
 *
 * ```ts
 * import { CoverageBaselineRowDelta } from "@beep/repo-cli/test/Quality"
 *
 * const delta = CoverageBaselineRowDelta.make({ present: ["@beep/schema"], removed: [] })
 * console.log(delta.present)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageBaselineRowDelta extends S.Class<CoverageBaselineRowDelta>($I`CoverageBaselineRowDelta`)(
  {
    present: S.Array(S.String),
    removed: S.Array(S.String),
  },
  $I.annote("CoverageBaselineRowDelta", {
    description: "Coverage baseline package rows added or changed (present) and deleted (removed) by a change set.",
  })
) {}

// A present row names a package the run must measure. No owner at all is a
// typo or a package that was never in the workspace; an owner without a
// coverage task (or a lab) cannot be measured. Both are configuration problems
// the full run has to surface.
const presentBaselineRowReason = (owners: ReadonlyArray<CoverageScopeOwner>, packageName: string): O.Option<string> =>
  pipe(
    A.findFirst(owners, (owner) => owner.packageName === packageName),
    O.match({
      onNone: () => O.some(`${COVERAGE_BASELINE_PATH}: row for ${packageName} names no workspace package`),
      onSome: (owner) =>
        isMeasurableOwner(owner)
          ? O.none()
          : O.some(`${COVERAGE_BASELINE_PATH}: row for ${packageName} names a package that cannot be measured`),
    })
  );

// Removed rows need a run only when their package is still measurable: the row
// was dropped but the package remains, so its next summary must be reviewed.
const measurableBaselineRowOwners = (
  owners: ReadonlyArray<CoverageScopeOwner>,
  packageNames: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    owners,
    A.filter((owner) => isMeasurableOwner(owner) && A.contains(packageNames, owner.packageName)),
    A.map((owner) => owner.packageName)
  );

/**
 * Plan affected coverage scope with knowledge of which baseline rows changed.
 *
 * **Details**
 *
 * The committed baseline is a global coverage input: an edit to it normally
 * forces the full workspace run. When the caller has diffed the document
 * against the comparison base and found that only `packages` rows changed
 * (`coverageBaselineRowDelta` in CoverageRegression), the packages named by
 * those rows are selected — and measured — instead. Every baseline regeneration
 * commit used to cost the 9–15 minute full run; a row-only splice now costs
 * exactly the packages it touches. `None` keeps the global-input behaviour.
 *
 * **Example** (A row-only baseline edit selects its package)
 *
 * ```ts
 * import {
 *   CoverageBaselineRowDelta,
 *   CoverageScopeOwner,
 *   planCoverageAffectedScopeWithBaseline
 * } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const owner = CoverageScopeOwner.make({
 *   packageName: "@beep/schema",
 *   packagePath: "packages/foundation/modeling/schema",
 *   hasCoverage: true
 * })
 * const scope = planCoverageAffectedScopeWithBaseline(
 *   [owner],
 *   ["standards/coverage.regression-baseline.jsonc"],
 *   O.some(CoverageBaselineRowDelta.make({ present: ["@beep/schema"], removed: [] }))
 * )
 * console.log(scope._tag) // "selected"
 * ```
 *
 * @param owners - Current workspace packages, their coverage capability, and workspace dependencies.
 * @param changedFiles - Sorted or unsorted repository-relative changed paths.
 * @param baselineRowPackages - Packages whose baseline rows changed, when the baseline edit was row-only.
 * @returns A deterministic full, selected, or no-op scope.
 * @category utilities
 * @since 0.0.0
 */
export const planCoverageAffectedScopeWithBaseline: {
  (
    changedFiles: ReadonlyArray<string>,
    baselineRowPackages: O.Option<CoverageBaselineRowDelta>
  ): (owners: ReadonlyArray<CoverageScopeOwner>) => CoverageAffectedScope;
  (
    owners: ReadonlyArray<CoverageScopeOwner>,
    changedFiles: ReadonlyArray<string>,
    baselineRowPackages: O.Option<CoverageBaselineRowDelta>
  ): CoverageAffectedScope;
} = dual(
  3,
  (
    owners: ReadonlyArray<CoverageScopeOwner>,
    changedFiles: ReadonlyArray<string>,
    baselineRowPackages: O.Option<CoverageBaselineRowDelta>
  ): CoverageAffectedScope => {
    const presentRows = pipe(
      baselineRowPackages,
      O.map((delta) => delta.present),
      O.getOrElse(A.empty<string>)
    );
    const removedRows = pipe(
      baselineRowPackages,
      O.map((delta) => delta.removed),
      O.getOrElse(A.empty<string>)
    );
    const scopedBaselineEdit = O.isSome(baselineRowPackages);
    const reasons = pipe(
      A.appendAll(
        A.getSomes(
          A.map(changedFiles, (filePath) =>
            scopedBaselineEdit && isCoverageBaselinePath(filePath) ? O.none() : fullReasonForFile(owners, filePath)
          )
        ),
        A.getSomes(A.map(presentRows, (packageName) => presentBaselineRowReason(owners, packageName)))
      ),
      A.dedupe,
      A.sort(Order.String)
    );
    if (A.isReadonlyArrayNonEmpty(reasons)) {
      return CoverageFullScope.make({ reasons });
    }

    const directPackageNames = pipe(
      A.union(
        changedCoverageOwners(owners, changedFiles),
        measurableBaselineRowOwners(owners, A.appendAll(presentRows, removedRows))
      ),
      A.sort(Order.String)
    );
    const dependentPackageNames = pipe(
      coverageDependentOwners(owners, dependentSeedOwners(owners, changedFiles)),
      A.difference(directPackageNames)
    );
    const packageNames = pipe(A.union(directPackageNames, dependentPackageNames), A.sort(Order.String));
    return A.isReadonlyArrayNonEmpty(packageNames)
      ? CoverageSelectedScope.make({ packageNames, dependentPackageNames })
      : CoverageNoopScope.make();
  }
);

/**
 * Derive affected coverage scope from changed files using live workspace ownership.
 *
 * **Example** (Build the shared affected-scope effect)
 *
 * ```ts
 * import { planWorkspaceCoverageAffectedScope } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(planWorkspaceCoverageAffectedScope(process.cwd(), []))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root containing the workspace manifest.
 * @param changedFiles - Repository-relative committed and dirty paths.
 * @returns Full, selected, or no-op coverage scope using the shared owner inventory.
 * @category utilities
 * @since 0.0.0
 */
export const planWorkspaceCoverageAffectedScope = Effect.fn("CoverageScope.planWorkspaceCoverageAffectedScope")(
  function* (
    repoRoot: string,
    changedFiles: ReadonlyArray<string>,
    baselineRowPackages: O.Option<CoverageBaselineRowDelta> = O.none()
  ): Effect.fn.Return<CoverageAffectedScope, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
    return planCoverageAffectedScopeWithBaseline(
      yield* workspaceCoverageScopeOwners(repoRoot),
      changedFiles,
      baselineRowPackages
    );
  }
);
