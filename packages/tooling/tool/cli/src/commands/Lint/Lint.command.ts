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
  "packages/tooling",
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

const lintViolation = (file: string, content: string, kind: string, detail: string, offset = 0): LintViolation =>
  LintViolation.make({ file, line: lineNumberAt(content, offset), kind, detail });

const appendLintViolation = (
  violations: Array<LintViolation>,
  file: string,
  content: string,
  kind: string,
  detail: string,
  offset = 0
) => void A.appendInPlace(violations, lintViolation(file, content, kind, detail, offset));

const patternViolations = (
  file: string,
  content: string,
  pattern: RegExp,
  isValidAt: (offset: number) => boolean,
  kind: string,
  detail: string
): ReadonlyArray<LintViolation> => {
  const violations = A.empty<LintViolation>();
  for (const match of Str.matchAll(pattern)(content)) {
    const offset = match.index ?? 0;
    if (!isValidAt(offset)) appendLintViolation(violations, file, content, kind, detail, offset);
  }
  return violations;
};

const nativeSortViolations = (file: string, content: string): ReadonlyArray<LintViolation> => {
  const violations = A.empty<LintViolation>();
  for (const match of Str.matchAll(/\b([A-Za-z_$][\w$]*)\.sort\s*\(/g)(content)) {
    if (match[1] !== "A") {
      A.appendInPlace(
        violations,
        lintViolation(
          file,
          content,
          "native-sort",
          "Use A.sort with an explicit Order in hotspot runtime files.",
          match.index ?? 0
        )
      );
    }
  }
  return violations;
};

const nativeStringMethodViolations = (file: string, content: string): ReadonlyArray<LintViolation> => {
  const violations = A.empty<LintViolation>();
  for (const match of Str.matchAll(/\b([A-Za-z_$][\w$]*)\.(split|trim|startsWith|endsWith)\s*\(/g)(content)) {
    if (match[1] !== "Str") {
      A.appendInPlace(
        violations,
        lintViolation(
          file,
          content,
          "string-method",
          `Use effect/String helpers or shared schema transforms instead of native .${match[2]}(...) in hotspot files.`,
          match.index ?? 0
        )
      );
    }
  }
  return violations;
};

const runtimeFocusViolations = (file: string, content: string): ReadonlyArray<LintViolation> => {
  const violations = A.empty<LintViolation>();
  if (
    /from\s+["']node:(?:fs|path|child_process)["']/.test(content) ||
    /require\(["']node:(?:fs|path|child_process)["']\)/.test(content)
  ) {
    A.appendInPlace(
      violations,
      lintViolation(
        file,
        content,
        "node-runtime-import",
        "Use Effect runtime services (FileSystem/Path/process) instead of node:* runtime imports in hotspot files."
      )
    );
  }
  if (/\bawait\s+fetch\s*\(|\breturn\s+fetch\s*\(|=\s*fetch\s*\(|\bglobalThis\.fetch\s*\(/.test(content)) {
    A.appendInPlace(
      violations,
      lintViolation(
        file,
        content,
        "native-fetch",
        "Use effect/unstable/http HttpClient and provide @effect/platform-bun/BunHttpClient.layer instead of native fetch."
      )
    );
  }
  return pipe(
    violations,
    A.appendAll(nativeSortViolations(file, content)),
    A.appendAll(nativeStringMethodViolations(file, content))
  );
};

const serviceIdentityViolations = (file: string, content: string): ReadonlyArray<LintViolation> =>
  patternViolations(
    file,
    content,
    /Context\.Service</g,
    (offset) => /\(\)\(\s*\$I`/.test(Str.slice(offset, offset + 320)(content)),
    "service-id",
    "Context.Service tag must use $I`ServiceName` identity."
  );

const schemaAnnotationViolations = (file: string, content: string): ReadonlyArray<LintViolation> =>
  patternViolations(
    file,
    content,
    /S\.Class<[^>]+>\(\$I`[^`]+`\)\(/g,
    (offset) => /\$I\.annote\(/.test(Str.slice(offset, offset + 2400)(content)),
    "schema-annotation",
    "S.Class schema is missing $I.annote(...) metadata."
  );

const runtimeSchemaFirstViolationKinds = (file: string, content: string): ReadonlyArray<string> =>
  pipe(
    runtimeFocusViolations(file, content),
    A.appendAll(serviceIdentityViolations(file, content)),
    A.appendAll(schemaAnnotationViolations(file, content)),
    A.map((violation) => violation.kind)
  );

/**
 * Reports focused runtime and schema-first violation kinds for pure policy tests.
 *
 * **Details**
 *
 * This seam uses the same detectors as the tooling lint command without reading
 * files or mutating process state.
 *
 * **Example** (Inspect a hotspot source fragment)
 *
 * ```ts
 * import { LintCommandTestKit } from "@beep/repo-cli/commands/Lint"
 *
 * const kinds = LintCommandTestKit.runtimeSchemaFirstViolationKinds(
 *   "packages/tooling/tool/cli/src/commands/Lint/index.ts",
 *   "const values = [2, 1]; values.sort()"
 * )
 * console.log(kinds)
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const LintCommandTestKit = {
  runtimeSchemaFirstViolationKinds,
} as const;

const toolingFileViolations = (file: string, content: string, path: Path.Path): ReadonlyArray<LintViolation> => {
  const violations = A.empty<LintViolation>();
  const basename = path.basename(file, ".ts");
  if (!HashSet.has(ALLOWED_NON_PASCAL_FILENAMES, basename) && !/^[A-Z][A-Za-z0-9]*$/.test(basename)) {
    A.appendInPlace(
      violations,
      lintViolation(
        file,
        content,
        "pascal-case-file",
        "Tooling CLI TypeScript files must use PascalCase names (except index.ts and bin.ts)."
      )
    );
  }
  if (/\bexport\s+interface\b/.test(content)) {
    A.appendInPlace(
      violations,
      lintViolation(
        file,
        content,
        "export-interface",
        "Use schema classes or type aliases instead of exported interfaces."
      )
    );
  }
  if (/\bData\.taggedEnum\b|\bData\.TaggedEnum\b/.test(content)) {
    A.appendInPlace(
      violations,
      lintViolation(
        file,
        content,
        "data-tagged-enum",
        "Use Schema tagged unions via LiteralKit + mapMembers + Tuple.evolve."
      )
    );
  }
  return pipe(
    violations,
    A.appendAll(serviceIdentityViolations(file, content)),
    A.appendAll(schemaAnnotationViolations(file, content))
  );
};

const inspectLintFile = Effect.fn("Lint.inspectToolingSchemaFirstFile")(function* (
  file: string,
  fs: FileSystem.FileSystem,
  path: Path.Path
) {
  const content = yield* fs.readFileString(path.join(process.cwd(), file)).pipe(Effect.orElseSucceed(thunkEmptyStr));
  const isToolingFile = Str.startsWith(`${TOOLING_ROOT}/`)(file);
  const violations = isToolingFile ? toolingFileViolations(file, content, path) : A.empty<LintViolation>();
  return HashSet.has(FOCUS_RUNTIME_FILES, file)
    ? pipe(violations, A.appendAll(runtimeFocusViolations(file, content)))
    : violations;
});

const taggedUnionViolation = Effect.fn("Lint.inspectRequiredTaggedUnion")(function* (
  schemaName: (typeof REQUIRED_TAGGED_UNIONS)[number],
  toolingFiles: ReadonlyArray<string>,
  fs: FileSystem.FileSystem,
  path: Path.Path
) {
  const declarationPattern = new RegExp(`(?:export\\s+)?const\\s+${schemaName}\\s*=`);
  for (const file of toolingFiles) {
    const content = yield* fs.readFileString(path.join(process.cwd(), file)).pipe(Effect.orElseSucceed(thunkEmptyStr));
    const match = declarationPattern.exec(content);
    if (match === null) continue;
    const snippet = Str.slice(match.index, match.index + 1400)(content);
    const missesLiteralKitPattern =
      !/\.mapMembers\(/.test(snippet) ||
      !/Tuple\.evolve\(/.test(snippet) ||
      !/\.pipe\(S\.toTaggedUnion\(/.test(snippet);
    const usesAllowedFallback =
      schemaName === "GenerationAction" && /S\.Union\(/.test(snippet) && /\.pipe\(S\.toTaggedUnion\(/.test(snippet);
    return missesLiteralKitPattern && !usesAllowedFallback
      ? A.of(
          lintViolation(
            file,
            content,
            "tagged-union-pattern",
            `${schemaName} must use LiteralKit + mapMembers + Tuple.evolve + S.toTaggedUnion.`,
            match.index
          )
        )
      : A.empty<LintViolation>();
  }
  return A.of(
    LintViolation.make({
      file: TOOLING_ROOT,
      line: 1,
      kind: "missing-schema",
      detail: `Expected tagged union schema '${schemaName}' was not found.`,
    })
  );
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
  const fileViolations = yield* Effect.forEach(files, (file) => inspectLintFile(file, fs, path), {
    concurrency: "unbounded",
  });
  const requiredUnionViolations = yield* Effect.forEach(REQUIRED_TAGGED_UNIONS, (schemaName) =>
    taggedUnionViolation(schemaName, toolingFiles, fs, path)
  );
  const violations = pipe(fileViolations, A.appendAll(requiredUnionViolations), A.flatten);

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
