// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type { MemoryFileSystemOptions, MemoryFileSystemSeedEntry } from "../../effected/memfs/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type * as FileSystem from "effect/FileSystem";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { flow } from "effect/Function";
import { systemError } from "effect/PlatformError";
import { CacheKey, CacheKeyBadPatternError, CacheKeyReadError } from "../../effected/github-actions/index.ts";

/**
 * The digest of `alpha\n` + `beta\n` under `@actions/glob`'s algorithm, pinned
 * as a literal.
 *
 * @remarks
 * A literal rather than a recomputation, because recomputing it in the test
 * would just be the implementation written twice — and the mistake this is
 * guarding against (feeding the per-file digest in as hex rather than binary)
 * would be reproduced identically by the copy. The wrong-way digest is
 * `e11ab1a1…`, which is what this constant discriminates against.
 */
const ALPHA_BETA = "24d116e0411b3a4a8d3d5c9c88c150bc4d4603a490294bd4b23d3ef549e1f1a0";

const FILES: Record<string, string> = {
	"/w/alpha.txt": "alpha\n",
	"/w/beta.txt": "beta\n",
};

/** A real volume holding exactly `FILES`; any other path reads an honest `NotFound`. */
const files = MemoryFileSystem.layerWith(FILES);

const hashing = <A, E>(program: Effect.Effect<A, E, FileSystem.FileSystem>) => program.pipe(Effect.provide(files));

describe("CacheKey", () => {
	describe("the key and its ladder", () => {
		it("joins the segments", () => {
			assert.strictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").key, "Linux-pnpm-store-abc123");
		});

		it("derives the restore keys most specific first, each ending in the separator", () => {
			// The trailing separator is the point: "Linux-pnpm" would also prefix-match
			// "Linux-pnpmx-…" from an unrelated cache, because GitHub matches restore
			// keys as bare prefixes.
			assert.deepStrictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").restoreKeys, ["Linux-pnpm-store-", "Linux-"]);
		});

		it("gives a single-segment key no ladder at all", () => {
			// There is deliberately no rung here: an empty prefix would match every
			// cache in the repository.
			assert.deepStrictEqual(CacheKey.of("Linux").restoreKeys, []);
		});

		it("refuses a segment containing a comma, which the runner reads as a delimiter", () => {
			assert.throws(() => CacheKey.of("Linux", "a,b"));
		});

		it("refuses a segment containing a newline", () => {
			assert.throws(() => CacheKey.of("Linux", "a\nb"));
		});

		it("refuses a key longer than GitHub accepts", () => {
			assert.throws(() => CacheKey.of("Linux", "x".repeat(512)));
		});

		it("accepts a key exactly at the limit", () => {
			const key = CacheKey.of("x".repeat(512));
			assert.lengthOf(key.key, 512);
		});
	});

	describe("an explicit ladder policy", () => {
		it("answers exactly the depths given, in the order given", () => {
			// The consumer case this exists for: a five-segment key whose default
			// ladder derives rungs WITHOUT the version digest — rungs that match
			// stale cross-version caches. The literal expectations matter: an
			// implementation that ignores the policy and falls back to
			// all-prefixes yields four rungs here, not these two.
			const key = CacheKey.of("Linux", "X64", "v1hash", "main", "lockhash").withRestoreDepths([4, 3]);
			assert.deepStrictEqual(key.restoreKeys, ["Linux-X64-v1hash-main-", "Linux-X64-v1hash-"]);
		});

		it("preserves a non-descending order verbatim — the order IS the policy", () => {
			// GitHub tries restore keys in order; descending is recommended in the
			// TSDoc, deliberately not enforced.
			const key = CacheKey.of("a", "b", "c").withRestoreDepths([1, 2]);
			assert.deepStrictEqual(key.restoreKeys, ["a-", "a-b-"]);
		});

		it("leaves the primary key alone", () => {
			const key = CacheKey.of("Linux", "pnpm-store", "abc123").withRestoreDepths([1]);
			assert.strictEqual(key.key, "Linux-pnpm-store-abc123");
		});

		it("does not change the default ladder of a key without a policy", () => {
			// Byte-compatibility claim for every existing consumer.
			assert.deepStrictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").restoreKeys, ["Linux-pnpm-store-", "Linux-"]);
		});

		it("refuses a depth that keeps every segment — that rung would repeat the primary key", () => {
			assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([3]));
		});

		it("refuses a depth of zero — that rung would match every cache in the repository", () => {
			assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([0]));
		});

		it("refuses a negative or fractional depth", () => {
			assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([-1]));
			assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([1.5]));
		});
	});

	describe("no ladder at all — exact-match-only", () => {
		it("answers zero rungs", () => {
			// The third point in the policy space: absent = the default ladder,
			// explicit depths = that ladder, EMPTY = no ladder. A mutant that
			// reads an empty policy as "no policy" regenerates the two default
			// rungs here and fails on the literal [].
			assert.deepStrictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").withoutRestoreKeys().restoreKeys, []);
		});

		it("leaves the primary key alone", () => {
			assert.strictEqual(
				CacheKey.of("Linux", "pnpm-store", "abc123").withoutRestoreKeys().key,
				"Linux-pnpm-store-abc123",
			);
		});

		it("survives a schema round-trip without regaining a ladder", () => {
			// The policy is a plain field, so a key that crossed a serialization
			// boundary (state, JSON output) keeps meaning "exact match only".
			const encoded = flow(S.encodeResult(CacheKey), Result.getOrThrowWith((error) => error))(CacheKey.of("Linux", "pnpm-store").withoutRestoreKeys());
			const decoded = flow(S.decodeResult(CacheKey), Result.getOrThrowWith((error) => error))(encoded);
			assert.deepStrictEqual(decoded.restoreKeys, []);
			assert.strictEqual(decoded.key, "Linux-pnpm-store");
		});

		it("does not change a key without a policy — absent still means the default ladder", () => {
			assert.deepStrictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").restoreKeys, ["Linux-pnpm-store-", "Linux-"]);
		});
	});

	describe("namespacing a whole key — the cache-bust case", () => {
		it("prepends the segment, so the busted key shares no prefix with an unbusted one", () => {
			// The whole point. An unbusted run writes "Linux-pnpm-store-abc123";
			// a busted run must not be able to read it, and must not write
			// anything an unbusted run can read.
			const busted = CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7");
			assert.strictEqual(busted.key, "bust7-Linux-pnpm-store-abc123");
		});

		it("drops the ladder, so no rung can prefix-match outside the namespace", () => {
			// This is the failure the ticket describes: folding the bust in AFTER
			// the retained prefix left an ordinary run's rung prefix-matching
			// busted entries, and every test still passed.
			assert.deepStrictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7").restoreKeys, []);
		});

		it("leaves an unbusted key's rungs unable to reach a busted entry", () => {
			// The other direction, asserted explicitly rather than assumed: a
			// restore key is a PREFIX match, so an ordinary rung must not be a
			// prefix of the namespaced key.
			const ordinary = CacheKey.of("Linux", "pnpm-store", "abc123");
			const busted = ordinary.withNamespace("bust7");
			for (const rung of ordinary.restoreKeys) {
				assert.isFalse(busted.key.startsWith(rung), `"${rung}" must not match "${busted.key}"`);
			}
		});

		it("is safe even when the namespace collides with an ordinary leading segment", () => {
			// The adversarial case for a prepend-only design: if the ladder were
			// kept, the rung "Linux-" would match every ordinary Linux entry.
			// Dropping the ladder makes the guarantee hold for ANY segment value,
			// with no prefix reasoning required at the call site.
			assert.deepStrictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("Linux").restoreKeys, []);
		});

		it("still allows an explicit in-namespace ladder for a caller who wants one", () => {
			// Dropping the ladder is the safe DEFAULT, not a prohibition: the
			// segments are all there, so a caller who has thought about it can
			// still warm one busted run from another.
			const key = CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7").withRestoreDepths([3, 2]);
			assert.deepStrictEqual(key.restoreKeys, ["bust7-Linux-pnpm-store-", "bust7-Linux-"]);
		});

		it("refuses a segment carrying a restore-key delimiter", () => {
			// A comma would silently become two restore keys on the runner.
			assert.throws(() => CacheKey.of("Linux", "pnpm-store").withNamespace("a,b"));
		});
	});

	describe("branch-aware derivation", () => {
		it("orders the segments so the first fallback stays on the branch", () => {
			const key = CacheKey.forBranch({ os: "Linux", scope: "pnpm-store", branch: "feature/x", hash: "abc123" });
			assert.strictEqual(key.key, "Linux-pnpm-store-feature/x-abc123");
			// Rung one is this branch's earlier caches; only rung two reaches across
			// branches. Reversing branch and scope would make a feature branch warm
			// itself from main before ever finding its own cache.
			assert.deepStrictEqual(key.restoreKeys, ["Linux-pnpm-store-feature/x-", "Linux-pnpm-store-", "Linux-"]);
		});

		it("omits the os and hash when they are not supplied", () => {
			const key = CacheKey.forBranch({ scope: "pnpm-store", branch: "main" });
			assert.strictEqual(key.key, "pnpm-store-main");
			assert.deepStrictEqual(key.restoreKeys, ["pnpm-store-"]);
		});
	});

	describe("digest — the string-segment digest", () => {
		it("is sha256, lowercase hex, truncated to eight characters by default", () => {
			// The empty string's sha256 is the best-known vector there is; a literal,
			// so a swapped algorithm or an uppercase digest fails here rather than
			// producing a plausible key that matches nothing.
			assert.strictEqual(CacheKey.digest(""), "e3b0c442");
			assert.strictEqual(CacheKey.digest("main"), CacheKey.digest("main"));
		});

		it("takes an explicit length, up to the whole digest", () => {
			assert.strictEqual(CacheKey.digest("", 12), "e3b0c44298fc");
			const full = CacheKey.digest("", 64);
			assert.strictEqual(full, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
			assert.strictEqual(CacheKey.digest("main", 64).length, 64);
		});

		it("distinguishes the two call sites it exists for", () => {
			// A version list and a branch name must never collide into one segment.
			assert.notStrictEqual(CacheKey.digest("node:24.4.0,pnpm:10.13.1"), CacheKey.digest("feat/topic"));
		});

		it("always satisfies the segment grammar, even for hostile input", () => {
			// The guarantee is structural — lowercase hex has no comma, no newline,
			// and is nonempty — so the digest of anything drops into `of` unchecked.
			for (const hostile of ["", "a,b", "line\nbreak", "\r\n", "-", ","]) {
				const key = CacheKey.of("Linux", CacheKey.digest(hostile));
				assert.match(key.key, /^Linux-[0-9a-f]{8}$/);
			}
		});

		it("throws a RangeError on a length outside 1..64 or a fractional one", () => {
			// A bad length is wiring, not data: 64 is all sha256 has, and answering
			// fewer characters than asked would be a silent lie.
			for (const bad of [0, -1, 1.5, 65, Number.NaN]) {
				assert.throws(() => CacheKey.digest("main", bad), RangeError);
			}
		});
	});

	describe("hashFiles", () => {
		it.effect("hashes files the way @actions/glob does", () =>
			hashing(
				Effect.gen(function* () {
					const digest = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt"]);
					assert.deepStrictEqual(digest, O.some(ALPHA_BETA));
				}),
			),
		);

		it.effect("does not depend on the order the caller discovered files in", () =>
			hashing(
				Effect.gen(function* () {
					const digest = yield* CacheKey.hashFiles(["/w/beta.txt", "/w/alpha.txt"]);
					assert.deepStrictEqual(digest, O.some(ALPHA_BETA));
				}),
			),
		);

		it.effect("counts a repeated path once", () =>
			hashing(
				Effect.gen(function* () {
					const digest = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt", "/w/alpha.txt"]);
					assert.deepStrictEqual(digest, O.some(ALPHA_BETA));
				}),
			),
		);

		it.effect("distinguishes different content", () =>
			hashing(
				Effect.gen(function* () {
					const both = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt"]);
					const one = yield* CacheKey.hashFiles(["/w/alpha.txt"]);
					assert.notDeepEqual(both, one);
				}),
			),
		);

		it.effect("reports nothing rather than a digest when no file matched", () =>
			hashing(
				Effect.gen(function* () {
					// A digest of nothing would be a constant, so every run would key
					// against the same value and the cache would always hit with the
					// wrong contents.
					assert.isTrue(O.isNone(yield* CacheKey.hashFiles([])));
				}),
			),
		);

		it.effect("reads the files concurrently rather than one at a time", () =>
			Effect.gen(function* () {
				// The discriminating observation, and the only one that catches the
				// mistake this guards against: `Effect.all` defaults to `concurrency: 1`,
				// so a version that merely *looks* parallel — an array of effects handed
				// to `Effect.all` with no option — still reads one file at a time, and
				// every other test in this describe block passes for it. Two reads have to
				// be in flight at once.
				//
				// Deliberately NOT a latch the second read opens: a sequential run would
				// then block forever, and `it.effect` runs on the TestClock, so no timeout
				// inside the program can fire and the mutant reports as a five-second hang
				// rather than a failed assertion. Yielding instead keeps both branches
				// terminating and leaves the sequential one with `overlapped === false`.
				let active = 0;
				let overlapped = false;
				// Wrap-and-delegate over the real volume: the content comes from the
				// seed, the fault only counts reads in flight.
				const observed = MemoryFileSystem.layerWith(FILES, {
					faults: (base) => ({
						readFile: Effect.fn("readFile")(function*(path) {
								active += 1;
								if (active > 1) {
									overlapped = true;
								}
								// A suspension point, so a sibling fiber gets to run before this
								// read completes. Without one, a concurrent `Effect.all` could still
								// finish each read in a single uninterrupted step and never overlap.
								yield* Effect.yieldNow;
								yield* Effect.yieldNow;
								const bytes = yield* base.readFile(path);
								active -= 1;
								return bytes;
							}),
					}),
				});
				const digest = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt"]).pipe(Effect.provide(observed));
				assert.isTrue(overlapped, "the two reads never overlapped — Effect.all ran sequentially");
				// And concurrency did not cost correctness: the digest still folds the
				// per-file digests in sorted order, not completion order.
				assert.deepStrictEqual(digest, O.some(ALPHA_BETA));
			}),
		);

		it.effect("fails typed, naming the file, when one cannot be read", () =>
			hashing(
				Effect.gen(function* () {
					const error = yield* Effect.flip(CacheKey.hashFiles(["/w/alpha.txt", "/w/gone.txt"]));
					assert.instanceOf(error, CacheKeyReadError);
					assert.strictEqual(error.path, "/w/gone.txt");
				}),
			),
		);
	});

	describe("hashing what a pattern set matches", () => {
		// A real volume, a real walk: the claims here are about what is in the tree
		// and what a recursive read reports, and memfs implements the whole
		// `FileSystem` — parent directories, stat types, listings — so nothing
		// here is a stubbed directory listing asserting only the stub.
		const WORKSPACE = "/ws";
		const SEALED = "/ws/sealed/pnpm-lock.yaml";
		const TREE: Record<string, MemoryFileSystemSeedEntry> = {
			"/ws/pnpm-lock.yaml": "lock\n",
			"/ws/packages/a/pnpm-lock.yaml": "inner\n",
			"/ws/node_modules/dep/pnpm-lock.yaml": "vendored\n",
			"/ws/readme.md": "docs\n",
		};

		const walking = <A, E>(
			use: (root: string) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
			extra: Record<string, MemoryFileSystemSeedEntry> = {},
			options: MemoryFileSystemOptions = {},
		) =>
			use(WORKSPACE).pipe(
				Effect.provide(Layer.mergeAll(MemoryFileSystem.layerWith({ ...TREE, ...extra }, options), Path.layer)),
			);

		it.effect("matches relative to the workspace, and honours an exclusion", () =>
			walking((root) =>
				Effect.gen(function* () {
					const matched = yield* CacheKey.matchingFiles({
						workspace: root,
						patterns: ["**/pnpm-lock.yaml", "!**/node_modules/**"],
					});
					// Matching against the RELATIVE path is what makes "never reach outside
					// the workspace" structural. Matching absolute paths would also make
					// every pattern depend on where the runner happened to check out.
					assert.deepStrictEqual(
						matched.map((file) => file.slice(root.length + 1)),
						["packages/a/pnpm-lock.yaml", "pnpm-lock.yaml"],
					);
				}),
			),
		);

		it.effect("excludes a directory whose name matches the pattern", () =>
			walking(
				(root) =>
					Effect.gen(function* () {
						// A directory called `notes.txt` matches `**\/*.txt` and is not a file.
						// Without the check it reaches `hashFiles`, which fails on the read —
						// so this is the difference between a working cache key and a failing
						// action.
						const matched = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["*.txt", "**/*.txt"] });
						assert.deepStrictEqual(
							matched.map((file) => file.slice(root.length + 1)),
							["notes.txt/inner.txt"],
						);
					}),
				{ "/ws/notes.txt/inner.txt": "inner\n" },
			),
		);

		it.effect("is exactly hashFiles over what it matched", () =>
			walking((root) =>
				Effect.gen(function* () {
					const matched = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["**/pnpm-lock.yaml"] });
					assert.deepStrictEqual(
						yield* CacheKey.hashMatching({ workspace: root, patterns: ["**/pnpm-lock.yaml"] }),
						yield* CacheKey.hashFiles(matched),
					);
				}),
			),
		);

		it.effect("reports nothing rather than a digest when the patterns match nothing", () =>
			walking((root) =>
				Effect.gen(function* () {
					assert.isTrue(O.isNone(yield* CacheKey.hashMatching({ workspace: root, patterns: ["**/*.absent"] })));
				}),
			),
		);

		it.effect("fails typed, naming the pattern, when one will not compile", () =>
			walking((root) =>
				Effect.gen(function* () {
					const hostile = "x".repeat(70_000);
					const error = yield* Effect.flip(CacheKey.matchingFiles({ workspace: root, patterns: [hostile] }));
					assert.instanceOf(error, CacheKeyBadPatternError);
					assert.strictEqual(error.pattern, hostile);
				}),
			),
		);

		it.effect("drops a literal that climbs above the workspace, even when the file exists", () =>
			walking(
				(root) =>
					Effect.gen(function* () {
						// The old whole-workspace walk could never surface a file above the
						// workspace; a per-literal stat could, so the containment is explicit.
						// The sibling lives BESIDE the workspace, under the same parent.
						const matched = yield* CacheKey.matchingFiles({
							workspace: root,
							patterns: ["../ws-outside.lock", "pnpm-lock.yaml"],
						});
						assert.deepStrictEqual(
							matched.map((file) => file.slice(root.length + 1)),
							["pnpm-lock.yaml"],
						);
					}),
				{ "/ws-outside.lock": "outside\n" },
			),
		);

		it.effect("reads an absent literal as a miss but an unreadable one as a typed failure", () =>
			walking(
				(root) =>
					Effect.gen(function* () {
						// Absent: parity with the walk, which never reported it.
						const absent = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["not-here.lock"] });
						assert.deepStrictEqual(absent, []);
						// Unreadable: the file the caller asked for exists and cannot be
						// stat'ed — a key computed without it would restore the wrong cache,
						// so this MUST fail rather than quietly narrow the set.
						const error = yield* Effect.flip(
							CacheKey.matchingFiles({ workspace: root, patterns: ["sealed/pnpm-lock.yaml"] }),
						);
						assert.instanceOf(error, CacheKeyReadError);
						assert.strictEqual(error.path, SEALED);
					}),
				// The file is genuinely present; only its `stat` is denied — the
				// EACCES a `chmod 0o000` parent directory produces on a real disk.
				{ [SEALED]: "hidden\n" },
				{
					faults: {
						stat: (path) =>
							path === SEALED
								? Effect.fail(
										systemError({
											_tag: "PermissionDenied",
											module: "FileSystem",
											method: "stat",
											pathOrDescriptor: path,
										}),
									)
								: undefined,
					},
				},
			),
		);

		it.effect("fails typed, naming the workspace, when it cannot be walked", () =>
			walking((root) =>
				Effect.gen(function* () {
					const absent = `${root}/not-here`;
					const error = yield* Effect.flip(CacheKey.matchingFiles({ workspace: absent, patterns: ["**"] }));
					assert.instanceOf(error, CacheKeyReadError);
					assert.strictEqual(error.path, absent);
				}),
			),
		);
	});

	describe("followSymlinks semantics (memfs, no platform package)", () => {
		// A pure virtual POSIX volume — no real-filesystem paths anywhere, so
		// the fixture is byte-identical across platforms. (A Windows tmpdir
		// path mixed into memfs seeds produced spellings the volume's symlink
		// resolver never matched, so the links silently read as dangling.)
		const seed: Record<string, MemoryFileSystemSeedEntry> = {
			"/repo/src/a.ts": "alpha\n",
			"/repo/shared/inner.ts": "inner\n",
			"/repo/src/one": MemoryFileSystem.symlink("/repo/shared"),
			"/repo/src/two": MemoryFileSystem.symlink("/repo/shared"),
			// A link resolving OUTSIDE the workspace, target seeded in the same
			// volume: @actions/glob follows links out of the tree, so hashFiles()
			// parity says matchingFiles must too.
			"/repo/src/out": MemoryFileSystem.symlink("/outside"),
			"/outside/secret.ts": "secret\n",
		};
		// descend requires both FileSystem and Path; provide both layers.
		const symlinkPlatform = Layer.mergeAll(MemoryFileSystem.layerWith(seed), Path.layer);

		it.effect("files reachable only through a symlinked directory contribute to the key", () =>
			Effect.gen(function* () {
				const matched = yield* CacheKey.matchingFiles({ workspace: "/repo", patterns: ["src/**/*.ts"] }).pipe(
					Effect.provide(symlinkPlatform),
				);
				// Both sibling links to one target appear — @actions/glob's
				// per-branch traversalChain enumerates both — and so does the
				// out-of-workspace link target, matching the runner's hashFiles().
				assert.deepStrictEqual(matched, [
					"/repo/src/a.ts",
					"/repo/src/one/inner.ts",
					"/repo/src/out/secret.ts",
					"/repo/src/two/inner.ts",
				]);
			}),
		);
	});

	describe("JSON Schema export", () => {
		it("each segment exports its pattern", () => {
			const document = S.toJsonSchemaDocument(CacheKey);
			assert.nestedPropertyVal(
				document,
				"definitions.CacheKeyEncoded.properties.segments.items.pattern",
				String.raw`^[^,\n\r]+$`,
			);
		});
	});
});
