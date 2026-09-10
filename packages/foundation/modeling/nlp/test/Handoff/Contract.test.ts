import { Contract } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeContractAnnotatedDocument = S.decodeEffect(Contract.AnnotatedDocument);
const decodeContractProvenance = S.decodeEffect(Contract.Provenance);
const decodeContractSpanSync = S.decodeSync(Contract.Span);
const encodeUnknownContractAnnotatedDocument = S.encodeUnknownEffect(Contract.AnnotatedDocument);

const AnnotatedDocumentArbitrary = Arbitrary.schema(Contract.AnnotatedDocument);

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
  mentions: [
    Contract.Mention.make({
      chunkId: Contract.ChunkId.make("chunk-1"),
      id: Contract.MentionId.make("mention-1"),
      provenance: sampleProvenance,
      span: Contract.Span.make({ end: NonNegativeInt.make(11), start: NonNegativeInt.make(6) }),
      text: "world",
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
  version: "nlp-ir/1.1",
});

describe("AnnotatedDocument round-trip", () => {
  it.effect(
    "encode then decode preserves the document",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeUnknownContractAnnotatedDocument(sampleDocument);
      const decoded = yield* decodeContractAnnotatedDocument(encoded);
      expect(decoded.version).toBe("nlp-ir/1.1");
      expect(decoded.chunks.length).toBe(1);
      expect(decoded.entities.length).toBe(1);
      expect(decoded.mentions.length).toBe(1);
      expect(decoded.relations.length).toBe(1);
      expect(decoded.chunks[0]?.text).toBe("Hello world");
    })
  );

  it.effect(
    "mentions resolve to their entity and chunk with the span cut from the chunk text",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeUnknownContractAnnotatedDocument(sampleDocument);
      const decoded = yield* decodeContractAnnotatedDocument(encoded);
      const mention = A.head(decoded.mentions);
      const entity = A.head(decoded.entities);
      const chunk = A.head(decoded.chunks);
      expect(O.map(mention, (m) => m.id)).toEqual(O.flatMap(entity, (e) => A.head(e.mentions)));
      expect(O.map(mention, (m) => m.chunkId)).toEqual(O.map(chunk, (c) => c.id));
      expect(O.map(mention, (m) => m.text)).toEqual(
        O.zipWith(mention, chunk, (m, c) => Str.slice(m.span.start, m.span.end)(c.text))
      );
    })
  );

  it.effect(
    "every chunk, mention, entity, and relation carries provenance",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeUnknownContractAnnotatedDocument(sampleDocument);
      const decoded = yield* decodeContractAnnotatedDocument(encoded);
      expect(decoded.chunks.every((c) => typeof c.provenance.source === "string")).toBe(true);
      expect(decoded.mentions.every((m) => typeof m.provenance.source === "string")).toBe(true);
      expect(decoded.entities.every((e) => typeof e.provenance.generatedBy === "string")).toBe(true);
      expect(decoded.relations.every((r) => typeof r.provenance.timestamp === "number")).toBe(true);
    })
  );

  it("schema-derived documents encode and decode through the production contract", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([AnnotatedDocumentArbitrary]),
          ([document]) => {
            const decoded = Effect.runSync(
              Effect.gen(function* () {
                const encoded = yield* encodeUnknownContractAnnotatedDocument(document);
                return yield* decodeContractAnnotatedDocument(encoded);
              })
            );

            expect(decoded).toEqual(document);

            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });
});

describe("Span", () => {
  it("round-trips integer spans with start <= end", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1000))),
            Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1000))),
          ]),
          ([a, b]) => {
            const start = Math.min(a, b);
            const end = Math.max(a, b);
            const span = Contract.Span.make({ end: NonNegativeInt.make(end), start: NonNegativeInt.make(start) });
            return span.start <= span.end && span.start === start && span.end === end;
          }
        )
      )._tag
    ).toBe("Passed");
  });

  it("rejects negative offsets", () => {
    expect(() => decodeContractSpanSync({ end: 1, start: -1 })).toThrow();
    expect(() => decodeContractSpanSync({ end: -1, start: 0 })).toThrow();
  });

  it("rejects spans whose end precedes start", () => {
    expect(() => Contract.Span.make({ end: NonNegativeInt.make(4), start: NonNegativeInt.make(5) })).toThrow();
  });
});

describe("Provenance confidence", () => {
  it.effect(
    "decodes confidence values in the unit interval",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeContractProvenance({
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
        decodeContractProvenance({
          confidence: -0.01,
          generatedBy: "langextract",
          source: "doc-1",
          timestamp: 1_000,
        })
      );
      const high = yield* Effect.exit(
        decodeContractProvenance({
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

// The arbitrary compiler consumes decode only; verify the advertised encoding separately.
it.effect("encodes Contract.Span through its generation link", () =>
  Effect.gen(function* () {
    const annotations: S.Annotations.Declaration<unknown, []> | undefined = SchemaAST.toType(
      Contract.Span.ast
    ).annotations;
    const link = annotations?.toCodecArbitrary?.({ typeParameters: [], constraint: undefined });
    if (link === undefined || link.transformation._tag !== "Transformation")
      throw new Error("Missing generation transformation");
    const codec = S.make<S.Codec<Contract.Span, unknown>>(
      SchemaAST.decodeTo(link.to, SchemaAST.toType(Contract.Span.ast), link.transformation)
    );
    const value = Contract.Span.make({ start: NonNegativeInt.make(1), end: NonNegativeInt.make(4) });
    expect(yield* S.encodeEffect(codec)(value)).toEqual(value);
  })
);
