import { PosInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Ref } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { BackpressureConfig } from "../../Contract/ProgressStreaming.ts";
import { ExtractionRunId } from "../../Domain/Identity.ts";
import { makeBackpressureHandler, makeProgressBuilder } from "../../Service/ProgressStreaming.ts";
import { EntityResolutionConfig } from "../../Workflow/EntityResolution.ts";
const decodeUnknownBackpressureConfigResult = S.decodeUnknownResult(BackpressureConfig);
const decodeUnknownEntityResolutionConfigResult = S.decodeUnknownResult(EntityResolutionConfig);

describe("progress and workflow schema boundaries", () => {
  it.effect(
    "constructs canonical backpressure defaults and initializes handler state",
    Effect.fnUntraced(function* () {
      const config = BackpressureConfig.make({});
      const state = yield* makeBackpressureHandler().pipe(Effect.flatMap(Ref.get));

      assert.strictEqual(config.maxQueueSize, 1000);
      assert.strictEqual(config.warningThreshold, 0.8);
      assert.strictEqual(config.strategy, "drop_oldest");
      assert.strictEqual(Duration.toMillis(config.blockTimeout), 5000);
      assert.strictEqual(config.detailedEventSampleRate, 0.1);
      assert.strictEqual(state.config.maxQueueSize, config.maxQueueSize);
      assert.deepStrictEqual(state.eventQueue, []);
    })
  );

  it("rejects invalid backpressure and entity-resolution thresholds", () => {
    assert.isTrue(Result.isFailure(decodeUnknownBackpressureConfigResult({ maxQueueSize: 0 })));
    assert.isTrue(Result.isFailure(decodeUnknownBackpressureConfigResult({ warningThreshold: 1.1 })));
    assert.isTrue(Result.isFailure(decodeUnknownBackpressureConfigResult({ detailedEventSampleRate: -0.1 })));
    assert.isTrue(Result.isFailure(decodeUnknownEntityResolutionConfigResult({ mentionSimilarityThreshold: 1.1 })));
    assert.isTrue(Result.isFailure(decodeUnknownEntityResolutionConfigResult({ typeOverlapRatio: -0.1 })));
  });

  it.effect(
    "constructs schema defaults for entity resolution and progress builder state",
    Effect.fnUntraced(function* () {
      const config = EntityResolutionConfig.make({});
      const state = yield* makeProgressBuilder(ExtractionRunId.make("doc-0123456789ab"), PosInt.make(3)).pipe(
        Effect.flatMap(Ref.get)
      );

      assert.strictEqual(config.mentionSimilarityThreshold, UnitInterval.make(0.7));
      assert.strictEqual(config.requireTypeOverlap, true);
      assert.strictEqual(config.typeOverlapRatio, UnitInterval.make(0.5));
      assert.strictEqual(state.totalChunks, 3);
      assert.strictEqual(state.processedChunks, 0);
      assert.strictEqual(state.currentPhaseProgress, 0);
    })
  );
});
