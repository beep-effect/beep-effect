/**
 * Shared docgen config builders for repo-managed package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Effect, flow, Path, pipe } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { RepoPackageName } from "./PackageJson.ts";

const $I = $RepoUtilsId.create("schemas/DocgenConfig");

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);

/**
 * Default docgen exclude globs for repo packages.
 *
 * @remarks
 * These are source-relative globs applied before examples are compiled. Keep
 * generated and internal-package policy in the caller's config; this list is
 * only the repo-managed default backfill.
 * @example
 * ```ts
 * import { DEFAULT_DOCGEN_EXCLUDE } from "@beep/repo-utils/schemas/DocgenConfig"
 * const internalGlob = "src/internal/**" + "/*.ts"
 * const excludesInternalSources = DEFAULT_DOCGEN_EXCLUDE.some((glob) => glob === internalGlob)
 * console.log(excludesInternalSources) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const DEFAULT_DOCGEN_EXCLUDE = ["src/internal/**/*.ts"] as const;

/**
 * Input used to build the canonical repo docgen config for a package.
 *
 * @example
 * ```ts
 * import { CanonicalDocgenConfigInput } from "@beep/repo-utils/schemas/DocgenConfig"
 * const input = CanonicalDocgenConfigInput.make({
 *   rootDir: "/repo",
 *   packageAbsolutePath: "/repo/packages/example",
 *   packageRelativePath: "packages/example",
 *   packageName: "@beep/example"
 * })
 * console.log(input.packageRelativePath) // "packages/example"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CanonicalDocgenConfigInput extends S.Class<CanonicalDocgenConfigInput>($I`CanonicalDocgenConfigInput`)(
  {
    rootDir: S.NonEmptyString.annotateKey({
      description: "Absolute repository root directory.",
    }),
    packageAbsolutePath: S.NonEmptyString.annotateKey({
      description: "Absolute package directory path.",
    }),
    packageRelativePath: S.NonEmptyString.annotateKey({
      description: "Repository-relative package directory path.",
    }),
    packageName: RepoPackageName.annotateKey({
      description: "Workspace package name being configured for docgen.",
    }),
  },
  $I.annote("CanonicalDocgenConfigInput", {
    description: "Input used to build the canonical repo docgen config for a package.",
  })
) {}

/**
 * Managed TypeScript compiler options used for docgen examples.
 *
 * @remarks
 * This shape intentionally mirrors the strict options docgen writes into each
 * package's `docgen.json`; examples should fail fast on unused locals,
 * unresolved aliases, and non-erasable TypeScript syntax.
 * @example
 * ```ts
 * import { CanonicalDocgenExamplesCompilerOptions } from "@beep/repo-utils/schemas/DocgenConfig"
 * const options = CanonicalDocgenExamplesCompilerOptions.make({
 *   noEmit: true,
 *   strict: true,
 *   skipLibCheck: true,
 *   moduleResolution: "bundler",
 *   module: "es2022",
 *   target: "es2022",
 *   lib: ["ESNext", "DOM"],
 *   rewriteRelativeImportExtensions: true,
 *   allowImportingTsExtensions: true,
 *   moduleDetection: "force",
 *   verbatimModuleSyntax: true,
 *   allowJs: false,
 *   erasableSyntaxOnly: true,
 *   declaration: true,
 *   declarationMap: true,
 *   sourceMap: true,
 *   exactOptionalPropertyTypes: true,
 *   noUnusedLocals: true,
 *   noUnusedParameters: true,
 *   noImplicitOverride: true,
 *   noFallthroughCasesInSwitch: true,
 *   stripInternal: false,
 *   noErrorTruncation: true,
 *   types: [],
 *   jsx: "react-jsx"
 * })
 * console.log(options.moduleResolution) // "bundler"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CanonicalDocgenExamplesCompilerOptions extends S.Class<CanonicalDocgenExamplesCompilerOptions>(
  $I`CanonicalDocgenExamplesCompilerOptions`
)(
  {
    noEmit: S.Literal(true),
    strict: S.Literal(true),
    skipLibCheck: S.Literal(true),
    moduleResolution: S.Literal("bundler"),
    module: S.Literal("es2022"),
    target: S.Literal("es2022"),
    lib: S.Array(S.String),
    rewriteRelativeImportExtensions: S.Literal(true),
    allowImportingTsExtensions: S.Literal(true),
    moduleDetection: S.Literal("force"),
    verbatimModuleSyntax: S.Literal(true),
    allowJs: S.Literal(false),
    erasableSyntaxOnly: S.Literal(true),
    declaration: S.Literal(true),
    declarationMap: S.Literal(true),
    sourceMap: S.Literal(true),
    exactOptionalPropertyTypes: S.Literal(true),
    noUnusedLocals: S.Literal(true),
    noUnusedParameters: S.Literal(true),
    noImplicitOverride: S.Literal(true),
    noFallthroughCasesInSwitch: S.Literal(true),
    stripInternal: S.Literal(false),
    noErrorTruncation: S.Literal(true),
    types: S.Array(S.String),
    jsx: S.Literal("react-jsx"),
  },
  $I.annote("CanonicalDocgenExamplesCompilerOptions", {
    description: "Managed TypeScript compiler options used for docgen examples.",
  })
) {}

/**
 * Canonical repo docgen config payload.
 *
 * @example
 * ```ts
 * import {
 *   CanonicalDocgenConfig,
 *   CanonicalDocgenExamplesCompilerOptions
 * } from "@beep/repo-utils/schemas/DocgenConfig"
 * const internalGlob = "src/internal/**" + "/*.ts"
 * const config = CanonicalDocgenConfig.make({
 *   $schema: "../../packages/tooling/tool/docgen/schema.json",
 *   exclude: [internalGlob],
 *   srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
 *   examplesCompilerOptions: CanonicalDocgenExamplesCompilerOptions.make({
 *     noEmit: true,
 *     strict: true,
 *     skipLibCheck: true,
 *     moduleResolution: "bundler",
 *     module: "es2022",
 *     target: "es2022",
 *     lib: ["ESNext", "DOM"],
 *     rewriteRelativeImportExtensions: true,
 *     allowImportingTsExtensions: true,
 *     moduleDetection: "force",
 *     verbatimModuleSyntax: true,
 *     allowJs: false,
 *     erasableSyntaxOnly: true,
 *     declaration: true,
 *     declarationMap: true,
 *     sourceMap: true,
 *     exactOptionalPropertyTypes: true,
 *     noUnusedLocals: true,
 *     noUnusedParameters: true,
 *     noImplicitOverride: true,
 *     noFallthroughCasesInSwitch: true,
 *     stripInternal: false,
 *     noErrorTruncation: true,
 *     types: [],
 *     jsx: "react-jsx"
 *   })
 * })
 * console.log(config.exclude[0] === internalGlob) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CanonicalDocgenConfig extends S.Class<CanonicalDocgenConfig>($I`CanonicalDocgenConfig`)(
  {
    $schema: S.String,
    exclude: S.Array(S.String),
    srcLink: S.String,
    examplesCompilerOptions: CanonicalDocgenExamplesCompilerOptions,
  },
  $I.annote("CanonicalDocgenConfig", {
    description: "Canonical repo docgen config payload.",
  })
) {}

const cloneStringArray = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.fromIterable(values);

const isReadonlyUnknownRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value);

/**
 * Convert canonical docgen compiler options to a plain JSON-compatible object.
 *
 * @param options - Canonical docgen examples compiler options model to serialize.
 * @returns A JSON-compatible record mirroring the compiler option fields.
 * @example
 * ```ts
 * import {
 *   CanonicalDocgenExamplesCompilerOptions,
 *   toDocgenExamplesCompilerOptionsJson
 * } from "@beep/repo-utils/schemas/DocgenConfig"
 * const json = toDocgenExamplesCompilerOptionsJson(
 *   CanonicalDocgenExamplesCompilerOptions.make({
 *     noEmit: true,
 *     strict: true,
 *     skipLibCheck: true,
 *     moduleResolution: "bundler",
 *     module: "es2022",
 *     target: "es2022",
 *     lib: ["ESNext"],
 *     rewriteRelativeImportExtensions: true,
 *     allowImportingTsExtensions: true,
 *     moduleDetection: "force",
 *     verbatimModuleSyntax: true,
 *     allowJs: false,
 *     erasableSyntaxOnly: true,
 *     declaration: true,
 *     declarationMap: true,
 *     sourceMap: true,
 *     exactOptionalPropertyTypes: true,
 *     noUnusedLocals: true,
 *     noUnusedParameters: true,
 *     noImplicitOverride: true,
 *     noFallthroughCasesInSwitch: true,
 *     stripInternal: false,
 *     noErrorTruncation: true,
 *     types: [],
 *     jsx: "react-jsx"
 *   })
 * )
 * console.log(json.moduleResolution) // "bundler"
 * ```
 * @category models
 * @since 0.0.0
 */
export const toDocgenExamplesCompilerOptionsJson = (
  options: CanonicalDocgenExamplesCompilerOptions
): Readonly<Record<string, unknown>> => ({
  noEmit: options.noEmit,
  strict: options.strict,
  skipLibCheck: options.skipLibCheck,
  moduleResolution: options.moduleResolution,
  module: options.module,
  target: options.target,
  lib: cloneStringArray(options.lib),
  rewriteRelativeImportExtensions: options.rewriteRelativeImportExtensions,
  allowImportingTsExtensions: options.allowImportingTsExtensions,
  moduleDetection: options.moduleDetection,
  verbatimModuleSyntax: options.verbatimModuleSyntax,
  allowJs: options.allowJs,
  erasableSyntaxOnly: options.erasableSyntaxOnly,
  declaration: options.declaration,
  declarationMap: options.declarationMap,
  sourceMap: options.sourceMap,
  exactOptionalPropertyTypes: options.exactOptionalPropertyTypes,
  noUnusedLocals: options.noUnusedLocals,
  noUnusedParameters: options.noUnusedParameters,
  noImplicitOverride: options.noImplicitOverride,
  noFallthroughCasesInSwitch: options.noFallthroughCasesInSwitch,
  stripInternal: options.stripInternal,
  noErrorTruncation: options.noErrorTruncation,
  types: cloneStringArray(options.types),
  jsx: options.jsx,
});

/**
 * JSON-compatible mirror of {@link CanonicalDocgenConfig}, returned by
 * {@link toCanonicalDocgenConfigJson}.
 *
 * @example
 * ```ts
 * import { CanonicalDocgenConfigJsonShape } from "@beep/repo-utils/schemas/DocgenConfig"
 * const json = CanonicalDocgenConfigJsonShape.make({
 *   $schema: "../../packages/tooling/tool/docgen/schema.json",
 *   exclude: [],
 *   srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
 *   examplesCompilerOptions: {}
 * })
 * console.log(json.srcLink.endsWith("/src/")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CanonicalDocgenConfigJsonShape extends S.Class<CanonicalDocgenConfigJsonShape>(
  $I`CanonicalDocgenConfigJsonShape`
)(
  {
    $schema: S.String,
    exclude: S.Array(S.String),
    srcLink: S.String,
    examplesCompilerOptions: S.Record(S.String, S.Unknown),
  },
  $I.annote("CanonicalDocgenConfigJsonShape", {
    description: "JSON-compatible mirror of CanonicalDocgenConfig, returned by toCanonicalDocgenConfigJson.",
  })
) {}

/**
 * Runtime type for {@link CanonicalDocgenConfigJsonShape}.
 *
 * @example
 * ```ts
 * import type { CanonicalDocgenConfigJson } from "@beep/repo-utils/schemas/DocgenConfig"
 * const acceptJson = (_value: CanonicalDocgenConfigJson) => undefined
 * console.log(acceptJson)
 * ```
 * @category models
 * @since 0.0.0
 */
export type CanonicalDocgenConfigJson = (typeof CanonicalDocgenConfigJsonShape)["Type"];

/**
 * Convert the canonical docgen config model to a plain JSON-compatible object.
 *
 * @param config - Canonical docgen config model to serialize.
 * @returns A JSON-compatible object mirroring the docgen config fields.
 * @example
 * ```ts
 * import {
 *   CanonicalDocgenConfig,
 *   CanonicalDocgenExamplesCompilerOptions,
 *   toCanonicalDocgenConfigJson
 * } from "@beep/repo-utils/schemas/DocgenConfig"
 * const json = toCanonicalDocgenConfigJson(
 *   CanonicalDocgenConfig.make({
 *     $schema: "../../packages/tooling/tool/docgen/schema.json",
 *     exclude: ["src/internal/**" + "/*.ts"],
 *     srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
 *     examplesCompilerOptions: CanonicalDocgenExamplesCompilerOptions.make({
 *       noEmit: true,
 *       strict: true,
 *       skipLibCheck: true,
 *       moduleResolution: "bundler",
 *       module: "es2022",
 *       target: "es2022",
 *       lib: ["ESNext"],
 *       rewriteRelativeImportExtensions: true,
 *       allowImportingTsExtensions: true,
 *       moduleDetection: "force",
 *       verbatimModuleSyntax: true,
 *       allowJs: false,
 *       erasableSyntaxOnly: true,
 *       declaration: true,
 *       declarationMap: true,
 *       sourceMap: true,
 *       exactOptionalPropertyTypes: true,
 *       noUnusedLocals: true,
 *       noUnusedParameters: true,
 *       noImplicitOverride: true,
 *       noFallthroughCasesInSwitch: true,
 *       stripInternal: false,
 *       noErrorTruncation: true,
 *       types: [],
 *       jsx: "react-jsx"
 *     })
 *   })
 * )
 * console.log(json.srcLink.endsWith("/src/")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const toCanonicalDocgenConfigJson = (config: CanonicalDocgenConfig): CanonicalDocgenConfigJson => ({
  $schema: config.$schema,
  exclude: cloneStringArray(config.exclude),
  srcLink: config.srcLink,
  examplesCompilerOptions: toDocgenExamplesCompilerOptionsJson(config.examplesCompilerOptions),
});

/**
 * Build the canonical repo docgen config for a package.
 *
 * @remarks
 * The output is rooted from the package directory back to the repo root, so the
 * same builder works for shallow packages such as `packages/schema` and nested
 * packages such as `packages/tooling/library/repo-utils`.
 * @effects
 * Requires the `Path.Path` service to compute the root-relative schema
 * reference; it does not read or write files.
 * @example
 * ```ts
 * import { Effect, Path } from "effect"
 * import {
 *   CanonicalDocgenConfigInput,
 *   createCanonicalDocgenConfig
 * } from "@beep/repo-utils/schemas/DocgenConfig"
 * const input = CanonicalDocgenConfigInput.make({
 *   rootDir: "/repo",
 *   packageAbsolutePath: "/repo/packages/example",
 *   packageRelativePath: "packages/example",
 *   packageName: "@beep/example"
 * })
 * const srcLink = Effect.runSync(
 *   createCanonicalDocgenConfig(input).pipe(
 *     Effect.provide(Path.layer),
 *     Effect.map((config) => config.srcLink)
 *   )
 * )
 * console.log(srcLink.endsWith("/packages/example/src/")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const createCanonicalDocgenConfig = Effect.fn("createCanonicalDocgenConfig")(function* (
  input: CanonicalDocgenConfigInput
): Effect.fn.Return<CanonicalDocgenConfig, never, Path.Path> {
  const path = yield* Path.Path;
  const rootRelative = normalizeSlashes(path.relative(input.packageAbsolutePath, input.rootDir));
  const rootRelativePrefix = rootRelative.length === 0 ? "./" : `${rootRelative}/`;

  return CanonicalDocgenConfig.make({
    $schema: `${rootRelativePrefix}packages/tooling/tool/docgen/schema.json`,
    exclude: [...DEFAULT_DOCGEN_EXCLUDE],
    srcLink: `https://github.com/beep-effect/beep-effect/tree/main/${input.packageRelativePath}/src/`,
    examplesCompilerOptions: CanonicalDocgenExamplesCompilerOptions.make({
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      moduleResolution: "bundler",
      module: "es2022",
      target: "es2022",
      lib: ["ESNext", "DOM", "DOM.Iterable"],
      rewriteRelativeImportExtensions: true,
      allowImportingTsExtensions: true,
      moduleDetection: "force",
      verbatimModuleSyntax: true,
      allowJs: false,
      erasableSyntaxOnly: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      exactOptionalPropertyTypes: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      stripInternal: false,
      noErrorTruncation: true,
      types: [],
      jsx: "react-jsx",
    }),
  });
});

/**
 * Merge managed docgen fields into an existing parsed `docgen.json` document.
 *
 * Existing package-local extras are preserved. The default `exclude` field is only
 * backfilled when it is absent so package-specific exclusions survive sync.
 * Managed `@beep/*` entries in `examplesCompilerOptions.paths` are pruned:
 * docgen examples resolve `@beep/*` imports through workspace `node_modules`
 * symlinks and package export maps, so those mappings are dead configuration.
 * Package-local custom aliases (for example an app's `@/*`) survive.
 *
 * @example
 * ```ts
 * import {
 *   CanonicalDocgenConfig,
 *   CanonicalDocgenExamplesCompilerOptions,
 *   mergeManagedDocgenConfig
 * } from "@beep/repo-utils/schemas/DocgenConfig"
 * const canonical = CanonicalDocgenConfig.make({
 *   $schema: "../../packages/tooling/tool/docgen/schema.json",
 *   exclude: ["src/internal/**" + "/*.ts"],
 *   srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
 *   examplesCompilerOptions: CanonicalDocgenExamplesCompilerOptions.make({
 *     noEmit: true,
 *     strict: true,
 *     skipLibCheck: true,
 *     moduleResolution: "bundler",
 *     module: "es2022",
 *     target: "es2022",
 *     lib: ["ESNext"],
 *     rewriteRelativeImportExtensions: true,
 *     allowImportingTsExtensions: true,
 *     moduleDetection: "force",
 *     verbatimModuleSyntax: true,
 *     allowJs: false,
 *     erasableSyntaxOnly: true,
 *     declaration: true,
 *     declarationMap: true,
 *     sourceMap: true,
 *     exactOptionalPropertyTypes: true,
 *     noUnusedLocals: true,
 *     noUnusedParameters: true,
 *     noImplicitOverride: true,
 *     noFallthroughCasesInSwitch: true,
 *     stripInternal: false,
 *     noErrorTruncation: true,
 *     types: [],
 *     jsx: "react-jsx"
 *   })
 * })
 * const generatedGlob = "src/generated/**" + "/*.ts"
 * const merged = mergeManagedDocgenConfig({ exclude: [generatedGlob] }, canonical)
 * const exclude = merged.exclude
 * console.log(Array.isArray(exclude) && exclude[0] === generatedGlob) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const mergeManagedDocgenConfig: {
  (existing: Readonly<Record<string, unknown>>, canonical: CanonicalDocgenConfig): Record<string, unknown>;
  (canonical: CanonicalDocgenConfig): (existing: Readonly<Record<string, unknown>>) => Record<string, unknown>;
} = dual(
  2,
  (existing: Readonly<Record<string, unknown>>, canonical: CanonicalDocgenConfig): Record<string, unknown> => {
    const canonicalJson = toCanonicalDocgenConfigJson(canonical);
    const existingExamplesCompilerOptions = pipe(
      existing,
      R.get("examplesCompilerOptions"),
      O.filter(isReadonlyUnknownRecord)
    );
    const existingCustomSrcLink = pipe(
      existing,
      R.get("srcDir"),
      O.filter(P.isString),
      O.filter(P.not(Eq.equals("src"))),
      O.flatMap(() => pipe(existing, R.get("srcLink"), O.filter(P.isString)))
    );
    const customExamplesPaths = pipe(
      existingExamplesCompilerOptions,
      O.flatMap(flow(R.get("paths"), O.filter(isReadonlyUnknownRecord))),
      O.map((paths) => R.filter(paths, (_target, aliasKey) => !Str.startsWith("@beep/")(aliasKey))),
      O.filter(P.not(R.isEmptyReadonlyRecord))
    );
    const mergedExamplesCompilerOptions = pipe(
      existingExamplesCompilerOptions,
      O.map((options) => {
        const combined: Record<string, unknown> = {
          ...options,
          ...canonicalJson.examplesCompilerOptions,
          ...pipe(
            options,
            R.get("module"),
            O.filter(P.isString),
            O.map((module) => ({ module })),
            O.getOrElse(() => ({}))
          ),
          ...pipe(
            options,
            R.get("types"),
            O.filter(A.isArray),
            O.map((types) => ({ types })),
            O.getOrElse(() => ({}))
          ),
        };
        const pruned = R.remove(combined, "paths");

        return O.match(customExamplesPaths, {
          onNone: () => pruned,
          onSome: (paths) => ({ ...pruned, paths }),
        });
      }),
      O.getOrElse(() => canonicalJson.examplesCompilerOptions)
    );
    const merged = {
      ...existing,
      $schema: canonicalJson.$schema,
      srcLink: O.getOrElse(existingCustomSrcLink, () => canonicalJson.srcLink),
      examplesCompilerOptions: mergedExamplesCompilerOptions,
    };

    return R.has(existing, "exclude") ? merged : { ...merged, exclude: [...canonicalJson.exclude] };
  }
);
