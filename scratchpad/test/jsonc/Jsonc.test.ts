import { assert, describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
	Jsonc,
	JsoncNode,
	JsoncParseError,
	JsoncParseOptions,
	JsoncStringifyError,
	JsoncStringifyOptions,
} from "@beep/scratchpad/effected/jsonc/index";

const deeplyNested = `${"[".repeat(20000)}1${"]".repeat(20000)}`;

describe("Jsonc", () => {
	describe("parse", () => {
		it.effect("parses objects, arrays and scalars", () =>
			Effect.gen(function* () {
				const value = yield* Jsonc.parse('{ "a": 1, "b": [true, null, "x"] }');
				assert.deepStrictEqual(value, { a: 1, b: [true, null, "x"] });
			}),
		);

		it.effect("ignores line and block comments by default", () =>
			Effect.gen(function* () {
				const value = yield* Jsonc.parse('{ "port": 3000 // dev\n /* block */ }');
				assert.deepStrictEqual(value, { port: 3000 });
			}),
		);

		it.effect("allows trailing commas by default", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* Jsonc.parse('{ "a": 1, }'), { a: 1 });
				assert.deepStrictEqual(yield* Jsonc.parse("[1, 2, ]"), [1, 2]);
			}),
		);

		it.effect("fails with an aggregate JsoncParseError carrying positioned details", () =>
			Effect.gen(function* () {
				const error = yield* Jsonc.parse("{ bad }").pipe(Effect.asVoid, Effect.flip);
				assert.instanceOf(error, JsoncParseError);
				assert.strictEqual(error._tag, "JsoncParseError");
				assert.isAbove(error.errors.length, 0);
				assert.strictEqual(error.input, "{ bad }");
				const detail = error.errors[0];
				assertDefined(detail);
				assert.strictEqual(detail.line, 0);
				assert.isAtLeast(detail.character, 0);
			}),
		);

		it.effect("renders the message position 1-based while the detail fields stay 0-based", () =>
			Effect.gen(function* () {
				const e = yield* Jsonc.parse('{ "a": }').pipe(Effect.asVoid, Effect.flip);
				assert.instanceOf(e, JsoncParseError);
				assertDefined(e.errors[0]);
				assert.strictEqual(e.errors[0].code, "ValueExpected");
				assert.strictEqual(e.errors[0].line, 0);
				assert.strictEqual(e.errors[0].character, 7);
				assert.include(e.message, "ValueExpected at 1:8");
				assert.notInclude(e.message, "at 0:7");
				const multi = yield* Jsonc.parse('{\n  "a": 1\n  "b": 2\n}').pipe(Effect.asVoid, Effect.flip);
				assertDefined(multi.errors[0]);
				assert.strictEqual(multi.errors[0].code, "CommaExpected");
				assert.strictEqual(multi.errors[0].line, 2);
				assert.strictEqual(multi.errors[0].character, 2);
				assert.include(multi.message, "CommaExpected at 3:3");
			}),
		);

		it.effect("computes line and character across newlines", () =>
			Effect.gen(function* () {
				const error = yield* Jsonc.parse('{\n  "a": 1\n  "b": 2\n}').pipe(Effect.asVoid, Effect.flip);
				assert.isAbove(error.errors.length, 0);
				// The CommaExpected error sits on line 2 ("b").
				assert.isTrue(error.errors.some((e) => e.line === 2));
			}),
		);

		it.effect("rejects comments when disallowComments is set", () =>
			Effect.gen(function* () {
				const error = yield* Jsonc.parse('{ "a": 1 } // no', JsoncParseOptions.make({ disallowComments: true })).pipe(Effect.asVoid, Effect.flip);
				assert.strictEqual(error._tag, "JsoncParseError");
				assert.isTrue(error.errors.some((e) => e.code === "InvalidCommentToken"));
			}),
		);
	});

	describe("parseResult", () => {
		it("succeeds synchronously with the decoded value", () => {
			const result = Jsonc.parseResult('{ "a": 1, "b": [true, null, "x"] // dev\n }');
			assert.isTrue(Result.isSuccess(result));
			if (Result.isSuccess(result)) {
				assert.deepStrictEqual(result.success, { a: 1, b: [true, null, "x"] });
			}
		});

		it("fails with the aggregate JsoncParseError carrying positioned details", () => {
			const result = Jsonc.parseResult("{ bad }");
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				const error = result.failure;
				assert.instanceOf(error, JsoncParseError);
				assert.strictEqual(error._tag, "JsoncParseError");
				assert.isAbove(error.errors.length, 0);
				assert.strictEqual(error.input, "{ bad }");
				const detail = error.errors[0];
				assertDefined(detail);
				assert.strictEqual(detail.line, 0);
				assert.isAtLeast(detail.character, 0);
			}
		});

		it("honors JsoncParseOptions", () => {
			const result = Jsonc.parseResult('{ "a": 1 } // no', JsoncParseOptions.make({ disallowComments: true }));
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				assert.isTrue(result.failure.errors.some((e) => e.code === "InvalidCommentToken"));
			}
		});

		it("bounds hostile deep nesting through the failure side, never a thrown RangeError", () => {
			const result = Jsonc.parseResult(deeplyNested);
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				assert.isTrue(result.failure.errors.some((e) => e.code === "NestingDepthExceeded"));
			}
		});
	});

	describe("parse delegates to parseResult", () => {
		it.effect("succeeds and fails identically to the Result variant", () =>
			Effect.gen(function* () {
				const viaEffect = yield* Jsonc.parse('{ "a": [1, 2], }');
				const viaResult = Jsonc.parseResult('{ "a": [1, 2], }');
				assert.isTrue(Result.isSuccess(viaResult));
				if (Result.isSuccess(viaResult)) {
					assert.deepStrictEqual(viaEffect, viaResult.success);
				}

				const effectError = yield* Jsonc.parse("{ bad }").pipe(Effect.asVoid, Effect.flip);
				const resultError = Jsonc.parseResult("{ bad }");
				assert.isTrue(Result.isFailure(resultError));
				if (Result.isFailure(resultError)) {
					assert.deepStrictEqual(effectError.errors, resultError.failure.errors);
				}
			}),
		);
	});

	describe("parseTree", () => {
		it.effect("builds a JsoncNode AST", () =>
			Effect.gen(function* () {
				const maybe = yield* Jsonc.parseTree('{ "a": [1, 2] }');
				assert.isTrue(O.isSome(maybe));
				const root = O.getOrThrow(maybe);
				assert.instanceOf(root, JsoncNode);
				assert.strictEqual(root.type, "object");
				assert.strictEqual(root.children?.length, 1);
				assert.deepStrictEqual(root.toValue(), { a: [1, 2] });
			}),
		);

		it.effect("returns O.none() for empty input with allowEmptyContent", () =>
			Effect.gen(function* () {
				const maybe = yield* Jsonc.parseTree("", JsoncParseOptions.make({ allowEmptyContent: true }));
				assert.isTrue(O.isNone(maybe));
			}),
		);

		// Regression guard for #13: tree construction used to double in cost per
		// nesting level (~4s at depth 20, effectively hanging past 25), so merely
		// COMPLETING inside the test timeout at depth 250 proves the internal
		// builder is no longer re-validating every subtree per node.
		it.effect("parses deep nesting under the depth cap in linear time (#13)", () =>
			Effect.gen(function* () {
				const depth = 250; // below MAX_NESTING_DEPTH (256)
				const maybe = yield* Jsonc.parseTree(`${"[".repeat(depth)}1${"]".repeat(depth)}`);
				let node = O.getOrThrow(maybe);
				let levels = 0;
				while (node.type === "array" && node.children?.length === 1) {
					const child = node.children[0];
					assertDefined(child);
					node = child;
					levels++;
				}
				assert.strictEqual(levels, depth);
				assert.strictEqual(node.type, "number");
				assert.strictEqual(node.value, 1);
			}),
		);

		it.effect("parses wide documents in time linear in node count (#13)", () =>
			Effect.gen(function* () {
				const maybe = yield* Jsonc.parseTree(`[${Array.from({ length: 10_000 }, (_, i) => i).join(",")}]`);
				const root = O.getOrThrow(maybe);
				assert.strictEqual(root.children?.length, 10_000);
				assert.strictEqual(root.children?.[9_999]?.value, 9_999);
			}),
		);

		it.effect("parser-built nodes are structurally equal to JsoncNode.make-built ones (#13)", () =>
			Effect.gen(function* () {
				const maybe = yield* Jsonc.parseTree('{"a": [1]}');
				const parsed = O.getOrThrow(maybe);
				const handBuilt = JsoncNode.make({
					type: "object",
					offset: 0,
					length: 10,
					children: [
						JsoncNode.make({
							type: "property",
							offset: 1,
							length: 8,
							colonOffset: 4,
							children: [
								JsoncNode.make({ type: "string", offset: 1, length: 3, value: "a" }),
								JsoncNode.make({
									type: "array",
									offset: 6,
									length: 3,
									children: [JsoncNode.make({ type: "number", offset: 7, length: 1, value: 1 })],
								}),
							],
						}),
					],
				});
				assert.instanceOf(parsed, JsoncNode);
				assert.isTrue(Equal.equals(parsed, handBuilt));
				assert.deepStrictEqual(parsed.toValue(), handBuilt.toValue());
			}),
		);
	});

	describe("parseTreeResult", () => {
		it("succeeds synchronously with the JsoncNode AST", () => {
			const result = Jsonc.parseTreeResult('{ "a": [1, 2] }');
			assert.isTrue(Result.isSuccess(result));
			if (Result.isSuccess(result)) {
				assert.isTrue(O.isSome(result.success));
				const root = O.getOrThrow(result.success);
				assert.instanceOf(root, JsoncNode);
				assert.strictEqual(root.type, "object");
				assert.strictEqual(root.children?.length, 1);
				assert.deepStrictEqual(root.toValue(), { a: [1, 2] });
			}
		});

		it("succeeds with O.none() for empty input with allowEmptyContent", () => {
			const result = Jsonc.parseTreeResult("", JsoncParseOptions.make({ allowEmptyContent: true }));
			assert.isTrue(Result.isSuccess(result));
			if (Result.isSuccess(result)) {
				assert.isTrue(O.isNone(result.success));
			}
		});

		it("fails with the aggregate JsoncParseError carrying positioned details", () => {
			const result = Jsonc.parseTreeResult("{ bad }");
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				const error = result.failure;
				assert.instanceOf(error, JsoncParseError);
				assert.strictEqual(error._tag, "JsoncParseError");
				assert.isAbove(error.errors.length, 0);
				assert.strictEqual(error.input, "{ bad }");
				const detail = error.errors[0];
				assertDefined(detail);
				assert.strictEqual(detail.line, 0);
				assert.isAtLeast(detail.character, 0);
			}
		});

		it("bounds hostile deep nesting through the failure side, never a thrown RangeError", () => {
			const result = Jsonc.parseTreeResult(deeplyNested);
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				assert.isTrue(result.failure.errors.some((e) => e.code === "NestingDepthExceeded"));
			}
		});
	});

	describe("parseTree delegates to parseTreeResult", () => {
		it.effect("succeeds and fails identically to the Result variant", () =>
			Effect.gen(function* () {
				const viaEffect = yield* Jsonc.parseTree('{ "a": [1, 2] }');
				const viaResult = Jsonc.parseTreeResult('{ "a": [1, 2] }');
				assert.isTrue(Result.isSuccess(viaResult));
				if (Result.isSuccess(viaResult)) {
					assert.isTrue(O.isSome(viaEffect));
					assert.isTrue(O.isSome(viaResult.success));
					assert.isTrue(Equal.equals(O.getOrThrow(viaEffect), O.getOrThrow(viaResult.success)));
				}

				const effectError = yield* Jsonc.parseTree("{ bad }").pipe(Effect.asVoid, Effect.flip);
				const resultError = Jsonc.parseTreeResult("{ bad }");
				assert.isTrue(Result.isFailure(resultError));
				if (Result.isFailure(resultError)) {
					assert.deepStrictEqual(effectError.errors, resultError.failure.errors);
				}
			}),
		);
	});

	describe("stripComments", () => {
		it("removes comments producing valid JSON", () => {
			assert.strictEqual(Jsonc.stripComments('{ "a": 1 // c\n}'), '{ "a": 1 \n}');
		});

		it("preserves offsets when a replacement character is given", () => {
			const input = '{ "a": 1 // comment\n}';
			const stripped = Jsonc.stripComments(input, " ");
			assert.strictEqual(stripped.length, input.length);
			assert.strictEqual(JSON.parse(stripped).a, 1);
		});
	});

	describe("stringifyResult", () => {
		it("default output is byte-identical to JSON.stringify(value, null, 2)", () => {
			const samples: ReadonlyArray<unknown> = [
				{ port: 3000, hosts: ["a", "b"], nested: { flag: true, nothing: null } },
				[1, "two", false, null, { deep: [{ deeper: 1.5 }] }],
				"plain string",
				42,
				true,
				null,
				{},
				[],
			];
			for (const value of samples) {
				const result = Jsonc.stringifyResult(value);
				assert.isTrue(Result.isSuccess(result));
				assert.strictEqual(Result.getOrThrow(result), JSON.stringify(value, null, 2));
			}
		});

		it("fails with CircularReference on a reference cycle", () => {
			const value: Record<string, unknown> = { a: 1 };
			value.self = value;
			const result = Jsonc.stringifyResult(value);
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				assert.strictEqual(result.failure._tag, "JsoncStringifyError");
				assert.strictEqual(result.failure.code, "CircularReference");
				assert.strictEqual(result.failure.value, value);
			}
		});

		it("fails with BigIntValue on top-level and nested bigints", () => {
			const topLevel = Jsonc.stringifyResult(1n);
			assert.isTrue(Result.isFailure(topLevel));
			if (Result.isFailure(topLevel)) {
				assert.strictEqual(topLevel.failure.code, "BigIntValue");
			}
			const nested = Jsonc.stringifyResult({ a: { b: [1n] } });
			assert.isTrue(Result.isFailure(nested));
			if (Result.isFailure(nested)) {
				assert.strictEqual(nested.failure.code, "BigIntValue");
			}
		});

		it("fails with TopLevelUnrepresentable when output would be absent", () => {
			for (const value of [undefined, () => 1, Symbol("s")]) {
				const result = Jsonc.stringifyResult(value);
				assert.isTrue(Result.isFailure(result));
				if (Result.isFailure(result)) {
					assert.strictEqual(result.failure.code, "TopLevelUnrepresentable");
				}
			}
		});

		it("nested unrepresentables follow JSON.stringify semantics (dropped in objects, null in arrays)", () => {
			const value = { keep: 1, drop: undefined, fn: () => 1, arr: [undefined, () => 1, 2] };
			const result = Jsonc.stringifyResult(value);
			assert.isTrue(Result.isSuccess(result));
			assert.strictEqual(Result.getOrThrow(result), JSON.stringify(value, null, 2));
			assert.deepStrictEqual(JSON.parse(Result.getOrThrow(result)), { keep: 1, arr: [null, null, 2] });
		});

		it("honors the tabSize and insertSpaces knobs", () => {
			const value = { a: [1] };
			assert.strictEqual(
				Result.getOrThrow(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ tabSize: 4 }))),
				JSON.stringify(value, null, 4),
			);
			assert.strictEqual(
				Result.getOrThrow(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ insertSpaces: false }))),
				JSON.stringify(value, null, "\t"),
			);
			assert.strictEqual(
				Result.getOrThrow(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ tabSize: 0 }))),
				JSON.stringify(value),
			);
		});

		it("a throwing toJSON rethrows as a defect, never a typed error", () => {
			const bomb = {
				toJSON: () => {
					throw new RangeError("boom");
				},
			};
			assert.throws(() => Jsonc.stringifyResult(bomb), RangeError);
		});
	});

	describe("stringify delegates to stringifyResult", () => {
		it.effect("succeeds and fails identically to the Result variant", () =>
			Effect.gen(function* () {
				const text = yield* Jsonc.stringify({ a: 1 });
				assert.strictEqual(text, '{\n  "a": 1\n}');
				const error = yield* Jsonc.stringify(1n).pipe(Effect.asVoid, Effect.flip);
				assert.instanceOf(error, JsoncStringifyError);
				assert.strictEqual(error._tag, "JsoncStringifyError");
				assert.strictEqual(error.code, "BigIntValue");
				assert.include(error.message, "JSONC stringify failed");
			}),
		);
	});

	describe("equals / equalsValue", () => {
		it("is key-order independent for objects", () => {
			assert.isTrue(Jsonc.equals('{ "a": 1, "b": 2 }', '{"b":2,"a":1}'));
		});

		it("is order-sensitive for arrays", () => {
			assert.isFalse(Jsonc.equals("[1, 2]", "[2, 1]"));
			assert.isTrue(Jsonc.equals("[1, 2]", "[1,2]"));
		});

		it("ignores comments and formatting", () => {
			assert.isTrue(Jsonc.equals('{ "a": 1 /* c */ }', '{\n  "a": 1 // note\n}'));
		});

		it("equalsValue compares against a JS value", () => {
			assert.isTrue(Jsonc.equalsValue('{ "port": 3000, "host": "x" }', { host: "x", port: 3000 }));
			assert.isFalse(Jsonc.equalsValue('{ "a": 1 }', { a: 2 }));
		});

		it("malformed input is never equal to anything", () => {
			assert.isFalse(Jsonc.equals("{ bad }", "{}"));
			assert.isFalse(Jsonc.equals("{}", "{ bad }"));
			assert.isFalse(Jsonc.equalsValue("{ bad }", {}));
		});
	});

	describe("hostile input", () => {
		it.effect("__proto__ becomes an own data property, never a prototype mutation", () =>
			Effect.gen(function* () {
				const text = '{ "__proto__": { "polluted": true } }';
				const value = (yield* Jsonc.parse(text)) as Record<string, unknown>;
				assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
				assert.isTrue(Object.hasOwn(value, "__proto__"));
				assert.isFalse("polluted" in {});
				const tree = yield* Jsonc.parseTree(text);
				const fromTree = O.getOrThrow(tree).toValue() as Record<string, unknown>;
				assert.strictEqual(Object.getPrototypeOf(fromTree), Object.prototype);
				assert.isTrue(Object.hasOwn(fromTree, "__proto__"));
			}),
		);

		it.effect("rejects unescaped control characters inside strings", () =>
			Effect.gen(function* () {
				const text = `{ "a": "x${String.fromCharCode(1)}y" }`;
				const error = yield* Jsonc.parse(text).pipe(Effect.asVoid, Effect.flip);
				assert.isTrue(error.errors.some((e) => e.code === "InvalidCharacter"));
			}),
		);

		it.effect("survives documents with tens of thousands of consecutive line breaks", () =>
			Effect.gen(function* () {
				const text = `[1,${"\n".repeat(50000)}2]`;
				assert.deepStrictEqual(yield* Jsonc.parse(text), [1, 2]);
			}),
		);

		it.effect("counts U+2028/U+2029 as line breaks in error positions", () =>
			Effect.gen(function* () {
				const error = yield* Jsonc.parse("{\u2028bad}").pipe(Effect.asVoid, Effect.flip);
				assert.isTrue(error.errors.some((e) => e.line === 1));
			}),
		);

		it.effect("deeply nested input fails with NestingDepthExceeded, not a stack-overflow defect (parse)", () =>
			Effect.gen(function* () {
				const error = yield* Jsonc.parse(deeplyNested).pipe(Effect.asVoid, Effect.flip);
				assert.instanceOf(error, JsoncParseError);
				assert.isTrue(error.errors.some((e) => e.code === "NestingDepthExceeded"));
				// Effect.result proves the failure is a typed Failure, never a defect.
				const result = yield* Effect.result(Jsonc.parse(deeplyNested));
				assert.isTrue(Result.isFailure(result));
			}),
		);

		it.effect("deeply nested input fails with NestingDepthExceeded, not a stack-overflow defect (parseTree)", () =>
			Effect.gen(function* () {
				const error = yield* Jsonc.parseTree(deeplyNested).pipe(Effect.asVoid, Effect.flip);
				assert.instanceOf(error, JsoncParseError);
				assert.isTrue(error.errors.some((e) => e.code === "NestingDepthExceeded"));
				const result = yield* Effect.result(Jsonc.parseTree(deeplyNested));
				assert.isTrue(Result.isFailure(result));
			}),
		);

		it("equalsValue returns false without throwing on a hostile hand-built value", () => {
			// The `value` side of equalsValue is arbitrary caller data. deepEqual only
			// recurses where both sides match structurally, so a one-sided deep value
			// bails at the first type mismatch (here depth 1: array vs the parsed
			// number) and cannot drive recursion deep \u2014 the MAX_NESTING_DEPTH branch in
			// deepEqual is belt-and-suspenders for a hypothetical two-sided-deep caller
			// (unreachable today: the text side is bounded by the parser's own cap).
			// This pins the user-facing contract: hostile input compares unequal and
			// never throws.
			let value: unknown = 1;
			for (let i = 0; i < 20000; i++) value = [value];
			assert.doesNotThrow(() => Jsonc.equalsValue("[1]", value));
			assert.isFalse(Jsonc.equalsValue("[1]", value));
		});
	});

	describe("schema pipeline", () => {
		const Config = S.Struct({ name: S.String, version: S.Finite });

		it.effect("JsoncFromString decodes commented input to unknown", () =>
			Effect.gen(function* () {
				const value = yield* S.decodeEffect(Jsonc.JsoncFromString)('{ "k": 42 // c\n}');
				assert.deepStrictEqual(value, { k: 42 });
			}),
		);

		it.effect("schema(Target) decodes JSONC straight into a domain value", () =>
			Effect.gen(function* () {
				const ConfigFromJsonc = Jsonc.schema(Config);
				const config = yield* S.decodeEffect(ConfigFromJsonc)('{ "name": "app", "version": 1 /* v1 */ }');
				assert.deepStrictEqual(config, { name: "app", version: 1 });
			}),
		);

		it.effect("encodes a value back to JSON", () =>
			Effect.gen(function* () {
				const encoded = yield* S.encodeUnknownEffect(Jsonc.JsoncFromString)({ a: 1 });
				assert.deepStrictEqual(yield* S.decodeEffect(S.fromJsonString(S.Unknown))(encoded), { a: 1 });
			}),
		);

		it.effect("encode surfaces a SchemaError carrying the stringify message on a circular value", () =>
			Effect.gen(function* () {
				const value: Record<string, unknown> = {};
				value.self = value;
				const error = yield* S.encodeUnknownEffect(Jsonc.JsoncFromString)(value).pipe(Effect.asVoid, Effect.flip);
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "JSONC stringify failed");
			}),
		);

		it.effect("boundary: Jsonc.parse yields JsoncParseError, never SchemaError", () =>
			Effect.gen(function* () {
				const error = yield* Jsonc.parse("{ bad }").pipe(Effect.asVoid, Effect.flip);
				assert.strictEqual(error._tag, "JsoncParseError");
			}),
		);

		it.effect("schema decode surfaces a SchemaError carrying the aggregate parse message", () =>
			Effect.gen(function* () {
				const error = yield* S.decodeEffect(Jsonc.JsoncFromString)("{ bad }").pipe(Effect.asVoid, Effect.flip);
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "JSONC parse failed");
			}),
		);

		it.effect("schema(Target) surfaces a SchemaError when TARGET validation fails, distinct from a parse failure", () =>
			Effect.gen(function* () {
				const ConfigFromJsonc = Jsonc.schema(Config);
				// Well-formed JSONC (parse succeeds) but the wrong shape for Config —
				// the failure comes from the target schema, not the JSONC parser.
				const error = yield* S.decodeEffect(ConfigFromJsonc)('{ "name": "app", "version": "not-a-number" }').pipe(Effect.asVoid, Effect.flip);
				assert.strictEqual(error._tag, "SchemaError");
				assert.notInclude(String(error), "JSONC parse failed");
			}),
		);
	});

	describe("bind", () => {
		const Config = S.Struct({ name: S.String, version: S.Finite });
		const config = Jsonc.bind(Config);

		it.effect("decode parses JSONC straight into a validated domain value", () =>
			Effect.gen(function* () {
				const value = yield* config.decode('{ "name": "app", "version": 1 /* v1 */ }');
				assert.deepStrictEqual(value, { name: "app", version: 1 });
			}),
		);

		it.effect("decode surfaces a SchemaError carrying the aggregate parse message on malformed text", () =>
			Effect.gen(function* () {
				const error = yield* config.decode("{ bad }").pipe(Effect.asVoid, Effect.flip);
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "JSONC parse failed");
			}),
		);

		it.effect("decode surfaces a SchemaError from the target schema, distinct from a parse failure", () =>
			Effect.gen(function* () {
				const error = yield* config.decode('{ "name": "app", "version": "not-a-number" }').pipe(Effect.asVoid, Effect.flip);
				assert.strictEqual(error._tag, "SchemaError");
				assert.notInclude(String(error), "JSONC parse failed");
			}),
		);

		it.effect("encode writes JSON text that decode round-trips", () =>
			Effect.gen(function* () {
				const text = yield* config.encode({ name: "app", version: 1 });
				assert.strictEqual(text, '{\n  "name": "app",\n  "version": 1\n}');
				const value = yield* config.decode(text);
				assert.deepStrictEqual(value, { name: "app", version: 1 });
			}),
		);

		it.effect("schema is the Jsonc.schema composition, usable with generic Schema machinery", () =>
			Effect.gen(function* () {
				const value = yield* S.decodeEffect(config.schema)('{ "name": "app", "version": 2, }');
				assert.deepStrictEqual(value, { name: "app", version: 2 });
			}),
		);
	});

	describe("parse ∘ stripComments agreement (property)", () => {
		// `-0` is a valid `Int` the native generator does emit, and neither JSON nor
		// YAML can carry it (`JSON.stringify(-0) === "0"`), so the round-trip domain
		// excludes it explicitly rather than letting `deepStrictEqual` fail on +0/-0.
		const Sample = S.Struct({
			name: S.String,
			count: S.Int.check(S.makeFilter((n) => !Object.is(n, -0))),
			enabled: S.Boolean,
			tags: S.Array(S.String),
		});

		it.effect.prop("parse agrees with JSON.parse on comment-free-equivalent input", [Sample], ([value]) =>
			Effect.gen(function* () {
				const json = yield* S.encodeEffect(S.fromJsonString(Sample))(value);
				const commented = json.replace(/}$/, " /* trailing */ }");
				const stripped = Jsonc.stripComments(commented);
				assert.deepStrictEqual(yield* S.decodeEffect(S.fromJsonString(Sample))(stripped), value);
				const parsed = yield* Jsonc.parse(commented);
				assert.deepStrictEqual(parsed, value);
			}),
		);

		it.effect.prop("JsoncFromString round-trips decode(encode(v)) back to the original value", [Sample], ([value]) =>
			Effect.gen(function* () {
				const encoded = yield* S.encodeUnknownEffect(Jsonc.JsoncFromString)(value);
				const decoded = yield* S.decodeEffect(Jsonc.JsoncFromString)(encoded);
				assert.deepStrictEqual(decoded, value);
			}),
		);
	});
});
