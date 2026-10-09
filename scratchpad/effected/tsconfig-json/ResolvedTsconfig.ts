// The pure extends-merge engine — reproduces tsc's `extends` merge semantics
// and its path absolutization as plain string transforms over
// already-decoded `TsconfigJson.Type` documents. No FileSystem, no Path service:
// `absolutize` takes an injected `join` (the call site passes `Path.Path.resolve`)
// and `merge`/`substituteConfigDir` operate on internal forward-slash path
// helpers, so the module never reaches into `R`.
//
// The loader drives the three phases per tsc: absolutize each config at
// parse time against its own directory; fold the chain with `merge`, own config
// last; then run `substituteConfigDir` once against the final config's directory.
//
// PATH CONVENTION: `merge`/`substituteConfigDir` assume normalized, absolute
// forward-slash paths (tsc's internal convention) — the loader normalizes before
// calling. `dirname`/`relative`/`isAbsolutePath` are pure POSIX string ops on
// that convention, which keeps the module IO-free while matching tsc's behavior.

import { $ScratchpadId } from "@beep/identity/packages";
import { CompilerOptions } from "./CompilerOptions.ts";
import { Reference, type TsconfigJson, TypeAcquisition, WatchOptions } from "./TsconfigJson.ts";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as HashSet from "effect/HashSet";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/tsconfig-json/ResolvedTsconfig");

/**
 * The result of resolving a tsconfig.json's full `extends` chain: the merged
 * compiler options and inherited settings, flattened the way tsc does, with enough
 * provenance for the consumer (`configPath`, `extendedPaths`, and `pathsBase`,
 * the directory of the config that declared `paths`). Unknown top-level keys
 * survive as passthrough via the index signature.
 *
 * @public
 */
const ResolvedTsconfigData = S.StructWithRest(S.Struct({
	/** The own (most-derived) config's path — the last of {@link (ResolvedTsconfig:interface).extendedPaths}. */
	configPath: S.String.annotateKey({ description: "The own, most-derived config path." }),
	/** The full resolution chain, base-most first and own config last. */
	extendedPaths: S.Array(S.String).annotateKey({ description: "The resolution chain, base-most first." }),
	/** The per-key merged compiler options (derived wins; `paths` replaced wholesale). */
	compilerOptions: S.toType(CompilerOptions).annotateKey({ description: "Per-key merged compiler options." }),
	/** The resolved `files`, if any config in the chain declared it. */
	files: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Resolved files, when declared." }),
	/** The resolved `include`, if any config in the chain declared it. */
	include: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Resolved include entries, when declared." }),
	/** The resolved `exclude`, if any config in the chain declared it. */
	exclude: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Resolved exclude entries, when declared." }),
	/** The own config's `references` (never inherited). */
	references: Reference.pipe(S.toType, S.Array, S.optionalKey).annotateKey({ description: "The own config's references." }),
	/** The per-key merged `watchOptions`. */
	watchOptions: WatchOptions.pipe(S.toType, S.optionalKey).annotateKey({ description: "Per-key merged watch options." }),
	/** The own config's `typeAcquisition` (never inherited). */
	typeAcquisition: TypeAcquisition.pipe(S.toType, S.optionalKey).annotateKey({ description: "The own config's type acquisition." }),
	/** `compileOnSave`, inherited only when own is undefined and the inherited value is truthy. */
	compileOnSave: S.optionalKey(S.Boolean).annotateKey({ description: "The inherited or own compile-on-save flag." }),
	/** The directory of the config that declared `paths`, against which `paths` values resolve. */
	pathsBase: S.optionalKey(S.String).annotateKey({ description: "The directory of the config declaring paths." }),
}), [S.Record(S.String, S.Unknown)]).annotate($I.annote("ResolvedTsconfig", {
	description: "A resolved tsconfig extends chain with provenance and unknown-key passthrough.",
}));

// ── The `${configDir}` template ────────────────────────────────────────

const CONFIG_DIR_TEMPLATE = `\${configDir}`;
const CONFIG_DIR_TEMPLATE_LOWER = CONFIG_DIR_TEMPLATE.toLowerCase();

/** A value is `${configDir}`-prefixed if its leading token matches case-insensitively. */
const startsWithConfigDir = (value: string): boolean =>
	value.slice(0, CONFIG_DIR_TEMPLATE.length).toLowerCase() === CONFIG_DIR_TEMPLATE_LOWER;

// ── Pure path helpers (forward-slash POSIX convention) ──────────────────────

const normalizeSlashes = (p: string): string => p.replace(/\\/g, "/");

/** POSIX `dirname` over the normalized path; a rootless path yields `"."`. */
const dirname = (p: string): string => {
	const norm = normalizeSlashes(p);
	const idx = norm.lastIndexOf("/");
	if (idx < 0) return ".";
	if (idx === 0) return "/";
	return norm.slice(0, idx);
};

/** POSIX relative path from directory `from` to directory `to`. */
const relative = (from: string, to: string): string => {
	const f = normalizeSlashes(from)
		.split("/")
		.filter((s) => s.length > 0);
	const t = normalizeSlashes(to)
		.split("/")
		.filter((s) => s.length > 0);
	let i = 0;
	while (i < f.length && i < t.length && f[i] === t[i]) i++;
	const segments = [...f.slice(i).map(() => ".."), ...t.slice(i)];
	return segments.join("/");
};

/** True for POSIX-rooted, Windows-drive-rooted, and UNC paths. */
const isAbsolutePath = (p: string): boolean => p.startsWith("/") || p.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(p);

// ── Safe record rebuilding (untrusted keys) ─────────────────────────────────

/**
 * Rebuild a record, mapping each value, using `defineProperty` so an own
 * `__proto__` key is written as data rather than triggering the prototype
 * setter. Preserves every own key (forward tolerance) without pollution.
 */
const rebuildRecord = <Value>(
	source: Record<string, Value>,
	mapValue: (key: string, value: Value | undefined) => Value | undefined,
): Record<string, Value> => {
	const out: Record<string, Value> = {};
	for (const key of R.keys(source)) {
		Object.defineProperty(out, key, {
			value: mapValue(key, source[key]),
			enumerable: true,
			writable: true,
			configurable: true,
		});
	}
	return out;
};

// ── compilerOptions path surfaces ────────────────────────────────────

const PATH_STRING_KEYS = [
	"outFile",
	"outDir",
	"rootDir",
	"declarationDir",
	"sourceRoot",
	"mapRoot",
	"tsBuildInfoFile",
	"baseUrl",
	"generateCpuProfile",
	"generateTrace",
] as const;

const PATH_LIST_KEYS = ["typeRoots", "rootDirs"] as const;

/**
 * Apply `transform` to every path-typed compilerOptions surface: the path
 * strings and path lists, and — when `includePathsValues` — the `paths` record's
 * values (the final `${configDir}` phase substitutes those; the parse phase
 * leaves them verbatim). Non-string values pass through untouched (forward tolerance).
 */
const transformCompilerOptionPaths = (
	co: CompilerOptions.Type,
	transform: (value: string) => string,
	includePathsValues: boolean,
): CompilerOptions.Type => {
	const out: { -readonly [Key in keyof CompilerOptions.Type]: CompilerOptions.Type[Key] } = { ...co };
	for (const key of PATH_STRING_KEYS) {
		const value = out[key];
		if (P.isString(value)) out[key] = transform(value);
	}
	for (const key of PATH_LIST_KEYS) {
		const value = out[key];
		if (A.isArray(value)) out[key] = value.map((entry) => (P.isString(entry) ? transform(entry) : entry));
	}
	if (includePathsValues) {
		const paths = out.paths;
		if (P.isObjectKeyword(paths) && !P.isFunction(paths)) {
			out.paths = rebuildRecord(paths, (_key, arr) =>
				A.isArray(arr) ? arr.map((entry) => (P.isString(entry) ? transform(entry) : entry)) : arr,
			);
		}
	}
	return out;
};

// Implementation of ResolvedTsconfig.absolutize; the public contract lives on the static.
const absolutize: {
	(configDir: string, join: (a: string, b: string) => string): (doc: TsconfigJson.Type) => TsconfigJson.Type;
	(doc: TsconfigJson.Type, configDir: string, join: (a: string, b: string) => string): TsconfigJson.Type;
} = dual(3, (
	doc: TsconfigJson.Type,
	configDir: string,
	join: (a: string, b: string) => string,
): TsconfigJson.Type => {
	const co = doc.compilerOptions;
	if (co === undefined) return doc;
	const absolutizeValue = (value: string): string => (startsWithConfigDir(value) ? value : join(configDir, value));
	return { ...doc, compilerOptions: transformCompilerOptionPaths(co, absolutizeValue, false) };
});

// ── merge per field ────────────────────────────────────────────────────

// Top-level keys consumed by name from a derived `TsconfigJson.Type` — everything
// else is passthrough. `extends` is consumed and dropped (never data).
const DERIVED_CONSUMED_KEYS: HashSet.HashSet<string> = HashSet.fromIterable([
	"compilerOptions",
	"extends",
	"files",
	"include",
	"exclude",
	"references",
	"watchOptions",
	"typeAcquisition",
	"compileOnSave",
]);

// Structural keys consumed by name from a base `ResolvedTsconfig` when lifting
// its passthrough — everything else is its accumulated passthrough.
const RESOLVED_STRUCTURAL_KEYS: HashSet.HashSet<string> = HashSet.fromIterable([
	"configPath",
	"extendedPaths",
	"compilerOptions",
	"files",
	"include",
	"exclude",
	"references",
	"watchOptions",
	"typeAcquisition",
	"compileOnSave",
	"pathsBase",
	"extends",
]);

const extractPassthrough = (
	source: Record<string, unknown>,
	consumed: HashSet.HashSet<string>,
): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const key of R.keys(source)) {
		if (HashSet.has(consumed, key)) continue;
		Object.defineProperty(out, key, { value: source[key], enumerable: true, writable: true, configurable: true });
	}
	return out;
};

/** Re-root one inherited `files`/`include`/`exclude` entry, exempting absolute and `${configDir}` entries. */
const rerootEntry = (prefix: string, entry: string): string => {
	if (startsWithConfigDir(entry) || isAbsolutePath(entry)) return entry;
	return prefix === "" ? entry : `${prefix}/${entry}`;
};

/**
 * `files`/`include`/`exclude`: the derived (own) config declaring the property
 * wins outright — an own empty array beats an inherited value. Otherwise inherit
 * the base's entries, re-rooted with the relative prefix.
 */
const mergeFileList = (
	baseList: ReadonlyArray<string> | undefined,
	derivedList: ReadonlyArray<string> | undefined,
	rerootPrefix: string,
): ReadonlyArray<string> | undefined => {
	if (derivedList !== undefined) return derivedList;
	if (baseList === undefined) return undefined;
	return baseList.map((entry) => rerootEntry(rerootPrefix, entry));
};

/** `watchOptions`: per-key shallow merge (derived wins per key). */
const mergeWatchOptions = (
	base: WatchOptions.Type | undefined,
	derived: WatchOptions.Type | undefined,
): WatchOptions.Type | undefined => {
	if (base === undefined) return derived;
	if (derived === undefined) return base;
	return { ...base, ...derived };
};

// Implementation of ResolvedTsconfig.merge; the public contract lives on the static.
const merge: {
	(derived: TsconfigJson.Type, derivedPath: string): (base: ResolvedTsconfig) => ResolvedTsconfig;
	(base: ResolvedTsconfig, derived: TsconfigJson.Type, derivedPath: string): ResolvedTsconfig;
} = dual(3, (base: ResolvedTsconfig, derived: TsconfigJson.Type, derivedPath: string): ResolvedTsconfig => {
	const finalDir = dirname(derivedPath);
	const baseDir = dirname(base.configPath);

	// compilerOptions: per-key shallow assign; `paths` is one key, replaced wholesale.
	const compilerOptions: CompilerOptions.Type = { ...base.compilerOptions, ...derived.compilerOptions };

	// pathsBase moves to the derived config's dir only when it redeclares `paths`;
	// otherwise the earlier declaring config's dir survives later merges.
	const pathsBase = derived.compilerOptions?.paths !== undefined ? finalDir : base.pathsBase;

	// files/include/exclude: own wins; else inherit re-rooted relative to the declaring config.
	const rerootPrefix = relative(finalDir, baseDir);
	const files = mergeFileList(base.files, derived.files, rerootPrefix);
	const include = mergeFileList(base.include, derived.include, rerootPrefix);
	const exclude = mergeFileList(base.exclude, derived.exclude, rerootPrefix);

	// references / typeAcquisition: never inherited — the own config's values only.
	const references = derived.references;
	const typeAcquisition = derived.typeAcquisition;

	// compileOnSave: own wins; else inherit only a truthy value.
	const compileOnSave =
		derived.compileOnSave !== undefined ? derived.compileOnSave : base.compileOnSave === true ? true : undefined;

	const watchOptions = mergeWatchOptions(base.watchOptions, derived.watchOptions);

	// Unknown top-level keys: assign semantics, derived wins per key. Spread first
	// so a stray passthrough key can never clobber a structural field.
	const passthrough = {
		...extractPassthrough(base, RESOLVED_STRUCTURAL_KEYS),
		...extractPassthrough(derived, DERIVED_CONSUMED_KEYS),
	};

	return {
		...passthrough,
		configPath: derivedPath,
		extendedPaths: [...base.extendedPaths, derivedPath],
		compilerOptions,
		...O.getSomesStruct({ files: O.fromUndefinedOr(files) }),
		...O.getSomesStruct({ include: O.fromUndefinedOr(include) }),
		...O.getSomesStruct({ exclude: O.fromUndefinedOr(exclude) }),
		...O.getSomesStruct({ references: O.fromUndefinedOr(references) }),
		...O.getSomesStruct({ watchOptions: O.fromUndefinedOr(watchOptions) }),
		...O.getSomesStruct({ typeAcquisition: O.fromUndefinedOr(typeAcquisition) }),
		...O.getSomesStruct({ compileOnSave: O.fromUndefinedOr(compileOnSave) }),
		...O.getSomesStruct({ pathsBase: O.fromUndefinedOr(pathsBase) }),
	};
});

// ── ${configDir} substitution (final phase) ──────────────────────────────

const substituteWatchExcludes = (
	wo: WatchOptions.Type | undefined,
	substitute: (value: string) => string,
): WatchOptions.Type | undefined => {
	if (wo === undefined) return undefined;
	const out: { -readonly [Key in keyof WatchOptions.Type]: WatchOptions.Type[Key] } = { ...wo };
	for (const key of ["excludeDirectories", "excludeFiles"] as const) {
		const value = out[key];
		if (A.isArray(value)) {
			out[key] = value.map((entry) => (P.isString(entry) ? substitute(entry) : entry));
		}
	}
	return out;
};

// Implementation of ResolvedTsconfig.substituteConfigDir; the public contract lives on the static.
const substituteConfigDir: {
	(finalDir: string): (resolved: ResolvedTsconfig) => ResolvedTsconfig;
	(resolved: ResolvedTsconfig, finalDir: string): ResolvedTsconfig;
} = dual(2, (resolved: ResolvedTsconfig, finalDir: string): ResolvedTsconfig => {
	const substitute = (value: string): string =>
		startsWithConfigDir(value) ? finalDir + value.slice(CONFIG_DIR_TEMPLATE.length) : value;

	const compilerOptions = transformCompilerOptionPaths(resolved.compilerOptions, substitute, true);
	const files = resolved.files === undefined ? undefined : resolved.files.map(substitute);
	const include = resolved.include === undefined ? undefined : resolved.include.map(substitute);
	const exclude = resolved.exclude === undefined ? undefined : resolved.exclude.map(substitute);
	const watchOptions = substituteWatchExcludes(resolved.watchOptions, substitute);

	return {
		...resolved,
		compilerOptions,
		...O.getSomesStruct({ files: O.fromUndefinedOr(files) }),
		...O.getSomesStruct({ include: O.fromUndefinedOr(include) }),
		...O.getSomesStruct({ exclude: O.fromUndefinedOr(exclude) }),
		...O.getSomesStruct({ watchOptions: O.fromUndefinedOr(watchOptions) }),
	};
});

/**
 * The pure extends-merge engine: parse-time path absolutization
 * ({@link (ResolvedTsconfig:class).absolutize}), the per-field merge fold
 * ({@link (ResolvedTsconfig:class).merge}), and the `${configDir}` final
 * phase ({@link (ResolvedTsconfig:class).substituteConfigDir}).
 *
 * **Example** (Resolve a derived compiler option)
 *
 * ```ts
 * import { ResolvedTsconfig } from "@beep/scratchpad/effected/tsconfig-json/ResolvedTsconfig";
 *
 * const base: ResolvedTsconfig = {
 *   configPath: "/project/base.json",
 *   extendedPaths: ["/project/base.json"],
 *   compilerOptions: { strict: true },
 * };
 * const resolved = ResolvedTsconfig.merge(base, { compilerOptions: { strict: false } }, "/project/tsconfig.json");
 * console.log(resolved.compilerOptions.strict) // false
 * console.log(resolved.extendedPaths.length) // 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ResolvedTsconfig extends S.Opaque<ResolvedTsconfig>()(ResolvedTsconfigData) {

	/**
	 * Absolutize a config's path-typed options against its own
	 * `configDir`, using the injected `join` (`Path.Path.resolve` at the call
	 * site — so an already-absolute value is preserved). `${configDir}`-prefixed
	 * values are exempt (resolved later, in
	 * {@link (ResolvedTsconfig:class).substituteConfigDir}), and `paths`
	 * VALUES stay verbatim. Only `compilerOptions` path surfaces are touched;
	 * `files`/`include`/`exclude` are re-rooted at merge time instead.
	 *
	 * **Example** (Absolutize paths while retaining path mappings)
	 *
	 * ```ts
	 * import { ResolvedTsconfig } from "@beep/scratchpad/effected/tsconfig-json/ResolvedTsconfig";
	 *
	 * const doc = ResolvedTsconfig.absolutize(
	 *   { compilerOptions: { outDir: "dist", paths: { app: ["src/app"] } } },
	 *   "/project",
	 *   (directory, entry) => `${directory}/${entry}`,
	 * );
	 * console.log(doc.compilerOptions?.outDir) // /project/dist
	 * console.log(doc.compilerOptions?.paths?.app?.[0]) // src/app
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	static readonly absolutize = absolutize;

	/**
	 * Fold one more-derived config onto the accumulated base, derived
	 * winning. The loader applies this across the resolution chain,
	 * own config last. `derivedPath` is the derived config's absolute
	 * normalized path, from which the re-rooting frame and `pathsBase` are
	 * computed.
	 *
	 * **Example** (Merge a derived file list and inherit checking options)
	 *
	 * ```ts
	 * import { ResolvedTsconfig } from "@beep/scratchpad/effected/tsconfig-json/ResolvedTsconfig";
	 *
	 * const base: ResolvedTsconfig = {
	 *   configPath: "/project/base.json",
	 *   extendedPaths: ["/project/base.json"],
	 *   compilerOptions: { strict: true },
	 * };
	 * const resolved = ResolvedTsconfig.merge(base, { files: [] }, "/project/app/tsconfig.json");
	 * console.log(resolved.configPath) // /project/app/tsconfig.json
	 * console.log(resolved.files?.length) // 0
	 * console.log(resolved.compilerOptions.strict) // true
	 * ```
	 *
	 * @category combinators
	 * @since 0.0.0
	 */
	static readonly merge = merge;

	/**
	 * The final phase: replace a leading `${configDir}` token
	 * (case-insensitive, leading position only) with `finalDir` — the
	 * top-level extending config's directory — across every eligible
	 * surface: compilerOptions path options, `paths` values,
	 * `files`/`include`/`exclude`, and `watchOptions`'
	 * `excludeDirectories`/`excludeFiles`. Every other field is left
	 * untouched.
	 *
	 * **Example** (Substitute the final config directory)
	 *
	 * ```ts
	 * import { ResolvedTsconfig } from "@beep/scratchpad/effected/tsconfig-json/ResolvedTsconfig";
	 *
	 * const resolved: ResolvedTsconfig = {
	 *   configPath: "/project/tsconfig.json",
	 *   extendedPaths: ["/project/tsconfig.json"],
	 *   compilerOptions: { outDir: "${configDir}/dist" },
	 *   include: ["${configDir}/src"],
	 * };
	 * const substituted = ResolvedTsconfig.substituteConfigDir(resolved, "/project");
	 * console.log(substituted.compilerOptions.outDir) // /project/dist
	 * console.log(substituted.include?.[0]) // /project/src
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	static readonly substituteConfigDir = substituteConfigDir;
}
