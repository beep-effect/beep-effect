/**
 * Lint policy command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/// <reference path="../../../madge.d.ts" />

import { $RepoCliId } from "@beep/identity/packages";
import { isExcludedTypeScriptSourcePath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import { Console, Effect, FileSystem, HashSet, Inspectable, MutableHashSet, Order, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { LABS_WORKSPACE_ROOT } from "../../internal/cli/Labs/index.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { runToExit } from "../../internal/process/StepExec.ts";
import { runGoalsDoctor } from "../Goals/Doctor.ts";
import { runRootLintPolicyTask } from "../Quality/index.ts";
import { lintEcosystemPolarityCommand } from "./EcosystemPolarity.ts";
import { lintIdentityRegistryCommand } from "./IdentityRegistry.ts";
import { lintJudgeRubricCommand } from "./JudgeRubric.ts";
import { LintCircularAnalysisError, LintFileDiscoveryError } from "./Lint.errors.ts";
import { lintPackageTestImportsCommand } from "./PackageTestImports.ts";
import { lintPackageTestTypecheckCommand } from "./PackageTestTypecheck.ts";
import { lintReflectionArtifactsCommand } from "./ReflectionArtifact.ts";
import { lintRoadmapRefsCommand } from "./RoadmapRefs.ts";
import { lintSchemaCatalogCommand } from "./SchemaCatalog.ts";
import { lintSchemaFirstCommand } from "./SchemaFirst.ts";
import { lintSchemaTopologyCommand } from "./SchemaTopology.ts";

const $I = $RepoCliId.create("commands/Lint/Lint.command");

const TOOLING_ROOT = "packages/tooling/tool/cli/src";
const RUNTIME_SCHEMA_FIRST_ROOTS = [TOOLING_ROOT] as const;
const FOCUS_RUNTIME_FILES = HashSet.fromIterable([
  "packages/tooling/tool/cli/src/commands/Docs/Docs.aggregate.ts",
  "packages/tooling/tool/cli/src/commands/Lint/index.ts",
  "packages/tooling/tool/cli/src/commands/Laws/index.ts",
  "packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts",
  "packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts",
]);
const ALLOWED_NON_PASCAL_FILENAMES = HashSet.fromIterable(["index", "bin"]);
const DEPRECATED_API_LINT_CACHE_DIRECTORY = "node_modules/.cache/eslint-deprecated-apis";
const DEPRECATED_API_LINT_CONCURRENCY = 4;
const DEPRECATED_API_LINT_ESLINT_BIN = "node_modules/.bin/eslint";
const DEPRECATED_API_LINT_NODE_OPTIONS = "--max-old-space-size=8192";
const DEPRECATED_API_LINT_SHARDS = [
  "apps/architecture-lab-proof",
  LABS_WORKSPACE_ROOT,
  "apps/oip-web",
  "apps/professional-desktop",
  "infra",
  "packages/_internal",
  "packages/agents",
  "packages/architecture-lab",
  "packages/drivers",
  "packages/ecosystem",
  "packages/epistemic/client",
  "packages/epistemic/config",
  "packages/epistemic/domain",
  "packages/epistemic/server",
  "packages/epistemic/tables",
  "packages/epistemic/ui",
  "packages/epistemic/use-cases",
  "packages/foundation/capability",
  "packages/foundation/modeling",
  "packages/foundation/primitive",
  "packages/foundation/ui-system",
  "packages/law-practice",
  "packages/shared",
  // One `packages/tooling` shard exhausted the 8 GiB eslint heap on hosted
  // runners (repo-cli alone is ~1,250 TypeScript files); shard it by subtree.
  "packages/tooling/library",
  "packages/tooling/policy-pack",
  "packages/tooling/test-kit",
  "packages/tooling/tool",
  "packages/workspace",
] as const;
const deprecatedApiLintCacheLocation = (shard: string): string =>
  `${DEPRECATED_API_LINT_CACHE_DIRECTORY}/.eslintcache-${Str.replaceAll("/", "__")(shard)}`;
const REQUIRED_TAGGED_UNIONS = [
  "GenerationAction",
  "TsMorphMutation",
  "TsMorphMutationOutcome",
  "DocsSection",
  "TsconfigSyncRunOptions",
  "TsconfigSyncChange",
  "PlannedFileChange",
  "TsconfigSyncResult",
  "VersionCategoryReport",
  "VersionSyncOptions",
] as const;

/**
 * Lint violation report row.
 *
 * **Example** (Reference the lint violation schema)
 *
 * ```ts
 * console.log("docgen metadata")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class LintViolation extends S.Class<LintViolation>($I`LintViolation`)(
  {
    file: S.String,
    line: S.Finite,
    kind: S.String,
    detail: S.String,
  },
  $I.annote("LintViolation", {
    description: "Lint violation report row.",
  })
) {}

const lineNumberAt = (content: string, offset: number): number =>
  pipe(content, Str.slice(0, offset), Str.split("\n"), A.length);

const isContainedLintPath = (path: Path.Path, root: string, candidate: string): boolean => {
  const relativeFromRoot = normalizePath(path.relative(root, candidate));

  return (
    relativeFromRoot === "" ||
    relativeFromRoot === "." ||
    (!path.isAbsolute(relativeFromRoot) && relativeFromRoot !== ".." && !Str.startsWith("../")(relativeFromRoot))
  );
};

/**
 * Collect TypeScript source files under a lint root without following symlink escapes.
 *
 * **Example** (Reference the TypeScript file collector)
 *
 * ```ts
 * console.log("collectTypeScriptFiles")
 * ```
 *
 * @param root - Root directory to scan for TypeScript sources.
 * @returns Sorted list of TypeScript source files under the lint root.
 * @category utilities
 * @since 0.0.0
 */
export const collectTypeScriptFiles = Effect.fn("Lint.collectTypeScriptFiles")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<string>, LintFileDiscoveryError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(root).pipe(LintFileDiscoveryError.mapError(root, root, "Failed to check directory"));

  if (!exists) {
    return A.empty<string>();
  }

  const rootResolvedPath = path.resolve(root);
  const canonicalRoot = yield* fs
    .realPath(root)
    .pipe(LintFileDiscoveryError.mapError(root, root, "Failed to resolve canonical root path"));

  if (rootResolvedPath !== canonicalRoot) {
    return A.empty<string>();
  }

  const visitedCanonicalDirs = MutableHashSet.empty<string>();

  const walk = Effect.fn("Lint.collectTypeScriptFiles.walk")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, LintFileDiscoveryError, FileSystem.FileSystem | Path.Path> {
    const canonicalCurrentPath = yield* fs
      .realPath(currentPath)
      .pipe(LintFileDiscoveryError.mapError(root, currentPath, "Failed to resolve canonical path"));

    if (!isContainedLintPath(path, canonicalRoot, canonicalCurrentPath)) {
      return A.empty<string>();
    }

    if (currentPath !== root && path.resolve(currentPath) !== canonicalCurrentPath) {
      return A.empty<string>();
    }

    if (MutableHashSet.has(visitedCanonicalDirs, canonicalCurrentPath)) {
      return A.empty<string>();
    }

    MutableHashSet.add(visitedCanonicalDirs, canonicalCurrentPath);

    const entries = yield* fs
      .readDirectory(currentPath)
      .pipe(LintFileDiscoveryError.mapError(root, currentPath, "Failed to read directory"));

    let results = A.empty<string>();

    for (const entry of entries) {
      const candidate = path.join(currentPath, entry);
      const canonicalCandidate = yield* fs
        .realPath(candidate)
        .pipe(LintFileDiscoveryError.mapError(root, candidate, "Failed to resolve canonical path"));
      const stat = yield* fs
        .stat(candidate)
        .pipe(LintFileDiscoveryError.mapError(root, candidate, "Failed to stat path"));

      if (!isContainedLintPath(path, canonicalRoot, canonicalCandidate)) {
        continue;
      }

      const isSymlinkPath = path.resolve(candidate) !== canonicalCandidate;

      if (stat.type === "Directory") {
        if (isSymlinkPath) {
          continue;
        }
        if (isExcludedTypeScriptSourcePath(`${candidate}/`)) {
          continue;
        }
        results = A.appendAll(results, yield* walk(candidate));
        continue;
      }

      if (!isSymlinkPath && Str.endsWith(".ts")(entry) && !isExcludedTypeScriptSourcePath(candidate)) {
        results = A.append(results, candidate);
      }
    }

    return results;
  });

  return A.sort(yield* walk(root), Order.String);
});

const recoverLintFileDiscovery = <A>(checkName: string, fallback: A) =>
  Effect.fn(function* (error: LintFileDiscoveryError) {
    void fallback;
    yield* Console.error(`[${checkName}] ${error.message}`);
    return yield* failWithReportedExit(`[${checkName}] ${error.message}`, 2);
  });

const runLintToolingSchemaFirst = Effect.fn("runLintToolingSchemaFirst")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const filesByRoot = yield* Effect.forEach(RUNTIME_SCHEMA_FIRST_ROOTS, collectTypeScriptFiles, {
    concurrency: "unbounded",
  }).pipe(
    Effect.catchTag(
      "LintFileDiscoveryError",
      recoverLintFileDiscovery("check-tooling-schema-first", A.empty<ReadonlyArray<string>>())
    )
  );

  const files = pipe(filesByRoot, A.flatten, A.dedupe);
  const toolingFiles = A.filter(files, (file) => Str.startsWith(`${TOOLING_ROOT}/`)(file));
  let violations = A.empty<LintViolation>();

  for (const file of files) {
    const isToolingFile = Str.startsWith(`${TOOLING_ROOT}/`)(file);
    const isRuntimeFocusFile = HashSet.has(FOCUS_RUNTIME_FILES, file);
    if (!isToolingFile && !isRuntimeFocusFile) {
      continue;
    }

    const absolute = path.join(process.cwd(), file);
    const content = yield* fs.readFileString(absolute).pipe(Effect.orElseSucceed(thunkEmptyStr));

    const pushViolation = (kind: string, detail: string, offset = 0): void => {
      violations = A.append(
        violations,
        LintViolation.make({
          file,
          line: lineNumberAt(content, offset),
          kind,
          detail,
        })
      );
    };

    const basename = path.basename(file, ".ts");
    if (
      isToolingFile &&
      !HashSet.has(ALLOWED_NON_PASCAL_FILENAMES, basename) &&
      !/^[A-Z][A-Za-z0-9]*$/.test(basename)
    ) {
      pushViolation(
        "pascal-case-file",
        "Tooling CLI TypeScript files must use PascalCase names (except index.ts and bin.ts)."
      );
    }

    if (isToolingFile && /\bexport\s+interface\b/.test(content)) {
      pushViolation("export-interface", "Use schema classes or type aliases instead of exported interfaces.");
    }

    if (isToolingFile && /\bData\.taggedEnum\b|\bData\.TaggedEnum\b/.test(content)) {
      pushViolation("data-tagged-enum", "Use Schema tagged unions via LiteralKit + mapMembers + Tuple.evolve.");
    }

    if (isRuntimeFocusFile) {
      if (
        /from\s+["']node:(?:fs|path|child_process)["']/.test(content) ||
        /require\(["']node:(?:fs|path|child_process)["']\)/.test(content)
      ) {
        pushViolation(
          "node-runtime-import",
          "Use Effect runtime services (FileSystem/Path/process) instead of node:* runtime imports in hotspot files."
        );
      }

      if (/\bawait\s+fetch\s*\(|\breturn\s+fetch\s*\(|=\s*fetch\s*\(|\bglobalThis\.fetch\s*\(/.test(content)) {
        pushViolation(
          "native-fetch",
          "Use effect/unstable/http HttpClient and provide @effect/platform-bun/BunHttpClient.layer instead of native fetch."
        );
      }

      const sortPattern = /\b([A-Za-z_$][\w$]*)\.sort\s*\(/g;
      for (const match of Str.matchAll(sortPattern)(content)) {
        const receiver = match[1];
        if (receiver !== "A") {
          pushViolation("native-sort", "Use A.sort with an explicit Order in hotspot runtime files.", match.index ?? 0);
        }
      }

      const stringMethodPattern = /\b([A-Za-z_$][\w$]*)\.(split|trim|startsWith|endsWith)\s*\(/g;
      for (const match of Str.matchAll(stringMethodPattern)(content)) {
        const receiver = match[1];
        const method = match[2];
        if (receiver !== "Str") {
          pushViolation(
            "string-method",
            `Use effect/String helpers or shared schema transforms instead of native .${method}(...) in hotspot files.`,
            match.index ?? 0
          );
        }
      }
    }

    if (isToolingFile) {
      const serviceLinePattern = /Context\.Service</g;
      for (const match of Str.matchAll(serviceLinePattern)(content)) {
        const start = match.index ?? 0;
        const nearby = Str.slice(start, start + 320)(content);
        if (!/\(\)\(\s*\$I`/.test(nearby)) {
          pushViolation("service-id", "Context.Service tag must use $I`ServiceName` identity.", start);
        }
      }

      const classPattern = /S\.Class<[^>]+>\(\$I`[^`]+`\)\(/g;
      for (const match of Str.matchAll(classPattern)(content)) {
        const start = match.index ?? 0;
        const nearby = Str.slice(start, start + 2400)(content);
        if (!/\$I\.annote\(/.test(nearby)) {
          pushViolation("schema-annotation", "S.Class schema is missing $I.annote(...) metadata.", start);
        }
      }
    }
  }

  for (const schemaName of REQUIRED_TAGGED_UNIONS) {
    const declarationPattern = new RegExp(`(?:export\\s+)?const\\s+${schemaName}\\s*=`);
    let found = false;

    for (const file of toolingFiles) {
      const absolute = path.join(process.cwd(), file);
      const content = yield* fs.readFileString(absolute).pipe(Effect.orElseSucceed(thunkEmptyStr));
      const match = declarationPattern.exec(content);

      if (match === null) {
        continue;
      }

      found = true;
      const snippet = Str.slice(match.index, match.index + 1400)(content);
      const usesLiteralKitPattern =
        !/\.mapMembers\(/.test(snippet) ||
        !/Tuple\.evolve\(/.test(snippet) ||
        !/\.pipe\(S\.toTaggedUnion\(/.test(snippet);
      const usesTaggedUnionFallback =
        schemaName === "GenerationAction" && /S\.Union\(/.test(snippet) && /\.pipe\(S\.toTaggedUnion\(/.test(snippet);

      if (usesLiteralKitPattern && !usesTaggedUnionFallback) {
        violations = A.append(
          violations,
          LintViolation.make({
            file,
            line: lineNumberAt(content, match.index),
            kind: "tagged-union-pattern",
            detail: `${schemaName} must use LiteralKit + mapMembers + Tuple.evolve + S.toTaggedUnion.`,
          })
        );
      }
      break;
    }

    if (!found) {
      violations = A.append(
        violations,
        LintViolation.make({
          file: TOOLING_ROOT,
          line: 1,
          kind: "missing-schema",
          detail: `Expected tagged union schema '${schemaName}' was not found.`,
        })
      );
    }
  }

  if (A.length(violations) > 0) {
    yield* Console.error(`[check-tooling-schema-first] found ${A.length(violations)} violation(s).`);
    for (const violation of violations) {
      yield* Console.error(`${violation.file}:${violation.line} [${violation.kind}] ${violation.detail}`);
    }
    return yield* failWithReportedExit("check-tooling-schema-first: violations found.");
  }

  yield* Console.log("[check-tooling-schema-first] OK: packages/tooling/tool/cli schema-first checks passed.");
});

const runLintCircular = Effect.fn("runLintCircular")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const dirs = ["packages/tooling/tool/cli/src", "packages/tooling/library/repo-utils/src"];
  let hasCircular = false;

  for (const dir of dirs) {
    if (!(yield* fs.exists(dir))) {
      yield* Console.log(`Skipping missing directory: ${dir}`);
      continue;
    }

    const result = yield* Effect.tryPromise({
      // Import madge lazily: its transitive `detective-typescript` dependency
      // crashes at module-eval time under Bun (`ts.Extension.Cjs` undefined),
      // so a static top-level import would take down every sibling command that
      // shares this CLI tree (version-sync, tsconfig-sync, ...) at startup.
      try: () =>
        import("madge").then(({ default: madge }) =>
          madge(dir, {
            fileExtensions: ["ts"],
            tsConfig: "tsconfig.json",
            detectiveOptions: { ts: { skipTypeImports: true } },
          })
        ),
      catch: (cause) =>
        LintCircularAnalysisError.new(
          `Failed to analyze circular deps in ${dir}: ${Inspectable.toStringUnknown(cause, 0)}`
        ),
    });

    const circular = result.circular();
    yield* A.match(circular, {
      onEmpty: () => Effect.void,
      onNonEmpty: Effect.fn("Lint.circular.onNonEmpty")(function* (cycles) {
        hasCircular = true;
        yield* Console.error(`Circular dependencies in ${dir}:`);
        for (const cycle of cycles) {
          yield* Console.error(`  ${A.join(cycle, " -> ")}`);
        }
      }),
    });
  }

  if (hasCircular) {
    return yield* failWithReportedExit("lint circular: circular dependencies found.");
  }

  yield* Console.log("No circular dependencies found.");
});

const runDeprecatedApiLintShard = Effect.fn("runDeprecatedApiLintShard")(function* (shard: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(shard).pipe(Effect.orElseSucceed(() => false));

  if (!exists) {
    yield* Console.log(`[lint:deprecated-apis] skipping missing shard: ${shard}`);
    return;
  }

  const hasLocalEslint = yield* fs.exists(DEPRECATED_API_LINT_ESLINT_BIN).pipe(Effect.orElseSucceed(() => false));
  const command = hasLocalEslint ? `./${DEPRECATED_API_LINT_ESLINT_BIN}` : "bunx";
  const eslintArgs = [
    "--cache",
    "--cache-location",
    deprecatedApiLintCacheLocation(shard),
    "--cache-strategy",
    "content",
    "--config",
    "eslint.config.mjs",
    // The labs root may exist while holding zero lab apps (README-only
    // container, goals/lab-apps-lifecycle D3); only the labs shard tolerates
    // an unmatched pattern so an empty root cannot fail the law lane.
    ...(shard === LABS_WORKSPACE_ROOT ? ["--no-error-on-unmatched-pattern"] : A.empty<string>()),
    shard,
  ];
  const args = hasLocalEslint ? eslintArgs : ["eslint", ...eslintArgs];
  yield* Console.log(`[lint:deprecated-apis] ${shard}: ${command} ${A.join(args, " ")}`);

  const exitCode = yield* runToExit({
    command,
    args,
    cwd: process.cwd(),
    env: {
      BEEP_ESLINT_PROFILE: "deprecated-apis",
      NODE_OPTIONS: DEPRECATED_API_LINT_NODE_OPTIONS,
    },
    extendEnv: true,
    stdio: "inherit",
  });

  if (exitCode !== 0) {
    return yield* failWithReportedExit(`lint deprecated-apis: ${shard} failed with exit code ${exitCode}.`, exitCode);
  }
});

const runDeprecatedApiLint = Effect.fn("runDeprecatedApiLint")(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(DEPRECATED_API_LINT_CACHE_DIRECTORY, { recursive: true });
  yield* Console.log(
    `[lint:deprecated-apis] running ${A.length(DEPRECATED_API_LINT_SHARDS)} shards with concurrency ${DEPRECATED_API_LINT_CONCURRENCY}`
  );
  yield* Effect.forEach(DEPRECATED_API_LINT_SHARDS, runDeprecatedApiLintShard, {
    concurrency: DEPRECATED_API_LINT_CONCURRENCY,
  });

  yield* Console.log("[lint:deprecated-apis] OK: no deprecated vendor API usage found.");
});

/**
 * Lint command for circular dependency checks.
 *
 * **Example** (Reference the circular-import subcommand)
 *
 * ```ts
 * console.log("docgen metadata")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const lintCircularCommand = Command.make("circular", {}, runLintCircular).pipe(
  Command.withDescription("Detect circular dependencies in tooling source directories")
);

/**
 * Lint command for deprecated vendor API usage.
 *
 * **Example** (Show the deprecated-apis invocation)
 *
 * ```ts
 * console.log("bun run beep lint deprecated-apis")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const lintDeprecatedApisCommand = Command.make("deprecated-apis", {}, runDeprecatedApiLint).pipe(
  Command.withDescription("Check TypeScript sources for deprecated third-party API usage")
);

/**
 * Lint command for repo-wide root policy checks.
 *
 * **Example** (Show the policy lint invocation)
 *
 * ```ts
 * console.log("bun run beep lint policy")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
const lintPolicyCommand = Command.make(
  "policy",
  {
    full: Flag.boolean("full").pipe(Flag.withDefault(false), Flag.withDescription("Run the full policy sweep locally")),
  },
  ({ full }) => runRootLintPolicyTask(full)
).pipe(Command.withDescription("Run repo-wide lint policy checks"));

/**
 * Lint alias for the goals doctor (the CLI has no command-alias mechanism, so
 * this second registration delegates to the Goals runner).
 *
 * **Example** (Show the goal-packets lint invocation)
 *
 * ```ts
 * console.log("bun run beep lint goal-packets")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
const lintGoalPacketsCommand = Command.make("goal-packets", {}, () => runGoalsDoctor({ writeBaseline: false })).pipe(
  Command.withDescription("Diff goal-packet manifests against reality (alias of beep goals doctor)")
);

/**
 * Lint command for schema-first CLI conventions.
 *
 * **Example** (Reference the schema-first lint subcommand)
 *
 * ```ts
 * console.log("docgen metadata")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const lintToolingSchemaFirstCommand = Command.make("tooling-schema-first", {}, runLintToolingSchemaFirst).pipe(
  Command.withDescription("Check packages/tooling/tool/cli source for schema-first conventions")
);

const lintSubcommands = [
  lintCircularCommand,
  lintDeprecatedApisCommand,
  lintEcosystemPolarityCommand,
  lintGoalPacketsCommand,
  lintIdentityRegistryCommand,
  lintJudgeRubricCommand,
  lintPackageTestImportsCommand,
  lintPackageTestTypecheckCommand,
  lintPolicyCommand,
  lintReflectionArtifactsCommand,
  lintRoadmapRefsCommand,
  lintSchemaCatalogCommand,
  lintSchemaFirstCommand,
  lintSchemaTopologyCommand,
  lintToolingSchemaFirstCommand,
];

/**
 * Lint command group.
 *
 * **Example** (Reference the lint command group)
 *
 * ```ts
 * console.log("lintCommand")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lintCommand = Command.make("lint", {}, () =>
  printLines(["Lint commands:", ...A.map(lintSubcommands, (command) => `- bun run beep lint ${command.name}`)])
).pipe(Command.withDescription("Repository lint policy checks"), Command.withSubcommands(lintSubcommands));
