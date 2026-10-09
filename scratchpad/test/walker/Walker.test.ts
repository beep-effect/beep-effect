import { assert, describe, it, layer } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Cause, Effect, Option, Path, PlatformError, Ref, Schema } from "effect";
import { Walker } from "../../effected/walker/Walker.ts";
import { platform } from "./fixtures.ts";

const JsonString = Schema.fromJsonString(Schema.String);

layer(Path.layer)("Walker.ascend", (it) => {
	it.effect("yields each directory from start to the root, nearest first", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/c");
			assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b", "/a", "/"]);
		}),
	);

	it.effect("terminates at the root fixpoint without exhausting maxDepth", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a");
			assert.deepStrictEqual(dirs, ["/a", "/"]);
		}),
	);

	it.effect("stops at stopAt, inclusive", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a" });
			assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b", "/a"]);
		}),
	);

	// The ceiling is matched against each directory's RESOLVED form, not by raw
	// string equality. Under raw equality every one of these ceilings names a real
	// ancestor of `start` and yet matches nothing, so the ascent runs past it to
	// the filesystem root — the option failing OPEN, invisibly, into exactly the
	// unbounded walk it exists to prevent. Callers cannot be asked to remember to
	// resolve first: forgetting is undetectable from the call site.
	it.effect("stops at a ceiling with a trailing separator", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a/" });
			assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b", "/a"]);
		}),
	);

	it.effect("stops at a ceiling carrying a dot segment", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a/./b" });
			assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b"]);
		}),
	);

	it.effect("stops at a ceiling carrying a parent segment", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a/b/x/.." });
			assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b"]);
		}),
	);

	// A relative ceiling DIES, never resolved against `process.cwd()`. Resolving
	// one would make the same ceiling name different directories in a lint-staged
	// hook, a CLI run from a package directory, and a test runner — the fail-open
	// class this whole change exists to close, arriving through a different door.
	// `ascend` therefore reads `process.cwd()` nowhere.
	//
	// A DEFECT and not a typed error, deliberately, and this is the test that
	// pins it: `@effected/config-file`'s resolver contract absorbs every typed
	// failure into `Option.none()`, so a typed rejection would be swallowed there
	// and re-emerge as a clean-looking "no config found" — the silent wrong answer
	// again. `Effect.catch` does not catch defects, so only dying survives that.
	// `ascend`'s error channel is `never`, so a Failure exit can only be a defect.
	it.effect("dies on a relative ceiling rather than resolving it against the working directory", () =>
		Effect.gen(function* () {
			// `catchCause` reaches the defect without narrowing an Exit union; the
			// success branch never runs, so anything it yields is unreachable.
			const defect = yield* Effect.catchCause(Walker.ascend("/a/b/c", { stopAt: "b" }), (cause) =>
				Effect.succeed(Cause.squash(cause)),
			);
			assert.instanceOf(defect, Error);
			assert.match(defect.message, /stopAt must be an absolute path/);
			// The ceiling is reported exactly as supplied, not normalized — a
			// normalized echo would hide which spelling the caller actually passed.
			assert.match(defect.message, /"b"/);
			assert.match(defect.message, /"\/a\/b\/c"/);
		}),
	);

	// The die must survive the absorption that motivated it. This reconstructs
	// config-file's `absorb` contract exactly and proves a relative ceiling still
	// reaches the caller through it — a typed error here would be swallowed and
	// reported as a clean `Option.none()`.
	it.effect("survives an absorbing caller that catches every typed failure", () =>
		Effect.gen(function* () {
			const absorb = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.orElseSucceed(effect, () => ["absorbed"]);
			const absorbed = absorb(Walker.ascend("/a/b/c", { stopAt: "b" }));
			const exit = yield* Effect.exit(absorbed);
			assert.strictEqual(exit._tag, "Failure", "a relative ceiling must not be absorbable into a clean result");
		}),
	);

	// The shapes most likely to be passed by accident: a bare directory name, a
	// dot-relative path, a parent-relative path, and the empty string.
	it.effect("dies on every relative ceiling shape", () =>
		Effect.gen(function* () {
			for (const stopAt of ["pkgs", "./pkgs", "../pkgs", ".", "..", ""]) {
				const exit = yield* Effect.exit(Walker.ascend("/a/b/c", { stopAt }));
				assert.strictEqual(exit._tag, "Failure", `expected ${yield* Schema.encodeEffect(JsonString)(stopAt)} to be refused`);
			}
		}),
	);

	// Only the CEILING is constrained. A relative `start` with no ceiling must
	// keep working exactly as it did — over-applying the rejection to `start`
	// would break every caller that ascends from a relative path.
	it.effect("still ascends from a relative start when no ceiling is given", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("a/b");
			assert.deepStrictEqual(dirs, ["a/b", "a", "."]);
		}),
	);

	// Idempotence, pinned directly: `@effected/workspaces` already resolves its
	// ceiling at the call site, so resolving again inside `ascend` must be a no-op
	// for an already-resolved path. If normalization were ever anything but
	// idempotent, that caller would break silently.
	it.effect("leaves an already-resolved ceiling unchanged", () =>
		Effect.gen(function* () {
			const path = yield* Path.Path;
			const ceiling = path.resolve("/fixture/repo");
			assert.strictEqual(ceiling, "/fixture/repo");
			const dirs = yield* Walker.ascend("/fixture/repo/packages/a", { stopAt: ceiling });
			assert.deepStrictEqual(dirs, ["/fixture/repo/packages/a", "/fixture/repo/packages", "/fixture/repo"]);
		}),
	);

	// The filesystem root as a ceiling, from a start already AT the root: the
	// degenerate case where the ceiling break and the dirname fixpoint coincide.
	it.effect("stops sanely when both start and the ceiling are the filesystem root", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* Walker.ascend("/", { stopAt: "/" }), ["/"]);
			assert.deepStrictEqual(yield* Walker.ascend("/a/b", { stopAt: "/" }), ["/a/b", "/a", "/"]);
		}),
	);

	// Normalization changes the COMPARISON, never the chain. The yielded strings
	// stay the lexical ones derived from `start` — resolving them would quietly
	// rewrite paths through a symlinked start, breaking `ascend`'s lexical
	// contract for every caller that does not pass `stopAt` at all.
	it.effect("yields the chain lexically even when the ceiling needed normalizing", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/./c", { stopAt: "/a/" });
			assert.deepStrictEqual(dirs, ["/a/b/./c", "/a/b/.", "/a/b", "/a"]);
		}),
	);

	// A ceiling naming no ancestor still runs to the root — the documented
	// behavior, and the control proving the tests above fail for the RIGHT reason.
	it.effect("runs to the root when the ceiling names no ancestor", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/x/y" });
			assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b", "/a", "/"]);
		}),
	);

	it.effect("truncates a chain longer than maxDepth", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/a/b/c", { maxDepth: 2 });
			assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b"]);
		}),
	);

	// `ascend`'s error channel is `never`, so a Failure exit can only be a defect.
	it.effect("dies when maxDepth is below 1, rather than returning an empty chain", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(Walker.ascend("/a", { maxDepth: 0 }));
			assert.strictEqual(exit._tag, "Failure");
		}),
	);

	it.effect("dies when maxDepth is NaN, rather than returning an empty chain", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(Walker.ascend("/a", { maxDepth: Number.NaN }));
			assert.strictEqual(exit._tag, "Failure");
		}),
	);

	it.effect("dies when maxDepth is not an integer", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(Walker.ascend("/a", { maxDepth: 2.5 }));
			assert.strictEqual(exit._tag, "Failure");
		}),
	);
});

describe("Walker.firstMatch", () => {
	it.effect("returns the first candidate whose predicate reports true", () =>
		Effect.gen(function* () {
			const found = yield* Walker.firstMatch(["a", "b", "c"], (c) => Effect.succeed(c === "b"));
			assert.deepStrictEqual(found, Option.some("b"));
		}),
	);

	it.effect("returns none when nothing matches", () =>
		Effect.gen(function* () {
			const found = yield* Walker.firstMatch(["a", "b"], () => Effect.succeed(false));
			assert.deepStrictEqual(found, Option.none());
		}),
	);

	it.effect("returns none for an empty candidate list", () =>
		Effect.gen(function* () {
			const found = yield* Walker.firstMatch([], () => Effect.succeed(true));
			assert.deepStrictEqual(found, Option.none());
		}),
	);

	// THE regression test. A failing probe must not abort the scan, or a
	// permission error deep in the tree hides a valid match above it.
	it.effect("absorbs a failing predicate per candidate and keeps scanning", () =>
		Effect.gen(function* () {
			const probed = yield* Ref.make<ReadonlyArray<string>>([]);
			const predicate = Effect.fn("predicate")(function* (c: string) {
				yield* Ref.update(probed, (seen) => [...seen, c]);
				if (c === "b") return yield* Effect.fail("EACCES");
				return c === "c";
			});

			const found = yield* Walker.firstMatch(["a", "b", "c"], predicate);

			assert.deepStrictEqual(found, Option.some("c"));
			assert.deepStrictEqual(yield* Ref.get(probed), ["a", "b", "c"]);
		}),
	);

	// Pins the short-circuit. If `firstMatch` ever probes exhaustively and then
	// selects the first hit, this is the only test that notices: "c" must never
	// be probed once "b" matches.
	it.effect("short-circuits at the first match and probes no further", () =>
		Effect.gen(function* () {
			const probed = yield* Ref.make<ReadonlyArray<string>>([]);
			const predicate = Effect.fn("predicate")(function* (c: string) {
				yield* Ref.update(probed, (seen) => [...seen, c]);
				return c === "b";
			});

			const found = yield* Walker.firstMatch(["a", "b", "c"], predicate);

			assert.deepStrictEqual(found, Option.some("b"));
			assert.deepStrictEqual(yield* Ref.get(probed), ["a", "b"]);
		}),
	);

	// No other test's winning match is the FIRST candidate, so an implementation
	// that drops an index-0 match passes all of them. This is the only test that
	// probes the nearest directory actually winning — the most ordinary case.
	it.effect("matches the very first candidate", () =>
		Effect.gen(function* () {
			const probed = yield* Ref.make<ReadonlyArray<string>>([]);
			const predicate = Effect.fn("predicate")(function* (c: string) {
				yield* Ref.update(probed, (seen) => [...seen, c]);
				return c === "a";
			});

			const found = yield* Walker.firstMatch(["a", "b"], predicate);

			assert.deepStrictEqual(found, Option.some("a"));
			assert.deepStrictEqual(yield* Ref.get(probed), ["a"]);
		}),
	);

	// The catch-not-catchCause boundary. A predicate that dies is programmer
	// error and must not be reinterpreted as "this candidate didn't match".
	// `firstMatch`'s error channel is `never`, so a Failure exit can only be a defect.
	it.effect("propagates a defect rather than absorbing it", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				Walker.firstMatch(["a", "b"], (c) => (c === "b" ? Effect.die(new Error("boom")) : Effect.succeed(false))),
			);
			assert.strictEqual(exit._tag, "Failure");
		}),
	);
});

/**
 * A real memfs volume holding exactly `present` (as empty files). `findUpward`
 * probes with `exists`, which the volume answers honestly — no stub decides
 * what "present" means.
 */
const FsWith = (present: ReadonlyArray<string>) =>
	MemoryFileSystem.layerWith(Object.fromEntries(present.map((path) => [path, ""])));

/**
 * A volume holding `present` whose `exists` probe on `denied` fails
 * `PermissionDenied`. Every other probe delegates to the volume.
 */
const FsDenying = (denied: string, present: ReadonlyArray<string>) =>
	MemoryFileSystem.layerWith(Object.fromEntries(present.map((path) => [path, ""])), {
		faults: {
			exists: (path: string) =>
				path === denied
					? Effect.fail(
							PlatformError.systemError({
								_tag: "PermissionDenied",
								module: "FileSystem",
								method: "exists",
								pathOrDescriptor: path,
							}),
						)
					: undefined,
		},
	});

layer(FsWith(["/a/b/.apprc", "/a/.apprc"]))("findUpward, config in both directories", (it) => {
	it.effect("prefers the nearer directory", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
			assert.deepStrictEqual(found, Option.some("/a/b/.apprc"));
		}),
	);
});

layer(FsWith(["/a/.apprc"]))("findUpward, config only in the further directory", (it) => {
	it.effect("falls through to the further directory", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
			assert.deepStrictEqual(found, Option.some("/a/.apprc"));
		}),
	);
});

layer(FsWith(["/a/second.json"]))("findUpward, only the second candidate exists", (it) => {
	it.effect("honours candidate order within a single directory", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findUpward(["/a"], (dir) => [`${dir}/first.json`, `${dir}/second.json`]);
			assert.deepStrictEqual(found, Option.some("/a/second.json"));
		}),
	);
});

layer(FsWith([]))("findUpward, empty filesystem", (it) => {
	it.effect("returns none when no candidate exists", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
			assert.deepStrictEqual(found, Option.none());
		}),
	);
});

// Directory-major, not candidate-major: every candidate in the nearest directory
// is exhausted before ascending. No other test has BOTH several directories AND
// several candidates per directory, so an interleaving implementation passes all
// of them while letting a distant ancestor's `.apprc` beat a nearer
// `config/.apprc`. That is exactly the shape config-file's `subpaths` option uses.
layer(FsWith(["/a/b/config/.apprc", "/a/.apprc"]))("findUpward, near subpath vs far root file", (it) => {
	it.effect("exhausts the nearer directory's candidates before ascending", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`, `${dir}/config/.apprc`]);
			assert.deepStrictEqual(found, Option.some("/a/b/config/.apprc"));
		}),
	);
});

// Absorption through findUpward's OWN seam. Every other fs fixture succeeds, so a
// findUpward that lets one failing `exists` abort the whole walk passes all of them.
// This is the concrete failure config-file's resolvers depend on not happening: an
// unreadable directory must not hide a config above it. The denied candidate
// is genuinely present, so only the fault stands between the walk and
// `/a/b/.apprc`: disarm it and the answer moves to the nearer file.
layer(FsDenying("/a/b/.apprc", ["/a/b/.apprc", "/a/.apprc"]))("findUpward, unreadable nearer candidate", (it) => {
	it.effect("absorbs a denied probe and keeps ascending", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
			assert.deepStrictEqual(found, Option.some("/a/.apprc"));
		}),
	);
});

describe("Walker.findRoot", () => {
	it.effect("returns the nearest directory the marker predicate accepts", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findRoot(["/a/b/c", "/a/b", "/a"], (dir) => Effect.succeed(dir === "/a/b"));
			assert.deepStrictEqual(found, Option.some("/a/b"));
		}),
	);

	// The concrete failure the per-probe absorption rule exists to prevent.
	it.effect("does not let an unreadable ancestor hide a valid root above it", () =>
		Effect.gen(function* () {
			const isRoot = (dir: string) => (dir === "/a/b" ? Effect.fail("EACCES" as const) : Effect.succeed(dir === "/a"));
			const found = yield* Walker.findRoot(["/a/b/c", "/a/b", "/a", "/"], isRoot);
			assert.deepStrictEqual(found, Option.some("/a"));
		}),
	);

	it.effect("returns none when no directory is a root", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findRoot(["/a/b", "/a"], () => Effect.succeed(false));
			assert.deepStrictEqual(found, Option.none());
		}),
	);

	// No other test's winning directory is the FIRST candidate among several
	// accepting directories, so an implementation that returns the LAST match
	// instead of the first passes all of them. This is the only test that pins
	// "first wins" when more than one directory accepts.
	it.effect("prefers the nearest directory when multiple directories accept", () =>
		Effect.gen(function* () {
			const found = yield* Walker.findRoot(["/a/b", "/a"], () => Effect.succeed(true));
			assert.deepStrictEqual(found, Option.some("/a/b"));
		}),
	);

	// Short-circuit through findRoot's OWN seam. The other findRoot tests assert only
	// the returned Option, so a full linear scan that evaluates isRoot on every
	// directory passes all of them. A marker predicate can be expensive — isWorkspaceRoot
	// reads and parses package.json — so ancestors above the root must never be probed.
	it.effect("stops probing at the first accepting directory", () =>
		Effect.gen(function* () {
			const probed = yield* Ref.make<ReadonlyArray<string>>([]);
			const isRoot = Effect.fn("isRoot")(function* (dir: string) {
				yield* Ref.update(probed, (seen) => [...seen, dir]);
				return dir === "/a/b";
			});

			const found = yield* Walker.findRoot(["/a/b/c", "/a/b", "/a"], isRoot);

			assert.deepStrictEqual(found, Option.some("/a/b"));
			assert.deepStrictEqual(yield* Ref.get(probed), ["/a/b/c", "/a/b"]);
		}),
	);
});

// `git rev-parse --show-toplevel` answers the PHYSICAL root; a start reached
// through `/link -> /real` ascends a lexical chain that never spells it.
const linkedRepo = platform({ "/real/repo/packages/foo/x.txt": "x" }, { symlinks: { "/link": "/real" } });

layer(linkedRepo)("Walker.ascendWithin", (it) => {
	// The control: this fixture really does make `ascend`'s lexical ceiling fail
	// open, so the assertions below fail for the right reason.
	it.effect("ascend's lexical stopAt misses the physical ceiling behind a symlink", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascend("/link/repo/packages/foo", { stopAt: "/real/repo" });
			assert.strictEqual(dirs.at(-1), "/");
		}),
	);

	it.effect("stops at the lexical ancestor whose real path is the physical ceiling", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", Option.some("/real/repo"));
			assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo"]);
		}),
	);

	it.effect("stops at a ceiling spelled lexically, like ascend", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", Option.some("/link/repo/"));
			assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo"]);
		}),
	);

	it.effect("stops at the ceiling when no symlink is involved", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/real/repo/packages/foo", Option.some("/real/repo"));
			assert.deepStrictEqual(dirs, ["/real/repo/packages/foo", "/real/repo/packages", "/real/repo"]);
		}),
	);

	it.effect("runs to the root when the ceiling names no ancestor", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", Option.some("/elsewhere"));
			assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo", "/link", "/"]);
		}),
	);

	it.effect("truncates a chain longer than maxDepth", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", Option.some("/real/repo"), { maxDepth: 2 });
			assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages"]);
		}),
	);

	it.effect("ascends to the root, exactly as ascend does, when there is no ceiling", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", Option.none());
			assert.deepStrictEqual(dirs, yield* Walker.ascend("/link/repo/packages/foo"));
			assert.strictEqual(dirs.at(-1), "/");
		}),
	);

	it.effect("honours maxDepth when there is no ceiling", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", Option.none(), { maxDepth: 2 });
			assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages"]);
		}),
	);

	it.effect("dies on a relative ceiling, like ascend", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(Walker.ascendWithin("/link/repo/packages/foo", Option.some("real/repo")));
			assert.isTrue(exit._tag === "Failure" && Cause.hasDies(exit.cause));
		}),
	);
});

layer(
	platform(
		{ "/real/repo/packages/foo/x.txt": "x" },
		{ symlinks: { "/link": "/real" }, unresolvable: { "/link/repo/packages": "PermissionDenied" } },
	),
)("Walker.ascendWithin, an ancestor that cannot be resolved", (it) => {
	it.effect("absorbs the failed probe and still stops at the ceiling above it", () =>
		Effect.gen(function* () {
			const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", Option.some("/real/repo"));
			assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo"]);
		}),
	);
});
