import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { composeFlowMap, composeFlowSeq, flattenFlowChildren } from "../../../../effected/yaml/internal/composer/flow.ts";
import { createState, MAX_NESTING_DEPTH } from "../../../../effected/yaml/internal/composer/state.ts";
import type { CstNode, CstNodeType } from "../../../../effected/yaml/internal/cst.ts";
import { parseCSTAll } from "../../../../effected/yaml/internal/cst-parser.ts";

const token = (type: CstNodeType, source: string, offset = 0): CstNode => ({ type, source, offset, length: source.length });
const stateFor = (text = "") => createState(text, { composeFlowMap, composeFlowSeq });
const collection = (type: "flow-map" | "flow-seq", children?: readonly CstNode[], source = ""): CstNode =>
  children === undefined ? token(type, source) : { ...token(type, source), children };
const findFlow = (text: string): CstNode => {
  const root = parseCSTAll(text)[0];
  const flow = root?.children?.find((child) => child.type === "flow-map" || child.type === "flow-seq");
  if (flow === undefined) throw new Error(`Missing flow CST: ${text}`);
  return flow;
};

describe("flow composer recovery and metadata", () => {
  it.effect("empty and depth-limited collections preserve spans and balance depth", () => Effect.sync(() => {
    for (const compose of [composeFlowMap, composeFlowSeq]) {
      const state = stateFor();
      const cst = collection("flow-seq", undefined, "[]");
      assert.strictEqual(compose(state)(cst).items.length, 0);
      assert.strictEqual(state.depth, 0);
      state.depth = MAX_NESTING_DEPTH;
      assert.strictEqual(compose(cst, state).length, 2);
      assert.strictEqual(state.errors[0]?.code, "NestingDepthExceeded");
      assert.strictEqual(state.depth, MAX_NESTING_DEPTH);
    }
  }));

  it.effect("pending metadata stays at comma, colon, and end boundaries", () => Effect.sync(() => {
    for (const separator of [",", ":", ""]) {
      for (const anchor of ["&a", "&"]) {
        const state = stateFor();
        const children = [token("tag", "!!str"), token("anchor", anchor), ...(separator === "" ? [] : [token("whitespace", separator)])];
        const items = flattenFlowChildren(state)(children);
        const first = items[0];
        assert.strictEqual(first?.kind, "node");
        if (first?.kind === "node") {
          assert.strictEqual(first.node?.toValue(), "");
          if (first.node !== undefined && "tag" in first.node) assert.strictEqual(first.node.tag, "!!str");
        }
        assert.strictEqual(items.length, separator === ":" ? 2 : 1);
      }
    }
    const items = flattenFlowChildren([token("whitespace", "?"), token("comment", "# c"), token("whitespace", ",")], stateFor());
    assert.strictEqual(items[0]?.kind, "key");
    if (items[0]?.kind === "key") assert.strictEqual(items[0].node?.toValue(), null);
  }));

  it.effect("error tokens and illegal indicator scalars produce observable diagnostics", () => Effect.sync(() => {
    const state = stateFor("x#bad");
    flattenFlowChildren([token("error", " "), token("error", "bad")], state);
    for (const source of ["#bad", "-", "?"]) {
      const items = flattenFlowChildren([token("flow-scalar", source, 1)], state);
      assert.strictEqual(items.length, 1);
    }
    assert.deepStrictEqual(state.errors.map((error) => error.code), Array(5).fill("UnexpectedToken"));
    assert.strictEqual(state.errors[0]?.message, "Unexpected content: (empty)");
  }));

  it.effect("collection comments merge with supplied metadata and anchors", () => Effect.sync(() => {
    for (const text of ["{\n# tail\n}", "[\n# tail\n]"]) {
      const cst = findFlow(text);
      const state = stateFor(text);
      const compose = cst.type === "flow-map" ? composeFlowMap : composeFlowSeq;
      const node = compose(cst, state, { comment: "outer", anchor: "root", tag: "!custom" });
      assert.strictEqual(node.comment, "outer\n tail");
      assert.strictEqual(node.anchor, "root");
      assert.strictEqual(node.tag, "!custom");
      assert.strictEqual(compose(cst, stateFor(text), { comment: "outer", anchor: "" }).comment, "outer\n tail");
      assert.strictEqual(compose(collection(cst.type === "flow-map" ? "flow-map" : "flow-seq", []), stateFor(), { comment: "outer" }).comment, "outer");
    }
  }));
  it.effect("direct CST recovery handles absent brackets, sparse entries, and ignored node types", () => Effect.sync(() => {
    const state = stateFor();
    assert.strictEqual(composeFlowMap(collection("flow-map", [token("whitespace", "{")]), state).items.length, 0);
    assert.strictEqual(state.errors[0]?.message, "Unclosed flow mapping (missing `}`)");
    assert.strictEqual(composeFlowMap(collection("flow-map", Array<CstNode>(1)), stateFor()).items.length, 0);
    assert.deepStrictEqual(flattenFlowChildren(Array<CstNode>(1), stateFor()), []);
    assert.deepStrictEqual(flattenFlowChildren([token("directive", "%YAML 1.2")], stateFor()), []);
    const tagged = flattenFlowChildren([token("tag", "!!str"), token("flow-map", "{}", 1)], stateFor());
    assert.strictEqual(tagged[0]?.kind, "node");
    const emptyAnchor = flattenFlowChildren([token("anchor", "&" )], stateFor());
    if (emptyAnchor[0]?.kind === "node" && "anchor" in emptyAnchor[0].node) assert.strictEqual(emptyAnchor[0].node.anchor, "&");
    for (const prefix of [" ", "\t", "\n", "\r"]) {
      const local = stateFor(`${prefix}#x`);
      flattenFlowChildren([token("flow-scalar", "#x", 1)], local);
      assert.deepStrictEqual(local.errors, []);
    }
    const commas = stateFor("[,,]");
    assert.strictEqual(composeFlowSeq(collection("flow-seq", [token("whitespace", "["), token("whitespace", ","), token("whitespace", ","), token("whitespace", "]")]), commas).items.length, 0);
    assert.strictEqual(commas.errors.length, 2);
  }));

  it.effect("flow continuation indentation distinguishes closers from content", () => Effect.sync(() => {
    for (const text of ["[\n]\n]", "[\n], \t\r", "[\n\t0]", "[\n \n]"]) {
      const local = stateFor(text);
      const cst = collection("flow-seq", [], text);
      composeFlowSeq(cst, local, undefined, 0);
      assert.strictEqual(local.depth, 0);
      assert.strictEqual(local.errors.length, 0);
    }
    const text = "[\n]x";
    const local = stateFor(text);
    composeFlowSeq(collection("flow-seq", [], text), local, undefined, 0);
    assert.strictEqual(local.errors[0]?.code, "InvalidIndentation");
  }));

  it.effect("blank lines and consecutive comments retain sequence attribution", () => Effect.sync(() => {
    for (const text of ["[1,\n\n2]", "[1,\n# a\n\n2]", "[1,\n# a\n# b\n2]", "[1,\n\n# a\n2]", "[? , !!str]"]) {
      const local = stateFor(text);
      const node = composeFlowSeq(findFlow(text), local);
      assert.strictEqual(node.items.length, text === "[? , !!str]" ? 1 : 2);
      if (text === "[1,\n\n2]") assert.strictEqual(node.items[1]?.spaceBefore, true);
      if (text === "[1,\n# a\n\n2]") assert.strictEqual(node.items[1]?.commentBefore, " a\n");
      if (text === "[1,\n# a\n# b\n2]") assert.strictEqual(node.items[1]?.commentBefore, " a\n b");
    }
  }));

  it.effect("terminal comment runs join adjacent and separated lines without losing blanks", () => Effect.sync(() => {
    for (const text of ["[1,\n# a\n# b\n]", "[1,\n# a\n\n# b\n]", "[\n# a\n# b\n]"]) {
      const node = composeFlowSeq(findFlow(text), stateFor(text));
      assert.strictEqual(node.comment, text.includes("# a\n\n") ? " a\n\n b" : " a\n b");
    }
    const node = composeFlowSeq(collection("flow-seq", [token("comment", "#x", -1)]), stateFor());
    assert.strictEqual(node.comment, "x");
    const state = stateFor("&");
    const items = flattenFlowChildren([token("anchor", "&")], state);
    if (items[0]?.kind === "node" && "anchor" in items[0].node) assert.strictEqual(items[0].node.anchor, "");
  }));

  it.effect("anchors register scalar keys and values and metadata reaches quoted scalars", () => Effect.sync(() => {
    for (const text of ["{&key name: value}", "[&value value]", "[!!str 'value']", "[? key: value]"]) {
      const cst = findFlow(text);
      const state = stateFor(text);
      const node = cst.type === "flow-map" ? composeFlowMap(cst, state) : composeFlowSeq(cst, state);
      assert.strictEqual(node.items.length, 1);
      assert.deepStrictEqual(state.errors, []);
      if (text === "[&value value]") { const first = node.items[0]; if (first !== undefined && "anchor" in first) assert.strictEqual(first.anchor, "value"); }
    }
    for (const separator of [",", ":"]) {
      const item = flattenFlowChildren([token("tag", "!!str"), token("whitespace", separator)], stateFor())[0];
      if (item?.kind === "node") assert.strictEqual(item.node.toValue(), "");
    }
    const state = createState("{a: 1, a: 2}", { composeFlowMap, composeFlowSeq }, { uniqueKeys: false });
    assert.strictEqual(composeFlowMap(findFlow(state.text), state).items.length, 2);
    assert.deepStrictEqual(state.errors, []);
    const unclosed = stateFor("[");
    composeFlowSeq(collection("flow-seq", [token("whitespace", "[")]), unclosed);
    assert.strictEqual(unclosed.errors[0]?.message, "Unclosed flow sequence (missing `]`)");
    const text = "[1,\n\n# a\n\n2]";
    const node = composeFlowSeq(findFlow(text), stateFor(text));
    assert.strictEqual(node.items[1]?.spaceBefore, true);
    assert.strictEqual(node.items[1]?.commentBefore, " a\n");
  }));

  it.effect("a blank before the first entry is not a between-items blank", () => Effect.sync(() => {
    const text = "[\n\n1]";
    const node = composeFlowSeq(findFlow(text), stateFor(text));
    assert.strictEqual(node.items[0]?.spaceBefore, undefined);
    assert.deepStrictEqual(node.toValue(), [1]);
  }));

});
