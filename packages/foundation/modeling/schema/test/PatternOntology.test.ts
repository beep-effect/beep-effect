import * as PatternOntology from "@beep/schema/PatternOntology";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const { PoPattern, collectPoTaggedConstructors, getPoPattern, poConservation, poPatternAxes } = PatternOntology;

class Leaf extends S.TaggedClass<Leaf>("Leaf")("leaf", { value: S.String }, { po: "atom" }) {}
class Bare extends S.TaggedClass<Bare>("Bare")("bare", {}) {}
const Row = S.TaggedStruct("row", { cells: S.Array(Leaf) }).annotate({ po: "table" });
const Tree = S.Union([Leaf, Bare, Row]).pipe(S.toTaggedUnion("_tag"));

describe("@beep/schema PatternOntology", () => {
  it("derives the PO axes from every pattern literal", () => {
    const axes = A.map(PoPattern.literals, poPatternAxes);
    const flow = A.filter(axes, ({ containedIn }) => containedIn === "flow");
    const textual = A.filter(axes, ({ textual }) => textual);
    const structured = A.filter(axes, ({ structured }) => structured);

    expect(A.length(axes)).toBe(11);
    expect(A.length(flow)).toBe(4);
    expect(A.length(textual)).toBe(4);
    expect(A.length(structured)).toBe(7);
    expect(poPatternAxes("record")).toEqual(poPatternAxes("container"));
  });

  it("reads a stamped pattern from a class declaration", () => {
    expect(O.getOrNull(getPoPattern(Leaf))).toBe("atom");
    assertNone(getPoPattern(Bare));
    assertNone(getPoPattern(S.String.annotate({ po: "not-a-pattern" as never })));
  });

  it("collects every reachable tagged constructor once and surfaces missing patterns", () => {
    const rows = collectPoTaggedConstructors(S.Array(Tree), "_tag");

    expect(A.map(rows, (row) => row.tag)).toEqual(["leaf", "bare", "row"]);
    expect(A.map(rows, (row) => O.getOrNull(row.pattern))).toEqual(["atom", null, "table"]);
    expect(A.map(rows, (row) => O.getOrNull(row.identifier))).toEqual(["Leaf", "Bare", null]);
  });

  it("deduplicates type projections while retaining conflicting pattern annotations", () => {
    const projected = S.toType(Leaf);
    const conflicting = Leaf.annotate({ po: "block" });
    const rows = collectPoTaggedConstructors(S.Union([Leaf, projected, conflicting]), "_tag");

    expect(A.map(rows, (row) => [row.tag, O.getOrNull(row.pattern)])).toEqual([
      ["leaf", "atom"],
      ["leaf", "block"],
    ]);
  });

  it("classifies conservation by pattern identity", () => {
    expect(poConservation("block", "block")).toBe("preserved");
    expect(poConservation("container", "block")).toBe("demoted");
    expect(poConservation("field", "block")).toBe("demoted");
  });
});
