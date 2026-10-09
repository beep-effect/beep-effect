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

import { Schema, SchemaTransformation } from "effect";

/**
 * Case-insensitive literal-union decode; canonical lowercase encode. Module-
 * internal — every exported enum schema below is built
 * from it, but the helper itself is not part of the public surface.
 */
const caseInsensitiveLiterals = <const L extends ReadonlyArray<string>>(literals: L) =>
	Schema.String.pipe(
		Schema.decodeTo(
			Schema.Literals(literals),
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
const IgnoreDeprecations = Schema.Literals(["5.0", "6.0"]);

/**
 * One `compilerOptions.plugins[]` entry: `name` is required and typed; every
 * other key is preserved verbatim (ts-plugin authors attach arbitrary extra
 * configuration).
 */
const PluginEntry = Schema.StructWithRest(Schema.Struct({ name: Schema.String }), [
	Schema.Record(Schema.String, Schema.Unknown),
]);

/**
 * `compilerOptions`, decoded as every live boolean, string, path, array,
 * record, number and enum field — each `optionalKey` — intersected with a
 * passthrough record so unknown and removed keys survive decode and re-encode
 * untouched, which keeps the schema tolerant of newer compiler options.
 *
 * @public
 */
export const CompilerOptions = Schema.StructWithRest(
	Schema.Struct({
		// ── Enum-valued options ─────────────────────────────────────
		target: Schema.optionalKey(Target),
		module: Schema.optionalKey(Module),
		moduleResolution: Schema.optionalKey(ModuleResolution),
		jsx: Schema.optionalKey(Jsx),
		newLine: Schema.optionalKey(NewLine),
		moduleDetection: Schema.optionalKey(ModuleDetection),
		lib: Schema.optionalKey(Schema.Array(Lib)),
		ignoreDeprecations: Schema.optionalKey(IgnoreDeprecations),

		// ── Boolean options — live typed set ─────
		strict: Schema.optionalKey(Schema.Boolean),
		noImplicitAny: Schema.optionalKey(Schema.Boolean),
		strictNullChecks: Schema.optionalKey(Schema.Boolean),
		strictFunctionTypes: Schema.optionalKey(Schema.Boolean),
		strictBindCallApply: Schema.optionalKey(Schema.Boolean),
		strictPropertyInitialization: Schema.optionalKey(Schema.Boolean),
		strictBuiltinIteratorReturn: Schema.optionalKey(Schema.Boolean),
		noImplicitThis: Schema.optionalKey(Schema.Boolean),
		useUnknownInCatchVariables: Schema.optionalKey(Schema.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		alwaysStrict: Schema.optionalKey(Schema.Boolean),
		noUnusedLocals: Schema.optionalKey(Schema.Boolean),
		noUnusedParameters: Schema.optionalKey(Schema.Boolean),
		exactOptionalPropertyTypes: Schema.optionalKey(Schema.Boolean),
		noImplicitReturns: Schema.optionalKey(Schema.Boolean),
		noFallthroughCasesInSwitch: Schema.optionalKey(Schema.Boolean),
		noUncheckedIndexedAccess: Schema.optionalKey(Schema.Boolean),
		noImplicitOverride: Schema.optionalKey(Schema.Boolean),
		noPropertyAccessFromIndexSignature: Schema.optionalKey(Schema.Boolean),
		allowUnusedLabels: Schema.optionalKey(Schema.Boolean),
		allowUnreachableCode: Schema.optionalKey(Schema.Boolean),
		noUncheckedSideEffectImports: Schema.optionalKey(Schema.Boolean),
		allowJs: Schema.optionalKey(Schema.Boolean),
		checkJs: Schema.optionalKey(Schema.Boolean),
		resolveJsonModule: Schema.optionalKey(Schema.Boolean),
		allowArbitraryExtensions: Schema.optionalKey(Schema.Boolean),
		allowImportingTsExtensions: Schema.optionalKey(Schema.Boolean),
		rewriteRelativeImportExtensions: Schema.optionalKey(Schema.Boolean),
		resolvePackageJsonExports: Schema.optionalKey(Schema.Boolean),
		resolvePackageJsonImports: Schema.optionalKey(Schema.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		allowSyntheticDefaultImports: Schema.optionalKey(Schema.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0 when set to `false`. */
		esModuleInterop: Schema.optionalKey(Schema.Boolean),
		preserveSymlinks: Schema.optionalKey(Schema.Boolean),
		allowUmdGlobalAccess: Schema.optionalKey(Schema.Boolean),
		verbatimModuleSyntax: Schema.optionalKey(Schema.Boolean),
		isolatedModules: Schema.optionalKey(Schema.Boolean),
		isolatedDeclarations: Schema.optionalKey(Schema.Boolean),
		erasableSyntaxOnly: Schema.optionalKey(Schema.Boolean),
		forceConsistentCasingInFileNames: Schema.optionalKey(Schema.Boolean),
		declaration: Schema.optionalKey(Schema.Boolean),
		declarationMap: Schema.optionalKey(Schema.Boolean),
		emitDeclarationOnly: Schema.optionalKey(Schema.Boolean),
		sourceMap: Schema.optionalKey(Schema.Boolean),
		inlineSourceMap: Schema.optionalKey(Schema.Boolean),
		inlineSources: Schema.optionalKey(Schema.Boolean),
		removeComments: Schema.optionalKey(Schema.Boolean),
		importHelpers: Schema.optionalKey(Schema.Boolean),
		/** @deprecated Deprecated in TypeScript 6.0. */
		downlevelIteration: Schema.optionalKey(Schema.Boolean),
		emitBOM: Schema.optionalKey(Schema.Boolean),
		noEmit: Schema.optionalKey(Schema.Boolean),
		noEmitHelpers: Schema.optionalKey(Schema.Boolean),
		noEmitOnError: Schema.optionalKey(Schema.Boolean),
		preserveConstEnums: Schema.optionalKey(Schema.Boolean),
		stripInternal: Schema.optionalKey(Schema.Boolean),
		experimentalDecorators: Schema.optionalKey(Schema.Boolean),
		emitDecoratorMetadata: Schema.optionalKey(Schema.Boolean),
		useDefineForClassFields: Schema.optionalKey(Schema.Boolean),
		noCheck: Schema.optionalKey(Schema.Boolean),
		composite: Schema.optionalKey(Schema.Boolean),
		incremental: Schema.optionalKey(Schema.Boolean),
		disableSourceOfProjectReferenceRedirect: Schema.optionalKey(Schema.Boolean),
		disableSolutionSearching: Schema.optionalKey(Schema.Boolean),
		disableReferencedProjectLoad: Schema.optionalKey(Schema.Boolean),
		assumeChangesOnlyAffectDirectDependencies: Schema.optionalKey(Schema.Boolean),
		noErrorTruncation: Schema.optionalKey(Schema.Boolean),
		noLib: Schema.optionalKey(Schema.Boolean),
		noResolve: Schema.optionalKey(Schema.Boolean),
		skipDefaultLibCheck: Schema.optionalKey(Schema.Boolean),
		skipLibCheck: Schema.optionalKey(Schema.Boolean),
		diagnostics: Schema.optionalKey(Schema.Boolean),
		extendedDiagnostics: Schema.optionalKey(Schema.Boolean),
		listFiles: Schema.optionalKey(Schema.Boolean),
		listFilesOnly: Schema.optionalKey(Schema.Boolean),
		listEmittedFiles: Schema.optionalKey(Schema.Boolean),
		explainFiles: Schema.optionalKey(Schema.Boolean),
		traceResolution: Schema.optionalKey(Schema.Boolean),
		preserveWatchOutput: Schema.optionalKey(Schema.Boolean),
		pretty: Schema.optionalKey(Schema.Boolean),
		disableSizeLimit: Schema.optionalKey(Schema.Boolean),
		libReplacement: Schema.optionalKey(Schema.Boolean),
		stableTypeOrdering: Schema.optionalKey(Schema.Boolean),

		// ── Path strings ─────────────────────────────────────────────
		/** @deprecated Deprecated in TypeScript 6.0. */
		outFile: Schema.optionalKey(Schema.String),
		outDir: Schema.optionalKey(Schema.String),
		rootDir: Schema.optionalKey(Schema.String),
		declarationDir: Schema.optionalKey(Schema.String),
		sourceRoot: Schema.optionalKey(Schema.String),
		mapRoot: Schema.optionalKey(Schema.String),
		tsBuildInfoFile: Schema.optionalKey(Schema.String),
		/** @deprecated Deprecated in TypeScript 6.0. */
		baseUrl: Schema.optionalKey(Schema.String),
		generateCpuProfile: Schema.optionalKey(Schema.String),
		generateTrace: Schema.optionalKey(Schema.String),

		// ── Path lists ───────────────────────────────────────────────
		typeRoots: Schema.optionalKey(Schema.Array(Schema.String)),
		rootDirs: Schema.optionalKey(Schema.Array(Schema.String)),

		// ── Plain strings ────────────────────────────────────────────
		jsxFactory: Schema.optionalKey(Schema.String),
		jsxFragmentFactory: Schema.optionalKey(Schema.String),
		jsxImportSource: Schema.optionalKey(Schema.String),
		reactNamespace: Schema.optionalKey(Schema.String),

		// ── String lists ─────────────────────────────────────────────
		types: Schema.optionalKey(Schema.Array(Schema.String)),
		customConditions: Schema.optionalKey(Schema.Array(Schema.String)),
		moduleSuffixes: Schema.optionalKey(Schema.Array(Schema.String)),

		// ── Record ────────────────────────────────────────────────────
		paths: Schema.optionalKey(Schema.Record(Schema.String, Schema.Array(Schema.String))),

		// ── Objects ───────────────────────────────────────────────────
		plugins: Schema.optionalKey(Schema.Array(PluginEntry)),

		// ── Number ────────────────────────────────────────────────────
		maxNodeModuleJsDepth: Schema.optionalKey(Schema.Number),
	}),
	[Schema.Record(Schema.String, Schema.Unknown)],
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
