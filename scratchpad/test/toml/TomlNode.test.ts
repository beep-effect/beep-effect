import { assert, describe, it } from "@effect/vitest";
import { Equal, Schema } from "effect";
import { TomlLocalDate } from "../../effected/toml/TomlDateTime.ts";
import {
	TomlArray,
	TomlArrayTableHeader,
	TomlBoolean,
	TomlDateTimeLiteral,
	TomlExpression,
	TomlFloat,
	TomlInlineEntry,
	TomlInlineTable,
	TomlInteger,
	TomlKey,
	TomlKeyValue,
	TomlString,
	TomlTableHeader,
	TomlTrivia,
} from "../../effected/toml/TomlNode.ts";

/** A small `a = 1`-shaped key-value tree, built fresh on every call. */
function sampleKeyValue(): TomlKeyValue {
	return TomlKeyValue.make({
		keyPath: [TomlKey.make({ value: "a", kind: "bare", offset: 0, length: 1 })],
		value: TomlInteger.make({ value: 1, offset: 4, length: 1 }),
		comment: "trailing",
		offset: 0,
		length: 16,
	});
}

describe("TomlNode", () => {
	describe("construction with make", () => {
		it("constructs TomlKey with each kind", () => {
			const bare = TomlKey.make({ value: "a", kind: "bare", offset: 0, length: 1 });
			assert.strictEqual(bare._tag, "TomlKey");
			assert.strictEqual(bare.kind, "bare");
			const basic = TomlKey.make({ value: "c d", kind: "basic", offset: 4, length: 5 });
			assert.strictEqual(basic.value, "c d");
			const literal = TomlKey.make({ value: "e", kind: "literal", offset: 10, length: 3 });
			assert.strictEqual(literal.kind, "literal");
		});
		it("constructs TomlString with a style", () => {
			const node = TomlString.make({ value: "hi\n", style: "multiline-basic", offset: 0, length: 11 });
			assert.strictEqual(node._tag, "TomlString");
			assert.strictEqual(node.style, "multiline-basic");
			assert.strictEqual(node.value, "hi\n");
		});
		it("constructs TomlInteger with number and bigint values", () => {
			const small = TomlInteger.make({ value: 42, offset: 0, length: 2 });
			assert.strictEqual(small.value, 42);
			const big = TomlInteger.make({ value: 9007199254740993n, offset: 0, length: 16 });
			assert.strictEqual(big.value, 9007199254740993n);
		});
		it("constructs TomlFloat and TomlBoolean", () => {
			const float = TomlFloat.make({ value: 3.5, offset: 0, length: 3 });
			assert.strictEqual(float._tag, "TomlFloat");
			assert.strictEqual(float.value, 3.5);
			const bool = TomlBoolean.make({ value: true, offset: 0, length: 4 });
			assert.strictEqual(bool._tag, "TomlBoolean");
			assert.isTrue(bool.value);
		});
		it("constructs TomlDateTimeLiteral around a datetime class", () => {
			const node = TomlDateTimeLiteral.make({
				value: TomlLocalDate.make({ year: 1979, month: 5, day: 27 }),
				offset: 0,
				length: 10,
			});
			assert.strictEqual(node._tag, "TomlDateTimeLiteral");
			assert.isTrue(node.value instanceof TomlLocalDate);
		});
		it("constructs TomlArray, TomlInlineEntry and TomlInlineTable", () => {
			const entry = TomlInlineEntry.make({
				keyPath: [TomlKey.make({ value: "p", kind: "bare", offset: 6, length: 1 })],
				value: TomlInteger.make({ value: 1, offset: 10, length: 1 }),
				offset: 6,
				length: 5,
			});
			const table = TomlInlineTable.make({ entries: [entry], offset: 4, length: 9 });
			assert.strictEqual(table._tag, "TomlInlineTable");
			assert.strictEqual(table.entries.length, 1);
			const array = TomlArray.make({ items: [table], offset: 3, length: 11 });
			assert.strictEqual(array._tag, "TomlArray");
			assert.strictEqual(array.items[0], table);
		});
		it("constructs TomlKeyValue with and without the optional comment", () => {
			const withComment = sampleKeyValue();
			assert.strictEqual(withComment.comment, "trailing");
			const bare = TomlKeyValue.make({
				keyPath: [TomlKey.make({ value: "a", kind: "bare", offset: 0, length: 1 })],
				value: TomlInteger.make({ value: 1, offset: 4, length: 1 }),
				offset: 0,
				length: 6,
			});
			assert.isFalse(Object.hasOwn(bare, "comment"));
		});
		it("constructs both header classes and TomlTrivia", () => {
			const header = TomlTableHeader.make({
				keyPath: [TomlKey.make({ value: "t", kind: "bare", offset: 1, length: 1 })],
				offset: 0,
				length: 4,
			});
			assert.strictEqual(header._tag, "TomlTableHeader");
			const arrayHeader = TomlArrayTableHeader.make({
				keyPath: [TomlKey.make({ value: "t", kind: "bare", offset: 2, length: 1 })],
				comment: "products",
				offset: 0,
				length: 17,
			});
			assert.strictEqual(arrayHeader._tag, "TomlArrayTableHeader");
			assert.strictEqual(arrayHeader.comment, "products");
			const trivia = TomlTrivia.make({ text: "# note\n\n", offset: 0, length: 8 });
			assert.strictEqual(trivia._tag, "TomlTrivia");
			assert.strictEqual(trivia.text.length, trivia.length);
		});
	});

	describe("structural equality", () => {
		it("treats two identical TomlKeyValue trees as equal", () => {
			assert.isTrue(Equal.equals(sampleKeyValue(), sampleKeyValue()));
		});
		it("treats trees differing in a leaf as unequal", () => {
			const other = TomlKeyValue.make({
				keyPath: [TomlKey.make({ value: "a", kind: "bare", offset: 0, length: 1 })],
				value: TomlInteger.make({ value: 2, offset: 4, length: 1 }),
				comment: "trailing",
				offset: 0,
				length: 16,
			});
			assert.isFalse(Equal.equals(sampleKeyValue(), other));
		});
	});

	describe("schema wiring", () => {
		it("round-trips a nested TomlArray through encode and decode", () => {
			const array = TomlArray.make({
				items: [
					TomlString.make({ value: "x", style: "basic", offset: 5, length: 3 }),
					TomlArray.make({
						items: [TomlInteger.make({ value: 1, offset: 11, length: 1 })],
						offset: 10,
						length: 3,
					}),
					TomlInlineTable.make({
						entries: [
							TomlInlineEntry.make({
								keyPath: [TomlKey.make({ value: "p", kind: "bare", offset: 16, length: 1 })],
								value: TomlBoolean.make({ value: false, offset: 20, length: 5 }),
								offset: 16,
								length: 9,
							}),
						],
						offset: 15,
						length: 11,
					}),
				],
				offset: 4,
				length: 23,
			});
			const encoded = Schema.encodeSync(TomlArray)(array);
			const decoded = Schema.decodeUnknownSync(TomlArray)(encoded);
			assert.isTrue(decoded instanceof TomlArray);
			assert.isTrue(decoded.items[1] instanceof TomlArray);
			assert.isTrue(decoded.items[2] instanceof TomlInlineTable);
			assert.isTrue(Equal.equals(decoded, array));
		});
		it("decodes each expression variant through the TomlExpression union", () => {
			const trivia = TomlTrivia.make({ text: "\n", offset: 0, length: 1 });
			const decoded = Schema.decodeUnknownSync(TomlExpression)(Schema.encodeSync(TomlExpression)(trivia));
			assert.isTrue(decoded instanceof TomlTrivia);
			const kv = Schema.decodeUnknownSync(TomlExpression)(Schema.encodeSync(TomlExpression)(sampleKeyValue()));
			assert.isTrue(kv instanceof TomlKeyValue);
		});
	});
});
