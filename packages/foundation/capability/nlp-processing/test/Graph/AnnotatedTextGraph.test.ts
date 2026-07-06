/**
 * Proofs for the AnnotatedTextGraph: annotated construction over a stub
 * NLPBackend, the idempotence of each annotation pass, the node-kind type
 * guards, and the count/filter queries.
 *
 * Effect v4 + `@effect/vitest` coverage for AnnotatedTextGraph. A deterministic
 * stub backend stands in for wink so the proofs assert structure, not
 * linguistic accuracy.
 */

import { EntityNode, LemmaNode, POSNode } from "@beep/nlp/Graph/Schema";
import { NLPBackend } from "@beep/nlp-processing/Backend/NLPBackend";
import * as ATG from "@beep/nlp-processing/Graph/AnnotatedTextGraph";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expect(equals(decode(encode(value)), value)).toBe(true);
    }),
    { numRuns: 50 }
  );
};

const words = (text: string): ReadonlyArray<string> => text.split(/\s+/).filter((w) => w.length > 0);

const StubBackend = Layer.succeed(
  NLPBackend,
  NLPBackend.of({
    name: "stub",
    capabilities: {
      tokenization: true,
      sentencization: true,
      posTagging: true,
      lemmatization: true,
      ner: true,
      dependencyParsing: true,
      relationExtraction: false,
      coreferenceResolution: false,
      constituencyParsing: false,
    },
    tokenize: Effect.fn("StubBackend.tokenize")(function* (text: string) {
      return words(text);
    }),
    sentencize: Effect.fn("StubBackend.sentencize")(function* (text: string) {
      return text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }),
    posTag: Effect.fn("StubBackend.posTag")(function* (text: string) {
      return words(text).map((w, i) => POSNode.make({ text: w, tag: "NN", position: i, timestamp: 0 }));
    }),
    lemmatize: Effect.fn("StubBackend.lemmatize")(function* (text: string) {
      return words(text).map((w, i) => LemmaNode.make({ token: w, lemma: w.toLowerCase(), position: i, timestamp: 0 }));
    }),
    extractEntities: Effect.fn("StubBackend.extractEntities")(function* (text: string) {
      return words(text)
        .filter((w) => w.length > 0 && w[0] === w[0]?.toUpperCase())
        .map((w) => EntityNode.make({ text: w, entityType: "MISC", span: { start: 0, end: w.length }, timestamp: 0 }));
    }),
    parseDependencies: Effect.fn("StubBackend.parseDependencies")(function* () {
      return [];
    }),
    extractRelations: Effect.fn("StubBackend.extractRelations")(function* () {
      return [];
    }),
  })
);

describe("AnnotatedTextGraph construction", () => {
  it("round-trips schema-derived annotated nodes", () => {
    assertSchemaRoundTrip(ATG.AnnotatedNode);
  });

  it.effect(
    "empty has no nodes",
    Effect.fnUntraced(function* () {
      expect(ATG.nodeCount(ATG.empty())).toBe(0);
    })
  );

  it.effect(
    "fromDocumentAnnotated builds doc + sentences + annotations",
    Effect.fnUntraced(function* () {
      const g = yield* ATG.fromDocumentAnnotated("Apple makes phones. Steve founded it.").pipe(
        provideScopedLayer(StubBackend)
      );
      const textNodes = ATG.getTextNodes(g);
      expect(textNodes.length).toBe(3);
      expect(ATG.getPOSNodes(g).length).toBeGreaterThan(0);
      expect(ATG.getLemmaNodes(g).length).toBeGreaterThan(0);
      expect(ATG.getEntityNodes(g).length).toBeGreaterThan(0);
    })
  );
});

describe("AnnotatedTextGraph annotation passes are idempotent", () => {
  it.effect(
    "re-running addPOSAnnotations does not duplicate",
    Effect.fnUntraced(function* () {
      const g0 = yield* ATG.fromDocumentAnnotated("One two three.", {
        includePOS: true,
        includeLemmas: false,
        includeEntities: false,
      }).pipe(provideScopedLayer(StubBackend));
      const posAfterFirst = ATG.getPOSNodes(g0).length;
      const g1 = yield* ATG.addPOSAnnotations(g0).pipe(provideScopedLayer(StubBackend));
      expect(ATG.getPOSNodes(g1).length).toBe(posAfterFirst);
    })
  );

  it.effect(
    "re-running addEntityAnnotations does not duplicate",
    Effect.fnUntraced(function* () {
      const g0 = yield* ATG.fromDocumentAnnotated("Apple Steve Jobs.", {
        includePOS: false,
        includeLemmas: false,
        includeEntities: true,
      }).pipe(provideScopedLayer(StubBackend));
      const entitiesAfterFirst = ATG.getEntityNodes(g0).length;
      expect(entitiesAfterFirst).toBeGreaterThan(0);
      const g1 = yield* ATG.addEntityAnnotations(g0).pipe(provideScopedLayer(StubBackend));
      expect(ATG.getEntityNodes(g1).length).toBe(entitiesAfterFirst);
    })
  );
});

describe("AnnotatedTextGraph queries", () => {
  it.effect(
    "countNodesByType sums to total node count",
    Effect.fnUntraced(function* () {
      const g = yield* ATG.fromDocumentAnnotated("Hello world.").pipe(provideScopedLayer(StubBackend));
      const counts = ATG.countNodesByType(g);
      const sum = counts.text + counts.pos + counts.entity + counts.lemma + counts.dependency + counts.relation;
      expect(sum).toBe(ATG.nodeCount(g));
    })
  );

  it.effect(
    "filterByPOSTag returns only matching nodes",
    Effect.fnUntraced(function* () {
      const g = yield* ATG.fromDocumentAnnotated("Alpha beta gamma.", {
        includePOS: true,
        includeLemmas: false,
        includeEntities: false,
      }).pipe(provideScopedLayer(StubBackend));
      const nn = ATG.filterByPOSTag(g, "NN");
      expect(nn.length).toBeGreaterThan(0);
      expect(nn.every((p) => p.tag === "NN")).toBe(true);
      expect(ATG.filterByPOSTag(g, "VB").length).toBe(0);
    })
  );

  it.effect(
    "type guards discriminate the node union",
    Effect.fnUntraced(function* () {
      const g = yield* ATG.fromDocumentAnnotated("Hi.", {
        includePOS: true,
        includeLemmas: false,
        includeEntities: false,
      }).pipe(provideScopedLayer(StubBackend));
      const nodes = ATG.toArray(g);
      expect(nodes.some(ATG.isTextNode)).toBe(true);
      expect(nodes.some(ATG.isPOSNode)).toBe(true);
      expect(nodes.some(ATG.isRelationNode)).toBe(false);
    })
  );
});
