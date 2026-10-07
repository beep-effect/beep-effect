import { assert, describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { Jsonc, JsoncEdit, JsoncFormattingOptions, JsoncModificationError, JsoncModifier } from "@beep/scratchpad/effected/jsonc/index";

const apply = (text: string, edits: ReadonlyArray<JsoncEdit>) => JsoncEdit.applyAll(text, edits);

describe("JsoncModifier", () => {
	describe("replace", () => {
		it.effect("updates an existing object property", () =>
			Effect.gen(function* () {
				const text = '{ "a": 1 }';
				const edits = yield* JsoncModifier.modify(text, ["a"], 2);
				assert.strictEqual(apply(text, edits), '{ "a": 2 }');
			}),
		);

		it.effect("updates a nested array element", () =>
			Effect.gen(function* () {
				const text = '{ "xs": [1, 2, 3] }';
				const edits = yield* JsoncModifier.modify(text, ["xs", 1], 99);
				assert.strictEqual(apply(text, edits), '{ "xs": [1, 99, 3] }');
			}),
		);

		it.effect("preserves comments and surrounding whitespace (byte-minimal)", () =>
			Effect.gen(function* () {
				const text = '{\n  "a": 1, // keep\n  "b": 2\n}';
				const edits = yield* JsoncModifier.modify(text, ["b"], 5);
				const out = apply(text, edits);
				assert.include(out, "// keep");
				assert.include(out, '"b": 5');
			}),
		);
	});

	describe("insert", () => {
		it.effect("appends a new property after the last one", () =>
			Effect.gen(function* () {
				const text = '{ "a": 1 }';
				const edits = yield* JsoncModifier.modify(text, ["b"], 2);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), { a: 1, b: 2 });
			}),
		);

		it.effect("inserts into an empty object", () =>
			Effect.gen(function* () {
				const edits = yield* JsoncModifier.modify("{}", ["a"], 1);
				assert.deepStrictEqual(yield* Jsonc.parse(apply("{}", edits)), { a: 1 });
			}),
		);
	});

	describe("delete via undefined", () => {
		it.effect("removes an object property and its comma", () =>
			Effect.gen(function* () {
				const text = '{ "a": 1, "b": 2 }';
				const edits = yield* JsoncModifier.modify(text, ["a"], undefined);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), { b: 2 });
			}),
		);

		it.effect("removes an array element", () =>
			Effect.gen(function* () {
				const text = "[1, 2, 3]";
				const edits = yield* JsoncModifier.modify(text, [1], undefined);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), [1, 3]);
			}),
		);

		it.effect("deleting a missing key is a no-op", () =>
			Effect.gen(function* () {
				const edits = yield* JsoncModifier.modify('{ "a": 1 }', ["missing"], undefined);
				assert.deepStrictEqual(edits, []);
			}),
		);
	});

	describe("whole-document replace", () => {
		it.effect("replaces the entire document at the empty path", () =>
			Effect.gen(function* () {
				const edits = yield* JsoncModifier.modify('{ "old": 1 }', [], { new: true });
				assert.deepStrictEqual(yield* Jsonc.parse(apply('{ "old": 1 }', edits)), { new: true });
			}),
		);
	});

	describe("quote-containing keys (navigation correctness)", () => {
		it.effect("deletes a key that contains a quote character without corrupting siblings", () =>
			Effect.gen(function* () {
				const text = '{ "a\\"b": 1, "c": 2 }';
				const edits = yield* JsoncModifier.modify(text, ['a"b'], undefined);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), { c: 2 });
			}),
		);

		it.effect("replaces the value of a quote-containing key", () =>
			Effect.gen(function* () {
				const text = '{ "a\\"b": 1 }';
				const edits = yield* JsoncModifier.modify(text, ['a"b'], 42);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), { 'a"b': 42 });
			}),
		);
	});

	describe("structural comma handling (never string-searched)", () => {
		it.effect("deleting a key preceded by a comma-bearing block comment does not corrupt the document", () =>
			Effect.gen(function* () {
				const text = '{ "a": 1, /* x, y */ "b": 2 }';
				const edits = yield* JsoncModifier.modify(text, ["b"], undefined);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), { a: 1 });
			}),
		);

		it.effect("deleting a key after a comma-bearing line comment yields a valid document", () =>
			Effect.gen(function* () {
				// The comment sits between the separator comma and the deleted entry,
				// so it is removed with the entry — what must never happen is a cut
				// INSIDE the comment leaving a corrupt half-comment behind.
				const text = '{\n  "a": 1, // keep, please\n  "b": 2\n}';
				const edits = yield* JsoncModifier.modify(text, ["b"], undefined);
				const out = apply(text, edits);
				assert.deepStrictEqual(yield* Jsonc.parse(out), { a: 1 });
				assert.notInclude(out, "please");
			}),
		);

		it.effect("deleting the first property of a nested object leaves earlier siblings intact", () =>
			Effect.gen(function* () {
				const text = '{ "z": [1, 2], "o": { "a": 1, "b": 2 } }';
				const edits = yield* JsoncModifier.modify(text, ["o", "a"], undefined);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), { z: [1, 2], o: { b: 2 } });
			}),
		);

		it.effect("deleting the last array element leaves no dangling comma", () =>
			Effect.gen(function* () {
				const text = "[1, 2, 3]";
				const edits = yield* JsoncModifier.modify(text, [2], undefined);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), [1, 2]);
			}),
		);

		it.effect("deleting the first array element sees the separator through a comment", () =>
			Effect.gen(function* () {
				const text = "[ 1 /* c */, 2 ]";
				const edits = yield* JsoncModifier.modify(text, [0], undefined);
				assert.deepStrictEqual(yield* Jsonc.parse(apply(text, edits)), [2]);
			}),
		);
	});

	describe("generated content", () => {
		it.effect("JSON-escapes inserted keys containing special characters", () =>
			Effect.gen(function* () {
				const key = 'he"y\\there';
				const edits = yield* JsoncModifier.modify("{}", [key], 1);
				const parsed = yield* Jsonc.parse(apply("{}", edits));
				assert.deepStrictEqual(parsed, { [key]: 1 });
			}),
		);

		it.effect("honors insertSpaces: false in serialized values", () =>
			Effect.gen(function* () {
				const options = { formattingOptions: JsoncFormattingOptions.make({ insertSpaces: false }) };
				const edits = yield* JsoncModifier.modify("{}", ["a"], { b: 1 }, options);
				assertDefined(edits[0]);
				assert.include(edits[0].content, '\t"b"');
				assert.deepStrictEqual(yield* Jsonc.parse(apply("{}", edits)), { a: { b: 1 } });
			}),
		);

		it.effect("accepts formattingOptions as a plain literal, identically to an instance", () =>
			Effect.gen(function* () {
				const viaLiteral = yield* JsoncModifier.modify(
					"{}",
					["a"],
					{ b: 1 },
					{
						formattingOptions: { insertSpaces: false, tabSize: 2 },
					},
				);
				const viaInstance = yield* JsoncModifier.modify(
					"{}",
					["a"],
					{ b: 1 },
					{
						formattingOptions: JsoncFormattingOptions.make({ insertSpaces: false, tabSize: 2 }),
					},
				);
				assert.deepStrictEqual(viaLiteral, viaInstance);
				assertDefined(viaLiteral[0]);
				assert.include(viaLiteral[0].content, '\t"b"');
			}),
		);

		it.effect("a literal eol is honored in generated content", () =>
			Effect.gen(function* () {
				const edits = yield* JsoncModifier.modify("{}", ["a"], 1, {
					formattingOptions: { eol: "\r\n" },
				});
				assertDefined(edits[0]);
				assert.include(edits[0].content, "\r\n");
				assert.deepStrictEqual(yield* Jsonc.parse(apply("{}", edits)), { a: 1 });
			}),
		);
	});

	describe("errors", () => {
		it.effect("reports serialization failures when replacing or inserting values", () =>
			Effect.gen(function* () {
				const circular: Record<string, unknown> = {};
				circular.self = circular;
				for (const path of [[], ["a"]]) {
					for (const text of ["{}", '{"a":0}']) {
						const bigint = yield* JsoncModifier.modify(text, path, 1n).pipe(Effect.flip);
						assert.strictEqual(bigint._tag, "JsoncStringifyError");
						if (bigint._tag === "JsoncStringifyError") assert.strictEqual(bigint.code, "BigIntValue");
						const cycle = yield* JsoncModifier.modify(text, path, circular).pipe(Effect.flip);
						assert.strictEqual(cycle._tag, "JsoncStringifyError");
						if (cycle._tag === "JsoncStringifyError") assert.strictEqual(cycle.code, "CircularReference");
					}
				}
			}),
		);

		it.effect("fails with JsoncModificationError on a structural mismatch", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(JsoncModifier.modify('{ "a": 1 }', ["a", "b"], 2));
				assert.instanceOf(error, JsoncModificationError);
				assert.strictEqual(error._tag, "JsoncModificationError");
				assert.deepStrictEqual([...error.path], ["a", "b"]);
				assert.strictEqual(error.expected, "object");
				assert.strictEqual(typeof error.depth, "number");
				assert.include(error.message, "Modification failed");
				assert.include(error.message, `expected ${error.expected} at depth ${error.depth}`);
			}),
		);
	});

	describe("hostile input (hardening)", () => {
		it.effect("replaces a value past a deeply nested sibling without a stack-overflow defect", () =>
			Effect.gen(function* () {
				// The scanner-based navigator must skip the deep sibling `d` to reach
				// `a`; its skip is iterative, so hostile nesting cannot overflow.
				const deep = `${"[".repeat(20000)}1${"]".repeat(20000)}`;
				const text = `{ "d": ${deep}, "a": 1 }`;
				const result = yield* Effect.result(JsoncModifier.modify(text, ["a"], 2));
				assert.isTrue(result._tag === "Success");
				const edits = yield* JsoncModifier.modify(text, ["a"], 2);
				assert.strictEqual(JsoncEdit.applyAll(text, edits).includes('"a": 2'), true);
			}),
		);

		it.effect("modifying a value slot that holds a container closer does not swallow the closer", () =>
			Effect.gen(function* () {
				// Malformed input: the `k` value slot is empty, so the token where a
				// value should start is the object's own `}`. skipValue() must not
				// consume that closer as the (absent) value — doing so decrements the
				// bracket level past zero and splices the `}` into the edit range,
				// corrupting the document.
				const text = '{"k":}';
				const edits = yield* JsoncModifier.modify(text, ["k"], 5);
				const out = JsoncEdit.applyAll(text, edits);
				assert.strictEqual(out.endsWith("}"), true);
				assert.deepStrictEqual(yield* Jsonc.parse(out), { k: 5 });
			}),
		);
	});
});
