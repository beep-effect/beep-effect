/**
 * Per-module import migration and enforcement logic.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeUrl from "node:url";
import { $RepoCliId } from "@beep/identity/packages";
import { extractFencedCodeBlockDetails } from "@beep/repo-docgen/Core";
import { FsUtils } from "@beep/repo-utils/FsUtils";
import { jsonParse } from "@beep/repo-utils/JsonUtils";
import { readPackageJsonFile } from "@beep/repo-utils/schemas/PackageJson";
import {
  TYPESCRIPT_SOURCE_EXCLUDED_SEGMENTS,
  TYPESCRIPT_SOURCE_EXCLUDED_SUFFIXES,
  toPosixPath,
} from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, Inspectable, MutableHashSet, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Node, Project, SyntaxKind } from "ts-morph";
import { EffectImportRulesConfigurationError, EffectImportRulesPersistenceError } from "./Laws.errors.ts";
import type {
  ExportDeclaration,
  ExportDeclarationStructure,
  ImportDeclaration,
  ImportDeclarationStructure,
  ImportSpecifierStructure,
  OptionalKind,
  SourceFile,
} from "ts-morph";

const $I = $RepoCliId.create("commands/Laws/EffectImports");

// P2 promotes only the approved pilot before either measurement state so the
// enforcement configuration remains identical across the pair. Later families
// join with their Biome restriction during P3; the final flip removes this list.
const EFFECT_IMPORT_PROMOTED_FAMILY_PREFIXES = A.of("apps/professional-desktop");

/**
 * Corpus representation scanned by the per-module import vehicle.
 *
 * **Example** (Select standalone documentation)
 *
 * ```ts
 * import { EffectImportCorpusMode } from "@beep/repo-cli/commands/Laws/EffectImports"
 * console.log(EffectImportCorpusMode.is.markdown("markdown")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EffectImportCorpusMode = LiteralKit(["code", "jsdoc", "markdown"]).annotate(
  $I.annote("EffectImportCorpusMode", {
    description: "Corpus representation scanned by the per-module import vehicle.",
  })
);

/**
 * Type-level member of {@link EffectImportCorpusMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectImportCorpusMode = typeof EffectImportCorpusMode.Type;

/**
 * Reason category for a root import that cannot be rewritten mechanically.
 *
 * **Example** (Identify a collision review)
 *
 * ```ts
 * import { EffectImportManualReviewKind } from "@beep/repo-cli/commands/Laws/EffectImports"
 *
 * console.log(EffectImportManualReviewKind.is.collision("collision")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EffectImportManualReviewKind = LiteralKit([
  "ambiguous",
  "collision",
  "dynamic-import",
  "import-equals",
  "import-type",
  "missing-mapping",
  "require",
  "root-namespace",
  "side-effect",
]).annotate(
  $I.annote("EffectImportManualReviewKind", {
    description: "Reason category for a root import that cannot be rewritten mechanically.",
  })
);

/**
 * Type-level member of {@link EffectImportManualReviewKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectImportManualReviewKind = typeof EffectImportManualReviewKind.Type;

/**
 * Runtime options for per-module import migration checks.
 *
 * **Details**
 *
 * `candidate` is a dry-run-only escape hatch for proving a proposed family
 * before it joins the promoted-family list. Normal Yeet and Lint Policy runs
 * leave it disabled, so the empty initial ratchet cannot rewrite unmigrated
 * families ahead of the pilot gate.
 *
 * **Example** (Configure import governance)
 *
 * ```ts
 * import { EffectImportRulesOptions } from "@beep/repo-cli/commands/Laws/EffectImports"
 *
 * const options = EffectImportRulesOptions.make({
 *   candidate: true,
 *   includePrefixes: ["apps/example"]
 * })
 * console.log(options.candidate) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectImportRulesOptions extends S.Class<EffectImportRulesOptions>($I`EffectImportRulesOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    candidate: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    mode: EffectImportCorpusMode.pipe(
      S.withConstructorDefault(Effect.succeed("code" as const)),
      S.withDecodingDefault(Effect.succeed("code" as const))
    ),
    enforceDocumentation: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    excludePaths: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    includePaths: S.Array(S.String).pipe(S.optionalKey),
    includePrefixes: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    promotedFamilyPrefixes: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(EFFECT_IMPORT_PROMOTED_FAMILY_PREFIXES)),
      S.withDecodingDefault(Effect.succeed(EFFECT_IMPORT_PROMOTED_FAMILY_PREFIXES))
    ),
  },
  $I.annote("EffectImportRulesOptions", {
    description: "Runtime options for per-module import migration checks and candidate dry runs.",
  })
) {}

/**
 * One root import that requires a human decision instead of a guessed rewrite.
 *
 * **Example** (Record an unmapped binding)
 *
 * ```ts
 * import { EffectImportManualReview } from "@beep/repo-cli/commands/Laws/EffectImports"
 *
 * const review = EffectImportManualReview.make({
 *   kind: "missing-mapping",
 *   file: "apps/example/src/main.ts",
 *   line: 1,
 *   moduleSpecifier: "effect",
 *   binding: "FutureModule",
 *   reason: "No validated mapping exists."
 * })
 * console.log(review.kind) // "missing-mapping"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectImportManualReview extends S.Class<EffectImportManualReview>($I`EffectImportManualReview`)(
  {
    kind: EffectImportManualReviewKind,
    file: S.String,
    line: S.Natural,
    moduleSpecifier: S.String,
    binding: S.String,
    reason: S.String,
  },
  $I.annote("EffectImportManualReview", {
    description: "A root import intentionally left unchanged because the migration cannot prove a safe target.",
  })
) {}

/**
 * Summary of per-module import migration results.
 *
 * **Example** (Inspect planned rewrites)
 *
 * ```ts
 * import { EffectImportRulesSummary } from "@beep/repo-cli/commands/Laws/EffectImports"
 *
 * const summary = EffectImportRulesSummary.make({
 *   mappingTableVersion: "root-export-graph/v1",
 *   mode: "code",
 *   write: false,
 *   candidate: true,
 *   scannedFiles: 1,
 *   scannedFences: 0,
 *   touchedFiles: 1,
 *   rootImportsRewritten: 1,
 *   rootExportsRewritten: 0,
 *   emittedImports: 1,
 *   emittedExports: 0,
 *   rootSpecifierCounts: { effect: 1 },
 *   strictFailure: false
 * })
 * console.log(summary.rootImportsRewritten) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectImportRulesSummary extends S.Class<EffectImportRulesSummary>($I`EffectImportRulesSummary`)(
  {
    mappingTableVersion: S.Literal("root-export-graph/v1"),
    mode: EffectImportCorpusMode,
    write: S.Boolean,
    candidate: S.Boolean,
    scannedFiles: S.Natural,
    scannedFences: S.Natural,
    touchedFiles: S.Natural,
    rootImportsRewritten: S.Natural,
    rootExportsRewritten: S.Natural,
    emittedImports: S.Natural,
    emittedExports: S.Natural,
    rootSpecifierCounts: S.Record(S.String, S.Natural),
    strictFailure: S.Boolean,
    changedFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    manualReviews: S.Array(EffectImportManualReview).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<EffectImportManualReview>())),
      S.withDecodingDefault(Effect.succeed(A.empty<EffectImportManualReview>()))
    ),
    parserWarnings: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("EffectImportRulesSummary", {
    description: "Structured counts and manual-review findings from one per-module import scan.",
  })
) {}

class EffectImportSourceTransformSummary extends S.Class<EffectImportSourceTransformSummary>(
  $I`EffectImportSourceTransformSummary`
)(
  {
    affected: S.Boolean,
    rewritten: S.Boolean,
    rootImportsRewritten: S.Natural,
    rootExportsRewritten: S.Natural,
    emittedImports: S.Natural,
    emittedExports: S.Natural,
    rootSpecifierCounts: S.Record(S.String, S.Natural),
    manualReviews: S.Array(EffectImportManualReview),
  },
  $I.annote("EffectImportSourceTransformSummary", {
    description: "Internal result of transforming one executable or fenced TypeScript source unit.",
  })
) {}

type NamespaceImportTarget = {
  readonly kind: "namespace";
  readonly source: string;
};

type NamedImportTarget = {
  readonly kind: "named";
  readonly source: string;
  readonly imported: string;
};

type DefaultImportTarget = {
  readonly kind: "default";
  readonly source: string;
};

type ImportTarget = DefaultImportTarget | NamespaceImportTarget | NamedImportTarget;

type ImportTargetCandidates = Readonly<Record<string, ReadonlyArray<ImportTarget>>>;

type RootImportMappings = Readonly<Record<string, ImportTargetCandidates>>;

const namespaceTarget = (source: string): ImportTarget => ({ kind: "namespace", source });

const namedTarget = (source: string, imported: string): ImportTarget => ({ kind: "named", source, imported });

const defaultTarget = (source: string): ImportTarget => ({ kind: "default", source });

/**
 * Census-owned routes for bindings whose barrel graph has more than one
 * public first-hop path. Each override is still checked against both package
 * export maps before it replaces the ambiguous graph-derived candidates.
 */
const CENSUS_MAPPING_OVERRIDES: RootImportMappings = {
  "@beep/schema": {
    NonNegativeInt: [namedTarget("@beep/schema/Number", "NonNegativeInt")],
  },
};

const mappingCandidatesEntry = (
  binding: string,
  targets: ReadonlyArray<ImportTarget>
): readonly [string, ReadonlyArray<ImportTarget>] => [binding, targets];

const FlatPackageExports = S.Record(S.String, S.Union([S.String, S.Null])).pipe(
  $I.annoteSchema("FlatPackageExports", {
    title: "Flat Package Exports",
    description: "The unconditional string-or-null package export maps used by repository workspaces.",
  })
);

type FlatPackageExports = typeof FlatPackageExports.Type;

const isFlatPackageExports = S.is(FlatPackageExports);
const isUnknownJsonObject = S.is(S.Record(S.String, S.Unknown));

/**
 * Complete executable Effect-root namespace map from the packet census.
 *
 * This list is deliberately data, not a `effect/${binding}` guess: an unseen
 * binding joins manual review until the census and export validation are
 * extended. Flat Function exports are modeled separately below.
 */
const EFFECT_NAMESPACE_BINDINGS = [
  "BigDecimal",
  "BigInt",
  "Brand",
  "Cache",
  "Cause",
  "Chunk",
  "Clock",
  "Config",
  "ConfigProvider",
  "Console",
  "Context",
  "Crypto",
  "Data",
  "DateTime",
  "Deferred",
  "Duration",
  "Effect",
  "Encoding",
  "Equal",
  "Equivalence",
  "ErrorReporter",
  "ExecutionPlan",
  "Exit",
  "Fiber",
  "FiberMap",
  "FiberSet",
  "FileSystem",
  "Function",
  "Graph",
  "Hash",
  "HashMap",
  "HashSet",
  "Inspectable",
  "Iterable",
  "JsonPatch",
  "JsonPointer",
  "Layer",
  "Logger",
  "ManagedRuntime",
  "Match",
  "Metric",
  "MutableHashMap",
  "MutableHashSet",
  "MutableList",
  "MutableRef",
  "Number",
  "Option",
  "Order",
  "Path",
  "PlatformError",
  "Predicate",
  "PrimaryKey",
  "PubSub",
  "Queue",
  "Random",
  "Redacted",
  "Ref",
  "References",
  "RegExp",
  "Request",
  "RequestResolver",
  "Result",
  "Runtime",
  "Schedule",
  "Schema",
  "SchemaAST",
  "SchemaGetter",
  "SchemaIssue",
  "SchemaParser",
  "SchemaTransformation",
  "Scope",
  "Semaphore",
  "Sink",
  "Stdio",
  "Stream",
  "Struct",
  "Terminal",
  "Tracer",
  "Tuple",
  "TxQueue",
  "TxRef",
  "Types",
  "Unify",
] as const;

const EFFECT_FUNCTION_BINDINGS = ["cast", "flow", "identity", "pipe"] as const;

const EFFECT_ROOT_MAPPING: ImportTargetCandidates = R.fromEntries(
  A.appendAll(
    A.appendAll(
      A.map(EFFECT_NAMESPACE_BINDINGS, (binding) =>
        mappingCandidatesEntry(binding, A.of(namespaceTarget(`effect/${binding}`)))
      ),
      A.of(mappingCandidatesEntry("TestClock", A.of(namespaceTarget("effect/testing/TestClock"))))
    ),
    A.map(EFFECT_FUNCTION_BINDINGS, (binding) =>
      mappingCandidatesEntry(binding, A.of(namedTarget("effect/Function", binding)))
    )
  )
);

const EFFECT_PACKAGE_JSON_PATH = NodeUrl.fileURLToPath(import.meta.resolve("effect/package.json"));

const CODE_GLOBS = [
  "apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "packages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "infra/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "!packages/**/docs/**",
] as const;

const MARKDOWN_GLOBS = [
  ".patterns/**/*.{md,mdx}",
  "standards/**/*.{md,mdx}",
  ".claude/skills/**/*.{md,mdx}",
  "docs/**/*.{md,mdx}",
  "goals/*/[A-Z]*.md",
] as const;

const NON_SHIPPING_PREFIXES = ["scratchpad/", "explorations/"] as const;
const GENERATED_OR_VENDOR_SEGMENTS = ["/.repos/", "/node_modules/", "/dist/", "/vendor/"] as const;
const GENERATED_SOURCE_SEGMENTS = A.filter(TYPESCRIPT_SOURCE_EXCLUDED_SEGMENTS, Str.includes("generated"));
const GENERATED_SOURCE_SUFFIXES = A.filter(TYPESCRIPT_SOURCE_EXCLUDED_SUFFIXES, Str.startsWith(".gen."));
const GOAL_OPS_PATTERN = /^goals\/[^/]+\/(?:ops|research\/assets)\//u;

const hasPathPrefix = (prefix: string, filePath: string): boolean =>
  filePath === prefix || Str.startsWith(Str.endsWith("/")(prefix) ? prefix : `${prefix}/`)(filePath);

const isDeliberatelyExcludedPath = (filePath: string): boolean =>
  A.some(NON_SHIPPING_PREFIXES, (prefix) => Str.startsWith(prefix)(filePath)) ||
  A.some(GENERATED_OR_VENDOR_SEGMENTS, (segment) => Str.includes(segment)(`/${filePath}`)) ||
  A.some(GENERATED_SOURCE_SEGMENTS, (segment) => Str.includes(segment)(`/${filePath}`)) ||
  A.some(GENERATED_SOURCE_SUFFIXES, (suffix) => Str.endsWith(suffix)(filePath)) ||
  O.isSome(Str.match(GOAL_OPS_PATTERN)(filePath));

const sameTarget = (left: ImportTarget, right: ImportTarget): boolean =>
  left.kind === right.kind &&
  left.source === right.source &&
  (left.kind !== "named" || (right.kind === "named" && left.imported === right.imported));

const distinctTargets = (targets: ReadonlyArray<ImportTarget>): ReadonlyArray<ImportTarget> =>
  A.dedupeWith(targets, sameTarget);

const wildcardCapture = (pattern: string, value: string): O.Option<string> => {
  const parts = Str.split("*")(pattern);
  if (A.length(parts) !== 2) {
    return O.none();
  }

  const prefix = O.getOrElse(A.head(parts), () => "");
  const suffix = O.getOrElse(A.last(parts), () => "");
  if (!Str.startsWith(prefix)(value) || !Str.endsWith(suffix)(value)) {
    return O.none();
  }

  return O.some(Str.slice(Str.length(prefix), Str.length(value) - Str.length(suffix))(value));
};

const publicSubpathsForSourceTarget = (exports: FlatPackageExports, sourceTarget: string): ReadonlyArray<string> =>
  pipe(
    R.toEntries(exports),
    A.filter(([subpath, target]) => subpath !== "." && P.isString(target)),
    A.map(([subpath, target]) => {
      if (!P.isString(target)) {
        return O.none<string>();
      }
      if (target === sourceTarget) {
        return O.some(subpath);
      }
      return pipe(
        wildcardCapture(target, sourceTarget),
        O.map((capture) => Str.replace("*", capture)(subpath))
      );
    }),
    A.getSomes,
    A.dedupe
  );

const exportMapCoversSubpath = (exports: FlatPackageExports, subpath: string): boolean =>
  pipe(
    R.get(exports, subpath),
    O.filter(P.isString),
    O.match({
      onNone: () =>
        A.some(
          R.toEntries(exports),
          ([candidate, target]) => P.isString(target) && O.isSome(wildcardCapture(candidate, subpath))
        ),
      onSome: () => true,
    })
  );

const isSafePublicSubpath = (subpath: string): boolean =>
  Str.startsWith("./")(subpath) &&
  subpath !== "./package.json" &&
  !Str.includes("/internal/")(`${subpath}/`) &&
  !Str.endsWith("/index")(subpath);

const externalExportTarget = (moduleSpecifier: string): O.Option<string> =>
  Str.startsWith("effect/")(moduleSpecifier) &&
  !Str.startsWith("effect/internal/")(moduleSpecifier) &&
  !Str.endsWith("/index")(moduleSpecifier)
    ? O.some(moduleSpecifier)
    : O.none();

const appendMappingCandidate = (
  mappings: ImportTargetCandidates,
  binding: string,
  target: ImportTarget
): ImportTargetCandidates =>
  R.set(mappings, binding, pipe(R.get(mappings, binding), O.getOrElse(A.empty<ImportTarget>), A.append(target)));

const flatExportsFrom = (value: unknown): O.Option<FlatPackageExports> =>
  isFlatPackageExports(value) ? O.some(value) : O.none();

// fallow-ignore-next-line complexity -- one export-graph traversal must validate workspace and publish routes together; ambiguity and missing-route fixtures cover every branch
const buildFoundationRootMappings = Effect.fn("EffectImports.buildFoundationRootMappings")(function* (
  project: Project,
  effectExports: FlatPackageExports
) {
  const path = yield* Path.Path;
  let rootMappings = R.empty<string, ImportTargetCandidates>();

  const foundationRootIndexes = pipe(
    project.getSourceFiles(),
    A.filter((sourceFile) => {
      const relativePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
      return Str.startsWith("packages/foundation/")(relativePath) && Str.endsWith("/src/index.ts")(relativePath);
    })
  );

  for (const rootIndex of foundationRootIndexes) {
    const packageDirectory = path.dirname(path.dirname(rootIndex.getFilePath()));
    const manifest = yield* readPackageJsonFile(path.join(packageDirectory, "package.json"));
    const workspaceExports = pipe(manifest.exports, O.flatMap(flatExportsFrom));
    const configuredPublishExports = pipe(
      manifest.publishConfig,
      O.flatMap((publishConfig) => O.fromUndefinedOr(publishConfig.exports)),
      O.flatMap(flatExportsFrom)
    );
    const publishedExports = configuredPublishExports;

    rootMappings = R.set(rootMappings, manifest.name, R.empty<string, ReadonlyArray<ImportTarget>>());

    if (O.isNone(workspaceExports) || O.isNone(publishedExports)) {
      continue;
    }

    let packageMappings = R.empty<string, ReadonlyArray<ImportTarget>>();

    for (const declaration of rootIndex.getExportDeclarations()) {
      const moduleSpecifier = declaration.getModuleSpecifierValue();
      if (P.isUndefined(moduleSpecifier)) {
        continue;
      }

      const targetSpecifiers = Str.startsWith(".")(moduleSpecifier)
        ? pipe(
            O.fromUndefinedOr(declaration.getModuleSpecifierSourceFile()),
            O.map((sourceFile) => `./${toPosixPath(path.relative(packageDirectory, sourceFile.getFilePath()))}`),
            O.map((sourceTarget) => publicSubpathsForSourceTarget(workspaceExports.value, sourceTarget)),
            O.getOrElse(A.empty<string>),
            A.filter(isSafePublicSubpath),
            A.filter((subpath) => exportMapCoversSubpath(publishedExports.value, subpath)),
            A.map((subpath) => `${manifest.name}${Str.slice(1)(subpath)}`)
          )
        : pipe(
            externalExportTarget(moduleSpecifier),
            O.filter((target) =>
              exportMapCoversSubpath(effectExports, `./${Str.slice(Str.length("effect/"))(target)}`)
            ),
            O.match({ onNone: A.empty<string>, onSome: A.of })
          );

      if (A.isReadonlyArrayEmpty(targetSpecifiers)) {
        continue;
      }

      for (const targetSpecifier of targetSpecifiers) {
        const namespaceExport = declaration.getNamespaceExport();
        if (P.isNotUndefined(namespaceExport)) {
          packageMappings = appendMappingCandidate(
            packageMappings,
            namespaceExport.getName(),
            namespaceTarget(targetSpecifier)
          );
          continue;
        }

        const namedExports = declaration.getNamedExports();
        if (A.isReadonlyArrayNonEmpty(namedExports)) {
          for (const namedExport of namedExports) {
            const imported = namedExport.getName();
            const binding = namedExport.getAliasNode()?.getText() ?? imported;
            packageMappings = appendMappingCandidate(
              packageMappings,
              binding,
              imported === "default" ? defaultTarget(targetSpecifier) : namedTarget(targetSpecifier, imported)
            );
          }
          continue;
        }

        const targetSourceFile = declaration.getModuleSpecifierSourceFile();
        if (P.isUndefined(targetSourceFile)) {
          continue;
        }

        for (const [binding, exportedDeclarations] of targetSourceFile.getExportedDeclarations()) {
          if (binding !== "default") {
            const namespaceTargetSpecifiers = pipe(
              exportedDeclarations,
              A.filter(Node.isSourceFile),
              A.flatMap((sourceFile) =>
                pipe(
                  `./${toPosixPath(path.relative(packageDirectory, sourceFile.getFilePath()))}`,
                  (sourceTarget) => publicSubpathsForSourceTarget(workspaceExports.value, sourceTarget),
                  A.filter(isSafePublicSubpath),
                  A.filter((subpath) => exportMapCoversSubpath(publishedExports.value, subpath)),
                  A.map((subpath) => `${manifest.name}${Str.slice(1)(subpath)}`)
                )
              ),
              A.dedupe
            );
            if (A.isReadonlyArrayNonEmpty(namespaceTargetSpecifiers)) {
              for (const namespaceTargetSpecifier of namespaceTargetSpecifiers) {
                packageMappings = appendMappingCandidate(
                  packageMappings,
                  binding,
                  namespaceTarget(namespaceTargetSpecifier)
                );
              }
            } else {
              packageMappings = appendMappingCandidate(packageMappings, binding, namedTarget(targetSpecifier, binding));
            }
          }
        }
      }
    }

    const censusOverrides = R.get(CENSUS_MAPPING_OVERRIDES, manifest.name);
    if (O.isSome(censusOverrides)) {
      for (const [binding, targets] of R.toEntries(censusOverrides.value)) {
        const validatedTargets = A.filter(targets, (target) => {
          if (!Str.startsWith(`${manifest.name}/`)(target.source)) {
            return false;
          }
          const subpath = `.${Str.slice(Str.length(manifest.name))(target.source)}`;
          return (
            isSafePublicSubpath(subpath) &&
            exportMapCoversSubpath(workspaceExports.value, subpath) &&
            exportMapCoversSubpath(publishedExports.value, subpath)
          );
        });
        if (A.isReadonlyArrayNonEmpty(validatedTargets)) {
          packageMappings = R.set(packageMappings, binding, validatedTargets);
        }
      }
    }

    rootMappings = R.set(rootMappings, manifest.name, packageMappings);
  }

  return rootMappings;
});

const buildEffectRootMapping = Effect.fn("EffectImports.buildEffectRootMapping")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const manifest = yield* fs.readFileString(EFFECT_PACKAGE_JSON_PATH).pipe(Effect.flatMap(jsonParse));
  const exports = pipe(
    O.liftPredicate(manifest, isUnknownJsonObject),
    O.flatMap((record) => R.get(record, "exports")),
    O.flatMap(flatExportsFrom)
  );
  if (O.isNone(exports)) {
    return {
      exports: R.empty<string, string | null>(),
      mappings: R.empty<string, ReadonlyArray<ImportTarget>>(),
    } as const;
  }

  return {
    exports: exports.value,
    mappings: pipe(
      R.toEntries(EFFECT_ROOT_MAPPING),
      A.filter(([, targets]) =>
        A.every(targets, (target) =>
          exportMapCoversSubpath(exports.value, `./${Str.slice(Str.length("effect/"))(target.source)}`)
        )
      ),
      R.fromEntries
    ),
  } as const;
});

const importTargetFor = (
  mappings: RootImportMappings,
  moduleSpecifier: string,
  binding: string
): O.Option<ImportTarget> =>
  pipe(
    R.get(mappings, moduleSpecifier),
    O.flatMap((packageMappings) => R.get(packageMappings, binding)),
    O.map(distinctTargets),
    O.filter((targets) => A.length(targets) === 1),
    O.flatMap(A.head)
  );

const importTargetFailureReason = (mappings: RootImportMappings, moduleSpecifier: string, binding: string): string =>
  pipe(
    R.get(mappings, moduleSpecifier),
    O.flatMap((packageMappings) => R.get(packageMappings, binding)),
    O.map(distinctTargets),
    O.match({
      onNone: () => "No validated binding-to-module mapping exists.",
      onSome: (targets) =>
        A.length(targets) > 1
          ? "The root binding resolves to multiple public modules; a human must choose the intended leaf."
          : "No validated binding-to-module mapping exists.",
    })
  );

const importTargetFailureKind = (
  mappings: RootImportMappings,
  moduleSpecifier: string,
  binding: string
): EffectImportManualReviewKind =>
  pipe(
    R.get(mappings, moduleSpecifier),
    O.flatMap((packageMappings) => R.get(packageMappings, binding)),
    O.map(distinctTargets),
    O.match({
      onNone: () => "missing-mapping" as const,
      onSome: (targets) => (A.length(targets) > 1 ? ("ambiguous" as const) : ("missing-mapping" as const)),
    })
  );

type NamedImportPlan = {
  readonly isTypeOnly: boolean;
  readonly source: string;
  readonly specifiers: Array<{ readonly name: string; readonly alias?: string }>;
};

type DeclarationPlan = {
  readonly imports: ReadonlyArray<OptionalKind<ImportDeclarationStructure>>;
  readonly manualReviews: ReadonlyArray<EffectImportManualReview>;
};

const manualReview = (
  kind: EffectImportManualReviewKind,
  file: string,
  line: number,
  moduleSpecifier: string,
  binding: string,
  reason: string
): EffectImportManualReview => EffectImportManualReview.make({ kind, file, line, moduleSpecifier, binding, reason });

// fallow-ignore-next-line complexity -- the explicit ts-morph syntax matrix preserves aliases, type-only bindings, namespaces, and manual-review reasons; fixtures cover each branch
const planNamedRootImport = (
  mappings: RootImportMappings,
  file: string,
  line: number,
  moduleSpecifier: string,
  declarationIsTypeOnly: boolean,
  namedImports: ReturnType<ImportDeclaration["getNamedImports"]>
): DeclarationPlan => {
  let namedGroups = R.empty<string, NamedImportPlan>();
  const namespaceImports = A.empty<OptionalKind<ImportDeclarationStructure>>();
  const manualReviews = A.empty<EffectImportManualReview>();

  for (const specifier of namedImports) {
    const binding = specifier.getName();
    const target = O.getOrUndefined(importTargetFor(mappings, moduleSpecifier, binding));

    if (P.isUndefined(target)) {
      A.appendInPlace(
        manualReviews,
        manualReview(
          importTargetFailureKind(mappings, moduleSpecifier, binding),
          file,
          line,
          moduleSpecifier,
          binding,
          importTargetFailureReason(mappings, moduleSpecifier, binding)
        )
      );
      continue;
    }

    const localName = specifier.getAliasNode()?.getText() ?? binding;
    const isTypeOnly = declarationIsTypeOnly || specifier.isTypeOnly();

    if (target.kind === "namespace") {
      A.appendInPlace(namespaceImports, {
        isTypeOnly,
        moduleSpecifier: target.source,
        namespaceImport: localName,
      });
      continue;
    }

    if (target.kind === "default") {
      A.appendInPlace(
        manualReviews,
        manualReview(
          "missing-mapping",
          file,
          line,
          moduleSpecifier,
          binding,
          "A named root binding cannot be rewritten as a default import."
        )
      );
      continue;
    }

    const groupKey = `${target.source}\u0000${isTypeOnly ? "type" : "value"}`;
    const group = O.getOrElse(R.get(namedGroups, groupKey), () => ({
      isTypeOnly,
      source: target.source,
      specifiers: A.empty<{ readonly name: string; readonly alias?: string }>(),
    }));
    A.appendInPlace(
      group.specifiers,
      localName === target.imported ? { name: target.imported } : { name: target.imported, alias: localName }
    );
    namedGroups = R.set(namedGroups, groupKey, group);
  }

  if (A.isReadonlyArrayNonEmpty(manualReviews)) {
    return { imports: A.empty(), manualReviews };
  }

  const namedDeclarations = pipe(
    R.values(namedGroups),
    A.map(
      (group): OptionalKind<ImportDeclarationStructure> => ({
        isTypeOnly: group.isTypeOnly,
        moduleSpecifier: group.source,
        namedImports: group.specifiers,
      })
    )
  );

  return {
    imports: A.appendAll(namespaceImports, namedDeclarations),
    manualReviews,
  };
};

const sideEffectImportManualReviews = (
  file: string,
  line: number,
  moduleSpecifier: string,
  importDeclaration: ImportDeclaration
): ReadonlyArray<EffectImportManualReview> =>
  P.isUndefined(importDeclaration.getDefaultImport()) &&
  P.isUndefined(importDeclaration.getNamespaceImport()) &&
  A.isReadonlyArrayEmpty(importDeclaration.getNamedImports())
    ? [
        manualReview(
          "side-effect",
          file,
          line,
          moduleSpecifier,
          "side-effect import",
          "A side-effect-only root import has no behavior-preserving per-module rewrite."
        ),
      ]
    : A.empty();

const planRootImport = (
  mappings: RootImportMappings,
  file: string,
  importDeclaration: ImportDeclaration
): DeclarationPlan => {
  const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
  const line = importDeclaration.getStartLineNumber();
  const defaultImport = importDeclaration.getDefaultImport();
  const namespaceImport = importDeclaration.getNamespaceImport();
  const namedImports = importDeclaration.getNamedImports();
  let imports = A.empty<OptionalKind<ImportDeclarationStructure>>();
  let manualReviews = sideEffectImportManualReviews(file, line, moduleSpecifier, importDeclaration);

  if (P.isNotUndefined(defaultImport)) {
    const target = O.getOrUndefined(importTargetFor(mappings, moduleSpecifier, "default"));
    if (P.isNotUndefined(target) && target.kind === "default") {
      imports = A.append(imports, {
        isTypeOnly: importDeclaration.isTypeOnly(),
        moduleSpecifier: target.source,
        defaultImport: defaultImport.getText(),
      });
    } else {
      manualReviews = A.append(
        manualReviews,
        manualReview(
          importTargetFailureKind(mappings, moduleSpecifier, "default"),
          file,
          line,
          moduleSpecifier,
          defaultImport.getText(),
          importTargetFailureReason(mappings, moduleSpecifier, "default")
        )
      );
    }
  }

  if (P.isNotUndefined(namespaceImport)) {
    manualReviews = A.append(
      manualReviews,
      manualReview(
        "root-namespace",
        file,
        line,
        moduleSpecifier,
        namespaceImport.getText(),
        "A root namespace import has no single per-module equivalent."
      )
    );
  }

  if (A.isReadonlyArrayNonEmpty(namedImports)) {
    const namedPlan = planNamedRootImport(
      mappings,
      file,
      line,
      moduleSpecifier,
      importDeclaration.isTypeOnly(),
      namedImports
    );
    imports = A.appendAll(imports, namedPlan.imports);
    manualReviews = A.appendAll(manualReviews, namedPlan.manualReviews);
  }

  return A.isReadonlyArrayNonEmpty(manualReviews)
    ? { imports: A.empty(), manualReviews }
    : {
        imports,
        manualReviews: A.empty(),
      };
};

const declarationStructuresWithComments = <Structure extends object>(
  declaration: ExportDeclaration | ImportDeclaration,
  structures: ReadonlyArray<Structure>
): ReadonlyArray<Structure> => {
  const leadingTrivia = pipe(
    declaration.getLeadingCommentRanges(),
    A.map((comment) => comment.getText()),
    A.join("\n")
  );
  const trailingTrivia = pipe(
    declaration.getTrailingCommentRanges(),
    A.map((comment) => comment.getText()),
    A.join(" ")
  );

  return A.map(structures, (structure, index) => ({
    ...structure,
    ...(index === 0 && Str.isNonEmpty(leadingTrivia) ? { leadingTrivia: `${leadingTrivia}\n` } : {}),
    ...(index === 0 && Str.isNonEmpty(trailingTrivia) ? { trailingTrivia: ` ${trailingTrivia}` } : {}),
  }));
};

const compatibleDestinationImports = (
  sourceFile: SourceFile,
  rootDeclaration: ImportDeclaration,
  structure: OptionalKind<ImportDeclarationStructure>
): ReadonlyArray<ImportDeclaration> =>
  pipe(
    sourceFile.getImportDeclarations(),
    A.filter(
      (candidate) =>
        candidate !== rootDeclaration &&
        candidate.getModuleSpecifierValue() === structure.moduleSpecifier &&
        candidate.isTypeOnly() === (structure.isTypeOnly ?? false) &&
        P.isUndefined(candidate.getAttributes())
    )
  );

const addMissingNamedImports = (
  declaration: ImportDeclaration,
  namedImports: ReadonlyArray<OptionalKind<ImportSpecifierStructure>>
): void => {
  for (const namedImport of namedImports) {
    const alreadyImported = A.some(
      declaration.getNamedImports(),
      (existing) =>
        existing.getName() === namedImport.name &&
        (existing.getAliasNode()?.getText() ?? existing.getName()) === (namedImport.alias ?? namedImport.name) &&
        existing.isTypeOnly() === (namedImport.isTypeOnly ?? false)
    );
    if (!alreadyImported) {
      declaration.addNamedImport(namedImport);
    }
  }
};

const transferImportStructureTrivia = (
  declaration: ImportDeclaration,
  structure: OptionalKind<ImportDeclarationStructure>
): void => {
  const leadingTrivia = P.isString(structure.leadingTrivia) ? structure.leadingTrivia : "";
  const trailingTrivia = P.isString(structure.trailingTrivia) ? structure.trailingTrivia : "";
  if (Str.isEmpty(leadingTrivia) && Str.isEmpty(trailingTrivia)) {
    return;
  }
  declaration.replaceWithText(`${leadingTrivia}${declaration.getText()}${trailingTrivia}`);
};

// fallow-ignore-next-line complexity -- this atomic ts-morph merge matrix preserves default, namespace, named-import, and trivia semantics; collision fixtures cover every branch
const applyImportStructures = (
  sourceFile: SourceFile,
  rootDeclaration: ImportDeclaration,
  structures: ReadonlyArray<OptionalKind<ImportDeclarationStructure>>
): void => {
  let insertionIndex = sourceFile.getStatements().indexOf(rootDeclaration);

  for (const structure of structures) {
    const candidates = compatibleDestinationImports(sourceFile, rootDeclaration, structure);
    if (P.isNotUndefined(structure.defaultImport)) {
      const exact = A.findFirst(
        candidates,
        (candidate) => candidate.getDefaultImport()?.getText() === structure.defaultImport
      );
      if (O.isSome(exact)) {
        transferImportStructureTrivia(exact.value, structure);
        continue;
      }
      const mergeTarget = A.findFirst(candidates, (candidate) => P.isUndefined(candidate.getDefaultImport()));
      if (O.isSome(mergeTarget)) {
        mergeTarget.value.setDefaultImport(structure.defaultImport);
        transferImportStructureTrivia(mergeTarget.value, structure);
        continue;
      }
    }

    if (P.isNotUndefined(structure.namespaceImport)) {
      const exact = A.findFirst(
        candidates,
        (candidate) => candidate.getNamespaceImport()?.getText() === structure.namespaceImport
      );
      if (O.isSome(exact)) {
        transferImportStructureTrivia(exact.value, structure);
        continue;
      }
      const mergeTarget = A.findFirst(
        candidates,
        (candidate) =>
          P.isUndefined(candidate.getNamespaceImport()) && A.isReadonlyArrayEmpty(candidate.getNamedImports())
      );
      if (O.isSome(mergeTarget)) {
        mergeTarget.value.setNamespaceImport(structure.namespaceImport);
        transferImportStructureTrivia(mergeTarget.value, structure);
        continue;
      }
    }

    const namedImports = structure.namedImports as ReadonlyArray<OptionalKind<ImportSpecifierStructure>> | undefined;
    if (P.isNotUndefined(namedImports)) {
      const mergeTarget = A.findFirst(candidates, (candidate) => P.isUndefined(candidate.getNamespaceImport()));
      if (O.isSome(mergeTarget)) {
        addMissingNamedImports(mergeTarget.value, namedImports);
        transferImportStructureTrivia(mergeTarget.value, structure);
        continue;
      }
    }

    sourceFile.insertImportDeclaration(insertionIndex, structure);
    insertionIndex += 1;
  }
};

type NamedExportPlan = {
  readonly isTypeOnly: boolean;
  readonly source: string;
  readonly specifiers: Array<{ readonly name: string; readonly alias?: string; readonly isTypeOnly?: boolean }>;
};

type ExportPlan = {
  readonly exports: ReadonlyArray<OptionalKind<ExportDeclarationStructure>>;
  readonly manualReviews: ReadonlyArray<EffectImportManualReview>;
};

// fallow-ignore-next-line complexity -- the explicit ts-morph export matrix preserves aliases, namespaces, stars, type-only bindings, and review reasons; fixtures cover each branch
const planRootExport = (mappings: RootImportMappings, file: string, declaration: ExportDeclaration): ExportPlan => {
  const moduleSpecifier = declaration.getModuleSpecifierValue();
  if (P.isUndefined(moduleSpecifier)) {
    return { exports: A.empty(), manualReviews: A.empty() };
  }

  const line = declaration.getStartLineNumber();
  const namespaceExport = declaration.getNamespaceExport();
  const namedExports = declaration.getNamedExports();
  if (P.isNotUndefined(namespaceExport) || A.isReadonlyArrayEmpty(namedExports)) {
    return {
      exports: A.empty(),
      manualReviews: A.of(
        manualReview(
          "root-namespace",
          file,
          line,
          moduleSpecifier,
          namespaceExport?.getName() ?? "*",
          "A root namespace re-export has no single per-module equivalent."
        )
      ),
    };
  }

  let namedGroups = R.empty<string, NamedExportPlan>();
  const namespaceDeclarations = A.empty<OptionalKind<ExportDeclarationStructure>>();
  const manualReviews = A.empty<EffectImportManualReview>();

  // fallow-ignore-next-line code-duplication -- named import and export planners intentionally mirror syntax-specific alias and manual-review semantics
  for (const specifier of namedExports) {
    const binding = specifier.getName();
    const target = O.getOrUndefined(importTargetFor(mappings, moduleSpecifier, binding));
    if (P.isUndefined(target)) {
      A.appendInPlace(
        manualReviews,
        manualReview(
          importTargetFailureKind(mappings, moduleSpecifier, binding),
          file,
          line,
          moduleSpecifier,
          binding,
          importTargetFailureReason(mappings, moduleSpecifier, binding)
        )
      );
      continue;
    }

    const exportedName = specifier.getAliasNode()?.getText() ?? binding;
    const isTypeOnly = declaration.isTypeOnly() || specifier.isTypeOnly();
    if (target.kind === "namespace") {
      A.appendInPlace(namespaceDeclarations, {
        isTypeOnly,
        moduleSpecifier: target.source,
        namespaceExport: exportedName,
      });
      continue;
    }

    const importedName = target.kind === "default" ? "default" : target.imported;
    const groupKey = `${target.source}\u0000${declaration.isTypeOnly() ? "type" : "value"}`;
    const group = O.getOrElse(R.get(namedGroups, groupKey), () => ({
      isTypeOnly: declaration.isTypeOnly(),
      source: target.source,
      specifiers: A.empty<{ readonly name: string; readonly alias?: string; readonly isTypeOnly?: boolean }>(),
    }));
    A.appendInPlace(group.specifiers, {
      name: importedName,
      ...(exportedName === importedName ? {} : { alias: exportedName }),
      ...(isTypeOnly === group.isTypeOnly ? {} : { isTypeOnly }),
    });
    namedGroups = R.set(namedGroups, groupKey, group);
  }

  if (A.isReadonlyArrayNonEmpty(manualReviews)) {
    return { exports: A.empty(), manualReviews };
  }

  return {
    exports: A.appendAll(
      namespaceDeclarations,
      pipe(
        R.values(namedGroups),
        A.map(
          (group): OptionalKind<ExportDeclarationStructure> => ({
            isTypeOnly: group.isTypeOnly,
            moduleSpecifier: group.source,
            namedExports: group.specifiers,
          })
        )
      )
    ),
    manualReviews,
  };
};

const rootSpecifierFromNode = (node: Node, mappings: RootImportMappings): O.Option<string> =>
  pipe(
    node.getDescendantsOfKind(SyntaxKind.StringLiteral),
    A.head,
    O.map((literal) => literal.getLiteralText()),
    O.filter((moduleSpecifier) => R.has(mappings, moduleSpecifier))
  );

// fallow-ignore-next-line complexity -- this closed syntax census keeps dynamic import, require, import-type, and import-equals findings in one auditable review ledger
const unsupportedRootUsageReviews = (
  mappings: RootImportMappings,
  file: string,
  sourceFile: SourceFile
): ReadonlyArray<EffectImportManualReview> => {
  const reviews = A.empty<EffectImportManualReview>();

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    const kind =
      expression.getKind() === SyntaxKind.ImportKeyword
        ? ("dynamic-import" as const)
        : Node.isIdentifier(expression) && expression.getText() === "require"
          ? ("require" as const)
          : undefined;
    if (P.isUndefined(kind)) {
      continue;
    }

    const firstArgument = A.head(callExpression.getArguments());
    const moduleSpecifier = pipe(
      firstArgument,
      O.filter(Node.isStringLiteral),
      O.map((literal) => literal.getLiteralText()),
      O.filter((specifier) => R.has(mappings, specifier))
    );
    if (O.isSome(moduleSpecifier)) {
      A.appendInPlace(
        reviews,
        manualReview(
          kind,
          file,
          callExpression.getStartLineNumber(),
          moduleSpecifier.value,
          kind === "dynamic-import" ? "import()" : "require()",
          kind === "dynamic-import"
            ? "A dynamic root import may require multiple lazy module loads; split it manually."
            : "A CommonJS root require cannot be split safely without inspecting its runtime use."
        )
      );
    }
  }

  for (const importType of sourceFile.getDescendantsOfKind(SyntaxKind.ImportType)) {
    const moduleSpecifier = rootSpecifierFromNode(importType, mappings);
    if (O.isSome(moduleSpecifier)) {
      A.appendInPlace(
        reviews,
        manualReview(
          "import-type",
          file,
          importType.getStartLineNumber(),
          moduleSpecifier.value,
          "import type expression",
          "A type-level root import must be routed by the referenced qualifier."
        )
      );
    }
  }

  for (const importEquals of sourceFile.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
    const moduleSpecifier = rootSpecifierFromNode(importEquals, mappings);
    if (O.isSome(moduleSpecifier)) {
      A.appendInPlace(
        reviews,
        manualReview(
          "import-equals",
          file,
          importEquals.getStartLineNumber(),
          moduleSpecifier.value,
          importEquals.getName(),
          "An import-equals root namespace has no single per-module equivalent."
        )
      );
    }
  }

  return reviews;
};

const incrementSpecifierCount = (
  counts: Readonly<Record<string, number>>,
  moduleSpecifier: string
): Readonly<Record<string, number>> =>
  R.set(
    counts,
    moduleSpecifier,
    pipe(
      R.get(counts, moduleSpecifier),
      O.getOrElse(() => 0),
      (count) => count + 1
    )
  );

// fallow-ignore-next-line complexity -- this counter deliberately mirrors the closed unsupported-syntax census so measured totals and review detection cannot drift
const rootSpecifierCountsFor = (
  mappings: RootImportMappings,
  sourceFile: SourceFile
): Readonly<Record<string, number>> => {
  let counts = R.empty<string, number>();
  const add = (moduleSpecifier: string | undefined): void => {
    if (P.isNotUndefined(moduleSpecifier) && R.has(mappings, moduleSpecifier)) {
      counts = incrementSpecifierCount(counts, moduleSpecifier);
    }
  };

  for (const declaration of sourceFile.getImportDeclarations()) {
    add(declaration.getModuleSpecifierValue());
  }
  for (const declaration of sourceFile.getExportDeclarations()) {
    add(declaration.getModuleSpecifierValue());
  }
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (
      expression.getKind() !== SyntaxKind.ImportKeyword &&
      !(Node.isIdentifier(expression) && expression.getText() === "require")
    ) {
      continue;
    }
    const argument = O.getOrUndefined(A.head(callExpression.getArguments()));
    if (P.isNotUndefined(argument) && Node.isStringLiteral(argument)) {
      add(argument.getLiteralText());
    }
  }
  for (const importType of sourceFile.getDescendantsOfKind(SyntaxKind.ImportType)) {
    add(rootSpecifierFromNode(importType, mappings).pipe(O.getOrUndefined));
  }
  for (const importEquals of sourceFile.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
    add(rootSpecifierFromNode(importEquals, mappings).pipe(O.getOrUndefined));
  }

  return counts;
};

const mergeSpecifierCounts = (
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>
): Readonly<Record<string, number>> => {
  let merged = left;
  for (const [moduleSpecifier, count] of R.toEntries(right)) {
    const current = O.getOrElse(R.get(merged, moduleSpecifier), () => 0);
    merged = R.set(merged, moduleSpecifier, current + count);
  }
  return merged;
};

// fallow-ignore-next-line complexity -- one source transaction must preserve shebang/trivia while atomically rewriting import and export declarations; the fixture matrix covers its branches
const transformSourceFile = (
  mappings: RootImportMappings,
  file: string,
  sourceFile: SourceFile
): EffectImportSourceTransformSummary => {
  const shebangPrefix = pipe(
    sourceFile.getFullText(),
    Str.match(/^#![^\r\n]*(?:(?:\r?\n)(?:[ \t]*(?:\r?\n))*|$)/u),
    O.map((match) => match[0])
  );
  const shebangLineOffset = pipe(
    shebangPrefix,
    O.map((prefix) => A.length(Str.split("\n")(prefix)) - 1),
    O.getOrElse(() => 0)
  );
  if (O.isSome(shebangPrefix)) {
    sourceFile.replaceText([0, Str.length(shebangPrefix.value)], "");
  }

  const importDeclarations = [...sourceFile.getImportDeclarations()];
  const exportDeclarations = [...sourceFile.getExportDeclarations()];
  let rootImportsRewritten = 0;
  let rootExportsRewritten = 0;
  let emittedImports = 0;
  let emittedExports = 0;
  const rootSpecifierCounts = rootSpecifierCountsFor(mappings, sourceFile);
  let manualReviews = A.fromIterable(unsupportedRootUsageReviews(mappings, file, sourceFile));

  for (const importDeclaration of importDeclarations) {
    const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
    if (!R.has(mappings, moduleSpecifier)) {
      continue;
    }

    const declarationPlan = planRootImport(mappings, file, importDeclaration);
    if (A.isReadonlyArrayNonEmpty(declarationPlan.manualReviews)) {
      manualReviews = A.appendAll(manualReviews, declarationPlan.manualReviews);
      continue;
    }

    if (A.isReadonlyArrayEmpty(declarationPlan.imports)) {
      continue;
    }

    applyImportStructures(
      sourceFile,
      importDeclaration,
      declarationStructuresWithComments(importDeclaration, declarationPlan.imports)
    );
    importDeclaration.remove();
    rootImportsRewritten += 1;
    emittedImports += A.length(declarationPlan.imports);
  }

  for (const exportDeclaration of exportDeclarations) {
    const moduleSpecifier = exportDeclaration.getModuleSpecifierValue();
    if (P.isUndefined(moduleSpecifier) || !R.has(mappings, moduleSpecifier)) {
      continue;
    }

    const declarationPlan = planRootExport(mappings, file, exportDeclaration);
    if (A.isReadonlyArrayNonEmpty(declarationPlan.manualReviews)) {
      manualReviews = A.appendAll(manualReviews, declarationPlan.manualReviews);
      continue;
    }
    if (A.isReadonlyArrayEmpty(declarationPlan.exports)) {
      continue;
    }

    const insertionIndex = sourceFile.getStatements().indexOf(exportDeclaration);
    sourceFile.insertExportDeclarations(
      insertionIndex,
      declarationStructuresWithComments(exportDeclaration, declarationPlan.exports)
    );
    exportDeclaration.remove();
    rootExportsRewritten += 1;
    emittedExports += A.length(declarationPlan.exports);
  }

  if (O.isSome(shebangPrefix)) {
    sourceFile.insertText(0, shebangPrefix.value);
  }
  if (shebangLineOffset > 0) {
    manualReviews = A.map(manualReviews, (review) =>
      EffectImportManualReview.make({
        kind: review.kind,
        file: review.file,
        line: review.line + shebangLineOffset,
        moduleSpecifier: review.moduleSpecifier,
        binding: review.binding,
        reason: review.reason,
      })
    );
  }

  return EffectImportSourceTransformSummary.make({
    affected: rootImportsRewritten > 0 || rootExportsRewritten > 0 || A.isReadonlyArrayNonEmpty(manualReviews),
    rewritten: rootImportsRewritten > 0 || rootExportsRewritten > 0,
    rootImportsRewritten,
    rootExportsRewritten,
    emittedImports,
    emittedExports,
    rootSpecifierCounts,
    manualReviews,
  });
};

class EffectImportFenceTransformSummary extends S.Class<EffectImportFenceTransformSummary>(
  $I`EffectImportFenceTransformSummary`
)(
  {
    content: S.String,
    scannedFences: S.Natural,
    rootImportsRewritten: S.Natural,
    rootExportsRewritten: S.Natural,
    emittedImports: S.Natural,
    emittedExports: S.Natural,
    rootSpecifierCounts: S.Record(S.String, S.Natural),
    manualReviews: S.Array(EffectImportManualReview),
    parserWarnings: S.Array(S.String),
  },
  $I.annote("EffectImportFenceTransformSummary", {
    description: "Internal result of parsing and transforming TypeScript fences in one documentation unit.",
  })
) {}

const transformFencedContent = (
  mappings: RootImportMappings,
  file: string,
  content: string
): EffectImportFenceTransformSummary => {
  const [fences, parserWarnings] = extractFencedCodeBlockDetails(content);
  let rewrittenContent = content;
  let rootImportsRewritten = 0;
  let rootExportsRewritten = 0;
  let emittedImports = 0;
  let emittedExports = 0;
  let rootSpecifierCounts = R.empty<string, number>();
  let manualReviews = A.empty<EffectImportManualReview>();

  const indexedFences = A.map(fences, (fence, index) => ({ fence, ordinal: index + 1 }));
  for (const { fence, ordinal } of A.reverse(indexedFences)) {
    const fenceProject = new Project({ useInMemoryFileSystem: true });
    const fenceSource = fenceProject.createSourceFile(`fence-${ordinal}${fence.extension}`, fence.code);
    const sourceSummary = transformSourceFile(mappings, `${file}#fence-${ordinal}`, fenceSource);
    rootImportsRewritten += sourceSummary.rootImportsRewritten;
    rootExportsRewritten += sourceSummary.rootExportsRewritten;
    emittedImports += sourceSummary.emittedImports;
    emittedExports += sourceSummary.emittedExports;
    rootSpecifierCounts = mergeSpecifierCounts(rootSpecifierCounts, sourceSummary.rootSpecifierCounts);
    manualReviews = A.appendAll(manualReviews, sourceSummary.manualReviews);

    if (sourceSummary.rewritten) {
      const replacement = `${Str.trimEnd(fenceSource.getFullText())}\n`;
      rewrittenContent = `${Str.slice(0, fence.codeStart)(rewrittenContent)}${replacement}${Str.slice(fence.codeEnd)(
        rewrittenContent
      )}`;
    }
  }

  return EffectImportFenceTransformSummary.make({
    content: rewrittenContent,
    scannedFences: A.length(fences),
    rootImportsRewritten,
    rootExportsRewritten,
    emittedImports,
    emittedExports,
    rootSpecifierCounts,
    manualReviews,
    parserWarnings,
  });
};

const renderJsDoc = (innerText: string): string =>
  pipe(
    Str.split("\n")(innerText),
    A.map((line) => (Str.isEmpty(line) ? " *" : ` * ${line}`)),
    (lines) => A.join(["/**", ...lines, " */"], "\n")
  );

// fallow-ignore-next-line complexity -- the policy predicate keeps exclusion, explicit scope, candidate mode, documentation mode, and family promotion gates visibly co-located
const isPathInActiveScope = (
  options: EffectImportRulesOptions,
  excludePaths: MutableHashSet.MutableHashSet<string>,
  relativePath: string
): boolean =>
  !MutableHashSet.has(excludePaths, relativePath) &&
  !isDeliberatelyExcludedPath(relativePath) &&
  (P.isUndefined(options.includePaths) && A.isReadonlyArrayEmpty(options.includePrefixes)
    ? true
    : (P.isNotUndefined(options.includePaths) && A.contains(options.includePaths, relativePath)) ||
      A.some(options.includePrefixes, (prefix) => hasPathPrefix(prefix, relativePath))) &&
  (options.candidate ||
    (options.mode !== "code" && !options.write) ||
    A.some(options.promotedFamilyPrefixes, (prefix) => hasPathPrefix(prefix, relativePath)));

const codeGlobsFor = (options: EffectImportRulesOptions): ReadonlyArray<string> => {
  if (P.isUndefined(options.includePaths) && A.isReadonlyArrayEmpty(options.includePrefixes)) {
    return CODE_GLOBS;
  }
  const prefixGlobs = A.map(
    options.includePrefixes,
    (prefix) => `${Str.trimEnd(Str.replace(/\/+$/u, "")(prefix))}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`
  );
  return pipe(options.includePaths ?? A.empty<string>(), A.appendAll(prefixGlobs), A.dedupe);
};

/**
 * Run per-module import migration/check logic.
 *
 * **Example** (Reference the import rules runner)
 *
 * ```ts
 * import { EffectImportRulesOptions, runEffectImportRules } from "@beep/repo-cli/commands/Laws/EffectImports"
 * import * as Effect from "effect/Effect"
 *
 * const scan = runEffectImportRules(EffectImportRulesOptions.make({
 *   candidate: true,
 *   includePrefixes: ["apps/example"]
 * }))
 * console.log(Effect.isEffect(scan)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- one command transaction coordinates the inert ratchet, three corpus modes, persistence, and strict verdict while preserving a single summary schema
export const runEffectImportRules = Effect.fn("EffectImports.runEffectImportRules")(function* (
  options: EffectImportRulesOptions
) {
  if (options.candidate && options.write) {
    return yield* EffectImportRulesConfigurationError.new(
      "Candidate scans are dry-run only and cannot persist updates."
    );
  }
  if (options.mode === "code" && !options.candidate && A.isReadonlyArrayEmpty(options.promotedFamilyPrefixes)) {
    return EffectImportRulesSummary.make({
      mappingTableVersion: "root-export-graph/v1",
      mode: options.mode,
      write: options.write,
      candidate: options.candidate,
      scannedFiles: 0,
      scannedFences: 0,
      touchedFiles: 0,
      rootImportsRewritten: 0,
      rootExportsRewritten: 0,
      emittedImports: 0,
      emittedExports: 0,
      rootSpecifierCounts: {},
      strictFailure: false,
    });
  }

  const path = yield* Path.Path;

  const excludePaths = MutableHashSet.empty<string>();
  for (const excludePath of options.excludePaths) {
    MutableHashSet.add(excludePaths, toPosixPath(excludePath));
  }

  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  if (options.mode !== "markdown") {
    project.addSourceFilesAtPaths(A.fromIterable(codeGlobsFor(options)));
  }
  project.addSourceFilesAtPaths("packages/foundation/**/src/**/*.{ts,tsx}");

  const effectMapping = yield* buildEffectRootMapping();
  const foundationMappings = yield* buildFoundationRootMappings(project, effectMapping.exports);
  const rootMappings = R.set(foundationMappings, "effect", effectMapping.mappings);

  let rootImportsRewritten = 0;
  let rootExportsRewritten = 0;
  let emittedImports = 0;
  let emittedExports = 0;
  let rootSpecifierCounts = R.empty<string, number>();
  let scannedFiles = 0;
  let scannedFences = 0;
  let changedFiles = A.empty<string>();
  let manualReviews = A.empty<EffectImportManualReview>();
  let parserWarnings = A.empty<string>();

  if (options.mode === "markdown") {
    const fs = yield* FileSystem.FileSystem;
    const fsUtils = yield* FsUtils;
    const discoveredFiles = P.isUndefined(options.includePaths)
      ? yield* fsUtils.globFiles(MARKDOWN_GLOBS, { cwd: process.cwd(), dot: true })
      : options.includePaths;
    const markdownFiles = pipe(
      discoveredFiles,
      A.map((file) => toPosixPath(path.isAbsolute(file) ? path.relative(process.cwd(), file) : file)),
      A.filter((file) => isPathInActiveScope(options, excludePaths, file)),
      A.dedupe
    );
    scannedFiles = A.length(markdownFiles);

    for (const relativePath of markdownFiles) {
      const absolutePath = path.join(process.cwd(), relativePath);
      const original = yield* fs.readFileString(absolutePath);
      const fenceSummary = transformFencedContent(rootMappings, relativePath, original);
      scannedFences += fenceSummary.scannedFences;
      rootImportsRewritten += fenceSummary.rootImportsRewritten;
      rootExportsRewritten += fenceSummary.rootExportsRewritten;
      emittedImports += fenceSummary.emittedImports;
      emittedExports += fenceSummary.emittedExports;
      rootSpecifierCounts = mergeSpecifierCounts(rootSpecifierCounts, fenceSummary.rootSpecifierCounts);
      manualReviews = A.appendAll(manualReviews, fenceSummary.manualReviews);
      parserWarnings = A.appendAll(
        parserWarnings,
        A.map(fenceSummary.parserWarnings, (warning) => `${relativePath}: ${warning}`)
      );
      const affected =
        fenceSummary.content !== original ||
        A.isReadonlyArrayNonEmpty(fenceSummary.manualReviews) ||
        A.isReadonlyArrayNonEmpty(fenceSummary.parserWarnings);
      if (affected) {
        changedFiles = A.append(changedFiles, relativePath);
      }
      if (options.write && fenceSummary.content !== original) {
        yield* fs.writeFileString(absolutePath, fenceSummary.content);
      }
    }
  } else {
    const sourceFiles = pipe(
      project.getSourceFiles(),
      A.map((sourceFile) => ({
        sourceFile,
        relativePath: toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath())),
      })),
      A.filter(({ relativePath }) => isPathInActiveScope(options, excludePaths, relativePath))
    );
    scannedFiles = A.length(sourceFiles);

    for (const { sourceFile, relativePath } of sourceFiles) {
      if (options.mode === "code") {
        const sourceSummary = transformSourceFile(rootMappings, relativePath, sourceFile);
        // fallow-ignore-next-line code-duplication -- executable and fenced-source scans intentionally fold the same public counters into one summary ledger
        rootImportsRewritten += sourceSummary.rootImportsRewritten;
        rootExportsRewritten += sourceSummary.rootExportsRewritten;
        emittedImports += sourceSummary.emittedImports;
        emittedExports += sourceSummary.emittedExports;
        rootSpecifierCounts = mergeSpecifierCounts(rootSpecifierCounts, sourceSummary.rootSpecifierCounts);
        manualReviews = A.appendAll(manualReviews, sourceSummary.manualReviews);

        if (sourceSummary.affected) {
          changedFiles = A.append(changedFiles, relativePath);
        }
        continue;
      }

      let fileAffected = false;
      const jsDocs = A.reverse(sourceFile.getDescendantsOfKind(SyntaxKind.JSDoc));
      for (const jsDoc of jsDocs) {
        const originalInnerText = jsDoc.getInnerText();
        // fallow-ignore-next-line code-duplication -- Markdown-file and JSDoc walkers retain distinct persistence ownership while folding the same fence-summary schema
        const fenceSummary = transformFencedContent(rootMappings, relativePath, originalInnerText);
        scannedFences += fenceSummary.scannedFences;
        rootImportsRewritten += fenceSummary.rootImportsRewritten;
        rootExportsRewritten += fenceSummary.rootExportsRewritten;
        emittedImports += fenceSummary.emittedImports;
        emittedExports += fenceSummary.emittedExports;
        rootSpecifierCounts = mergeSpecifierCounts(rootSpecifierCounts, fenceSummary.rootSpecifierCounts);
        manualReviews = A.appendAll(manualReviews, fenceSummary.manualReviews);
        parserWarnings = A.appendAll(
          parserWarnings,
          A.map(fenceSummary.parserWarnings, (warning) => `${relativePath}: ${warning}`)
        );
        const affected =
          fenceSummary.content !== originalInnerText ||
          A.isReadonlyArrayNonEmpty(fenceSummary.manualReviews) ||
          A.isReadonlyArrayNonEmpty(fenceSummary.parserWarnings);
        fileAffected = fileAffected || affected;
        if (options.write && fenceSummary.content !== originalInnerText) {
          jsDoc.replaceWithText(renderJsDoc(fenceSummary.content));
        }
      }
      if (fileAffected) {
        changedFiles = A.append(changedFiles, relativePath);
      }
    }
  }

  if (options.write && options.mode !== "markdown") {
    yield* Effect.tryPromise({
      try: () => project.save(),
      catch: (cause) =>
        EffectImportRulesPersistenceError.new(
          `Failed to persist per-module import updates: ${Inspectable.toStringUnknown(cause, 0)}`
        ),
    });
  }

  const touchedFiles = A.length(changedFiles);
  const strictFailure =
    options.strictCheck &&
    touchedFiles > 0 &&
    (options.mode === "code" || options.candidate || options.enforceDocumentation);

  return EffectImportRulesSummary.make({
    mappingTableVersion: "root-export-graph/v1",
    mode: options.mode,
    write: options.write,
    candidate: options.candidate,
    scannedFiles,
    scannedFences,
    touchedFiles,
    rootImportsRewritten,
    rootExportsRewritten,
    emittedImports,
    emittedExports,
    rootSpecifierCounts,
    strictFailure,
    changedFiles,
    manualReviews,
    parserWarnings,
  });
});
