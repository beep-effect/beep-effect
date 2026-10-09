// The tsconfig.json IO pipeline: read a config file, decode it through
// `TsconfigJsonFromString`, then resolve its full `extends` chain
// against the pure merge engine (`ResolvedTsconfig`) and the target
// resolver (`resolveExtendsTarget`). Everything the loader touches on
// disk goes through core `FileSystem`/`Path` in `R`; a `PlatformError` from the
// underlying IO flows through untranslated.
//
// Phase order per file, exactly per tsc: decode -> absolutize path options
// against the config's OWN directory (parse phase) -> recurse into `extends`
// depth-first -> fold each config onto the accumulated base, own config
// last -> substitute a leading `${configDir}` once, against the TOP config's
// directory (final phase). The resolution is a recursive walk over untrusted
// files, so it carries a cycle guard and a depth guard (MAX_EXTENDS_DEPTH), both
// failing through the typed `TsconfigExtendsError` channel — never as a defect
// (hardening-a-parser-port invariant).
//
// FILE-EXISTENCE CONTRACT (a deliberate divergence from tsc). Target resolution
// probes candidates with core `FileSystem.exists`, which on a real filesystem is
// TRUE for a directory, whereas tsc's `host.fileExists` is file-only. A relative
// `"./dir"` extends target pointing at a real DIRECTORY therefore resolves the
// directory verbatim here, and the subsequent `readFileString` fails with a
// `PlatformError` (typed, flows through) — where tsc would instead retry
// `"./dir.json"`. The divergence is accepted as a documented file-only contract:
// it satisfies the hardening invariant (it fails typed, never as a defect), it
// cannot be exercised by the in-memory fixture filesystem (which is file-only by
// construction — a directory is never a map key), and the alternative (a
// stat-and-isFile probe) would require rewriting the tsc-cited `extendsTarget`
// engine and its fixtures for a case no supported test can reach.

import { $ScratchpadId } from "@beep/identity/packages";
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { CompilerOptions } from "./CompilerOptions.ts";
import { resolveExtendsTarget } from "./internal/extendsTarget.ts";
import { ResolvedTsconfig } from "./ResolvedTsconfig.ts";
import type { TsconfigJson } from "./TsconfigJson.ts";
import { TsconfigJsonFromString, TsconfigParseError } from "./TsconfigJson.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/tsconfig-json/TsconfigLoader");

/**
 * The maximum number of `extends` levels the loader will descend before failing
 * with {@link TsconfigExtendsError} `reason: "depth"`. A guard on the recursive
 * walk over untrusted config files, not a tsc limit.
 */
const MAX_EXTENDS_DEPTH = 32;

/**
 * Raised when a config's `extends` chain cannot be resolved: an unresolvable
 * target (`"not-found"`), a re-entrant chain (`"cycle"`), a chain deeper than
 * `MAX_EXTENDS_DEPTH` (`"depth"`), or an empty target string (`"empty"`).
 *
 * **Details**
 *
 * `path` is the config whose `extends` failed, `target` is what it tried to
 * extend (the offending spec for `"not-found"`/`"empty"`, the re-entered config
 * path for `"cycle"`, the refused config for `"depth"`), and `chain` is the full
 * resolution chain of normalized absolute paths.
 *
 * **Example** (Inspect an unresolved extends target)
 *
 * ```ts
 * import { TsconfigExtendsError } from "@beep/scratchpad/effected/tsconfig-json/TsconfigLoader";
 *
 * const error = TsconfigExtendsError.make({
 *   path: "/project/tsconfig.json",
 *   target: "./missing.json",
 *   reason: "not-found",
 *   chain: ["/project/tsconfig.json"],
 * });
 * console.log(error.message) // cannot resolve extends target "./missing.json" from "/project/tsconfig.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TsconfigExtendsError extends S.TaggedError<TsconfigExtendsError>($I`TsconfigExtendsError`)("TsconfigExtendsError", {
	/** The config whose `extends` could not be resolved. */
	path: S.String.annotateKey({ description: "The config whose `extends` could not be resolved." }),
	/** The target that failed: the spec, the re-entered path, or the refused path. */
	target: S.String.annotateKey({ description: "The target that failed: the spec, the re-entered path, or the refused path." }),
	/** Why resolution failed. */
	reason: S.Literals(["not-found", "cycle", "depth", "empty"]).annotateKey({ description: "Why resolution failed." }),
	/** The full resolution chain of normalized absolute config paths. */
	chain: S.Array(S.String).annotateKey({ description: "The full resolution chain of normalized absolute config paths." }),
}, $I.annote("TsconfigExtendsError", { description: "Raised when a config's `extends` chain cannot be resolved: an unresolvable target (`\"not-found\"`), a re-entrant chain (`\"cycle\"`), a chain deeper than `MAX_EXTENDS_DEPTH` (`\"depth\"`), or an empty target string (`\"empty\"`). `path` is the config whose `extends` failed, `target` is what it tried to extend (the offending spec for `\"not-found\"`/`\"empty\"`, the re-entered config path for `\"cycle\"`, the refused config for `\"depth\"`), and `chain` is the full resolution chain of normalized absolute paths." })) {
	/**
	 * Explains the failed extends target, cycle, depth limit, or empty specifier.
	 *
	 * **Example** (Describe an empty extends target)
	 *
	 * ```ts
	 * import { TsconfigExtendsError } from "@beep/scratchpad/effected/tsconfig-json/TsconfigLoader";
	 *
	 * const error = TsconfigExtendsError.make({
	 *   path: "/project/tsconfig.json",
	 *   target: "",
	 *   reason: "empty",
	 *   chain: ["/project/tsconfig.json"],
	 * });
	 * console.log(error.message) // empty extends target in "/project/tsconfig.json"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return this.reason === "not-found"
			? `cannot resolve extends target "${this.target}" from "${this.path}"`
			: this.reason === "cycle"
				? `extends cycle re-entering "${this.target}" via ${this.chain.join(" -> ")}`
				: this.reason === "depth"
					? `extends chain exceeded depth ${MAX_EXTENDS_DEPTH} at "${this.path}"`
					: `empty extends target in "${this.path}"`;
	}
}

/** tsc normalizes to forward slashes throughout; the merge engine and the cycle keys assume that convention. */
const normalizeSlashes = (p: string): string => p.replace(/\\/g, "/");

/** The shared JSONC decode entrypoint (`TsconfigJsonFromString` is already the shared codec instance). */
const decodeConfig = S.decodeEffect(TsconfigJsonFromString);

/** Normalize a config's `extends` field (absent / string / array) to an ordered spec list. */
const extendsSpecs = (doc: TsconfigJson.Type): ReadonlyArray<string> => {
	const ext = doc.extends;
	if (ext === undefined) return [];
	return P.isString(ext) ? [ext] : ext;
};

/** Read + decode one config at an already-absolute, normalized path; wrap decode failures with that path. */
const loadAbs = Effect.fnUntraced(function* (
	abs: string,
): Effect.fn.Return<TsconfigJson.Type, TsconfigParseError | PlatformError.PlatformError, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	const text = yield* fs.readFileString(abs);
	return yield* decodeConfig(text).pipe(Effect.mapError((cause) => TsconfigParseError.make({ path: abs, cause })));
});

// Implementation of TsconfigLoader.load; the public contract lives on the static.
const load = Effect.fn("TsconfigLoader.load")(function* (configPath: string) {
	const path = yield* Path.Path;
	return yield* loadAbs(normalizeSlashes(path.resolve(configPath)));
});

/** One absolutized config document paired with its normalized absolute path, in fold order. */
interface ConfigLayer {
	readonly doc: TsconfigJson.Type;
	readonly path: string;
}

/**
 * Collect the flattened, base-most-first list of absolutized config documents
 * for `configPath` and its full `extends` chain. `chain` is the stack of
 * already-visited normalized absolute paths on THIS branch (copied per branch,
 * so a diamond is legal); it excludes `configPath` itself until it is admitted.
 */
const collect = Effect.fnUntraced(function* (
	configPath: string,
	chain: ReadonlyArray<string>,
): Effect.fn.Return<
	ReadonlyArray<ConfigLayer>,
	TsconfigParseError | TsconfigExtendsError | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> {
	const path = yield* Path.Path;
	const abs = normalizeSlashes(path.resolve(configPath));

	// Depth guard (hardening): refuse to descend past MAX_EXTENDS_DEPTH levels.
	if (chain.length >= MAX_EXTENDS_DEPTH) {
		return yield* TsconfigExtendsError.make({ path: abs, target: abs, reason: "depth", chain: [...chain, abs] });
	}

	const doc = yield* loadAbs(abs);
	// Parse phase: absolutize this config's path options against its own dir.
	const absolutized = ResolvedTsconfig.absolutize(doc, path.dirname(abs), path.resolve);
	const newChain = [...chain, abs];

	const layers: Array<ConfigLayer> = [];
	for (const spec of extendsSpecs(absolutized)) {
		if (spec === "") {
			return yield* TsconfigExtendsError.make({ path: abs, target: "", reason: "empty", chain: newChain });
		}
		const target = yield* resolveExtendsTarget(spec, abs);
		if (O.isNone(target)) {
			return yield* TsconfigExtendsError.make({ path: abs, target: spec, reason: "not-found", chain: newChain });
		}
		const normTarget = normalizeSlashes(target.value);
		// Cycle guard: the target already sits on this branch's stack.
		if (newChain.includes(normTarget)) {
			return yield* TsconfigExtendsError.make({
					path: abs,
					target: normTarget,
					reason: "cycle",
					chain: [...newChain, normTarget],
				});
		}
		// Depth-first: fully flatten this entry's nested chain before the sibling.
		const subLayers = yield* collect(normTarget, newChain);
		for (const sub of subLayers) layers.push(sub);
	}
	// Own config last: it wins over everything it extends.
	layers.push({ doc: absolutized, path: abs });
	return layers;
});

// Implementation of TsconfigLoader.resolve; the public contract lives on the static.
const resolve = Effect.fn("TsconfigLoader.resolve")(function* (configPath: string) {
	const path = yield* Path.Path;
	const topAbs = normalizeSlashes(path.resolve(configPath));
	const layers = yield* collect(topAbs, []);

	// Fold base-most first onto an empty seed; each merge sets the accumulated
	// configPath to the derived config, so the seed's is immediately overwritten.
	const seed: ResolvedTsconfig = { configPath: topAbs, extendedPaths: [], compilerOptions: {} };
	let acc = seed;
	for (const entry of layers) {
		acc = ResolvedTsconfig.merge(acc, entry.doc, entry.path);
	}

	// Final phase: ${configDir} resolves against the TOP config's directory.
	return ResolvedTsconfig.substituteConfigDir(acc, path.dirname(topAbs));
});

// Implementation of TsconfigLoader.compilerOptions; the public contract lives on the static.
const compilerOptions = Effect.fn("TsconfigLoader.compilerOptions")(function* (configPath: string) {
	const resolved = yield* resolve(configPath);
	return resolved.compilerOptions satisfies CompilerOptions.Type;
});

/**
 * The tsconfig.json loader: {@link TsconfigLoader.load} reads and decodes one
 * config file, {@link TsconfigLoader.resolve} runs the full load -\> extends -\>
 * merge -\> `${configDir}` pipeline, and {@link TsconfigLoader.compilerOptions}
 * projects the resolved result down to its merged `compilerOptions`.
 *
 * **Example** (Read the target from a resolved tsconfig)
 *
 * ```ts
 * import { TsconfigLoader } from "@beep/scratchpad/effected/tsconfig-json/TsconfigLoader";
 * import * as Effect from "effect/Effect";
 *
 * // Requires `FileSystem` and `Path` in `R`; provide them from a platform layer.
 * const program = Effect.gen(function* () {
 * 	const resolved = yield* TsconfigLoader.resolve("./tsconfig.json");
 * 	return resolved.compilerOptions.target;
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class TsconfigLoader {
	private constructor() {}

	/**
	 * Read one config file and decode it through {@link TsconfigJsonFromString}.
	 *
	 * **Details**
	 *
	 * A decode failure is wrapped in a {@link TsconfigParseError} carrying the
	 * file's absolute path; a `PlatformError` from the read flows through
	 * untranslated. No `extends` resolution — {@link TsconfigLoader.resolve}
	 * drives that.
	 *
	 * **Example** (Construct a single-config read)
	 *
	 * ```ts
	 * import { TsconfigLoader } from "@beep/scratchpad/effected/tsconfig-json/TsconfigLoader";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = TsconfigLoader.load("./tsconfig.json");
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 *
	 */
	static readonly load = load;

	/**
	 * Resolve a tsconfig.json and its full `extends` chain into a
	 * {@link (ResolvedTsconfig:interface)}: load and decode each config,
	 * absolutize its path options, resolve `extends` depth-first with
	 * per-branch cycle and depth guards, fold the chain
	 * own-config-last, then substitute a leading `${configDir}` once
	 * against the top config's directory.
	 *
	 * **Details**
	 *
	 * `configPath` +
	 * `extendedPaths` come back base-most first, own config last. Every
	 * failure is a typed error — `TsconfigParseError` (a malformed file,
	 * carrying that file's path), `TsconfigExtendsError` (a broken chain), or
	 * a `PlatformError` from IO — never a defect.
	 *
	 * **Example** (Construct an extends-chain resolution)
	 *
	 * ```ts
	 * import { TsconfigLoader } from "@beep/scratchpad/effected/tsconfig-json/TsconfigLoader";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = TsconfigLoader.resolve("./tsconfig.json");
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 *
	 */
	static readonly resolve = resolve;

	/**
	 * Resolve a tsconfig.json's full `extends` chain and project out the
	 * merged `compilerOptions` — a thin projection of
	 * {@link TsconfigLoader.resolve} for the common "just give me the
	 * effective options" query. Same pipeline, same typed failures.
	 *
	 * **Example** (Construct an effective-options query)
	 *
	 * ```ts
	 * import { TsconfigLoader } from "@beep/scratchpad/effected/tsconfig-json/TsconfigLoader";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = TsconfigLoader.compilerOptions("./tsconfig.json");
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 *
	 */
	static readonly compilerOptions = compilerOptions;
}
