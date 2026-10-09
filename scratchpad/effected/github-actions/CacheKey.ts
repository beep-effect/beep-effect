import { $ScratchpadId } from "@beep/identity/packages";
import { GlobSet } from "../glob/index.ts";
import { descend } from "../walker/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { sha256, sha256Hex } from "./internal/digest.ts";

const $I = $ScratchpadId.create("effected/github-actions/CacheKey");

/**
 * Raised when a file or directory that was going to be hashed could not be
 * read.
 *
 * @public
 */
export class CacheKeyReadError extends S.TaggedError<CacheKeyReadError>($I`CacheKeyReadError`)("CacheKeyReadError", {
	/** The path being read when it went wrong. */
	path: S.String.annotateKey({ description: "The path being read when it went wrong." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("CacheKeyReadError", { description: "Raised when a file or directory that was going to be hashed could not be read." })) {
	override get message(): string {
		return `Could not read "${this.path}" while deriving a cache key`;
	}
}

/**
 * Raised when a glob pattern would not compile.
 *
 * @public
 */
export class CacheKeyBadPatternError extends S.TaggedError<CacheKeyBadPatternError>($I`CacheKeyBadPatternError`)("CacheKeyBadPatternError", {
	/** The pattern that would not compile. */
	pattern: S.String.annotateKey({ description: "The pattern that would not compile." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("CacheKeyBadPatternError", { description: "Raised when a glob pattern would not compile." })) {
	override get message(): string {
		return `"${this.pattern}" is not a usable glob pattern`;
	}
}

/**
 * Anything that can go wrong deriving a cache key from the filesystem.
 *
 * @remarks
 * Key *derivation* is pure and total once the bytes are in hand, so the two
 * members here are the only things that can fail.
 *
 * **One class per failure, rather than one class with a `reason` field.** Each
 * member carries exactly the fields its own message needs, so a value short a
 * field is a compile error instead of a message reading `"undefined"` — and
 * `Effect.catchTag` can recover from one of them without catching the other.
 *
 * @public
 */
export type CacheKeyError = CacheKeyReadError | CacheKeyBadPatternError;

/**
 * The separator between key segments.
 *
 * @remarks
 * `-` is not arbitrary: it is what every published Actions cache recipe uses,
 * and a restore key is a **prefix match**, so the separator is what makes a
 * partial key a meaningful boundary rather than a coincidence.
 */
const SEPARATOR = "-";

/** GitHub refuses a cache key longer than this. */
const MAX_KEY_LENGTH = 512;

/**
 * One component of a cache key.
 *
 * @remarks
 * Commas and newlines are refused because the runner uses both to delimit the
 * restore-key list — a segment carrying one would silently become two keys.
 */
const Segment = S.String.check(S.isPattern(/^[^,\n\r]+$/u));

const Segments = S.NonEmptyArray(Segment).check(
	S.makeFilter((values) => values.join(SEPARATOR).length <= MAX_KEY_LENGTH, {
		title: `a cache key of at most ${MAX_KEY_LENGTH} characters`,
	}),
);

/**
 * One explicit rung: how many leading segments it keeps. The upper bound is
 * cross-field (`segments.length - 1`) and lives on the class schema.
 */
const RestoreDepth = S.Finite.check(
	S.isInt(),
	S.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
);

/**
 * The explicit ladder: possibly empty, because **zero rungs is a policy** —
 * exact-match-only restores, spelled by {@link CacheKey.withoutRestoreKeys}.
 * Only *absence* means the default every-prefix ladder.
 */
const RestoreDepths = S.Array(RestoreDepth);

/**
 * A GitHub Actions cache key and the restore-key ladder that goes with it.
 *
 * @remarks
 * The ladder is the part every consumer re-derives and gets subtly wrong. A
 * restore key is a **prefix match** on GitHub's side, so `Linux-pnpm` would
 * also match `Linux-pnpm-store-…` from an unrelated cache; every rung here
 * therefore ends in the separator. Deriving the rungs from the segments makes
 * the primary key and its fallbacks impossible to drift apart, which is the
 * failure that produces a cache that never hits and never says why.
 *
 * By default every prefix is a rung. When some segments must never be dropped
 * — a rung without a version digest resurrects stale cross-version caches —
 * give the key an explicit ladder policy with
 * {@link CacheKey.withRestoreDepths}, or none at all with
 * {@link CacheKey.withoutRestoreKeys}, instead of bypassing the typed key.
 *
 * @example
 * ```ts
 * import { CacheKey } from "./index.ts";
 *
 * const key = CacheKey.of("Linux", "pnpm-store", "abc123");
 * key.key;          // "Linux-pnpm-store-abc123"
 * key.restoreKeys;  // ["Linux-pnpm-store-", "Linux-"]
 * ```
 *
 * @public
 */
export class CacheKey extends S.Class<CacheKey>($I`CacheKey`)(
	S.Struct({
		/** The components, most general first. */
		segments: Segments,
		/**
		 * The explicit ladder policy, when one was given: how many leading
		 * segments each rung keeps, in the order the rungs are tried. Absent for
		 * the default every-prefix ladder; **empty for no ladder at all** —
		 * exact-match-only. See {@link CacheKey.withRestoreDepths} and
		 * {@link CacheKey.withoutRestoreKeys}.
		 */
		restoreDepths: S.optionalKey(RestoreDepths),
	}).check(
		S.makeFilter((key) =>
			key.restoreDepths === undefined || key.restoreDepths.every((depth) => depth <= key.segments.length - 1)
				? undefined
				: "every restore depth must be between 1 and segments.length - 1 — a rung keeping every segment would just repeat the primary key",
		),
	), $I.annote("CacheKey", { description: "A GitHub Actions cache key and the restore-key ladder that goes with it." }),
) {
	/** The primary key: every segment, joined. */
	get key(): string {
		return this.segments.join(SEPARATOR);
	}

	/**
	 * The restore keys, most specific first.
	 *
	 * @remarks
	 * By default each rung drops the last segment and keeps the trailing
	 * separator, so a three-segment key falls back to two prefixes and a
	 * one-segment key falls back to nothing — there is no rung that would match
	 * every cache in the repository.
	 *
	 * **The default ladder is every prefix**, which is wrong for a key whose
	 * later segments must never be dropped alone: a
	 * `platform-arch-versionHash-branchHash-lockfileHash` key derives rungs
	 * without the version digest, and those resurrect stale cross-version
	 * caches. A key built with {@link CacheKey.withRestoreDepths} carries its
	 * own ladder instead, and this getter answers exactly that ladder — so
	 * `ActionCache.restore` picks the policy up through the same typed-key
	 * path, no hand-built restore-key list required. An **empty** policy
	 * ({@link CacheKey.withoutRestoreKeys}) answers no rungs at all: only
	 * *absence* selects the default ladder, so "none" is never mistaken for
	 * "every prefix".
	 */
	get restoreKeys(): ReadonlyArray<string> {
		const rung = (length: number): string => `${this.segments.slice(0, length).join(SEPARATOR)}${SEPARATOR}`;
		if (this.restoreDepths !== undefined) {
			return this.restoreDepths.map(rung);
		}
		const rungs: Array<string> = [];
		for (let length = this.segments.length - 1; length >= 1; length -= 1) {
			rungs.push(rung(length));
		}
		return rungs;
	}

	/**
	 * A copy of this key carrying an explicit restore-key ladder policy.
	 *
	 * @remarks
	 * Each depth is the number of **leading segments** the rung keeps, and the
	 * rungs are emitted in exactly the order given — GitHub tries restore keys
	 * in order, so the order IS the policy. Descending depths (most specific
	 * first) are what a fallback ladder almost always wants; that convention is
	 * recommended rather than enforced, because rung ordering is the consumer's
	 * policy where commas, newlines and the length limit are the runner's
	 * protocol. A depth outside `1..segments.length - 1` is refused at
	 * construction: `0` would match every cache in the repository, and
	 * `segments.length` would just repeat the primary key.
	 *
	 * @example
	 * ```ts
	 * import { CacheKey } from "./index.ts";
	 *
	 * const key = CacheKey.of("Linux", "X64", "v1hash", "main", "lockhash").withRestoreDepths([4, 3]);
	 * key.restoreKeys; // ["Linux-X64-v1hash-main-", "Linux-X64-v1hash-"]
	 * ```
	 */
	withRestoreDepths(depths: readonly [number, ...Array<number>]): CacheKey {
		return CacheKey.make({ segments: this.segments, restoreDepths: depths });
	}

	/**
	 * A copy of this key that restores from its **exact key only** — no ladder.
	 *
	 * @remarks
	 * The third point in the policy space: absence of a policy means the default
	 * every-prefix ladder, so exact-match-only restores (a cache-bust mode, where
	 * a stale partial hit is worse than a cold start) need their own spelling.
	 * This is the same `restoreDepths` field carrying **zero rungs** — an honest
	 * value, not a sentinel: `ActionCache.restore` sends no `restore_keys` at
	 * all, so the backend answers this key or a miss.
	 *
	 * @example
	 * ```ts
	 * import { CacheKey } from "./index.ts";
	 *
	 * const key = CacheKey.of("Linux", "pnpm-store", "abc123").withoutRestoreKeys();
	 * key.key;          // "Linux-pnpm-store-abc123"
	 * key.restoreKeys;  // []
	 * ```
	 */
	withoutRestoreKeys(): CacheKey {
		return CacheKey.make({ segments: this.segments, restoreDepths: [] });
	}

	/**
	 * A copy of this key namespaced by `segment` — the whole key, ladder
	 * included.
	 *
	 * @remarks
	 * The cache-bust case: a run that must match nothing an unbusted run wrote,
	 * and whose own entries must be invisible to unbusted runs. Both halves of
	 * that are one intent, and spelling them separately is what makes the wrong
	 * version undetectable — a restore key is a **prefix match**, so folding the
	 * bust in *after* the retained prefix leaves an ordinary run's rung
	 * prefix-matching busted entries. The cache still appears to work, and
	 * quietly serves poisoned entries into unrelated runs.
	 *
	 * Two decisions make this safe for **any** segment value, with no prefix
	 * reasoning at the call site. The segment goes **first**, so the namespaced
	 * key shares no prefix with an unnamespaced one. And the ladder is
	 * **dropped**, so no rung of this key can reach outside the namespace even
	 * when the segment happens to equal an ordinary leading segment — which a
	 * prepend alone would not survive.
	 *
	 * Dropping the ladder is the safe default, not a prohibition: the segments
	 * are all still there, so a caller who wants one busted run to warm from
	 * another can follow with {@link CacheKey.withRestoreDepths} and get an
	 * in-namespace ladder deliberately.
	 *
	 * @example
	 * ```ts
	 * import { CacheKey } from "./index.ts";
	 *
	 * const key = CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7");
	 * key.key;          // "bust7-Linux-pnpm-store-abc123"
	 * key.restoreKeys;  // []
	 * ```
	 *
	 * @param segment - The namespace, e.g. a cache-bust token.
	 */
	withNamespace(segment: string): CacheKey {
		return CacheKey.make({ segments: [segment, ...this.segments], restoreDepths: [] });
	}

	/** Build a key from its segments. */
	static of(...segments: readonly [string, ...ReadonlyArray<string>]): CacheKey {
		return CacheKey.make({ segments });
	}

	/**
	 * A branch-aware key.
	 *
	 * @remarks
	 * Ordering the segments `os → scope → branch → hash` is what makes the
	 * derived ladder do the right thing: the first rung falls back to any earlier
	 * cache **on this branch**, and only the next one reaches across branches. The
	 * reverse order would make the first fallback jump branches, which is how a
	 * feature branch ends up warming its cache from `main` and never noticing its
	 * own.
	 *
	 * Every part is an explicit argument rather than read from the environment,
	 * so a key is reproducible outside a runner and a test needs no ambient
	 * state.
	 */
	static forBranch(options: {
		/** What is being cached, e.g. `"pnpm-store"`. */
		readonly scope: string;
		/** The short ref, e.g. `GITHUB_REF_NAME`. */
		readonly branch: string;
		/** The runner OS, e.g. `RUNNER_OS`. Included first when given. */
		readonly os?: string;
		/** The content hash, e.g. from {@link CacheKey.hashFiles}. Included last when given. */
		readonly hash?: string;
	}): CacheKey {
		const segments: [string, ...Array<string>] =
			options.os === undefined ? [options.scope, options.branch] : [options.os, options.scope, options.branch];
		if (options.hash !== undefined) {
			segments.push(options.hash);
		}
		return CacheKey.make({ segments });
	}

	/**
	 * A segment-safe short digest of a string.
	 *
	 * @remarks
	 * {@link CacheKey.hashFiles} covers file *content*; this covers the key
	 * segments built from **non-file** inputs — a sorted version list, a branch
	 * name — that every compound key hashes and truncates by hand, each caller
	 * re-deciding the length and the placement. One home for the derivation:
	 * SHA-256, lowercase hex, the first `length` characters.
	 *
	 * The answer is **guaranteed to satisfy the segment grammar**: lowercase hex
	 * is nonempty (for any permitted `length`) and can never contain the comma
	 * or newline the restore-key protocol reserves, so the result drops straight
	 * into {@link CacheKey.of} with nothing to check at the call site.
	 *
	 * Deterministic and pure — the same input always answers the same digest,
	 * which is the entire point of putting one in a cache key. Distinct inputs
	 * are only *probably* distinct, as with any truncated hash; eight hex
	 * characters (32 bits) is the conventional balance between key legibility
	 * and collision risk for cache segments.
	 *
	 * A `length` outside `1..64` (or a fractional one) is a wiring mistake, not
	 * data, and **throws a `RangeError`** rather than failing typed: 64 is all
	 * SHA-256 has, and asking for more would silently answer fewer characters
	 * than the caller believes it got.
	 *
	 * @example
	 * ```ts
	 * import { CacheKey } from "./index.ts";
	 *
	 * const key = CacheKey.of(
	 *   "Linux",
	 *   CacheKey.digest("node:24.4.0,pnpm:10.13.1"),
	 *   CacheKey.digest("feat/my-branch"),
	 * );
	 * ```
	 */
	static digest(input: string, length: number = 8): string {
		if (!Number.isInteger(length) || length < 1 || length > 64) {
			throw new RangeError(`A digest length must be an integer between 1 and 64, got ${length}`);
		}
		return sha256Hex(input).slice(0, length);
	}

	/**
	 * Hash a set of files into a single digest.
	 *
	 * @remarks
	 * **Byte-compatible with `@actions/glob`'s `hashFiles`**, and the three
	 * details that make it so are all easy to get wrong: the paths are sorted, each
	 * file is hashed on its own, and the per-file digest is fed into the
	 * accumulator as **binary** rather than hex. A hex-fed accumulator produces a
	 * perfectly plausible digest that simply never matches a cache entry written
	 * by any other action.
	 *
	 * Sorting and de-duplication happen here rather than at the call site, so a
	 * caller cannot accidentally make its key depend on the order it discovered
	 * files in.
	 *
	 * `Option.none()` for an empty set, because "nothing matched" is not a
	 * digest — it is the signal that the pattern is wrong, and a caller that
	 * folds it into a key silently caches against a constant.
	 */
	static readonly hashFiles = Effect.fn("CacheKey.hashFiles")(function* (files: ReadonlyArray<string>) {
		const fs = yield* FileSystem.FileSystem;
		const ordered = [...new Set(files)].sort();
		if (ordered.length === 0) {
			return O.none<string>();
		}
		const digests = yield* Effect.forEach(
			ordered, (path) =>
				fs.readFile(path).pipe(
					Effect.mapError((cause) => CacheKeyReadError.make({ path, cause })),
					Effect.map(sha256),
				),
			// The `concurrency` option is load-bearing, not a tuning knob: `Effect.all`
			// defaults to `concurrency: 1`, so omitting it reads every file one at a
			// time and this whole shape buys nothing over a sequential loop. Bounded rather than `"unbounded"` because a pattern set can
			// match thousands of files and one fiber per file would exhaust the
			// runner's descriptors; 8 is the width `ActionCache` and `Artifact`
			// already use for their own IO fan-out.
			{ concurrency: 8 },
		);
		// The digest of the concatenated raw digests — the runner's own `hashFiles()` shape.
		return O.some(sha256Hex(Uint8Array.from(digests.flatMap((digest) => [...digest]))));
	});

	/**
	 * Every file under `workspace` that the pattern set matches.
	 *
	 * @remarks
	 * Discovery and matching are **two different jobs**, and separating them is
	 * what makes this testable and correct. The walk is `@effected/walker`'s
	 * `descend`, run once per include from that include's own literal prefix
	 * (a literal include is one `stat`, never a walk) with nothing pruned
	 * implicitly; the matching is `@effected/glob`'s full minimatch dialect —
	 * the same dialect `@actions/glob` uses, so a workflow author's
	 * `!**\/node_modules/**` behaves here exactly as it does in every other
	 * cache step in the same workflow. `node:fs.globSync` would have welded the
	 * two together behind one non-stubbable call *and* changed the dialect, and
	 * a dialect divergence surfaces as a silent cache-key difference — the worst
	 * failure mode a cache key has.
	 *
	 * Candidates are matched by their path **relative to the workspace**, and a
	 * literal that climbs above it (`../lockfile`) is dropped lexically — no
	 * literal reaches outside the workspace through path text. The walk is
	 * another matter: under `followSymlinks` a symlinked directory whose target
	 * lives outside the workspace IS descended, and its files DO contribute to
	 * the key — parity with `@actions/glob`, which follows links out of the
	 * tree too. Directories are excluded: a directory
	 * called `notes.txt` matches `**\/*.txt` and is not a file, and hashing it
	 * would fail rather than being ignored. An absent literal is a miss; any
	 * other failure to read one is a typed `CacheKeyReadError`, because a key
	 * derived from an incomplete file set is wrong in a way nothing reports.
	 *
	 * Symlinked directories are followed (`descend` under
	 * `followSymlinks: true`), matching `@actions/glob`'s default
	 * `followSymbolicLinks: true` — a file reachable only through a symlinked
	 * directory contributes to the key, and `descend`'s real-path cycle guard
	 * keeps link loops finite.
	 *
	 * The answer is sorted, so a caller cannot make its key depend on the order
	 * the filesystem happened to report.
	 */
	static readonly matchingFiles = Effect.fn("CacheKey.matchingFiles")(function* (options: {
		/** The directory to walk. Nothing outside it is ever considered. */
		readonly workspace: string;
		/** Include patterns, with a leading `!` marking an exclusion. */
		readonly patterns: ReadonlyArray<string>;
	}) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const { workspace } = options;
		const set = yield* GlobSet.compile(options.patterns).pipe(
			Effect.mapError((cause) => CacheKeyBadPatternError.make({ pattern: cause.pattern, cause })),
		);
		// An absent workspace is a failure naming it, never an empty answer:
		// `descend` reads a missing base as zero matches, which here would fold
		// into a key that silently caches against a constant.
		yield* fs.stat(workspace).pipe(Effect.mapError((cause) => CacheKeyReadError.make({ path: workspace, cause })));

		// The walk is `@effected/walker`'s: each include is expanded from its own
		// literal prefix (a literal include is one stat, never a walk), files
		// only, `cwd`-relative posix paths — so a Windows runner matches too.
		// Nothing is pruned implicitly, matching the runner's own `hashFiles()`;
		// an exclusion is the caller's `!pattern`, re-applied over the union
		// below because each include is expanded alone. Under `followSymlinks`
		// the walk follows symlinked directories with `@actions/glob`'s
		// traversal-chain cycle guard, so files reachable only through a
		// symlinked directory contribute to the key — matching the runner's
		// `hashFiles()` default of `followSymbolicLinks: true`.
		const candidates = new Set<string>();
		for (const literal of set.literals) {
			const target = path.join(workspace, literal);
			// A literal that climbs above the workspace is not this workspace's
			// file, whatever is there. (The walk below is not so bounded: a
			// symlinked directory targeting outside the workspace is descended,
			// matching `@actions/glob`'s out-of-tree link following.)
			const relative = path.relative(workspace, target);
			if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
				continue;
			}
			// Absent is a miss; unreadable is not, because a key computed without a file the caller asked for
			// silently restores the wrong cache.
			const info = yield* fs.stat(target).pipe(
				Effect.asSome,
				Effect.catchIf(
					(error) => error.reason._tag === "NotFound",
					() => Effect.succeedNone,
				),
				Effect.mapError((cause) => CacheKeyReadError.make({ path: target, cause })),
			);
			if (O.isSome(info) && info.value.type === "File") {
				candidates.add(literal);
			}
		}
		for (const wildcard of set.wildcards) {
			// A whole-pattern negation only filters; it expands nothing.
			if (wildcard.negated) {
				continue;
			}
			const found = yield* descend(wildcard, { cwd: workspace, prune: [], followSymlinks: true }).pipe(
				Effect.mapError((cause) => CacheKeyReadError.make({ path: path.join(workspace, cause.path), cause })),
			);
			for (const match of found) {
				candidates.add(match);
			}
		}
		return [...candidates]
			.filter((candidate) => set.matches(candidate))
			.sort()
			.map((candidate) => path.join(workspace, candidate));
	});

	/**
	 * Hash every file under `workspace` that the pattern set matches.
	 *
	 * @remarks
	 * {@link CacheKey.matchingFiles} into {@link CacheKey.hashFiles}, which is
	 * the pairing every consumer writes by hand — and the pairing whose two
	 * halves have to agree about ordering and about what counts as a file for the
	 * digest to match anything anyone else computed.
	 *
	 * `Option.none()` when nothing matched, for the same reason `hashFiles` gives:
	 * "no files" is not a digest, it is the signal that the patterns are wrong,
	 * and folding it into a key silently caches against a constant.
	 *
	 * @example
	 * ```ts
	 * import { CacheKey } from "./index.ts";
	 * import { Effect, Option } from "effect";
	 *
	 * const key = Effect.gen(function* () {
	 *   const hash = yield* CacheKey.hashMatching({
	 *     workspace: "/home/runner/work/repo/repo",
	 *     patterns: ["**\/pnpm-lock.yaml", "!**\/node_modules/**"],
	 *   });
	 *   return CacheKey.of("Linux", "pnpm-store", Option.getOrElse(hash, () => "empty"));
	 * });
	 * ```
	 */
	static readonly hashMatching = Effect.fn("CacheKey.hashMatching")(function* (options: {
		readonly workspace: string;
		readonly patterns: ReadonlyArray<string>;
	}) {
		return yield* CacheKey.hashFiles(yield* CacheKey.matchingFiles(options));
	});
}
