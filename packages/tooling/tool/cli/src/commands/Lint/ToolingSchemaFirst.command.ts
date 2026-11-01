/**
 * Tooling schema-first lint: `beep lint tooling-schema-first`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { isExcludedTypeScriptSourcePath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { isContainedLintPath } from "./internal/LintPackage.ts";
import { SchemaFirstSchemaClass } from "./internal/SchemaFirstSchemaClass.ts";
import { LintFileDiscoveryError } from "./Lint.errors.ts";

const $I = $RepoCliId.create("commands/Lint/ToolingSchemaFirst.command");

const TOOLING_ROOT = "packages/tooling/tool/cli/src";
const RUNTIME_SCHEMA_FIRST_ROOTS = [TOOLING_ROOT] as const;
const FOCUS_RUNTIME_FILES = HashSet.fromIterable([
  "packages/tooling/tool/cli/src/commands/Lint/index.ts",
  "packages/tooling/tool/cli/src/commands/Laws/index.ts",
  "packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts",
  "packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts",
]);
const ALLOWED_NON_PASCAL_FILENAMES = HashSet.fromIterable(["index", "bin"]);

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
class LintViolation extends S.Opaque<LintViolation, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    line: S.Finite,
    kind: S.String,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("LintViolation", {
      description: "Lint violation report row.",
    })
  )
) {}

const lineNumberAt = (content: string, offset: number): number =>
  pipe(content, Str.slice(0, offset), Str.split("\n"), A.length);

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
        "Use effect/http HttpClient and provide @effect/platform-bun/BunHttpClient.layer instead of native fetch."
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

// Parsed rather than matched with `<[^>]+>`, so brand type arguments and nested generics never hide a class.
const schemaAnnotationViolations = (file: string, content: string): ReadonlyArray<LintViolation> =>
  A.map(SchemaFirstSchemaClass.missingIdentityAnnotationOffsets(file, content), (offset) =>
    lintViolation(
      file,
      content,
      "schema-annotation",
      "Schema class is missing $I.annote(...) / $I.annoteSchema(...) metadata.",
      offset
    )
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
export const lintToolingSchemaFirstCommand = Command.make("tooling-schema-first", {}, runLintToolingSchemaFirst).pipe(
  Command.withDescription("Check packages/tooling/tool/cli source for schema-first conventions")
);
