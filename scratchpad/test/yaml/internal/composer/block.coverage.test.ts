import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import { buildPairs, checkDuplicateKeys, checkMultilineImplicitKeys, checkTrailingContentOnSameLine, composeBlockMap, composeBlockSeq, composeFlatBlockMap, flattenBlockMapChildren, keyIdentity } from "../../../../effected/yaml/internal/composer/block.ts";
import type { SemanticItem } from "../../../../effected/yaml/internal/composer/block.ts";
import { createState, MAX_NESTING_DEPTH } from "../../../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import type { CstNode, CstNodeType } from "../../../../effected/yaml/internal/cst.ts";
import { YamlAlias, YamlMap, YamlPair, YamlScalar, YamlSeq } from "../../../../effected/yaml/YamlNode.ts";

const flow = { composeFlowMap, composeFlowSeq };
const scalar = (value: unknown, offset = 0, length = 1) => YamlScalar.make({ value, style: "plain", offset, length });
const tokens = (parts: ReadonlyArray<readonly [CstNodeType, string]>) => {
  let offset = 0;
  const children: CstNode[] = [];
  for (const [type, source] of parts) {
    children.push({ type, source, offset, length: source.length });
    offset += source.length;
  }
  return { text: parts.map((part) => part[1]).join(""), children };
};
const wrapper = (type: CstNodeType, text: string, children?: ReadonlyArray<CstNode>): CstNode => ({ type, source: text, offset: 0, length: text.length, ...(children === undefined ? {} : { children }) });

describe("block composer edge coverage", () => {
  it.effect("key identities distinguish scalar types and explicit numeric tags", () => Effect.sync(() => {
    const samples: ReadonlyArray<readonly [unknown, string, string, string | undefined]> = [
      [null, "", "null", undefined], [true, "true", "b:true", undefined], ["x", "x", "s:x", undefined], [1n, "1", "i:1", undefined], [{}, "", "o:[object Object]", undefined],
      [1, "1", "f:1", "!!float"], [1, "1.0", "i:1", "!!int"], [1, "1", "i:1", "!number"],
    ];
    for (const [value, raw, expected, tag] of samples) {
      const key = YamlScalar.make({ value, style: "plain", offset: 0, length: raw.length, ...(tag === undefined ? {} : { tag }) });
      assert.strictEqual(keyIdentity(raw)(key), expected);
    }
    const state = createState("x", flow);
    checkDuplicateKeys(state)([YamlPair.make({ key: scalar("x"), value: null }), YamlPair.make({ key: scalar("x"), value: null })]);
    assert.strictEqual(state.warnings[0]?.code, "DuplicateKey");
  }));

  it.effect("empty collections, metadata, curried calls, and nesting guards", () => Effect.sync(() => {
    for (const meta of [{}, { anchor: "" }, { anchor: "root", tag: "!map", comment: "head" }]) {
      const state = createState("# tail", flow, { uniqueKeys: false });
      const children: CstNode[] = [{ type: "comment", source: "# tail", offset: 0, length: 6 }];
      const map = composeBlockMap(state, undefined, meta)(wrapper("block-map", "# tail", children));
      const seq = composeBlockSeq(state, meta)(wrapper("block-seq", "# tail", children));
      assert.strictEqual(map.comment, "comment" in meta ? "head\n tail" : " tail");
      assert.strictEqual(seq.comment, map.comment);
      assert.deepStrictEqual(map.toValue(), {});
      assert.deepStrictEqual(seq.toValue(), []);
      if (meta.anchor === "root") assert.strictEqual(O.isSome(MutableHashMap.get(state.anchors, "root")), true);
      const flat = composeFlatBlockMap(0, wrapper("document", "# tail"), state, scalar("key"), meta)(children);
      assert.strictEqual(flat.items[0]?.key.comment, " tail");
      assert.strictEqual(flat.comment, "comment" in meta ? "head" : undefined);
    }
    {
      const state = createState("", flow);
      state.depth = MAX_NESTING_DEPTH;
      assert.deepStrictEqual(composeBlockMap(wrapper("block-map", ""), state).items, []);
      assert.strictEqual(state.errors[0]?.code, "NestingDepthExceeded");
      assert.deepStrictEqual(composeBlockSeq(wrapper("block-seq", ""), state).items, []);
    }
    assert.deepStrictEqual(composeBlockMap(wrapper("block-map", ""), createState("", flow)).items, []);
    assert.deepStrictEqual(composeBlockSeq(wrapper("block-seq", ""), createState("", flow)).items, []);
  }));

  it.effect("empty metadata is flushed without registering empty anchors", () => Effect.sync(() => {
    const cases: ReadonlyArray<ReadonlyArray<readonly [CstNodeType, string]>> = [
      [["anchor", "& "], ["whitespace", ":"]],
      [["tag", "!!str"], ["whitespace", ":"]],
      [["whitespace", ":"], ["anchor", "& "], ["flow-scalar", "key"], ["whitespace", ":"]],
      [["whitespace", ":"], ["tag", "!!str"], ["flow-scalar", "key"], ["whitespace", ":"]],
      [["whitespace", "?"], ["anchor", "&a "], ["flow-scalar", "x"], ["newline", "\n"], ["whitespace", "  "], ["flow-scalar", "y"], ["whitespace", ":"]],
      [["whitespace", ":"], ["tag", "!!str"], ["flow-scalar", "01"]],
    ];
    for (const parts of cases) {
      const { text, children } = tokens(parts);
      const state = createState(text, flow);
      const items = flattenBlockMapChildren(state)(children);
      assert.strictEqual(items.length > 0, true);
      assert.strictEqual(state.depth, 0);
      assert.strictEqual(MutableHashMap.has(state.anchors, ""), false);
    }
  }));

  it.effect("sequence pending metadata and blank comment runs survive composition", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [ReadonlyArray<readonly [CstNodeType, string]>, ReadonlyArray<unknown>]> = [
      [[["whitespace", "-"], ["anchor", "& "], ["newline", "\n"], ["whitespace", "-"]], [null, null]],
      [[["whitespace", "-"], ["tag", "!!str"]], [""]],
      [[["anchor", "& "], ["flow-scalar", "a"], ["newline", "\n"], ["flow-scalar", "b"]], ["a b"]],
      [[["tag", "!!str"], ["flow-map", "{}"], ["tag", "!!str"], ["flow-seq", "[]"]], [{}, []]],
      [[["tag", "!!str"], ["block-map", ""], ["tag", "!!str"], ["block-seq", ""]], [{}, []]],
      [[["error", ""], ["error", "bad"]], []],
    ];
    for (const [parts, expected] of cases) {
      const { text, children } = tokens(parts);
      const state = createState(text, flow);
      const seq = composeBlockSeq(wrapper("block-seq", text, children), state);
      assert.deepStrictEqual(seq.toValue(), expected);
    }
    const { text, children } = tokens([["flow-scalar", "a"], ["newline", "\n\n"], ["comment", "# first"], ["newline", "\n\n"], ["comment", "# second"], ["newline", "\n\n"], ["flow-scalar", "b"]]);
    const seq = composeBlockSeq(wrapper("block-seq", text, children), createState(text, flow));
    assert.strictEqual(seq.items[1]?.commentBefore, " first\n\n second\n");
    assert.strictEqual(seq.items[1]?.spaceBefore, true);
  }));
  it.effect("semantic pairing handles empty explicit keys, null keys, and orphan comments", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [SemanticItem[], string, number]> = [
      [[{ kind: "key" }], "", 1],
      [[{ kind: "key" }, { kind: "comment", comment: "c", offset: -1 }, { kind: "node", node: scalar("x") }], "x", 1],
      [[{ kind: "key" }, { kind: "value-sep", offset: 0 }, { kind: "key" }], ":", 2],
      [[{ kind: "value-sep", offset: 0 }, { kind: "comment", comment: "inline", offset: 2 }, { kind: "key" }], ": #inline", 2],
      [[{ kind: "value-sep", offset: 0 }, { kind: "comment", comment: "a", offset: 2 }, { kind: "comment", comment: "b", offset: 5 }], ":\n#a\n#b", 1],
      [[{ kind: "comment", comment: "c", offset: -1 }, { kind: "node", node: scalar("x", -1) }], "", 1],
      [[{ kind: "node", node: YamlAlias.make({ name: "a", offset: 0, length: 2 }) }, { kind: "value-sep", offset: 2 }, { kind: "comment", comment: "tail", offset: 4 }], "*a: #tail", 1],
      [[{ kind: "node", node: scalar("x") }, { kind: "comment", comment: "a", offset: 2 }, { kind: "comment", comment: "b", offset: 5 }], "x #a #b", 1],
      [[{ kind: "node", node: scalar("x") }, { kind: "value-sep", offset: 1 }, { kind: "key" }], "x:", 2],
      [[{ kind: "comment", comment: "orphan", offset: -1 }], "", 0],
    ];
    for (const [items, text, size] of cases) {
      const pairs: YamlPair[] = [];
      const trailing = buildPairs(pairs, text)(items);
      assert.strictEqual(pairs.length, size);
      if (size === 0) assert.strictEqual(trailing, "orphan");
    }
    const pairs: YamlPair[] = [YamlPair.make({ key: scalar("x"), value: null })];
    buildPairs([{ kind: "comment", comment: "tail", offset: 2 }], pairs, "x #tail");
    assert.strictEqual(pairs[0]?.key.comment, "tail");
  }));

  it.effect("diagnostic helpers accept trivia and distinguish explicit and multiline keys", () => Effect.sync(() => {
    const { text, children } = tokens([["whitespace", " "], ["whitespace", ":"], ["comment", "#ok"], ["newline", "\n"], ["flow-scalar", "later"]]);
    for (let start = 0; start < children.length; start++) {
      const state = createState(text, flow);
      checkTrailingContentOnSameLine(start, wrapper("flow-scalar", "x"), state)(children);
      assert.deepStrictEqual(state.errors, []);
    }
    const state = createState("key\n:\n", flow);
    checkMultilineImplicitKeys(state, [{ kind: "node", node: scalar("key", 0, 3) }, { kind: "comment", comment: "c", offset: 3 }, { kind: "value-sep", offset: 4 }])([]);
    assert.strictEqual(state.errors[0]?.message, "Implicit mapping key and value indicator must be on the same line");
    for (const prefix of ["?", " ?", "\t?", "\n?", "\r?", "x?", "  "]) {
      const source = `${prefix} [\na]`;
      const key = YamlSeq.make({ items: [], style: "flow", offset: prefix.length + 1, length: 5 });
      const local = createState(source, flow);
      checkMultilineImplicitKeys([YamlPair.make({ key, value: null })], local);
      assert.strictEqual(local.errors.length, prefix === "x?" || prefix === "  " ? 1 : 0);
    }
    const block = YamlMap.make({ items: [], style: "block", offset: 0, length: 3 });
    const local = createState("x\ny", flow);
    checkMultilineImplicitKeys([YamlPair.make({ key: block, value: null })], local);
    assert.deepStrictEqual(local.errors, []);
  }));

  it.effect("sparse CST and semantic arrays skip absent entries", () => Effect.sync(() => {
    const children: CstNode[] = [wrapper("flow-scalar", "x"), wrapper("whitespace", ":"), wrapper("flow-scalar", "y")];
    delete children[0];
    const state = createState("x:y", flow);
    assert.strictEqual(flattenBlockMapChildren(children, state)[0]?.kind, "value-sep");
    assert.deepStrictEqual(composeBlockSeq(wrapper("block-seq", "x:y", children), createState("x:y", flow)).toValue(), ["y"]);
    checkTrailingContentOnSameLine(children, 0, wrapper("flow-scalar", "x"), state);
    const items: SemanticItem[] = [{ kind: "node", node: scalar("x") }, { kind: "node", node: scalar("y") }];
    delete items[0];
    const pairs: YamlPair[] = [];
    buildPairs(items, pairs, "xy");
    assert.strictEqual(pairs.length, 1);
    checkMultilineImplicitKeys(pairs, state, items);
    const afterSep: SemanticItem[] = [{ kind: "node", node: scalar("x") }, { kind: "value-sep", offset: 1 }, { kind: "node", node: scalar("y") }];
    delete afterSep[2];
    const nullPairs: YamlPair[] = [];
    buildPairs(afterSep, nullPairs, "x:y");
    assert.strictEqual(nullPairs[0]?.value, null);
    delete afterSep[0];
    buildPairs(afterSep, [], "x:y");
  }));

  it.effect("external comments trim only owned spans and are reinjected by sequences", () => Effect.sync(() => {
    const edge = createState("\n", flow);
    edge.escapedComments.push({ text: "stale", offset: 0 });
    assert.strictEqual(composeBlockMap(wrapper("block-map", "\n"), edge).length, 1);
    const text = "x\n\n  a\n# tail\n";
    const state = createState(text, flow);
    state.escapedComments.push({ text: "before", offset: -1 }, { text: "first", offset: 0 }, { text: "after", offset: text.length });
    const map = composeBlockMap(wrapper("block-map", text), state);
    assert.strictEqual(map.length, text.length);
    const seqState = createState(text, flow);
    seqState.escapedComments.push({ text: " tail", offset: 7 });
    const seq = composeBlockSeq({ type: "block-seq", source: text.slice(4), offset: 4, length: text.length - 4, children: [{ type: "flow-scalar", source: "a", offset: 5, length: 1 }] }, seqState);
    assert.strictEqual(seq.length, 3);
    assert.strictEqual(seqState.escapedComments[0]?.text, " tail");
  }));

  it.effect("nested empty keys retain their properties while metadata belongs to containers across newlines", () => Effect.sync(() => {
    for (const type of ["tag", "anchor"] as const) {
      for (const prefix of ["", "&outer\n"]) {
        const source = `${prefix}${type === "tag" ? "!!str" : "&inner"} : value`;
        const offset = prefix.length + (type === "tag" ? 6 : 7);
        const nested: CstNode = { type: "block-map", source: ": value", offset, length: 7, children: [{ type: "whitespace", source: ":", offset, length: 1 }, { type: "flow-scalar", source: "value", offset: offset + 2, length: 5 }] };
        const children: CstNode[] = prefix === "" ? [] : [{ type: "anchor", source: "&outer", offset: 0, length: 6 }, { type: "newline", source: "\n", offset: 6, length: 1 }];
        children.push({ type, source: type === "tag" ? "!!str" : "&inner", offset: prefix.length, length: type === "tag" ? 5 : 6 }, { type: "whitespace", source: " ", offset: offset - 1, length: 1 }, nested);
        const state = createState(source, flow);
        const items = flattenBlockMapChildren(children, state);
        const node = items[0];
        assert.strictEqual(node?.kind, "node");
        if (node?.kind === "node" && node.node._tag === "YamlMap") {
          const key = node.node.items[0]?.key;
          assert.strictEqual(key?._tag, "YamlScalar");
          if (key?._tag === "YamlScalar") {
            assert.strictEqual(key.tag, type === "tag" ? "!!str" : undefined);
            assert.strictEqual(key.anchor, type === "anchor" ? "inner" : undefined);
          }
          assert.strictEqual(node.node.anchor, prefix === "" ? undefined : "outer");
        }
        const seq = composeBlockSeq(wrapper("block-seq", source, children), createState(source, flow));
        assert.strictEqual(seq.items[0]?._tag, "YamlMap");
      }
    }
  }));

  it.effect("property-only entries and containers combine outer and pending metadata", () => Effect.sync(() => {
    for (const suffix of [["whitespace", ":"], ["flow-seq", "[]"], ["flow-map", "{}"], ["alias", "*missing"]] as const) {
      const { text, children } = tokens([["anchor", "&one "], ["newline", "\n"], ["tag", "!!str"], ["newline", "\n"], ["anchor", "&two "], suffix]);
      const state = createState(text, flow);
      const items = flattenBlockMapChildren(children, state);
      assert.strictEqual(items[0]?.kind, "node");
      if (items[0]?.kind === "node" && items[0].node._tag !== "YamlAlias") assert.strictEqual(items[0].node.anchor, "two");
    }
    for (const suffix of ["flow-map", "flow-seq"] as const) {
      const { text, children } = tokens([[suffix, suffix === "flow-map" ? "{}" : "[]"]]);
      const state = createState(text, flow);
      assert.strictEqual(flattenBlockMapChildren(children, state)[0]?.kind, "node");
      assert.deepStrictEqual(state.errors, []);
    }
  }));

  it.effect("explicit key lookahead and stray sequence markers validate their context", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [ReadonlyArray<readonly [CstNodeType, string]>, string | undefined]> = [
      [[["whitespace", "?"], ["whitespace", " "], ["flow-scalar", "a"], ["whitespace", ":"], ["flow-scalar", "b"], ["newline", "\n"], ["whitespace", "?"], ["flow-scalar", "c"]], undefined],
      [[["whitespace", "?"], ["whitespace", " "], ["whitespace", ":"]], undefined],
      [[["whitespace", ":"], ["newline", "\n"], ["comment", "#c"], ["newline", "\n"], ["whitespace", "-"]], "Block sequence entry indicator outside any sequence"],
      [[["whitespace", ":"], ["newline", "\n"], ["block-seq", ""], ["whitespace", "-"]], undefined],
      [[["whitespace", ":"], ["newline", "\n"], ["block-map", "?"], ["whitespace", "-"]], undefined],
      [[["whitespace", ":"], ["newline", "\n"], ["flow-scalar", "x"], ["newline", "\n"], ["whitespace", "-"]], "Block sequence entry indicator outside any sequence"],
      [[["whitespace", ":"], ["flow-scalar", "'a'"]], undefined],
      [[["whitespace", ":"], ["whitespace", "\t"]], undefined],
      [[["whitespace", ":"], ["newline", "\n"], ["tag", "!!str"]], undefined],
      [[["anchor", "&one "], ["newline", "\n"], ["anchor", "&two "], ["flow-scalar", "a"], ["block-map", ":b"]], undefined],
    ];
    for (const [parts, diagnostic] of cases) {
      const { text, children } = tokens(parts);
      const state = createState(text, flow);
      flattenBlockMapChildren(children, state);
      assert.strictEqual(state.errors.some((error) => error.message === diagnostic), diagnostic !== undefined);
      assert.strictEqual(state.depth, 0);
    }
  }));

  it.effect("metadata on merged explicit keys and sequence values is preserved", () => Effect.sync(() => {
    const { text, children } = tokens([["whitespace", "?"], ["whitespace", " "], ["anchor", "&a "], ["flow-scalar", "x"], ["newline", "\n"], ["whitespace", "   "], ["flow-scalar", "y"], ["newline", "\n"], ["whitespace", ":"]]);
    const items = flattenBlockMapChildren(children, createState(text, flow));
    assert.strictEqual(items[0]?.kind, "node");
    const seqSource = tokens([["anchor", "&a "], ["flow-scalar", "x"], ["newline", "\n"], ["flow-scalar", "y"]]);
    const seq = composeBlockSeq(wrapper("block-seq", seqSource.text, seqSource.children), createState(seqSource.text, flow));
    const first = seq.items[0];
    assert.strictEqual(first?._tag, "YamlScalar");
    if (first?._tag === "YamlScalar") assert.strictEqual(first.anchor, "a");
    assert.deepStrictEqual(seq.toValue(), ["x y"]);
    const trailing = tokens([["anchor", "& "], ["newline", "\n"]]);
    const empty = composeBlockSeq(wrapper("block-seq", trailing.text, trailing.children), createState(trailing.text, flow));
    const emptyFirst = empty.items[0];
    assert.strictEqual(emptyFirst?._tag, "YamlScalar");
    if (emptyFirst?._tag === "YamlScalar") assert.strictEqual(emptyFirst.anchor, "");
    const noSpace = tokens([["comment", "#lead"], ["newline", "\n"], ["flow-scalar", "a"]]);
    const leading = composeBlockSeq(wrapper("block-seq", noSpace.text, noSpace.children), createState(noSpace.text, flow));
    assert.strictEqual(leading.items[0]?.commentBefore, "lead");
    assert.strictEqual(leading.items[0]?.spaceBefore, undefined);
  }));

  it.effect("metadata comments can stand alone and terminal comments join them", () => Effect.sync(() => {
    const meta = { comment: "head", anchor: "named" };
    const map = composeBlockMap(wrapper("block-map", ""), createState("", flow), undefined, meta);
    const seq = composeBlockSeq(wrapper("block-seq", ""), createState("", flow), meta);
    const flat = composeFlatBlockMap([], 0, wrapper("document", ""), createState("", flow), scalar("key"), meta);
    assert.strictEqual(map.comment, "head");
    assert.strictEqual(seq.comment, "head");
    assert.strictEqual(flat.comment, "head");
    const children: CstNode[] = [{ type: "whitespace", source: ":", offset: 1, length: 1 }, { type: "comment", source: "#tail", offset: 3, length: 5 }];
    assert.strictEqual(composeFlatBlockMap(children, 0, wrapper("document", "k:\n#tail"), createState("k:\n#tail", flow), scalar("k"), meta).comment, "head\ntail");
  }));

  it.effect("anchored multiline explicit keys use the question-mark column", () => Effect.sync(() => {
    const { text, children } = tokens([["anchor", "&a "], ["whitespace", "?"], ["whitespace", " "], ["flow-scalar", "x"], ["newline", "\n"], ["whitespace", "       "], ["flow-scalar", "y"], ["newline", "\n"], ["whitespace", ":"]]);
    const items = flattenBlockMapChildren(children, createState(text, flow));
    const key = items[0];
    assert.strictEqual(key?.kind, "node");
    if (key?.kind === "node" && key.node._tag === "YamlScalar") {
      assert.strictEqual(key.node.value, "x y");
      assert.strictEqual(key.node.anchor, "a");
    }
    const nested: CstNode = { type: "block-map", source: ":v", offset: 3, length: 2, children: [{ type: "whitespace", source: ":", offset: 3, length: 1 }, { type: "flow-scalar", source: "v", offset: 4, length: 1 }] };
    const state = createState("? x:v", flow);
    flattenBlockMapChildren([{ type: "whitespace", source: "?", offset: 0, length: 1 }, { type: "flow-scalar", source: "x", offset: 2, length: 1 }, nested], state, 0, 0);
    assert.deepStrictEqual(state.errors, []);
    const anchored = tokens([["whitespace", ":"], ["anchor", "&a "], ["flow-scalar", "plain"]]);
    const anchoredItems = flattenBlockMapChildren(anchored.children, createState(anchored.text, flow));
    const value = anchoredItems[1];
    assert.strictEqual(value?.kind, "node");
    if (value?.kind === "node" && value.node._tag === "YamlScalar") assert.strictEqual(value.node.anchor, "a");
  }));

  it.effect("holes in lookahead trivia leave explicit keys and indentation diagnostics intact", () => Effect.sync(() => {
    const { text, children } = tokens([["whitespace", "?"], ["whitespace", " "], ["newline", "\n"], ["whitespace", " "], ["flow-scalar", "x"], ["newline", "\n"], ["whitespace", " "], ["whitespace", " "], ["flow-scalar", "y"], ["newline", "\n"], ["whitespace", ":"]]);
    delete children[3];
    delete children[6];
    const items = flattenBlockMapChildren(children, createState(text, flow));
    const key = items[0];
    assert.strictEqual(key?.kind, "node");
    if (key?.kind === "node" && key.node._tag === "YamlScalar") assert.strictEqual(key.node.value, "x");
    const trailing = tokens([["whitespace", "?"], ["whitespace", " "], ["newline", "\n"], ["flow-scalar", "z"]]);
    delete trailing.children[1];
    const state = createState(trailing.text, flow);
    flattenBlockMapChildren(trailing.children, state);
    assert.deepStrictEqual(state.errors, []);
    const tabs = tokens([["whitespace", ":"], ["whitespace", " "], ["whitespace", "\t"], ["flow-scalar", "a"]]);
    delete tabs.children[1];
    const tabState = createState(tabs.text, flow);
    flattenBlockMapChildren(tabs.children, tabState);
    assert.strictEqual(tabState.errors[0]?.code, "TabIndentation");
    const stray = tokens([["whitespace", ":"], ["newline", "\n"], ["comment", "#x"], ["newline", "\n"], ["whitespace", "-"]]);
    delete stray.children[2];
    const strayState = createState(stray.text, flow);
    flattenBlockMapChildren(stray.children, strayState);
    assert.strictEqual(strayState.errors[0]?.code, "InvalidIndentation");
  }));

  it.effect("multiline values reject following mappings at their own indentation", () => Effect.sync(() => {
    for (const nested of [false, true]) {
      const { text, children } = tokens([["flow-scalar", "k"], ["whitespace", ":"], ["whitespace", " "], ["flow-scalar", "a"], ["newline", "\n"], ["whitespace", "   "], ["flow-scalar", "b"], ["newline", "\n"], ["whitespace", "   "], ["flow-scalar", "c"], ["whitespace", ":"], ["flow-scalar", "d"]]);
      if (nested) {
        const tail = children.splice(10);
        children.push({ type: "block-map", source: ":d", offset: text.length - 2, length: 2, children: tail });
      }
      const state = createState(text, flow);
      flattenBlockMapChildren(children, state);
      assert.strictEqual(state.errors.some((error) => error.message === "Mapping key after multiline plain scalar value"), true);
    }
    const { text, children } = tokens([["flow-scalar", "k"], ["whitespace", ":"], ["newline", "\n"], ["flow-scalar", "a"], ["newline", "\n"], ["whitespace", " "], ["flow-scalar", "b"], ["newline", "\n"], ["block-map", ":d"]]);
    const state = createState(text, flow);
    flattenBlockMapChildren(children, state);
    assert.strictEqual(state.errors.some((error) => error.message === "Mapping key after multiline plain scalar value"), false);
  }));

  it.effect("two anchors on a mapping key are split across its containing map", () => Effect.sync(() => {
    const { text, children } = tokens([["anchor", "&outer "], ["newline", "\n"], ["anchor", "&inner "], ["flow-scalar", "k"], ["whitespace", ":"], ["flow-scalar", "v"]]);
    const state = createState(text, flow);
    const items = flattenBlockMapChildren(children, state);
    assert.strictEqual(items[0]?.kind, "node");
    assert.strictEqual(state.errors.some((error) => error.message === "Scalar cannot have two anchor declarations"), false);
  }));

  it.effect("sequence blank entry separation and terminal anchors are observable", () => Effect.sync(() => {
    const parts = tokens([["whitespace", "-"], ["flow-scalar", "a"], ["newline", "\n\n"], ["whitespace", "-"], ["flow-scalar", "b"]]);
    const seq = composeBlockSeq(wrapper("block-seq", parts.text, parts.children), createState(parts.text, flow));
    assert.deepStrictEqual(seq.toValue(), ["a", "b"]);
    assert.strictEqual(seq.items[1]?.spaceBefore, true);
    const anchor = tokens([["whitespace", "-"], ["anchor", "&a"]]);
    const state = createState(anchor.text, flow);
    const anchored = composeBlockSeq(wrapper("block-seq", anchor.text, anchor.children), state);
    assert.deepStrictEqual(anchored.toValue(), [null]);
    assert.strictEqual(O.isSome(MutableHashMap.get(state.anchors, "a")), true);
    const leading = tokens([["flow-scalar", "a"], ["whitespace", "-"], ["comment", "#one"], ["newline", "\n"], ["comment", "#two"], ["newline", "\n"], ["flow-scalar", "b"]]);
    const comments = composeBlockSeq(wrapper("block-seq", leading.text, leading.children), createState(leading.text, flow));
    assert.strictEqual(comments.items[1]?.commentBefore, "two");
  }));

  it.effect("remaining sparse scans preserve trivia and ignore non-content nodes", () => Effect.sync(() => {
    const parts = tokens([["whitespace", "?"], ["whitespace", " "], ["newline", "\n"], ["flow-scalar", "z"]]);
    delete parts.children[1];
    const state = createState(parts.text, flow);
    const result = flattenBlockMapChildren(parts.children, state);
    assert.deepStrictEqual(state.errors, []);
    assert.strictEqual(result[0]?.kind, "node");
    const tab = tokens([["whitespace", ":"], ["whitespace", " "], ["whitespace", "\t"], ["flow-scalar", "a"]]);
    delete tab.children[1];
    const tabState = createState(tab.text, flow);
    flattenBlockMapChildren(tab.children, tabState);
    assert.strictEqual(tabState.errors[0]?.code, "TabIndentation");
    const stray = tokens([["whitespace", ":"], ["newline", "\n"], ["comment", "#x"], ["newline", "\n"], ["whitespace", "-"]]);
    delete stray.children[2];
    const strayState = createState(stray.text, flow);
    flattenBlockMapChildren(stray.children, strayState);
    assert.strictEqual(strayState.errors[0]?.code, "InvalidIndentation");
    const ignored = [wrapper("directive", "%YAML")];
    assert.deepStrictEqual(flattenBlockMapChildren(ignored, createState("%YAML", flow)), []);
    assert.deepStrictEqual(composeBlockSeq(wrapper("block-seq", "%YAML", ignored), createState("%YAML", flow)).items, []);
    const trailing = createState("x #c", flow);
    checkTrailingContentOnSameLine([wrapper("comment", "#c")], 0, wrapper("flow-scalar", "x"), trailing);
    assert.deepStrictEqual(trailing.errors, []);
    const pairs = [YamlPair.make({ key: scalar("x"), value: null })];
    delete pairs[0];
    buildPairs([{ kind: "comment", comment: "c", offset: 2 }], pairs, "x #c");
    assert.strictEqual(pairs.length, 1);
    const leadingPairs: YamlPair[] = [];
    buildPairs([{ kind: "node", node: scalar("x") }, { kind: "value-sep", offset: 1 }, { kind: "comment", comment: "a", offset: 3 }, { kind: "comment", comment: "b", offset: 6 }, { kind: "node", node: scalar("v", 9) }], leadingPairs, "x:\n#a\n#b\nv");
    assert.strictEqual(leadingPairs[0]?.value?.commentBefore, "a\nb");
  }));

  it.effect("direct mapping metadata and differently indented explicit markers retain their nodes", () => Effect.sync(() => {
    const tagged = tokens([["tag", "!!map"], ["block-map", ""]]);
    const result = flattenBlockMapChildren(tagged.children, createState(tagged.text, flow));
    assert.strictEqual(result[0]?.kind, "node");
    if (result[0]?.kind === "node" && result[0].node._tag === "YamlMap") assert.strictEqual(result[0].node.tag, "!!map");
    const explicit = tokens([["whitespace", "?"], ["whitespace", " "], ["flow-scalar", "a"], ["newline", "\n"], ["whitespace", " "], ["whitespace", "?"], ["whitespace", " "], ["flow-scalar", "b"]]);
    const items = flattenBlockMapChildren(explicit.children, createState(explicit.text, flow));
    assert.deepStrictEqual(items.flatMap((item) => item.kind === "node" ? [item.node.toValue()] : []), ["a", "b"]);
    const state = createState("'a'-", flow);
    checkTrailingContentOnSameLine([{ type: "whitespace", source: "-", offset: 3, length: 1 }], 0, wrapper("flow-scalar", "'a'"), state);
    assert.strictEqual(state.errors[0]?.message, "Trailing content after value on same line");
    const comments = tokens([["whitespace", "-"], ["flow-scalar", "a"], ["newline", "\n"], ["comment", "#one"], ["newline", "\n"], ["comment", "#two"], ["newline", "\n"], ["whitespace", "-"], ["flow-scalar", "b"]]);
    const seq = composeBlockSeq(wrapper("block-seq", comments.text, comments.children), createState(comments.text, flow));
    assert.strictEqual(seq.items[1]?.commentBefore, "one\ntwo");
  }));

});
