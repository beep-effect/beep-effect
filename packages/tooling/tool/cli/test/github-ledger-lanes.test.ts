import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  anchorsOf,
  BucketKey,
  BucketReading,
  GithubBudgetLedger,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerRow,
  GithubLedgerStore,
  HostLabel,
  hourOf,
  LedgerHourKey,
  LedgerHourRollup,
  LedgerHourRollupJson,
  LedgerRange,
  LedgerWindow,
  lanesOf,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreLive,
  makeGithubLedgerStoreMemory,
  ReserveState,
  reserveOf,
  SampleBucket,
  usableReadingOf,
  windowsOf,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { withLayer } from "./support/GithubLedgerFakes.ts";

const H = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-12T20:00:00.000Z"));
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const at = (offsetMillis: number) => DateTime.makeUnsafe(H + offsetMillis);
const host = HostLabel.make("hub");
const login = GithubIdentityLabel.make("user:alice");
const sampler = GithubLedgerCommandLabel.make("github sample");
const monitor = GithubLedgerCommandLabel.make("yeet monitor");
const graphqlKey = BucketKey.make({ identity: login, resource: "graphql" });
const coreKey = BucketKey.make({ identity: login, resource: "core" });

// Two credentials of one login: their GraphQL windows reset 62 s apart.
const RESET_A = 58 * MINUTE + 48 * SECOND;
const RESET_B = 59 * MINUTE + 50 * SECOND;

const graphqlRow = (options: {
  readonly at: number;
  readonly used: number;
  readonly reset: number;
  readonly command: GithubLedgerCommandLabel;
  readonly pid: number;
}) =>
  GithubLedgerRow.cases.Transport.make({
    at: at(options.at),
    host,
    command: options.command,
    identity: login,
    resource: "graphql",
    kind: "graphql",
    operation: "PullRequestThreads",
    status: 200,
    outcome: "ok",
    limit: 5000,
    remaining: 5000 - options.used,
    used: O.some(options.used),
    resetAt: at(options.reset),
    nominalCost: 1,
    pid: options.pid,
  });

const laneARow = (offset: number, used: number, reset: number) =>
  graphqlRow({ at: offset, used, reset, command: sampler, pid: 100 });
const laneBRow = (offset: number, used: number, reset: number) =>
  graphqlRow({ at: offset, used, reset, command: monitor, pid: 200 });

const graphqlSample = (offset: number, used: number) =>
  GithubLedgerRow.cases.Sample.make({
    at: at(offset),
    host,
    command: sampler,
    identity: login,
    trigger: "timer",
    selfCost: "confirmed-free",
    buckets: [
      SampleBucket.make({ resource: "graphql", limit: 5000, used, remaining: 5000 - used, resetAt: at(RESET_A) }),
    ],
  });

// The live 2026-11-12T20 interleaving: lane A rises 32..259, lane B 8..950, alternating 2 minutes apart.
const usedA = [32, 57, 82, 107, 132, 157, 182, 207, 232, 259];
const usedB = [8, 113, 218, 323, 428, 533, 638, 743, 848, 950];
const interleaved = A.flatMap(A.zip(usedA, usedB), ([a, b], index) => [
  laneARow((4 * index + 1) * MINUTE, a, RESET_A),
  laneBRow((4 * index + 3) * MINUTE, b, RESET_B),
]);
const spawn = GithubLedgerRow.cases.GhSpawn.make({
  at: at(20 * MINUTE),
  host,
  command: monitor,
  identity: login,
  subcommand: "pr view",
  resource: "graphql",
  exitCode: 0,
  durationMillis: 10,
});

const usedOf = (row: (typeof interleaved)[number]) => 5000 - row.remaining;
const isCrossing = (window: LedgerWindow) => window.crossesReset;
const fleetOf = (hour: LedgerHourKey) => [hour.fleetUsed, hour.fleetUsedIsLowerBound] as const;

describe("GithubLedger lanes", () => {
  it("telescopes two interleaved credentials of one login per lane instead of reading each switch as a reset", () => {
    const rows = A.append(interleaved, spawn);
    const lanes = lanesOf(anchorsOf({ key: graphqlKey, rows, admitGraphqlSamples: false }));
    expect(A.map(lanes, A.length)).toStrictEqual([10, 10]);
    const windows = windowsOf({ key: graphqlKey, rows, admitGraphqlSamples: false });
    expect(A.map(windows, (window) => window.lane)).toStrictEqual(A.flatMap(A.range(1, 9), () => [0, 1]));
    assertFalse(A.some(windows, isCrossing));
    expect(Num.sumAll(A.map(windows, (window) => window.resetLowerBound))).toBe(0);
    const hour = hourOf({ hour: at(0), key: graphqlKey, rows, windows, costs: [] });
    // Each lane's in-hour rise: 259 − 32 on lane A, 950 − 8 on lane B.
    deepStrictEqual(fleetOf(hour), [O.some(227 + 942), false]);
    // Pairing the merged stream made each of its 19 switches a reset worth used(to).
    const inflated = Num.sumAll(A.map(A.drop(interleaved, 1), usedOf));
    expect(inflated).toBe(6217);
    assertFalse(O.exists(hour.fleetUsed, (used) => used === inflated));
    // The lanes' windows overlap, yet each row counts once: 19 transports and one spawn are covered.
    expect([hour.attributedNominal, hour.ghSpawns, hour.estimatedPoints, hour.ghEstimated]).toStrictEqual([
      19, 1, 20, 1,
    ]);
    assertSome(hour.unattributed, 1169 - 20 - 1);
  });

  it("joins the sampler's calibrated samples to the lane whose reset they share", () => {
    const rows = A.appendAll(
      [graphqlSample(30 * SECOND, 4)],
      A.append(interleaved, graphqlSample(39 * MINUTE + 30 * SECOND, 271))
    );
    const windows = windowsOf({ key: graphqlKey, rows, admitGraphqlSamples: true });
    const hour = hourOf({ hour: at(0), key: graphqlKey, rows, windows, costs: [] });
    // Lane A now runs 4..271 and lane B 8..950: about the 1,200 points the bucket really used.
    deepStrictEqual(fleetOf(hour), [O.some(267 + 942), false]);
  });

  it("adds a lane's real mid-hour reset once, alongside a concurrent lane", () => {
    const postReset = 95 * MINUTE + 30 * SECOND;
    const rows = [
      laneARow(2 * MINUTE, 100, 30 * MINUTE),
      laneBRow(5 * MINUTE, 300, RESET_B),
      laneARow(10 * MINUTE, 150, 30 * MINUTE),
      laneBRow(15 * MINUTE, 400, RESET_B),
      laneARow(18 * MINUTE, 230, 30 * MINUTE),
      // A lagging process reports a lower count; the peak still bounds the crossing.
      laneARow(20 * MINUTE, 200, 30 * MINUTE),
      laneBRow(25 * MINUTE, 450, RESET_B),
      laneARow(36 * MINUTE, 40, postReset),
      laneBRow(40 * MINUTE, 500, RESET_B),
      laneARow(46 * MINUTE, 90, postReset),
      laneBRow(50 * MINUTE, 600, RESET_B),
    ];
    const lanes = lanesOf(anchorsOf({ key: graphqlKey, rows, admitGraphqlSamples: false }));
    expect(A.map(lanes, A.length)).toStrictEqual([6, 5]);
    const windows = windowsOf({ key: graphqlKey, rows, admitGraphqlSamples: false });
    const crossing = A.filter(windows, isCrossing);
    expect(A.map(crossing, (window) => [window.lane, window.resetLowerBound])).toStrictEqual([[0, 40 + 30]]);
    const hour = hourOf({ hour: at(0), key: graphqlKey, rows, windows, costs: [] });
    // Lane A: 230 − 100 − 30 = 100 before the reset, 70 across it, 50 after; lane B: 600 − 300.
    deepStrictEqual(fleetOf(hour), [O.some(100 + 70 + 50 + 300), true]);
  });

  it("orders windows that end at the same instant by lane", () => {
    const rows = [
      laneBRow(MINUTE, 8, RESET_B),
      laneARow(2 * MINUTE, 32, RESET_A),
      laneARow(3 * MINUTE, 57, RESET_A),
      laneBRow(3 * MINUTE, 113, RESET_B),
    ];
    const windows = windowsOf({ key: graphqlKey, rows, admitGraphqlSamples: false });
    expect(
      A.map(windows, (window) => [window.lane, DateTime.toEpochMillis(window.to) - H, window.delta])
    ).toStrictEqual([
      [0, 3 * MINUTE, 105],
      [1, 3 * MINUTE, 25],
    ]);
  });
});

const NOW = H + 30 * MINUTE;

const reading = (options: {
  readonly key: BucketKey;
  readonly remaining: number;
  readonly minutesAgo: number;
  readonly reset: number;
  readonly basis: "transport" | "sample";
}) =>
  BucketReading.make({
    key: options.key,
    limit: 5000,
    remaining: options.remaining,
    used: O.some(5000 - options.remaining),
    resetAt: at(options.reset),
    asOf: DateTime.makeUnsafe(NOW - options.minutesAgo * MINUTE),
    basis: options.basis,
  });

const graphqlReading = (remaining: number, minutesAgo: number, reset: number) =>
  reading({ key: graphqlKey, remaining, minutesAgo, reset, basis: "transport" });

const judge = reserveOf({ now: DateTime.makeUnsafe(NOW), admitGraphqlSamples: false });
const usable = usableReadingOf({ now: DateTime.makeUnsafe(NOW), admitGraphqlSamples: false });

describe("GithubLedger reserve over concurrent lanes", () => {
  it("signals on the more depleted of two live lanes, each judged on its newest reading", () => {
    // Lane A's older 100 is superseded by its newer 4000; lane B is the more depleted bucket.
    const laneAOld = graphqlReading(100, 6, RESET_A);
    const laneANew = graphqlReading(4000, 1, RESET_A + 2 * SECOND);
    const laneB = graphqlReading(900, 3, RESET_B);
    const readings = [laneAOld, laneANew, laneB];
    deepStrictEqual(
      judge(graphqlKey, readings).state,
      ReserveState.cases.Clear.make({
        remaining: 900,
        limit: 5000,
        floor: 750,
        resetAt: at(RESET_B),
        asOf: laneB.asOf,
        basis: "transport",
      })
    );
    // The bucket's numbers come from the reading the verdict rests on.
    assertSome(usable(graphqlKey, readings), laneB);
    const belowB = graphqlReading(600, 3, RESET_B);
    expect(judge(graphqlKey, [laneANew, belowB]).state._tag).toBe("Below");
  });

  it("falls back to the newest reading when no reading is both fresh and live", () => {
    const stale = [graphqlReading(4000, 11, RESET_A), graphqlReading(100, 12, RESET_B)];
    deepStrictEqual(
      judge(graphqlKey, stale).state,
      ReserveState.cases.Unknown.make({ reason: "stale", asOf: O.some(DateTime.makeUnsafe(NOW - 11 * MINUTE)) })
    );
    // A fresh reading of a window that has reset, beside a stale reading of a live one.
    const reset = [graphqlReading(4000, 1, 29 * MINUTE), graphqlReading(100, 11, RESET_B)];
    deepStrictEqual(
      judge(graphqlKey, reset).state,
      ReserveState.cases.Unknown.make({ reason: "window-reset", asOf: O.some(DateTime.makeUnsafe(NOW - MINUTE)) })
    );
  });

  it.effect("agrees between the ledger's reserve and its usable reading for a key read by two credentials", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const store = yield* makeGithubLedgerStoreMemory;
      // Credential A's /rate_limit sample and credential B's transport reading of the same core key.
      yield* store.writeLatestSample(
        GithubLedgerRow.cases.Sample.make({
          at: DateTime.makeUnsafe(NOW - MINUTE),
          host,
          command: sampler,
          identity: login,
          trigger: "timer",
          selfCost: "confirmed-free",
          buckets: [
            SampleBucket.make({ resource: "core", limit: 5000, used: 1000, remaining: 4000, resetAt: at(RESET_A) }),
          ],
        })
      );
      const depleted = reading({ key: coreKey, remaining: 600, minutesAgo: 2, reset: RESET_B, basis: "transport" });
      yield* store.writeLatestTransport(depleted);
      const [signal, judged] = yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const reserve = yield* ledger.reserve(coreKey);
        const latestUsable = yield* ledger.latestUsable(coreKey);
        return [reserve, latestUsable] as const;
      }).pipe(
        withLayer(layerGithubBudgetLedger({ host }).pipe(Layer.provide(Layer.succeed(GithubLedgerStore, store))))
      );
      expect(signal.state._tag).toBe("Below");
      assertSome(judged, depleted);
    })
  );
});

const STATE_ROOT = "/state";
const liveLedger = layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreLive));
const withStateRoot = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({ BEEP_GITHUB_LEDGER_STATE_ROOT: STATE_ROOT })
);

// The inflated hour as the version-1 code stored it, in the version-1 window shape (no lane).
const inflatedRollupText = Effect.gen(function* () {
  const rollup = LedgerHourRollup.make({
    hour: at(0),
    host,
    complete: true,
    cells: [],
    keys: [
      LedgerHourKey.make({
        key: graphqlKey,
        fleetUsed: O.some(10_347),
        fleetUsedIsLowerBound: true,
        anchor: "transport",
        attributedNominal: 20,
        estimatedPoints: 20,
        ghSpawns: 0,
        ghEstimated: 0,
        unattributed: O.some(10_327),
        overAttributed: false,
        byCommand: [],
      }),
    ],
    operationCosts: [],
    windows: [
      LedgerWindow.make({
        key: graphqlKey,
        lane: 0,
        from: at(MINUTE),
        to: at(3 * MINUTE),
        anchor: "transport",
        sameEpoch: false,
        delta: 0,
        crossesReset: true,
        resetLowerBound: 113,
        attributedNominal: 1,
        ghSpawns: 0,
      }),
    ],
  });
  const text = yield* S.encodeEffect(LedgerHourRollupJson)(rollup);
  return pipe(
    text,
    Str.replace('"github-ledger-rollup/v2"', '"github-ledger-rollup/v1"'),
    Str.replaceAll(/"lane":\d+,/g, "")
  );
});

const fleetUsedOf = (rollups: ReadonlyArray<LedgerHourRollup>) =>
  A.flatMap(rollups, (rollup) => A.map(rollup.keys, (hour) => [rollup.complete, hour.fleetUsed] as const));

describe("GithubLedger rollup versions", () => {
  it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
    it.effect("recomputes an hour whose stored rollup is an older version instead of trusting it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const file = `${STATE_ROOT}/rollups/2026-11-12T20.json`;
        const v1 = yield* inflatedRollupText;
        assertTrue(Str.includes('"github-ledger-rollup/v1"')(v1));
        assertNone(S.decodeOption(LedgerHourRollupJson)(v1));
        yield* fs.makeDirectory(`${STATE_ROOT}/rollups`, { recursive: true });
        yield* fs.writeFileString(file, v1);
        yield* TestClock.setTime(H + 2 * HOUR);
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const ledger = yield* GithubBudgetLedger;
          // Each lane's first reading after its reset ripens the hour.
          const later = [
            laneARow(HOUR + 5 * MINUTE, 3, HOUR + RESET_A),
            laneBRow(HOUR + 6 * MINUTE, 5, HOUR + RESET_B),
          ];
          yield* Effect.forEach(A.appendAll(interleaved, later), store.append, { discard: true });
          const stored = yield* store.readRollup(at(0));
          assertNone(stored);
          const read = yield* ledger.hours(LedgerRange.make({ from: at(0), to: at(30 * MINUTE) }));
          deepStrictEqual(fleetUsedOf(read), [[false, O.some(1169)]]);
          yield* ledger.prune;
          const rewritten = yield* fs.readFileString(file);
          assertTrue(Str.includes('"github-ledger-rollup/v2"')(rewritten));
          const kept = yield* store.readRollup(at(0));
          deepStrictEqual(kept.pipe(A.fromOption, fleetUsedOf), [[true, O.some(1169)]]);
        }).pipe(withLayer(liveLedger), withStateRoot);
      })
    );
  });
});
