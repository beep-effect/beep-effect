// Task 4, the engine compliance gate (part 2): the hostile-input suite.
// Every case asserts a typed guard trip or total boolean AND completes inside
// the default test timeout — the timeout is the hang detector. Malformed or
// hostile input must never surface as a stack overflow, an OOM, or a hang.

import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";
import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { assertInstanceOf } from "@effect/vitest/utils";
import { expand } from "../../effected/glob/internal/braceExpansion.ts";
import { GuardExceeded, InvalidCap } from "../../effected/glob/internal/limits.ts";
import { Minimatch, braceExpand } from "../../effected/glob/internal/minimatch.ts";

const reasonOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		if (S.is(GuardExceeded)(e)) return e.reason;
		throw e;
	}
	throw new Error("expected a GuardExceeded throw");
};

describe("hostility: pattern length", () => {
	it("rejects a pattern past 64KB typed, with limit and actual populated", () => {
		try {
			new Minimatch("a".repeat(65_537));
			assert.fail("expected a GuardExceeded throw");
		} catch (e) {
			assertInstanceOf(e, GuardExceeded);
			const g = e;
			assert.strictEqual(g.reason, "PatternTooLong");
			assert.strictEqual(g.limit, 65_536);
			assert.strictEqual(g.actual, 65_537);
		}
	});

	it("compiles a pattern of exactly 64KB", () => {
		const m = new Minimatch("a".repeat(65_536));
		assert.isFalse(m.match("b"));
	});

	it("handles a comment pattern with a 64KB body fast", () => {
		assert.isFalse(new Minimatch(`#${"a".repeat(65_000)}`).match("anything"));
	});
});

describe("hostility: brace expansion", () => {
	it("terminates large singletons and non-advancing numeric ranges through Minimatch", () => {
		for (const source of ["{9007199254740992..9007199254740992}", "{9007199254740991..9007199254740992}", "{9007199254740992..9007199254740994}"]) {
			const matcher = new Minimatch(source);
			assert.isTrue(matcher.match("9007199254740992"));
			assert.isFalse(matcher.match("other"));
		}
		assert.strictEqual(
			reasonOf(() => new Minimatch("{9007199254740992..9007199254740994}", { braceExpandMax: 2 })),
			"ExpansionBudgetExceeded",
		);
	});

	it("rejects overflowing endpoint and count arithmetic typed without hanging", () => {
		const huge = "9".repeat(310);
		const finite = `1${"0".repeat(308)}`;
		for (const source of [`{${huge}..${huge}}`, `{1..${huge}..${huge}}`, `{-${finite}..${finite}}`, `{-${finite}..${finite}..${huge}}`]) {
			try {
				new Minimatch(source);
				assert.fail("expected a GuardExceeded throw");
			} catch (error) {
				assertInstanceOf(error, GuardExceeded);
				assert.strictEqual(error.reason, "ExpansionBudgetExceeded");
				assert.strictEqual(error.limit, 100_000);
				assert.strictEqual(error.actual, Infinity);
			}
		}
	});

	it("fails typed on an expansion bomb, never truncating silently", () => {
		// 2^17 = 131_072 > 100_000
		assert.strictEqual(
			reasonOf(() => new Minimatch("{a,b}".repeat(17))),
			"ExpansionBudgetExceeded",
		);
	});

	it("fails typed on comma-bearing nesting past the depth cap", () => {
		const bomb = `${"{".repeat(300)}a,b${"}".repeat(300)}`;
		assert.strictEqual(
			reasonOf(() => new Minimatch(bomb)),
			"NestingDepthExceeded",
		);
	});

	it("survives the exponential-blowup shape (lazy post preserved)", () => {
		const m = new Minimatch(`a${"{},".repeat(60)}b`);
		assert.isNotNull(m);
	});

	it("fails typed past the sequential comma-group cap, never a stack overflow", () => {
		assert.strictEqual(
			reasonOf(() => expand(`${"{a},".repeat(5000)}b}`)),
			"NestingDepthExceeded",
		);
	});

	it("shortcuts the CVE-2022-3517 non-closing brace prefix fast", () => {
		// No closing brace: the ReDoS-safe pre-check regex must reject expansion
		// in linear time and treat the pattern as literal.
		const p = `${"{".repeat(20_000)}a`;
		assert.deepStrictEqual(braceExpand(p), [p]);
	});
});

describe("hostility: extglobs", () => {
	it("degrades over-nesting to literal at the default cap, never hanging", () => {
		const p = `${"+(".repeat(50)}a${")".repeat(50)}`;
		const m = new Minimatch(p);
		assert.isBoolean(m.match(p));
		assert.isBoolean(m.match("a"));
	});

	it("fails typed when a raised extglob cap meets deep nesting", () => {
		const deep = `${"!(".repeat(300)}a${")".repeat(300)}`;
		assert.strictEqual(
			reasonOf(() => new Minimatch(deep, { maxExtglobRecursion: 400 })),
			"NestingDepthExceeded",
		);
	});

	it("fails typed on the adoption chain that stack-overflows upstream", () => {
		const chain = `${"@(".repeat(20_000)}a${")".repeat(20_000)}`;
		assert.strictEqual(
			reasonOf(() => new Minimatch(chain)),
			"NestingDepthExceeded",
		);
	});
});

describe("hostility: globstar backtracking", () => {
	it("keeps match total under a long globstar chain (documented false negative)", () => {
		// 500 non-adjacent ** sections exceed maxGlobstarRecursion (200): the
		// engine returns a boolean — upstream's intentional false negative,
		// an acceptable break in correctness for security — and never throws.
		const pattern = Array.from({ length: 500 }, () => "**/x").join("/");
		const candidate = Array.from({ length: 60 }, () => "x").join("/");
		const m = new Minimatch(pattern);
		assert.isBoolean(m.match(candidate));
	});

	it("matches a 10k-segment path against a simple globstar pattern fast", () => {
		const candidate = Array.from({ length: 10_000 }, () => "a").join("/");
		assert.isFalse(new Minimatch("**/x").match(candidate));
		assert.isTrue(new Minimatch("**/a").match(candidate));
	});
});

describe("hostility: internal cap wiring", () => {
	it("dies on NaN or non-integer caps everywhere they are accepted", () => {
		assert.throws(() => new Minimatch("a", { maxGlobstarRecursion: Number.NaN }), InvalidCap);
		assert.throws(() => new Minimatch("a", { maxGlobstarRecursion: 1.5 }), InvalidCap);
		assert.throws(() => new Minimatch("{a,b}", { braceExpandMax: Number.NaN }), InvalidCap);
		assert.throws(() => new Minimatch("{a,b}", { braceExpandMax: 0 }), InvalidCap);
		assert.throws(() => new Minimatch("+(a)", { maxExtglobRecursion: Number.NaN }), InvalidCap);
	});
});



const underWatchdog = Effect.fnUntraced(function* (script: string) {
	const process = yield* ChildProcess.make("bun", ["--eval", script], { stdin: "ignore", stdout: "ignore", stderr: "inherit" });
	assert.strictEqual(yield* process.exitCode, 0);
}, Effect.scoped, Effect.timeout("2 seconds"));

it.layer(NodeServices.layer, { timeout: "2 seconds" })((it) => {
	it.effect("rejects a long ambiguous repetition without exponential backtracking under a subprocess watchdog", () =>
		underWatchdog(`
			import { Minimatch } from "./scratchpad/effected/glob/internal/minimatch.ts";
			const matcher = new Minimatch("*(a|aa)b");
			if (matcher.match("a".repeat(1000) + "c")) throw new Error("unexpected match");
			if (!matcher.match("a".repeat(1000) + "b")) throw new Error("missing match");
		`),
	);

	it.effect("rejects sibling expansion at the first excess member under a subprocess watchdog", () =>
		underWatchdog(`
			import { expand } from "./scratchpad/effected/glob/internal/braceExpansion.ts";
			import { GuardExceeded } from "./scratchpad/effected/glob/internal/limits.ts";
			const source = "{" + Array.from({ length: 128 }, () => "{1..1000}").join(",") + "}";
			try { expand(source, { max: 1000 }); throw new Error("missing guard"); }
			catch (error) {
				if (!(error instanceof GuardExceeded) || error.reason !== "ExpansionBudgetExceeded" || error.actual !== 1001) throw error;
			}
		`),
	);
});
