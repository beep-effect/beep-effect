// The Toml facade: parse, canonical value stringify, and the schema
// factories, plus the boundary rows the emitter contract pins (int64 bigint
// bounds, integral-float-to-integer, -0.0, key quoting, canonical layout).

import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { renderInlineValue } from "../../effected/toml/internal/stringifyValue.ts";
import { Toml, TomlParseError, TomlStringifyError, TomlStringifyOptions } from "../../effected/toml/Toml.ts";
import { TomlLocalDate } from "../../effected/toml/TomlDateTime.ts";

describe("Toml", () => {
	describe("parse", () => {
		it.effect("parses a representative document", () =>
			Effect.gen(function* () {
				const v = yield* Toml.parse(
					'title = "x"\n[owner]\nname = "y"\ndob = 1979-05-27\n[[srv]]\nport = 1\n[[srv]]\nport = 2\n',
				);
				if (!P.isObject(v)) {
					assert.fail("expected a TOML table");
				}
				const doc = v;
				assert.deepStrictEqual(doc.srv, [{ port: 1 }, { port: 2 }]);
				const owner = doc.owner;
				if (!P.isObject(owner)) {
					assert.fail("expected an owner table");
				}
				assert.isTrue(S.is(TomlLocalDate)(owner.dob));
			}),
		);

		it.effect("fails typed with a positioned diagnostic", () =>
			Effect.gen(function* () {
				const e = yield* Effect.result(Toml.parse("a = 1\na = 2\n")).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				assert.instanceOf(e, TomlParseError);
				const diagnostic = e.diagnostics[0];
				assert.isDefined(diagnostic);
				assert.strictEqual(diagnostic.code, "DuplicateKey");
				assert.strictEqual(diagnostic.line, 1);
			}),
		);

		it.effect("fails typed on a syntactically fine but semantically illegal document", () =>
			Effect.gen(function* () {
				const e = yield* Effect.result(Toml.parse("[a]\nb = 1\n[a]\nc = 2\n")).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				assert.instanceOf(e, TomlParseError);
				const diagnostic = e.diagnostics[0];
				assert.isDefined(diagnostic);
				assert.strictEqual(diagnostic.code, "TableRedefined");
				assert.strictEqual(diagnostic.line, 2);
			}),
		);

		it.effect("surfaces the nesting-depth guard as a typed parse error, never a defect", () =>
			Effect.gen(function* () {
				const bomb = `a = ${"[".repeat(300)}${"]".repeat(300)}\n`;
				const e = yield* Effect.result(Toml.parse(bomb)).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				assert.instanceOf(e, TomlParseError);
				const diagnostic = e.diagnostics[0];
				assert.isDefined(diagnostic);
				assert.strictEqual(diagnostic.code, "NestingDepthExceeded");
			}),
		);

		it.effect("carries a summarizing message", () =>
			Effect.gen(function* () {
				const e = yield* Effect.result(Toml.parse("a = 1\na = 2\n")).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				assert.include(e.message, "TOML parse failed");
				assert.include(e.message, "DuplicateKey");
			}),
		);

		it.effect("renders the message position 1-based while the diagnostic fields stay 0-based", () =>
			Effect.gen(function* () {
				const e = yield* Effect.result(Toml.parse("[table\n")).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				assert.instanceOf(e, TomlParseError);
				const diagnostic = e.diagnostics[0];
				assert.isDefined(diagnostic);
				assert.strictEqual(diagnostic.code, "ExpectedTableHeaderClose");
				assert.strictEqual(diagnostic.line, 0);
				assert.strictEqual(diagnostic.character, 6);
				assert.include(e.message, "ExpectedTableHeaderClose at 1:7 ");
				assert.notInclude(e.message, "at 0:6");
				const dup = yield* Effect.result(Toml.parse("a = 1\na = 2\n")).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				const duplicateDiagnostic = dup.diagnostics[0];
				assert.isDefined(duplicateDiagnostic);
				assert.strictEqual(duplicateDiagnostic.line, 1);
				assert.strictEqual(duplicateDiagnostic.character, 0);
				assert.include(dup.message, "DuplicateKey at 2:1 ");
			}),
		);
	});

	describe("stringify", () => {
		it.effect("emits canonical layout: scalars, then tables, then array tables", () =>
			Effect.gen(function* () {
				const s = yield* Toml.stringify({ z: 1, t: { a: "x" }, arr: [{ n: 1 }, { n: 2 }] });
				assert.strictEqual(s, 'z = 1\n\n[t]\na = "x"\n\n[[arr]]\nn = 1\n\n[[arr]]\nn = 2\n');
			}),
		);

		it.effect("pins the layout byte-exact on nested tables, array tables and a quoted key", () =>
			Effect.gen(function* () {
				const s = yield* Toml.stringify({
					title: "t",
					"k y": { v: 1 },
					db: { server: "s", ports: [1, 2], meta: { on: true } },
					servers: [{ name: "a" }, { name: "b" }],
				});
				assert.strictEqual(
					s,
					'title = "t"\n\n["k y"]\nv = 1\n\n[db]\nserver = "s"\nports = [1, 2]\n\n[db.meta]\non = true\n\n[[servers]]\nname = "a"\n\n[[servers]]\nname = "b"\n',
				);
			}),
		);

		it.effect("round-trips value -> text -> value", () =>
			Effect.gen(function* () {
				const v = {
					a: [1, 2n ** 60n],
					"k y": 'va"l',
					nan: Number.NaN,
					d: TomlLocalDate.make({ year: 2000, month: 2, day: 29 }),
				};
				const back = yield* Toml.stringify(v).pipe(Effect.flatMap(Toml.parse));
				if (!P.isObject(back)) {
					assert.fail("expected a TOML table");
				}
				assert.strictEqual(back["k y"], 'va"l');
				const array = back.a;
				if (!A.isArray(array)) {
					assert.fail("expected an array");
				}
				assert.strictEqual(array[1], 2n ** 60n);
				assert.isTrue(Number.isNaN(back.nan));
				assert.isTrue(S.is(TomlLocalDate)(back.d));
				assert.strictEqual(String(back.d), "2000-02-29");
			}),
		);

		it.effect("rejects null, undefined, Date and out-of-range bigint typed", () =>
			Effect.gen(function* () {
				assert.strictEqual((yield* Effect.flip(Toml.stringify({ a: null }))).diagnostic.code, "UnsupportedValue");
				assert.strictEqual((yield* Effect.flip(Toml.stringify({ a: undefined }))).diagnostic.code, "UnsupportedValue");
				assert.strictEqual((yield* Effect.flip(Toml.stringify({ a: DateTime.toDateUtc(yield* DateTime.now) }))).diagnostic.code, "UnsupportedValue");
				assert.strictEqual((yield* Effect.flip(Toml.stringify({ a: 2n ** 63n }))).diagnostic.code, "IntegerOutOfRange");
			}),
		);

		it.effect("names the JS type and the key path in UnsupportedValue", () =>
			Effect.gen(function* () {
				const e = yield* Effect.flip(Toml.stringify({ o: { d: DateTime.toDateUtc(yield* DateTime.now) } }));
				assert.instanceOf(e, TomlStringifyError);
				assert.include(e.diagnostic.message, "Date");
				assert.include(e.diagnostic.message, "o.d");
			}),
		);

		it.effect("rejects a non-table root typed", () =>
			Effect.gen(function* () {
				const e = yield* Effect.flip(Toml.stringify(42));
				assert.strictEqual(e.diagnostic.code, "UnsupportedValue");
			}),
		);

		it.effect("accepts the exact int64 bounds and rejects one past them", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* Toml.stringify({ a: 2n ** 63n - 1n }), "a = 9223372036854775807\n");
				assert.strictEqual(yield* Toml.stringify({ a: -(2n ** 63n) }), "a = -9223372036854775808\n");
				const under = yield* Effect.flip(Toml.stringify({ a: -(2n ** 63n) - 1n }));
				assert.strictEqual(under.diagnostic.code, "IntegerOutOfRange");
			}),
		);

		it.effect("formats numbers: integral as integer, -0 as -0.0, specials, floats", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* Toml.stringify({ a: 1.0 }), "a = 1\n");
				assert.strictEqual(yield* Toml.stringify({ a: -0 }), "a = -0.0\n");
				assert.strictEqual(yield* Toml.stringify({ a: 0.5 }), "a = 0.5\n");
				assert.strictEqual(
					yield* Toml.stringify({ a: Number.POSITIVE_INFINITY, b: Number.NEGATIVE_INFINITY }),
					"a = inf\nb = -inf\n",
				);
				// Integral but past the int64 range: emitted as a float, so it
				// round-trips instead of overflowing at parse time.
				assert.strictEqual(yield* Toml.stringify({ a: 1e21 }), "a = 1e+21\n");
			}),
		);

		it.effect("quotes non-bare keys, the empty key included", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* Toml.stringify({ "": 1 }), '"" = 1\n');
				assert.strictEqual(yield* Toml.stringify({ "a.b": 1 }), '"a.b" = 1\n');
			}),
		);

		it.effect("emits empty structures: root, empty sub-table, empty array", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* Toml.stringify({}), "");
				assert.strictEqual(yield* Toml.stringify({ t: {} }), "[t]\n");
				assert.strictEqual(yield* Toml.stringify({ a: [] }), "a = []\n");
			}),
		);

		it.effect("renders mixed arrays inline with objects as inline tables", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* Toml.stringify({ a: [{ n: 1 }, 2] }), "a = [{ n = 1 }, 2]\n");
			}),
		);

		it.effect("escapes control characters in basic strings", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* Toml.stringify({ a: "x\ny\u0001" }), 'a = "x\\ny\\u0001"\n');
			}),
		);

		it.effect("fails typed on a circular reference", () =>
			Effect.gen(function* () {
				const o: Record<string, unknown> = { a: 1 };
				o.self = o;
				const e = yield* Effect.flip(Toml.stringify(o));
				assert.strictEqual(e.diagnostic.code, "CircularReference");
			}),
		);

		it.effect("surfaces the stringify depth guard typed, never a defect", () =>
			Effect.gen(function* () {
				let v: unknown = 1;
				for (let i = 0; i < 300; i++) {
					v = [v];
				}
				const e = yield* Effect.flip(Toml.stringify({ a: v }));
				assert.strictEqual(e.diagnostic.code, "NestingDepthExceeded");
			}),
		);

		it.effect("honors the crlf newline option", () =>
			Effect.gen(function* () {
				const s = yield* Toml.stringify({ a: 1 }, TomlStringifyOptions.make({ newline: "\r\n" }));
				assert.strictEqual(s, "a = 1\r\n");
			}),
		);
	});

	describe("schema factories", () => {
		const Config = S.Struct({ port: S.Finite });

		it.effect("TomlFromString decodes TOML text", () =>
			Effect.gen(function* () {
				const v = yield* S.decodeEffect(Toml.TomlFromString)("a = 1\n");
				assert.deepStrictEqual(v, { a: 1 });
			}),
		);

		it.effect("TomlFromString encodes a value back to TOML text", () =>
			Effect.gen(function* () {
				const s = yield* S.encodeUnknownEffect(Toml.TomlFromString)({ a: 1 });
				assert.strictEqual(s, "a = 1\n");
			}),
		);

		it.effect("schema(Target) decodes TOML straight into a domain value", () =>
			Effect.gen(function* () {
				const ConfigFromToml = Toml.schema(Config);
				const config = yield* S.decodeEffect(ConfigFromToml)("port = 8080\n");
				assert.deepStrictEqual(config, { port: 8080 });
			}),
		);

		it.effect("a failing decode surfaces a SchemaError carrying the parse message", () =>
			Effect.gen(function* () {
				const e = yield* Effect.result(S.decodeEffect(Toml.TomlFromString)("a = 1\na = 2\n")).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)));
				assert.strictEqual(e._tag, "SchemaError");
				assert.include(String(e), "TOML parse failed");
			}),
		);

		it.effect("a failing encode surfaces a SchemaError carrying the stringify message", () =>
			Effect.gen(function* () {
				const e = yield* Effect.flip(S.encodeUnknownEffect(Toml.TomlFromString)({ a: null }));
				assert.strictEqual(e._tag, "SchemaError");
				assert.include(String(e), "TOML stringify failed");
			}),
		);
	});

	describe("bind", () => {
		const Config = S.Struct({ port: S.Finite });
		const config = Toml.bind(Config);

		it.effect("decode parses TOML straight into a validated domain value", () =>
			Effect.gen(function* () {
				const value = yield* config.decode("port = 8080\n");
				assert.deepStrictEqual(value, { port: 8080 });
			}),
		);

		it.effect("decode surfaces a SchemaError carrying the parse message on malformed text", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(config.decode("port = 1\nport = 2\n"));
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "TOML parse failed");
			}),
		);

		it.effect("decode surfaces a SchemaError from the target schema, distinct from a parse failure", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(config.decode('port = "not-a-number"\n'));
				assert.strictEqual(error._tag, "SchemaError");
				assert.notInclude(String(error), "TOML parse failed");
			}),
		);

		it.effect("encode writes canonical TOML that decode round-trips", () =>
			Effect.gen(function* () {
				const text = yield* config.encode({ port: 8080 });
				assert.strictEqual(text, "port = 8080\n");
				const value = yield* config.decode(text);
				assert.deepStrictEqual(value, { port: 8080 });
			}),
		);

		it.effect("schema is the Toml.schema composition, usable with generic Schema machinery", () =>
			Effect.gen(function* () {
				const value = yield* S.decodeEffect(config.schema)("port = 8080\n");
				assert.deepStrictEqual(value, { port: 8080 });
			}),
		);
	});

	// The sync `Result` forms are the primitives; the `Effect` forms derive
	// from them via `Effect.fromResult` and add only the tracing span. These
	// assertions are what stop the two paths from ever drifting: every row is
	// checked in BOTH directions, so a future edit that re-derives the engine
	// on one side fails here rather than in a consumer.
	describe("Result parity", () => {
		const parseRows: ReadonlyArray<readonly [label: string, text: string]> = [
			["a representative document", 'title = "x"\n[owner]\nname = "y"\n[[srv]]\nport = 1\n'],
			["an empty document", ""],
			["every scalar shape", 'i = 1\nf = 1.5\nb = true\ns = "x"\nd = 1979-05-27\na = [1, 2]\n'],
			["a big integer past 2^53", "n = 9223372036854775807\n"],
			["a syntax error", "name = \n"],
			["a duplicate key", "a = 1\na = 2\n"],
			["an unterminated string", 'a = "oops\n'],
			["a nesting-depth bomb", `a = ${"[".repeat(300)}${"]".repeat(300)}\n`],
		];

		for (const [label, text] of parseRows) {
			it.effect(`parse and parseResult agree on ${label}`, () =>
				Effect.gen(function* () {
					const viaEffect = yield* Effect.result(Toml.parse(text));
					assert.deepStrictEqual(Toml.parseResult(text), viaEffect);
				}),
			);
		}

		const stringifyRows: ReadonlyArray<readonly [label: string, value: unknown]> = [
			["a nested table", { title: "x", owner: { name: "y" } }],
			["an array of tables", { srv: [{ port: 1 }, { port: 2 }] }],
			["an empty table", {}],
			["a null value TOML cannot represent", { nope: null }],
			["an out-of-int64-range bigint", { n: 2n ** 64n }],
			["a nesting-depth bomb", { a: Array.from({ length: 300 }).reduce<unknown>((acc) => [acc], 1) }],
		];

		for (const [label, value] of stringifyRows) {
			it.effect(`stringify and stringifyResult agree on ${label}`, () =>
				Effect.gen(function* () {
					const viaEffect = yield* Effect.result(Toml.stringify(value));
					assert.deepStrictEqual(Toml.stringifyResult(value), viaEffect);
				}),
			);
		}

		it.effect("both forms honor the newline option identically", () =>
			Effect.gen(function* () {
				const options = TomlStringifyOptions.make({ newline: "\r\n" });
				const viaEffect = yield* Effect.result(Toml.stringify({ a: 1, b: 2 }, options));
				const viaResult = Toml.stringifyResult({ a: 1, b: 2 }, options);
				assert.deepStrictEqual(viaResult, viaEffect);
				assert.strictEqual(Result.getOrThrow(viaResult), "a = 1\r\nb = 2\r\n");
			}),
		);

		it("parseResult carries the typed failure, not a throw", () => {
			const result = Toml.parseResult("name = \n");
			if (Result.isSuccess(result)) {
				return assert.fail("expected a typed parse failure");
			}
			assert.instanceOf(result.failure, TomlParseError);
			assert.isAtLeast(result.failure.diagnostics.length, 1);
		});

		it("stringifyResult carries the typed failure, not a throw", () => {
			const result = Toml.stringifyResult({ nope: null });
			if (Result.isSuccess(result)) {
				return assert.fail("expected a typed stringify failure");
			}
			assert.instanceOf(result.failure, TomlStringifyError);
		});

		// The defect firewall is a property of the engine, not of the wrapper:
		// a non-carrier throw must escape the sync form as a real throw, the
		// same way it dies through the Effect form (pinned in hostile.test.ts).
		it("parseResult rethrows a non-engine defect rather than typing it", () => {
			assert.throws(() => Toml.parseResult(42 as unknown as string), TypeError);
		});

		it("stringifyResult rethrows a non-engine defect rather than typing it", () => {
			const evil = {
				get boom(): number {
					throw new Error("boom");
				},
			};
			assert.throws(() => Toml.stringifyResult(evil), /boom/);
		});
	});

	describe("renderInlineValue", () => {
		it("renders a single value as an inline TOML fragment", () => {
			assert.strictEqual(renderInlineValue('va"l'), '"va\\"l"');
			assert.strictEqual(renderInlineValue([1, "x", []]), '[1, "x", []]');
			assert.strictEqual(renderInlineValue({ a: [1, true], b: {} }), "{ a = [1, true], b = {} }");
		});
	});
});
