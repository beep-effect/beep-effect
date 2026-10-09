import { assert, describe, it, layer } from "@effect/vitest";
import { GlobPattern, GlobPatternOptions } from "../../effected/glob/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import type { DescendOptions, DescendRecordOptions, DescendResult } from "../../effected/walker/Descend.ts";
import { DescendError, descend } from "../../effected/walker/Descend.ts";
import { platform } from "./fixtures.ts";

describe("DescendError — compatible payloads and exact messages", () => {
	it.effect("decodes depth exhaustion without a cap and keeps the base-directory fallback", () =>
		Effect.gen(function* () {
			const error = yield* S.decodeEffect(DescendError)({
				_tag: "DescendError", pattern: "**/*.ts", reason: "depthExceeded", path: "",
			});
			assert.strictEqual(error.reason, "depthExceeded");
			assert.strictEqual(error.limit, undefined);
			assert.strictEqual(error.message, 'glob descent for "**/*.ts" descended past the depth cap levels below the base directory');
		}),
	);

	it.effect("decodes an unreadable case with a legacy cap without using or discarding it", () =>
		Effect.gen(function* () {
			const error = yield* S.decodeEffect(DescendError)({
				_tag: "DescendError", pattern: "**/*.ts", reason: "unreadableDirectory", path: "src/locked", limit: 7,
			});
			assert.strictEqual(error.reason, "unreadableDirectory");
			assert.strictEqual(error.limit, 7);
			assert.strictEqual(error.message, 'glob descent for "**/*.ts" could not read "src/locked"');
		}),
	);

	it("quotes and escapes the full pattern and path synchronously", () => {
		const error = DescendError.make({
			pattern: 'a"\\\n*.ts', reason: "unreadableDirectory", path: 'src/"\\\tlocked',
		});
		assert.strictEqual(error.message, 'glob descent for "a\\"\\\\\\n*.ts" could not read "src/\\"\\\\\\tlocked"');
	});

	it("keeps a supplied zero cap and quoted directory in the depth message", () => {
		const error = DescendError.make({ pattern: "**/*", reason: "depthExceeded", path: "a/b", limit: 0 });
		assert.strictEqual(error.limit, 0);
		assert.strictEqual(error.message, 'glob descent for "**/*" descended past 0 levels below "a/b"');
	});
});

// The main tree: nesting, a dotfile, both default-pruned directories, and a
// second top-level directory so sorted output diverges from walk order.
const mainTree = {
	"/proj/readme.md": "",
	"/proj/dist/out.ts": "",
	"/proj/src/index.ts": "",
	"/proj/src/.hidden.ts": "",
	"/proj/src/lib/util.ts": "",
	"/proj/src/lib/deep/core.ts": "",
	"/proj/node_modules/dep/index.ts": "",
	"/proj/.git/hooks/config.ts": "",
};

layer(platform(mainTree))("descend, literal fast-path", (it) => {
	it.effect("returns the source when it resolves to a file", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("readme.md");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), ["readme.md"]);
		}),
	);

	it.effect("returns empty when the literal resolves to a directory", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), []);
		}),
	);

	it.effect("returns empty when the literal is missing — zero matches, not an error", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("no-such-file.md");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), []);
		}),
	);
});

layer(platform(mainTree))("descend, magic patterns", (it) => {
	it.effect("descends a globstar pattern through every level, sorted by relative path", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			// Walk order is breadth-first (lib/util.ts before lib/deep/core.ts);
			// sorted output pins deep/core.ts BEFORE util.ts.
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), [
				"src/index.ts",
				"src/lib/deep/core.ts",
				"src/lib/util.ts",
			]);
		}),
	);

	it.effect("matches a single-level * pattern one level only", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), ["src/index.ts"]);
		}),
	);

	it.effect("never descends the default prune list (node_modules, .git)", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), [
				"dist/out.ts",
				"src/index.ts",
				"src/lib/deep/core.ts",
				"src/lib/util.ts",
			]);
		}),
	);

	it.effect("a custom prune list replaces the default entirely", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*.ts");
			const found = yield* descend(pattern, { cwd: "/proj", prune: ["src", "dist", ".git"] });
			assert.deepStrictEqual(found, ["node_modules/dep/index.ts"]);
		}),
	);

	it.effect("skips dotfiles under default options and matches them when the pattern carries dot", () =>
		Effect.gen(function* () {
			// Dotfile semantics live in the COMPILED pattern, never in the walker.
			const plain = yield* GlobPattern.compile("src/*.ts");
			const dotted = yield* GlobPattern.compile("src/*.ts", GlobPatternOptions.make({ dot: true }));
			assert.deepStrictEqual(yield* descend(plain, { cwd: "/proj" }), ["src/index.ts"]);
			assert.deepStrictEqual(yield* descend(dotted, { cwd: "/proj" }), ["src/.hidden.ts", "src/index.ts"]);
		}),
	);

	it.effect("returns empty when the pattern's base directory is missing", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("missing/**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), []);
		}),
	);

	// `descend`'s defect posture is `ascend`'s: a bad bound is a programmer
	// error, never a silently-empty result. Assert the DIE specifically — a
	// typed DescendError is also a Failure exit, so `_tag` alone would let a
	// regression from defect to typed failure pass.
	it.effect("dies when maxDepth is 0", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const exit = yield* Effect.exit(descend(pattern, { cwd: "/proj", maxDepth: 0 }));
			assert.strictEqual(exit._tag, "Failure");
			if (exit._tag === "Failure") assert.isTrue(Cause.hasDies(exit.cause));
		}),
	);

	it.effect("dies when maxDepth is NaN", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const exit = yield* Effect.exit(descend(pattern, { cwd: "/proj", maxDepth: Number.NaN }));
			assert.strictEqual(exit._tag, "Failure");
			if (exit._tag === "Failure") assert.isTrue(Cause.hasDies(exit.cause));
		}),
	);

	it.effect("dies when maxDepth is not an integer", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const exit = yield* Effect.exit(descend(pattern, { cwd: "/proj", maxDepth: 2.5 }));
			assert.strictEqual(exit._tag, "Failure");
			if (exit._tag === "Failure") assert.isTrue(Cause.hasDies(exit.cause));
		}),
	);

	it.effect("a negated pattern matches files OUTSIDE its inner pattern's prefix", () =>
		Effect.gen(function* () {
			// `!src/*.ts` matches every walked file that src/*.ts does not — the
			// walk must start at cwd, not at the inner pattern's `src` prefix, or
			// readme.md and dist/out.ts silently vanish from the answer.
			const pattern = yield* GlobPattern.compile("!src/*.ts");
			const found = yield* descend(pattern, { cwd: "/proj" });
			assert.include(found, "readme.md");
			assert.include(found, "dist/out.ts");
			assert.notInclude(found, "src/index.ts");
		}),
	);
});

// Symlinks: a link to a file, a link to a directory, and a dangling link, all
// inside the walked subtree.
const symlinkTree = {
	"/proj/real/file.ts": "",
	"/proj/real/dir/inner.ts": "",
	"/proj/src/a.ts": "",
};
const symlinkOptions = {
	symlinks: {
		"/proj/src/link.ts": "/proj/real/file.ts",
		"/proj/src/linkdir": "/proj/real/dir",
		"/proj/src/ghost.ts": "/proj/real/gone.ts",
	},
};

layer(platform(symlinkTree, symlinkOptions))("descend, symlinks", (it) => {
	it.effect("matches a symlink that resolves to a file and skips a dangling one", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), ["src/a.ts", "src/link.ts"]);
		}),
	);

	it.effect("never descends into a symlinked directory", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			// linkdir/inner.ts must NOT appear; the same file is reachable (and
			// matched) only through its real path.
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), ["src/a.ts", "src/link.ts"]);
		}),
	);

	it.effect("still matches the symlinked directory's files through their real path", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), [
				"real/dir/inner.ts",
				"real/file.ts",
				"src/a.ts",
				"src/link.ts",
			]);
		}),
	);
});

// followSymlinks: the opt-in that gives descend Node's recursive-readdir and
// @actions/glob's default followSymbolicLinks behaviour — links to directories
// are entered, and the cycle guard becomes @actions/glob's per-branch
// traversalChain instead of the blanket refusal.
const followTree = {
	"/proj/real/file.ts": "",
	"/proj/real/dir/inner.ts": "",
	"/proj/src/a.ts": "",
};
const followOptions = {
	symlinks: {
		"/proj/src/link.ts": "/proj/real/file.ts",
		"/proj/src/linkdir": "/proj/real/dir",
		"/proj/src/ghost.ts": "/proj/real/gone.ts",
	},
};

layer(platform(followTree, followOptions))("descend, followSymlinks", (it) => {
	it.effect("descends into a symlinked directory under followSymlinks: true", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj", followSymlinks: true }), [
				"src/a.ts",
				"src/link.ts",
				"src/linkdir/inner.ts",
			]);
		}),
	);

	it.effect("explicit followSymlinks: false keeps the never-descend default", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj", followSymlinks: false }), [
				"src/a.ts",
				"src/link.ts",
			]);
		}),
	);

	it.effect("a dangling link is still no match under followSymlinks: true", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/*.ts");
			const found = yield* descend(pattern, { cwd: "/proj", followSymlinks: true });
			assert.notInclude(found, "src/ghost.ts");
		}),
	);
});

// Two sibling links resolving to the SAME target: not a cycle — the guard is
// per-branch (@actions/glob's traversalChain), so both enumerate. A
// walk-global visited set would silently drop whichever came second.
const siblingLinkTree = {
	"/proj/shared/inner.ts": "",
	"/proj/src/a.ts": "",
};
const siblingLinkOptions = {
	symlinks: {
		"/proj/src/one": "/proj/shared",
		"/proj/src/two": "/proj/shared",
	},
};

layer(platform(siblingLinkTree, siblingLinkOptions))("descend, followSymlinks sibling links", (it) => {
	it.effect("two links to one target both enumerate — the guard is per-branch, not walk-global", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj", followSymlinks: true }), [
				"src/a.ts",
				"src/one/inner.ts",
				"src/two/inner.ts",
			]);
		}),
	);
});

// A link back to the walk base: the guard seeds the base's real path, so the
// link is skipped instead of revisiting the whole tree through it.
const baseCycleTree = {
	"/proj/real/file.ts": "",
	"/proj/src/a.ts": "",
};
const baseCycleOptions = {
	symlinks: {
		"/proj/src/up": "/proj",
	},
};

layer(platform(baseCycleTree, baseCycleOptions))("descend, followSymlinks base cycle", (it) => {
	it.effect("a link to the walk base is skipped and the walk terminates", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*.ts");
			const found = yield* descend(pattern, { cwd: "/proj", followSymlinks: true });
			assert.deepStrictEqual(found, ["real/file.ts", "src/a.ts"]);
			assert.isFalse(found.some((entry) => entry.startsWith("src/up/")));
		}),
	);
});

// A mutual link cycle between two real directories: a link is skipped only
// when its real path is an ANCESTOR of the branch it sits on, so the walk
// terminates and every file is matched through both of its link-reachable
// paths.
const mutualCycleTree = {
	"/proj/a/x.ts": "",
	"/proj/b/y.ts": "",
};
const mutualCycleOptions = {
	symlinks: {
		"/proj/a/to-b": "/proj/b",
		"/proj/b/to-a": "/proj/a",
	},
};

layer(platform(mutualCycleTree, mutualCycleOptions))("descend, followSymlinks mutual cycle", (it) => {
	it.effect("terminates on a two-directory link cycle, matching files through both link paths", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj", followSymlinks: true }), [
				"a/to-b/y.ts",
				"a/x.ts",
				"b/to-a/x.ts",
				"b/y.ts",
			]);
		}),
	);
});

// A symlinked directory whose real path cannot be resolved. The walk never
// enters it (the guard cannot reason about a link it cannot identify), and
// the failure is VISIBLE under onUnreadable exactly as a failed readDirectory
// is — a silent skip would hand back a smaller answer with nothing reporting
// it, the failure "fail" exists to prevent. NotFound stays the benign race.
const unresolvableTree = {
	"/proj/real/dir/inner.ts": "",
	"/proj/src/a.ts": "",
};
const unresolvableOptions = {
	symlinks: { "/proj/src/linkdir": "/proj/real/dir" },
	unresolvable: { "/proj/src/linkdir": "PermissionDenied" as const },
};

layer(platform(unresolvableTree, unresolvableOptions))("descend, followSymlinks unresolvable link", (it) => {
	it.effect("fails typed by default, naming the link as the unreadable directory", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const error = yield* Effect.flip(descend(pattern, { cwd: "/proj", followSymlinks: true }));
			assert.strictEqual(error._tag, "DescendError");
			assert.strictEqual(error.reason, "unreadableDirectory");
			assert.strictEqual(error.path, "src/linkdir");
		}),
	);

	it.effect("records the link with the realPath failure under onUnreadable: record", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const result = yield* descend(pattern, { cwd: "/proj", followSymlinks: true, onUnreadable: "record" });
			assert.deepStrictEqual(result.matches, ["src/a.ts"]);
			assert.strictEqual(result.unreadable.length, 1);
			const [entry] = result.unreadable;
			assert.strictEqual(entry?.path, "src/linkdir");
			assert.strictEqual(entry?.cause.reason._tag, "PermissionDenied");
			assert.strictEqual(entry?.cause.reason.method, "realPath");
		}),
	);

	it.effect("skips the link and forgets it under onUnreadable: skip", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const found = yield* descend(pattern, { cwd: "/proj", followSymlinks: true, onUnreadable: "skip" });
			assert.deepStrictEqual(found, ["src/a.ts"]);
		}),
	);

	it.effect("the resolve never happens under followSymlinks: false, so the fault is unreachable", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), ["src/a.ts"]);
		}),
	);
});

// The same link, vanishing between the listing and the resolve.
const vanishedLinkOptions = {
	symlinks: { "/proj/src/linkdir": "/proj/real/dir" },
	unresolvable: { "/proj/src/linkdir": "NotFound" as const },
};

layer(platform(unresolvableTree, vanishedLinkOptions))("descend, followSymlinks vanished link", (it) => {
	it.effect("a NotFound on the resolve is a benign race: silent under fail, never recorded", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj", followSymlinks: true }), ["src/a.ts"]);
			const result = yield* descend(pattern, { cwd: "/proj", followSymlinks: true, onUnreadable: "record" });
			assert.deepStrictEqual(result.matches, ["src/a.ts"]);
			assert.deepStrictEqual(result.unreadable, []);
		}),
	);
});

// An unreadable directory inside the walked subtree.
const unreadableTree = {
	"/proj/src/a.ts": "",
	"/proj/src/locked/b.ts": "",
};
const unreadableOptions = { unreadable: HashSet.make("/proj/src/locked") };

layer(platform(unreadableTree, unreadableOptions))("descend, unreadable directory", (it) => {
	it.effect("fails typed by default, carrying the pattern and the offending relative directory", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const error = yield* Effect.flip(descend(pattern, { cwd: "/proj" }));
			assert.strictEqual(error._tag, "DescendError");
			assert.strictEqual(error.reason, "unreadableDirectory");
			assert.strictEqual(error.pattern, "src/**/*.ts");
			assert.strictEqual(error.path, "src/locked");
		}),
	);

	it.effect("absorbs the subtree and continues under onUnreadable: skip", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const found = yield* descend(pattern, { cwd: "/proj", onUnreadable: "skip" });
			assert.deepStrictEqual(found, ["src/a.ts"]);
		}),
	);

	it.effect("a single-level pattern never reads the unreadable subdirectory at all", () =>
		Effect.gen(function* () {
			// src/*.ts cannot match below one level, so descend never descends —
			// and the unreadable directory cannot fail a walk that never reads it.
			const pattern = yield* GlobPattern.compile("src/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), ["src/a.ts"]);
		}),
	);

	it.effect("records the unreadable subtree as data under onUnreadable: record, and still finds the rest", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const result = yield* descend(pattern, { cwd: "/proj", onUnreadable: "record" });
			assert.deepStrictEqual(result.matches, ["src/a.ts"]);
			assert.strictEqual(result.unreadable.length, 1);
			const [entry] = result.unreadable;
			assert.strictEqual(entry?.path, "src/locked");
			// The cause is the very PlatformError the walk absorbed — the injected
			// fault, not a re-read — so the caller never needs a second syscall.
			assert.strictEqual(entry?.cause._tag, "PlatformError");
			assert.strictEqual(entry?.cause.reason._tag, "PermissionDenied");
		}),
	);

	it.effect("onUnreadable: record does not change the default (fail) or skip behavior", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const error = yield* Effect.flip(descend(pattern, { cwd: "/proj" }));
			assert.strictEqual(error._tag, "DescendError");
			assert.strictEqual(error.reason, "unreadableDirectory");

			const skipped = yield* descend(pattern, { cwd: "/proj", onUnreadable: "skip" });
			assert.deepStrictEqual(skipped, ["src/a.ts"]);
		}),
	);
});

// A directory that vanishes between its parent's listing and its own read.
const vanishedTree = { "/proj/src/a.ts": "" };
const vanishedOptions = { vanished: HashSet.make("/proj/src/gone") };

layer(platform(vanishedTree, vanishedOptions))("descend, vanished directory", (it) => {
	it.effect("treats a NotFound mid-walk as a benign race, even under onUnreadable: fail", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), ["src/a.ts"]);
		}),
	);

	it.effect("a vanished (NotFound) directory is never recorded as unreadable", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("src/**/*.ts");
			const result = yield* descend(pattern, { cwd: "/proj", onUnreadable: "record" });
			assert.deepStrictEqual(result.matches, ["src/a.ts"]);
			assert.deepStrictEqual(result.unreadable, []);
		}),
	);
});

// The walk BASE itself is unreadable: its cwd-relative path is the empty
// string, so the record entry carries the `""` sentinel — with its cause.
const unreadableBaseTree = { "/proj/src/a.ts": "" };
const unreadableBaseOptions = { unreadable: HashSet.make("/proj") };

layer(platform(unreadableBaseTree, unreadableBaseOptions))("descend, unreadable walk base", (it) => {
	it.effect("records the base as the empty-string path, carrying the cause, with no matches", () =>
		Effect.gen(function* () {
			// No literal prefix, so the walk starts at cwd itself.
			const pattern = yield* GlobPattern.compile("**/*.ts");
			const result = yield* descend(pattern, { cwd: "/proj", onUnreadable: "record" });
			assert.deepStrictEqual(result.matches, []);
			assert.strictEqual(result.unreadable.length, 1);
			const [entry] = result.unreadable;
			assert.strictEqual(entry?.path, "");
			assert.strictEqual(entry?.cause.reason._tag, "PermissionDenied");
		}),
	);
});

// A tree deep enough to trip a small maxDepth.
const deepTree = { "/proj/a/b/c/d.ts": "" };

layer(platform(deepTree))("descend, depth cap", (it) => {
	it.effect("fails typed when the walk would descend past maxDepth — never truncates", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*.ts");
			const error = yield* Effect.flip(descend(pattern, { cwd: "/proj", maxDepth: 1 }));
			assert.strictEqual(error._tag, "DescendError");
			assert.strictEqual(error.reason, "depthExceeded");
			assert.strictEqual(error.pattern, "**/*.ts");
			assert.strictEqual(error.path, "a");
			assert.strictEqual(error.limit, 1);
		}),
	);

	it.effect("succeeds when maxDepth admits the whole tree", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*.ts");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj", maxDepth: 3 }), ["a/b/c/d.ts"]);
		}),
	);
});

// A readable tree ABOVE the walk root: escapes would find real files here, so
// an empty answer proves confinement rather than accidental absence.
const escapeTree = {
	"/secret/token.txt": "",
	"/proj/readme.md": "",
	"/proj/src/index.ts": "",
};

layer(platform(escapeTree))("descend, cwd confinement", (it) => {
	it.effect("a literal pattern climbing above cwd is zero matches, never a read outside", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("../secret/token.txt");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), []);
		}),
	);

	it.effect("a magic pattern whose prefix climbs above cwd is zero matches", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("../secret/**");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), []);
		}),
	);

	it.effect("interior .. segments that stay under cwd are refused only when they climb above it", () =>
		Effect.gen(function* () {
			// src/../readme.md never leaves /proj — matching is lexical and walked
			// paths carry no "..", so this is still zero matches, but it must not
			// be conflated with an escape defect: both answers are [] by contract.
			const pattern = yield* GlobPattern.compile("src/../../secret/token.txt");
			assert.deepStrictEqual(yield* descend(pattern, { cwd: "/proj" }), []);
		}),
	);
});

// A FILE named .git — the submodule/worktree gitlink layout. Prune suppresses
// directories only; the file stays matchable.
const gitlinkTree = {
	"/proj/sub/.git": "",
	"/proj/sub/main.ts": "",
	"/proj/.git/config": "",
};

layer(platform(gitlinkTree))("descend, prune is directory-only", (it) => {
	it.effect("a file named by a prune entry still matches; the directory of the same name never descends", () =>
		Effect.gen(function* () {
			const pattern = yield* GlobPattern.compile("**/*", GlobPatternOptions.make({ dot: true }));
			const found = yield* descend(pattern, { cwd: "/proj" });
			assert.include(found, "sub/.git");
			assert.include(found, "sub/main.ts");
			assert.notInclude(found, ".git/config");
		}),
	);
});

// The overloads are a type-level contract, and the thing that makes them safe
// is what `DescendOptions` REFUSES: if it admitted `"record"`, a value widened
// to it would pick the array-returning overload at compile time while the
// implementation resolved a `DescendResult` at runtime, and every array method
// on that result would fail with no type error anywhere. These assertions run
// at typecheck, not at runtime — `types:check` is what enforces them.
describe("descend — overload resolution", () => {
	it("resolves each options shape to the right return type", () => {
		type SuccessOf<T> = T extends Effect.Effect<infer A, unknown, unknown> ? A : never;
		const pattern = Effect.runSync(GlobPattern.compile("**/*", GlobPatternOptions.make({})));

		// An inline literal carrying "record" selects the DescendResult overload.
		const inline = descend(pattern, { cwd: "/x", onUnreadable: "record" });
		const _inline: SuccessOf<typeof inline> = { matches: [], unreadable: [] } satisfies DescendResult;

		// So does a value annotated as DescendRecordOptions — the case a bare
		// intersection got wrong, because widening erased the literal.
		const recordOpts: DescendRecordOptions = { cwd: "/x", onUnreadable: "record" };
		const viaRecord = descend(pattern, recordOpts);
		const _viaRecord: SuccessOf<typeof viaRecord> = { matches: [], unreadable: [] } satisfies DescendResult;

		// DescendOptions is the array contract and stays that way.
		const plainOpts: DescendOptions = { cwd: "/x", onUnreadable: "skip" };
		const viaPlain = descend(pattern, plainOpts);
		const _viaPlain: SuccessOf<typeof viaPlain> = ["a.ts"];
		void [_inline, _viaRecord, _viaPlain];

		// The guard itself: "record" is not a member of DescendOptions, so it
		// cannot reach the array-returning overload by being widened first.
		// @ts-expect-error "record" is deliberately absent from DescendOptions
		const _refused: DescendOptions = { cwd: "/x", onUnreadable: "record" };

		assert.isFunction(descend);
	});
});
