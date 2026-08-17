import { IRI } from "@beep/rdf/Iri";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { Entity } from "../../Domain/Model/Entity.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { ConfigService, DEFAULT_CONFIG } from "../../Service/Config.ts";
import { Grounder, GroundingProtocolError } from "../../Service/Grounder.ts";

const TestUsage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});

const IncompleteLanguageModel = Layer.effect(
  LanguageModel.LanguageModel,
  LanguageModel.make({
    generateText: () =>
      Effect.succeed([
        Response.makePart("text", {
          text: '{"results":[{"index":0,"grounded":true,"typeMatch":true,"confidence":0.9}]}',
        }),
        Response.makePart("finish", { reason: "stop", response: undefined, usage: TestUsage }),
      ]),
    streamText: () => Stream.empty,
  })
);

const GrounderIncompleteBatch = Grounder.Default.pipe(
  Layer.provide(Layer.merge(Layer.succeed(ConfigService, DEFAULT_CONFIG), IncompleteLanguageModel))
);

describe("Grounder", () => {
  it.layer(GrounderIncompleteBatch)("protocol validation", (it) => {
    it.effect(
      "fails an incomplete indexed entity batch instead of synthesizing rejection",
      Effect.fnUntraced(function* () {
        const grounder = yield* Grounder;
        const person = IRI.make("https://schema.org/Person");
        const error = yield* grounder
          .verifyEntityBatch("Ada met Grace.", [
            Entity.make({ id: EntityId.make("ada"), mention: "Ada", types: [person] }),
            Entity.make({ id: EntityId.make("grace"), mention: "Grace", types: [person] }),
          ])
          .pipe(Effect.flip);

        expect(GroundingProtocolError.is(error)).toBe(true);
        if (GroundingProtocolError.is(error)) {
          expect(error.missingIndexes).toEqual([1]);
          expect(error.expectedCount).toBe(2);
          expect(error.receivedCount).toBe(1);
        }
      })
    );
  });
});
