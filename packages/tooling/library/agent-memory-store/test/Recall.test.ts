import {
  Candidate,
  defaultFusionWeights,
  Embedder,
  FusionWeights,
  IndexHit,
  IndexSearch,
  RecallBudget,
  RecallFilter,
  RecallQuery,
  RecallResult,
  Reranker,
} from "@beep/agent-memory-store";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { nodeId, otherNodeId, revisionA, revisionB } from "./fixtures.ts";

const decodeWeights = S.decodeEffect(FusionWeights);

describe("Recall models", () => {
  it.effect.prop(
    "round-trips arbitrary recall budgets",
    [Arbitrary.schema(RecallBudget)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(RecallBudget)(value);
        const decoded = yield* S.decodeEffect(RecallBudget)(encoded);
        expect(decoded).toEqual(value);
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect(
    "rejects fusion weights that do not sum to 1",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeWeights({ bm25: 0.5, vector: 0.4 }));
      assertInstanceOf(error, S.SchemaError);

      const weights = yield* decodeWeights({ bm25: 0.7, vector: 0.3 });
      expect(weights.bm25).toBe(0.7);
      expect(defaultFusionWeights.bm25).toBe(0.7);
      expect(defaultFusionWeights.vector).toBe(0.3);
    })
  );

  it.effect(
    "applies the recall budget defaults",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(RecallBudget)({ maxTokens: 2000 });
      expect(decoded.maxCandidates).toBe(50);
      expect(decoded.maxAccepted).toBe(5);

      const made = RecallBudget.make({ maxTokens: 2000 });
      expect(made.maxCandidates).toBe(50);
      expect(made.maxAccepted).toBe(5);
    })
  );

  it.effect(
    "carries the authoritative filters inside an index search and scores a hit in the index's own scale",
    Effect.fnUntraced(function* () {
      const search = IndexSearch.make({
        text: "sqlite driver",
        filters: [RecallFilter.cases.kind.make({ kind: "listItem" })],
        limit: 50,
      });
      const encoded = yield* S.encodeEffect(IndexSearch)(search);
      expect(encoded).toEqual({ text: "sqlite driver", filters: [{ filter: "kind", kind: "listItem" }], limit: 50 });
      const decoded = yield* S.decodeEffect(IndexSearch)(encoded);
      expect(decoded).toEqual(search);

      const hit = IndexHit.make({ nodeId, revisionId: revisionA, text: "Use the sqlite driver.", score: 4.2 });
      const encodedHit = yield* S.encodeEffect(IndexHit)(hit);
      expect(encodedHit).toEqual({
        nodeId,
        revisionId: revisionA,
        text: "Use the sqlite driver.",
        score: 4.2,
      });
    })
  );
});

layer(Embedder.unavailable)("Embedder.unavailable", (it) => {
  it.effect(
    "returns no embeddings, so the vector index stays empty without a local model",
    Effect.fnUntraced(function* () {
      const embedder = yield* Embedder;
      const embeddings = yield* embedder.embed(["sqlite driver", "memory log"]);
      assertNone(embeddings);
    })
  );
});

describe("RecallResult", () => {
  const decodeResult = S.decodeUnknownEffect(RecallResult);

  it.effect(
    "cannot carry accepted candidates on an abstention",
    Effect.fnUntraced(function* () {
      const abstained = yield* decodeResult({ result: "abstained", violations: [], accepted: [] });
      expect(abstained).toEqual(RecallResult.cases.abstained.make({ violations: [] }));
      expect("accepted" in abstained).toBe(false);
    })
  );

  it.effect(
    "requires at least one accepted candidate on an answer",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeResult({ result: "answered", accepted: [], violations: [] }));
      assertInstanceOf(error, S.SchemaError);

      const candidate = Candidate.make({
        nodeId,
        revisionId: revisionA,
        text: "first",
        bm25: O.some(0.9),
        vector: O.none(),
        fused: 0.63,
        reranked: O.none(),
      });
      const answered = RecallResult.cases.answered.make({ accepted: [candidate], violations: [] });
      const encoded = yield* S.encodeEffect(RecallResult)(answered);
      const decoded = yield* decodeResult(encoded);
      expect(decoded).toEqual(answered);
    })
  );
});

layer(Reranker.passThrough)("Reranker.passThrough", (it) => {
  it.effect(
    "passes candidates through in fused order without rerank scores",
    Effect.fnUntraced(function* () {
      const candidates = [
        Candidate.make({
          nodeId,
          revisionId: revisionA,
          text: "first",
          bm25: O.some(0.9),
          vector: O.none(),
          fused: 0.63,
          reranked: O.some(0.1),
        }),
        Candidate.make({
          nodeId: otherNodeId,
          revisionId: revisionB,
          text: "second",
          bm25: O.none(),
          vector: O.some(0.8),
          fused: 0.24,
          reranked: O.none(),
        }),
      ];
      const query = RecallQuery.make({ text: "decision", filters: [], budget: RecallBudget.make({ maxTokens: 500 }) });

      const reranker = yield* Reranker;
      const reranked = yield* reranker.rerank(query, candidates);

      expect(A.map(reranked, (candidate) => candidate.text)).toEqual(["first", "second"]);
      A.forEach(reranked, (candidate) => assertNone(candidate.reranked));
    })
  );
});
