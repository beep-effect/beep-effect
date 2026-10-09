// The string↔numeric enum codec — PURE DATA. Every table is transcribed
// verbatim from TypeScript's enums, in row order: an alias immediately precedes the canonical spelling it collapses
// to, and the reverse (numeric→canonical string) map is built by iterating
// each family's rows in that same order and always overwriting on a
// duplicate value — so the LAST row listed for a given numeric value wins as
// canonical. That single rule reproduces every alias/canonical pairing
// (es6→es2015, node→node10) with no per-family special-casing.
//
// Zero `typescript` imports, including `import type` — the package's
// `CompilerOptions` is consumed type-only, and every value here is a plain
// map/Option lookup. No Schema: this module does no validation, only lossless
// numeric↔string data movement for values a schema already validated
// upstream (`CompilerOptions.ts`'s case-insensitive decode normalizes casing
// before a value ever reaches this codec).
//
// lib encode form (`encodeCompilerOptions`): emits the file-name form
// (`lib.esnext.d.ts`), NOT the plain short name. Settled at rung 2
// (existence/signature) against the installed `typescript@6.0.3` +
// `@typescript/vfs@1.6.4` (both under node_modules/.pnpm, 2026-07-13):
//
//   - `typescript@6.0.3`'s `Program` construction (`typescript.js:129392`,
//     `pathForLibFile`) resolves each `options.lib` entry with
//     `combinePaths(defaultLibraryPath, libFileName)` — i.e. it treats the
//     entry as a literal file name and joins it directly onto the lib
//     directory. A short name like "esnext" would resolve to a
//     nonexistent "<libdir>/esnext" path; only "lib.esnext.d.ts" resolves
//     to the real file. A virtual environment built on `@typescript/vfs`
//     hands `options.compilerOptions` straight to
//     `createVirtualTypeScriptEnvironment`, which hands it straight to
//     `ts.createProgram` — so this IS the form that reaches the real
//     compiler.
//   - `@typescript/vfs@1.6.4`'s OWN `knownLibFilesForCompilerOptions`
//     helper (used by `createDefaultMapFromNodeModules`, which
//     the virtual-environment helper also calls) separately expects the short form
//     for ITS OWN over-inclusive cut-index heuristic — but that helper's
//     doc comment says it "will return a bit more than necessary", so it
//     tolerates the mismatch by over-including rather than under-including
//     when handed the file-name form. The `Program`-level requirement
//     above is the one with no tolerance for the wrong form.
//   - Worked example:
//     `encodeCompilerOptions({ target: "es2023", strict: true, lib: ["esnext"] })`
//     → `{ target: 10, strict: true, lib: ["lib.esnext.d.ts"] }`.

import * as O from "effect/Option";
import type { CompilerOptions } from "./CompilerOptions.ts";

/**
 * The nine `compilerOptions` / `watchOptions` enum families this codec knows.
 *
 * @public
 */
export type EnumFamily =
	| "target"
	| "module"
	| "moduleResolution"
	| "jsx"
	| "newLine"
	| "moduleDetection"
	| "watchFile"
	| "watchDirectory"
	| "fallbackPolling";

/** One family's forward (string→number, aliases included) and reverse (number→canonical string) maps. */
interface FamilyTable {
	readonly forward: ReadonlyMap<string, number>;
	readonly reverse: ReadonlyMap<number, string>;
}

/**
 * Builds a family's forward/reverse maps from its row order. The
 * reverse map overwrites on every duplicate value, so the last-listed name
 * for a value is canonical.
 */
const buildTable = (rows: ReadonlyArray<readonly [name: string, value: number]>): FamilyTable => {
	const forward = new Map<string, number>();
	const reverse = new Map<number, string>();
	for (const [name, value] of rows) {
		forward.set(name, value);
		reverse.set(value, name);
	}
	return { forward, reverse };
};

// ── Tables, transcribed verbatim in row order ───────────────────────

/** ScriptTarget. Decode-only 0=es3 and 100=JSON have no forward string and are deliberately omitted. */
const TARGET = buildTable([
	["es5", 1],
	["es6", 2],
	["es2015", 2],
	["es2016", 3],
	["es2017", 4],
	["es2018", 5],
	["es2019", 6],
	["es2020", 7],
	["es2021", 8],
	["es2022", 9],
	["es2023", 10],
	["es2024", 11],
	["es2025", 12],
	["esnext", 99],
]);

/** ModuleKind. */
const MODULE = buildTable([
	["none", 0],
	["commonjs", 1],
	["amd", 2],
	["umd", 3],
	["system", 4],
	["es6", 5],
	["es2015", 5],
	["es2020", 6],
	["es2022", 7],
	["esnext", 99],
	["node16", 100],
	["node18", 101],
	["node20", 102],
	["nodenext", 199],
	["preserve", 200],
]);

/** ModuleResolutionKind. */
const MODULE_RESOLUTION = buildTable([
	["classic", 1],
	["node", 2],
	["node10", 2],
	["node16", 3],
	["nodenext", 99],
	["bundler", 100],
]);

/** JsxEmit. 0=none exists numerically but has no tsconfig string, so it is omitted. */
const JSX = buildTable([
	["preserve", 1],
	["react", 2],
	["react-native", 3],
	["react-jsx", 4],
	["react-jsxdev", 5],
]);

/** NewLineKind. */
const NEW_LINE = buildTable([
	["crlf", 0],
	["lf", 1],
]);

/** ModuleDetectionKind. */
const MODULE_DETECTION = buildTable([
	["legacy", 1],
	["auto", 2],
	["force", 3],
]);

/** WatchFileKind. */
const WATCH_FILE = buildTable([
	["fixedpollinginterval", 0],
	["prioritypollinginterval", 1],
	["dynamicprioritypolling", 2],
	["fixedchunksizepolling", 3],
	["usefsevents", 4],
	["usefseventsonparentdirectory", 5],
]);

/** WatchDirectoryKind. */
const WATCH_DIRECTORY = buildTable([
	["usefsevents", 0],
	["fixedpollinginterval", 1],
	["dynamicprioritypolling", 2],
	["fixedchunksizepolling", 3],
]);

/** PollingWatchKind (compilerOptions/watchOptions key `fallbackPolling`). */
const FALLBACK_POLLING = buildTable([
	["fixedinterval", 0],
	["priorityinterval", 1],
	["dynamicpriority", 2],
	["fixedchunksize", 3],
]);

const TABLES: Record<EnumFamily, FamilyTable> = {
	target: TARGET,
	module: MODULE,
	moduleResolution: MODULE_RESOLUTION,
	jsx: JSX,
	newLine: NEW_LINE,
	moduleDetection: MODULE_DETECTION,
	watchFile: WATCH_FILE,
	watchDirectory: WATCH_DIRECTORY,
	fallbackPolling: FALLBACK_POLLING,
};

// Implementation of TsEnumCodec.encode; the public contract lives on the static.
const encode = (family: EnumFamily, value: string): O.Option<number> =>
	O.fromNullishOr(TABLES[family].forward.get(value));

// Implementation of TsEnumCodec.decode; the public contract lives on the static.
const decode = (family: EnumFamily, value: number): O.Option<string> =>
	O.fromNullishOr(TABLES[family].reverse.get(value));

// Implementation of TsEnumCodec.normalizeLibReference; the public contract lives on the static.
const normalizeLibReference = (lib: string): string => {
	const base = (lib.split("/").pop() ?? lib).toLowerCase();
	const withoutPrefix = base.startsWith("lib.") ? base.slice(4) : base;
	return withoutPrefix.endsWith(".d.ts") ? withoutPrefix.slice(0, -5) : withoutPrefix;
};

/** `compilerOptions` keys whose values are one of the enum families. */
const COMPILER_OPTION_ENUM_KEYS: ReadonlyArray<readonly [key: string, family: EnumFamily]> = [
	["target", "target"],
	["module", "module"],
	["moduleResolution", "moduleResolution"],
	["jsx", "jsx"],
	["newLine", "newLine"],
	["moduleDetection", "moduleDetection"],
];

/**
 * A single value a programmatic `compilerOptions` entry can hold — a
 * structural transcription of TypeScript's own `CompilerOptionsValue`,
 * transcribed (not imported) to honor this package's zero-`typescript` rule.
 *
 * Transcribed verbatim from `typescript@6.0.3`'s
 * `node_modules/typescript/lib/typescript.d.ts` (the version `@typescript/vfs@1.6.4`,
 * the encode target's consumer, pins):
 *
 * ```ts
 * type CompilerOptionsValue = string | number | boolean | (string | number)[]
 *   | string[] | MapLike<string[]> | PluginImport[] | ProjectReference[]
 *   | null | undefined;
 * interface MapLike<T> { [index: string]: T }
 * interface PluginImport { name: string }
 * interface ProjectReference { path: string; originalPath?: string; prepend?: boolean; circular?: boolean }
 * ```
 *
 * The one member deliberately omitted is `TsConfigSourceFile` (present only in
 * the interface's index signature, not `CompilerOptionsValue` itself): it is a
 * full parsed-AST node the compiler synthesizes, never a value reachable from
 * JSON, so it cannot appear in options this codec builds. Omitting it keeps the
 * union a strict structural subset of the compiler's own index-signature value
 * type, which is what assignability to `ts.CompilerOptions` requires. Arrays
 * are intentionally mutable (`string[]`, not `readonly string[]`): TypeScript's
 * mutable array members are not assignable from a `readonly` array, and the one
 * narrowing below reconciles this with the codec's actual `readonly`-array
 * outputs.
 *
 * @public
 */
export type ProgrammaticCompilerOptionsValue =
	| string
	| number
	| boolean
	| (string | number)[]
	| string[]
	| { readonly [index: string]: string[] }
	| { readonly name: string }[]
	| { readonly path: string; readonly originalPath?: string; readonly prepend?: boolean; readonly circular?: boolean }[]
	| null
	| undefined;

/**
 * The shape {@link TsEnumCodec.encodeCompilerOptions} returns: the
 * numeric-enum-encoded `compilerOptions` a virtual-TS environment and the
 * TypeScript compiler API consume programmatically.
 *
 * It is deliberately shaped to be assignable to TypeScript's `ts.CompilerOptions`
 * without naming it (the zero-`typescript` rule), so a consumer handing the
 * result to `@typescript/vfs`'s `createVirtualTypeScriptEnvironment` /
 * `createDefaultMapFromNodeModules` or to `ts.createProgram` no longer ends the
 * pipeline with a cast. Verified assignable to the real `ts.CompilerOptions`
 * (`typescript@6.0.3`, `@typescript/vfs@1.6.4`) by a compile-time test
 * (`__test__/TsEnumCodec.assignability.test.ts`).
 *
 * What it honestly **claims**: the six enum-family keys read back as `number`
 * (they are always encoded — a decoded `CompilerOptions.Type` constrains each
 * to a spelling the codec's tables cover, so the runtime "unknown string passes
 * through unencoded" branch is unreachable for a well-typed input); `lib` reads
 * back as `string[]` (the file-name form); every other value is one of the
 * structural forms `ts.CompilerOptions` accepts.
 *
 * What it does **not** prove: that an arbitrary passthrough value carried
 * through from JSONC (the schema preserves unknown keys as `unknown`) fits
 * {@link ProgrammaticCompilerOptionsValue}. Neither does `ts.CompilerOptions`:
 * its own index signature makes the identical unproven claim, and any consumer
 * feeding parsed tsconfig to `ts.createProgram` relies on it. The single
 * narrowing that bridges the codec's `unknown`/`readonly` outputs to this type
 * lives once, at `encodeCompilerOptions`'s return (below), so the assertion is
 * owned here rather than re-made at every call site.
 *
 * @public
 */
export interface ProgrammaticCompilerOptions {
	readonly [option: string]: ProgrammaticCompilerOptionsValue;
	readonly target?: number;
	readonly module?: number;
	readonly moduleResolution?: number;
	readonly jsx?: number;
	readonly newLine?: number;
	readonly moduleDetection?: number;
	readonly lib?: string[];
}

// Implementation of TsEnumCodec.encodeCompilerOptions; the public contract lives on the static.
const encodeCompilerOptions = (options: CompilerOptions.Type): ProgrammaticCompilerOptions => {
	const source: Readonly<Record<string, unknown>> = options;
	const result: Record<string, unknown> = { ...source };

	for (const [key, family] of COMPILER_OPTION_ENUM_KEYS) {
		const value = source[key];
		if (typeof value === "string") {
			const encoded = encode(family, value);
			if (O.isSome(encoded)) result[key] = encoded.value;
		}
	}

	const lib = source.lib;
	if (Array.isArray(lib)) {
		result.lib = lib.map((entry) => (typeof entry === "string" ? `lib.${normalizeLibReference(entry)}.d.ts` : entry));
	}

	// The single documented narrowing (see ProgrammaticCompilerOptions): the
	// result's values are `unknown`/`readonly` here, but structurally satisfy
	// the tsc-assignable value union — asserted once, so consumers do not cast.
	return result as ProgrammaticCompilerOptions;
};

// Implementation of TsEnumCodec.decodeCompilerOptions; the public contract lives on the static.
const decodeCompilerOptions = (numeric: Readonly<Record<string, unknown>>): Record<string, unknown> => {
	const result: Record<string, unknown> = { ...numeric };

	for (const [key, family] of COMPILER_OPTION_ENUM_KEYS) {
		const value = numeric[key];
		if (typeof value === "number") {
			const decoded = decode(family, value);
			if (O.isSome(decoded)) result[key] = decoded.value;
		}
	}

	const lib = numeric.lib;
	if (Array.isArray(lib)) {
		result.lib = lib.map((entry) => (typeof entry === "string" ? normalizeLibReference(entry) : entry));
	}

	return result;
};

/**
 * The string↔numeric enum codec for `compilerOptions` / `watchOptions`
 * families. Plain data: every lookup is a synchronous map read
 * returning `Option.Option`, never a thrown error.
 *
 * @public
 */
export class TsEnumCodec {
	private constructor() {}

	/**
	 * Encodes a family's canonical (or alias) string spelling to its numeric
	 * form. `Option.none()` for a string with no table entry — never guessed.
	 */
	static readonly encode = encode;

	/**
	 * Decodes a family's numeric value to its canonical string spelling.
	 * `Option.none()` for a numeric value with no table entry (a future TS
	 * enum member) — never guessed.
	 */
	static readonly decode = decode;

	/**
	 * Normalizes any spelling of a `lib` reference — the plain short name
	 * (`esnext`), the on-disk file name (`lib.esnext.d.ts`), or an absolute
	 * path to one (`/…/typescript/lib/lib.dom.iterable.d.ts`) — to the
	 * canonical lowercase short name (`esnext`, `dom.iterable`). Strips a
	 * leading directory, the `lib.` prefix and the `.d.ts` suffix; idempotent
	 * on an already-short name.
	 */
	static readonly normalizeLibReference = normalizeLibReference;

	/**
	 * Encodes a decoded `compilerOptions` object into the
	 * numeric-enum-shaped {@link ProgrammaticCompilerOptions} form
	 * `ts.CompilerOptions` (and `@typescript/vfs`'s virtual environment) expect:
	 * every enum family becomes its numeric value, and `lib` entries
	 * become the file-name form (`lib.esnext.d.ts`) — see the module banner
	 * for the evidence. Every other key (booleans, strings, arrays, unknown
	 * passthrough keys) is copied through untouched.
	 *
	 * @remarks
	 * The return carries this package's single narrowing from the codec's
	 * internal `Record<string, unknown>` (whose values include the schema's
	 * `unknown` passthrough and its `readonly` arrays) to
	 * {@link ProgrammaticCompilerOptions} — see that type's docs for why the
	 * package owns this one assertion instead of leaving every consumer to
	 * cast. Runtime behavior is unchanged; only the declared return type
	 * narrows.
	 */
	static readonly encodeCompilerOptions = encodeCompilerOptions;

	/**
	 * Decodes a numeric-enum-shaped `compilerOptions` object (as produced by
	 * {@link TsEnumCodec.encodeCompilerOptions} or read off a live
	 * `ts.CompilerOptions`) back into the string-enum shape this package's
	 * schemas use: every enum family becomes its canonical string, and
	 * `lib` entries become the short form. A numeric value with no table
	 * entry — a future TS enum member — is left as-is (passthrough, never an
	 * error) — which is why the return type stays the wider
	 * `Record<string, unknown>` rather than
	 * {@link (CompilerOptions:namespace).Type}: an unmappable passthrough
	 * value would violate that narrower type's contract. Every other key is
	 * copied through untouched.
	 */
	static readonly decodeCompilerOptions = decodeCompilerOptions;
}
