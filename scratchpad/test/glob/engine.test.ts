// Task 3 unit tests for the minimatch core port: escape/unescape, character
// classes, the pattern-length assertion, Minimatch smoke behavior, the
// platform deviation, and reachability of the new AST depth guards.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import { minimatch as oracle } from "minimatch";
import { assertValidPattern, InvalidPattern } from "../../effected/glob/internal/assertValidPattern.ts";
import { expand } from "../../effected/glob/internal/braceExpansion.ts";
import { escape as escapePattern } from "../../effected/glob/internal/escape.ts";
import { GuardExceeded, GuardMeasurement, GuardReason, InvalidCap, isGuardExceeded } from "../../effected/glob/internal/limits.ts";
import { Minimatch, braceExpand } from "../../effected/glob/internal/minimatch.ts";
import { unescape as unescapePattern } from "../../effected/glob/internal/unescape.ts";

const reasonOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		if (S.is(GuardExceeded)(e)) return e.reason;
		throw e;
	}
	throw new Error("expected a GuardExceeded throw");
};

describe("optional-options pipeable APIs", () => {
	it("preserves omitted and explicit options in both call forms", () => {
		for (const options of [undefined, {}]) {
			assert.strictEqual(pipe("a*b?", escapePattern(options)), escapePattern("a*b?", options));
			assert.strictEqual(pipe("a\\*b\\?", unescapePattern(options)), unescapePattern("a\\*b\\?", options));
			assert.deepStrictEqual(pipe("{a,b}", expand(options)), expand("{a,b}", options));
			assert.deepStrictEqual(pipe("{a,b}", braceExpand(options)), braceExpand("{a,b}", options));
		}
		assert.strictEqual(pipe("a*b", escapePattern()), "a\\*b");
		assert.strictEqual(pipe("a\\*b", unescapePattern()), "a*b");
		assert.deepStrictEqual(pipe("{a,b}", expand()), ["a", "b"]);
		assert.deepStrictEqual(pipe("{a,b}", braceExpand()), ["a", "b"]);
		assert.strictEqual(pipe("{a}*", escapePattern({ magicalBraces: true, windowsPathsNoEscape: true })), "[{]a[}][*]");
		assert.strictEqual(pipe("[{]a[}][*]", unescapePattern({ magicalBraces: true, windowsPathsNoEscape: true })), "{a}*");
		assert.deepStrictEqual(pipe("{a,b}", braceExpand({ nobrace: true })), ["{a,b}"]);
		assert.strictEqual(reasonOf(() => pipe("{a,b}", expand({ max: 1 }))), "ExpansionBudgetExceeded");
		assert.strictEqual(reasonOf(() => pipe("{a,b}", braceExpand({ braceExpandMax: 1 }))), "ExpansionBudgetExceeded");
	});
});

describe("GuardExceeded schema and factory", () => {
	it.effect("preserves factory fields, message, name and schema identity through the codec", () =>
		Effect.gen(function* () {
			for (const reason of GuardReason.literals) {
				const error = GuardExceeded.fromReason(reason, 256, 257);
				const fields = {
					_tag: "GuardExceeded",
					reason,
					limit: 256,
					actual: 257,
					message: `${reason}: limit 256, actual 257`,
				};
				assert.instanceOf(error, GuardExceeded);
				assert.isTrue(isGuardExceeded(error));
				assert.isTrue(S.is(GuardExceeded)(error));
				assert.strictEqual(error.name, "Error");
				assert.strictEqual(error.message, fields.message);
				assert.deepStrictEqual(yield* S.encodeEffect(GuardExceeded)(error), fields);
				const decoded = yield* S.decodeUnknownEffect(GuardExceeded)(fields);
				assert.instanceOf(decoded, GuardExceeded);
				assert.isTrue(isGuardExceeded(decoded));
				assert.strictEqual(decoded._tag, "GuardExceeded");
				assert.strictEqual(decoded.name, "Error");
				assert.strictEqual(decoded.message, error.message);
				assert.strictEqual(decoded.reason, error.reason);
				assert.strictEqual(decoded.limit, error.limit);
				assert.strictEqual(decoded.actual, error.actual);
				const made = GuardExceeded.make({ reason, limit: 256, actual: 257, message: fields.message });
				assert.instanceOf(made, GuardExceeded);
				assert.strictEqual(made.name, "Error");
				assert.deepStrictEqual(yield* S.encodeEffect(GuardExceeded)(made), fields);
			}
		}),
	);

	it.effect("preserves Infinity measurements in factory construction and schema round trips", () =>
		Effect.gen(function* () {
			const error = GuardExceeded.fromReason("ExpansionBudgetExceeded", 100_000, Infinity);
			assert.strictEqual(error.actual, Infinity);
			assert.strictEqual(error.message, "ExpansionBudgetExceeded: limit 100000, actual Infinity");
			const encoded = yield* S.encodeEffect(GuardExceeded)(error);
			assert.strictEqual(encoded.actual, Infinity);
			const decoded = yield* S.decodeEffect(GuardExceeded)(encoded);
			assert.instanceOf(decoded, GuardExceeded);
			assert.strictEqual(decoded.actual, Infinity);
			assert.strictEqual(decoded.message, error.message);
			assert.strictEqual(decoded.name, "Error");
		}),
	);

	it("accepts finite and overflowing measurements and rejects other non-finite numbers", () => {
		assert.isTrue(S.is(GuardMeasurement)(257));
		assert.isTrue(S.is(GuardMeasurement)(Infinity));
		for (const actual of [Number.NaN, -Infinity]) {
			assert.isFalse(S.is(GuardMeasurement)(actual));
			assert.throws(() => GuardExceeded.fromReason("ExpansionBudgetExceeded", 100_000, actual));
		}
	});

	it("keeps guard limits finite", () => {
		assert.throws(() => GuardExceeded.fromReason("ExpansionBudgetExceeded", Infinity, Infinity));
	});

	it("throws the schema-backed guard with the engine's overflowing measurement", () => {
		try {
			new Minimatch(`{1..${"9".repeat(310)}}`);
			assert.fail("expected an overflowing expansion to throw GuardExceeded");
		} catch (error) {
			assert.instanceOf(error, GuardExceeded);
			assert.isTrue(isGuardExceeded(error));
			if (!isGuardExceeded(error)) return;
			assert.strictEqual(error._tag, "GuardExceeded");
			assert.strictEqual(error.name, "Error");
			assert.strictEqual(error.reason, "ExpansionBudgetExceeded");
			assert.strictEqual(error.limit, 100_000);
			assert.strictEqual(error.actual, Infinity);
		}
	});
});

describe("escape and unescape", () => {
	it("escapes the magic characters with backslashes by default", () => {
		assert.strictEqual(escapePattern("a*b?"), "a\\*b\\?");
		assert.strictEqual(escapePattern("[x](y)"), "\\[x\\]\\(y\\)");
	});

	it("wraps in brackets under windowsPathsNoEscape", () => {
		assert.strictEqual(escapePattern("a*b", { windowsPathsNoEscape: true }), "a[*]b");
	});

	it("escapes braces only with magicalBraces", () => {
		assert.strictEqual(escapePattern("{a}"), "{a}");
		assert.strictEqual(escapePattern("{a}", { magicalBraces: true }), "\\{a\\}");
	});

	it("unescape round-trips escape", () => {
		for (const s of ["a*b?", "[x](y)", "has*star", "no magic at all"]) {
			assert.strictEqual(unescapePattern(escapePattern(s)), s);
		}
	});

	it("an escaped literal matches itself and nothing else", () => {
		const m = new Minimatch(escapePattern("has*star"));
		assert.isTrue(m.match("has*star"));
		assert.isFalse(m.match("hasXstar"));
		assert.isFalse(m.match("hasstar"));
	});

	it("agrees with the oracle on escape and unescape", () => {
		for (const s of ["a*b?", "[x](y)", "{a,b}", "a\\b"]) {
			assert.strictEqual(escapePattern(s), oracle.escape(s));
			assert.strictEqual(unescapePattern(s), oracle.unescape(s));
		}
	});
});

describe("character classes", () => {
	it("matches simple classes, ranges and negations", () => {
		assert.isTrue(new Minimatch("[abc]").match("b"));
		assert.isFalse(new Minimatch("[abc]").match("d"));
		assert.isTrue(new Minimatch("[a-c]x").match("bx"));
		assert.isTrue(new Minimatch("[!a]x").match("bx"));
		assert.isFalse(new Minimatch("[!a]x").match("ax"));
		assert.isTrue(new Minimatch("[^a]x").match("bx"));
	});

	it("matches POSIX classes via unicode properties", () => {
		assert.isTrue(new Minimatch("[[:alpha:]]").match("x"));
		assert.isFalse(new Minimatch("[[:alpha:]]").match("5"));
		assert.isTrue(new Minimatch("[[:digit:]]").match("5"));
		assert.isTrue(new Minimatch("[[:alnum:]]*").match("x5y"));
	});

	it("treats a single-character class as a literal escape", () => {
		// [_] is a valid way to escape glob magic
		assert.isTrue(new Minimatch("[*]").match("*"));
		assert.isFalse(new Minimatch("[*]").match("x"));
	});

	it("agrees with the oracle on degenerate classes", () => {
		for (const [p, c] of [
			["[]", "[]"],
			["[", "["],
			["[a-", "[a-"],
			["[z-a]x", "x"],
			["a[]b", "a[]b"],
		] as const) {
			assert.strictEqual(new Minimatch(p).match(c), oracle(c, p), `${p} vs ${c}`);
		}
	});
});

describe("assertValidPattern", () => {
	it("fails typed past 64KB", () => {
		assert.strictEqual(
			reasonOf(() => assertValidPattern("a".repeat(65537))),
			"PatternTooLong",
		);
		assertValidPattern("a".repeat(65536)); // exactly at the cap: fine
	});

	it("dies on a non-string, programmer error", () => {
		assert.throws(() => assertValidPattern(42), InvalidPattern);
	});
});

describe("Minimatch smoke", () => {
	it("matches globstar across levels", () => {
		const m = new Minimatch("a/**/b");
		assert.isTrue(m.match("a/b"));
		assert.isTrue(m.match("a/x/b"));
		assert.isTrue(m.match("a/x/y/b"));
		assert.isFalse(m.match("a/x/y/c"));
	});

	it("treats comment patterns as matching nothing", () => {
		assert.isFalse(new Minimatch("#x").match("#x"));
		assert.isTrue(new Minimatch("#x", { nocomment: true }).match("#x"));
	});

	it("treats an empty pattern as matching only the empty string", () => {
		assert.isTrue(new Minimatch("").match(""));
		assert.isFalse(new Minimatch("").match("a"));
	});

	it("negates whole patterns with a leading bang", () => {
		assert.isTrue(new Minimatch("!a/*").match("b/x"));
		assert.isFalse(new Minimatch("!a/*").match("a/x"));
	});

	it("splits backslashes only under platform win32, never ambiently", () => {
		assert.isTrue(new Minimatch("a/b", { platform: "win32" }).match("a\\b"));
		// no ambient process.platform read: default is posix, backslash is an escape
		assert.isFalse(new Minimatch("a/b").match("a\\b"));
	});

	it("dies on a NaN globstar cap, programmer error", () => {
		assert.throws(() => new Minimatch("a/**/b", { maxGlobstarRecursion: Number.NaN }), InvalidCap);
		assert.throws(() => new Minimatch("a/**/b", { maxGlobstarRecursion: 1.5 }), InvalidCap);
	});
});

describe("extglob depth behavior", () => {
	it("degrades over-nesting to literal at the default cap, agreeing with the oracle", () => {
		const p = `${"+(".repeat(6)}a${")".repeat(6)}`;
		for (const c of [p, "a", "aa"]) {
			assert.strictEqual(new Minimatch(p).match(c), oracle(c, p), `candidate ${c}`);
		}
	});

	it("caps AST depth typed when maxExtglobRecursion is raised past the nesting cap", () => {
		const deep = `${"!(".repeat(300)}a${")".repeat(300)}`;
		assert.strictEqual(
			reasonOf(() => new Minimatch(deep, { maxExtglobRecursion: 400 })),
			"NestingDepthExceeded",
		);
	});

	it("caps the adoption-chain recursion upstream leaves unbounded", () => {
		// Coalescible types recurse without incrementing extDepth upstream:
		// the real minimatch 10.2.5 dies with RangeError (stack overflow) on this
		// input at DEFAULT options (verified 2026-07-09). The port fails typed.
		const chain = `${"@(".repeat(20000)}a${")".repeat(20000)}`;
		assert.strictEqual(
			reasonOf(() => new Minimatch(chain)),
			"NestingDepthExceeded",
		);
	});

	it("still coalesces reasonable adoption chains like upstream", () => {
		const p = `${"@(".repeat(50)}a${")".repeat(50)}`;
		const m = new Minimatch(p);
		assert.isTrue(m.match("a"));
		assert.isFalse(m.match("b"));
		assert.strictEqual(m.match("a"), oracle("a", p));
	});
});
