import * as IdentifierText from "@beep/nlp/IdentifierText";
import * as PathText from "@beep/nlp/PathText";
import * as QueryText from "@beep/nlp/QueryText";
import * as VariantText from "@beep/nlp/VariantText";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as O from "effect/Option";

describe("@beep/nlp deterministic helpers", () => {
  it("normalizes question and phrase text deterministically", () => {
    expect(QueryText.normalizeQuestion("  describe   `answer`  ")).toBe("describe `answer`");
    expect(QueryText.normalizePhrase(' " src / index.ts ? ')).toBe("src/index.ts");
    expect(O.getOrThrow(QueryText.extractBacktickValue("describe `knowledgeGraphAnswerHelper`"))).toBe(
      "knowledgeGraphAnswerHelper"
    );
  });

  it("returns none for missing or empty backtick captures", () => {
    assertNone(QueryText.extractBacktickValue("describe knowledgeGraphAnswerHelper"));
    assertNone(QueryText.extractBacktickValue("describe ``"));
  });

  it("generates identifier variants for spaced and camelCase phrases", () => {
    const spaced = IdentifierText.variants("knowledge graph answer helper");
    const camel = IdentifierText.variants("knowledgeGraphAnswerHelper");

    expect(spaced).toContain("knowledgeGraphAnswerHelper");
    expect(spaced).toContain("knowledge_graph_answer_helper");
    expect(spaced).toContain("knowledge-graph-answer-helper");
    expect(spaced).toContain("knowledgegraphanswerhelper");
    expect(camel).toContain("knowledge graph answer helper");
    expect(camel).toContain("knowledgeGraphAnswerHelper");
  });

  it("tokenizes mixed identifier styles and drops punctuation-only inputs", () => {
    expect(IdentifierText.tokens("KnowledgeGraph-answer_helper")).toEqual(["knowledge", "graph", "answer", "helper"]);
    expect(IdentifierText.variants("...")).toEqual([]);
  });

  it("generates path and module variants with basename and extensionless forms", () => {
    expect(PathText.filePathVariants("./src/index.ts")).toEqual([
      "./src/index.ts",
      "src/index.ts",
      "src/index",
      "index.ts",
      "index",
    ]);
    expect(PathText.moduleSpecifierVariants("./util.ts")).toEqual(["./util.ts", "util.ts", "util"]);
    expect(PathText.isPathLike("src/index")).toBe(true);
    expect(PathText.isPathLike("repo memory helper")).toBe(false);
  });

  it("normalizes windows-style path phrases and preserves bounded single-fragment modules", () => {
    expect(PathText.normalizePathPhrase(" .\\\\src\\\\index.ts ")).toBe("./src/index.ts");
    expect(PathText.filePathVariants(" .\\\\src\\\\index.ts ")).toEqual([
      "./src/index.ts",
      "src/index.ts",
      "src/index",
      "index.ts",
      "index",
    ]);
    expect(PathText.moduleSpecifierVariants("util")).toEqual(["util"]);
  });

  it("deduplicates variants while preserving the first occurrence", () => {
    expect(VariantText.orderedDedupe(["answer", "", "answer", "greet", "greet"])).toEqual(["answer", "greet"]);
  });
});
