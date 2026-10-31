/**
 * compilerOptions as string-level schemas — the foundational module the rest of
 * the package builds on, modelled on TS 6.0.3 × schemastore. Alias
 * normalization (es6→es2015, node→node10) is deliberately NOT applied here —
 * only lowercasing. Aliases collapse only in the numeric-enum codec
 * (TsEnumCodec). watchOptions/typeAcquisition/references live in
 * TsconfigJson.ts — this module owns compilerOptions only.
 *
 * **Details**
 *
 * Two spellings this module depends on, pinned by test/CompilerOptions.test.ts:
 *
 * (a) struct + passthrough — `Schema.StructWithRest` over a `Schema.Struct` of
 * typed fields plus a `Schema.Record(Schema.String, Schema.Unknown)` rest
 * round-trips a typed field alongside an unknown passthrough key through both
 * `Schema.decodeUnknownEffect` and `Schema.encodeUnknownEffect` ("passes
 * unknown option keys through and preserves them across encode").
 *
 * (b) case-insensitive literal union (`internal/caseInsensitiveLiterals.ts`) —
 * `Schema.String` piped through `Schema.decodeTo(Schema.Literals(literals))`
 * with a lowercasing decode and an identity encode decodes a non-first literal
 * ("es2015", third of three) from "ES2015" and rejects an unrecognized one
 * ("decodes enum values case-insensitively" / "rejects an unknown enum value").
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TsconfigId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { caseInsensitiveLiterals } from "./internal/caseInsensitiveLiterals.ts";

const $I = $TsconfigId.create("CompilerOptions");

const TargetKit = LiteralKit([
  "es5",
  "es6",
  "es2015",
  "es2016",
  "es2017",
  "es2018",
  "es2019",
  "es2020",
  "es2021",
  "es2022",
  "es2023",
  "es2024",
  "es2025",
  "esnext",
]).pipe(
  $I.annoteSchema("TargetLiterals", { description: "The ECMAScript language target, including supported aliases." })
);

const ModuleKit = LiteralKit([
  "none",
  "commonjs",
  "amd",
  "umd",
  "system",
  "es6",
  "es2015",
  "es2020",
  "es2022",
  "esnext",
  "node16",
  "node18",
  "node20",
  "nodenext",
  "preserve",
]).pipe($I.annoteSchema("ModuleLiterals", { description: "The emitted JavaScript module format." }));

const ModuleResolutionKit = LiteralKit(["node10", "node", "classic", "node16", "nodenext", "bundler"]).pipe(
  $I.annoteSchema("ModuleResolutionLiterals", { description: "The strategy used to resolve module imports." })
);

const JsxKit = LiteralKit(["preserve", "react-native", "react-jsx", "react-jsxdev", "react"]).pipe(
  $I.annoteSchema("JsxLiterals", { description: "The JSX emit mode." })
);

const NewLineKit = LiteralKit(["crlf", "lf"]).pipe(
  $I.annoteSchema("NewLineLiterals", { description: "The newline sequence used in emitted files." })
);

const ModuleDetectionKit = LiteralKit(["auto", "legacy", "force"]).pipe(
  $I.annoteSchema("ModuleDetectionLiterals", { description: "The strategy for identifying module source files." })
);

const LibKit = LiteralKit([
  "es5",
  "es6",
  "es7",
  "es2015",
  "es2016",
  "es2017",
  "es2018",
  "es2019",
  "es2020",
  "es2021",
  "es2022",
  "es2023",
  "es2024",
  "es2025",
  "esnext",
  "dom",
  "dom.iterable",
  "dom.asynciterable",
  "webworker",
  "webworker.importscripts",
  "webworker.iterable",
  "webworker.asynciterable",
  "scripthost",
  "es2015.core",
  "es2015.collection",
  "es2015.generator",
  "es2015.iterable",
  "es2015.promise",
  "es2015.proxy",
  "es2015.reflect",
  "es2015.symbol",
  "es2015.symbol.wellknown",
  "es2016.array.include",
  "es2016.intl",
  "es2017.arraybuffer",
  "es2017.date",
  "es2017.object",
  "es2017.sharedmemory",
  "es2017.string",
  "es2017.intl",
  "es2017.typedarrays",
  "es2018.asyncgenerator",
  "es2018.asynciterable",
  "es2018.intl",
  "es2018.promise",
  "es2018.regexp",
  "es2019.array",
  "es2019.object",
  "es2019.string",
  "es2019.symbol",
  "es2019.intl",
  "es2020.bigint",
  "es2020.date",
  "es2020.promise",
  "es2020.sharedmemory",
  "es2020.string",
  "es2020.symbol.wellknown",
  "es2020.intl",
  "es2020.number",
  "es2021.promise",
  "es2021.string",
  "es2021.weakref",
  "es2021.intl",
  "es2022.array",
  "es2022.error",
  "es2022.intl",
  "es2022.object",
  "es2022.string",
  "es2022.regexp",
  "es2023.array",
  "es2023.collection",
  "es2023.intl",
  "es2024.arraybuffer",
  "es2024.collection",
  "es2024.object",
  "es2024.promise",
  "es2024.regexp",
  "es2024.sharedmemory",
  "es2024.string",
  "es2025.collection",
  "es2025.float16",
  "es2025.intl",
  "es2025.iterator",
  "es2025.promise",
  "es2025.regexp",
  "esnext.asynciterable",
  "esnext.symbol",
  "esnext.bigint",
  "esnext.weakref",
  "esnext.object",
  "esnext.regexp",
  "esnext.string",
  "esnext.float16",
  "esnext.iterator",
  "esnext.promise",
  "esnext.array",
  "esnext.collection",
  "esnext.date",
  "esnext.decorators",
  "esnext.disposable",
  "esnext.error",
  "esnext.intl",
  "esnext.sharedmemory",
  "esnext.temporal",
  "esnext.typedarrays",
  "decorators",
  "decorators.legacy",
]).pipe($I.annoteSchema("LibLiterals", { description: "A supported TypeScript standard library short name." }));

/**
 * Validates the ECMAScript language target for `compilerOptions.target`.
 *
 * **Gotchas**
 *
 * `es5` is deprecated in TS
 * 6.0; `es3` has no literal (a removed value — a `target: "es3"` value fails
 * decode against this schema rather than silently passing through, since
 * `target` itself is a live, typed field).
 *
 * **Example** (Decode Target without case sensitivity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Target } from "@beep/tsconfig/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Target)("ES2025")); // es2025
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Target = caseInsensitiveLiterals(TargetKit).pipe(
  $I.annoteSchema("Target", { description: "The ECMAScript language target, including supported aliases." })
);

/**
 * The decoded shape accepted by {@link (Target:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Target = typeof Target.Type;

/**
 * Validates the JavaScript module output format for `compilerOptions.module`.
 *
 * **Gotchas**
 *
 * `none`, `amd`, `umd`
 * and `system` are deprecated in TS 6.0.
 *
 * **Example** (Decode Module without case sensitivity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Module } from "@beep/tsconfig/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Module)("CommonJS")); // commonjs
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Module = caseInsensitiveLiterals(ModuleKit).pipe(
  $I.annoteSchema("Module", { description: "The emitted JavaScript module format." })
);

/**
 * The decoded shape accepted by {@link (Module:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Module = typeof Module.Type;

/**
 * Validates the import resolution strategy for `compilerOptions.moduleResolution`.
 *
 * **Gotchas**
 *
 * `node10`, `node` and `classic` are
 * deprecated in TS 6.0.
 *
 * **Example** (Decode ModuleResolution without case sensitivity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ModuleResolution } from "@beep/tsconfig/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(ModuleResolution)("Bundler")); // bundler
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ModuleResolution = caseInsensitiveLiterals(ModuleResolutionKit).pipe(
  $I.annoteSchema("ModuleResolution", { description: "The strategy used to resolve module imports." })
);

/**
 * The decoded shape accepted by {@link (ModuleResolution:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ModuleResolution = typeof ModuleResolution.Type;

/**
 * Validates the JSX emit mode for `compilerOptions.jsx`.
 *
 * **Gotchas**
 *
 * There is no `none` literal — tsc's option map has
 * only these five.
 *
 * **Example** (Decode Jsx without case sensitivity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Jsx } from "@beep/tsconfig/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Jsx)("React-JSX")); // react-jsx
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Jsx = caseInsensitiveLiterals(JsxKit).pipe($I.annoteSchema("Jsx", { description: "The JSX emit mode." }));

/**
 * The decoded shape accepted by {@link (Jsx:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Jsx = typeof Jsx.Type;

/**
 * Validates the newline sequence for `compilerOptions.newLine`.
 *
 * **Example** (Decode NewLine without case sensitivity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { NewLine } from "@beep/tsconfig/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(NewLine)("LF")); // lf
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const NewLine = caseInsensitiveLiterals(NewLineKit).pipe(
  $I.annoteSchema("NewLine", { description: "The newline sequence used in emitted files." })
);

/**
 * The decoded shape accepted by {@link (NewLine:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NewLine = typeof NewLine.Type;

/**
 * Validates the source-file module detection strategy for `compilerOptions.moduleDetection`.
 *
 * **Example** (Decode ModuleDetection without case sensitivity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ModuleDetection } from "@beep/tsconfig/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(ModuleDetection)("Force")); // force
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ModuleDetection = caseInsensitiveLiterals(ModuleDetectionKit).pipe(
  $I.annoteSchema("ModuleDetection", { description: "The strategy for identifying module source files." })
);

/**
 * The decoded shape accepted by {@link (ModuleDetection:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ModuleDetection = typeof ModuleDetection.Type;

/**
 * Validates `compilerOptions.lib` member values against the complete TS 6.0.3 set.
 *
 * **Details**
 *
 * Values decode case-insensitively and encode to canonical lowercase.
 *
 * **Example** (Decode Lib without case sensitivity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Lib } from "@beep/tsconfig/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Lib)("DOM.Iterable")); // dom.iterable
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Lib = caseInsensitiveLiterals(LibKit).pipe(
  $I.annoteSchema("Lib", { description: "A supported TypeScript standard library short name." })
);

/**
 * The decoded shape accepted by {@link (Lib:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Lib = typeof Lib.Type;

// `compilerOptions.ignoreDeprecations` — the values are version strings, not
// case-varying identifiers, so this stays a plain (non-case-insensitive)
// literal schema and is not exported by name.
const IgnoreDeprecations = LiteralKit(["5.0", "6.0"]).pipe(
  $I.annoteSchema("IgnoreDeprecations", { description: "The deprecation version whose diagnostics are suppressed." })
);

/**
 * One `compilerOptions.plugins[]` entry: `name` is required and typed; every
 * other key is preserved verbatim (ts-plugin authors attach arbitrary extra
 * configuration).
 */
const PluginEntry = S.StructWithRest(
  S.Struct({
    name: S.String.pipe(
      $I.annoteKey("PluginEntry.name", { description: "The module name of the TypeScript language-service plugin." })
    ),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("PluginEntry", {
    description: "A named language-service plugin with arbitrary plugin configuration preserved.",
  })
);

// The known fields; unknown keys ride the passthrough record below.
const CompilerOptionsFields = S.Struct({
  // ── Enum-valued options ─────────────────────────────────────
  target: S.optionalKey(Target).pipe(
    $I.annoteKey("CompilerOptions.target", { description: "The ECMAScript language target." })
  ),
  module: S.optionalKey(Module).pipe(
    $I.annoteKey("CompilerOptions.module", { description: "The emitted JavaScript module format." })
  ),
  moduleResolution: S.optionalKey(ModuleResolution).pipe(
    $I.annoteKey("CompilerOptions.moduleResolution", { description: "The module import resolution strategy." })
  ),
  jsx: S.optionalKey(Jsx).pipe($I.annoteKey("CompilerOptions.jsx", { description: "The JSX emit mode." })),
  newLine: S.optionalKey(NewLine).pipe(
    $I.annoteKey("CompilerOptions.newLine", { description: "The newline sequence for emitted files." })
  ),
  moduleDetection: S.optionalKey(ModuleDetection).pipe(
    $I.annoteKey("CompilerOptions.moduleDetection", { description: "The source-file module detection strategy." })
  ),
  lib: Lib.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("CompilerOptions.lib", { description: "The standard libraries included in compilation." })
  ),
  ignoreDeprecations: S.optionalKey(IgnoreDeprecations).pipe(
    $I.annoteKey("CompilerOptions.ignoreDeprecations", {
      description: "The deprecation version whose diagnostics are suppressed.",
    })
  ),

  // ── Boolean options — live typed set ─────
  strict: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.strict", { description: "Enables all strict type-checking options." })
  ),
  noImplicitAny: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noImplicitAny", {
      description: "Reports expressions and declarations with an implied any type.",
    })
  ),
  strictNullChecks: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.strictNullChecks", {
      description: "Distinguishes null and undefined from other types.",
    })
  ),
  strictFunctionTypes: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.strictFunctionTypes", {
      description: "Checks function parameter variance strictly.",
    })
  ),
  strictBindCallApply: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.strictBindCallApply", {
      description: "Checks bind, call and apply arguments strictly.",
    })
  ),
  strictPropertyInitialization: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.strictPropertyInitialization", {
      description: "Checks that class properties are initialized.",
    })
  ),
  strictBuiltinIteratorReturn: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.strictBuiltinIteratorReturn", {
      description: "Uses strict return types for built-in iterators.",
    })
  ),
  noImplicitThis: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noImplicitThis", {
      description: "Reports this expressions with an implied any type.",
    })
  ),
  useUnknownInCatchVariables: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.useUnknownInCatchVariables", {
      description: "Types catch-clause variables as unknown.",
    })
  ),
  alwaysStrict: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.alwaysStrict", {
      description:
        "Parses files in strict mode and emits a use-strict directive. Deprecated in TypeScript 6.0 when set to `false`.",
    })
  ),
  noUnusedLocals: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noUnusedLocals", { description: "Reports unused local declarations." })
  ),
  noUnusedParameters: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noUnusedParameters", { description: "Reports unused function parameters." })
  ),
  exactOptionalPropertyTypes: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.exactOptionalPropertyTypes", {
      description: "Checks optional properties without adding undefined.",
    })
  ),
  noImplicitReturns: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noImplicitReturns", {
      description: "Reports code paths that do not return a value.",
    })
  ),
  noFallthroughCasesInSwitch: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noFallthroughCasesInSwitch", {
      description: "Reports fallthrough cases in switch statements.",
    })
  ),
  noUncheckedIndexedAccess: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noUncheckedIndexedAccess", {
      description: "Adds undefined to unchecked indexed accesses.",
    })
  ),
  noImplicitOverride: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noImplicitOverride", {
      description: "Requires override on overriding class members.",
    })
  ),
  noPropertyAccessFromIndexSignature: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noPropertyAccessFromIndexSignature", {
      description: "Requires indexed access for index-signature properties.",
    })
  ),
  allowUnusedLabels: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.allowUnusedLabels", { description: "Controls diagnostics for unused labels." })
  ),
  allowUnreachableCode: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.allowUnreachableCode", {
      description: "Controls diagnostics for unreachable code.",
    })
  ),
  noUncheckedSideEffectImports: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noUncheckedSideEffectImports", {
      description: "Checks unresolved side-effect imports.",
    })
  ),
  allowJs: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.allowJs", { description: "Includes JavaScript files in compilation." })
  ),
  checkJs: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.checkJs", { description: "Reports type errors in JavaScript files." })
  ),
  resolveJsonModule: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.resolveJsonModule", { description: "Enables importing JSON modules." })
  ),
  allowArbitraryExtensions: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.allowArbitraryExtensions", {
      description: "Allows imports with arbitrary extensions when declarations exist.",
    })
  ),
  allowImportingTsExtensions: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.allowImportingTsExtensions", {
      description: "Allows TypeScript extensions in import paths.",
    })
  ),
  rewriteRelativeImportExtensions: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.rewriteRelativeImportExtensions", {
      description: "Rewrites relative TypeScript import extensions on emit.",
    })
  ),
  resolvePackageJsonExports: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.resolvePackageJsonExports", {
      description: "Uses package.json exports during module resolution.",
    })
  ),
  resolvePackageJsonImports: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.resolvePackageJsonImports", {
      description: "Uses package.json imports during module resolution.",
    })
  ),
  allowSyntheticDefaultImports: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.allowSyntheticDefaultImports", {
      description:
        "Allows default imports from modules without a default export. Deprecated in TypeScript 6.0 when set to `false`.",
    })
  ),
  esModuleInterop: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.esModuleInterop", {
      description:
        "Emits interoperability helpers for CommonJS imports. Deprecated in TypeScript 6.0 when set to `false`.",
    })
  ),
  preserveSymlinks: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.preserveSymlinks", {
      description: "Resolves modules without resolving symlinks to their real paths.",
    })
  ),
  allowUmdGlobalAccess: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.allowUmdGlobalAccess", {
      description: "Allows accessing UMD globals from module files.",
    })
  ),
  verbatimModuleSyntax: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.verbatimModuleSyntax", {
      description: "Preserves imports and exports without rewriting module syntax.",
    })
  ),
  isolatedModules: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.isolatedModules", {
      description: "Checks compatibility with single-file transpilation.",
    })
  ),
  isolatedDeclarations: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.isolatedDeclarations", {
      description: "Requires explicit declarations for isolated declaration emit.",
    })
  ),
  erasableSyntaxOnly: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.erasableSyntaxOnly", {
      description: "Allows only TypeScript syntax that can be erased.",
    })
  ),
  forceConsistentCasingInFileNames: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.forceConsistentCasingInFileNames", {
      description: "Checks consistent filename casing across references.",
    })
  ),
  declaration: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.declaration", { description: "Emits declaration files." })
  ),
  declarationMap: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.declarationMap", { description: "Emits source maps for declaration files." })
  ),
  emitDeclarationOnly: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.emitDeclarationOnly", { description: "Emits declarations without JavaScript." })
  ),
  sourceMap: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.sourceMap", { description: "Emits separate JavaScript source maps." })
  ),
  inlineSourceMap: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.inlineSourceMap", { description: "Embeds source maps in emitted JavaScript." })
  ),
  inlineSources: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.inlineSources", { description: "Embeds source contents in source maps." })
  ),
  removeComments: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.removeComments", { description: "Removes comments from emitted files." })
  ),
  importHelpers: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.importHelpers", { description: "Imports emit helpers from tslib." })
  ),
  downlevelIteration: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.downlevelIteration", {
      description: "Emits iterable-compatible helpers for older targets. Deprecated in TypeScript 6.0.",
    })
  ),
  emitBOM: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.emitBOM", { description: "Adds a byte-order mark to emitted files." })
  ),
  noEmit: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noEmit", { description: "Disables all file emission." })
  ),
  noEmitHelpers: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noEmitHelpers", { description: "Disables generation of emit helpers." })
  ),
  noEmitOnError: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noEmitOnError", { description: "Disables emit when diagnostics report errors." })
  ),
  preserveConstEnums: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.preserveConstEnums", {
      description: "Preserves const enum declarations on emit.",
    })
  ),
  stripInternal: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.stripInternal", { description: "Omits declarations marked internal." })
  ),
  experimentalDecorators: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.experimentalDecorators", {
      description: "Enables legacy experimental decorators.",
    })
  ),
  emitDecoratorMetadata: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.emitDecoratorMetadata", { description: "Emits decorator type metadata." })
  ),
  useDefineForClassFields: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.useDefineForClassFields", {
      description: "Uses define semantics for class fields.",
    })
  ),
  noCheck: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noCheck", { description: "Disables full type checking." })
  ),
  composite: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.composite", {
      description: "Enables constraints for referenced composite projects.",
    })
  ),
  incremental: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.incremental", { description: "Stores incremental compilation information." })
  ),
  disableSourceOfProjectReferenceRedirect: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.disableSourceOfProjectReferenceRedirect", {
      description: "Uses referenced declaration files instead of project sources.",
    })
  ),
  disableSolutionSearching: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.disableSolutionSearching", {
      description: "Disables automatic solution-project searching.",
    })
  ),
  disableReferencedProjectLoad: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.disableReferencedProjectLoad", {
      description: "Disables automatic loading of referenced projects.",
    })
  ),
  assumeChangesOnlyAffectDirectDependencies: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.assumeChangesOnlyAffectDirectDependencies", {
      description: "Limits incremental checking to direct dependencies.",
    })
  ),
  noErrorTruncation: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noErrorTruncation", {
      description: "Prevents truncation of diagnostic messages.",
    })
  ),
  noLib: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noLib", { description: "Disables automatic inclusion of library files." })
  ),
  noResolve: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.noResolve", { description: "Disables adding imported files to the compilation." })
  ),
  skipDefaultLibCheck: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.skipDefaultLibCheck", {
      description: "Skips checking bundled declaration libraries.",
    })
  ),
  skipLibCheck: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.skipLibCheck", { description: "Skips checking declaration files." })
  ),
  diagnostics: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.diagnostics", { description: "Reports compiler performance diagnostics." })
  ),
  extendedDiagnostics: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.extendedDiagnostics", {
      description: "Reports detailed compiler performance diagnostics.",
    })
  ),
  listFiles: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.listFiles", { description: "Lists files included in compilation." })
  ),
  listFilesOnly: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.listFilesOnly", {
      description: "Lists compilation files without further processing.",
    })
  ),
  listEmittedFiles: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.listEmittedFiles", { description: "Lists generated output files." })
  ),
  explainFiles: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.explainFiles", { description: "Explains why files are included in compilation." })
  ),
  traceResolution: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.traceResolution", { description: "Reports module-resolution decisions." })
  ),
  preserveWatchOutput: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.preserveWatchOutput", {
      description: "Preserves terminal output between watch compilations.",
    })
  ),
  pretty: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.pretty", { description: "Formats diagnostics with color and context." })
  ),
  disableSizeLimit: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.disableSizeLimit", {
      description: "Disables the language-service source size limit.",
    })
  ),
  libReplacement: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.libReplacement", {
      description: "Enables replacement of bundled libraries through packages.",
    })
  ),
  stableTypeOrdering: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("CompilerOptions.stableTypeOrdering", {
      description: "Uses stable ordering when serializing types.",
    })
  ),

  // ── Path strings ─────────────────────────────────────────────
  outFile: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.outFile", {
      description: "The combined JavaScript output file. Deprecated in TypeScript 6.0.",
    })
  ),
  outDir: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.outDir", { description: "The directory for emitted files." })
  ),
  rootDir: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.rootDir", { description: "The root directory of compilation sources." })
  ),
  declarationDir: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.declarationDir", { description: "The directory for emitted declaration files." })
  ),
  sourceRoot: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.sourceRoot", { description: "The source root recorded in source maps." })
  ),
  mapRoot: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.mapRoot", { description: "The location of emitted source maps." })
  ),
  tsBuildInfoFile: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.tsBuildInfoFile", { description: "The incremental compilation state file." })
  ),
  baseUrl: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.baseUrl", {
      description: "The base directory for non-relative module resolution. Deprecated in TypeScript 6.0.",
    })
  ),
  generateCpuProfile: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.generateCpuProfile", {
      description: "The output file for the compiler CPU profile.",
    })
  ),
  generateTrace: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.generateTrace", { description: "The directory for compiler tracing output." })
  ),

  // ── Path lists ───────────────────────────────────────────────
  typeRoots: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("CompilerOptions.typeRoots", { description: "The directories searched for type packages." })
  ),
  rootDirs: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("CompilerOptions.rootDirs", { description: "The source directories treated as one virtual root." })
  ),

  // ── Plain strings ────────────────────────────────────────────
  jsxFactory: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.jsxFactory", { description: "The factory used for classic JSX elements." })
  ),
  jsxFragmentFactory: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.jsxFragmentFactory", {
      description: "The factory used for classic JSX fragments.",
    })
  ),
  jsxImportSource: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.jsxImportSource", {
      description: "The module providing the automatic JSX runtime.",
    })
  ),
  reactNamespace: S.optionalKey(S.String).pipe(
    $I.annoteKey("CompilerOptions.reactNamespace", { description: "The namespace used for legacy React JSX." })
  ),

  // ── String lists ─────────────────────────────────────────────
  types: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("CompilerOptions.types", { description: "The type packages included in the global scope." })
  ),
  customConditions: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("CompilerOptions.customConditions", {
      description: "Additional package export conditions for resolution.",
    })
  ),
  moduleSuffixes: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("CompilerOptions.moduleSuffixes", {
      description: "Filename suffixes tried during module resolution.",
    })
  ),

  // ── Record ────────────────────────────────────────────────────
  paths: S.optionalKey(S.Record(S.String, S.Array(S.String))).pipe(
    $I.annoteKey("CompilerOptions.paths", { description: "Module specifiers mapped to candidate path patterns." })
  ),

  // ── Objects ───────────────────────────────────────────────────
  plugins: PluginEntry.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("CompilerOptions.plugins", { description: "Language-service plugins and their configuration." })
  ),

  // ── Number ────────────────────────────────────────────────────
  maxNodeModuleJsDepth: S.optionalKey(S.Finite).pipe(
    $I.annoteKey("CompilerOptions.maxNodeModuleJsDepth", {
      description: "The maximum dependency depth for JavaScript files.",
    })
  ),
});

/**
 * Validates string-level compiler options while preserving options outside the known schema.
 *
 * **Details**
 *
 * Every live boolean, string, path, array,
 * record, number and enum field is an `optionalKey`, intersected with a
 * passthrough record so unknown and removed keys survive decode and re-encode
 * untouched, which keeps the schema tolerant of newer compiler options.
 *
 * **Example** (Preserve unknown options through a round trip)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { CompilerOptions } from "@beep/tsconfig/CompilerOptions";
 *
 * const options = S.decodeUnknownSync(CompilerOptions)({ target: "ESNext", strict: true, futureOption: "kept" });
 * console.log(options.target); // esnext
 * console.log(S.encodeSync(CompilerOptions)(options).futureOption); // kept
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CompilerOptions = S.StructWithRest(CompilerOptionsFields, [S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("CompilerOptions", {
    description: "Optional typed compiler options with unknown and removed options preserved.",
  })
);

/**
 * The decoded shape accepted by {@link (CompilerOptions:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CompilerOptions = typeof CompilerOptions.Type;

/**
 * Type-only companion namespace for {@link (CompilerOptions:variable)}, exposing its
 * decoded and encoded shapes.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CompilerOptions {
  /**
   * The decoded `compilerOptions` shape: every typed field optional, plus passthrough for unknown keys.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = CompilerOptions;
  /**
   * The encoded (on-disk JSON) `compilerOptions` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CompilerOptions.Encoded;
}

/**
 * The closed view of {@link (CompilerOptions:variable)}: the same typed
 * fields with no passthrough record, so an option the model does not type is
 * an excess property.
 *
 * **Details**
 *
 * The key universe is the one object the passthrough schema is built from, so
 * the two never drift. Decoding with `onExcessProperty: "error"` rejects an
 * unknown option; the default `"ignore"` drops it. `@beep/repo-tsconfig`
 * `TsconfigValidator` layers tsc's cross-field and uniqueness checks over
 * this view (the strict model docgen reads).
 *
 * **Example** (Reject an unknown compiler option)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ClosedCompilerOptions } from "@beep/tsconfig/CompilerOptions";
 *
 * const strict = S.decodeUnknownExit(ClosedCompilerOptions);
 * console.log(strict({ strict: true }, { onExcessProperty: "error" })._tag); // Success
 * console.log(strict({ futureOption: "kept" }, { onExcessProperty: "error" })._tag); // Failure
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ClosedCompilerOptions = CompilerOptionsFields.pipe(
  $I.annoteSchema("ClosedCompilerOptions", {
    description: "The typed compiler options with no passthrough: an unknown option is an excess property.",
  })
);

/**
 * The decoded shape accepted by {@link (ClosedCompilerOptions:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ClosedCompilerOptions = typeof ClosedCompilerOptions.Type;

/**
 * Type-only companion namespace for {@link (ClosedCompilerOptions:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClosedCompilerOptions {
  /**
   * The decoded closed `compilerOptions` shape: every typed field optional, no index signature.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ClosedCompilerOptions;
  /**
   * The encoded (on-disk JSON) closed `compilerOptions` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClosedCompilerOptions.Encoded;
}
