import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import * as O from "effect/Option";
import { Jsonc, JsoncNode } from "@beep/scratchpad/effected/jsonc/index";

describe("JsoncNode", () => {
	describe("construction", () => {
		it("constructs via make", () => {
			const node = JsoncNode.make({ type: "number", offset: 0, length: 2, value: 42 });
			assert.strictEqual(node.type, "number");
			assert.strictEqual(node.value, 42);
			assert.strictEqual(node.children, undefined);
		});
	});

	describe("find", () => {
		it.effect("navigates object keys and array indices", () =>
			Effect.gen(function* () {
				const root = O.getOrThrow(yield* Jsonc.parseTree('{ "a": { "b": [10, 20] } }'));
				const b1 = root.find(["a", "b", 1]);
				assert.isTrue(O.isSome(b1));
				assert.strictEqual(O.getOrThrow(b1).toValue(), 20);
			}),
		);

		it.effect("returns none for missing paths", () =>
			Effect.gen(function* () {
				const root = O.getOrThrow(yield* Jsonc.parseTree('{ "a": 1 }'));
				assert.isTrue(O.isNone(root.find(["missing"])));
				assert.isTrue(O.isNone(root.find(["a", "deeper"])));
				assert.isTrue(O.isNone(root.find([0])));
			}),
		);
	});

	describe("findAtOffset / pathAt", () => {
		it.effect("finds the innermost node at an offset and its path", () =>
			Effect.gen(function* () {
				const text = '{ "a": { "b": 42 } }';
				const root = O.getOrThrow(yield* Jsonc.parseTree(text));
				const offset = text.indexOf("42");
				const node = root.findAtOffset(offset);
				assert.isTrue(O.isSome(node));
				assert.strictEqual(O.getOrThrow(node).type, "number");
				assert.deepStrictEqual(O.getOrThrow(root.pathAt(offset)), ["a", "b"]);
			}),
		);

		it.effect("returns none outside the tree", () =>
			Effect.gen(function* () {
				const root = O.getOrThrow(yield* Jsonc.parseTree('{ "a": 1 }'));
				assert.isTrue(O.isNone(root.findAtOffset(9999)));
				assert.isTrue(O.isNone(root.pathAt(9999)));
			}),
		);
	});

	describe("toValue", () => {
		it.effect("reconstructs nested values", () =>
			Effect.gen(function* () {
				const root = O.getOrThrow(yield* Jsonc.parseTree('{ "x": [1, { "y": true }], "z": null }'));
				assert.deepStrictEqual(root.toValue(), {
					x: [1, { y: true }],
					z: null,
				});
			}),
		);
	});

	describe("offset discipline (issue #62)", () => {
		it.effect("node spans never swallow trailing whitespace or comments", () =>
			Effect.gen(function* () {
				const text = '{ "a": 1   // trailing\n}';
				const root = O.getOrThrow(yield* Jsonc.parseTree(text));
				const prop = root.children?.[0];
				const valueNode = prop?.children?.[1];
				assert.isDefined(valueNode);
				// The value node covers exactly "1", not the trailing spaces/comment.
				const span = text.substring(valueNode?.offset ?? 0, (valueNode?.offset ?? 0) + (valueNode?.length ?? 0));
				assert.strictEqual(span, "1");
			}),
		);

		it.effect("string value spans stop at the closing quote", () =>
			Effect.gen(function* () {
				const text = '[ "hello"  , 2 ]';
				const root = O.getOrThrow(yield* Jsonc.parseTree(text));
				const first = root.children?.[0];
				assert.isDefined(first);
				const span = text.substring(first?.offset ?? 0, (first?.offset ?? 0) + (first?.length ?? 0));
				assert.strictEqual(span, '"hello"');
			}),
		);

		it.effect("array span stops at the closing bracket", () =>
			Effect.gen(function* () {
				const text = "[1, 2]   ";
				const root = O.getOrThrow(yield* Jsonc.parseTree(text));
				const span = text.substring(root.offset, root.offset + root.length);
				assert.strictEqual(span, "[1, 2]");
			}),
		);
	});

	describe("structural equality and hashing", () => {
		it("Equal.equals holds for structurally-identical nodes; hash agrees", () => {
			const a = JsoncNode.make({ type: "string", offset: 0, length: 3, value: "x" });
			const b = JsoncNode.make({ type: "string", offset: 0, length: 3, value: "x" });
			const c = JsoncNode.make({ type: "string", offset: 0, length: 3, value: "y" });
			assert.isTrue(Equal.equals(a, b));
			assert.isFalse(Equal.equals(a, c));
			assert.strictEqual(Hash.hash(a), Hash.hash(b));
		});
	});

	describe("quote-containing keys", () => {
		it.effect("resolves keys that contain quote characters", () =>
			Effect.gen(function* () {
				const root = O.getOrThrow(yield* Jsonc.parseTree('{ "a\\"b": 1 }'));
				const found = root.find(['a"b']);
				assert.isTrue(O.isSome(found));
				assert.strictEqual(O.getOrThrow(found).toValue(), 1);
			}),
		);
	});
});
