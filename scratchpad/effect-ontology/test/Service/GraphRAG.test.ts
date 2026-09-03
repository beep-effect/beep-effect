import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Layer, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../../Domain/Model/Entity.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { EntityIndex } from "../../Service/EntityIndex.ts";
import { GraphRAG, GraphRAGGenerationError } from "../../Service/GraphRAG.ts";
import { RetryPolicy } from "../../Service/Retry.ts";
import { SubgraphExtractor } from "../../Service/SubgraphExtractor.ts";

const alice = Entity.make({
  id: EntityId.make("alice"),
  mention: "Alice",
  types: [IRI.make("https://schema.org/Person")],
});

const bob = Entity.make({
  id: EntityId.make("bob"),
  mention: "Bob",
  types: [IRI.make("https://schema.org/Person")],
});

const carol = Entity.make({
  id: EntityId.make("carol"),
  mention: "Carol",
  types: [IRI.make("https://schema.org/Person")],
});

const dave = Entity.make({
  id: EntityId.make("dave"),
  mention: "Dave",
  types: [IRI.make("https://schema.org/Person")],
});

const aliceKnowsBob = Relation.make({
  subjectId: alice.id,
  predicate: IRI.make("https://schema.org/knows"),
  object: RelationObject.cases.EntityReference.make({ value: bob.id }),
});

const bobKnowsCarol = Relation.make({
  subjectId: bob.id,
  predicate: IRI.make("https://schema.org/knows"),
  object: RelationObject.cases.EntityReference.make({ value: carol.id }),
});

const graph = KnowledgeGraph.make({
  entities: [alice, bob, carol, dave],
  relations: [aliceKnowsBob, bobKnowsCarol],
});

const ranked = [
  { entity: alice, score: 0.95 },
  { entity: carol, score: 0.8 },
  { entity: dave, score: 0.7 },
];

const EntityIndexTest = Layer.succeed(
  EntityIndex,
  EntityIndex.of({
    index: Effect.fn("EntityIndex.index")((source) => Effect.succeed(A.length(source.entities))),
    findSimilar: Effect.fn("EntityIndex.findSimilar")((_query, count) => Effect.succeed(A.take(ranked, count))),
    findByType: Effect.fn("EntityIndex.findByType")(() => Effect.succeed([])),
    add: Effect.fn("EntityIndex.add")(() => Effect.void),
    remove: Effect.fn("EntityIndex.remove")(() => Effect.succeed(false)),
    get: Effect.fn("EntityIndex.get")(() => Effect.succeedNone),
    clear: Effect.void,
    size: Effect.succeed(A.length(ranked)),
  })
);

const SubgraphExtractorTest = Layer.effect(SubgraphExtractor, SubgraphExtractor.make).pipe(
  Layer.provide(EntityIndexTest)
);

const GraphRAGTest = Layer.effect(GraphRAG, GraphRAG.make).pipe(
  Layer.provide(Layer.merge(EntityIndexTest, SubgraphExtractorTest))
);

const TestUsage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});

const makeLanguageModelLayer = (json: string): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () =>
        Effect.succeed([
          Response.makePart("text", { text: json }),
          Response.makePart("finish", { reason: "stop", response: undefined, usage: TestUsage }),
        ]),
      streamText: () => Stream.empty,
    })
  );

const ValidLanguageModel = makeLanguageModelLayer(
  '{"answer":"Alice is connected to Carol through Bob.","citations":["alice","carol"],"confidence":0.9,"reasoning":"The graph contains a two-edge path."}'
);

const InvalidCitationLanguageModel = makeLanguageModelLayer(
  '{"answer":"Unsupported.","citations":["mallory"],"confidence":0.5,"reasoning":"The citation is not in context."}'
);

const CompleteTestLayer = Layer.merge(GraphRAGTest, ValidLanguageModel);

describe("SubgraphExtractor", () => {
  it.layer(SubgraphExtractorTest)("bounded breadth-first traversal", (it) => {
    it.effect(
      "enforces the node bound before accepting seeds and supports both dual forms",
      Effect.fnUntraced(function* () {
        const extractor = yield* SubgraphExtractor;
        const options = { maxNodes: PosInt.make(2), followIncoming: true, followOutgoing: true };

        const dataFirst = yield* extractor.extract(
          graph,
          [alice.id, bob.id, carol.id],
          NonNegativeInt.make(2),
          options
        );
        const dataLast = yield* extractor.extract([alice.id, bob.id, carol.id], NonNegativeInt.make(2), options)(graph);

        assert.deepEqual(dataLast, dataFirst);
        assert.strictEqual(A.length(dataFirst.nodes), 2);
        assert.deepEqual(dataFirst.centerNodes, [alice.id, bob.id]);
      })
    );

    it.effect(
      "records shortest hop distances and actual depth",
      Effect.fnUntraced(function* () {
        const extractor = yield* SubgraphExtractor;
        const subgraph = yield* extractor.extract(graph, [alice.id], NonNegativeInt.make(3), {
          maxNodes: PosInt.make(4),
          followIncoming: false,
          followOutgoing: true,
        });
        const carolDistance = A.findFirst(subgraph.distances, (distance) => distance.entityId === carol.id);

        assert.strictEqual(subgraph.depth, 2);
        assert.isTrue(O.isSome(carolDistance));
        if (O.isSome(carolDistance)) {
          assert.strictEqual(carolDistance.value.hops, 2);
        }
      })
    );

    it.effect(
      "supports both relevance-extraction dual forms",
      Effect.fnUntraced(function* () {
        const extractor = yield* SubgraphExtractor;
        const options = {
          topK: PosInt.make(1),
          hops: NonNegativeInt.make(2),
          minSimilarity: Confidence.make(0.3),
          filterTypes: [],
        };
        const dataFirst = yield* extractor.extractRelevant(graph, "Who knows Carol?", PosInt.make(4), options);
        const dataLast = yield* extractor.extractRelevant("Who knows Carol?", PosInt.make(4), options)(graph);

        assert.deepEqual(dataLast, dataFirst);
        assert.strictEqual(dataFirst.depth, 2);
      })
    );
  });
});

describe("GraphRAG", () => {
  it.layer(CompleteTestLayer)("with a language model in the Effect environment", (it) => {
    it.effect(
      "supports both dual forms across retrieval, formatting, generation, answer, and explanation",
      Effect.fnUntraced(function* () {
        const graphRag = yield* GraphRAG;
        const retrievalOptions = {
          topK: PosInt.make(1),
          hops: NonNegativeInt.make(2),
          maxNodes: PosInt.make(4),
          minScore: Confidence.make(0.3),
          includeTypes: [],
          includeAttributes: true,
          includeRelations: true,
        };
        const generationOptions = {
          retryPolicy: RetryPolicy.make({
            attemptTimeout: Duration.seconds(1),
            maxAttempts: PosInt.make(1),
            jitter: false,
          }),
        };

        const retrievalFirst = yield* graphRag.retrieve(graph, "Who knows Carol?", retrievalOptions);
        const retrievalLast = yield* graphRag.retrieve("Who knows Carol?", retrievalOptions)(graph);
        assert.deepEqual(retrievalLast, retrievalFirst);
        assert.strictEqual(retrievalFirst.stats.hops, 2);
        assert.include(retrievalFirst.context, "[id: alice]");
        assert.include(retrievalFirst.context, "[id: carol]");

        const contextFirst = yield* graphRag.formatContext(retrievalFirst.subgraph, retrievalFirst.query, {
          includeAttributes: true,
          includeRelations: true,
        });
        const contextLast = yield* graphRag.formatContext(retrievalFirst.query, {
          includeAttributes: true,
          includeRelations: true,
        })(retrievalFirst.subgraph);
        assert.strictEqual(contextLast, contextFirst);

        const generatedFirst = yield* graphRag.generate(retrievalFirst, retrievalFirst.query, generationOptions);
        const generatedLast = yield* graphRag.generate(retrievalFirst.query, generationOptions)(retrievalFirst);
        assert.deepEqual(generatedLast, generatedFirst);

        const answerOptions = { ...retrievalOptions, ...generationOptions };
        const answerFirst = yield* graphRag.answer(graph, retrievalFirst.query, answerOptions);
        const answerLast = yield* graphRag.answer(retrievalFirst.query, answerOptions)(graph);
        assert.deepEqual(answerLast, answerFirst);

        const explainOptions = { ...generationOptions, generateStepExplanations: false };
        const explanationFirst = yield* graphRag.explain(generatedFirst, explainOptions);
        const explanationLast = yield* graphRag.explain(explainOptions)(generatedFirst);
        assert.deepEqual(explanationLast, explanationFirst);
        assert.strictEqual(A.length(explanationFirst.steps), 2);
        assert.isTrue(A.contains(explanationFirst.involvedEntities, bob.id));
      })
    );
  });

  it.layer(Layer.merge(GraphRAGTest, InvalidCitationLanguageModel))("with an invalid citation response", (it) => {
    it.effect(
      "rejects citations outside the retrieved subgraph",
      Effect.fnUntraced(function* () {
        const graphRag = yield* GraphRAG;
        const retrieval = yield* graphRag.retrieve(graph, "Who knows Carol?", {
          topK: PosInt.make(1),
          hops: NonNegativeInt.make(2),
          maxNodes: PosInt.make(4),
          minScore: Confidence.make(0.3),
          includeTypes: [],
          includeAttributes: true,
          includeRelations: true,
        });
        const error = yield* graphRag
          .generate(retrieval, retrieval.query, {
            retryPolicy: RetryPolicy.make({
              attemptTimeout: Duration.seconds(1),
              maxAttempts: PosInt.make(1),
              jitter: false,
            }),
          })
          .pipe(Effect.flip);

        assert.isTrue(GraphRAGGenerationError.is(error));
        if (GraphRAGGenerationError.is(error)) {
          assert.include(error.message, "mallory");
        }
      })
    );
  });
});
