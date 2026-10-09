// Task 5: the GlobPattern public module — compile (the fallible boundary),
// total matching, the enumerator metadata getters, the schema-validated
// options surface, the FromString codec and the escape statics.

import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { minimatch as oracle } from "minimatch";
import { GlobPattern, GlobPatternError, GlobPatternOptions } from "../../effected/glob/index.ts";

describe("GlobPattern.compile", () => {
	it.effect("compiles and matches with segment-scoped star", () =>
		Effect.gen(function* () {
			const p = yield* GlobPattern.compile("packages/*");
			assert.strictEqual(p.source, "packages/*");
			assert.isTrue(p.matches("packages/a"));
			assert.isFalse(p.matches("packages/a/b"));
			assert.isFalse(p.matches("other/a"));
		}),
	);

	it.effect("globstar is real: packages/** matches nested paths", () =>
		Effect.gen(function* () {
			const p = yield* GlobPattern.compile("packages/**");
			assert.isTrue(p.matches("packages/a"));
			assert.isTrue(p.matches("packages/a/b"));
		}),
	);

	it.effect("honours options: dot", () =>
		Effect.gen(function* () {
			const p = yield* GlobPattern.compile("*", GlobPatternOptions.make({ dot: true }));
			assert.isTrue(p.matches(".hidden"));
			const q = yield* GlobPattern.compile("*");
			assert.isFalse(q.matches(".hidden"));
		}),
	);

	it.effect("honours options: nocase", () =>
		Effect.gen(function* () {
			const p = yield* GlobPattern.compile("AbC", GlobPatternOptions.make({ nocase: true }));
			assert.isTrue(p.matches("abc"));
		}),
	);

	it.effect("honours options: platform win32 splits backslashes; posix default does not", () =>
		Effect.gen(function* () {
			const win = yield* GlobPattern.compile("a/b", GlobPatternOptions.make({ platform: "win32" }));
			assert.isTrue(win.matches("a\\b"));
			const posix = yield* GlobPattern.compile("a/b");
			assert.isFalse(posix.matches("a\\b"));
		}),
	);

	it.effect("fails typed with PatternTooLong past 64KB", () =>
		Effect.gen(function* () {
			const e = yield* Effect.flip(GlobPattern.compile("a".repeat(65_537)));
			assert.instanceOf(e, GlobPatternError);
			assert.strictEqual(e._tag, "GlobPatternError");
			assert.strictEqual(e.reason, "PatternTooLong");
			assert.strictEqual(e.limit, 65_536);
			assert.strictEqual(e.actual, 65_537);
			assert.isBelow(e.message.length, 250); // the pattern is truncated in the message
		}),
	);

	it.effect("fails typed with ExpansionBudgetExceeded on a brace bomb", () =>
		Effect.gen(function* () {
			const e = yield* Effect.flip(GlobPattern.compile("{a,b}".repeat(17)));
			assert.strictEqual(e.reason, "ExpansionBudgetExceeded");
			assert.strictEqual(e.limit, 100_000);
		}),
	);

	it.effect("fails typed with NestingDepthExceeded on deep comma nesting", () =>
		Effect.gen(function* () {
			const e = yield* Effect.flip(GlobPattern.compile(`${"{".repeat(300)}a,b${"}".repeat(300)}`));
			assert.strictEqual(e.reason, "NestingDepthExceeded");
			assert.strictEqual(e.limit, 256);
		}),
	);

	it.effect("rejects a defaults-rejected pattern typed even under permissive options", () =>
		Effect.gen(function* () {
			// Decision 4: nobrace masks the bomb from the effective engine, but a
			// GlobPattern value must always be defaults-compilable — the same typed
			// error, never a defect.
			const e = yield* Effect.flip(GlobPattern.compile("{a,b}".repeat(17), GlobPatternOptions.make({ nobrace: true })));
			assert.instanceOf(e, GlobPatternError);
			assert.strictEqual(e.reason, "ExpansionBudgetExceeded");
		}),
	);

	it.effect("honours a lowered braceExpandMax typed", () =>
		Effect.gen(function* () {
			const e = yield* Effect.flip(GlobPattern.compile("{a,b}{c,d}", GlobPatternOptions.make({ braceExpandMax: 3 })));
			assert.strictEqual(e.reason, "ExpansionBudgetExceeded");
			assert.strictEqual(e.limit, 3);
		}),
	);
});

describe("GlobPattern metadata", () => {
	it.effect("hasMagic distinguishes wildcards from literals", () =>
		Effect.gen(function* () {
			assert.isTrue((yield* GlobPattern.compile("packages/*")).hasMagic);
			assert.isFalse((yield* GlobPattern.compile("packages/internal")).hasMagic);
			assert.isTrue((yield* GlobPattern.compile("a?b")).hasMagic);
			assert.isFalse((yield* GlobPattern.compile("{a,b}")).hasMagic);
			assert.isTrue((yield* GlobPattern.compile("{a,b}", GlobPatternOptions.make({ magicalBraces: true }))).hasMagic);
		}),
	);

	it.effect("negated reflects leading-bang whole-pattern negation", () =>
		Effect.gen(function* () {
			assert.isTrue((yield* GlobPattern.compile("!packages/*")).negated);
			assert.isFalse((yield* GlobPattern.compile("packages/*")).negated);
			const n = yield* GlobPattern.compile("!packages/*");
			assert.isFalse(n.matches("packages/a"));
			assert.isTrue(n.matches("other/a"));
		}),
	);

	it.effect("enumerationPrefix is the leading literal directory run", () =>
		Effect.gen(function* () {
			assert.strictEqual((yield* GlobPattern.compile("packages/*")).enumerationPrefix, "packages/");
			assert.strictEqual((yield* GlobPattern.compile("pkg-*")).enumerationPrefix, "");
			assert.strictEqual((yield* GlobPattern.compile("a/b/*")).enumerationPrefix, "a/b/");
			assert.strictEqual((yield* GlobPattern.compile("*/x")).enumerationPrefix, "");
			assert.strictEqual((yield* GlobPattern.compile("packages/**")).enumerationPrefix, "packages/");
		}),
	);

	it.effect("enumerationPrefix on an all-literal pattern is every segment", () =>
		Effect.gen(function* () {
			assert.strictEqual((yield* GlobPattern.compile("a/b/c")).enumerationPrefix, "a/b/c/");
		}),
	);

	it.effect("enumerationPrefix strips negation and takes the common run across brace alternatives", () =>
		Effect.gen(function* () {
			assert.strictEqual((yield* GlobPattern.compile("!packages/*")).enumerationPrefix, "packages/");
			assert.strictEqual((yield* GlobPattern.compile("a/{b,c}/*")).enumerationPrefix, "a/");
			assert.strictEqual((yield* GlobPattern.compile("{a/x,a/y}/*")).enumerationPrefix, "a/");
		}),
	);

	it.effect("crossesSegments is true iff matching can go deeper than the prefix by more than one level", () =>
		Effect.gen(function* () {
			assert.isTrue((yield* GlobPattern.compile("packages/**")).crossesSegments);
			assert.isFalse((yield* GlobPattern.compile("packages/*")).crossesSegments);
			assert.isTrue((yield* GlobPattern.compile("*/x")).crossesSegments);
			assert.isFalse((yield* GlobPattern.compile("*.js")).crossesSegments);
			assert.isTrue((yield* GlobPattern.compile("packages/*/x")).crossesSegments);
			assert.isFalse(
				(yield* GlobPattern.compile("a/**", GlobPatternOptions.make({ noglobstar: true }))).crossesSegments,
			);
		}),
	);
});

describe("GlobPattern construction and schema", () => {
	it("make succeeds on a compilable pattern and matches lazily", () => {
		const p = GlobPattern.make({ source: "*test*" });
		assert.isTrue(p.matches("vitest"));
		assert.isFalse(p.matches("vite"));
	});

	it("make throws on an uncompilable pattern (wiring defect at construction)", () => {
		assert.throws(() => GlobPattern.make({ source: "{a,b}".repeat(17) }));
		assert.throws(() => GlobPattern.make({ source: "a".repeat(65_537) }));
	});

	it.effect("class decode produces a working instance and encode emits only source", () =>
		Effect.gen(function* () {
			const p = yield* S.decodeEffect(GlobPattern)({ source: "@scope/*" });
			assert.instanceOf(p, GlobPattern);
			assert.isFalse(p.matches("somepkg"));
			assert.isTrue(p.matches("@scope/x"));
			const encoded = yield* S.encodeEffect(GlobPattern)(p);
			assert.deepStrictEqual(encoded, { source: "@scope/*" });
		}),
	);

	it.effect("class decode rejects an uncompilable pattern as SchemaError", () =>
		Effect.gen(function* () {
			const e = yield* Effect.flip(S.decodeEffect(GlobPattern)({ source: "{a,b}".repeat(17) }));
			assert.strictEqual(e._tag, "SchemaError");
		}),
	);

	it.effect("FromString decodes a bare string into a working instance and encodes back to source", () =>
		Effect.gen(function* () {
			const p = yield* S.decodeEffect(GlobPattern.FromString)("@scope/*");
			assert.instanceOf(p, GlobPattern);
			assert.isFalse(p.matches("somepkg"));
			assert.strictEqual(yield* S.encodeEffect(GlobPattern.FromString)(p), "@scope/*");
		}),
	);

	it.effect("FromString surfaces uncompilable input as SchemaError", () =>
		Effect.gen(function* () {
			const e = yield* Effect.flip(S.decodeEffect(GlobPattern.FromString)("{a,b}".repeat(17)));
			assert.strictEqual(e._tag, "SchemaError");
		}),
	);
});

describe("GlobPatternOptions", () => {
	it("rejects an explicit undefined for an optionalKey field", () => {
		assert.throws(() => Result.getOrThrow(S.decodeUnknownResult(GlobPatternOptions)({ dot: undefined })));
	});

	it("rejects an unknown platform", () => {
		assert.throws(() => Result.getOrThrow(S.decodeUnknownResult(GlobPatternOptions)({ platform: "vms" })));
	});

	it("rejects out-of-range or non-integer caps as wiring defects", () => {
		assert.throws(() => GlobPatternOptions.make({ braceExpandMax: 0 }));
		assert.throws(() => GlobPatternOptions.make({ braceExpandMax: 1.5 }));
		assert.throws(() => GlobPatternOptions.make({ braceExpandMax: Number.NaN }));
		assert.throws(() => GlobPatternOptions.make({ braceExpandMax: 100_001 }));
		assert.throws(() => GlobPatternOptions.make({ maxGlobstarRecursion: 0 }));
		assert.throws(() => GlobPatternOptions.make({ maxExtglobRecursion: 0 }));
		assert.throws(() => GlobPatternOptions.make({ optimizationLevel: 3 }));
		assert.throws(() => GlobPatternOptions.make({ optimizationLevel: -1 }));
	});

	it("accepts the full valid surface", () => {
		const o = GlobPatternOptions.make({
			nobrace: true,
			nocomment: true,
			nonegate: true,
			noglobstar: true,
			noext: true,
			dot: true,
			nocase: true,
			nocaseMagicOnly: true,
			magicalBraces: true,
			matchBase: true,
			flipNegate: true,
			partial: true,
			preserveMultipleSlashes: true,
			windowsPathsNoEscape: true,
			windowsNoMagicRoot: true,
			optimizationLevel: 2,
			platform: "win32",
			braceExpandMax: 100_000,
			maxGlobstarRecursion: 200,
			maxExtglobRecursion: 2,
		});
		assert.strictEqual(o.platform, "win32");
		assert.strictEqual(o.braceExpandMax, 100_000);
	});
});

describe("GlobPattern statics", () => {
	it.effect("escape produces a pattern matching exactly the literal", () =>
		Effect.gen(function* () {
			const p = yield* GlobPattern.compile(GlobPattern.escape("has*star"));
			assert.isTrue(p.matches("has*star"));
			assert.isFalse(p.matches("hasXstar"));
		}),
	);

	it("unescape round-trips escape", () => {
		for (const s of ["a*b?", "[x](y)", "plain"]) {
			assert.strictEqual(GlobPattern.unescape(GlobPattern.escape(s)), s);
		}
	});

	it("escape honours windowsPathsNoEscape bracket style", () => {
		assert.strictEqual(GlobPattern.escape("a*b", GlobPatternOptions.make({ windowsPathsNoEscape: true })), "a[*]b");
	});
});

describe("GlobPattern oracle (public seam)", () => {
	// Literal and magic segments are two equal-weight groups (a Union of two
	// Literals unions, not one flat list), so the pattern mix stays balanced
	// between plain paths and paths that exercise the dialect.
	const literalSeg = S.Literals(["a", "b", "abc", "x-y", "a.b+c", ".hidden", ""]);
	const magicSeg = S.Literals(["*", "?", "**", "*.js", "a*", "+(a|b)", "[abc]", "{a,b}", "!x"]);
	const patternArb = Arbitrary.schema(
		S.Array(S.Union([literalSeg, magicSeg])).check(S.isBetweenLength(1, 4)),
	).pipe(Arbitrary.map((xs) => xs.join("/")));
	const candidateArb = Arbitrary.schema(
		S.Array(S.Literals(["a", "b", "abc", ".hidden", "x", ""])).check(S.isBetweenLength(1, 5)),
	).pipe(Arbitrary.map((xs) => xs.join("/")));

	it.effect.prop(
		"agrees with upstream through compile and matches",
		[patternArb, candidateArb],
		([pattern, candidate]) =>
			Effect.gen(function* () {
				const compiled = yield* Effect.result(GlobPattern.compile(pattern));
				if (compiled._tag === "Failure") return; // guard-tripping input; the engine gate covers those
				assert.strictEqual(
					compiled.success.matches(candidate),
					oracle(candidate, pattern, { platform: "linux" }),
					`${pattern} vs ${candidate}`,
				);
			}),
		{ arbitrary: { runs: 200 } },
	);
});

describe("GlobPattern.compileResult", () => {
	it("compiles synchronously without an Effect runtime", () => {
		const r = GlobPattern.compileResult("packages/*");
		assert.isTrue(Result.isSuccess(r));
		if (!Result.isSuccess(r)) return;
		assert.strictEqual(r.success.source, "packages/*");
		assert.isTrue(r.success.matches("packages/a"));
		assert.isFalse(r.success.matches("packages/a/b"));
	});

	it("is total: a guard trip is a Result failure, never a throw", () => {
		const r = GlobPattern.compileResult("a".repeat(65_537));
		assert.isTrue(Result.isFailure(r));
		if (!Result.isFailure(r)) return;
		assert.instanceOf(r.failure, GlobPatternError);
		assert.strictEqual(r.failure.reason, "PatternTooLong");
	});

	it("carries the same typed error as compile for every guard", () => {
		for (const source of ["a".repeat(65_537), "{a,b}".repeat(17), `${"{".repeat(300)}a,b${"}".repeat(300)}`]) {
			const sync = GlobPattern.compileResult(source);
			const eff = GlobPattern.compile(source).pipe(Effect.result, Effect.runSync);
			assert.isTrue(Result.isFailure(sync));
			assert.isTrue(Result.isFailure(eff));
			if (!Result.isFailure(sync) || !Result.isFailure(eff)) continue;
			assert.strictEqual(sync.failure.reason, eff.failure.reason);
			assert.strictEqual(sync.failure.limit, eff.failure.limit);
			assert.strictEqual(sync.failure.actual, eff.failure.actual);
		}
	});

	// The consumer's dotfile-semantics divergence: one package compiled the same
	// shape of pattern with `dot: true` at one call site and defaults at another,
	// giving two glob semantics inside one package. Both spellings must agree
	// exactly, so the sync form is never the reason the semantics drift.
	it("honours options identically to compile: the dot divergence", () => {
		const withDot = GlobPattern.compileResult("*", GlobPatternOptions.make({ dot: true }));
		const withDefaults = GlobPattern.compileResult("*");
		assert.isTrue(Result.isSuccess(withDot));
		assert.isTrue(Result.isSuccess(withDefaults));
		if (!Result.isSuccess(withDot) || !Result.isSuccess(withDefaults)) return;
		assert.isTrue(withDot.success.matches(".hidden"));
		assert.isFalse(withDefaults.success.matches(".hidden"));

		const effDot = Effect.runSync(GlobPattern.compile("*", GlobPatternOptions.make({ dot: true })));
		const effDefaults = Effect.runSync(GlobPattern.compile("*"));
		assert.strictEqual(withDot.success.matches(".hidden"), effDot.matches(".hidden"));
		assert.strictEqual(withDefaults.success.matches(".hidden"), effDefaults.matches(".hidden"));
	});

	it("agrees with compile on the enumerator getters", () => {
		const sync = GlobPattern.compileResult("packages/**/*.ts");
		const eff = Effect.runSync(GlobPattern.compile("packages/**/*.ts"));
		assert.isTrue(Result.isSuccess(sync));
		if (!Result.isSuccess(sync)) return;
		assert.strictEqual(sync.success.enumerationPrefix, eff.enumerationPrefix);
		assert.strictEqual(sync.success.crossesSegments, eff.crossesSegments);
		assert.strictEqual(sync.success.hasMagic, eff.hasMagic);
		assert.strictEqual(sync.success.negated, eff.negated);
	});

	it("still rejects a defaults-uncompilable pattern under permissive options", () => {
		const r = GlobPattern.compileResult("{a,b}".repeat(17), GlobPatternOptions.make({ nobrace: true }));
		assert.isTrue(Result.isFailure(r));
	});
});
