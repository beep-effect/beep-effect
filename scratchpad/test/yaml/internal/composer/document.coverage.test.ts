import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { composeDocument, composeFirstDocument, composeAllDocuments, validateCrossDocumentDirectives } from "../../../../effected/yaml/internal/composer/document.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import type { CstNode, CstNodeType } from "../../../../effected/yaml/internal/cst.ts";
import { YamlMap, YamlScalar, YamlSeq } from "../../../../effected/yaml/YamlNode.ts";

const node = (type: CstNodeType, source: string, offset = 0, children?: readonly CstNode[]): CstNode => ({ type, source, offset, length: source.length, ...(children === undefined ? {} : { children }) });
const compose = (text: string, children?: readonly CstNode[], subsequent = false, next?: CstNode) => composeDocument(node("document", text, 0, children), createState(text, { composeFlowMap, composeFlowSeq }), subsequent, next);
const messages = (document: ReturnType<typeof compose>) => document.errors.map((error) => error.message);

describe("document composition coverage", () => {
  it.effect("recovers an absent child list and malformed directive tokens", () => Effect.sync(() => {
    expect(compose("").contents).toBeNull();
    expect(compose("?", [node("error", "?")]).contents).toBeNull();
    expect(compose("%", [node("directive", "%")]).directives).toEqual([]);
    expect(messages(compose("%YAML", [node("directive", "%YAML")]))).toContain("%YAML directive requires a version parameter");
  }));

  it.effect("rejects content after an end marker in the same and following CST document", () => Effect.sync(() => {
    const marker = node("whitespace", "...", 0);
    for (const offset of [4, 5]) {
      const text = offset === 4 ? "... x" : "...\n x";
      const document = compose(text, [marker, node("whitespace", " ", 3), node("flow-scalar", "x", offset)]);
      expect(messages(document).includes("Content on same line as document-end marker")).toBe(offset === 4);
    }
    for (const children of [[node("newline", "\n", 3)], [node("whitespace", " ", 3), node("flow-scalar", "x", 4)]]) {
      const document = compose("... x", [marker], false, node("document", " x", 3, children));
      expect(messages(document).includes("Content on same line as document-end marker")).toBe(children.length === 2);
    }
  }));

  it.effect("preserves blank lines within leading and trailing comment blocks", () => Effect.sync(() => {
    const document = composeFirstDocument("---\n# first\n\n# second\nvalue\n# tail\n\n# end\n");
    expect(document.contents?.commentBefore).toBe(" first\n\n second");
    expect(document.comment).toBe(" tail\n\n end");
  }));

  it.effect("assigns outer and inner metadata on flat mapping keys", () => Effect.sync(() => {
    for (const keyMeta of [[], [node("anchor", "&key", 10)]]) {
      const document = compose("&outer\n   &key k: v", [node("anchor", "&outer"), node("newline", "\n", 6), ...keyMeta, node("tag", "!!str", 15), node("flow-scalar", "k", 15), node("whitespace", ":", 16), node("flow-scalar", "v", 18)]);
      expect(S.is(YamlMap)(document.contents)).toBe(true);
      if (S.is(YamlMap)(document.contents)) expect(document.contents.anchor).toBe("outer");
    }
    for (const prefix of [[node("anchor", "&key")], [node("whitespace", "---"), node("anchor", "&map", 4)]]) {
      const document = compose("--- &map k: v", [...prefix, node("flow-scalar", "k", 9), node("whitespace", ":", 10), node("flow-scalar", "v", 12)]);
      expect(S.is(YamlMap)(document.contents)).toBe(true);
    }
  }));

  it.effect("composes flow collection keys with outer metadata and optional inner metadata", () => Effect.sync(() => {
    for (const type of ["flow-map", "flow-seq"] as const) {
      for (const inner of [[], [node("anchor", "&key", 8)]]) {
        const source = type === "flow-map" ? "{}" : "[]";
        const document = compose(`&outer\n &key ${source}: v`, [node("anchor", "&outer"), node("newline", "\n", 6), ...inner, node(type, source, 13, []), node("whitespace", " ", 15), node("block-map", ": v", 15, [node("whitespace", ":", 15), node("flow-scalar", "v", 17)])]);
        expect(S.is(YamlMap)(document.contents)).toBe(true);
        if (S.is(YamlMap)(document.contents)) {
          expect(document.contents.items).toHaveLength(1);
          const key = document.contents.items[0]?.key;
          if (inner.length === 0) {
            expect(S.is(YamlMap)(key) || S.is(YamlSeq)(key)).toBe(true);
            if (S.is(YamlMap)(key) || S.is(YamlSeq)(key)) expect(key.anchor).toBe("outer");
          } else expect(document.contents.anchor).toBe("outer");
        }
      }
    }
    const tagged = composeFirstDocument("!!map &root {}\n");
    expect(S.is(YamlMap)(tagged.contents)).toBe(true);
    if (S.is(YamlMap)(tagged.contents)) expect(tagged.contents.anchor).toBe("root");
  }));

  it.effect("handles block sequence siblings, mapping-like trailing nodes and aliases", () => Effect.sync(() => {
    const sequence = compose("x\n- y", [node("flow-scalar", '"x"'), node("block-seq", "- y", 2, [node("flow-scalar", "y", 4)])]);
    expect(S.is(YamlSeq)(sequence.contents)).toBe(true);
    for (const next of [node("whitespace", ":", 3), node("flow-scalar", "k", 3)]) {
      const rest = next.type === "flow-scalar" ? [next, node("whitespace", ":", 4), node("flow-scalar", "v", 6)] : [next];
      expect(messages(compose("[] k: v", [node("flow-seq", "[]", 0, []), ...rest]))).not.toContain("Trailing content after document value");
    }
    expect(messages(compose("[] k: v", [node("flow-seq", "[]", 0, []), node("flow-scalar", "k", 3), node("block-map", ": v", 4, [])]))).not.toContain("Trailing content after document value");
    expect(composeFirstDocument("&a *missing").errors.length).toBeGreaterThan(0);
  }));

  it.effect("reports directives after an unterminated preceding document", () => Effect.sync(() => {
    for (const previous of [node("document", "x"), node("document", "x # c", 0, [node("flow-scalar", "x"), node("comment", "# c", 2)])]) {
      const state = createState("x\n%YAML 1.2", { composeFlowMap, composeFlowSeq });
      validateCrossDocumentDirectives(state)([previous, node("document", "%YAML 1.2", 2, [node("comment", "# c"), node("directive", "%YAML 1.2", 2)])]);
      expect(state.errors.map((error) => error.message)).toContain("Directive between documents requires a document-end marker (...) after the previous document");
    }
    const state = createState("", { composeFlowMap, composeFlowSeq });
    validateCrossDocumentDirectives([node("document", ""), node("document", "")], state);
    expect(state.errors).toEqual([]);
    expect(composeAllDocuments()("---\n1\n---\n2").documents).toHaveLength(2);
  }));

  it.effect("keeps a multiline scalar followed by a non-mapping collection recoverable", () => Effect.sync(() => {
    const document = compose("a\nb\n[]", [node("flow-scalar", "a"), node("newline", "\n", 1), node("flow-scalar", "b", 2), node("newline", "\n", 3), node("flow-seq", "[]", 4, [])]);
    expect(messages(document)).not.toContain("Trailing content after document value");
    expect(S.is(YamlSeq)(document.contents)).toBe(true);
    expect(S.is(YamlScalar)(composeFirstDocument()("hello").contents)).toBe(true);
  }));
});
