// compilerOptions as string-level schemas — the foundational module the rest of
// the package builds on, modelled on TS 6.0.3 × schemastore. Alias
// normalization (es6→es2015, node→node10) is deliberately NOT applied here —
// only lowercasing. Aliases collapse only in the numeric-enum codec
// (TsEnumCodec). watchOptions/typeAcquisition/references live in
// TsconfigJson.ts — this module owns compilerOptions only.
//
// Two spellings this module depends on, pinned by __test__/CompilerOptions.test.ts:
//
// (a) struct + passthrough — `Schema.StructWithRest(Schema.Struct({...}),
//     [Schema.Record(Schema.String, Schema.Unknown)])` round-trips a typed
//     field alongside an unknown passthrough key through both
//     `Schema.decodeUnknownEffect` and `Schema.encodeUnknownEffect` ("passes
//     unknown option keys through and preserves them across encode").
//
// (b) case-insensitive literal union — `Schema.String.pipe(Schema.decodeTo(
//     Schema.Literals(literals), SchemaTransformation.transform({ decode: (s)
//     => s.toLowerCase(), encode: (s) => s })))` decodes a non-first literal
//     ("es2015", third of three) from "ES2015" and rejects an unrecognized
//     one ("decodes enum values case-insensitively" / "rejects an unknown
//     enum value").

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $ScratchpadId.create("effected/tsconfig-json/CompilerOptions");

/**
 * Case-insensitive literal-union decode; canonical lowercase encode. Module-
 * internal — every exported enum schema below is built
 * from it, but the helper itself is not part of the public surface.
 */
const caseInsensitiveLiterals = <const L extends ReadonlyArray<string>>(literals: S.Literals<L>) =>
	S.String.pipe(
		S.decodeTo(
			literals,
			SchemaTransformation.transform({
				decode: Str.toLowerCase,
				encode: identity,
			}),
		),
	);

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
]).annotate(
	$I.annote("TargetLiterals", { description: "The ECMAScript language target, including supported aliases." }),
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
]).annotate(
	$I.annote("ModuleLiterals", { description: "The emitted JavaScript module format." }),
);

const ModuleResolutionKit = LiteralKit(["node10", "node", "classic", "node16", "nodenext", "bundler"]).annotate(
	$I.annote("ModuleResolutionLiterals", { description: "The strategy used to resolve module imports." }),
);

const JsxKit = LiteralKit(["preserve", "react-native", "react-jsx", "react-jsxdev", "react"]).annotate(
	$I.annote("JsxLiterals", { description: "The JSX emit mode." }),
);

const NewLineKit = LiteralKit(["crlf", "lf"]).annotate(
	$I.annote("NewLineLiterals", { description: "The newline sequence used in emitted files." }),
);

const ModuleDetectionKit = LiteralKit(["auto", "legacy", "force"]).annotate(
	$I.annote("ModuleDetectionLiterals", { description: "The strategy for identifying module source files." }),
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
]).annotate(
	$I.annote("LibLiterals", { description: "A supported TypeScript standard library short name." }),
);

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
 * import { Target } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Target)("ES2025")); // es2025
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Target = caseInsensitiveLiterals(TargetKit).annotate(
	$I.annote("Target", { description: "The ECMAScript language target, including supported aliases." }),
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
 * import { Module } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Module)("CommonJS")); // commonjs
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Module = caseInsensitiveLiterals(ModuleKit).annotate(
	$I.annote("Module", { description: "The emitted JavaScript module format." }),
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
 * import { ModuleResolution } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(ModuleResolution)("Bundler")); // bundler
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ModuleResolution = caseInsensitiveLiterals(ModuleResolutionKit).annotate(
	$I.annote("ModuleResolution", { description: "The strategy used to resolve module imports." }),
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
 * import { Jsx } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Jsx)("React-JSX")); // react-jsx
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Jsx = caseInsensitiveLiterals(JsxKit).annotate(
	$I.annote("Jsx", { description: "The JSX emit mode." }),
);

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
 * import { NewLine } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(NewLine)("LF")); // lf
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const NewLine = caseInsensitiveLiterals(NewLineKit).annotate(
	$I.annote("NewLine", { description: "The newline sequence used in emitted files." }),
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
 * import { ModuleDetection } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(ModuleDetection)("Force")); // force
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ModuleDetection = caseInsensitiveLiterals(ModuleDetectionKit).annotate(
	$I.annote("ModuleDetection", { description: "The strategy for identifying module source files." }),
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
 * import { Lib } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
 *
 * console.log(S.decodeUnknownSync(Lib)("DOM.Iterable")); // dom.iterable
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Lib = caseInsensitiveLiterals(LibKit).annotate(
	$I.annote("Lib", { description: "A supported TypeScript standard library short name." }),
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
const IgnoreDeprecations = LiteralKit(["5.0", "6.0"]).annotate(
	$I.annote("IgnoreDeprecations", { description: "The deprecation version whose diagnostics are suppressed." }),
);

/**
 * One `compilerOptions.plugins[]` entry: `name` is required and typed; every
 * other key is preserved verbatim (ts-plugin authors attach arbitrary extra
 * configuration).
 */
const PluginEntry = S.StructWithRest(S.Struct({ name: S.String.annotateKey({ description: "The module name of the TypeScript language-service plugin." }) }), [
	S.Record(S.String, S.Unknown),
]).annotate($I.annote("PluginEntry", { description: "A named language-service plugin with arbitrary plugin configuration preserved." }));

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
 * import { CompilerOptions } from "@beep/scratchpad/effected/tsconfig-json/CompilerOptions";
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
export const CompilerOptions = S.StructWithRest(
	S.Struct({
		// ── Enum-valued options ─────────────────────────────────────
		target: S.optionalKey(Target).annotateKey({ description: "The ECMAScript language target." }),
		module: S.optionalKey(Module).annotateKey({ description: "The emitted JavaScript module format." }),
		moduleResolution: S.optionalKey(ModuleResolution).annotateKey({ description: "The module import resolution strategy." }),
		jsx: S.optionalKey(Jsx).annotateKey({ description: "The JSX emit mode." }),
		newLine: S.optionalKey(NewLine).annotateKey({ description: "The newline sequence for emitted files." }),
		moduleDetection: S.optionalKey(ModuleDetection).annotateKey({ description: "The source-file module detection strategy." }),
		lib: Lib.pipe(S.Array, S.optionalKey).annotateKey({ description: "The standard libraries included in compilation." }),
		ignoreDeprecations: S.optionalKey(IgnoreDeprecations).annotateKey({ description: "The deprecation version whose diagnostics are suppressed." }),

		// ── Boolean options — live typed set ─────
		strict: S.optionalKey(S.Boolean).annotateKey({ description: "Enables all strict type-checking options." }),
		noImplicitAny: S.optionalKey(S.Boolean).annotateKey({ description: "Reports expressions and declarations with an implied any type." }),
		strictNullChecks: S.optionalKey(S.Boolean).annotateKey({ description: "Distinguishes null and undefined from other types." }),
		strictFunctionTypes: S.optionalKey(S.Boolean).annotateKey({ description: "Checks function parameter variance strictly." }),
		strictBindCallApply: S.optionalKey(S.Boolean).annotateKey({ description: "Checks bind, call and apply arguments strictly." }),
		strictPropertyInitialization: S.optionalKey(S.Boolean).annotateKey({ description: "Checks that class properties are initialized." }),
		strictBuiltinIteratorReturn: S.optionalKey(S.Boolean).annotateKey({ description: "Uses strict return types for built-in iterators." }),
		noImplicitThis: S.optionalKey(S.Boolean).annotateKey({ description: "Reports this expressions with an implied any type." }),
		useUnknownInCatchVariables: S.optionalKey(S.Boolean).annotateKey({ description: "Types catch-clause variables as unknown." }),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		alwaysStrict: S.optionalKey(S.Boolean).annotateKey({ description: "Parses files in strict mode and emits a use-strict directive." }),
		noUnusedLocals: S.optionalKey(S.Boolean).annotateKey({ description: "Reports unused local declarations." }),
		noUnusedParameters: S.optionalKey(S.Boolean).annotateKey({ description: "Reports unused function parameters." }),
		exactOptionalPropertyTypes: S.optionalKey(S.Boolean).annotateKey({ description: "Checks optional properties without adding undefined." }),
		noImplicitReturns: S.optionalKey(S.Boolean).annotateKey({ description: "Reports code paths that do not return a value." }),
		noFallthroughCasesInSwitch: S.optionalKey(S.Boolean).annotateKey({ description: "Reports fallthrough cases in switch statements." }),
		noUncheckedIndexedAccess: S.optionalKey(S.Boolean).annotateKey({ description: "Adds undefined to unchecked indexed accesses." }),
		noImplicitOverride: S.optionalKey(S.Boolean).annotateKey({ description: "Requires override on overriding class members." }),
		noPropertyAccessFromIndexSignature: S.optionalKey(S.Boolean).annotateKey({ description: "Requires indexed access for index-signature properties." }),
		allowUnusedLabels: S.optionalKey(S.Boolean).annotateKey({ description: "Controls diagnostics for unused labels." }),
		allowUnreachableCode: S.optionalKey(S.Boolean).annotateKey({ description: "Controls diagnostics for unreachable code." }),
		noUncheckedSideEffectImports: S.optionalKey(S.Boolean).annotateKey({ description: "Checks unresolved side-effect imports." }),
		allowJs: S.optionalKey(S.Boolean).annotateKey({ description: "Includes JavaScript files in compilation." }),
		checkJs: S.optionalKey(S.Boolean).annotateKey({ description: "Reports type errors in JavaScript files." }),
		resolveJsonModule: S.optionalKey(S.Boolean).annotateKey({ description: "Enables importing JSON modules." }),
		allowArbitraryExtensions: S.optionalKey(S.Boolean).annotateKey({ description: "Allows imports with arbitrary extensions when declarations exist." }),
		allowImportingTsExtensions: S.optionalKey(S.Boolean).annotateKey({ description: "Allows TypeScript extensions in import paths." }),
		rewriteRelativeImportExtensions: S.optionalKey(S.Boolean).annotateKey({ description: "Rewrites relative TypeScript import extensions on emit." }),
		resolvePackageJsonExports: S.optionalKey(S.Boolean).annotateKey({ description: "Uses package.json exports during module resolution." }),
		resolvePackageJsonImports: S.optionalKey(S.Boolean).annotateKey({ description: "Uses package.json imports during module resolution." }),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		allowSyntheticDefaultImports: S.optionalKey(S.Boolean).annotateKey({ description: "Allows default imports from modules without a default export." }),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		esModuleInterop: S.optionalKey(S.Boolean).annotateKey({ description: "Emits interoperability helpers for CommonJS imports." }),
		preserveSymlinks: S.optionalKey(S.Boolean).annotateKey({ description: "Resolves modules without resolving symlinks to their real paths." }),
		allowUmdGlobalAccess: S.optionalKey(S.Boolean).annotateKey({ description: "Allows accessing UMD globals from module files." }),
		verbatimModuleSyntax: S.optionalKey(S.Boolean).annotateKey({ description: "Preserves imports and exports without rewriting module syntax." }),
		isolatedModules: S.optionalKey(S.Boolean).annotateKey({ description: "Checks compatibility with single-file transpilation." }),
		isolatedDeclarations: S.optionalKey(S.Boolean).annotateKey({ description: "Requires explicit declarations for isolated declaration emit." }),
		erasableSyntaxOnly: S.optionalKey(S.Boolean).annotateKey({ description: "Allows only TypeScript syntax that can be erased." }),
		forceConsistentCasingInFileNames: S.optionalKey(S.Boolean).annotateKey({ description: "Checks consistent filename casing across references." }),
		declaration: S.optionalKey(S.Boolean).annotateKey({ description: "Emits declaration files." }),
		declarationMap: S.optionalKey(S.Boolean).annotateKey({ description: "Emits source maps for declaration files." }),
		emitDeclarationOnly: S.optionalKey(S.Boolean).annotateKey({ description: "Emits declarations without JavaScript." }),
		sourceMap: S.optionalKey(S.Boolean).annotateKey({ description: "Emits separate JavaScript source maps." }),
		inlineSourceMap: S.optionalKey(S.Boolean).annotateKey({ description: "Embeds source maps in emitted JavaScript." }),
		inlineSources: S.optionalKey(S.Boolean).annotateKey({ description: "Embeds source contents in source maps." }),
		removeComments: S.optionalKey(S.Boolean).annotateKey({ description: "Removes comments from emitted files." }),
		importHelpers: S.optionalKey(S.Boolean).annotateKey({ description: "Imports emit helpers from tslib." }),
		/** @deprecated Deprecated in TypeScript 6.0. */
		downlevelIteration: S.optionalKey(S.Boolean).annotateKey({ description: "Emits iterable-compatible helpers for older targets." }),
		emitBOM: S.optionalKey(S.Boolean).annotateKey({ description: "Adds a byte-order mark to emitted files." }),
		noEmit: S.optionalKey(S.Boolean).annotateKey({ description: "Disables all file emission." }),
		noEmitHelpers: S.optionalKey(S.Boolean).annotateKey({ description: "Disables generation of emit helpers." }),
		noEmitOnError: S.optionalKey(S.Boolean).annotateKey({ description: "Disables emit when diagnostics report errors." }),
		preserveConstEnums: S.optionalKey(S.Boolean).annotateKey({ description: "Preserves const enum declarations on emit." }),
		stripInternal: S.optionalKey(S.Boolean).annotateKey({ description: "Omits declarations marked internal." }),
		experimentalDecorators: S.optionalKey(S.Boolean).annotateKey({ description: "Enables legacy experimental decorators." }),
		emitDecoratorMetadata: S.optionalKey(S.Boolean).annotateKey({ description: "Emits decorator type metadata." }),
		useDefineForClassFields: S.optionalKey(S.Boolean).annotateKey({ description: "Uses define semantics for class fields." }),
		noCheck: S.optionalKey(S.Boolean).annotateKey({ description: "Disables full type checking." }),
		composite: S.optionalKey(S.Boolean).annotateKey({ description: "Enables constraints for referenced composite projects." }),
		incremental: S.optionalKey(S.Boolean).annotateKey({ description: "Stores incremental compilation information." }),
		disableSourceOfProjectReferenceRedirect: S.optionalKey(S.Boolean).annotateKey({ description: "Uses referenced declaration files instead of project sources." }),
		disableSolutionSearching: S.optionalKey(S.Boolean).annotateKey({ description: "Disables automatic solution-project searching." }),
		disableReferencedProjectLoad: S.optionalKey(S.Boolean).annotateKey({ description: "Disables automatic loading of referenced projects." }),
		assumeChangesOnlyAffectDirectDependencies: S.optionalKey(S.Boolean).annotateKey({ description: "Limits incremental checking to direct dependencies." }),
		noErrorTruncation: S.optionalKey(S.Boolean).annotateKey({ description: "Prevents truncation of diagnostic messages." }),
		noLib: S.optionalKey(S.Boolean).annotateKey({ description: "Disables automatic inclusion of library files." }),
		noResolve: S.optionalKey(S.Boolean).annotateKey({ description: "Disables adding imported files to the compilation." }),
		skipDefaultLibCheck: S.optionalKey(S.Boolean).annotateKey({ description: "Skips checking bundled declaration libraries." }),
		skipLibCheck: S.optionalKey(S.Boolean).annotateKey({ description: "Skips checking declaration files." }),
		diagnostics: S.optionalKey(S.Boolean).annotateKey({ description: "Reports compiler performance diagnostics." }),
		extendedDiagnostics: S.optionalKey(S.Boolean).annotateKey({ description: "Reports detailed compiler performance diagnostics." }),
		listFiles: S.optionalKey(S.Boolean).annotateKey({ description: "Lists files included in compilation." }),
		listFilesOnly: S.optionalKey(S.Boolean).annotateKey({ description: "Lists compilation files without further processing." }),
		listEmittedFiles: S.optionalKey(S.Boolean).annotateKey({ description: "Lists generated output files." }),
		explainFiles: S.optionalKey(S.Boolean).annotateKey({ description: "Explains why files are included in compilation." }),
		traceResolution: S.optionalKey(S.Boolean).annotateKey({ description: "Reports module-resolution decisions." }),
		preserveWatchOutput: S.optionalKey(S.Boolean).annotateKey({ description: "Preserves terminal output between watch compilations." }),
		pretty: S.optionalKey(S.Boolean).annotateKey({ description: "Formats diagnostics with color and context." }),
		disableSizeLimit: S.optionalKey(S.Boolean).annotateKey({ description: "Disables the language-service source size limit." }),
		libReplacement: S.optionalKey(S.Boolean).annotateKey({ description: "Enables replacement of bundled libraries through packages." }),
		stableTypeOrdering: S.optionalKey(S.Boolean).annotateKey({ description: "Uses stable ordering when serializing types." }),

		// ── Path strings ─────────────────────────────────────────────
		/** @deprecated Deprecated in TypeScript 6.0. */
		outFile: S.optionalKey(S.String).annotateKey({ description: "The combined JavaScript output file." }),
		outDir: S.optionalKey(S.String).annotateKey({ description: "The directory for emitted files." }),
		rootDir: S.optionalKey(S.String).annotateKey({ description: "The root directory of compilation sources." }),
		declarationDir: S.optionalKey(S.String).annotateKey({ description: "The directory for emitted declaration files." }),
		sourceRoot: S.optionalKey(S.String).annotateKey({ description: "The source root recorded in source maps." }),
		mapRoot: S.optionalKey(S.String).annotateKey({ description: "The location of emitted source maps." }),
		tsBuildInfoFile: S.optionalKey(S.String).annotateKey({ description: "The incremental compilation state file." }),
		/** @deprecated Deprecated in TypeScript 6.0. */
		baseUrl: S.optionalKey(S.String).annotateKey({ description: "The base directory for non-relative module resolution." }),
		generateCpuProfile: S.optionalKey(S.String).annotateKey({ description: "The output file for the compiler CPU profile." }),
		generateTrace: S.optionalKey(S.String).annotateKey({ description: "The directory for compiler tracing output." }),

		// ── Path lists ───────────────────────────────────────────────
		typeRoots: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "The directories searched for type packages." }),
		rootDirs: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "The source directories treated as one virtual root." }),

		// ── Plain strings ────────────────────────────────────────────
		jsxFactory: S.optionalKey(S.String).annotateKey({ description: "The factory used for classic JSX elements." }),
		jsxFragmentFactory: S.optionalKey(S.String).annotateKey({ description: "The factory used for classic JSX fragments." }),
		jsxImportSource: S.optionalKey(S.String).annotateKey({ description: "The module providing the automatic JSX runtime." }),
		reactNamespace: S.optionalKey(S.String).annotateKey({ description: "The namespace used for legacy React JSX." }),

		// ── String lists ─────────────────────────────────────────────
		types: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "The type packages included in the global scope." }),
		customConditions: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Additional package export conditions for resolution." }),
		moduleSuffixes: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Filename suffixes tried during module resolution." }),

		// ── Record ────────────────────────────────────────────────────
		paths: S.optionalKey(S.Record(S.String, S.Array(S.String))).annotateKey({ description: "Module specifiers mapped to candidate path patterns." }),

		// ── Objects ───────────────────────────────────────────────────
		plugins: PluginEntry.pipe(S.Array, S.optionalKey).annotateKey({ description: "Language-service plugins and their configuration." }),

		// ── Number ────────────────────────────────────────────────────
		maxNodeModuleJsDepth: S.optionalKey(S.Finite).annotateKey({ description: "The maximum dependency depth for JavaScript files." }),
	}),
	[S.Record(S.String, S.Unknown)],
).annotate($I.annote("CompilerOptions", { description: "Optional typed compiler options with unknown and removed options preserved." }));

/**
 * The decoded shape accepted by {@link (CompilerOptions:variable)}.
 *
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
