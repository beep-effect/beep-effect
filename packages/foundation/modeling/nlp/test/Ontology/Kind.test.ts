import * as Kind from "@beep/nlp/Ontology/Kind";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeKindKindContainment = S.decodeEffect(Kind.KindContainment);
const encodeKindKindContainment = S.encodeEffect(Kind.KindContainment);

const allKinds: ReadonlyArray<Kind.TextKind> = [
  "Document",
  "Paragraph",
  "Sentence",
  "Token",
  "Character",
  "POS",
  "Lemma",
  "Entity",
  "Relation",
  "Dependency",
  "Chunk",
  "Embedding",
];

const kindArbitrary = Arbitrary.schema(S.Literals([...allKinds]));
const KindContainmentArbitrary = Arbitrary.schema(Kind.KindContainment);

describe("TextKind schema", () => {
  it("accepts every declared kind", () => {
    for (const kind of allKinds) {
      expect(Kind.TextKind.is[kind](kind)).toBe(true);
    }
  });
});

describe("Containment poset", () => {
  it.prop(
    "canContain agrees with getValidChildren",
    [kindArbitrary, kindArbitrary],
    ([parent, child]) => {
      const valid = Kind.getValidChildren(parent);
      return Kind.canContain(parent, child) === valid.includes(child);
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop("is irreflexive (no kind contains itself)", [kindArbitrary], ([k]) => !Kind.canContain(k, k), {
    arbitrary: fcRuns(100),
  });

  it("leaf kinds contain nothing", () => {
    for (const leaf of ["Character", "POS", "Lemma", "Entity", "Relation", "Dependency", "Embedding"] as const) {
      expect(Kind.getValidChildren(leaf)).toHaveLength(0);
    }
  });

  it("Document contains Sentence; Token contains Character", () => {
    expect(Kind.canContain("Document", "Sentence")).toBe(true);
    expect(Kind.canContain("Token", "Character")).toBe(true);
    expect(Kind.canContain("Token", "Document")).toBe(false);
  });

  it("derives the runtime containment record from schema defaults", () => {
    expect(Kind.KindContainment.containment).toEqual(Kind.KindContainment.make({}));
  });

  it.prop(
    "round-trips schema-derived containment records",
    [KindContainmentArbitrary],
    ([containment]) => {
      const encoded = Effect.runSync(encodeKindKindContainment(containment));
      const decoded = Effect.runSync(decodeKindKindContainment(encoded));

      expect(decoded).toEqual(Kind.KindContainment.make({ ...containment }));

      return true;
    },
    { arbitrary: fcRuns(100) }
  );
});

describe("Smart constructors & utilities", () => {
  it("constructors tag content with the right kind", () => {
    expect(Kind.Document("d").kind).toBe("Document");
    expect(Kind.Sentence("s").kind).toBe("Sentence");
    expect(Kind.Token("t").kind).toBe("Token");
    expect(Kind.Entity("e", { type: "ORG" }).metadata).toEqual({ type: "ORG" });
  });

  it.prop(
    "kindOf and content are inverse projections",
    [Arbitrary.schema(S.String)],
    ([s]) => {
      const doc = Kind.Document(s);
      return Kind.kindOf(doc) === "Document" && Kind.content(doc) === s;
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "mapContent preserves kind",
    [Arbitrary.schema(S.String)],
    ([s]) => {
      const mapped = Kind.mapContent(Kind.Token(s), (x) => `${x}!`);
      return mapped.kind === "Token" && mapped.content === `${s}!`;
    },
    { arbitrary: fcRuns(100) }
  );

  it("withMetadata merges metadata", () => {
    const e = Kind.withMetadata(Kind.Entity("Acme", { a: 1 }), { b: 2 });
    expect(e.metadata).toEqual({ a: 1, b: 2 });
  });

  it("isKind narrows by kind", () => {
    expect(Kind.isKind("Token")(Kind.Token("w"))).toBe(true);
    expect(Kind.isKind("Sentence")(Kind.Token("w"))).toBe(false);
  });

  it("recast re-tags the kind", () => {
    expect(Kind.recast(Kind.Token("run"), "Lemma").kind).toBe("Lemma");
  });
});
