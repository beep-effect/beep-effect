import { Block, Document, Inline } from "@beep/md/Md.model";
import * as PatternOntology from "@beep/schema/PatternOntology";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";

const { collectPoTaggedConstructors, getPoPattern } = PatternOntology;

const patternOf = (tag: string, rows: ReadonlyArray<PatternOntology.PoTaggedConstructor>) =>
  A.findFirst(rows, (row) => row.tag === tag).pipe(
    O.flatMap((row) => row.pattern),
    O.getOrNull
  );

describe("@beep/md Pattern Ontology classification", () => {
  const rows = collectPoTaggedConstructors(Document, "_tag");

  it("stamps exactly one valid PO pattern on every tagged constructor reachable from Document", () => {
    const unannotated = A.getSomes(A.map(rows, (row) => (O.isNone(row.pattern) ? O.some(row.tag) : O.none())));

    expect(unannotated).toEqual([]);
    expect(A.length(A.dedupe(A.map(rows, (row) => row.tag)))).toBe(A.length(rows));
    expect(A.length(rows)).toBe(31);
  });

  it("classifies every Inline and Block union member", () => {
    const inlinePatterns = R.map(Inline.cases, (member) => O.getOrNull(getPoPattern(member)));
    const blockPatterns = R.map(Block.cases, (member) => O.getOrNull(getPoPattern(member)));

    expect(inlinePatterns).toEqual({
      text: "atom",
      rawMarkdown: "atom",
      rawHtml: "atom",
      strong: "inline",
      em: "inline",
      del: "inline",
      code: "atom",
      a: "inline",
      img: "milestone",
      br: "milestone",
      inlineMath: "atom",
      footnoteReference: "milestone",
    });
    expect(blockPatterns).toEqual({
      heading: "block",
      p: "block",
      blockquote: "container",
      pre: "field",
      ul: "table",
      ol: "table",
      taskList: "table",
      table: "table",
      youtube: "meta",
      mathBlock: "field",
      footnoteDefinition: "container",
      admonition: "container",
      embed: "meta",
      hr: "meta",
    });
  });

  it("classifies the constructors reachable only through fields", () => {
    expect(patternOf("document", rows)).toBe("container");
    expect(patternOf("li", rows)).toBe("container");
    expect(patternOf("taskItem", rows)).toBe("container");
    expect(patternOf("tableRow", rows)).toBe("table");
    expect(patternOf("tableCell", rows)).toBe("block");
  });

  it("keeps inline members in the text flow and block members inside containers", () => {
    const inlineContainment = A.dedupe(
      A.getSomes(
        A.map(R.toEntries(Inline.cases), ([, member]) =>
          O.map(getPoPattern(member), (pattern) => PatternOntology.poPatternAxes(pattern).containedIn)
        )
      )
    );
    const blockContainment = A.dedupe(
      A.getSomes(
        A.map(R.toEntries(Block.cases), ([, member]) =>
          O.map(getPoPattern(member), (pattern) => PatternOntology.poPatternAxes(pattern).containedIn)
        )
      )
    );

    expect(inlineContainment).toEqual(["flow"]);
    expect(blockContainment).toEqual(["container"]);
  });
});
