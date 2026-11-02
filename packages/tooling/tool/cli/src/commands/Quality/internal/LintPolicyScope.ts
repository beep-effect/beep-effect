/**
 * Changed-scope planning for the root lint policy battery.
 *
 * A changed-scope (`--affected`) policy run leaves file selection to Turbo's
 * `affectedUsingTaskInputs` graph, which re-runs a task whenever one of its
 * declared inputs or a sealed rule implementation changed. This module names
 * the change classes that widen the run to the full sweep before Turbo is
 * asked anything, and reads Turbo's affected plan for the two package tasks
 * the battery runs as one root process.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str, thunkEmptyStr, thunkFalse } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { collectChangedFiles } from "../../../internal/repo-run/ChangedFiles.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { PolicyToolsFingerprint } from "../../Lint/PolicyFingerprint.schemas.ts";
import { QualityTaskConfigurationError } from "../Quality.errors.ts";
import type { Git } from "@beep/git/Git";
import type * as P from "effect/Predicate";

const $I = $RepoCliId.create("commands/Quality/internal/LintPolicyScope");

/**
 * Change classes that widen a changed-scope policy run to the full sweep.
 *
 * **Details**
 *
 * - `deleted-path`: a removed or renamed path can break an unchanged importer.
 * - `deprecation-annotation`: a changed source file carries `@deprecated`, so
 *   unchanged callers anywhere may now use a deprecated symbol.
 * - `tsconfig`: type resolution changed for every program that extends it.
 * - `dependency-manifest`: the lockfile, a workspace manifest, the runtime pin
 *   or a dependency patch changed.
 * - `turbo-config`: the task graph that answers "affected" itself changed.
 * - `lint-configuration`: a repo-wide lint, typo or documentation config changed.
 * - `policy-implementation`: a file the policy tools load (the
 *   `standards/policy-tools.fingerprint.json` seals), the policy pack or the
 *   repo-cli lint commands changed.
 * - `policy-seal-unreadable`: the fingerprint could not be read, so the
 *   implementation class cannot be ruled out.
 *
 * **Example** (Name an escalation)
 *
 * ```ts
 * import { LintPolicyEscalationTrigger } from "@beep/repo-cli/test/Quality"
 *
 * console.log(LintPolicyEscalationTrigger.Enum["deleted-path"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LintPolicyEscalationTrigger = LiteralKit([
  "deleted-path",
  "deprecation-annotation",
  "tsconfig",
  "dependency-manifest",
  "turbo-config",
  "lint-configuration",
  "policy-implementation",
  "policy-seal-unreadable",
]).pipe(
  $I.annoteSchema("LintPolicyEscalationTrigger", {
    description: "Change class that widens a changed-scope lint policy run to the full sweep.",
  })
);

/**
 * Change class that widens a changed-scope lint policy run to the full sweep.
 *
 * @see {@link LintPolicyEscalationTrigger} for the literal domain this type decodes from.
 * @category models
 * @since 0.0.0
 */
export type LintPolicyEscalationTrigger = typeof LintPolicyEscalationTrigger.Type;

/**
 * One changed path and the change class that makes it widen the run.
 *
 * **Example** (Record a lockfile escalation)
 *
 * ```ts
 * import { LintPolicyEscalation } from "@beep/repo-cli/test/Quality"
 *
 * console.log(LintPolicyEscalation.make({ trigger: "dependency-manifest", path: "bun.lock" }).path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LintPolicyEscalation extends S.Opaque<LintPolicyEscalation, { readonly brand: unique symbol }>()(
  S.Struct({ trigger: LintPolicyEscalationTrigger, path: S.String }).pipe(
    $I.annoteSchema("LintPolicyEscalation", {
      description: "A changed path and the change class that widens the lint policy run to the full sweep.",
    })
  )
) {}

/**
 * Full-sweep policy scope: requested by the caller (no escalations) or widened by the change set.
 *
 * @category models
 * @since 0.0.0
 */
export class LintPolicyFullScope extends S.Opaque<LintPolicyFullScope, { readonly brand: unique symbol }>()(
  S.TaggedStruct("full", { escalations: S.Array(LintPolicyEscalation) }).pipe(
    $I.annoteSchema("LintPolicyFullScope", {
      description:
        "Full-sweep lint policy scope, requested by the caller (no escalations) or widened by the change set.",
    })
  )
) {}

/**
 * Changed-scope policy run against a base ref: Turbo selects the tasks whose inputs changed.
 *
 * @category models
 * @since 0.0.0
 */
export class LintPolicyAffectedScope extends S.Opaque<LintPolicyAffectedScope, { readonly brand: unique symbol }>()(
  S.TaggedStruct("affected", { base: S.String, changedFileCount: S.Int }).pipe(
    $I.annoteSchema("LintPolicyAffectedScope", {
      description: "Changed-scope lint policy run against a base ref; Turbo selects tasks whose inputs changed.",
    })
  )
) {}

/**
 * Lint policy execution scope: the full sweep or Turbo's changed scope.
 *
 * **Example** (Decode a requested full sweep)
 *
 * ```ts
 * import { LintPolicyScope } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * const scope = S.decodeUnknownSync(LintPolicyScope)({ _tag: "full", escalations: [] })
 * console.log(scope._tag) // "full"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LintPolicyScope = S.Union([LintPolicyFullScope, LintPolicyAffectedScope]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("LintPolicyScope", {
    description: "Lint policy execution scope: the full sweep or Turbo's changed scope.",
  })
);

/**
 * Lint policy execution scope: the full sweep or Turbo's changed scope.
 *
 * @see {@link LintPolicyScope} for the schema.
 * @category schemas
 * @since 0.0.0
 */
export type LintPolicyScope = typeof LintPolicyScope.Type;

/**
 * The change set facts the scope planner reads.
 *
 * **Example** (Describe a one-file change set)
 *
 * ```ts
 * import { LintPolicyChangeFacts } from "@beep/repo-cli/test/Quality"
 *
 * const facts = LintPolicyChangeFacts.make({
 *   changedPaths: ["packages/demo/src/index.ts"],
 *   deletedPaths: [],
 *   deprecationPaths: []
 * })
 * console.log(facts.changedPaths.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LintPolicyChangeFacts extends S.Opaque<LintPolicyChangeFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    changedPaths: S.Array(S.String),
    deletedPaths: S.Array(S.String),
    deprecationPaths: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("LintPolicyChangeFacts", {
      description:
        "Changed, deleted and @deprecated-bearing paths of a change set, read by the lint policy scope planner.",
    })
  )
) {}

const FINGERPRINT_PATH = "standards/policy-tools.fingerprint.json";
const DEPENDENCY_MANIFEST_FILES = HashSet.make(".bun-version", ".nvmrc", "bun.lock", "bunfig.toml");
const LINT_CONFIGURATION_FILES = HashSet.make(
  "_typos.toml",
  "tsdoc.json",
  "standards/lint-policy.sweeps.jsonc",
  FINGERPRINT_PATH
);
const POLICY_IMPLEMENTATION_PREFIXES = [
  "packages/tooling/policy-pack/",
  "packages/tooling/tool/cli/src/commands/Lint/",
];
const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;
const TSCONFIG_FILE = /^(?:ts|js)config(?:\..+)?\.json$/u;
// Root-level oxlint and Biome profiles; nested `.oxlintrc.json` files are disabled by `--disable-nested-config`.
const ROOT_LINT_PROFILE = /^(?:\.oxlintrc[^/]*\.jsonc?|biome[^/]*\.jsonc?)$/u;

const basename = (path: string): string => pipe(Str.split(path, "/"), A.last, O.getOrElse(thunkEmptyStr));

/**
 * Classify one changed path against the path-based escalation classes.
 *
 * **Example** (Escalate a nested tsconfig)
 *
 * ```ts
 * import { lintPolicyEscalationTriggerForPath } from "@beep/repo-cli/test/Quality"
 *
 * console.log(lintPolicyEscalationTriggerForPath(() => false, "packages/demo/tsconfig.json"))
 * ```
 *
 * @param isSealed - Whether a path is one a policy tool loads, from the fingerprint seals.
 * @param path - Repo-relative changed path.
 * @returns The first matching escalation class, or `None` when the path leaves the run changed-scope.
 * @category utilities
 * @since 0.0.0
 */
export const lintPolicyEscalationTriggerForPath: {
  (path: string): (isSealed: P.Predicate<string>) => O.Option<LintPolicyEscalationTrigger>;
  (isSealed: P.Predicate<string>, path: string): O.Option<LintPolicyEscalationTrigger>;
} = dual(2, (isSealed: P.Predicate<string>, path: string): O.Option<LintPolicyEscalationTrigger> => {
  const name = basename(path);
  if (TSCONFIG_FILE.test(name)) return O.some("tsconfig");
  if (HashSet.has(DEPENDENCY_MANIFEST_FILES, path) || name === "package.json" || Str.startsWith("patches/")(path)) {
    return O.some("dependency-manifest");
  }
  if (name === "turbo.json") return O.some("turbo-config");
  if (HashSet.has(LINT_CONFIGURATION_FILES, path) || ROOT_LINT_PROFILE.test(path)) return O.some("lint-configuration");
  if (isSealed(path) || A.some(POLICY_IMPLEMENTATION_PREFIXES, (prefix) => Str.startsWith(prefix)(path))) {
    return O.some("policy-implementation");
  }
  return O.none();
});

const escalationsFor = (
  trigger: LintPolicyEscalationTrigger,
  paths: ReadonlyArray<string>
): ReadonlyArray<LintPolicyEscalation> => A.map(paths, (path) => LintPolicyEscalation.make({ trigger, path }));

/**
 * Decide the policy scope for a change set: changed-scope unless an escalation class matches.
 *
 * **Example** (Keep a source-only change set changed-scope)
 *
 * ```ts
 * import { LintPolicyChangeFacts, planLintPolicyScope } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const facts = LintPolicyChangeFacts.make({
 *   changedPaths: ["packages/demo/src/index.ts"],
 *   deletedPaths: [],
 *   deprecationPaths: []
 * })
 * console.log(planLintPolicyScope(facts, O.some(() => false), "origin/main")._tag) // "affected"
 * ```
 *
 * @param facts - Changed, deleted and `@deprecated`-bearing paths of the change set.
 * @param seal - Fingerprint seal predicate; `None` when the fingerprint could not be read.
 * @param base - Base ref the changed scope is measured against.
 * @returns The full sweep with every escalation, or the changed scope.
 * @category utilities
 * @since 0.0.0
 */
export const planLintPolicyScope: {
  (seal: O.Option<P.Predicate<string>>, base: string): (facts: LintPolicyChangeFacts) => LintPolicyScope;
  (facts: LintPolicyChangeFacts, seal: O.Option<P.Predicate<string>>, base: string): LintPolicyScope;
} = dual(3, (facts: LintPolicyChangeFacts, seal: O.Option<P.Predicate<string>>, base: string) => {
  const isSealed = O.getOrElse(seal, () => thunkFalse);
  const escalations = [
    ...(O.isNone(seal) ? escalationsFor("policy-seal-unreadable", [FINGERPRINT_PATH]) : []),
    ...escalationsFor("deleted-path", facts.deletedPaths),
    ...escalationsFor("deprecation-annotation", facts.deprecationPaths),
    ...A.getSomes(
      A.map(facts.changedPaths, (path) =>
        O.map(lintPolicyEscalationTriggerForPath(isSealed, path), (trigger) =>
          LintPolicyEscalation.make({ trigger, path })
        )
      )
    ),
  ];
  return A.isReadonlyArrayNonEmpty(escalations)
    ? LintPolicyFullScope.make({ escalations })
    : LintPolicyAffectedScope.make({ base, changedFileCount: A.length(facts.changedPaths) });
});

const decodeFingerprint = JsonStringCodec(PolicyToolsFingerprint).decode;

const sealGlob = GlobPatternOptions.make({ dot: true, nonegate: true, nocomment: true });

// The seals list every file a policy tool loads (`shared` plus each entry's import closure), a few
// as globs over non-TypeScript assets; the drift check's own list adds whole-workspace globs that
// only catch new files, so only its literal paths (root configs and manifests) join the seal.
const sealOf = (fingerprint: PolicyToolsFingerprint): P.Predicate<string> => {
  const sealed = [...fingerprint.shared, ...A.flatMap(fingerprint.entries, (entry) => entry.inputs)];
  const isGlob = Str.includes("*");
  const literals = HashSet.fromIterable([
    ...A.filter(sealed, (entry) => !isGlob(entry)),
    ...A.filter(fingerprint.check, (entry) => !isGlob(entry)),
  ]);
  // An uncompilable glob seals nothing narrower than its literal prefix, so it seals that prefix.
  const globs = A.map(A.filter(sealed, isGlob), (pattern) =>
    Result.match(GlobPattern.compileResult(pattern, sealGlob), {
      onFailure: () => Str.startsWith(pipe(Str.split(pattern, "*"), A.headNonEmpty)),
      onSuccess: (compiled) => (path: string) => compiled.matches(path),
    })
  );
  return (path) => HashSet.has(literals, path) || A.some(globs, (matches) => matches(path));
};

/**
 * Read the fingerprint seal as a path predicate; `None` when the fingerprint is missing or invalid.
 *
 * **Example** (Read the seal of a repository)
 *
 * ```ts
 * import { readLintPolicySeal } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readLintPolicySeal("/repo")))
 * ```
 *
 * @param repoRoot - Repository root holding `standards/policy-tools.fingerprint.json`.
 * @returns Whether a repo-relative path is sealed, or `None` so the planner widens the run.
 * @category utilities
 * @since 0.0.0
 */
export const readLintPolicySeal = Effect.fn("LintPolicyScope.readSeal")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .readFileString(path.join(repoRoot, FINGERPRINT_PATH))
    .pipe(Effect.flatMap(decodeFingerprint), Effect.map(sealOf), Effect.option);
});

const DEPRECATED_TAG = "@deprecated";

/**
 * Collect the change set facts for `base...HEAD` plus the dirty worktree.
 *
 * **Details**
 *
 * A changed path missing from the working tree is a deletion (renames list as
 * their old and new path). A changed source file whose working-tree content
 * carries `@deprecated` is a deprecation fact: reading the head side alone is
 * enough because only an added tag can create new findings in unchanged callers,
 * and it never needs merge-base blobs, which a partial clone fetches lazily.
 *
 * **Example** (Collect facts against origin/main)
 *
 * ```ts
 * import { collectLintPolicyChangeFacts } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(collectLintPolicyChangeFacts("/repo", "origin/main")))
 * ```
 *
 * @param repoRoot - Repository root.
 * @param base - Base ref of the three-dot comparison.
 * @returns The change set facts.
 * @category utilities
 * @since 0.0.0
 */
export const collectLintPolicyChangeFacts = Effect.fn("LintPolicyScope.collectChangeFacts")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<LintPolicyChangeFacts, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path | Git> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const changedPaths = yield* collectChangedFiles(repoRoot, base, "HEAD").pipe(
    QualityTaskConfigurationError.mapError(`Failed to collect lint policy changed files from ${base}...HEAD.`)
  );
  const presence = yield* Effect.forEach(
    changedPaths,
    (file) => fs.exists(path.join(repoRoot, file)).pipe(Effect.map((exists) => [file, exists] as const)),
    { concurrency: 16 }
  ).pipe(QualityTaskConfigurationError.mapError("Failed to stat lint policy changed files."));
  const present = A.filterMap(presence, ([file, exists]) => (exists ? Result.succeed(file) : Result.failVoid));
  const deprecationPaths = yield* Effect.filter(
    A.filter(present, (file) => SOURCE_FILE.test(file)),
    (file) => fs.readFileString(path.join(repoRoot, file)).pipe(Effect.map(Str.includes(DEPRECATED_TAG))),
    { concurrency: 16 }
  ).pipe(QualityTaskConfigurationError.mapError("Failed to read lint policy changed sources."));
  return LintPolicyChangeFacts.make({
    changedPaths,
    deletedPaths: A.filterMap(presence, ([file, exists]) => (exists ? Result.failVoid : Result.succeed(file))),
    deprecationPaths,
  });
});

/**
 * Resolve the policy scope of a changed-scope request: Turbo's changed scope, or the full sweep
 * when an escalation class matches.
 *
 * **Example** (Resolve against origin/main)
 *
 * ```ts
 * import { resolveLintPolicyScope } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveLintPolicyScope("/repo", "origin/main")))
 * ```
 *
 * @param repoRoot - Repository root.
 * @param base - Base ref of the three-dot comparison.
 * @returns The resolved scope.
 * @category utilities
 * @since 0.0.0
 */
export const resolveLintPolicyScope = Effect.fn("LintPolicyScope.resolve")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<LintPolicyScope, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path | Git> {
  const facts = yield* collectLintPolicyChangeFacts(repoRoot, base);
  return planLintPolicyScope(facts, yield* readLintPolicySeal(repoRoot), base);
});

/**
 * Package directories Turbo's changed-scope plan selects for the two package tasks the battery
 * runs as one root process each.
 *
 * **Example** (Inspect selected documentation targets)
 *
 * ```ts
 * import { LintPolicyAffectedTargets } from "@beep/repo-cli/test/Quality"
 *
 * console.log(LintPolicyAffectedTargets.make({ jsdoc: ["packages/demo"], deprecatedApis: [] }).jsdoc)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LintPolicyAffectedTargets extends S.Opaque<LintPolicyAffectedTargets, { readonly brand: unique symbol }>()(
  S.Struct({ jsdoc: S.Array(S.String), deprecatedApis: S.Array(S.String) }).pipe(
    $I.annoteSchema("LintPolicyAffectedTargets", {
      description:
        "Package directories Turbo's changed-scope plan selects for the documentation and deprecated-API lints.",
    })
  )
) {}

/**
 * The package tasks whose Turbo selection becomes one root invocation's targets.
 *
 * @category configuration
 * @since 0.0.0
 */
export const LINT_POLICY_TARGET_TASKS = ["lint:jsdoc", "lint:deprecated-apis"] as const;

class LintPolicyDryRunTask extends S.Opaque<LintPolicyDryRunTask, { readonly brand: unique symbol }>()(
  S.Struct({ task: S.String, directory: S.String, command: S.String }).pipe(
    $I.annoteSchema("LintPolicyDryRunTask", {
      description: "Task entry read from Turbo's JSON dry-run plan for the lint policy target probe.",
    })
  )
) {}

class LintPolicyDryRun extends S.Opaque<LintPolicyDryRun, { readonly brand: unique symbol }>()(
  S.Struct({ tasks: S.Array(LintPolicyDryRunTask) }).pipe(
    $I.annoteSchema("LintPolicyDryRun", {
      description: "Turbo JSON dry-run document read by the lint policy target probe.",
    })
  )
) {}

const decodeDryRun = JsonStringCodec(LintPolicyDryRun).decode;
// Turbo lists a dependency-only node for a package without the script.
const TURBO_NONEXISTENT_TASK_COMMAND = "<NONEXISTENT>";

const directoriesFor = (dryRun: LintPolicyDryRun, task: string): ReadonlyArray<string> =>
  pipe(
    dryRun.tasks,
    A.filter((entry) => entry.task === task && entry.command !== TURBO_NONEXISTENT_TASK_COMMAND),
    A.map((entry) => entry.directory),
    A.dedupe,
    A.sort(Order.String)
  );

/**
 * Read the selected package directories out of a `turbo run --dry=json` plan.
 *
 * **Example** (Parse an empty plan)
 *
 * ```ts
 * import { lintPolicyAffectedTargetsFromDryRun } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(lintPolicyAffectedTargetsFromDryRun('{"tasks":[]}')))
 * ```
 *
 * @param json - Turbo's dry-run JSON document.
 * @returns Sorted, de-duplicated package directories per target task.
 * @category utilities
 * @since 0.0.0
 */
export const lintPolicyAffectedTargetsFromDryRun = Effect.fn("LintPolicyScope.targetsFromDryRun")(function* (
  json: string
) {
  const dryRun = yield* decodeDryRun(json).pipe(
    QualityTaskConfigurationError.mapError("Turbo emitted an invalid dry-run plan for the lint policy targets.")
  );
  return LintPolicyAffectedTargets.make({
    jsdoc: directoriesFor(dryRun, "lint:jsdoc"),
    deprecatedApis: directoriesFor(dryRun, "lint:deprecated-apis"),
  });
});
