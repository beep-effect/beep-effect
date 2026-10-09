// The compile+expand recipe: one call, one typed error, both causes intact.

import { assert, describe, it, layer } from "@effect/vitest";
import { GlobPatternError, GlobPatternOptions } from "../../effected/glob/index.ts";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import { DescendError } from "../../effected/walker/Descend.ts";
import { GlobExpansionError, compileAndExpand } from "../../effected/walker/Expand.ts";
import { platform } from "./fixtures.ts";

/** The defaults, spelled out — what a caller passes to mean "no option refinements". */
const defaults = GlobPatternOptions.make({});

describe("GlobExpansionError — exact synchronous messages", () => {
	it("quotes the pattern and preserves every nested descent message byte", () => {
		const pattern = 'a"\\\n*.ts';
		const cause = DescendError.make({ pattern, reason: "unreadableDirectory", path: 'src/"\\\tlocked' });
		const error = GlobExpansionError.make({ pattern, cause });
		assert.strictEqual(error.cause, cause);
		assert.strictEqual(error.message, 'glob expansion of "a\\"\\\\\\n*.ts" failed during descend: glob descent for "a\\"\\\\\\n*.ts" could not read "src/\\"\\\\\\tlocked"');
	});

	it("does not truncate a pattern of exactly 64 characters", () => {
		const pattern = "a".repeat(64);
		const cause = DescendError.make({ pattern, reason: "depthExceeded", path: "" });
		const error = GlobExpansionError.make({ pattern, cause });
		assert.strictEqual(error.message, `glob expansion of "${pattern}" failed during descend: glob descent for "${pattern}" descended past the depth cap levels below the base directory`);
	});

	it("truncates only the expansion prefix after 64 characters and keeps the full cause", () => {
		const prefix = "a".repeat(64);
		const pattern = `${prefix}tail`;
		const cause = DescendError.make({ pattern, reason: "unreadableDirectory", path: "" });
		const error = GlobExpansionError.make({ pattern, cause });
		assert.strictEqual(error.message, `glob expansion of "${prefix}…" failed during descend: glob descent for "${pattern}" could not read the base directory`);
	});
});

const tree = {
	"/proj/readme.md": "",
	"/proj/src/index.ts": "",
	"/proj/src/.hidden.ts": "",
	"/proj/src/lib/util.ts": "",
};

layer(platform(tree))("compileAndExpand, expansion", (it) => {
	it.effect("compiles a pattern source and expands it in one call", () =>
		Effect.gen(function* () {
			const files = yield* compileAndExpand("src/**/*.ts", { cwd: "/proj", glob: defaults });
			assert.deepStrictEqual(files, ["src/index.ts", "src/lib/util.ts"]);
		}),
	);

	it.effect("a literal pattern fast-paths, exactly as descend does", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* compileAndExpand("readme.md", { cwd: "/proj", glob: defaults }), ["readme.md"]);
		}),
	);

	it.effect("zero matches is an empty result, never a failure", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* compileAndExpand("src/**/*.js", { cwd: "/proj", glob: defaults }), []);
			assert.deepStrictEqual(yield* compileAndExpand("nope/**/*.ts", { cwd: "/proj", glob: defaults }), []);
		}),
	);

	// The consumer's bug, at the surface that is supposed to prevent it: two call
	// sites of one entry point, differing only in the `glob` they each spell out.
	// Required `glob` is what makes the divergence a visible difference between
	// two spellings rather than the absence of one.
	it.effect("dotfile semantics come from the glob options the call site states", () =>
		Effect.gen(function* () {
			const withDot = yield* compileAndExpand("src/*.ts", {
				cwd: "/proj",
				glob: GlobPatternOptions.make({ dot: true }),
			});
			const withDefaults = yield* compileAndExpand("src/*.ts", { cwd: "/proj", glob: defaults });

			assert.deepStrictEqual(withDot, ["src/.hidden.ts", "src/index.ts"]);
			assert.deepStrictEqual(withDefaults, ["src/index.ts"]);
		}),
	);

	it.effect("passes descend options straight through", () =>
		Effect.gen(function* () {
			// Walks from cwd, so `src/lib` sits two levels below the base and trips
			// the cap — proving maxDepth reaches descend rather than being dropped.
			const error = yield* Effect.flip(compileAndExpand("**/*.ts", { cwd: "/proj", glob: defaults, maxDepth: 1 }));
			assert.strictEqual(error.stage, "descend");
			assert.strictEqual(error.cause._tag, "DescendError");
			if (error.cause._tag !== "DescendError") return;
			assert.strictEqual(error.cause.reason, "depthExceeded");
			assert.strictEqual(error.cause.limit, 1);
		}),
	);
});

layer(platform(tree))("compileAndExpand, compile failure", (it) => {
	it.effect("an uncompilable pattern fails as GlobExpansionError at the compile stage", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(compileAndExpand("a".repeat(65_537), { cwd: "/proj", glob: defaults }));
			assert.instanceOf(error, GlobExpansionError);
			assert.strictEqual(error._tag, "GlobExpansionError");
			assert.strictEqual(error.stage, "compile");
		}),
	);

	it.effect("keeps the underlying GlobPatternError payload intact", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(compileAndExpand("{a,b}".repeat(17), { cwd: "/proj", glob: defaults }));
			assert.strictEqual(error.cause._tag, "GlobPatternError");
			assert.instanceOf(error.cause, GlobPatternError);
			if (error.cause._tag !== "GlobPatternError") return;
			assert.strictEqual(error.cause.reason, "ExpansionBudgetExceeded");
			assert.isAbove(error.cause.actual, 0);
			assert.isAbove(error.cause.limit, 0);
		}),
	);

	it.effect("carries the offending pattern source and chains as a native Error cause", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(compileAndExpand("{a,b}".repeat(17), { cwd: "/proj", glob: defaults }));
			assert.strictEqual(error.pattern, "{a,b}".repeat(17));
			assert.instanceOf(error, Error);
			const nativeError: Error = error;
			assert.strictEqual(error.cause, nativeError.cause);
			assert.include(error.message, "compile");
		}),
	);

	it.effect("never touches the filesystem when the pattern does not compile", () =>
		Effect.gen(function* () {
			// A pattern rejected at compile time cannot reach a walk, so a cwd that
			// does not exist is irrelevant — the compile stage decides first.
			const error = yield* Effect.flip(compileAndExpand("a".repeat(65_537), { cwd: "/nonexistent", glob: defaults }));
			assert.strictEqual(error.stage, "compile");
		}),
	);
});

const unreadableTree = {
	"/proj/src/a.ts": "",
	"/proj/src/locked/b.ts": "",
};

layer(platform(unreadableTree, { unreadable: HashSet.make("/proj/src/locked") }))(
	"compileAndExpand, descend failure",
	(it) => {
		it.effect("an unreadable directory fails as GlobExpansionError at the descend stage", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(compileAndExpand("src/**/*.ts", { cwd: "/proj", glob: defaults }));
				assert.instanceOf(error, GlobExpansionError);
				assert.strictEqual(error.stage, "descend");
			}),
		);

		it.effect("keeps the underlying DescendError payload intact", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(compileAndExpand("src/**/*.ts", { cwd: "/proj", glob: defaults }));
				assert.strictEqual(error.cause._tag, "DescendError");
				assert.instanceOf(error.cause, DescendError);
				if (error.cause._tag !== "DescendError") return;
				assert.strictEqual(error.cause.reason, "unreadableDirectory");
				assert.strictEqual(error.cause.path, "src/locked");
			}),
		);

		// The point of one tag with a discriminated cause: a caller catches once,
		// then still tells "your pattern is malformed" from "I could not read that
		// directory" — two different problems with two different fixes.
		it.effect("one catch discriminates both causes", () =>
			Effect.gen(function* () {
				const describe = (error: GlobExpansionError): string =>
					error.cause._tag === "GlobPatternError"
						? `bad pattern: ${error.cause.reason}`
						: `unreadable: ${error.cause.path}`;

				const compileFailure = yield* Effect.flip(
					compileAndExpand("a".repeat(65_537), { cwd: "/proj", glob: defaults }),
				);
				const descendFailure = yield* Effect.flip(compileAndExpand("src/**/*.ts", { cwd: "/proj", glob: defaults }));

				assert.strictEqual(describe(compileFailure), "bad pattern: PatternTooLong");
				assert.strictEqual(describe(descendFailure), "unreadable: src/locked");
			}),
		);

		it.effect("onUnreadable: skip absorbs the subtree and succeeds", () =>
			Effect.gen(function* () {
				const files = yield* compileAndExpand("src/**/*.ts", {
					cwd: "/proj",
					glob: defaults,
					onUnreadable: "skip",
				});
				assert.deepStrictEqual(files, ["src/a.ts"]);
			}),
		);
	},
);
