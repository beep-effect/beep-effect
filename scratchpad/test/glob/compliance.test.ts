// Task 4, the engine compliance gate (part 1): a deterministic behavioral
// fixture table across every dialect feature category, where EVERY row asserts
// both the expected boolean AND agreement with the real upstream minimatch
// 10.2.5 (the exact-pinned oracle devDependency); plus oracle property tests
// sampling the full dialect and option surface.
//
// Rule of the gate: if the vendored engine disagrees with the oracle, fix the
// engine, never the expectation — except where a row exercises the two
// documented deviations (typed budget exhaustion; explicit platform), which
// are tested separately and excluded from oracle comparison.

import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { MinimatchOptions } from "minimatch";
import { Minimatch as OracleMinimatch, minimatch as oracle } from "minimatch";
import type { EngineOptions } from "../../effected/glob/internal/minimatch.ts";
import { Minimatch, escape as escapePattern } from "../../effected/glob/internal/minimatch.ts";

const JsonOptions = S.fromJsonString(S.Unknown);
const JsonString = S.fromJsonString(S.String);

type Row = readonly [pattern: string, candidate: string, expected: boolean, options?: EngineOptions];

// Upstream's Platform union has no "posix" member (its posix default is the
// ambient-detection fallback the port deletes). "linux" is behaviorally
// identical (non-win32) and keeps the oracle pinned regardless of the machine
// the suite runs on.
const oracleOpts = (opts: EngineOptions): MinimatchOptions =>
	({ ...opts, platform: opts.platform === "posix" ? "linux" : opts.platform }) as MinimatchOptions;

const table: ReadonlyArray<Row> = [
	// ── star / qmark segment scoping ──────────────────────────────────────
	["*", "abc", true],
	["*", ".abc", false],
	["*", "a/b", false],
	["*", "", false],
	["a*", "abc", true],
	["a*", "bac", false],
	["*test*", "vitest", true],
	["*test*", "vite", false],
	["@scope/*", "somepkg", false],
	["@scope/*", "@scope/x", true],
	["a?c", "abc", true],
	["a?c", "a/c", false],
	["a?c", "ac", false],
	["???", "abc", true],
	["???", "ab", false],
	// ── dots ──────────────────────────────────────────────────────────────
	[".*", ".abc", true],
	["*", ".abc", true, { dot: true }],
	["*", ".", false, { dot: true }],
	["*", "..", false, { dot: true }],
	["a/*/b", "a/.x/b", false],
	["a/*/b", "a/.x/b", true, { dot: true }],
	// ── globstar (the #62 inversion class) ────────────────────────────────
	["packages/**", "packages/a", true],
	["packages/**", "packages/a/b", true],
	["packages/**", "other/a", false],
	["a/**/b", "a/b", true],
	["a/**/b", "a/x/b", true],
	["a/**/b", "a/x/y/b", true],
	["a/**/b", "a/x/y/c", false],
	["**", "a/b/c", true],
	["**", ".a/b", false],
	["**", ".a/b", true, { dot: true }],
	["a/**", "a/.b/c", false],
	["a/**", "a/.b/c", true, { dot: true }],
	["a/**/b/**/c", "a/x/b/y/c", true],
	["a/**/b/**/c", "a/b/c", true],
	["a/**/b/**/c", "a/c", false],
	// ── negation / flipNegate / nonegate ──────────────────────────────────
	["!a/*", "b/x", true],
	["!a/*", "a/x", false],
	["!a/*", "a/x", true, { flipNegate: true }],
	["!a/*", "b/x", false, { flipNegate: true }],
	["!!a", "a", true],
	["!!!a", "a", false],
	["!a", "!a", true, { nonegate: true }],
	["!a", "b", false, { nonegate: true }],
	// ── comments / nocomment ──────────────────────────────────────────────
	["#a", "#a", false],
	["#a", "anything", false],
	["#a", "#a", true, { nocomment: true }],
	// ── empty pattern ─────────────────────────────────────────────────────
	["", "", true],
	["", "a", false],
	// ── braces incl. sequences; nobrace ───────────────────────────────────
	["a{b,c}d", "abd", true],
	["a{b,c}d", "acd", true],
	["a{b,c}d", "aed", false],
	["x{1..3}", "x2", true],
	["x{1..3}", "x4", false],
	["{a,b}/*", "a/x", true],
	["{a,b}/*", "c/x", false],
	["a{b,c}d", "a{b,c}d", true, { nobrace: true }],
	["a{b,c}d", "abd", false, { nobrace: true }],
	// ── extglobs, all five types; noext ───────────────────────────────────
	["+(a|b)c", "aabc", true],
	["+(a|b)c", "c", false],
	["?(a)b", "b", true],
	["?(a)b", "ab", true],
	["?(a)b", "aab", false],
	["*(a|b)", "", true],
	["*(a|b)", "abab", true],
	["@(a|b)", "a", true],
	["@(a|b)", "ab", false],
	// NOTE: a LEADING !( is whole-pattern negation, not an extglob — parseNegate
	// strips the bang before the AST ever sees it (oracle-confirmed; the sketch
	// that assumed extglob semantics here was wrong). The nonegate rows exercise
	// the actual !() extglob at the pattern start.
	["!(a)", "b", true],
	["!(a)", "a", true],
	["!(a)", "(a)", false],
	["!(a)", "a", false, { nonegate: true }],
	["!(a)", "b", true, { nonegate: true }],
	["a!(b)c", "axc", true],
	["a!(b)c", "abc", false],
	["+(a)", "+(a)", true, { noext: true }],
	["+(a)", "a", false, { noext: true }],
	// ── classes incl. POSIX ───────────────────────────────────────────────
	["[abc]", "b", true],
	["[abc]", "d", false],
	["[a-c]x", "bx", true],
	["[a-c]x", "dx", false],
	["[!abc]", "d", true],
	["[!abc]", "b", false],
	["[[:digit:]]", "5", true],
	["[[:digit:]]", "x", false],
	["[[:alpha:]][[:digit:]]", "x5", true],
	// ── escaping / regex metachars ────────────────────────────────────────
	["libs/a.b+c/*", "libs/a.b+c/x", true],
	["libs/a.b+c/*", "libs/aXbYc/x", false],
	["\\*", "*", true],
	["\\*", "x", false],
	["a\\?b", "a?b", true],
	["a\\?b", "axb", false],
	// ── matchBase ─────────────────────────────────────────────────────────
	["a?b", "/xyz/123/acb", true, { matchBase: true }],
	["a?b", "/xyz/acb/123", false, { matchBase: true }],
	["a/b", "/x/a/b", false, { matchBase: true }],
	// ── nocase / nocaseMagicOnly ──────────────────────────────────────────
	["AbC", "abc", true, { nocase: true }],
	["AbC", "abc", false],
	["A*C", "abc", true, { nocase: true }],
	["AbC", "abc", false, { nocase: true, nocaseMagicOnly: true }],
	["A*C", "abc", true, { nocase: true, nocaseMagicOnly: true }],
	// ── partial ───────────────────────────────────────────────────────────
	["/a/b/*/d", "/a/b", true, { partial: true }],
	["/", "/", true, { partial: true }],
	["/a/b", "/x", false, { partial: true }],
	// ── multiple slashes / preserveMultipleSlashes ────────────────────────
	["a//b", "a/b", true],
	["a//b", "a/b", false, { preserveMultipleSlashes: true }],
	["a//b", "a//b", true, { preserveMultipleSlashes: true }],
	// ── optimization levels over . and .. ─────────────────────────────────
	["a/b/../c", "a/c", true, { optimizationLevel: 2 }],
	["a/./b", "a/b", true, { optimizationLevel: 2 }],
	["a/b/../c", "a/c", true, { optimizationLevel: 1 }],
	// The **/.. rewrite needs TWO trailing portions (<pre>/**/../<p>/<p>/<rest>);
	// with one, .. stays literal and nothing matches it (oracle-confirmed — the
	// sketched single-portion row was wrong).
	["a/**/../b/c", "a/x/b/c", true, { optimizationLevel: 2 }],
	["a/**/../b", "a/x/b", false, { optimizationLevel: 2 }],
	["a/b", "a/b", true, { optimizationLevel: 0 }],
	["a/**/**/b", "a/x/b", true, { optimizationLevel: 0 }],
	// ── win32 behavior, explicit platform on BOTH engines ─────────────────
	["a/b", "a\\b", true, { platform: "win32" }],
	["a/b", "a\\b", false],
	["c:/x/*", "C:/x/y", true, { platform: "win32", nocase: true }],
	["//?/c:/x", "c:/x", true, { platform: "win32" }],
	["a\\*b", "a*b", false, { windowsPathsNoEscape: true, platform: "win32" }],
	["a\\*b", "a/xb", true, { windowsPathsNoEscape: true, platform: "win32" }],
	// ── noglobstar ────────────────────────────────────────────────────────
	["a/**/b", "a/x/y/b", false, { noglobstar: true }],
	["a/**/b", "a/x/b", true, { noglobstar: true }],
	// ── trailing-slash semantics ──────────────────────────────────────────
	["a/*", "a/b/", true],
	["a/b/", "a/b", false],
	["a/b/", "a/b/", true],
];

describe("engine compliance: behavioral table", () => {
	it("agrees with the expected outcome AND the oracle on every row", () => {
		for (const [pattern, candidate, expected, options] of table) {
			const opts: EngineOptions = { platform: "posix", ...options };
			const vendored = new Minimatch(pattern, opts).match(candidate);
			assert.strictEqual(vendored, expected, `expected: ${pattern} vs ${candidate} (${JSON.stringify(options)})`);
			assert.strictEqual(
				vendored,
				oracle(candidate, pattern, oracleOpts(opts)),
				`oracle disagrees: ${pattern} vs ${candidate} (${JSON.stringify(options)})`,
			);
		}
	});

	it("classifies magic like the oracle Minimatch", () => {
		const cases: ReadonlyArray<readonly [string, EngineOptions?]> = [
			["packages/*"],
			["packages/internal"],
			["{a,b}"],
			["{a,b}", { magicalBraces: true }],
			["[x]"],
			["a?b"],
			["a/**"],
			["plain/literal"],
		];
		for (const [pattern, options] of cases) {
			const opts: EngineOptions = { platform: "posix", ...options };
			assert.strictEqual(
				new Minimatch(pattern, opts).hasMagic(),
				new OracleMinimatch(pattern, oracleOpts(opts)).hasMagic(),
				`hasMagic: ${pattern} (${JSON.stringify(options)})`,
			);
		}
	});
});

// ── Oracle property tests ─────────────────────────────────────────────────
// Array form ONLY: the named-record form of it.effect.prop silently discards
// Schema conversion in @effect/vitest 4.0.0-beta.94.
//
// Literal and magic segments are two equal-weight groups (a Union of two
// Literals unions, not one flat list), so the pattern mix stays balanced
// between plain paths and paths that exercise the dialect.

const literalSeg = S.Literals(["a", "b", "abc", "x-y", "a.b+c", ".hidden", "..", ""]);
const magicSeg = S.Literals([
	"*",
	"?",
	"**",
	"*.js",
	"a*",
	"?(a|b)",
	"+(a|b)",
	"!(a)",
	"@(a|b)",
	"*(a|b)",
	"[abc]",
	"[!a]",
	"[[:alpha:]]",
	"{a,b}",
	"{1..3}",
	"\\*",
	"!x",
]);
const patternArb = Arbitrary.schema(
	S.Array(S.Union([literalSeg, magicSeg])).check(S.isBetweenLength(1, 5)),
).pipe(Arbitrary.map((xs) => xs.join("/")));
const candidateArb = Arbitrary.schema(
	S.Array(S.Literals(["a", "b", "abc", ".hidden", "x", "a.b+c", ""])).check(S.isBetweenLength(1, 6)),
).pipe(Arbitrary.map((xs) => xs.join("/")));
// Every key is optional so the bag ranges from `{}` to fully specified — the
// generator draws a random subset of the optional keys per run.
const optionBagArb = Arbitrary.schema(
	S.Struct({
		dot: S.optionalKey(S.Boolean),
		nocase: S.optionalKey(S.Boolean),
		matchBase: S.optionalKey(S.Boolean),
		noglobstar: S.optionalKey(S.Boolean),
		noext: S.optionalKey(S.Boolean),
		nobrace: S.optionalKey(S.Boolean),
		nonegate: S.optionalKey(S.Boolean),
		flipNegate: S.optionalKey(S.Boolean),
		preserveMultipleSlashes: S.optionalKey(S.Boolean),
		optimizationLevel: S.optionalKey(S.Literals([0, 1, 2])),
		platform: S.optionalKey(S.Literals(["posix", "win32"])),
	}),
);
// Printable ASCII only, as the property's name promises; the pattern also
// keeps `/` and `\` out constructively instead of by residual filtering. The
// class is spelled as the four spans printable ASCII splits into around those
// two characters so the exclusions read as such.
const printableNoSlashArb = Arbitrary.schema(S.String.check(S.isPattern(/^[ -.0-9:-@A-Z[\]-~]{1,30}$/)));
const braceSegArb = Arbitrary.schema(
	S.Array(S.Literals(["a", "{b,c}", "{1..4}", "x{y,z}w", "{a,{b,c}}", "plain"])).check(
		S.isBetweenLength(1, 4),
	),
).pipe(Arbitrary.map((xs) => xs.join("/")));

describe("engine compliance: oracle properties", () => {
	it.effect.prop(
		"matches exactly as upstream under default options",
		[patternArb, candidateArb],
		([pattern, candidate]) =>
			Effect.sync(() => {
				const opts: EngineOptions = { platform: "posix" };
				assert.strictEqual(
					new Minimatch(pattern, opts).match(candidate),
					oracle(candidate, pattern, oracleOpts(opts)),
					`${pattern} vs ${candidate}`,
				);
			}),
		{ arbitrary: { runs: 500 } },
	);

	it.effect.prop(
		"matches exactly as upstream under arbitrary option bags",
		[patternArb, candidateArb, optionBagArb],
		([pattern, candidate, options]) =>
			Effect.sync(() => {
				const opts: EngineOptions = { platform: "posix", ...options };
				assert.strictEqual(
					new Minimatch(pattern, opts).match(candidate),
					oracle(candidate, pattern, oracleOpts(opts)),
					`${pattern} vs ${candidate} (${Result.getOrThrow(S.encodeResult(JsonOptions)(options))})`,
				);
			}),
		{ arbitrary: { runs: 500 } },
	);

	it.effect.prop(
		"a compiled escape of any printable string matches exactly that string",
		[printableNoSlashArb],
		([s]) =>
			Effect.sync(() => {
				// nocomment/nonegate: escape() escapes glob magic, but a leading #
				// or ! is comment/negation syntax that escape deliberately does not
				// touch. magicalBraces: brace EXPANSION is magic regardless, but
				// escape() only escapes braces under this flag. Both are
				// oracle-confirmed upstream semantics.
				const opts: EngineOptions = { platform: "posix", nocomment: true, nonegate: true };
				const m = new Minimatch(escapePattern(s, { magicalBraces: true }), opts);
				assert.isTrue(m.match(s), `escape(${Result.getOrThrow(S.encodeResult(JsonString)(s))}) must match its own literal`);
				assert.strictEqual(m.match(s), oracle(s, oracle.escape(s, { magicalBraces: true }), oracleOpts(opts)));
			}),
		{ arbitrary: { runs: 300 } },
	);

	it.effect.prop(
		"braceExpand agrees with the upstream expansion for in-budget patterns",
		[braceSegArb],
		([pattern]) =>
			Effect.sync(() => {
				const vendored = new Minimatch(pattern, { platform: "posix" });
				const upstream = new OracleMinimatch(pattern, oracleOpts({ platform: "posix" }));
				assert.deepStrictEqual(vendored.braceExpand(), upstream.braceExpand(), pattern);
			}),
		{ arbitrary: { runs: 300 } },
	);
});
