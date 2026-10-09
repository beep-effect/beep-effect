import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import { resolveEntryPoint } from "../../effected/package-json/EntryPoint.ts";

const resolve = (manifest: { exports?: unknown; main?: unknown }, conditions?: ReadonlyArray<string>) =>
	resolveEntryPoint(manifest, conditions === undefined ? undefined : { conditions });

/** The resolved path, or `null` — keeps the assertions readable. */
const entry = (manifest: { exports?: unknown; main?: unknown }, conditions?: ReadonlyArray<string>): string | null => {
	const result = resolve(manifest, conditions);
	return Result.isSuccess(result) ? result.success : null;
};

/** The reason resolution failed, or `null` when it succeeded. */
const reason = (manifest: { exports?: unknown; main?: unknown }, conditions?: ReadonlyArray<string>): string | null => {
	const result = resolve(manifest, conditions);
	return Result.isFailure(result) ? result.failure.reason : null;
};

describe("resolveEntryPoint", () => {
	describe("the three legal exports spellings", () => {
		it("reads the string shorthand", () => {
			assert.strictEqual(entry({ exports: "./index.js" }), "./index.js");
		});

		it("reads a subpath map's root entry", () => {
			assert.strictEqual(entry({ exports: { ".": "./index.js" } }), "./index.js");
		});

		it("reads conditions under a subpath map's root entry", () => {
			assert.strictEqual(entry({ exports: { ".": { import: "./esm.js", require: "./cjs.js" } } }), "./esm.js");
		});

		it('reads root conditions, which have no "." key', () => {
			assert.strictEqual(entry({ exports: { import: "./esm.js", default: "./any.js" } }), "./esm.js");
		});
	});

	describe("condition priority is the caller's policy", () => {
		it("honours the requested order rather than the manifest's key order", () => {
			// The same manifest resolves to different files under different
			// condition lists, which is the entire point of the option.
			const manifest = { exports: { require: "./cjs.js", import: "./esm.js" } };
			assert.strictEqual(entry(manifest, ["import"]), "./esm.js");
			assert.strictEqual(entry(manifest, ["require"]), "./cjs.js");
		});

		it("prefers import over default by default", () => {
			assert.strictEqual(entry({ exports: { default: "./any.js", import: "./esm.js" } }), "./esm.js");
		});

		it("falls to default when the preferred condition is absent", () => {
			assert.strictEqual(entry({ exports: { default: "./any.js" } }), "./any.js");
		});

		it("resolves nested conditions, where a non-recursive reader answers an object", () => {
			assert.strictEqual(entry({ exports: { import: { node: "./node.js" } } }, ["import", "node"]), "./node.js");
		});
	});

	describe("exports encapsulates the package", () => {
		it("does NOT fall back to main when exports is present and nothing matched", () => {
			// Node's rule, and the divergence from the lenient reading: falling
			// through here answers a file the package deliberately does not
			// export, which then loads and behaves plausibly instead of failing.
			assert.strictEqual(entry({ exports: { require: "./cjs.js" }, main: "./legacy.js" }, ["import"]), null);
		});

		it("answers nothing for an empty exports object, which exports nothing", () => {
			assert.strictEqual(entry({ exports: {}, main: "./legacy.js" }), null);
		});

		it("answers nothing for a subpath map with no root entry", () => {
			assert.strictEqual(entry({ exports: { "./sub": "./sub.js" }, main: "./legacy.js" }), null);
		});

		it("names WHICH shape blocked resolution, so a caller can log it", () => {
			// Three different shapes, three different responses. Collapsing them
			// into one sentinel is the same quiet wrong answer as an untyped
			// error channel — a consumer debugging someone else's plugin at 3am
			// needs to know which one it hit.
			assert.strictEqual(reason({ exports: { require: "./cjs.js" } }, ["import"]), "noConditionMatched");
			assert.strictEqual(reason({ exports: { "./sub": "./sub.js" } }), "noRootExport");
			assert.strictEqual(reason({ exports: ["./a.js"] }), "unsupportedExportsForm");
		});

		it("carries the conditions it tried, so the message names them", () => {
			const result = resolve({ exports: { require: "./cjs.js" } }, ["import", "node"]);
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				assert.deepStrictEqual([...(result.failure.conditions ?? [])], ["import", "node"]);
				assert.include(result.failure.message, "import");
			}
		});

		it("answers nothing for an array fallback list rather than guessing", () => {
			// Unimplemented, and said so honestly: a guess here would be
			// indistinguishable from a correct answer at the call site.
			assert.strictEqual(entry({ exports: ["./a.js", "./b.js"], main: "./legacy.js" }), null);
		});
	});

	describe("the legacy path, only when exports is absent", () => {
		it("reads main", () => {
			assert.strictEqual(entry({ main: "./legacy.js" }), "./legacy.js");
		});

		it("defaults to index.js when there is no main either", () => {
			assert.strictEqual(entry({}), "index.js");
		});

		it("ignores an empty or non-string main", () => {
			assert.strictEqual(entry({ main: "" }), "index.js");
			assert.strictEqual(entry({ main: 42 }), "index.js");
		});
	});
});
