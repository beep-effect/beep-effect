import * as GraphSchema from "@beep/nlp/Graph/Schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeGraphSchemaDependencyNode = S.decodeEffect(GraphSchema.DependencyNode);
const decodeGraphSchemaEntityNode = S.decodeEffect(GraphSchema.EntityNode);
const decodeGraphSchemaLemmaNode = S.decodeEffect(GraphSchema.LemmaNode);
const decodeGraphSchemaNLPAnalysis = S.decodeEffect(GraphSchema.NLPAnalysis);
const decodeGraphSchemaPOSNode = S.decodeEffect(GraphSchema.POSNode);
const decodeGraphSchemaRelationNode = S.decodeEffect(GraphSchema.RelationNode);
const decodeGraphSchemaTextEdge = S.decodeEffect(GraphSchema.TextEdge);
const decodeGraphSchemaTextNode = S.decodeEffect(GraphSchema.TextNode);
const decodeUnknownGraphSchemaTextEdge = S.decodeUnknownEffect(GraphSchema.TextEdge);
const decodeUnknownGraphSchemaTextNode = S.decodeUnknownEffect(GraphSchema.TextNode);
const encodeGraphSchemaDependencyNode = S.encodeEffect(GraphSchema.DependencyNode);
const encodeGraphSchemaEntityNode = S.encodeEffect(GraphSchema.EntityNode);
const encodeGraphSchemaLemmaNode = S.encodeEffect(GraphSchema.LemmaNode);
const encodeGraphSchemaNLPAnalysis = S.encodeEffect(GraphSchema.NLPAnalysis);
const encodeGraphSchemaPOSNode = S.encodeEffect(GraphSchema.POSNode);
const encodeGraphSchemaRelationNode = S.encodeEffect(GraphSchema.RelationNode);
const encodeGraphSchemaTextEdge = S.encodeEffect(GraphSchema.TextEdge);
const encodeGraphSchemaTextNode = S.encodeEffect(GraphSchema.TextNode);

const TextNodeArbitrary = Arbitrary.schema(GraphSchema.TextNode);
const TextEdgeArbitrary = Arbitrary.schema(GraphSchema.TextEdge);
const EntityNodeArbitrary = Arbitrary.schema(GraphSchema.EntityNode);
const POSNodeArbitrary = Arbitrary.schema(GraphSchema.POSNode);
const LemmaNodeArbitrary = Arbitrary.schema(GraphSchema.LemmaNode);
const DependencyNodeArbitrary = Arbitrary.schema(GraphSchema.DependencyNode);
const RelationNodeArbitrary = Arbitrary.schema(GraphSchema.RelationNode);
const NLPAnalysisArbitrary = Arbitrary.schema(GraphSchema.NLPAnalysis);

describe("TextNode", () => {
  it.effect(
    "decodes a valid node and round-trips",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeGraphSchemaTextNode({
        text: "Hello world.",
        type: "sentence",
        timestamp: 0,
      });
      expect(decoded.text).toBe("Hello world.");
      expect(decoded.type).toBe("sentence");
      const encoded = yield* encodeGraphSchemaTextNode(decoded);
      const redecoded = yield* decodeGraphSchemaTextNode(encoded);
      expect(redecoded.text).toBe(decoded.text);
    })
  );

  it.effect(
    "rejects an unknown node type",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(decodeUnknownGraphSchemaTextNode({ text: "x", type: "bogus", timestamp: 0 }));
      expect(result._tag).toBe("Failure");
    })
  );
});

describe("Schema-derived graph payloads", () => {
  it.effect.prop(
    "round-trips generated graph schemas",
    [
      TextNodeArbitrary,
      TextEdgeArbitrary,
      EntityNodeArbitrary,
      POSNodeArbitrary,
      LemmaNodeArbitrary,
      DependencyNodeArbitrary,
      RelationNodeArbitrary,
      NLPAnalysisArbitrary,
    ],
    ([textNode, textEdge, entityNode, posNode, lemmaNode, dependencyNode, relationNode, analysis]) =>
      Effect.gen(function* () {
        const encodedTextNode = yield* encodeGraphSchemaTextNode(textNode);
        const encodedTextEdge = yield* encodeGraphSchemaTextEdge(textEdge);
        const encodedEntityNode = yield* encodeGraphSchemaEntityNode(entityNode);
        const encodedPOSNode = yield* encodeGraphSchemaPOSNode(posNode);
        const encodedLemmaNode = yield* encodeGraphSchemaLemmaNode(lemmaNode);
        const encodedDependencyNode = yield* encodeGraphSchemaDependencyNode(dependencyNode);
        const encodedRelationNode = yield* encodeGraphSchemaRelationNode(relationNode);
        const encodedAnalysis = yield* encodeGraphSchemaNLPAnalysis(analysis);

        expect(yield* decodeGraphSchemaTextNode(encodedTextNode)).toEqual(textNode);
        expect(yield* decodeGraphSchemaTextEdge(encodedTextEdge)).toEqual(textEdge);
        expect(yield* decodeGraphSchemaEntityNode(encodedEntityNode)).toEqual(entityNode);
        expect(yield* decodeGraphSchemaPOSNode(encodedPOSNode)).toEqual(posNode);
        expect(yield* decodeGraphSchemaLemmaNode(encodedLemmaNode)).toEqual(lemmaNode);
        expect(yield* decodeGraphSchemaDependencyNode(encodedDependencyNode)).toEqual(dependencyNode);
        expect(yield* decodeGraphSchemaRelationNode(encodedRelationNode)).toEqual(relationNode);
        expect(yield* decodeGraphSchemaNLPAnalysis(encodedAnalysis)).toEqual(analysis);

        return true;
      }),
    { arbitrary: fcRuns(50) }
  );
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
        const decoded = yield* decodeGraphSchemaTextEdge({ relation });
        expect(decoded.relation).toBe(relation);
      }
    })
  );

  it.effect(
    "rejects an unknown relation",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(decodeUnknownGraphSchemaTextEdge({ relation: "nope" }));
      expect(result._tag).toBe("Failure");
    })
  );
});

describe("Annotation nodes round-trip", () => {
  it.effect(
    "EntityNode preserves span and type",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeGraphSchemaEntityNode({
        text: "Apple Inc.",
        entityType: "ORG",
        span: { start: 0, end: 10 },
        timestamp: 0,
      });
      expect(decoded.entityType).toBe("ORG");
      expect(decoded.span).toEqual({ start: 0, end: 10 });
      const encoded = yield* encodeGraphSchemaEntityNode(decoded);
      const redecoded = yield* decodeGraphSchemaEntityNode(encoded);
      expect(redecoded.text).toBe("Apple Inc.");
    })
  );

  it.effect(
    "POSNode and LemmaNode decode",
    Effect.fnUntraced(function* () {
      const pos = yield* decodeGraphSchemaPOSNode({
        text: "runs",
        tag: "VBZ",
        position: 1,
        timestamp: 0,
      });
      expect(pos.tag).toBe("VBZ");
      const lemma = yield* decodeGraphSchemaLemmaNode({
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
      const dep = yield* decodeGraphSchemaDependencyNode({
        relation: "nsubj",
        head: { text: "runs", position: 2 },
        dependent: { text: "dog", position: 1 },
        distance: 1,
        timestamp: 0,
      });
      expect(dep.relation).toBe("nsubj");
      const rel = yield* decodeGraphSchemaRelationNode({
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
      const decoded = yield* decodeGraphSchemaNLPAnalysis({
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
