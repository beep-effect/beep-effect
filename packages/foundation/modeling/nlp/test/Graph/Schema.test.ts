/**
 * Decode/encode round-trip proofs for the graph node & edge schemas.
 *
 * Verifies each schema class decodes valid input, round-trips through
 * encode/decode, and rejects invalid discriminants using Effect v4 +
 * `@effect/vitest`. Uses v4's
 * `decodeUnknownEffect`/`encodeEffect` (there is no `S.decodeUnknown`/`S.encode`).
 */

import * as GraphSchema from "@beep/nlp/Graph/Schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const TextNodeArbitrary = S.toArbitrary(GraphSchema.TextNode);
const TextEdgeArbitrary = S.toArbitrary(GraphSchema.TextEdge);
const EntityNodeArbitrary = S.toArbitrary(GraphSchema.EntityNode);
const POSNodeArbitrary = S.toArbitrary(GraphSchema.POSNode);
const LemmaNodeArbitrary = S.toArbitrary(GraphSchema.LemmaNode);
const DependencyNodeArbitrary = S.toArbitrary(GraphSchema.DependencyNode);
const RelationNodeArbitrary = S.toArbitrary(GraphSchema.RelationNode);
const NLPAnalysisArbitrary = S.toArbitrary(GraphSchema.NLPAnalysis);

describe("TextNode", () => {
  it.effect(
    "decodes a valid node and round-trips",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(GraphSchema.TextNode)({
        text: "Hello world.",
        type: "sentence",
        timestamp: 0,
      });
      expect(decoded.text).toBe("Hello world.");
      expect(decoded.type).toBe("sentence");
      const encoded = yield* S.encodeEffect(GraphSchema.TextNode)(decoded);
      const redecoded = yield* S.decodeEffect(GraphSchema.TextNode)(encoded);
      expect(redecoded.text).toBe(decoded.text);
    })
  );

  it.effect(
    "rejects an unknown node type",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.decodeUnknownEffect(GraphSchema.TextNode)({ text: "x", type: "bogus", timestamp: 0 })
      );
      expect(result._tag).toBe("Failure");
    })
  );
});

describe("Schema-derived graph payloads", () => {
  it("round-trips generated graph schemas", () =>
    fc.assert(
      fc.property(
        TextNodeArbitrary,
        TextEdgeArbitrary,
        EntityNodeArbitrary,
        POSNodeArbitrary,
        LemmaNodeArbitrary,
        DependencyNodeArbitrary,
        RelationNodeArbitrary,
        NLPAnalysisArbitrary,
        (textNode, textEdge, entityNode, posNode, lemmaNode, dependencyNode, relationNode, analysis) => {
          const encodedTextNode = Effect.runSync(S.encodeEffect(GraphSchema.TextNode)(textNode));
          const encodedTextEdge = Effect.runSync(S.encodeEffect(GraphSchema.TextEdge)(textEdge));
          const encodedEntityNode = Effect.runSync(S.encodeEffect(GraphSchema.EntityNode)(entityNode));
          const encodedPOSNode = Effect.runSync(S.encodeEffect(GraphSchema.POSNode)(posNode));
          const encodedLemmaNode = Effect.runSync(S.encodeEffect(GraphSchema.LemmaNode)(lemmaNode));
          const encodedDependencyNode = Effect.runSync(S.encodeEffect(GraphSchema.DependencyNode)(dependencyNode));
          const encodedRelationNode = Effect.runSync(S.encodeEffect(GraphSchema.RelationNode)(relationNode));
          const encodedAnalysis = Effect.runSync(S.encodeEffect(GraphSchema.NLPAnalysis)(analysis));

          expect(Effect.runSync(S.decodeEffect(GraphSchema.TextNode)(encodedTextNode))).toEqual(textNode);
          expect(Effect.runSync(S.decodeEffect(GraphSchema.TextEdge)(encodedTextEdge))).toEqual(textEdge);
          expect(Effect.runSync(S.decodeEffect(GraphSchema.EntityNode)(encodedEntityNode))).toEqual(entityNode);
          expect(Effect.runSync(S.decodeEffect(GraphSchema.POSNode)(encodedPOSNode))).toEqual(posNode);
          expect(Effect.runSync(S.decodeEffect(GraphSchema.LemmaNode)(encodedLemmaNode))).toEqual(lemmaNode);
          expect(Effect.runSync(S.decodeEffect(GraphSchema.DependencyNode)(encodedDependencyNode))).toEqual(
            dependencyNode
          );
          expect(Effect.runSync(S.decodeEffect(GraphSchema.RelationNode)(encodedRelationNode))).toEqual(relationNode);
          expect(Effect.runSync(S.decodeEffect(GraphSchema.NLPAnalysis)(encodedAnalysis))).toEqual(analysis);
        }
      ),
      fcRuns(50)
    ));
});

describe("TextEdge", () => {
  it.effect(
    "accepts every declared relation",
    Effect.fnUntraced(function* () {
      const relations = [
        "contains",
        "follows",
        "derived-from",
        "parent-of",
        "tagged-as",
        "lemma-of",
        "head-of",
        "dependent-of",
        "entity-mention",
        "relates-to",
      ] as const;
      for (const relation of relations) {
        const decoded = yield* S.decodeEffect(GraphSchema.TextEdge)({ relation });
        expect(decoded.relation).toBe(relation);
      }
    })
  );

  it.effect(
    "rejects an unknown relation",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(S.decodeUnknownEffect(GraphSchema.TextEdge)({ relation: "nope" }));
      expect(result._tag).toBe("Failure");
    })
  );
});

describe("Annotation nodes round-trip", () => {
  it.effect(
    "EntityNode preserves span and type",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(GraphSchema.EntityNode)({
        text: "Apple Inc.",
        entityType: "ORG",
        span: { start: 0, end: 10 },
        timestamp: 0,
      });
      expect(decoded.entityType).toBe("ORG");
      expect(decoded.span).toEqual({ start: 0, end: 10 });
      const encoded = yield* S.encodeEffect(GraphSchema.EntityNode)(decoded);
      const redecoded = yield* S.decodeEffect(GraphSchema.EntityNode)(encoded);
      expect(redecoded.text).toBe("Apple Inc.");
    })
  );

  it.effect(
    "POSNode and LemmaNode decode",
    Effect.fnUntraced(function* () {
      const pos = yield* S.decodeEffect(GraphSchema.POSNode)({
        text: "runs",
        tag: "VBZ",
        position: 1,
        timestamp: 0,
      });
      expect(pos.tag).toBe("VBZ");
      const lemma = yield* S.decodeEffect(GraphSchema.LemmaNode)({
        token: "running",
        lemma: "run",
        position: 0,
        timestamp: 0,
      });
      expect(lemma.lemma).toBe("run");
    })
  );

  it.effect(
    "DependencyNode and RelationNode decode",
    Effect.fnUntraced(function* () {
      const dep = yield* S.decodeEffect(GraphSchema.DependencyNode)({
        relation: "nsubj",
        head: { text: "runs", position: 2 },
        dependent: { text: "dog", position: 1 },
        distance: 1,
        timestamp: 0,
      });
      expect(dep.relation).toBe("nsubj");
      const rel = yield* S.decodeEffect(GraphSchema.RelationNode)({
        relationType: "FOUNDED_BY",
        subject: { text: "Apple Inc.", entityType: "ORG", span: { start: 0, end: 10 } },
        object: { text: "Steve Jobs", entityType: "PERSON", span: { start: 14, end: 24 } },
        timestamp: 0,
      });
      expect(rel.relationType).toBe("FOUNDED_BY");
    })
  );
});

describe("NLPAnalysis", () => {
  it.effect(
    "decodes a summary",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(GraphSchema.NLPAnalysis)({
        text: "Hi there. Bye.",
        sentences: ["Hi there.", "Bye."],
        tokens: ["Hi", "there", ".", "Bye", "."],
        wordCount: 5,
      });
      expect(decoded.sentences).toHaveLength(2);
      expect(decoded.wordCount).toBe(5);
    })
  );
});
