import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import {
  AliasExpansionBudgetExceeded, nodeToJsValue, YamlAlias, YamlMap, YamlNode,
  YamlPair, YamlScalar, YamlSeq,
} from "../../effected/yaml/YamlNode.ts";

const scalar = (value: unknown, offset = 0, length = 1) => YamlScalar.make({ value, style: "plain", offset, length });
const alias = YamlAlias.make({ name: "a", offset: 10, length: 2 });
const seq = (items: ReadonlyArray<YamlNode>) => YamlSeq.make({ items, style: "flow", offset: 0, length: 20 });
const map = (items: ReadonlyArray<YamlPair>) => YamlMap.make({ items, style: "flow", offset: 0, length: 20 });
const pair = (key: YamlNode, value: YamlNode | null) => YamlPair.make({ key, value });

describe("YamlNode navigation edge cases", () => {
  it.effect("maps resolve value paths, search past earlier entries and preserve own proto keys", () => Effect.sync(() => {
    const first = scalar("first", 1, 1);
    const key = scalar("next", 4, 1);
    const value = scalar("target", 7, 1);
    const root = map([pair(first, null), pair(key, value)]);
    assertSome(root.find(["next"]), value);
    assertSome(root.findAtOffset(7), value);
    assertSome(root.findAtOffset(3), root);
    assertSome(root.pathOf(value), ["next"]);
    const withEarlierValue = map([pair(first, scalar("other", 2)), pair(key, value)]);
    assertSome(withEarlierValue.pathOf(value), ["next"]);
    assertNone(withEarlierValue.find(["absent"]));
    assert.strictEqual(value.toValue(), "target");
    const proto = map([pair(scalar("__proto__"), scalar("data"))]);
    assert.deepStrictEqual(proto.toValue(), { ["__proto__"]: "data" });
  }));

  it.effect("leaf navigation is identity based and spans are half open", () => Effect.sync(() => {
    for (const leaf of [scalar("a", 10, 2), alias]) {
      assertSome(leaf.find([]), leaf);
      assertNone(leaf.find(["x"]));
      assertNone(leaf.find([0]));
      assertSome(leaf.findAtOffset(10), leaf);
      assertNone(leaf.findAtOffset(9));
      assertNone(leaf.findAtOffset(12));
      assertSome(leaf.pathOf(leaf), []);
      assertNone(leaf.pathOf(scalar("stranger")));
    }
  }));

  it.effect("sequences search siblings and return their own span between children", () => Effect.sync(() => {
    const first = scalar("first", 2, 1);
    const second = scalar("second", 5, 1);
    const root = seq([first, second]);
    assertSome(root.find([1]), second);
    assertSome(root.find([]), root);
    assertNone(root.find([2]));
    assertNone(root.find(["first"]));
    assertSome(root.findAtOffset(5), second);
    assertSome(root.findAtOffset(4), root);
    assertSome(root.pathOf(second), [1]);
    assertNone(root.pathOf(scalar("second", 5, 1)));
    assert.deepStrictEqual(root.toValue(), ["first", "second"]);
  }));

  it.effect("maps handle null values, complex keys, key spans and identity paths", () => Effect.sync(() => {
    const key = scalar("empty", 1, 2);
    const numeric = scalar(3, 4, 1);
    const complex = seq([]);
    const value = scalar("v", 8, 1);
    const root = map([pair(key, null), pair(numeric, scalar("n", 6)), pair(complex, value)]);
    assertNone(root.find(["empty"]));
    assertNone(root.find(["3"]));
    assertNone(root.find([0]));
    assertSome(root.findAtOffset(1), key);
    assertSome(root.pathOf(key), ["empty"]);
    assertNone(root.pathOf(value));
    assertNone(root.pathOf(numeric));
    assert.deepStrictEqual(root.toValue(), { empty: null, "3": "n", "": "v" });
  }));

  it.effect("alias mapping keys resolve through anchors, including null and missing targets", () => Effect.sync(() => {
    const root = map([pair(alias, scalar("v"))]);
    assert.deepStrictEqual(root.toValue(), { "": "v" });
    assert.deepStrictEqual(root.toValue(MutableHashMap.empty()), { "": "v" });
    const anchors = MutableHashMap.empty<string, YamlNode>();
    MutableHashMap.set(anchors, "a", scalar("resolved"));
    assert.deepStrictEqual(root.toValue(anchors), { resolved: "v" });
    MutableHashMap.set(anchors, "a", scalar(null));
    assert.deepStrictEqual(root.toValue(anchors), { "": "v" });
    assert.strictEqual(alias.toValue(), null);
    assert.strictEqual(alias.toValue(MutableHashMap.empty()), null);
    assert.strictEqual(alias.toValue(anchors), null);
    const anchoredKey = YamlScalar.make({ value: "a", style: "plain", anchor: "a", offset: 0, length: 1 });
    assert.deepStrictEqual(map([pair(anchoredKey, alias)]).toValue(MutableHashMap.empty()), { a: "a" });
    assert.deepStrictEqual(map([pair(scalar(null), scalar(1))]).toValue(), { "": 1 });
  }));

  it.effect("explicit budgets fail with a typed error and support data-last extraction", () => Effect.sync(() => {
    const anchors = MutableHashMap.empty<string, YamlNode>();
    MutableHashMap.set(anchors, "a", scalar(42));
    assert.strictEqual(nodeToJsValue(anchors, 0)(alias), 42);
    assert.strictEqual(nodeToJsValue(null, anchors, 0), null);
    assert.throws(() => nodeToJsValue(alias, anchors, -1), AliasExpansionBudgetExceeded);
    assert.strictEqual(AliasExpansionBudgetExceeded.make({ message: "budget" }).name, "AliasExpansionBudgetExceeded");
  }));
});
