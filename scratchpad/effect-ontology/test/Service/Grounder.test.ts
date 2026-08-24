import { IRI } from "@beep/rdf/Iri";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import * as O from "effect/Option";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { Entity, GroundingDecision, Relation, RelationObject } from "../../Domain/Model/Entity.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { ConfigService, DEFAULT_CONFIG } from "../../Service/Config.ts";
import { Grounder, GrounderResult, GroundingProtocolError, RelationVerificationInput } from "../../Service/Grounder.ts";

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
  it.effect(
    "preserves absent confidence for a relation that was not evaluated",
    Effect.fnUntraced(function* () {
      yield* Effect.sync(() => {
        const relation = Relation.make({
          subjectId: EntityId.make("ada"),
          predicate: IRI.make("https://schema.org/knows"),
          object: RelationObject.cases.EntityReference.make({ value: EntityId.make("grace") }),
        });
        const input = RelationVerificationInput.make({ context: "Ada met Grace.", relation });
        const result = GrounderResult.make({
          decision: GroundingDecision.cases.NotEvaluated.make({}),
          relation: input.relation,
        });

        expect(O.isNone(result.confidence)).toBe(true);
      });
    })
  );

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
