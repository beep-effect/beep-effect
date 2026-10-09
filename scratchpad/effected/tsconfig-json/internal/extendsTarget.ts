/**
 * The `extends` target-resolution engine (relative/rooted specifiers and the bare-specifier
 * `node_modules` lookup). Every input reaching {@link resolveExports} is an
 * untrusted `package.json` `exports` map, so every recursive surface carries a
 * depth guard, every untrusted map read goes through `Object.hasOwn`, dunder
 * keys are skipped, and substituted maps are built with `Object.create(null)` —
 * a JSON-parsed `{"__proto__": …}` key must never read or assign a prototype.
 *
 * **Gotchas**
 *
 * A hostile `package.json` must never defect or fail the whole resolution: a
 * malformed manifest is absorbed to "no resolution for that candidate", and
 * only a genuine `PlatformError` from the underlying IO flows through the typed
 * error channel.
 */

import { Jsonc } from "../../jsonc/index.ts";
import { Walker } from "../../walker/index.ts";
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Path from "effect/Path";
import { dual } from "effect/Function";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as HashSet from "effect/HashSet";

/** Conditions honored in an `exports` condition object, plus the always-eligible `default`. */
const CONDITIONS = HashSet.make("require", "types", "node");

/** Keys that are never data on a plain object. Skipped on every untrusted read. */
const DUNDER_KEYS = HashSet.make("__proto__", "constructor", "prototype");

/** Depth guard for the recursive exports walk (condition nesting, fallback arrays, wildcard substitution). */
const MAX_EXPORTS_DEPTH = 32;

/** Split a bare specifier into its package name and its subpath ("" when the whole spec is the package). */
const parseSpecifier = (spec: string): { readonly pkg: string; readonly subpath: string } => {
	if (spec.startsWith("@")) {
		const parts = spec.split("/");
		return { pkg: parts.slice(0, 2).join("/"), subpath: parts.slice(2).join("/") };
	}
	const slash = spec.indexOf("/");
	return slash === -1 ? { pkg: spec, subpath: "" } : { pkg: spec.slice(0, slash), subpath: spec.slice(slash + 1) };
};

/** Match a single-`*` subpath pattern against a subpath, returning the captured segment or `null`. */
const matchWildcard = (pattern: string, subpath: string): string | null => {
	const star = pattern.indexOf("*");
	if (star === -1 || pattern.indexOf("*", star + 1) !== -1) return null;
	const prefix = pattern.slice(0, star);
	const suffix = pattern.slice(star + 1);
	if (subpath.length < prefix.length + suffix.length) return null;
	if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return null;
	return subpath.slice(prefix.length, subpath.length - suffix.length);
};

/** Substitute a captured wildcard segment into an export value, hardened against dunder keys and unbounded nesting. */
const substituteWildcard = (value: unknown, captured: string, depth: number): unknown => {
	if (depth > MAX_EXPORTS_DEPTH) return null;
	if (P.isString(value)) return value.replace(/\*/g, captured);
	if (A.isArray(value)) return value.map((entry) => substituteWildcard(entry, captured, depth + 1));
	if (P.isObject(value)) {
		const result: Record<string, unknown> = { __proto__: null };
		for (const key of R.keys(value)) {
			if (HashSet.has(DUNDER_KEYS, key) || !R.has(value, key)) continue;
			result[key] = substituteWildcard(value[key], captured, depth + 1);
		}
		return result;
	}
	return value;
};

/** Find the export value for a subpath: exact key first, then a single-`*` pattern (substituted), else `undefined`. */
const matchExportKey = (exports: unknown, subpath: string): unknown => {
	if (P.isString(exports)) return subpath === "." ? exports : undefined;
	if (A.isArray(exports)) return subpath === "." ? exports : undefined;
	if (!P.isObject(exports)) return undefined;
	const obj = exports;
	const keys = R.keys(obj);
	// An object whose keys all start with "." is a subpath map; otherwise it is a
	// root-level condition object (sugar for the "." target).
	const isSubpathMap = keys.length > 0 && keys.every((key) => key.startsWith("."));
	if (!isSubpathMap) return subpath === "." ? obj : undefined;
	if (!HashSet.has(DUNDER_KEYS, subpath) && R.has(obj, subpath)) return obj[subpath];
	// Node/tsc pattern selection: among matching `*` patterns the LONGEST base
	// prefix (the text before the star) wins — most specific, not first-in-order.
	let best: { readonly pattern: string; readonly captured: string; readonly prefixLength: number } | undefined;
	for (const pattern of keys) {
		if (HashSet.has(DUNDER_KEYS, pattern) || !pattern.includes("*") || !R.has(obj, pattern)) continue;
		const captured = matchWildcard(pattern, subpath);
		if (captured === null) continue;
		const prefixLength = pattern.indexOf("*");
		if (best === undefined || prefixLength > best.prefixLength) {
			best = { pattern, captured, prefixLength };
		}
	}
	return best === undefined ? undefined : substituteWildcard(obj[best.pattern], best.captured, 0);
};

/**
 * Resolve an export value to a `.json` string target: strings gate on the
 * `.json` suffix, fallback arrays yield the first resolvable entry, and
 * condition objects are matched in map insertion order (Node semantics) against
 * the honored conditions plus `default`, under the depth guard.
 */
const resolveConditionValue = (value: unknown, depth: number): string | undefined => {
	if (depth > MAX_EXPORTS_DEPTH) return undefined;
	if (P.isString(value)) return value.endsWith(".json") ? value : undefined;
	if (A.isArray(value)) {
		for (const entry of value) {
			const resolved = resolveConditionValue(entry, depth + 1);
			if (resolved !== undefined) return resolved;
		}
		return undefined;
	}
	if (P.isObject(value)) {
		const obj = value;
		for (const key of R.keys(obj)) {
			if (HashSet.has(DUNDER_KEYS, key) || !R.has(obj, key)) continue;
			if (HashSet.has(CONDITIONS, key) || key === "default") {
				const resolved = resolveConditionValue(obj[key], depth + 1);
				if (resolved !== undefined) return resolved;
			}
		}
	}
	return undefined;
};

/**
 * Resolve a `package.json` `exports` map for a subpath key (`"."` for the
 * package root, `"./sub"` for a subpath) to its `.json` target string. Pure and
 * hardened; exported for direct unit testing.
 *
 * **Details**
 *
 * The returned target is verbatim
 * from the manifest (still relative to the package directory) — the caller joins
 * and probes it.
  *
 * **Example** (Resolve a conditional package subpath)
 *
 * ```ts
 * import { resolveExports } from "@beep/scratchpad/effected/tsconfig-json/internal/extendsTarget";
 * import * as O from "effect/Option";
 *
 * const target = resolveExports({ "./base": { types: "./base.json" } }, "./base");
 * console.log(O.getOrElse(target, () => "missing")) // ./base.json
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const resolveExports: {
	(exports: unknown, subpath: string): O.Option<string>;
	(subpath: string): (exports: unknown) => O.Option<string>;
} = dual(2, (exports: unknown, subpath: string): O.Option<string> => {
	const matched = matchExportKey(exports, subpath);
	if (matched === undefined) return O.none();
	const resolved = resolveConditionValue(matched, 0);
	return resolved === undefined ? O.none() : O.some(resolved);
});

/**
 * Read and parse a `package.json`, coercing every failure that is not a
 * genuine IO error to an EMPTY manifest — tsc's `readJson`
 * (typescript.js:21176, `readJsonOrUndefined(path, host) || {}`) does exactly
 * this, so a missing, unparseable or non-object manifest falls through to the
 * manifest-less lookups (no exports, no tsconfig field) rather than deciding
 * the candidate. A `PlatformError` from `exists` flows through.
 */
const readManifest = Effect.fnUntraced(function* (
	fs: FileSystem.FileSystem,
	manifestPath: string,
): Effect.fn.Return<Record<string, unknown>, PlatformError.PlatformError> {
	if (!(yield* fs.exists(manifestPath))) return {};
	const text = yield* fs.readFileString(manifestPath);
	const parsed = yield* Effect.option(Jsonc.parse(text));
	if (O.isNone(parsed)) return {};
	const value = parsed.value;
	return P.isObject(value) ? value : {};
});

/** Read an own property of an untrusted record, guarding dunder keys and inherited members. */
const ownProp = (record: Record<string, unknown>, key: string): unknown =>
	!HashSet.has(DUNDER_KEYS, key) && R.has(record, key) ? record[key] : undefined;

/**
 * Resolve relative/rooted targets: the exact file wins verbatim (even
 * extensionless); otherwise, if the target does not already end in `.json`, the
 * `.json`-appended path is tried. There is no directory fallback.
 */
const resolveRelative = Effect.fnUntraced(function* (
	fs: FileSystem.FileSystem,
	path: Path.Path,
	fromDir: string,
	spec: string,
): Effect.fn.Return<O.Option<string>, PlatformError.PlatformError> {
	const abs = path.resolve(fromDir, spec);
	if (yield* fs.exists(abs)) return O.some(abs);
	if (!abs.endsWith(".json")) {
		const withJson = `${abs}.json`;
		if (yield* fs.exists(withJson)) return O.some(withJson);
	}
	return O.none();
});

/**
 * Probe one candidate package under an ancestor's `node_modules`. `none` means
 * "did not resolve here — keep walking": tsc's ancestor walk
 * (forEachAncestorDirectoryStoppingAtGlobalCache, typescript.js:46466) only
 * stops on a defined result, so a present-but-unresolved candidate does NOT
 * shadow a farther ancestor's copy. There is no `package.json` presence gate —
 * tsc probes `<pkg>/tsconfig.json` even when the manifest is absent
 * (loadNodeModuleFromDirectoryWorker, typescript.js:45943).
 */
const tryCandidate = Effect.fnUntraced(function* (
	fs: FileSystem.FileSystem,
	path: Path.Path,
	dir: string,
	pkg: string,
	subpath: string,
): Effect.fn.Return<O.Option<string>, PlatformError.PlatformError> {
	const pkgDir = path.join(dir, "node_modules", pkg);
	const record = yield* readManifest(fs, path.join(pkgDir, "package.json"));

	// (a) exports present blocks every same-package fallback, even when it
	// fails to resolve — but the ancestor walk still continues afterwards.
	const exports = ownProp(record, "exports");
	if (exports !== undefined) {
		const target = resolveExports(exports, subpath === "" ? "." : `./${subpath}`);
		if (O.isNone(target)) return O.none();
		const abs = path.resolve(pkgDir, target.value);
		return (yield* fs.exists(abs)) ? O.some(abs) : O.none();
	}

	// (b) subpath: exact file, then the .json retry.
	if (subpath !== "") {
		const exact = path.resolve(pkgDir, subpath);
		if (yield* fs.exists(exact)) return O.some(exact);
		if (!subpath.endsWith(".json")) {
			const withJson = `${exact}.json`;
			if (yield* fs.exists(withJson)) return O.some(withJson);
		}
		return O.none();
	}

	// (c) bare package: the "tsconfig" field (resolved against the package
	// dir) is tried first; on a miss tsc falls through to the
	// `<pkg>/tsconfig.json` probe (typescript.js:45943-45945 — a falsy
	// packageFileResult falls to loadModuleFromFile(indexPath)). tsc treats
	// `""` as falsy too (`packageFile && loader(...)`), so an empty-string
	// field must also fall through rather than resolve to `path.resolve(pkgDir, "")`,
	// which is the package directory itself.
	const tsField = ownProp(record, "tsconfig");
	if (P.isString(tsField) && tsField !== "") {
		const abs = path.resolve(pkgDir, tsField);
		if (yield* fs.exists(abs)) return O.some(abs);
	}
	const fallback = path.join(pkgDir, "tsconfig.json");
	return (yield* fs.exists(fallback)) ? O.some(fallback) : O.none();
});

/**
 * Resolve an `extends` target to an absolute config path. Relative and rooted
 * specifiers resolve against the extending config's directory; bare
 * specifiers walk up the ancestor `node_modules` chain, skipping ancestors
 * named `node_modules`, and resolve against the first package found.
 *
 * **Details**
 *
 * Absence is `Option.none()`; a malformed manifest is coerced to an empty one
 * (tsc parity — the candidate's manifest-less lookups still run); a
 * `PlatformError` from the underlying IO flows through.
  *
 * **Example** (Construct a relative extends lookup)
 *
 * ```ts
 * import { resolveExtendsTarget } from "@beep/scratchpad/effected/tsconfig-json/internal/extendsTarget";
 * import * as Effect from "effect/Effect";
 *
 * const program = resolveExtendsTarget("./base.json", "/project/tsconfig.json");
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const resolveExtendsTarget: {
	(spec: string, fromConfigPath: string): Effect.Effect<O.Option<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>;
	(fromConfigPath: string): (spec: string) => Effect.Effect<O.Option<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>;
} = dual(2, Effect.fnUntraced(function* (
	spec: string,
	fromConfigPath: string,
): Effect.fn.Return<O.Option<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const fromDir = path.dirname(fromConfigPath);
	// tsc normalizes slashes once and uses the normalized name throughout
	// (typescript.js:43745) — the normalized spec is what resolves.
	const normalized = spec.replace(/\\/g, "/");

	if (normalized.startsWith("./") || normalized.startsWith("../") || path.isAbsolute(normalized)) {
		return yield* resolveRelative(fs, path, fromDir, normalized);
	}

	const { pkg, subpath } = parseSpecifier(normalized);
	const ancestors = yield* Walker.ascend(fromDir);
	for (const dir of ancestors) {
		if (path.basename(dir) === "node_modules") continue;
		const candidate = yield* tryCandidate(fs, path, dir, pkg, subpath);
		if (O.isSome(candidate)) return candidate;
	}
	return O.none();
}));
