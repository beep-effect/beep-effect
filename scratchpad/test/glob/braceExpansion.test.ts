// Task 2 unit + hardening tests for the balanced-match and brace-expansion
// ports. The engine is pure sync — no Effect in this file.

import { assert, describe, it } from "@effect/vitest";
import { balanced } from "../../effected/glob/internal/balancedMatch.ts";
import { expand } from "../../effected/glob/internal/braceExpansion.ts";
import { GuardExceeded, InvalidCap } from "../../effected/glob/internal/limits.ts";

const reasonOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		if (e instanceof GuardExceeded) return e.reason;
		throw e;
	}
	throw new Error("expected a GuardExceeded throw");
};

describe("balancedMatch", () => {
	it("finds the first balanced pair", () => {
		assert.deepStrictEqual(balanced("{", "}", "pre{in{nest}}post"), {
			start: 3,
			end: 12,
			pre: "pre",
			body: "in{nest}",
			post: "post",
		});
	});

	it("returns false when there is no balanced pair", () => {
		assert.isFalse(balanced("{", "}", "no close {"));
		assert.isFalse(balanced("{", "}", "no open }"));
		assert.isFalse(balanced("{", "}", "nothing at all"));
	});

	it("handles an empty body", () => {
		assert.deepStrictEqual(balanced("{", "}", "a{}b"), {
			start: 1,
			end: 2,
			pre: "a",
			body: "",
			post: "b",
		});
	});

	it("accepts regexp delimiters", () => {
		const r = balanced(/\{/, /\}/, "x{y}z");
		assert.isObject(r);
		assert.strictEqual(r === false ? "" : r.body, "y");
	});

	it("uses the first-closing pair when delimiters are identical", () => {
		assert.deepStrictEqual(balanced("|", "|", "a|b|c"), {
			start: 1,
			end: 3,
			pre: "a",
			body: "b",
			post: "c",
		});
	});

	it("picks the leftmost outer pair among several", () => {
		const r = balanced("{", "}", "a{b}c{d}e");
		assert.isObject(r);
		assert.strictEqual(r === false ? "" : r.body, "b");
	});

	it("matches multi-character delimiters", () => {
		const r = balanced("<b>", "</b>", "pre<b>bold</b>post");
		assert.isObject(r);
		assert.strictEqual(r === false ? "" : r.body, "bold");
	});

	it("completes fast on a long pathological input (iterative, no guard needed)", () => {
		const long = `${"{".repeat(50_000)}a`;
		assert.isFalse(balanced("{", "}", long));
	});
});

describe("braceExpansion", () => {
	it("expands comma sets", () => {
		assert.deepStrictEqual(expand("a{b,c}d"), ["abd", "acd"]);
	});

	it("expands nested sets", () => {
		assert.deepStrictEqual(expand("a{b,c{d,e}f}g"), ["abg", "acdfg", "acefg"]);
	});

	it("expands cross products", () => {
		assert.deepStrictEqual(expand("{a,b}{c,d}"), ["ac", "ad", "bc", "bd"]);
	});

	it("expands empty members", () => {
		assert.deepStrictEqual(expand("a{b,}c"), ["abc", "ac"]);
	});

	it("expands numeric sequences", () => {
		assert.deepStrictEqual(expand("a{0..3}d"), ["a0d", "a1d", "a2d", "a3d"]);
	});

	it("expands padded sequences", () => {
		assert.deepStrictEqual(expand("{01..03}"), ["01", "02", "03"]);
	});

	it("expands stepped sequences", () => {
		assert.deepStrictEqual(expand("{1..10..3}"), ["1", "4", "7", "10"]);
	});

	it("expands reverse sequences", () => {
		assert.deepStrictEqual(expand("{3..1}"), ["3", "2", "1"]);
	});

	it("expands negative sequences", () => {
		assert.deepStrictEqual(expand("{-1..1}"), ["-1", "0", "1"]);
	});

	it("expands alpha sequences with step", () => {
		assert.deepStrictEqual(expand("{a..e..2}"), ["a", "c", "e"]);
	});

	it("leaves invalid sets unexpanded", () => {
		assert.deepStrictEqual(expand("a{2..}b"), ["a{2..}b"]);
		assert.deepStrictEqual(expand("a{b}c"), ["a{b}c"]);
	});

	it("expands the doubled-brace single-member form", () => {
		assert.deepStrictEqual(expand("x{{a,b}}y"), ["x{a}y", "x{b}y"]);
	});

	it("preserves a leading {} at top level", () => {
		assert.deepStrictEqual(expand("{},a}b"), ["{},a}b"]);
	});

	it("rewrites the a{},b}c shape like Bash", () => {
		assert.deepStrictEqual(expand("a{},b}c"), ["a}c", "abc"]);
	});

	it("does not expand escaped braces", () => {
		assert.deepStrictEqual(expand("\\{a,b\\}"), ["{a,b}"]);
	});

	it("treats escaped commas as literal", () => {
		assert.deepStrictEqual(expand("{a\\,b,c}"), ["a,b", "c"]);
	});

	it("preserves dollar-prefixed brace groups", () => {
		// Built by concatenation: a literal "${...}" in a plain string trips the
		// noTemplateCurlyInString lint, but here it IS the glob syntax under test.
		const dollarGroup = "$" + "{a,b}";
		assert.deepStrictEqual(expand(dollarGroup), [dollarGroup]);
		assert.deepStrictEqual(expand(`${dollarGroup}{c,d}`), [`${dollarGroup}c`, `${dollarGroup}d`]);
	});

	it("returns an empty array for empty input", () => {
		assert.deepStrictEqual(expand(""), []);
	});
});

describe("braceExpansion hardening", () => {
	it("fails typed on nesting past the cap, never a stack overflow", () => {
		// The comma is load-bearing: a comma-free {{{...}}} never recurses upstream
		// (returned unexpanded); comma-bearing nesting descends one expand_ frame
		// per level.
		const bomb = `${"{".repeat(300)}a,b${"}".repeat(300)}`;
		assert.strictEqual(
			reasonOf(() => expand(bomb)),
			"NestingDepthExceeded",
		);
	});

	it("returns a comma-free deep nest unexpanded without recursing (upstream shape)", () => {
		const inert = `${"{".repeat(300)}a${"}".repeat(300)}`;
		assert.deepStrictEqual(expand(inert), [inert]);
	});

	it("fails typed when the expansion budget is exhausted", () => {
		// 2^17 = 131_072 > 100_000
		const bomb = "{a,b}".repeat(17);
		assert.strictEqual(
			reasonOf(() => expand(bomb)),
			"ExpansionBudgetExceeded",
		);
	});

	it("honours a caller-lowered budget", () => {
		assert.strictEqual(
			reasonOf(() => expand("{a,b}{c,d}", { max: 3 })),
			"ExpansionBudgetExceeded",
		);
		assert.lengthOf(expand("{a,b}{c,d}", { max: 4 }), 4);
	});

	it("survives the a{},{},{} exponential-blowup shape (lazy post preserved)", () => {
		const r = expand(`a${"{},".repeat(60)}b`);
		assert.isArray(r); // completing within the test timeout IS the assertion
	});

	it("survives a {a},b} rewrite chain under the cap (for-loop rewrite preserved)", () => {
		assert.isArray(expand(`${"{a},".repeat(200)}b}`));
	});

	it("fails typed, not with a stack overflow, past the sequential-group cap", () => {
		// Each sequential group is one parseCommaParts frame; upstream left this
		// surface unguarded and would recurse 5000 deep here.
		assert.strictEqual(
			reasonOf(() => expand(`${"{a},".repeat(5000)}b}`)),
			"NestingDepthExceeded",
		);
	});

	it("guards nested comma members in expand_", () => {
		const deep = `{a,${"{b,".repeat(300)}c${"}".repeat(300)}}`;
		assert.strictEqual(
			reasonOf(() => expand(deep)),
			"NestingDepthExceeded",
		);
	});

	it("guards parseCommaParts against long sequential group chains", () => {
		// Sequential {x} groups recurse through parseCommaParts on the post side.
		const chain = `{${"{x},".repeat(300)}y}`;
		assert.strictEqual(
			reasonOf(() => expand(chain)),
			"NestingDepthExceeded",
		);
	});

	it("dies on a NaN or non-integer max, programmer error rather than input error", () => {
		assert.throws(() => expand("x{a,b}", { max: Number.NaN }), InvalidCap);
		assert.throws(() => expand("x{a,b}", { max: 1.5 }), InvalidCap);
		assert.throws(() => expand("x{a,b}", { max: 0 }), InvalidCap);
	});

	it("stays fast and exact just under the budget", () => {
		// 2^16 = 65_536 <= 100_000: expands fully, no throw
		const r = expand("{a,b}".repeat(16));
		assert.lengthOf(r, 65_536);
	});
});
