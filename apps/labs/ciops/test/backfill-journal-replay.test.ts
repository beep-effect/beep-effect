import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  arrivalsFromJournal,
  decodeJournalLines,
  deployedReplayTiming,
  replayTailWaits,
  summarizeWaits,
} from "@/backfill/JournalReplay";
import { ReplayArmSpec, ReplayEtaEstimator } from "@/backfill/Schemas";
import { PosInt } from "@/projection/PosInt";
import { AdmissionJournalEvent } from "@/projection/Schemas";

const decodeRow = S.decodeUnknownEffect(AdmissionJournalEvent);
const decodeAll = (rows: ReadonlyArray<unknown>) => Effect.forEach(rows, (row) => decodeRow(row), { concurrency: 1 });

interface ChainSeed {
  readonly admittedAt: number;
  readonly checkout?: string;
  readonly enqueuedAt: number;
  readonly kind?: "full-proof" | "merged-preview" | "review-fix";
  readonly nonce: string;
  readonly origin?: string;
  readonly releasedAt: number;
  readonly weight?: number;
}

const chainRows = (seed: ChainSeed): ReadonlyArray<unknown> => {
  const kind = seed.kind ?? "full-proof";
  const checkout = seed.checkout ?? `/repo/${seed.nonce}`;
  const weightTokens = seed.weight ?? 3;
  const originKey = seed.origin ?? "origin-alice";
  return [
    {
      _tag: "admission-enqueued",
      schemaVersion: "yeet-admission-journal/v3",
      nonce: seed.nonce,
      pid: 7,
      procStart: "7",
      kind,
      priority: "verify",
      originKey,
      checkoutRoot: checkout,
      branch: "feat/alice",
      enqueuedAtMillis: seed.enqueuedAt,
      weightTokens,
    },
    {
      _tag: "admission-admitted",
      schemaVersion: "yeet-admission-journal/v1",
      nonce: seed.nonce,
      pid: 7,
      procStart: "7",
      kind,
      weightTokens,
      priority: "verify",
      originKey,
      enqueuedAtMillis: seed.enqueuedAt,
      admittedAtMillis: seed.admittedAt,
    },
    {
      _tag: "admission-released",
      schemaVersion: "yeet-admission-journal/v3",
      nonce: seed.nonce,
      pid: 7,
      releasedAtMillis: seed.releasedAt,
      checkoutRoot: checkout,
      branch: "feat/alice",
    },
  ];
};

const estimator = ReplayEtaEstimator.make({
  quantilePermille: PosInt.make(900),
  minSamples: PosInt.make(2),
  historyLimit: PosInt.make(200),
});

const arm = (capacity: number, backfill: "off" | "easy", fairness: "off" | "origin-checkout" = "off") =>
  ReplayArmSpec.make({ capacityTokens: PosInt.make(capacity), backfill, fairness });

describe("SCHE-06 journal replay", () => {
  it("summarizes waits by nearest rank", () => {
    const summary = summarizeWaits([0, 1_000, 2_000, 3_000, 90_000]);
    deepStrictEqual(
      [summary.count, summary.p50Millis, summary.p90Millis, summary.maxMillis, summary.meanMillis, summary.overMinute],
      [5, 2_000, 90_000, 90_000, 19_200, 1]
    );
    strictEqual(summarizeWaits([]).meanMillis, 0);
  });

  it.effect("joins chains, rebases them, skips incomplete nonces and declares ETAs only from earlier releases", () =>
    Effect.gen(function* () {
      const withdrawn = {
        _tag: "admission-withdrawn",
        schemaVersion: "yeet-admission-journal/v3",
        nonce: "gone",
        pid: 7,
        procStart: "7",
        kind: "full-proof",
        priority: "verify",
        originKey: "origin-ada",
        checkoutRoot: "/repo/gone",
        branch: "feat/ada",
        enqueuedAtMillis: 1_000,
        withdrawnAtMillis: 2_000,
      };
      const legacyAdmitted = {
        _tag: "admission-admitted",
        schemaVersion: "yeet-admission-journal/v1",
        nonce: "legacy",
        pid: 7,
        procStart: "7",
        kind: "review-fix",
        weightTokens: 1,
        priority: "publish",
        originKey: "origin-another",
        enqueuedAtMillis: 50_000,
        admittedAtMillis: 50_000,
      };
      const legacyReleased = {
        _tag: "admission-released",
        schemaVersion: "yeet-admission-journal/v1",
        nonce: "legacy",
        releasedAtMillis: 50_000,
      };
      const events = yield* decodeAll([
        ...chainRows({ nonce: "a", enqueuedAt: 10_000, admittedAt: 10_000, releasedAt: 20_000 }),
        ...chainRows({ nonce: "b", enqueuedAt: 15_000, admittedAt: 15_000, releasedAt: 45_000 }),
        ...chainRows({ nonce: "c", enqueuedAt: 46_000, admittedAt: 47_000, releasedAt: 50_000 }),
        ...chainRows({ nonce: "d", enqueuedAt: 30_000, admittedAt: 31_000, releasedAt: 60_000 }),
        withdrawn,
        legacyAdmitted,
        legacyReleased,
      ]);
      const stream = arrivalsFromJournal(estimator)(events);
      deepStrictEqual(
        A.map(stream.arrivals, (arrival) => [arrival.nonce, arrival.enqueuedAtMillis, arrival.holdMillis]),
        [
          ["a", 0, 10_000],
          ["b", 5_000, 30_000],
          ["d", 20_000, 29_000],
          ["c", 36_000, 3_000],
          ["legacy", 40_000, 1],
        ]
      );

      const singleReleasedSampleEta = A.getUnsafe(stream.arrivals, 2).etaMillis;
      assertNone(singleReleasedSampleEta);
      const twoReleasedSamplesP90 = A.getUnsafe(stream.arrivals, 3).etaMillis;
      assertSome(twoReleasedSamplesP90, 30_000);
      strictEqual(A.getUnsafe(stream.arrivals, 4).checkoutKey, "legacy");
      deepStrictEqual([stream.skipped, stream.spanMillis], [1, 40_000]);
      deepStrictEqual(stream.recordedWaits, [0, 0, 1_000, 1_000, 0]);
      deepStrictEqual(arrivalsFromJournal([], estimator).arrivals, []);

      const twinRows = yield* decodeAll([
        ...chainRows({ nonce: "twin-b", enqueuedAt: 5, admittedAt: 5, releasedAt: 6 }),
        ...chainRows({ nonce: "twin-a", enqueuedAt: 5, admittedAt: 5, releasedAt: 6 }),
      ]);
      const nonceOrderedTwins = arrivalsFromJournal(twinRows, estimator);
      deepStrictEqual(
        A.map(nonceOrderedTwins.arrivals, (arrival) => arrival.nonce),
        ["twin-a", "twin-b"]
      );
    })
  );

  it.effect("finds the tail-wait gain backfill gives a mixed stream and none on a uniform one", () =>
    Effect.gen(function* () {
      const recordedHoldWarmup = A.flatMap(
        A.makeBy(3, (index) => index),
        (index) => [
          ...chainRows({
            nonce: `proof-${index}`,
            kind: "full-proof",
            weight: 9,
            enqueuedAt: index * 1_000_000 + 500_000,
            admittedAt: index * 1_000_000 + 500_000,
            releasedAt: index * 1_000_000 + 700_000,
          }),
          ...chainRows({
            nonce: `wide-${index}`,
            kind: "merged-preview",
            weight: 10,
            enqueuedAt: index * 1_000_000,
            admittedAt: index * 1_000_000,
            releasedAt: index * 1_000_000 + 300_000,
          }),
          ...chainRows({
            nonce: `fix-${index}`,
            kind: "review-fix",
            weight: 1,
            enqueuedAt: index * 1_000_000 + 400_000,
            admittedAt: index * 1_000_000 + 400_000,
            releasedAt: index * 1_000_000 + 410_000,
          }),
        ]
      );

      const t = 10_000_000;
      const burst = [
        ...chainRows({
          nonce: "hold",
          kind: "full-proof",
          weight: 9,
          enqueuedAt: t,
          admittedAt: t,
          releasedAt: t + 200_000,
        }),
        ...chainRows({
          nonce: "head",
          kind: "merged-preview",
          weight: 10,
          enqueuedAt: t + 1_000,
          admittedAt: t + 200_000,
          releasedAt: t + 500_000,
        }),
        ...chainRows({
          nonce: "fix",
          kind: "review-fix",
          weight: 1,
          enqueuedAt: t + 2_000,
          admittedAt: t + 500_000,
          releasedAt: t + 510_000,
        }),
      ];
      const mixed = yield* decodeAll([...recordedHoldWarmup, ...burst]);
      const report = yield* replayTailWaits(mixed, estimator, [arm(10, "off"), arm(10, "easy")]);
      const [off, easy] = report.arms;
      strictEqual(report.chains, 12);
      strictEqual(off?.backfills, 0);
      strictEqual(easy?.backfills, 1);
      deepStrictEqual([off?.waits.maxMillis, easy?.waits.maxMillis], [498_000, 199_000]);

      const threeTokenUniformStream = A.flatMap(
        A.makeBy(6, (index) => index),
        (index) =>
          chainRows({
            nonce: `u-${index}`,
            enqueuedAt: index * 60_000,
            admittedAt: index * 60_000,
            releasedAt: index * 60_000 + 120_000,
          })
      );
      const uniformRows = yield* decodeAll(threeTokenUniformStream);
      const flat = yield* replayTailWaits(
        uniformRows,
        estimator,
        [arm(3, "off"), arm(3, "easy", "origin-checkout")],
        deployedReplayTiming
      );
      deepStrictEqual(
        A.map(flat.arms, (result) => [result.backfills, result.waits]),
        A.map(flat.arms, () => [0, A.getUnsafe(flat.arms, 0).waits])
      );
      strictEqual(flat.etaDeclared, 3);
      expect(A.getUnsafe(flat.arms, 0).waits.maxMillis).toBeGreaterThan(0);
    })
  );

  it.effect("skips routed rows, torn tails and unknown tags, and refuses a replay row that does not decode", () =>
    Effect.gen(function* () {
      const released =
        '{"checkoutRoot":"/repo/alice","branch":"feat/alice","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"a","pid":7,"releasedAtMillis":20}';
      const routed =
        '{"_tag":"admission-routed","schemaVersion":"yeet-admission-journal/v3","nonce":"r","pid":7,"procStart":"7","routedAtMillis":5,"checkoutRoot":"/repo/alice","branch":"feat/alice","command":"bun run beep yeet final-check","computeProfile":"worker","outcome":"refusal"}';
      const read = yield* decodeJournalLines([
        released,
        routed,
        '{"_tag":"admission-adm',
        '{"_tag":"admission-future","nonce":"f"}',
      ]);
      deepStrictEqual([A.map(read.events, (event) => event.nonce), read.opaqueLines], [["a"], 3]);
      const drift = yield* Effect.exit(
        decodeJournalLines([
          released,
          '{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v9","nonce":"x"}',
        ])
      );
      strictEqual(drift._tag, "Failure");
    })
  );
});
