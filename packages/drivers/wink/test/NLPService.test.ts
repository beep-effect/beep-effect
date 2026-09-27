/**
 * Proofs for the NLPService facade: processText builds an annotated text graph,
 * and the entity/POS accessors delegate to the backend.
 *
 * Wired to the wink-nlp backend via NLPService.layer(WinkBackendLive) + WinkEngineLive.
 */

import * as Graph from "@beep/nlp-processing/Graph/AnnotatedTextGraph";
import * as NLPService from "@beep/nlp-processing/NLPService";
import * as WinkEngine from "@beep/wink";
import { WinkBackendLive } from "@beep/wink";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as EffectGraph from "effect/Graph";
import * as Layer from "effect/Layer";

const TestLayer = Layer.provide(NLPService.layer(WinkBackendLive), WinkEngine.WinkEngineLive);

describe("NLPService", () => {
  it.layer(TestLayer)("processText builds an annotated text graph with a document root", (it) => {
    it.effect(
      "processText builds an annotated text graph with a document root",
      Effect.fnUntraced(function* () {
        const graph = yield* NLPService.processText("The cat sat. The dog ran.");
        expect(EffectGraph.nodeCount(graph)).toBeGreaterThan(0);
        const docs = Graph.getTextNodes(graph).filter((entry) => entry.node.type === "document");
        expect(docs.length).toBe(1);
      })
    );
  });

  it.layer(TestLayer)("tagPartsOfSpeech delegates to the backend", (it) => {
    it.effect(
      "tagPartsOfSpeech delegates to the backend",
      Effect.fnUntraced(function* () {
        const tagged = yield* NLPService.tagPartsOfSpeech("dogs run");
        expect(tagged.length).toBe(2);
      })
    );
  });

  it.layer(TestLayer)("extractEntities delegates to the backend", (it) => {
    it.effect(
      "extractEntities delegates to the backend",
      Effect.fnUntraced(function* () {
        const entities = yield* NLPService.extractEntities("Meet me at 5pm.");
        expect(entities.length).toBeGreaterThan(0);
        for (const entity of entities) {
          expect(typeof entity.entityType).toBe("string");
        }
      })
    );
  });
});
