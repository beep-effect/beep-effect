import { YeetMergeReady, YeetMergeReadyCriteria, YeetVerdictJson } from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeMergeReady = S.decodeUnknownEffect(YeetMergeReady);

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
        failing: "checks-green",
        criteria: { closeoutRun: true, checksGreen: false, threadsResolved: true },
      });

      expect(decoded.ready).toBe(false);
      expect(decoded.failing).toStrictEqual(O.some("checks-green"));
    })
  );

  it.effect("decodes a ready record naming no criterion with all criteria satisfied", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeMergeReady({
        ready: true,
        criteria: { closeoutRun: true, checksGreen: true, threadsResolved: true, greptileScore: "5/5" },
      });

      expect(decoded.ready).toBe(true);
      expect(decoded.failing).toStrictEqual(O.none());
      expect(decoded.criteria.greptileScore).toStrictEqual(O.some("5/5"));
    })
  );

  // The exact document the review named: `ready` and `failing` are an answer and
  // its own refutation, and whichever field a reader trusted decided the merge.
  it.effect("rejects a record that is ready and also names a blocking criterion", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: true,
          failing: "checks-green",
          criteria: { closeoutRun: true, checksGreen: false, threadsResolved: true },
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("rejects a record blocked on a criterion its own criteria report as satisfied", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: false,
          failing: "threads-resolved",
          criteria: { closeoutRun: true, checksGreen: true, threadsResolved: true },
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("rejects a not-ready record that names no blocking criterion", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: false,
          criteria: { closeoutRun: true, checksGreen: true, threadsResolved: true },
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("rejects a ready record whose criteria are not all satisfied", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeMergeReady({
          ready: true,
          criteria: { closeoutRun: true, checksGreen: true, threadsResolved: false },
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it("keeps the coherent constructor path working", () => {
    const mergeReady = YeetMergeReady.make({
      ready: false,
      failing: O.some("threads-resolved"),
      criteria: YeetMergeReadyCriteria.make({ closeoutRun: true, checksGreen: true, threadsResolved: false }),
    });

    expect(mergeReady.failing).toStrictEqual(O.some("threads-resolved"));
  });
});

describe("YeetVerdictJson merge-readiness coherence", () => {
  it.effect("decodes a verdict carrying a coherent merge-ready record", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetVerdictJson.decode(
        verdictJsonWithMergeReady(
          '{"ready":false,"failing":"checks-green","criteria":{"closeoutRun":true,"checksGreen":false,"threadsResolved":true}}'
        )
      );

      expect(O.flatMap(decoded.mergeReady, (value) => value.failing)).toStrictEqual(O.some("checks-green"));
    })
  );

  it.effect("rejects a verdict artifact whose merge-ready record contradicts itself", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        YeetVerdictJson.decode(
          verdictJsonWithMergeReady(
            '{"ready":true,"failing":"checks-green","criteria":{"closeoutRun":true,"checksGreen":false,"threadsResolved":true}}'
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});
