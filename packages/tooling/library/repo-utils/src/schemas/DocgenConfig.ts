/**
 * Shared docgen config builders for repo-managed package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, flow, HashMap, HashSet, Order, Path, pipe } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { RepoPackageName } from "./PackageJson.ts";
import {
  buildDocgenAliasTargets,
  RootAliasTarget,
  resolveRootExportTarget,
  resolveSubpathExportTarget,
  resolveWildcardExportTarget,
  WildcardAliasTarget,
} from "./TsconfigAliasTargets.ts";
import type { PackageJson } from "./PackageJson.ts";

const $I = $RepoUtilsId.create("schemas/DocgenConfig");

const EMPTY_STRING_RECORD: R.ReadonlyRecord<string, string> = R.empty();
const byStringAscending: Order.Order<string> = Order.String;
const DocgenWildcardAliasTarget = S.Union([WildcardAliasTarget, S.Literal("")]).pipe(
  $I.annoteSchema("DocgenWildcardAliasTarget", {
    description: "A concrete wildcard alias target, or an empty string when the package exports no wildcard.",
  })
);

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);

const recordOrEmpty = (value: O.Option<Readonly<Record<string, string>>>): Readonly<Record<string, string>> =>
  O.getOrElse(value, () => EMPTY_STRING_RECORD);

const uniqueSortedStringValues: (values: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  HashSet.fromIterable,
  A.fromIterable,
  A.sort(byStringAscending)
);
const withRootRelativePrefix: {
  (rootRelativePrefix: string, targetPath: string): string;
  (rootRelativePrefix: string): (targetPath: string) => string;
} = dual(
  2,
  (rootRelativePrefix: string, targetPath: string): string =>
    `${rootRelativePrefix}${Str.replace(/^\.\//, Str.empty)(targetPath)}`
);

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
 * Workspace alias metadata used to build docgen example path mappings.
 *
 * @example
 * ```ts
 * import { DocgenAliasSource } from "@beep/repo-utils/schemas/DocgenConfig"
 * const source = DocgenAliasSource.make({
 *   packageName: "@beep/example",
 *   rootAliasTarget: "./packages/example/src/index.ts",
 *   wildcardAliasTarget: "./packages/example/src/*.ts",
 *   subpathAliasTargets: { "@beep/example/testing": "./packages/example/src/testing.ts" }
 * })
 * console.log(source.rootAliasTarget) // "./packages/example/src/index.ts"
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenAliasSource extends S.Class<DocgenAliasSource>($I`DocgenAliasSource`)(
  {
    packageName: RepoPackageName.annotateKey({
      description: "Workspace package name that owns these docgen aliases.",
    }),
    rootAliasTarget: RootAliasTarget.annotateKey({
      description: "Root alias target used for bare package imports.",
    }),
    wildcardAliasTarget: DocgenWildcardAliasTarget.annotateKey({
      description: "Wildcard alias target used for package subpath imports, or empty when disabled.",
    }),
    subpathAliasTargets: S.Record(S.String, RootAliasTarget)
      .pipe(SchemaUtils.withKeyDefaults(EMPTY_STRING_RECORD))
      .annotateKey({
        description: "Concrete package subpath aliases derived from package export entries.",
      }),
  },
  $I.annote("DocgenAliasSource", {
    description: "Workspace alias metadata used to build docgen example path mappings.",
  })
) {}

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
 *   packageName: "@beep/example",
 *   directWorkspaceDependencies: ["@beep/schema"],
 *   workspaceAliasSources: []
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
    directWorkspaceDependencies: S.Array(RepoPackageName).annotateKey({
      description: "Direct workspace package dependencies used for example path aliases.",
    }),
    workspaceAliasSources: S.Array(DocgenAliasSource).annotateKey({
      description: "Alias metadata for workspace packages visible to examples.",
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
 *   jsx: "react-jsx",
 *   paths: { "@beep/example": ["./packages/example/src/index.ts"] }
 * })
 * console.log(options.paths["@beep/example"]) // ["./packages/example/src/index.ts"]
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
    paths: S.Record(S.String, S.Array(S.String)),
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
 *     jsx: "react-jsx",
 *     paths: {}
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
 *     jsx: "react-jsx",
 *     paths: { "@beep/example": ["./packages/example/src/index.ts"] }
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
  paths: pipe(
    options.paths,
    R.map((targets) => cloneStringArray(targets))
  ),
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
 *       jsx: "react-jsx",
 *       paths: {}
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
 * Collect direct workspace package dependencies from a package manifest.
 *
 * @param packageJson - Package manifest whose dependency sections are scanned.
 * @returns The deduplicated, sorted list of workspace (`@beep/*`) dependency names.
 * @remarks
 * The returned names are deduplicated and sorted across dependency,
 * development, peer, and optional dependency sections. Non-workspace packages
 * are intentionally ignored because docgen only needs path aliases for local
 * examples.
 * @example
 * ```ts
 * import { collectDocgenWorkspaceDependencyNames } from "@beep/repo-utils/schemas/DocgenConfig"
 * import { decodePackageJson } from "@beep/repo-utils/schemas/PackageJson"
 * const names = collectDocgenWorkspaceDependencyNames(
 *   decodePackageJson({
 *     name: "@beep/example",
 *     dependencies: { "@beep/schema": "workspace:^", "effect": "catalog:" },
 *     devDependencies: { "@beep/utils": "workspace:^", "@beep/schema": "workspace:^" }
 *   })
 * )
 * console.log(names) // ["@beep/schema", "@beep/utils"]
 * ```
 * @category models
 * @since 0.0.0
 */
export const collectDocgenWorkspaceDependencyNames = (packageJson: PackageJson.Type): ReadonlyArray<string> =>
  pipe(
    [
      ...pipe(packageJson.dependencies, recordOrEmpty, R.keys),
      ...pipe(packageJson.devDependencies, recordOrEmpty, R.keys),
      ...pipe(packageJson.peerDependencies, recordOrEmpty, R.keys),
      ...pipe(packageJson.optionalDependencies, recordOrEmpty, R.keys),
    ],
    A.filter((name) => Str.startsWith("@beep/")(name)),
    uniqueSortedStringValues
  );

/**
 * Build docgen alias targets for one workspace package from its exports.
 *
 * @remarks
 * Missing root exports fall back to `./src/index.ts`; wildcard aliases are
 * emitted only when a wildcard export exists so docgen does not invent subpath
 * import support for packages that intentionally omit it.
 * @example
 * ```ts
 * import { buildDocgenAliasSource } from "@beep/repo-utils/schemas/DocgenConfig"
 * import { decodePackageJson } from "@beep/repo-utils/schemas/PackageJson"
 * const source = buildDocgenAliasSource(
 *   "@beep/example",
 *   "packages/example",
 *   decodePackageJson({
 *     name: "@beep/example",
 *     exports: {
 *       ".": "./src/index.ts",
 *       "./testing": "./src/testing.ts",
 *       "./*": "./src/*.ts"
 *     }
 *   })
 * )
 * console.log(source.subpathAliasTargets["@beep/example/testing"])
 * // "./packages/example/src/testing.ts"
 * ```
 * @category models
 * @since 0.0.0
 */
export const buildDocgenAliasSource: {
  (packageName: string, packageRelativePath: string, packageJson: PackageJson.Type): DocgenAliasSource;
  (packageRelativePath: string, packageJson: PackageJson.Type): (packageName: string) => DocgenAliasSource;
} = dual(3, (packageName: string, packageRelativePath: string, packageJson: PackageJson.Type): DocgenAliasSource => {
  const exportsField = O.getOrUndefined(packageJson.exports);
  const rootExportTarget = pipe(
    exportsField,
    resolveRootExportTarget,
    O.getOrElse(() => "./src/index.ts")
  );
  const wildcardExportTarget = pipe(exportsField, resolveWildcardExportTarget, O.getOrUndefined);
  const hasWildcardExport = pipe(exportsField, resolveWildcardExportTarget, O.isSome);
  const aliasTargets = buildDocgenAliasTargets(packageRelativePath, {
    rootExportTarget,
    wildcardExportTarget,
  });
  const subpathAliasTargets = buildDocgenSubpathAliasTargets(packageName, packageRelativePath, exportsField);

  return DocgenAliasSource.make({
    packageName,
    rootAliasTarget: aliasTargets.rootAliasTarget,
    wildcardAliasTarget: hasWildcardExport ? aliasTargets.wildcardAliasTarget : "",
    subpathAliasTargets,
  });
});

const isConcretePackageSubpathExport = (exportKey: string): boolean =>
  Str.startsWith("./")(exportKey) && exportKey !== "./package.json" && !Str.includes("*")(exportKey);

const packageSubpathAlias = (packageName: string, exportKey: string): string =>
  `${packageName}/${Str.replace(/^\.\//, Str.empty)(exportKey)}`;

const sourceAliasTarget = (packageRelativePath: string, exportTarget: string): string =>
  `./${packageRelativePath}/${Str.replace(/^\.\//, Str.empty)(exportTarget)}`;

const buildDocgenSubpathAliasTargets = (
  packageName: string,
  packageRelativePath: string,
  exportsField: unknown
): Readonly<Record<string, string>> => {
  if (!isReadonlyUnknownRecord(exportsField)) {
    return EMPTY_STRING_RECORD;
  }

  return pipe(
    exportsField,
    R.keys,
    A.filter(isConcretePackageSubpathExport),
    A.flatMap((exportKey) =>
      pipe(
        resolveSubpathExportTarget(exportsField, exportKey),
        O.map((exportTarget) => [
          [packageSubpathAlias(packageName, exportKey), sourceAliasTarget(packageRelativePath, exportTarget)] as const,
        ]),
        O.getOrElse(() => [])
      )
    ),
    R.fromEntries
  );
};

const buildDocgenAliasIndex = (sources: ReadonlyArray<DocgenAliasSource>): HashMap.HashMap<string, DocgenAliasSource> =>
  HashMap.fromIterable(A.map(sources, (source) => [source.packageName, source] as const));

const docgenAliasPathEntries = (
  rootRelativePrefix: string,
  aliasSource: DocgenAliasSource
): ReadonlyArray<readonly [string, ReadonlyArray<string>]> => {
  const wildcardEntries = Str.isNonEmpty(aliasSource.wildcardAliasTarget)
    ? ([
        [`${aliasSource.packageName}/*`, [withRootRelativePrefix(rootRelativePrefix, aliasSource.wildcardAliasTarget)]],
      ] as const)
    : A.empty<readonly [string, ReadonlyArray<string>]>();

  return [
    [aliasSource.packageName, [withRootRelativePrefix(rootRelativePrefix, aliasSource.rootAliasTarget)]],
    ...wildcardEntries,
    ...pipe(
      aliasSource.subpathAliasTargets,
      R.toEntries,
      A.map(([alias, target]) => [alias, [withRootRelativePrefix(rootRelativePrefix, target)]] as const)
    ),
  ];
};

const buildDocgenExamplesPaths = (
  packageName: string,
  directWorkspaceDependencies: ReadonlyArray<string>,
  workspaceAliasIndex: HashMap.HashMap<string, DocgenAliasSource>,
  rootRelativePrefix: string
): Readonly<Record<string, ReadonlyArray<string>>> => {
  const packageSequence = [
    packageName,
    ...A.filter(uniqueSortedStringValues(directWorkspaceDependencies), P.not(Eq.equals(packageName))),
  ];

  return pipe(
    packageSequence,
    A.flatMap((dependencyName) => pipe(HashMap.get(workspaceAliasIndex, dependencyName), O.toArray)),
    A.flatMap((aliasSource) => docgenAliasPathEntries(rootRelativePrefix, aliasSource)),
    R.fromEntries
  );
};

/**
 * Build the canonical repo docgen config for a package.
 *
 * @remarks
 * The output is rooted from the package directory back to the repo root, so the
 * same builder works for shallow packages such as `packages/schema` and nested
 * packages such as `packages/tooling/library/repo-utils`.
 * @effects
 * Requires the `Path.Path` service to compute root-relative schema and alias
 * targets; it does not read or write files.
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
 *   packageName: "@beep/example",
 *   directWorkspaceDependencies: [],
 *   workspaceAliasSources: []
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
  const workspaceAliasIndex = buildDocgenAliasIndex(input.workspaceAliasSources);
  const examplesPaths = buildDocgenExamplesPaths(
    input.packageName,
    input.directWorkspaceDependencies,
    workspaceAliasIndex,
    rootRelativePrefix
  );

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
      paths: examplesPaths,
    }),
  });
});

/**
 * Merge managed docgen fields into an existing parsed `docgen.json` document.
 *
 * Existing package-local extras are preserved. The default `exclude` field is only
 * backfilled when it is absent so package-specific exclusions survive sync.
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
 *     jsx: "react-jsx",
 *     paths: {}
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
    const mergedExamplesCompilerOptions = pipe(
      existingExamplesCompilerOptions,
      O.map((options) => ({
        ...options,
        ...canonicalJson.examplesCompilerOptions,
        ...pipe(
          options,
          R.get("types"),
          O.filter(A.isArray),
          O.map((types) => ({ types })),
          O.getOrElse(() => ({}))
        ),
      })),
      O.getOrElse(() => canonicalJson.examplesCompilerOptions)
    );
    const merged = {
      ...existing,
      $schema: canonicalJson.$schema,
      srcLink: canonicalJson.srcLink,
      examplesCompilerOptions: mergedExamplesCompilerOptions,
    };

    return R.has(existing, "exclude") ? merged : { ...merged, exclude: [...canonicalJson.exclude] };
  }
);
