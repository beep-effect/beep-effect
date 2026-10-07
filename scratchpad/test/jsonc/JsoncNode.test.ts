import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Jsonc, JsoncNode, JsoncNodeType, JsoncPath, JsoncSegment } from "../../effected/jsonc/index.ts";
import { makeNodeUnsafe } from "@beep/scratchpad/effected/jsonc/JsoncNode";

const tree = (text: string): JsoncNode => Jsonc.parseTreeResult(text).pipe(Result.getOrThrow, O.getOrThrow);

// A hand-built tree deeper than the walker cap: arrays wrapping one leaf.
const deepArray = (depth: number): JsoncNode => {
  let node = makeNodeUnsafe({ type: "number", offset: depth, length: 1, value: 1 });
  for (let i = depth - 1; i >= 0; i--) {
    node = makeNodeUnsafe({ type: "array", offset: i, length: 2 * (depth - i) + 1, children: [node] });
  }
  return node;
};

// A hand-built tree of nested single-property objects deeper than the cap.
const deepObject = (depth: number): JsoncNode => {
  let node = makeNodeUnsafe({ type: "number", offset: 5 * depth, length: 1, value: 1 });
  for (let i = depth - 1; i >= 0; i--) {
    const offset = 5 * i;
    const key = makeNodeUnsafe({ type: "string", offset: offset + 1, length: 3, value: "k" });
    const prop = makeNodeUnsafe({ type: "property", offset: offset + 1, length: node.offset + node.length - offset - 1, colonOffset: offset + 4, children: [key, node] });
    node = makeNodeUnsafe({ type: "object", offset, length: node.offset + node.length - offset + 1, children: [prop] });
  }
  return node;
};

describe("JsoncNode", () => {
  describe("schemas", () => {
    it("JsoncSegment accepts keys and non-negative indices only", () => {
      assert.isTrue(S.is(JsoncSegment)("port"));
      assert.isTrue(S.is(JsoncSegment)(0));
      assert.isFalse(S.is(JsoncSegment)(-1));
      assert.isFalse(S.is(JsoncSegment)(1.5));
      assert.isTrue(S.is(JsoncPath)(["a", 0]));
      assert.isFalse(S.is(JsoncPath)([null]));
    });

    it("JsoncNodeType is a literal kit with an exhaustive matcher", () => {
      assert.isTrue(JsoncNodeType.is.property("property"));
      const arity = JsoncNodeType.$match({
        object: () => "container",
        array: () => "container",
        property: () => "pair",
        string: () => "leaf",
        number: () => "leaf",
        boolean: () => "leaf",
        null: () => "leaf",
      });
      assert.strictEqual(arity("array"), "container");
      assert.strictEqual(arity("null"), "leaf");
    });

    it("JsoncNode round-trips through its codec", () => {
      const node = JsoncNode.make({ type: "array", offset: 0, length: 3, children: [JsoncNode.make({ type: "number", offset: 1, length: 1, value: 1 })] });
      const encoded = Result.getOrThrow(S.encodeResult(JsoncNode)(node));
      const decoded = Result.getOrThrow(S.decodeResult(JsoncNode)(encoded));
      assert.isTrue(Equal.equals(node, decoded));
      assert.isTrue(Result.isFailure(S.decodeResult(JsoncNode)({ type: "array", offset: -1, length: 0 })));
    });
  });

  describe("construction", () => {
    it("constructs via make", () => {
      const node = JsoncNode.make({ type: "number", offset: 0, length: 2, value: 42 });
      assert.strictEqual(node.type, "number");
      assert.strictEqual(node.value, 42);
      assert.strictEqual(node.children, undefined);
    });

    it("makeNodeUnsafe builds an instance equal to a validated one", () => {
      const unsafe = makeNodeUnsafe({ type: "string", offset: 0, length: 3, value: "x" });
      assert.instanceOf(unsafe, JsoncNode);
      assert.isTrue(Equal.equals(unsafe, JsoncNode.make({ type: "string", offset: 0, length: 3, value: "x" })));
    });
  });

  describe("find", () => {
    it.effect("navigates object keys and array indices", () =>
      Effect.gen(function* () {
        const root = O.getOrThrow(yield* Jsonc.parseTree('{ "a": { "b": [10, 20] } }'));
        assert.strictEqual(O.map(root.find(["a", "b", 1]), (node) => node.toValue()).pipe(O.getOrThrow), 20);
        assertSome(O.map(root.find([]), (node) => node.type), "object");
      })
    );

    it("returns none for missing paths and mismatched segment kinds", () => {
      const root = tree('{ "a": 1, "xs": [1] }');
      assertNone(root.find(["missing"]));
      assertNone(root.find(["a", "deeper"]));
      assertNone(root.find([0]));
      assertNone(root.find(["xs", "key"]));
      assertNone(root.find(["xs", 5]));
      assertNone(tree("[1]").find(["a"]));
    });

    it("resolves keys that contain quote characters", () => {
      const found = tree('{ "a\\"b": 1 }').find(['a"b']);
      assertSome(O.map(found, (node) => node.toValue()), 1);
    });
  });

  describe("findAtOffset / pathAt", () => {
    it("finds the innermost node at an offset and its path", () => {
      const text = '{ "a": { "b": 42 } }';
      const root = tree(text);
      const offset = text.indexOf("42");
      assertSome(O.map(root.findAtOffset(offset), (node) => node.type), "number");
      assertSome(root.pathAt(offset), ["a", "b"]);
    });

    it("returns none outside the tree", () => {
      const root = tree('{ "a": 1 }');
      assertNone(root.findAtOffset(9999));
      assertNone(root.pathAt(9999));
    });

    it("resolves to the container when the offset sits between children", () => {
      const text = '{ "a": 1 , "b": [1 , 2] }';
      const root = tree(text);
      assertSome(O.map(root.findAtOffset(text.indexOf(",")), (node) => node.type), "object");
      assertSome(root.pathAt(text.indexOf(",")), []);
      assertSome(root.pathAt(text.lastIndexOf(",")), ["b"]);
      assertSome(root.pathAt(text.indexOf('"a"')), ["a"]);
      assertSome(root.pathAt(text.indexOf("2")), ["b", 1]);
    });

    it("ignores non-property children of an object and resolves within a property node", () => {
      const stray = makeNodeUnsafe({ type: "number", offset: 1, length: 1, value: 1 });
      const key = makeNodeUnsafe({ type: "string", offset: 3, length: 3, value: "a" });
      const value = makeNodeUnsafe({ type: "number", offset: 7, length: 1, value: 2 });
      const prop = makeNodeUnsafe({ type: "property", offset: 3, length: 5, colonOffset: 6, children: [key, value] });
      const root = makeNodeUnsafe({ type: "object", offset: 0, length: 9, children: [stray, prop] });
      assertSome(O.map(root.find(["a"]), (node) => node.value), 2);
      assertNone(root.find(["b"]));
      assertSome(root.pathAt(7), ["a"]);
      assertSome(root.pathAt(1), []);
      assertSome(prop.pathAt(7), []);
      assertSome(O.map(prop.findAtOffset(7), (node) => node.value), 2);
      assert.deepStrictEqual(root.toValue(), { a: 2 });
    });

    it("pathAt stops at a key-only property", () => {
      const key = makeNodeUnsafe({ type: "string", offset: 1, length: 3, value: "a" });
      const prop = makeNodeUnsafe({ type: "property", offset: 1, length: 3, children: [key] });
      const root = makeNodeUnsafe({ type: "object", offset: 0, length: 5, children: [prop] });
      assertSome(root.pathAt(2), ["a"]);
      assertSome(O.map(root.findAtOffset(2), (node) => node.type), "string");
    });
  });

  describe("toValue", () => {
    it.effect("reconstructs nested values", () =>
      Effect.gen(function* () {
        const root = O.getOrThrow(yield* Jsonc.parseTree('{ "x": [1, { "y": true }], "z": null, "f": false, "s": "str" }'));
        assert.deepStrictEqual(root.toValue(), { x: [1, { y: true }], z: null, f: false, s: "str" });
      })
    );

    it("evaluates a property node to its value and skips key-only properties", () => {
      const root = tree('{ "a": 1 }');
      assert.strictEqual(root.children?.[0]?.toValue(), 1);
      const key = makeNodeUnsafe({ type: "string", offset: 1, length: 3, value: "a" });
      const prop = makeNodeUnsafe({ type: "property", offset: 1, length: 3, children: [key] });
      assert.strictEqual(prop.toValue(), undefined);
      assert.deepStrictEqual(makeNodeUnsafe({ type: "object", offset: 0, length: 5, children: [prop] }).toValue(), {});
      assert.deepStrictEqual(makeNodeUnsafe({ type: "object", offset: 0, length: 2 }).toValue(), {});
    });

    it("defines __proto__ as an own data property", () => {
      const value = tree('{ "__proto__": { "polluted": true } }').toValue();
      assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
      assert(P.isObject(value), "toValue yields a plain object");
      assert.isTrue(Object.hasOwn(value, "__proto__"));
    });
  });

  describe("hand-built trees past the depth cap", () => {
    it("toValue yields bounded placeholders instead of overflowing", () => {
      const arrays = deepArray(300).toValue();
      let depth = 0;
      let cursor: unknown = arrays;
      while (Array.isArray(cursor) && cursor.length === 1) {
        cursor = cursor[0];
        depth++;
      }
      assert.deepStrictEqual(cursor, []);
      assert.strictEqual(depth, 256);
      let object: unknown = deepObject(300).toValue();
      for (let i = 0; i < 256; i++) {
        assert(P.isObject(object), `object level ${i} is a plain object`);
        object = object["k"];
      }
      assert.deepStrictEqual(object, {});
      const leaf = makeNodeUnsafe({ type: "array", offset: 0, length: 3, children: [makeNodeUnsafe({ type: "number", offset: 1, length: 1, value: 1 })] });
      assert.deepStrictEqual(deepArray(255).toValue(), JSON.parse(`${"[".repeat(255)}1${"]".repeat(255)}`));
      assert.strictEqual(leaf.children?.[0]?.toValue(), 1);
    });

    it("every node kind at the cap evaluates to its bounded placeholder", () => {
      const wrap = (leaf: JsoncNode): JsoncNode => {
        let node = leaf;
        for (let i = 255; i >= 0; i--) {
          node = makeNodeUnsafe({ type: "array", offset: i, length: 600 - 2 * i, children: [node] });
        }
        return node;
      };
      const innermost = (value: unknown): unknown => {
        let cursor = value;
        for (let i = 0; i < 256; i++) {
          assert(A.isArray(cursor), `array level ${i} is an array`);
          cursor = cursor[0];
        }
        return cursor;
      };
      const key = makeNodeUnsafe({ type: "string", offset: 256, length: 3, value: "k" });
      const leaves: ReadonlyArray<readonly [JsoncNode, unknown]> = [
        [makeNodeUnsafe({ type: "string", offset: 256, length: 3, value: "s" }), null],
        [makeNodeUnsafe({ type: "number", offset: 256, length: 1, value: 1 }), null],
        [makeNodeUnsafe({ type: "boolean", offset: 256, length: 4, value: true }), null],
        [makeNodeUnsafe({ type: "null", offset: 256, length: 4, value: null }), null],
        [makeNodeUnsafe({ type: "property", offset: 256, length: 3, children: [key] }), null],
        [makeNodeUnsafe({ type: "object", offset: 256, length: 2 }), {}],
        [makeNodeUnsafe({ type: "array", offset: 256, length: 2 }), []],
      ];
      for (const [leaf, placeholder] of leaves) {
        assert.deepStrictEqual(innermost(wrap(leaf).toValue()), placeholder, leaf.type);
      }
    });

    it("findAtOffset and pathAt stop descending at the cap", () => {
      const root = deepArray(300);
      assertSome(O.map(root.findAtOffset(300), (node) => node.offset), 256);
      assertSome(O.map(root.pathAt(300), (path) => path.length), 256);
    });
  });

  describe("offset discipline", () => {
    it("node spans never swallow trailing whitespace or comments", () => {
      const text = '{ "a": 1   // trailing\n}';
      const valueNode = tree(text).children?.[0]?.children?.[1];
      assert.strictEqual(text.substring(valueNode?.offset ?? 0, (valueNode?.offset ?? 0) + (valueNode?.length ?? 0)), "1");
    });

    it("string value spans stop at the closing quote and array spans at the bracket", () => {
      const text = '[ "hello"  , 2 ]   ';
      const root = tree(text);
      const first = root.children?.[0];
      assert.strictEqual(text.substring(first?.offset ?? 0, (first?.offset ?? 0) + (first?.length ?? 0)), '"hello"');
      assert.strictEqual(text.substring(root.offset, root.offset + root.length), '[ "hello"  , 2 ]');
    });
  });

  describe("structural equality and hashing", () => {
    it("Equal.equals holds for structurally identical nodes and hash agrees", () => {
      const a = JsoncNode.make({ type: "string", offset: 0, length: 3, value: "x" });
      const b = JsoncNode.make({ type: "string", offset: 0, length: 3, value: "x" });
      const c = JsoncNode.make({ type: "string", offset: 0, length: 3, value: "y" });
      assert.isTrue(Equal.equals(a, b));
      assert.isFalse(Equal.equals(a, c));
      assert.strictEqual(Hash.hash(a), Hash.hash(b));
    });
  });
});
