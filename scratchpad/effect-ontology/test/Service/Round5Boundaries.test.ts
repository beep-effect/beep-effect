import { PosInt } from "@beep/schema/Int";
import { UUID } from "@beep/schema/String";
import { ISOStr } from "@beep/schema/Timestamp";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ExtractionRunId } from "../../Domain/Identity.ts";
import { EventId as CoreEventId } from "../../Domain/Model/CoreOntology.ts";
import { EventId as KnowledgeEventId } from "../../Domain/Schema/KnowledgeModel.ts";
import { getRunIdFromText } from "../../Service/ExtractionRun.ts";
import { createExtractionStarted, makeProgressBuilder } from "../../Service/ProgressStreaming.ts";

describe("Round 5 canonical boundaries", () => {
  it.effect(
    "constructs progress event identity and time through canonical schemas",
    Effect.fnUntraced(function* () {
      const runId = ExtractionRunId.make("doc-deadbeefcafe");
      const builder = yield* makeProgressBuilder(runId, PosInt.make(2));
      const event = yield* createExtractionStarted(builder, {
        characterCount: PosInt.make(20),
        estimatedAvgChunkSize: PosInt.make(10),
      });

      assert.isTrue(S.is(UUID)(event.eventId));
      assert.isTrue(S.is(ISOStr)(event.timestamp));
      assert.strictEqual(event.runId, runId);
    })
  );

  it("rejects invalid progress counts before the service boundary", () => {
    assert.isTrue(Result.isFailure(S.decodeResult(PosInt)(0)));
  });

  it("constructs deterministic extraction IDs through the canonical owner", () => {
    const first = getRunIdFromText("canonical content");
    const second = getRunIdFromText("canonical content");

    assert.isTrue(ExtractionRunId.is(first));
    assert.strictEqual(first, second);
  });

  it("shares one EventId schema identity across both domain surfaces", () => {
    assert.strictEqual(KnowledgeEventId, CoreEventId);
  });
});
