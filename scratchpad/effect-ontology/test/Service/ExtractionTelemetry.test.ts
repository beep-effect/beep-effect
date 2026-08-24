import { NonNegativeInt } from "@beep/schema/Int";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ExtractionMetrics } from "../../Domain/Model/OntologyAgent.ts";
import {
  captureExtractionTelemetry,
  ProviderTokenUsage,
  recordExtractionChunkCount,
  recordProviderAttempt,
  recordProviderUsage,
} from "../../Telemetry/ExtractionTelemetry.ts";

describe("ExtractionTelemetry", () => {
  it.effect(
    "captures chunk counts and complete provider usage",
    Effect.fnUntraced(function* () {
      const [, snapshot] = yield* captureExtractionTelemetry(
        Effect.gen(function* () {
          yield* recordExtractionChunkCount(NonNegativeInt.make(3));
          yield* recordProviderAttempt;
          yield* recordProviderUsage({ inputTokens: 12, outputTokens: 4 });
        })
      );

      expect(snapshot.chunkCount).toBe(3);
      expect(
        ProviderTokenUsage.match(snapshot.usage, {
          Complete: ({ attemptCount, inputTokens, outputTokens }) => ({ attemptCount, inputTokens, outputTokens }),
          Partial: () => undefined,
          Unavailable: () => undefined,
        })
      ).toEqual({ attemptCount: 1, inputTokens: 12, outputTokens: 4 });
    })
  );

  it.effect(
    "distinguishes partial and unavailable provider reporting",
    Effect.fnUntraced(function* () {
      const [, partial] = yield* captureExtractionTelemetry(
        Effect.gen(function* () {
          yield* recordProviderAttempt;
          yield* recordProviderAttempt;
          yield* recordProviderUsage({ inputTokens: 8, outputTokens: undefined });
        })
      );
      const [, unavailable] = yield* captureExtractionTelemetry(recordProviderAttempt);

      expect(
        ProviderTokenUsage.match(partial.usage, {
          Complete: () => undefined,
          Partial: ({ attemptCount, inputTokens, missingAttempts, outputTokens }) => ({
            attemptCount,
            inputTokens,
            missingAttempts,
            outputTokens,
          }),
          Unavailable: () => undefined,
        })
      ).toEqual({ attemptCount: 2, inputTokens: 8, missingAttempts: 2, outputTokens: 0 });
      expect(
        ProviderTokenUsage.match(unavailable.usage, {
          Complete: () => undefined,
          Partial: () => undefined,
          Unavailable: ({ attemptCount }) => attemptCount,
        })
      ).toBe(1);
    })
  );

  it.effect(
    "records provider usage atomically when an explicit attempt signal is absent",
    Effect.fnUntraced(function* () {
      const [, snapshot] = yield* captureExtractionTelemetry(recordProviderUsage({ inputTokens: 3, outputTokens: 2 }));

      expect(
        ProviderTokenUsage.match(snapshot.usage, {
          Complete: ({ attemptCount, inputTokens, outputTokens }) => ({ attemptCount, inputTokens, outputTokens }),
          Partial: () => undefined,
          Unavailable: () => undefined,
        })
      ).toEqual({ attemptCount: 1, inputTokens: 3, outputTokens: 2 });
    })
  );

  it.effect(
    "rejects partial usage whose missing count exceeds its attempt count",
    Effect.fnUntraced(function* () {
      yield* Effect.sync(() => {
        const decoded = S.decodeOption(ProviderTokenUsage)({
          _tag: "Partial",
          inputTokens: 1,
          outputTokens: 0,
          attemptCount: 1,
          missingAttempts: 2,
        });

        expect(O.isNone(decoded)).toBe(true);
      });
    })
  );

  it.effect(
    "isolates concurrent extraction collectors",
    Effect.fnUntraced(function* () {
      const snapshots = yield* Effect.all(
        [
          captureExtractionTelemetry(recordExtractionChunkCount(NonNegativeInt.make(1))),
          captureExtractionTelemetry(recordExtractionChunkCount(NonNegativeInt.make(5))),
        ],
        { concurrency: "unbounded" }
      );

      expect(A.map(snapshots, ([, snapshot]) => snapshot.chunkCount)).toEqual([1, 5]);
    })
  );

  it.effect(
    "preserves unavailable usage instead of fabricating zero tokens",
    Effect.fnUntraced(function* () {
      yield* Effect.sync(() => {
        const metrics = ExtractionMetrics.make({
          entityCount: NonNegativeInt.make(0),
          relationCount: NonNegativeInt.make(0),
          chunkCount: NonNegativeInt.make(1),
          usage: ProviderTokenUsage.cases.Unavailable.make({ attemptCount: NonNegativeInt.make(1) }),
          duration: Duration.zero,
        });

        expect(O.isNone(metrics.totalTokens)).toBe(true);
      });
    })
  );
});
