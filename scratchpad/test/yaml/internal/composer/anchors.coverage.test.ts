import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import { YamlAlias, YamlMap, YamlPair, YamlScalar, YamlSeq } from "../../../../effected/yaml/YamlNode.ts";
import { buildAnchorMap, checkAnchorOnAlias, getAliasName, getAnchorName, getNodeValue, makeAlias, registerAnchor, scanName } from "../../../../effected/yaml/internal/composer/anchors.ts";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";

describe("anchor machinery boundary behavior", () => {
  it.effect("uses the CST source when the expected sigil is absent", () => Effect.sync(() => {
    const cst = { type: "alias", source: "fallback", offset: 0, length: 1 } as const;
    assert.strictEqual(getAnchorName(cst, "x"), "fallback");
    assert.strictEqual(getAliasName(cst, ""), "fallback");
    for (const delimiter of [" ", "\t", "\n", "\r", "{", "}", "[", "]", ","]) {
      assert.strictEqual(scanName(`name${delimiter}suffix`, 0), "name");
    }
    assert.strictEqual(scanName("", 0), "");
    assert.strictEqual(scanName("name", 0), "name");
  }));

  it.effect("records anchored-alias errors and counts only defined references", () => Effect.sync(() => {
    const state = createState("*name", { composeFlowMap, composeFlowSeq }, { maxAliasCount: 1 });
    const cst = { type: "alias", source: "*name", offset: 0, length: 5 } as const;
    checkAnchorOnAlias({}, cst, state);
    assert.deepStrictEqual(state.errors, []);
    checkAnchorOnAlias({ anchor: "other" }, cst, state);
    assert.strictEqual(state.errors[0]?.message, "Anchor &other cannot be applied to alias *name");
    assert.strictEqual(makeAlias(cst, state).name, "name");
    assert.strictEqual(state.aliasCount, 0);
    const first = YamlScalar.make({ value: 1, style: "plain", offset: 0, length: 1 });
    const second = YamlScalar.make({ value: 2, style: "plain", offset: 0, length: 1 });
    registerAnchor(first, "name", state, 0);
    registerAnchor(second, "name", state, 7);
    assertSome(MutableHashMap.get(state.anchors, "name"), second);
    assert.strictEqual(state.warnings[0]?.code, "DuplicateAnchor");
    assert.strictEqual(state.warnings[0]?.offset, 7);
    makeAlias(cst, state);
    makeAlias(cst, state);
    assert.strictEqual(state.aliasCount, 2);
    assert.deepStrictEqual(state.errors.map((e) => e.code), ["DuplicateAnchor", "UndefinedAlias", "AliasCountExceeded"]);
  }));

  it.effect("collects collection, key and value anchors and ignores aliases and null", () => Effect.sync(() => {
    const leaf = YamlScalar.make({ value: "v", style: "plain", anchor: "leaf", offset: 0, length: 1 });
    const key = YamlScalar.make({ value: "k", style: "plain", anchor: "key", offset: 0, length: 1 });
    const plain = YamlScalar.make({ value: "plain", style: "plain", offset: 0, length: 1 });
    const alias = YamlAlias.make({ name: "leaf", offset: 0, length: 1 });
    const map = YamlMap.make({ items: [YamlPair.make({ key, value: leaf }), YamlPair.make({ key: plain, value: null })], anchor: "map", style: "flow", offset: 0, length: 1 });
    const seq = YamlSeq.make({ items: [map, alias], anchor: "seq", style: "flow", offset: 0, length: 1 });
    const anchors = buildAnchorMap(seq);
    for (const [name, node] of [["leaf", leaf], ["key", key], ["map", map], ["seq", seq]] as const) {
      assertSome(MutableHashMap.get(anchors, name), node);
    }
    assert.strictEqual(MutableHashMap.size(buildAnchorMap(null)), 0);
    assert.strictEqual(getNodeValue(null), null);
    assert.strictEqual(getNodeValue(alias, anchors), "v");
    const empty = YamlSeq.make({ items: [YamlMap.make({ items: [], style: "flow", offset: 0, length: 0 })], style: "flow", offset: 0, length: 0 });
    assert.strictEqual(MutableHashMap.size(buildAnchorMap(empty)), 0);
  }));
});
