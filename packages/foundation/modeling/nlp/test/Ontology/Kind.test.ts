/**
 * Property-based tests ("proofs") for the Ontology/Kind containment poset and
 * the typed-text smart constructors.
 *
 * Effect v4 coverage for Kind design (no dedicated v3 test existed);
 * uses Effect v4's `effect/testing/FastCheck`.
 */

import * as Kind from "@beep/nlp/Ontology/Kind";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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

const kindArbitrary = fc.constantFrom(...allKinds);
const KindContainmentArbitrary = S.toArbitrary(Kind.KindContainment)(fc);

describe("TextKind schema", () => {
  it("accepts every declared kind", () => {
    for (const kind of allKinds) {
      expect(Kind.TextKind.is[kind](kind)).toBe(true);
    }
  });
});

describe("Containment poset", () => {
  it("canContain agrees with getValidChildren", () => {
    fc.assert(
      fc.property(kindArbitrary, kindArbitrary, (parent, child) => {
        const valid = Kind.getValidChildren(parent);
        return Kind.canContain(parent, child) === valid.includes(child);
      })
    );
  });

  it("is irreflexive (no kind contains itself)", () => {
    fc.assert(fc.property(kindArbitrary, (k) => !Kind.canContain(k, k)));
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

  it("round-trips schema-derived containment records", () => {
    fc.assert(
      fc.property(KindContainmentArbitrary, (containment) => {
        const encoded = Effect.runSync(S.encodeEffect(Kind.KindContainment)(containment));
        const decoded = Effect.runSync(S.decodeEffect(Kind.KindContainment)(encoded));

        expect(decoded).toEqual(containment);
      })
    );
  });
});

describe("Smart constructors & utilities", () => {
  it("constructors tag content with the right kind", () => {
    expect(Kind.Document("d").kind).toBe("Document");
    expect(Kind.Sentence("s").kind).toBe("Sentence");
    expect(Kind.Token("t").kind).toBe("Token");
    expect(Kind.Entity("e", { type: "ORG" }).metadata).toEqual({ type: "ORG" });
  });

  it("kindOf and content are inverse projections", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const doc = Kind.Document(s);
        return Kind.kindOf(doc) === "Document" && Kind.content(doc) === s;
      })
    );
  });

  it("mapContent preserves kind", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const mapped = Kind.mapContent(Kind.Token(s), (x) => `${x}!`);
        return mapped.kind === "Token" && mapped.content === `${s}!`;
      })
    );
  });

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
