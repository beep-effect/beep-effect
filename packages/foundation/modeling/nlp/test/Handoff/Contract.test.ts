/**
 * Proofs for the generic IR handoff contract: encode/decode round-trips for the
 * AnnotatedDocument envelope, span validity, provenance completeness, and the
 * pure makeProvenance constructor.
 */

import { Contract } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const AnnotatedDocumentArbitrary = S.toArbitrary(Contract.AnnotatedDocument);

const sampleProvenance = Contract.Provenance.make({
  generatedBy: "wink-nlp",
  source: "doc-1",
  timestamp: 1_000,
});

const sampleDocument = Contract.AnnotatedDocument.make({
  chunks: [
    Contract.TextChunk.make({
      id: Contract.ChunkId.make("chunk-1"),
      kind: "sentence",
      provenance: sampleProvenance,
      span: Contract.Span.make({ end: NonNegativeInt.make(11), start: NonNegativeInt.make(0) }),
      text: "Hello world",
    }),
  ],
  entities: [
    Contract.Entity.make({
      canonicalName: "World",
      id: Contract.EntityId.make("entity-1"),
      mentions: [Contract.MentionId.make("mention-1")],
      provenance: sampleProvenance,
      type: "PLACE",
    }),
  ],
  provenance: sampleProvenance,
  relations: [
    Contract.Relation.make({
      id: Contract.RelationId.make("relation-1"),
      object: Contract.EntityId.make("entity-2"),
      provenance: sampleProvenance,
      subject: Contract.EntityId.make("entity-1"),
      type: "MENTIONS",
    }),
  ],
  version: "nlp-ir/1.0",
});

describe("AnnotatedDocument round-trip", () => {
  it.effect(
    "encode then decode preserves the document",
    Effect.fnUntraced(function* () {
      const encoded = yield* S.encodeUnknownEffect(Contract.AnnotatedDocument)(sampleDocument);
      const decoded = yield* S.decodeUnknownEffect(Contract.AnnotatedDocument)(encoded);
      expect(decoded.version).toBe("nlp-ir/1.0");
      expect(decoded.chunks.length).toBe(1);
      expect(decoded.entities.length).toBe(1);
      expect(decoded.relations.length).toBe(1);
      expect(decoded.chunks[0]?.text).toBe("Hello world");
    })
  );

  it.effect(
    "every chunk, entity, and relation carries provenance",
    Effect.fnUntraced(function* () {
      const encoded = yield* S.encodeUnknownEffect(Contract.AnnotatedDocument)(sampleDocument);
      const decoded = yield* S.decodeUnknownEffect(Contract.AnnotatedDocument)(encoded);
      expect(decoded.chunks.every((c) => typeof c.provenance.source === "string")).toBe(true);
      expect(decoded.entities.every((e) => typeof e.provenance.generatedBy === "string")).toBe(true);
      expect(decoded.relations.every((r) => typeof r.provenance.timestamp === "number")).toBe(true);
    })
  );

  it("schema-derived documents encode and decode through the production contract", () => {
    fc.assert(
      fc.property(AnnotatedDocumentArbitrary, (document) => {
        const decoded = Effect.runSync(
          Effect.gen(function* () {
            const encoded = yield* S.encodeUnknownEffect(Contract.AnnotatedDocument)(document);
            return yield* S.decodeUnknownEffect(Contract.AnnotatedDocument)(encoded);
          })
        );

        expect(decoded).toEqual(document);
      }),
      fcRuns(25)
    );
  });
});

describe("Span", () => {
  it("round-trips integer spans with start <= end", () => {
    fc.assert(
      fc.property(fc.nat(1000), fc.nat(1000), (a, b) => {
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        const span = Contract.Span.make({ end: NonNegativeInt.make(end), start: NonNegativeInt.make(start) });
        return span.start <= span.end && span.start === start && span.end === end;
      })
    );
  });

  it("rejects negative offsets", () => {
    expect(() => S.decodeUnknownSync(Contract.Span)({ end: 1, start: -1 })).toThrow();
    expect(() => S.decodeUnknownSync(Contract.Span)({ end: -1, start: 0 })).toThrow();
  });

  it("rejects spans whose end precedes start", () => {
    expect(() => Contract.Span.make({ end: NonNegativeInt.make(4), start: NonNegativeInt.make(5) })).toThrow();
  });
});

describe("Provenance confidence", () => {
  it.effect(
    "decodes confidence values in the unit interval",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(Contract.Provenance)({
        confidence: 1,
        generatedBy: "langextract",
        source: "doc-1",
        timestamp: 1_000,
      });
      expect(decoded.confidence).toBe(1);
    })
  );

  it.effect(
    "rejects confidence values outside the unit interval",
    Effect.fnUntraced(function* () {
      const low = yield* Effect.exit(
        S.decodeUnknownEffect(Contract.Provenance)({
          confidence: -0.01,
          generatedBy: "langextract",
          source: "doc-1",
          timestamp: 1_000,
        })
      );
      const high = yield* Effect.exit(
        S.decodeUnknownEffect(Contract.Provenance)({
          confidence: 1.01,
          generatedBy: "langextract",
          source: "doc-1",
          timestamp: 1_000,
        })
      );

      expect(Exit.isFailure(low)).toBe(true);
      expect(Exit.isFailure(high)).toBe(true);
    })
  );
});

describe("makeProvenance", () => {
  it("uses an explicit timestamp and omits absent confidence", () => {
    const prov = Contract.makeProvenance("doc-9", "wink-nlp", 1_234);
    expect(prov.source).toBe("doc-9");
    expect(prov.generatedBy).toBe("wink-nlp");
    expect(prov.timestamp).toBe(1_234);
    expect(prov.confidence).toBeUndefined();
  });

  it("carries confidence when provided", () => {
    const prov = Contract.makeProvenance("doc-9", "wink-nlp", 1_234, 0.9);
    expect(prov.confidence).toBe(0.9);
  });

  it("supports data-last construction", () => {
    const prov = Contract.makeProvenance("wink-nlp", 1_234, 0.9)("doc-9");
    expect(prov.source).toBe("doc-9");
    expect(prov.confidence).toBe(0.9);
  });
});
