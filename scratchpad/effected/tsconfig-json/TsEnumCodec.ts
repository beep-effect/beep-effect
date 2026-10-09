// The string↔numeric enum codec — PURE DATA. Every table is transcribed
// verbatim from TypeScript's enums, in row order: an alias immediately precedes the canonical spelling it collapses
// to, and the reverse (numeric→canonical string) map is built by iterating
// each family's rows in that same order and always overwriting on a
// duplicate value — so the LAST row listed for a given numeric value wins as
// canonical. That single rule reproduces every alias/canonical pairing
// (es6→es2015, node→node10) with no per-family special-casing.
//
// Zero `typescript` imports, including `import type` — the package's
// `CompilerOptions` is consumed type-only. The output schema describes the
// programmatic shape; the codec functions use plain map/Option lookups and
// perform no validation, only lossless
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

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as MutableHashMap from "effect/MutableHashMap";
import * as S from "effect/Schema";
import type { CompilerOptions } from "./CompilerOptions.ts";
import * as A from "effect/Array";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/tsconfig-json/TsEnumCodec");

/**
 * The nine `compilerOptions` / `watchOptions` enum families this codec knows.
 *
 * @public
 */
const EnumFamily = LiteralKit([
	"target",
	"module",
	"moduleResolution",
	"jsx",
	"newLine",
	"moduleDetection",
	"watchFile",
	"watchDirectory",
	"fallbackPolling",
]).annotate($I.annote("EnumFamily", { description: "The compiler and watcher enum families supported by the numeric codec." }));

/**
 * The supported compiler-option and watcher enum-family names.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EnumFamily = typeof EnumFamily.Type;

/** One family's forward (string→number, aliases included) and reverse (number→canonical string) maps. */
interface FamilyTable {
	readonly forward: MutableHashMap.MutableHashMap<string, number>;
	readonly reverse: MutableHashMap.MutableHashMap<number, string>;
}

/**
 * Builds a family's forward/reverse maps from its row order. The
 * reverse map overwrites on every duplicate value, so the last-listed name
 * for a value is canonical.
 */
const buildTable = (rows: ReadonlyArray<readonly [name: string, value: number]>): FamilyTable => {
	const forward = MutableHashMap.empty<string, number>();
	const reverse = MutableHashMap.empty<number, string>();
	for (const [name, value] of rows) {
		MutableHashMap.set(forward, name, value);
		MutableHashMap.set(reverse, value, name);
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
const encode: {
	(value: string): (family: EnumFamily) => O.Option<number>;
	(family: EnumFamily, value: string): O.Option<number>;
} = dual(2, (family: EnumFamily, value: string): O.Option<number> =>
	MutableHashMap.get(TABLES[family].forward, value),
);

// Implementation of TsEnumCodec.decode; the public contract lives on the static.
const decode: {
	(value: number): (family: EnumFamily) => O.Option<string>;
	(family: EnumFamily, value: number): O.Option<string>;
} = dual(2, (family: EnumFamily, value: number): O.Option<string> =>
	MutableHashMap.get(TABLES[family].reverse, value),
);

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
 * The values accepted by TypeScript's compiler API — a structural
 * transcription of TypeScript's own `CompilerOptionsValue`,
 * transcribed (not imported) to honor this package's zero-`typescript` rule.
 *
 * **Details**
 *
 * Transcribed verbatim from `typescript@6.0.3`'s
 * `node_modules/typescript/lib/typescript.d.ts` (the version `@typescript/vfs@1.6.4`,
 * the encode target's consumer, pins). The Example below retains that transcription.
 *
 * The one member deliberately omitted is `TsConfigSourceFile` (present only in
 * the interface's index signature, not `CompilerOptionsValue` itself): it is a
 * full parsed-AST node the compiler synthesizes, never a value reachable from
 * JSON, so it cannot appear in options this codec builds. Omitting it keeps the
 * union a strict structural subset of the compiler's own index-signature value
 * type. Arrays are intentionally mutable (`string[]`, not `readonly string[]`)
 * to describe that API's accepted values. This union does not describe every
 * value returned by {@link TsEnumCodec.encodeCompilerOptions}: unknown options
 * and readonly arrays pass through unchanged.
 *
 * **Example** (Describe the transcribed compiler API value union)
 *
 * ```ts
 * import type { ProgrammaticCompilerOptionsValue } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
 *
 * type CompilerOptionsValue = string | number | boolean | (string | number)[]
 *   | string[] | MapLike<string[]> | PluginImport[] | ProjectReference[]
 *   | null | undefined;
 * interface MapLike<T> { [index: string]: T }
 * interface PluginImport { name: string }
 * interface ProjectReference { path: string; originalPath?: string; prepend?: boolean; circular?: boolean }
 *
 * const value: CompilerOptionsValue = "compiler-plugin";
 * const accepted: ProgrammaticCompilerOptionsValue = value;
 * console.log(accepted) // compiler-plugin
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
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
 * The numeric-enum-encoded output of {@link TsEnumCodec.encodeCompilerOptions},
 * including unknown passthrough options.
 *
 * **Details**
 *
 * The six enum-family keys are optional numbers and `lib` is an optional mutable
 * string array containing file names. Other values remain `unknown`, matching
 * {@link (CompilerOptions:namespace).Type}'s passthrough contract. The encoder
 * copies those values without validation or conversion, including readonly
 * arrays and objects outside {@link ProgrammaticCompilerOptionsValue}.
 * Consumers of TypeScript's narrower `ts.CompilerOptions` must validate or
 * select the values their boundary accepts.
 *
 * **Example** (Accept an unknown compiler option)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ProgrammaticCompilerOptions } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
 *
 * console.log(S.is(ProgrammaticCompilerOptions)({ target: 10, futureOption: { enabled: true } })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ProgrammaticCompilerOptions = S.StructWithRest(
	S.Struct({
		target: S.optionalKey(S.Finite).annotateKey({ description: "The numeric TypeScript target enum value." }),
		module: S.optionalKey(S.Finite).annotateKey({ description: "The numeric TypeScript module enum value." }),
		moduleResolution: S.optionalKey(S.Finite).annotateKey({ description: "The numeric TypeScript moduleResolution enum value." }),
		jsx: S.optionalKey(S.Finite).annotateKey({ description: "The numeric TypeScript jsx enum value." }),
		newLine: S.optionalKey(S.Finite).annotateKey({ description: "The numeric TypeScript newLine enum value." }),
		moduleDetection: S.optionalKey(S.Finite).annotateKey({ description: "The numeric TypeScript moduleDetection enum value." }),
		lib: S.String.pipe(S.Array, S.mutable, S.optionalKey).annotateKey({ description: "The standard library file names included in compilation." }),
	}),
	[S.Record(S.String, S.Unknown)],
).annotate($I.annote("ProgrammaticCompilerOptions", {
	title: "Programmatic Compiler Options",
	description: "Numeric compiler option enums and library file names with unknown options preserved.",
}));

/**
 * Programmatic compiler options with unknown passthrough values.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProgrammaticCompilerOptions = typeof ProgrammaticCompilerOptions.Type;

// Implementation of TsEnumCodec.encodeCompilerOptions; the public contract lives on the static.
const encodeCompilerOptions = (options: CompilerOptions.Type): ProgrammaticCompilerOptions => {
	const source: Readonly<Record<string, unknown>> = options;
	const result: Record<string, unknown> = { ...source };

	for (const [key, family] of COMPILER_OPTION_ENUM_KEYS) {
		const value = source[key];
		if (P.isString(value)) {
			const encoded = encode(family, value);
			if (O.isSome(encoded)) result[key] = encoded.value;
		}
	}

	const lib = source.lib;
	if (A.isArray(lib)) {
		result.lib = lib.map((entry) => (P.isString(entry) ? `lib.${normalizeLibReference(entry)}.d.ts` : entry));
	}

	return result;
};

// Implementation of TsEnumCodec.decodeCompilerOptions; the public contract lives on the static.
const decodeCompilerOptions = (numeric: Readonly<Record<string, unknown>>): Record<string, unknown> => {
	const result: Record<string, unknown> = { ...numeric };

	for (const [key, family] of COMPILER_OPTION_ENUM_KEYS) {
		const value = numeric[key];
		if (P.isNumber(value)) {
			const decoded = decode(family, value);
			if (O.isSome(decoded)) result[key] = decoded.value;
		}
	}

	const lib = numeric.lib;
	if (A.isArray(lib)) {
		result.lib = lib.map((entry) => (P.isString(entry) ? normalizeLibReference(entry) : entry));
	}

	return result;
};

/**
 * The string↔numeric enum codec for `compilerOptions` / `watchOptions`
 * families. Plain data: every lookup is a synchronous map read
 * returning `Option.Option`, never a thrown error.
 *
 * **Example** (Encode an alias and decode its canonical spelling)
 *
 * ```ts
 * import { TsEnumCodec } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrUndefined(TsEnumCodec.encode("target", "es6"))) // 2
 * console.log(O.getOrUndefined(TsEnumCodec.decode("target", 2))) // es2015
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export class TsEnumCodec {
	private constructor() {}

	/**
	 * Encodes a family's canonical (or alias) string spelling to its numeric
	 * form. `Option.none()` for a string with no table entry — never guessed.
	 *
	 * **Example** (Encode known and unknown enum spellings)
	 *
	 * ```ts
	 * import { TsEnumCodec } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
	 * import * as O from "effect/Option";
	 *
	 * console.log(O.getOrUndefined(TsEnumCodec.encode("moduleResolution", "node"))) // 2
	 * console.log(O.isNone(TsEnumCodec.encode("target", "future-target"))) // true
	 * ```
	 *
	 * @category encoding
	 * @since 0.0.0
	 */
	static readonly encode = encode;

	/**
	 * Decodes a family's numeric value to its canonical string spelling.
	 * `Option.none()` for a numeric value with no table entry (a future TS
	 * enum member) — never guessed.
	 *
	 * **Example** (Decode canonical and unknown numeric enums)
	 *
	 * ```ts
	 * import { TsEnumCodec } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
	 * import * as O from "effect/Option";
	 *
	 * console.log(O.getOrUndefined(TsEnumCodec.decode("moduleResolution", 2))) // node10
	 * console.log(O.isNone(TsEnumCodec.decode("target", 12345))) // true
	 * ```
	 *
	 * @category decoding
	 * @since 0.0.0
	 */
	static readonly decode = decode;

	/**
	 * Normalizes each supported spelling of a `lib` reference — the plain short name
	 * (`esnext`), the on-disk file name (`lib.esnext.d.ts`), or an absolute
	 * path to one (`/…/typescript/lib/lib.dom.iterable.d.ts`) — to the
	 * canonical lowercase short name (`esnext`, `dom.iterable`). Strips a
	 * leading directory, the `lib.` prefix and the `.d.ts` suffix; idempotent
	 * on an already-short name.
	 *
	 * **Example** (Normalize library filenames and short names)
	 *
	 * ```ts
	 * import { TsEnumCodec } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
	 *
	 * console.log(TsEnumCodec.normalizeLibReference("/typescript/lib/lib.DOM.Iterable.d.ts")) // dom.iterable
	 * console.log(TsEnumCodec.normalizeLibReference("esnext")) // esnext
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
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
	 * **Details**
	 *
	 * Passthrough values remain `unknown` in the return type. Encoding does not
	 * establish assignability to TypeScript's narrower `ts.CompilerOptions`.
	 *
	 * **Example** (Encode compiler enums and library filenames)
	 *
	 * ```ts
	 * import { TsEnumCodec } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
	 *
	 * const encoded = TsEnumCodec.encodeCompilerOptions({ target: "es2023", strict: true, lib: ["esnext"] });
	 * console.log(encoded.target) // 10
	 * console.log(encoded.lib?.[0]) // lib.esnext.d.ts
	 * console.log(encoded.strict) // true
	 * ```
	 *
	 * @category encoding
	 * @since 0.0.0
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
	 *
	 * **Example** (Decode libraries while preserving future enum values)
	 *
	 * ```ts
	 * import { TsEnumCodec } from "@beep/scratchpad/effected/tsconfig-json/TsEnumCodec";
	 *
	 * const decoded = TsEnumCodec.decodeCompilerOptions({ target: 10, module: 12345, lib: ["lib.esnext.d.ts"] });
	 * console.log(decoded.target) // es2023
	 * console.log(decoded.module) // 12345
	 * console.log(JSON.stringify(decoded.lib)) // ["esnext"]
	 * ```
	 *
	 * @category decoding
	 * @since 0.0.0
	 */
	static readonly decodeCompilerOptions = decodeCompilerOptions;
}
