/**
 * Safe pull-request scope planning for the coverage regression lane.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Effect, MutableHashMap, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { isLabsWorkspacePath } from "../../../internal/cli/Labs/index.ts";
import { QualityTaskConfigurationError } from "../Quality.errors.ts";
import { discoverWorkspacePackages } from "./QualityArtifactSupport.ts";
import type { FileSystem } from "effect";

const $I = $RepoCliId.create("commands/Quality/internal/CoverageScope");

const COVERAGE_FULL_INPUT_FILES = [
  ".bun-version",
  "bun.lock",
  "package.json",
  "standards/coverage.regression-baseline.jsonc",
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
 * **Example** (Describe one coverage owner)
 *
 * ```ts
 * import { CoverageScopeOwner } from "@beep/repo-cli/test/Quality"
 *
 * const owner = CoverageScopeOwner.make({
 *   packageName: "@beep/schema",
 *   packagePath: "packages/foundation/modeling/schema",
 *   hasCoverage: true
 * })
 * console.log(owner.packageName)
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
  },
  $I.annote("CoverageScopeOwner", {
    description: "Workspace path and coverage capability used by pull-request scope planning.",
  })
) {}

const workspacePackageHasCoverage = (scripts: Readonly<Record<string, string>> | undefined): boolean =>
  pipe(scripts ?? {}, R.get("coverage"), O.isSome);

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

  return pipe(
    A.fromIterable(MutableHashMap.values(packageMap)),
    A.map((info) =>
      CoverageScopeOwner.make({
        hasCoverage: workspacePackageHasCoverage(info.packageJson.scripts),
        packageName: info.name,
        packagePath: info.path,
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
  { packageNames: S.Array(S.String) },
  $I.annote("CoverageSelectedScope", {
    description: "Coverage plan containing the exact directly changed workspace owners that define coverage.",
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

const isCoverageNoopInput = (filePath: string): boolean =>
  isExactFile(COVERAGE_NOOP_FILES, filePath) || hasPrefix(COVERAGE_NOOP_PREFIXES, filePath);

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

const selectedOwnerForFile = (owners: ReadonlyArray<CoverageScopeOwner>, filePath: string): O.Option<string> =>
  pipe(
    repositoryFixtureCoverageOwnerForFile(owners, filePath),
    O.orElse(() => ownerForFile(owners, filePath)),
    O.filter((owner) => owner.hasCoverage && !isLabsWorkspacePath(owner.packagePath)),
    O.map((owner) => owner.packageName)
  );

/**
 * Derive a conservative coverage plan from changed files and current workspace owners.
 *
 * **Details**
 *
 * Global coverage inputs, unknown paths, shared test-kit changes, and package
 * manifest changes force a full run. Otherwise only directly changed owners
 * that currently define coverage are selected.
 *
 * **Example** (Select a directly changed owner)
 *
 * ```ts
 * import { CoverageScopeOwner, planCoverageAffectedScope } from "@beep/repo-cli/test/Quality"
 *
 * const owner = CoverageScopeOwner.make({
 *   packageName: "@beep/schema",
 *   packagePath: "packages/foundation/modeling/schema",
 *   hasCoverage: true
 * })
 * const scope = planCoverageAffectedScope([owner], ["packages/foundation/modeling/schema/src/index.ts"])
 * console.log(scope._tag)
 * ```
 *
 * @param owners - Current workspace packages and whether each defines coverage.
 * @param changedFiles - Sorted or unsorted repository-relative changed paths.
 * @returns A deterministic full, selected, or no-op scope.
 * @category utilities
 * @since 0.0.0
 */
export const planCoverageAffectedScope: {
  (changedFiles: ReadonlyArray<string>): (owners: ReadonlyArray<CoverageScopeOwner>) => CoverageAffectedScope;
  (owners: ReadonlyArray<CoverageScopeOwner>, changedFiles: ReadonlyArray<string>): CoverageAffectedScope;
} = dual(2, (owners: ReadonlyArray<CoverageScopeOwner>, changedFiles: ReadonlyArray<string>): CoverageAffectedScope => {
  const reasons = pipe(
    A.getSomes(A.map(changedFiles, (filePath) => fullReasonForFile(owners, filePath))),
    A.dedupe,
    A.sort(Order.String)
  );
  if (A.isReadonlyArrayNonEmpty(reasons)) {
    return CoverageFullScope.make({ reasons });
  }

  const packageNames = pipe(
    A.getSomes(A.map(changedFiles, (filePath) => selectedOwnerForFile(owners, filePath))),
    A.dedupe,
    A.sort(Order.String)
  );
  return A.isReadonlyArrayNonEmpty(packageNames)
    ? CoverageSelectedScope.make({ packageNames })
    : CoverageNoopScope.make();
});

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
    changedFiles: ReadonlyArray<string>
  ): Effect.fn.Return<CoverageAffectedScope, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
    return planCoverageAffectedScope(yield* workspaceCoverageScopeOwners(repoRoot), changedFiles);
  }
);
