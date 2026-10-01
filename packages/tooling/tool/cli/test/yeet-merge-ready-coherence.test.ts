import {
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyFromEncoded,
  YeetVerdictJson,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeMergeReady = S.decodeUnknownEffect(YeetMergeReadyFromEncoded);

const currentCriteria = (
  overrides: Partial<{
    readonly closeoutRun: boolean;
    readonly mergeStateAcceptable: boolean;
    readonly mergeable: boolean;
    readonly notDraft: boolean;
    readonly prOpen: boolean;
    readonly requiredChecksGreen: boolean;
    readonly reviewDecisionAcceptable: boolean;
    readonly threadsResolved: boolean;
  }> = {}
) => ({
  prOpen: true,
  notDraft: true,
  closeoutRun: true,
  requiredChecksGreen: true,
  threadsResolved: true,
  mergeable: true,
  mergeStateAcceptable: true,
  reviewDecisionAcceptable: true,
  ...overrides,
});

// A verdict document whose only variable part is the merge-readiness record, so
// a decode failure can only come from the cross-field check.
const verdictJsonWithMergeReady = (mergeReady: string): string =>
  [
    '{"schemaVersion":"yeet-verdict/v2","base":"origin/main","branch":"feat/merge-loop","committed":true,',
    '"createdAt":"2026-08-04T00:00:05.000Z","failurePolicy":"fail-fast","head":"HEAD","lanes":[],',
    '"message":"yeet publish proof passed.","mode":"publish","outcome":"success","packetPaths":[],',
    `"pushed":true,"runId":"feat_merge-loop","mergeReady":${mergeReady}}`,
  ].join("");

describe("YeetMergeReady coherence", () => {
  it.effect("decodes a blocked record whose named criterion is the unsatisfied one", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeMergeReady({
        ready: false,
        failing: "required-checks-green",
        criteria: currentCriteria({ requiredChecksGreen: false }),
      });

      expect(decoded.ready).toBe(false);
      assertSome(decoded.failing, "required-checks-green");
    })
  );

  it.effect("decodes a ready record naming no criterion with all criteria satisfied", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeMergeReady({
        ready: true,
        criteria: { ...currentCriteria(), greptileScore: "5/5" },
      });

      expect(decoded.ready).toBe(true);
      assertNone(decoded.failing);
      assertSome(decoded.criteria.greptileScore, "5/5");
    })
  );

  // The exact document the review named: `ready` and `failing` are an answer and
  // its own refutation, and whichever field a reader trusted decided the merge.
  it.effect("rejects a record that is ready and also names a blocking criterion", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: true,
          failing: "required-checks-green",
          criteria: currentCriteria({ requiredChecksGreen: false }),
        })
      );

      assertTrue(Exit.isFailure(exit));
    })
  );

  it.effect("rejects a record blocked on a criterion its own criteria report as satisfied", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: false,
          failing: "threads-resolved",
          criteria: currentCriteria(),
        })
      );

      assertTrue(Exit.isFailure(exit));
    })
  );

  it.effect("rejects a not-ready record that names no blocking criterion", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: false,
          criteria: currentCriteria(),
        })
      );

      assertTrue(Exit.isFailure(exit));
    })
  );

  it.effect("rejects a ready record whose criteria are not all satisfied", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: true,
          criteria: currentCriteria({ threadsResolved: false }),
        })
      );

      assertTrue(Exit.isFailure(exit));
    })
  );

  it("keeps the coherent constructor path working", () => {
    const mergeReady = YeetMergeReady.make({
      ready: false,
      failing: O.some("threads-resolved"),
      criteria: YeetMergeReadyCriteria.make({
        ...currentCriteria({ threadsResolved: false }),
        greptileScore: O.none(),
      }),
    });

    assertSome(mergeReady.failing, "threads-resolved");
  });
});

describe("YeetVerdictJson merge-readiness coherence", () => {
  it.effect("downgrades a legacy ready verdict whose criteria omit closeoutRun", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetVerdictJson.decode(
        verdictJsonWithMergeReady('{"ready":true,"criteria":{"checksGreen":true,"threadsResolved":true}}')
      );
      const mergeReady = O.getOrThrow(decoded.mergeReady);

      expect(mergeReady.ready).toBe(false);
      assertSome(mergeReady.failing, "pr-open");
      expect(mergeReady.criteria.prOpen).toBe(false);
    })
  );

  it.effect("preserves a coherent legacy blocked verdict while defaulting closeoutRun to false", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetVerdictJson.decode(
        verdictJsonWithMergeReady(
          '{"ready":false,"failing":"checks-green","criteria":{"checksGreen":false,"threadsResolved":true}}'
        )
      );
      const mergeReady = O.getOrThrow(decoded.mergeReady);

      expect(mergeReady.ready).toBe(false);
      assertSome(mergeReady.failing, "pr-open");
      expect(mergeReady.criteria.closeoutRun).toBe(false);
    })
  );

  it.effect("decodes a verdict carrying a coherent merge-ready record", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetVerdictJson.decode(
        verdictJsonWithMergeReady(
          '{"ready":false,"failing":"required-checks-green","criteria":{"prOpen":true,"notDraft":true,"closeoutRun":true,"requiredChecksGreen":false,"threadsResolved":true,"mergeable":true,"mergeStateAcceptable":true,"reviewDecisionAcceptable":true}}'
        )
      );

      assertSome(
        O.flatMap(decoded.mergeReady, (value) => value.failing),
        "required-checks-green"
      );
    })
  );

  it.effect("reads a verdict blocked only by the retired closeout-gates-passed criterion as ready", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetVerdictJson.decode(
        verdictJsonWithMergeReady(
          '{"ready":false,"failing":"closeout-gates-passed","criteria":{"prOpen":true,"notDraft":true,"closeoutRun":true,"requiredChecksGreen":true,"threadsResolved":true,"mergeable":true,"mergeStateAcceptable":true,"reviewDecisionAcceptable":true,"closeoutGatesPassed":false}}'
        )
      );
      const mergeReady = O.getOrThrow(decoded.mergeReady);

      assertTrue(mergeReady.ready);
      assertNone(mergeReady.failing);
    })
  );

  it.effect("keeps a real blocker on a verdict that also recorded a failed closeout gate", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetVerdictJson.decode(
        verdictJsonWithMergeReady(
          '{"ready":false,"failing":"threads-resolved","criteria":{"prOpen":true,"notDraft":true,"closeoutRun":true,"requiredChecksGreen":true,"threadsResolved":false,"mergeable":true,"mergeStateAcceptable":true,"reviewDecisionAcceptable":true,"closeoutGatesPassed":false}}'
        )
      );
      const mergeReady = O.getOrThrow(decoded.mergeReady);

      assertFalse(mergeReady.ready);
      assertSome(mergeReady.failing, "threads-resolved");
    })
  );

  it.effect("round-trips a current verdict byte-identically", () =>
    Effect.gen(function* () {
      const json = verdictJsonWithMergeReady(
        '{"ready":false,"failing":"required-checks-green","criteria":{"prOpen":true,"notDraft":true,"closeoutRun":true,"requiredChecksGreen":false,"threadsResolved":true,"mergeable":true,"mergeStateAcceptable":true,"reviewDecisionAcceptable":true}}'
      );
      const decoded = yield* YeetVerdictJson.decode(json);

      expect(yield* YeetVerdictJson.encode(decoded)).toBe(json);
    })
  );

  it.effect("rejects a verdict artifact whose merge-ready record contradicts itself", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        YeetVerdictJson.decode(
          verdictJsonWithMergeReady(
            '{"ready":true,"failing":"required-checks-green","criteria":{"prOpen":true,"notDraft":true,"closeoutRun":true,"requiredChecksGreen":false,"threadsResolved":true,"mergeable":true,"mergeStateAcceptable":true,"reviewDecisionAcceptable":true}}'
          )
        )
      );

      assertTrue(Exit.isFailure(exit));
    })
  );
});
