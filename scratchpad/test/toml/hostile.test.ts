// The hostile-input suite: the hardening verdict across every public surface.
// Every case asserts a TYPED failure or a correct benign result — a defect,
// stack overflow or hang from any row is an engine bug, not a test problem.
//
// Rows carried by earlier suites (not duplicated here):
// - parse depth, balanced 300-deep array → Toml.test.ts ("surfaces the
//   nesting-depth guard as a typed parse error") and TomlDocument.test.ts
//   ("a nesting-depth bomb fails typed").
// - parser-internal guard boundary (255/256 parse, 257 trips, combined
//   array+inline counter) → parser.test.ts "depth".
// - visitor depth bomb (10_000 open brackets) → TomlVisitor.test.ts ("an
//   adversarial nesting-depth bomb fails the stream typed").
// - modify 300-segment path → TomlFormat.test.ts "modify — depth".
// - stringify direct self-reference cycle → Toml.test.ts ("fails typed on a
//   circular reference").
// - scanner-level control/escape/numeric/datetime rejection → scanner.test.ts
//   (this suite re-asserts those rows through the PUBLIC parse surface, which
//   is a different claim: the wiring from scan error to typed diagnostic).
// - "__proto__" own-property semantics at the internal builder → semantic
//   .test.ts (this suite asserts them through Toml.parse and additionally
//   proves Object.prototype stays unpolluted).

import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { Toml, TomlParseError, TomlStringifyError } from "../../effected/toml/Toml.ts";
import { TomlDocument } from "../../effected/toml/TomlDocument.ts";
import { TomlFormat, TomlModificationError } from "../../effected/toml/TomlFormat.ts";

/**
 * Elapsed-time ceiling for the scale and path-depth rows. The bound is a
 * hang/quadratic-blowup guard, not a performance target: linear behavior was
 * verified out of band (12.5k->126ms through 100k->762ms key-values locally),
 * and a quadratic parse at these sizes would take minutes. 30s tolerates
 * shared CI runners, which measured ~4x slower than local (5,955ms for the
 * 2MB document that takes ~1.4s here) and flaked the previous 5s bound.
 */
const ELAPSED_BOUND_MS = 30_000;

/** Flip a failing parse and hand back the typed error. */
const parseError = Effect.fn("parseError")(function* (text: string) {
		const error = yield* Effect.result(Toml.parse(text)).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
		assert.instanceOf(error, TomlParseError);
		return error;
	});

/** The first diagnostic code of a parse error. */
const codeOf = (error: TomlParseError): string | undefined => error.diagnostics[0]?.code;

/** Prove Object.prototype picked up nothing from a hostile parse. */
const assertPrototypeUnpolluted = (): void => {
	assert.strictEqual(({} as Record<string, unknown>).x, undefined);
	assert.isFalse(Object.hasOwn(Object.prototype, "x"));
	assert.isFalse("x" in {});
};

describe("hostile input", () => {
	describe("parse — depth bombs", () => {
		it.effect("10_000 unbalanced open brackets fail typed, never a stack overflow", () =>
			Effect.gen(function* () {
				const error = yield* parseError(`a = ${"[".repeat(10_000)}`);
				assert.strictEqual(codeOf(error), "NestingDepthExceeded");
			}),
		);

		it.effect("10_000 nested inline tables fail typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError(`a = ${"{b = ".repeat(10_000)}`);
				assert.strictEqual(codeOf(error), "NestingDepthExceeded");
			}),
		);

		it.effect("mixed array/inline-table nesting counts against one combined depth", () =>
			Effect.gen(function* () {
				const error = yield* parseError(`a = ${"[{a = [".repeat(2_000)}`);
				assert.strictEqual(codeOf(error), "NestingDepthExceeded");
			}),
		);
	});

	describe("stringify — depth bombs", () => {
		it.effect("a 10_000-deep nested OBJECT trips the emitTable guard typed", () =>
			Effect.gen(function* () {
				// Distinct recursion surface from the array bomb below: nested plain
				// objects render as [table] sections through emitTable, not through
				// renderInline.
				let value: Record<string, unknown> = {};
				for (let i = 0; i < 10_000; i++) {
					value = { a: value };
				}
				const error = yield* Effect.flip(Toml.stringify(value));
				assert.instanceOf(error, TomlStringifyError);
				assert.strictEqual(error.diagnostic.code, "NestingDepthExceeded");
			}),
		);

		it.effect("a 10_000-deep nested ARRAY trips the renderInline guard typed", () =>
			Effect.gen(function* () {
				let value: unknown = 1;
				for (let i = 0; i < 10_000; i++) {
					value = [value];
				}
				const error = yield* Effect.flip(Toml.stringify({ a: value }));
				assert.instanceOf(error, TomlStringifyError);
				assert.strictEqual(error.diagnostic.code, "NestingDepthExceeded");
			}),
		);

		it.effect("a value parsed at exactly the depth bound round-trips through stringify", () =>
			Effect.gen(function* () {
				// Parse guards container descent only, so 256 nested arrays with a
				// non-empty leaf parse; stringify must count the same way — a guard
				// that also checked the scalar leaf would see depth 257 and give
				// stringify a one-level tighter bound than parse (PR #31 review).
				const doc = `a = ${"[".repeat(256)}1${"]".repeat(256)}\n`;
				const value = yield* Toml.parse(doc);
				const text = yield* Toml.stringify(value);
				const back = yield* Toml.parse(text);
				assert.deepStrictEqual(back, value);
			}),
		);
	});

	describe("stringify — cycles", () => {
		// The direct self-reference row lives in Toml.test.ts; this pins the
		// multi-hop case the ancestor-Set detector must also catch.
		it.effect("a 3-hop cycle across tables fails typed as CircularReference", () =>
			Effect.gen(function* () {
				const a: Record<string, unknown> = {};
				const b: Record<string, unknown> = {};
				const c: Record<string, unknown> = {};
				a.b = b;
				b.c = c;
				c.a = a;
				const error = yield* Effect.flip(Toml.stringify(a));
				assert.instanceOf(error, TomlStringifyError);
				assert.strictEqual(error.diagnostic.code, "CircularReference");
			}),
		);

		it.effect("a 3-hop cycle through inline arrays fails typed as CircularReference", () =>
			Effect.gen(function* () {
				const inner: Array<unknown> = [];
				const middle: Array<unknown> = [inner, 1];
				const outer: Array<unknown> = [middle];
				inner.push(outer);
				const error = yield* Effect.flip(Toml.stringify({ a: outer }));
				assert.instanceOf(error, TomlStringifyError);
				assert.strictEqual(error.diagnostic.code, "CircularReference");
			}),
		);
	});

	describe("defect passthrough", () => {
		// The typed-error firewall must materialize ONLY the engine's raw
		// carriers; any other throw is a genuine defect and must die, never be
		// swallowed into a typed TOML error.
		it.effect("stringify lets a throwing getter die instead of masking it as TomlStringifyError", () =>
			Effect.gen(function* () {
				const evil = {
					get boom(): number {
						throw new Error("boom");
					},
				};
				const exit = yield* Effect.exit(Toml.stringify(evil));
				if (!Exit.isFailure(exit)) {
					return assert.fail("expected the getter throw to surface as a failure exit");
				}
				assert.isFalse(exit.cause.reasons.some(Cause.isFailReason), "must not surface as a typed Fail");
				const die = exit.cause.reasons.find(Cause.isDieReason);
				if (die === undefined) {
					return assert.fail("expected a Die reason carrying the getter's error");
				}
				assert.instanceOf(die.defect, Error);
				assert.notInstanceOf(die.defect, TomlStringifyError);
				assert.strictEqual((die.defect as Error).message, "boom");
			}),
		);

		// No TOML *string* can make the parse engine throw anything but its raw
		// carriers (the full toml-test corpus pins that), so the natural
		// non-engine defect is misuse-shaped input: a non-string reaching the
		// scanner throws a plain TypeError, which must die, not become a
		// TomlParseError.
		it.effect("parse lets a non-engine TypeError die instead of masking it as TomlParseError", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Toml.parse(42 as unknown as string));
				if (!Exit.isFailure(exit)) {
					return assert.fail("expected the misuse to surface as a failure exit");
				}
				assert.isFalse(exit.cause.reasons.some(Cause.isFailReason), "must not surface as a typed Fail");
				const die = exit.cause.reasons.find(Cause.isDieReason);
				if (die === undefined) {
					return assert.fail("expected a Die reason carrying the TypeError");
				}
				assert.instanceOf(die.defect, TypeError);
				assert.notInstanceOf(die.defect, TomlParseError);
			}),
		);
	});

	describe("facade surfaces on deep input", () => {
		// TomlVisitor.visit against this exact bomb is pinned in
		// TomlVisitor.test.ts; the remaining facade surfaces ride here.
		const bomb = `a = ${"[".repeat(10_000)}`;

		it.effect("TomlDocument.parse fails typed on the 10_000-bracket bomb", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TomlDocument.parse(bomb));
				assert.instanceOf(error, TomlParseError);
				assert.strictEqual(codeOf(error), "NestingDepthExceeded");
			}),
		);

		it.effect("TomlFormat.modify fails typed on the 10_000-bracket bomb", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TomlFormat.modify(bomb, ["a"], 1));
				assert.instanceOf(error, TomlParseError);
				assert.strictEqual(codeOf(error as TomlParseError), "NestingDepthExceeded");
			}),
		);

		it("TomlFormat.format yields no edits on the bomb instead of overflowing", () => {
			// format is pure and total: malformed input (a tripped guard included)
			// produces zero edits rather than corrupting the document.
			assert.deepStrictEqual(TomlFormat.format(bomb), []);
			assert.strictEqual(TomlFormat.formatToString(bomb), bomb);
		});

		it.effect("the TomlFromString schema surfaces the bomb as a SchemaError, never a defect", () =>
			Effect.gen(function* () {
				const error = yield* Effect.result(S.decodeEffect(Toml.TomlFromString)(bomb)).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "NestingDepthExceeded");
			}),
		);
	});

	describe("modify — path depth", () => {
		it.effect(
			"a 100_000-segment path fails typed promptly, before any parse work",
			() =>
				Effect.gen(function* () {
					const path = Array.from({ length: 100_000 }, (_, i) => `k${i}`);
					const started = performance.now();
					const error = yield* Effect.flip(TomlFormat.modify("a = 1\n", path, 2));
					const elapsed = performance.now() - started;
					assert.instanceOf(error, TomlModificationError);
					assert.strictEqual((error as TomlModificationError).diagnostic.code, "NestingDepthExceeded");
					assert.isBelow(elapsed, ELAPSED_BOUND_MS);
				}),
			ELAPSED_BOUND_MS,
		);
	});

	// Every row asserting against ELAPSED_BOUND_MS also passes it as the
	// Vitest test timeout: the default 5s ceiling would abort the test before
	// the elapsed assertion runs, turning the bound into dead code on a slow
	// CI runner (this exact document measured ~5,955ms there).
	describe("scale", () => {
		it.effect(
			"a 2MB document of 50_000 key-values parses under the timeout",
			() =>
				Effect.gen(function* () {
					const lines = Array.from(
						{ length: 50_000 },
						(_, i) => `k${String(i).padStart(5, "0")} = "${"x".repeat(28)}"`,
					);
					const doc = `${lines.join("\n")}\n`;
					assert.isAtLeast(doc.length, 2_000_000);
					const started = performance.now();
					const value = (yield* Toml.parse(doc)) as Record<string, unknown>;
					const elapsed = performance.now() - started;
					assert.strictEqual(Object.keys(value).length, 50_000);
					assert.strictEqual(value.k49999, "x".repeat(28));
					assert.isBelow(elapsed, ELAPSED_BOUND_MS);
				}),
			ELAPSED_BOUND_MS,
		);

		it.effect(
			"a 1MB single-line string parses",
			() =>
				Effect.gen(function* () {
					const payload = "x".repeat(1_048_576);
					const started = performance.now();
					const value = (yield* Toml.parse(`s = "${payload}"\n`)) as Record<string, unknown>;
					const elapsed = performance.now() - started;
					assert.strictEqual(value.s, payload);
					assert.isBelow(elapsed, ELAPSED_BOUND_MS);
				}),
			ELAPSED_BOUND_MS,
		);

		it.effect(
			"a 1MB unterminated string fails typed promptly — no quadratic scan",
			() =>
				Effect.gen(function* () {
					const started = performance.now();
					const error = yield* parseError(`s = "${"x".repeat(1_048_576)}`);
					const elapsed = performance.now() - started;
					assert.strictEqual(codeOf(error), "UnterminatedString");
					assert.isBelow(elapsed, ELAPSED_BOUND_MS);
				}),
			ELAPSED_BOUND_MS,
		);
	});

	describe("prototype pollution", () => {
		it.effect('"__proto__ = 1" lands as an own data property', () =>
			Effect.gen(function* () {
				const value = (yield* Toml.parse("__proto__ = 1\n")) as Record<string, unknown>;
				assert.isTrue(Object.hasOwn(value, "__proto__"));
				assert.strictEqual(Object.getOwnPropertyDescriptor(value, "__proto__")?.value, 1);
				assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
				assertPrototypeUnpolluted();
			}),
		);

		it.effect('"[__proto__]" defines an own table, not a prototype', () =>
			Effect.gen(function* () {
				const value = (yield* Toml.parse("[__proto__]\nx = 1\n")) as Record<string, unknown>;
				assert.isTrue(Object.hasOwn(value, "__proto__"));
				const table = Object.getOwnPropertyDescriptor(value, "__proto__")?.value as Record<string, unknown>;
				assert.isTrue(Object.hasOwn(table, "x"));
				assert.strictEqual(table.x, 1);
				assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
				assertPrototypeUnpolluted();
			}),
		);

		it.effect('"[[__proto__]]" defines an own array of tables', () =>
			Effect.gen(function* () {
				const value = (yield* Toml.parse("[[__proto__]]\nx = 1\n")) as Record<string, unknown>;
				assert.isTrue(Object.hasOwn(value, "__proto__"));
				const array = Object.getOwnPropertyDescriptor(value, "__proto__")?.value as Array<Record<string, unknown>>;
				assert.isTrue(Array.isArray(array));
				assert.strictEqual(array.length, 1);
				const first = array[0];
				assert.isDefined(first);
				assert.isTrue(Object.hasOwn(first, "x"));
				assert.strictEqual(first.x, 1);
				assertPrototypeUnpolluted();
			}),
		);

		it.effect('"constructor.prototype.x = 1" builds own tables all the way down', () =>
			Effect.gen(function* () {
				// The dotted path defines nested tables NAMED "constructor" and
				// "prototype" — they must be own plain-object properties, never a
				// walk up the real constructor/prototype chain.
				const value = (yield* Toml.parse("constructor.prototype.x = 1\n")) as Record<string, unknown>;
				assert.isTrue(Object.hasOwn(value, "constructor"));
				const constructorTable = value.constructor as unknown as Record<string, unknown>;
				assert.notStrictEqual<unknown>(constructorTable, Object);
				assert.strictEqual(Object.getPrototypeOf(constructorTable), Object.prototype);
				assert.isTrue(Object.hasOwn(constructorTable, "prototype"));
				const prototypeTable = constructorTable.prototype as Record<string, unknown>;
				assert.isTrue(Object.hasOwn(prototypeTable, "x"));
				assert.strictEqual(prototypeTable.x, 1);
				assertPrototypeUnpolluted();
			}),
		);
	});

	describe("control characters and encoding", () => {
		it.effect("NUL in the document body fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError("a = 1\u0000\n");
				assert.strictEqual(codeOf(error), "InvalidCharacter");
			}),
		);

		it.effect("a lone carriage return fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError("a = 1\rb = 2\n");
				assert.strictEqual(codeOf(error), "BareCarriageReturn");
			}),
		);

		it.effect("a control character in a comment fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError("# hi\u0001\n");
				assert.strictEqual(codeOf(error), "ControlCharacterInComment");
			}),
		);

		it.effect("a control character in a basic string fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError('a = "x\u0001y"\n');
				assert.strictEqual(codeOf(error), "ControlCharacterInString");
			}),
		);

		it.effect("a control character in a literal string fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError("a = 'x\u0001y'\n");
				assert.strictEqual(codeOf(error), "ControlCharacterInString");
			}),
		);

		it.effect("an unpaired surrogate escape fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError('a = "\\uD800"\n');
				assert.strictEqual(codeOf(error), "InvalidUnicodeEscape");
			}),
		);

		it.effect("an escape beyond U+10FFFF fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError('a = "\\U00110000"\n');
				assert.strictEqual(codeOf(error), "InvalidUnicodeEscape");
			}),
		);

		it.effect("a raw DEL character in a string fails typed", () =>
			Effect.gen(function* () {
				const error = yield* parseError('a = "x\u007Fy"\n');
				assert.strictEqual(codeOf(error), "ControlCharacterInString");
			}),
		);
	});

	describe("numeric abuse", () => {
		it.effect("int64 overflow fails typed as IntegerOutOfRange", () =>
			Effect.gen(function* () {
				const over = yield* parseError("a = 9223372036854775808\n");
				assert.strictEqual(codeOf(over), "IntegerOutOfRange");
				const under = yield* parseError("a = -9223372036854775809\n");
				assert.strictEqual(codeOf(under), "IntegerOutOfRange");
			}),
		);

		it.effect("a 20-digit hex integer fails typed as IntegerOutOfRange", () =>
			Effect.gen(function* () {
				const error = yield* parseError(`a = 0x${"F".repeat(20)}\n`);
				assert.strictEqual(codeOf(error), "IntegerOutOfRange");
			}),
		);

		it.effect("1e400 saturates to Infinity — floats overflow legally per spec", () =>
			Effect.gen(function* () {
				const value = (yield* Toml.parse("a = 1e400\n")) as Record<string, unknown>;
				assert.strictEqual(value.a, Number.POSITIVE_INFINITY);
			}),
		);

		it.effect("malformed underscore spellings fail typed", () =>
			Effect.gen(function* () {
				const doubled = yield* parseError("a = 0__0\n");
				assert.strictEqual(codeOf(doubled), "InvalidNumber");
				const leading = yield* parseError("a = +_1\n");
				assert.strictEqual(codeOf(leading), "InvalidValue");
			}),
		);
	});

	describe("datetime abuse", () => {
		it.effect("impossible calendar dates fail typed as InvalidDateTime", () =>
			Effect.gen(function* () {
				for (const token of ["0000-00-00", "2021-13-01", "2021-01-32"]) {
					const error = yield* parseError(`a = ${token}\n`);
					assert.strictEqual(codeOf(error), "InvalidDateTime", token);
				}
			}),
		);

		it.effect("hour 24 fails typed as InvalidDateTime", () =>
			Effect.gen(function* () {
				const error = yield* parseError("a = 24:00:00\n");
				assert.strictEqual(codeOf(error), "InvalidDateTime");
			}),
		);
	});

	describe("header abuse", () => {
		it.effect("10_000 distinct headers parse fine", () =>
			Effect.gen(function* () {
				const doc = `${Array.from({ length: 10_000 }, (_, i) => `[t${i}]`).join("\n")}\n`;
				const value = (yield* Toml.parse(doc)) as Record<string, unknown>;
				assert.strictEqual(Object.keys(value).length, 10_000);
				assert.deepStrictEqual(value.t9999, {});
			}),
		);

		it.effect("a 5_001-segment dotted header is DATA — no depth guard, no overflow", () =>
			Effect.gen(function* () {
				// Header/key nesting builds the semantic tree ITERATIVELY; only VALUE
				// nesting (arrays/inline tables) is recursive and guarded. This must
				// parse and materialize a 5_001-deep table.
				const segments = 5_001;
				const doc = `[${Array.from({ length: segments }, () => "a").join(".")}]\n`;
				let current = (yield* Toml.parse(doc)) as Record<string, unknown>;
				for (let i = 0; i < segments; i++) {
					assert.isTrue(Object.hasOwn(current, "a"), `own property missing at depth ${i}`);
					current = current.a as Record<string, unknown>;
				}
				assert.deepStrictEqual(Object.keys(current), []);
			}),
		);

		it.effect("a 5_001-segment dotted KEY is also data-driven", () =>
			Effect.gen(function* () {
				const segments = 5_001;
				const doc = `${Array.from({ length: segments }, () => "a").join(".")} = 1\n`;
				let current = (yield* Toml.parse(doc)) as Record<string, unknown>;
				for (let i = 0; i < segments - 1; i++) {
					assert.isTrue(Object.hasOwn(current, "a"), `own property missing at depth ${i}`);
					current = current.a as Record<string, unknown>;
				}
				assert.strictEqual(current.a, 1);
			}),
		);
	});
});
