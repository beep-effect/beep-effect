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

import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

/**
 * Case-insensitive literal-union decode; canonical lowercase encode. Module-
 * internal — every exported enum schema below is built
 * from it, but the helper itself is not part of the public surface.
 */
const caseInsensitiveLiterals = <const L extends ReadonlyArray<string>>(literals: L) =>
	S.String.pipe(
		S.decodeTo(
			S.Literals(literals),
			SchemaTransformation.transform({
				decode: (s: string) => s.toLowerCase(),
				encode: (s: string) => s,
			}),
		),
	);

/**
 * `compilerOptions.target` — the ECMAScript target. `es5` is deprecated in TS
 * 6.0; `es3` has no literal (a removed value — a `target: "es3"` value fails
 * decode against this schema rather than silently passing through, since
 * `target` itself is a live, typed field).
 *
 * @public
 */
export const Target = caseInsensitiveLiterals([
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
]);

/**
 * `compilerOptions.module` — the module output format. `none`, `amd`, `umd`
 * and `system` are deprecated in TS 6.0.
 *
 * @public
 */
export const Module = caseInsensitiveLiterals([
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
]);

/**
 * `compilerOptions.moduleResolution`. `node10`, `node` and `classic` are
 * deprecated in TS 6.0.
 *
 * @public
 */
export const ModuleResolution = caseInsensitiveLiterals(["node10", "node", "classic", "node16", "nodenext", "bundler"]);

/**
 * `compilerOptions.jsx`. There is no `none` literal — tsc's option map has
 * only these five.
 *
 * @public
 */
export const Jsx = caseInsensitiveLiterals(["preserve", "react-native", "react-jsx", "react-jsxdev", "react"]);

/** `compilerOptions.newLine`. @public */
export const NewLine = caseInsensitiveLiterals(["crlf", "lf"]);

/** `compilerOptions.moduleDetection`. @public */
export const ModuleDetection = caseInsensitiveLiterals(["auto", "legacy", "force"]);

/**
 * `compilerOptions.lib` member values — the complete TS 6.0.3 set, lowercase
 * canonical.
 *
 * @public
 */
export const Lib = caseInsensitiveLiterals([
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
]);

// `compilerOptions.ignoreDeprecations` — the values are version strings, not
// case-varying identifiers, so this stays a plain (non-case-insensitive)
// literal schema and is not exported by name.
const IgnoreDeprecations = S.Literals(["5.0", "6.0"]);

/**
 * One `compilerOptions.plugins[]` entry: `name` is required and typed; every
 * other key is preserved verbatim (ts-plugin authors attach arbitrary extra
 * configuration).
 */
const PluginEntry = S.StructWithRest(S.Struct({ name: S.String }), [
	S.Record(S.String, S.Unknown),
]);

/**
 * `compilerOptions`, decoded as every live boolean, string, path, array,
 * record, number and enum field — each `optionalKey` — intersected with a
 * passthrough record so unknown and removed keys survive decode and re-encode
 * untouched, which keeps the schema tolerant of newer compiler options.
 *
 * @public
 */
export const CompilerOptions = S.StructWithRest(
	S.Struct({
		// ── Enum-valued options ─────────────────────────────────────
		target: S.optionalKey(Target),
		module: S.optionalKey(Module),
		moduleResolution: S.optionalKey(ModuleResolution),
		jsx: S.optionalKey(Jsx),
		newLine: S.optionalKey(NewLine),
		moduleDetection: S.optionalKey(ModuleDetection),
		lib: Lib.pipe(S.Array, S.optionalKey),
		ignoreDeprecations: S.optionalKey(IgnoreDeprecations),

		// ── Boolean options — live typed set ─────
		strict: S.optionalKey(S.Boolean),
		noImplicitAny: S.optionalKey(S.Boolean),
		strictNullChecks: S.optionalKey(S.Boolean),
		strictFunctionTypes: S.optionalKey(S.Boolean),
		strictBindCallApply: S.optionalKey(S.Boolean),
		strictPropertyInitialization: S.optionalKey(S.Boolean),
		strictBuiltinIteratorReturn: S.optionalKey(S.Boolean),
		noImplicitThis: S.optionalKey(S.Boolean),
		useUnknownInCatchVariables: S.optionalKey(S.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		alwaysStrict: S.optionalKey(S.Boolean),
		noUnusedLocals: S.optionalKey(S.Boolean),
		noUnusedParameters: S.optionalKey(S.Boolean),
		exactOptionalPropertyTypes: S.optionalKey(S.Boolean),
		noImplicitReturns: S.optionalKey(S.Boolean),
		noFallthroughCasesInSwitch: S.optionalKey(S.Boolean),
		noUncheckedIndexedAccess: S.optionalKey(S.Boolean),
		noImplicitOverride: S.optionalKey(S.Boolean),
		noPropertyAccessFromIndexSignature: S.optionalKey(S.Boolean),
		allowUnusedLabels: S.optionalKey(S.Boolean),
		allowUnreachableCode: S.optionalKey(S.Boolean),
		noUncheckedSideEffectImports: S.optionalKey(S.Boolean),
		allowJs: S.optionalKey(S.Boolean),
		checkJs: S.optionalKey(S.Boolean),
		resolveJsonModule: S.optionalKey(S.Boolean),
		allowArbitraryExtensions: S.optionalKey(S.Boolean),
		allowImportingTsExtensions: S.optionalKey(S.Boolean),
		rewriteRelativeImportExtensions: S.optionalKey(S.Boolean),
		resolvePackageJsonExports: S.optionalKey(S.Boolean),
		resolvePackageJsonImports: S.optionalKey(S.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		allowSyntheticDefaultImports: S.optionalKey(S.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		esModuleInterop: S.optionalKey(S.Boolean),
		preserveSymlinks: S.optionalKey(S.Boolean),
		allowUmdGlobalAccess: S.optionalKey(S.Boolean),
		verbatimModuleSyntax: S.optionalKey(S.Boolean),
		isolatedModules: S.optionalKey(S.Boolean),
		isolatedDeclarations: S.optionalKey(S.Boolean),
		erasableSyntaxOnly: S.optionalKey(S.Boolean),
		forceConsistentCasingInFileNames: S.optionalKey(S.Boolean),
		declaration: S.optionalKey(S.Boolean),
		declarationMap: S.optionalKey(S.Boolean),
		emitDeclarationOnly: S.optionalKey(S.Boolean),
		sourceMap: S.optionalKey(S.Boolean),
		inlineSourceMap: S.optionalKey(S.Boolean),
		inlineSources: S.optionalKey(S.Boolean),
		removeComments: S.optionalKey(S.Boolean),
		importHelpers: S.optionalKey(S.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0. */
		downlevelIteration: S.optionalKey(S.Boolean),
		emitBOM: S.optionalKey(S.Boolean),
		noEmit: S.optionalKey(S.Boolean),
		noEmitHelpers: S.optionalKey(S.Boolean),
		noEmitOnError: S.optionalKey(S.Boolean),
		preserveConstEnums: S.optionalKey(S.Boolean),
		stripInternal: S.optionalKey(S.Boolean),
		experimentalDecorators: S.optionalKey(S.Boolean),
		emitDecoratorMetadata: S.optionalKey(S.Boolean),
		useDefineForClassFields: S.optionalKey(S.Boolean),
		noCheck: S.optionalKey(S.Boolean),
		composite: S.optionalKey(S.Boolean),
		incremental: S.optionalKey(S.Boolean),
		disableSourceOfProjectReferenceRedirect: S.optionalKey(S.Boolean),
		disableSolutionSearching: S.optionalKey(S.Boolean),
		disableReferencedProjectLoad: S.optionalKey(S.Boolean),
		assumeChangesOnlyAffectDirectDependencies: S.optionalKey(S.Boolean),
		noErrorTruncation: S.optionalKey(S.Boolean),
		noLib: S.optionalKey(S.Boolean),
		noResolve: S.optionalKey(S.Boolean),
		skipDefaultLibCheck: S.optionalKey(S.Boolean),
		skipLibCheck: S.optionalKey(S.Boolean),
		diagnostics: S.optionalKey(S.Boolean),
		extendedDiagnostics: S.optionalKey(S.Boolean),
		listFiles: S.optionalKey(S.Boolean),
		listFilesOnly: S.optionalKey(S.Boolean),
		listEmittedFiles: S.optionalKey(S.Boolean),
		explainFiles: S.optionalKey(S.Boolean),
		traceResolution: S.optionalKey(S.Boolean),
		preserveWatchOutput: S.optionalKey(S.Boolean),
		pretty: S.optionalKey(S.Boolean),
		disableSizeLimit: S.optionalKey(S.Boolean),
		libReplacement: S.optionalKey(S.Boolean),
		stableTypeOrdering: S.optionalKey(S.Boolean),

		// ── Path strings ─────────────────────────────────────────────
		/** @deprecated Deprecated in TypeScript 6.0. */
		outFile: S.optionalKey(S.String),
		outDir: S.optionalKey(S.String),
		rootDir: S.optionalKey(S.String),
		declarationDir: S.optionalKey(S.String),
		sourceRoot: S.optionalKey(S.String),
		mapRoot: S.optionalKey(S.String),
		tsBuildInfoFile: S.optionalKey(S.String),
		/** @deprecated Deprecated in TypeScript 6.0. */
		baseUrl: S.optionalKey(S.String),
		generateCpuProfile: S.optionalKey(S.String),
		generateTrace: S.optionalKey(S.String),

		// ── Path lists ───────────────────────────────────────────────
		typeRoots: S.String.pipe(S.Array, S.optionalKey),
		rootDirs: S.String.pipe(S.Array, S.optionalKey),

		// ── Plain strings ────────────────────────────────────────────
		jsxFactory: S.optionalKey(S.String),
		jsxFragmentFactory: S.optionalKey(S.String),
		jsxImportSource: S.optionalKey(S.String),
		reactNamespace: S.optionalKey(S.String),

		// ── String lists ─────────────────────────────────────────────
		types: S.String.pipe(S.Array, S.optionalKey),
		customConditions: S.String.pipe(S.Array, S.optionalKey),
		moduleSuffixes: S.String.pipe(S.Array, S.optionalKey),

		// ── Record ────────────────────────────────────────────────────
		paths: S.optionalKey(S.Record(S.String, S.Array(S.String))),

		// ── Objects ───────────────────────────────────────────────────
		plugins: PluginEntry.pipe(S.Array, S.optionalKey),

		// ── Number ────────────────────────────────────────────────────
		maxNodeModuleJsDepth: S.optionalKey(S.Finite),
	}),
	[S.Record(S.String, S.Unknown)],
);

/**
 * Type-only companion namespace for {@link (CompilerOptions:variable)}, exposing its
 * decoded and encoded shapes.
 *
 * @public
 */
export declare namespace CompilerOptions {
	/**
	 * The decoded `compilerOptions` shape: every typed field optional, plus passthrough for unknown keys.
	 *
	 * @public
	 */
	export type Type = typeof CompilerOptions.Type;
	/**
	 * The encoded (on-disk JSON) `compilerOptions` shape.
	 *
	 * @public
	 */
	export type Encoded = typeof CompilerOptions.Encoded;
}
