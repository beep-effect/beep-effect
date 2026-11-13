import { CredentialFingerprint, RateLimitObservation, RateLimitSnapshot } from "@beep/github/Resilience";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { renderGithubLedgerHour } from "@beep/repo-cli/commands/Github";
import {
  anchorsOf,
  BucketKey,
  BucketReading,
  CommandSpend,
  GhSpawnObservation,
  GithubBudgetLedger,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerRow,
  GithubLedgerStore,
  HostLabel,
  hourOf,
  LedgerHourCell,
  LedgerHourKey,
  LedgerHourRollup,
  LedgerHourRollupJson,
  LedgerRange,
  LedgerSummary,
  LedgerSummaryJson,
  LedgerWindow,
  LegacyLedgerHour,
  lanesOf,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreLive,
  makeGithubLedgerStoreMemory,
  normalizeOperation,
  operationCostsOf,
  ReserveState,
  readingOfTransport,
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
import type { LedgerHourResult, LedgerRollupRead } from "@beep/repo-cli/test/SharedInternals";

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
    deepStrictEqual(fleetOf(hour), [O.some(227 + 942), true]);
    // Pairing the merged stream made each of its 19 switches a reset worth used(to).
    const inflated = Num.sumAll(A.map(A.drop(interleaved, 1), usedOf));
    expect(inflated).toBe(6217);
    assertFalse(O.exists(hour.fleetUsed, (used) => used === inflated));
    // The lanes' windows overlap, yet each row counts once: 19 transports and one spawn are covered.
    expect([hour.attributedNominal, hour.ghSpawns, hour.estimatedPoints, hour.ghEstimated]).toStrictEqual([
      20, 1, 20, 1,
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
    deepStrictEqual(fleetOf(hour), [O.some(267 + 942), true]);
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
    const knownRows = A.map(rows, fingerprintedRow);
    const lanes = lanesOf(anchorsOf({ key: graphqlKey, rows: knownRows, admitGraphqlSamples: false }));
    expect(A.map(lanes, A.length)).toStrictEqual([6, 5]);
    const windows = windowsOf({ key: graphqlKey, rows: knownRows, admitGraphqlSamples: false });
    const crossing = A.filter(windows, isCrossing);
    expect(A.map(crossing, (window) => [window.lane, window.resetLowerBound])).toStrictEqual([[0, 40 + 30]]);
    const hour = hourOf({ hour: at(0), key: graphqlKey, rows: knownRows, windows, costs: [] });
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
    source: options.reset < 59 * MINUTE ? "pid:100" : "pid:200",
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

const isLegacyHour = S.is(LegacyLedgerHour);
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
    cells: [
      LedgerHourCell.make({
        identity: login,
        resource: "graphql",
        command: monitor,
        source: "transport",
        requests: 7,
        nominal: 7,
        rateLimited: 0,
      }),
    ],
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
        byCommand: [CommandSpend.make({ command: monitor, requests: 7, nominal: 7, estimatedPoints: 10, ghSpawns: 2 })],
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

const fleetUsedOf = (rollups: ReadonlyArray<LedgerHourResult | LedgerRollupRead>) =>
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
          assertTrue(O.exists(stored, (rollup) => rollup.schemaVersion === "github-ledger-rollup/v1"));
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

// Independent review reproductions. Fingerprints are supplied by the fixture
// when one process changes tokens; older rows exercise the PID fallback above.
const tokenA = CredentialFingerprint.make("aaaaaaaaaaaa");
const tokenB = CredentialFingerprint.make("bbbbbbbbbbbb");
const fingerprintedRow = (row: ReturnType<typeof graphqlRow>) =>
  GithubLedgerRow.cases.Transport.make({
    ...row,
    credential: O.some(row.pid === 100 ? tokenA : tokenB),
  });

const observed = (minute: number, used: number, reset: number, credential: CredentialFingerprint) => ({
  ...graphqlRow({ at: minute * MINUTE, used, reset, command: monitor, pid: 42 }),
  credential: O.some(credential),
});
const calculated = (rows: ReadonlyArray<GithubLedgerRow>, offset = 0) =>
  hourOf({
    hour: at(offset),
    key: graphqlKey,
    rows,
    windows: windowsOf({ key: graphqlKey, rows, admitGraphqlSamples: false }),
    costs: operationCostsOf(rows),
  });

describe("GithubLedger independent review regressions", () => {
  it("R1 never assigns a busy credential the idle credential's baseline", () => {
    const rows = [
      observed(1, 0, 61 * MINUTE, tokenA),
      observed(2, 1001, 50 * MINUTE, tokenB),
      observed(3, 0, 63 * MINUTE, tokenA),
      observed(4, 1002, 50 * MINUTE, tokenB),
    ];
    assertSome(calculated(rows).fleetUsed, 1);
    assertTrue(calculated(rows).fleetUsedIsLowerBound);
  });

  it("R3 gives every transport and spawn exactly one timestamp hour", () => {
    const rows = [
      observed(58, 10, 90 * MINUTE, tokenA),
      observed(58.5, 20, 91 * MINUTE, tokenB),
      observed(59, 15, 90 * MINUTE, tokenA),
      observed(59.5, 20, 90 * MINUTE, tokenA),
      observed(61, 30, 91 * MINUTE, tokenB),
      { ...spawn, at: at(59.25 * MINUTE) },
    ];
    const first = calculated(rows);
    const second = calculated(rows, HOUR);
    deepStrictEqual([first.attributedNominal, second.attributedNominal, first.ghSpawns, second.ghSpawns], [4, 1, 1, 0]);
    assertSome(first.fleetUsed, 40);
    assertSome(second.fleetUsed, 10);
  });

  it.effect("R4 retains both depleted and healthy credentials through the memory store and service", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(H + 10 * MINUTE);
      const store = yield* makeGithubLedgerStoreMemory;
      const a = readingOfTransport(observed(8, 4900, 40 * MINUTE, tokenA));
      const b = readingOfTransport(observed(9, 1000, 41 * MINUTE, tokenB));
      yield* store.writeLatestTransport(a);
      yield* store.writeLatestTransport(b);
      const latest = yield* store.latestTransport;
      expect(A.length(latest)).toBe(2);
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const signal = yield* ledger.reserve(graphqlKey);
        expect(signal.state._tag).toBe("Below");
        const usable = yield* ledger.latestUsable(graphqlKey);
        assertSome(usable, a);
      }).pipe(
        withLayer(layerGithubBudgetLedger({ host }).pipe(Layer.provide(Layer.succeed(GithubLedgerStore, store))))
      );
    })
  );

  it("R6 pairs operation costs only within a process credential and reset epoch", () => {
    const rows = [
      { ...observed(1, 0, 61 * MINUTE, tokenA), operation: normalizeOperation("Idle") },
      { ...observed(2, 1001, 50 * MINUTE, tokenB), operation: normalizeOperation("Query") },
      { ...observed(3, 0, 63 * MINUTE, tokenA), operation: normalizeOperation("Idle") },
      { ...observed(4, 1002, 50 * MINUTE, tokenB), operation: normalizeOperation("Query") },
      { ...observed(5, 0, 65 * MINUTE, tokenA), operation: normalizeOperation("Idle") },
      { ...observed(6, 1003, 50 * MINUTE, tokenB), operation: normalizeOperation("Query") },
    ];
    expect(A.map(operationCostsOf(rows), (cost) => [cost.points, cost.observations])).toStrictEqual([
      [1, 0],
      [1, 2],
    ]);
    expect(calculated(rows).estimatedPoints).toBe(6);
    const idleCross = [observed(1, 0, 61 * MINUTE, tokenA), observed(2, 1001, 50 * MINUTE, tokenA)];
    expect(A.map(operationCostsOf(idleCross), (cost) => cost.observations)).toStrictEqual([0]);
  });
});

it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("R7 invalidates a persisted v1 summary before serving derived usage", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const summary = LedgerSummary.make({
        generatedAt: at(0),
        lastRowAt: O.none(),
        spenders: [],
        unattributedLastHour: [{ key: graphqlKey, unattributed: O.some(10327) }],
      });
      const text = yield* S.encodeEffect(LedgerSummaryJson)(summary);
      yield* fs.makeDirectory(`${STATE_ROOT}/latest`, { recursive: true });
      yield* fs.writeFileString(
        `${STATE_ROOT}/latest/summary.json`,
        Str.replace("github-ledger-summary/v2", "github-ledger-summary/v1")(text)
      );
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const value = yield* ledger.summary;
        assertNone(value);
      }).pipe(withLayer(liveLedger), withStateRoot);
    })
  );

  it.effect("R8 preserves an expired raw hour as explicit legacy unknown usage", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const text = yield* inflatedRollupText;
      yield* fs.makeDirectory(`${STATE_ROOT}/rollups`, { recursive: true });
      yield* fs.writeFileString(`${STATE_ROOT}/rollups/2026-11-12T20.json`, text);
      yield* TestClock.setTime(H + 96 * HOUR);
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const hours = yield* ledger.hours(LedgerRange.make({ from: at(0), to: at(MINUTE) }));
        const legacy = O.getOrThrow(A.findFirst(hours, isLegacyHour));
        expect(legacy.schemaVersion).toBe("github-ledger-rollup/v1");
        const keys = legacy.keys;
        const bucket = O.getOrThrow(A.head(keys));
        assertNone(bucket.fleetUsed);
        assertNone(bucket.unattributed);
        assertNone(bucket.ghEstimated);
        expect([bucket.estimatedPoints, bucket.attributedNominal]).toStrictEqual([null, null]);
        assertFalse(bucket.overAttributed);
        assertTrue(A.some(renderGithubLedgerHour(legacy), Str.includes("legacy-unrecomputable")));
        yield* ledger.prune;
        const retained = yield* ledger.hours(LedgerRange.make({ from: at(0), to: at(MINUTE) }));
        expect(A.map(retained, (hour) => hour.schemaVersion)).toStrictEqual(["github-ledger-rollup/v1"]);
      }).pipe(withLayer(liveLedger), withStateRoot);
    })
  );
});

it.effect(
  "reads completed current hours directly and fingerprints each spawn without caching environment changes",
  () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      const rollup = LedgerHourRollup.make({
        hour: at(0),
        host,
        complete: true,
        cells: [],
        keys: [],
        operationCosts: [],
        windows: [],
      });
      yield* store.writeRollup(rollup);
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const hours = yield* ledger.hours(LedgerRange.make({ from: at(0), to: at(MINUTE) }));
        deepStrictEqual(hours, [rollup]);
        yield* ledger.recordSpawn(
          GhSpawnObservation.make({ args: ["pr", "view"], at: at(0), exitCode: 0, durationMillis: 1 })
        );
        const rows = yield* store.rows(LedgerRange.make({ from: at(-MINUTE), to: at(MINUTE) }));
        const spawnRows = A.filter(rows, GithubLedgerRow.guards.GhSpawn);
        deepStrictEqual(
          A.map(spawnRows, (row) => row.credential),
          [O.some(tokenA)]
        );
        yield* ledger.recordTransport(
          RateLimitObservation.make({
            snapshot: RateLimitSnapshot.make({ remaining: 100, limit: 5000, resetEpochSeconds: 1800000000 }),
            budgetLabel: O.some("app:1/2"),
            credential: "token",
            fingerprint: O.some(tokenA),
            operation: "GET /repos",
            kind: "rest",
            status: 200,
            outcome: "ok",
            at: at(0),
          })
        );
        yield* ledger.recordTransport(
          RateLimitObservation.make({
            snapshot: RateLimitSnapshot.make({ remaining: 100, limit: 5000, resetEpochSeconds: 1800000000 }),
            budgetLabel: O.none(),
            credential: "unauthenticated",
            fingerprint: O.some(tokenA),
            operation: "GET /repos",
            kind: "rest",
            status: 200,
            outcome: "ok",
            at: at(0),
          })
        );
      }).pipe(
        withLayer(
          layerGithubBudgetLedger({ host, ghCredential: Effect.succeedSome(tokenA) }).pipe(
            Layer.provide(Layer.succeed(GithubLedgerStore, store))
          )
        )
      );
    })
);

it("R2 excludes another credential's transport peak from a sample lane", () => {
  const before = GithubLedgerRow.cases.Sample.make({
    ...graphqlSample(MINUTE, 100),
    credential: O.some(tokenA),
    buckets: [
      SampleBucket.make({ resource: "core", limit: 5000, used: 100, remaining: 4900, resetAt: at(30 * MINUTE) }),
    ],
  });
  const after = GithubLedgerRow.cases.Sample.make({
    ...before,
    at: at(30 * MINUTE + SECOND),
    buckets: [
      SampleBucket.make({ resource: "core", limit: 5000, used: 1, remaining: 4999, resetAt: at(90 * MINUTE + SECOND) }),
    ],
  });
  const foreign = GithubLedgerRow.cases.Transport.make({
    ...observed(3, 500, 30 * MINUTE + 5 * SECOND, tokenB),
    resource: "core",
    kind: "rest",
  });
  const windows = windowsOf({ key: coreKey, rows: [before, foreign, after], admitGraphqlSamples: false });
  expect(A.map(windows, (window) => window.resetLowerBound)).toStrictEqual([1]);
});

it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("R4 preserves per-credential latest files cache entries and independent write throttles", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(H + 10 * MINUTE);
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const store = yield* GithubLedgerStore;
        const observation = (remaining: number, fingerprint: CredentialFingerprint) =>
          RateLimitObservation.make({
            snapshot: RateLimitSnapshot.make({
              resource: "graphql",
              remaining,
              used: O.some(5000 - remaining),
              limit: 5000,
              resetEpochSeconds: (H + 50 * MINUTE) / SECOND,
            }),
            budgetLabel: O.some(login),
            credential: "token",
            fingerprint: O.some(fingerprint),
            operation: "Query",
            kind: "graphql",
            status: 200,
            outcome: "ok",
            at: at(9 * MINUTE),
          });
        yield* ledger.recordTransport(observation(100, tokenA));
        yield* ledger.recordTransport(observation(4000, tokenB));
        // Both latest writes are due even in the same process and millisecond.
        const persisted = yield* store.latestTransport;
        expect(A.length(persisted)).toBe(2);
        // Equal resets retain separate GraphQL credentials; latest still exposes a newest reading.
        const cached = yield* ledger.latest(graphqlKey);
        cached.pipe(O.isSome, assertTrue);
        const fs = yield* FileSystem.FileSystem;
        const files = yield* fs.readDirectory(`${STATE_ROOT}/latest`);
        assertTrue(A.contains(files, "transport-user_alice-graphql-aaaaaaaaaaaa.json"));
        assertTrue(A.contains(files, "transport-user_alice-graphql-bbbbbbbbbbbb.json"));
      }).pipe(withLayer(liveLedger), withStateRoot);
      // Restart reads both readings from disk, independently of the previous cache.
      yield* Effect.gen(function* () {
        const store = yield* GithubLedgerStore;
        const readings = yield* store.latestTransport;
        expect(A.length(readings)).toBe(2);
      }).pipe(withLayer(liveLedger), withStateRoot);
    })
  );
});

it.effect("omits physical fingerprints for rotating installation identities at each writer", () =>
  Effect.gen(function* () {
    const store = yield* makeGithubLedgerStoreMemory;
    const app = GithubIdentityLabel.make("app:1/2");
    yield* Effect.gen(function* () {
      const ledger = yield* GithubBudgetLedger;
      yield* ledger.recordSpawn(
        GhSpawnObservation.make({ args: ["pr", "view"], at: at(0), exitCode: 0, durationMillis: 1 })
      );
      yield* ledger.recordSample(
        GithubLedgerRow.cases.Sample.make({ ...graphqlSample(SECOND, 1), identity: app, credential: O.some(tokenA) })
      );
      const rows = yield* store.rows(LedgerRange.make({ from: at(-MINUTE), to: at(MINUTE) }));
      const credentialRows = A.filter(rows, (row) => row._tag !== "Calibration");
      deepStrictEqual(
        A.map(credentialRows, (row) => row.credential),
        [O.none(), O.none()]
      );
    }).pipe(
      withLayer(
        layerGithubBudgetLedger({
          host,
          ghIdentity: Effect.succeed(app),
          ghCredential: Effect.succeedSome(tokenA),
        }).pipe(Layer.provide(Layer.succeed(GithubLedgerStore, store)))
      )
    );
  })
);

it("R2 keeps the exact GraphQL jitter reproduction in separate fingerprint lanes", () => {
  const rows = [
    observed(1, 100, 30 * MINUTE, tokenA),
    observed(2, 200, 30 * MINUTE + 8 * SECOND, tokenB),
    observed(3, 500, 30 * MINUTE + 5 * SECOND, tokenB),
    observed(30 + 1 / 60, 1, 90 * MINUTE + SECOND, tokenA),
  ];
  const hour = calculated(rows);
  assertSome(hour.fleetUsed, 301);
  assertFalse(hour.lanesInferred);
});

it("R5 signals Below 99 for the exact fingerprinted GraphQL reserve reproduction", () => {
  const rows = [
    observed(7, 4900, 50 * MINUTE, tokenA),
    observed(8, 1000, 50 * MINUTE + 8 * SECOND, tokenB),
    observed(9, 4901, 50 * MINUTE + 4 * SECOND, tokenA),
    observed(9.5, 1001, 50 * MINUTE + 8 * SECOND, tokenB),
  ];
  const signal = reserveOf({ now: at(10 * MINUTE), admitGraphqlSamples: false })(
    graphqlKey,
    A.map(rows, readingOfTransport)
  );
  deepStrictEqual(
    signal.state,
    ReserveState.cases.Below.make({
      remaining: 99,
      limit: 5000,
      floor: 750,
      resetAt: at(50 * MINUTE + 4 * SECOND),
      asOf: at(9 * MINUTE),
      basis: "transport",
    })
  );
});

it("D2d merges shared core, isolates known GraphQL fingerprints, and attaches unknown instances once", () => {
  const rows = [observed(1, 100, 50 * MINUTE, tokenA), observed(2, 200, 50 * MINUTE + 3 * SECOND, tokenB)];
  const anchors = anchorsOf({ key: graphqlKey, rows, admitGraphqlSamples: false });
  expect(A.map(lanesOf(anchors, "graphql"), A.length)).toStrictEqual([1, 1]);
  expect(A.map(lanesOf(anchors, "core"), A.length)).toStrictEqual([2]);
  const unknown = { ...O.getOrThrow(A.last(anchors)), source: "pid:42" };
  const mixed = [O.getOrThrow(A.head(anchors)), unknown];
  expect(A.length(lanesOf(mixed, "graphql"))).toBe(1);
  expect(A.length(lanesOf(mixed, "search"))).toBe(1);
});

it("D2b splits one PID's interleaved windows and marks inferred hourly totals", () => {
  const rows = A.map(interleaved, (row) => ({ ...row, pid: 852251 }));
  const lanes = lanesOf(anchorsOf({ key: graphqlKey, rows, admitGraphqlSamples: false }), "graphql");
  expect(A.map(lanes, A.length)).toStrictEqual([10, 10]);
  const hour = calculated(rows);
  assertSome(hour.fleetUsed, 1169);
  assertTrue(hour.lanesInferred);
  assertTrue(
    A.some(
      renderGithubLedgerHour(
        LedgerHourRollup.make({
          hour: at(0),
          host,
          complete: false,
          cells: [],
          keys: [hour],
          operationCosts: [],
          windows: [],
        })
      ),
      Str.includes("inferred lanes")
    )
  );
});

it("D2b never assigns a busy unknown anchor to a floating idle baseline", () => {
  const rows = [
    laneARow(MINUTE, 0, 61 * MINUTE),
    laneARow(2 * MINUTE, 1001, 50 * MINUTE),
    laneARow(3 * MINUTE, 0, 63 * MINUTE),
    laneARow(4 * MINUTE, 1002, 50 * MINUTE),
  ];
  assertSome(calculated(rows).fleetUsed, 1);
  const signal = reserveOf({ now: at(5 * MINUTE), admitGraphqlSamples: false })(graphqlKey, [
    readingOfTransport(laneARow(2 * MINUTE, 4900, 50 * MINUTE)),
    readingOfTransport(laneARow(3 * MINUTE, 1000, 51 * MINUTE)),
  ]);
  expect(signal.state._tag).toBe("Below");
});

it("D2c clusters jitter transitively and keeps ended epochs in separate instances", () => {
  const near = [
    laneARow(0, 10, 50 * MINUTE),
    laneARow(MINUTE, 20, 50 * MINUTE + 8 * SECOND),
    laneARow(2 * MINUTE, 30, 50 * MINUTE + 5 * SECOND),
  ];
  expect(
    A.map(lanesOf(anchorsOf({ key: graphqlKey, rows: near, admitGraphqlSamples: false }), "graphql"), A.length)
  ).toStrictEqual([3]);
  const ended = [
    laneARow(0, 10, 10 * MINUTE),
    laneARow(MINUTE, 20, 20 * MINUTE),
    laneARow(25 * MINUTE, 3, 85 * MINUTE),
  ];
  expect(
    A.map(lanesOf(anchorsOf({ key: graphqlKey, rows: ended, admitGraphqlSamples: false }), "graphql"), A.length)
  ).toStrictEqual([1, 1, 1]);
});

it("D2b refuses an expired idle tail as a busy baseline and derives resource from anchors", () => {
  const rows = [laneARow(0, 0, MINUTE), laneARow(2 * MINUTE, 1000, 50 * MINUTE)];
  expect(A.map(lanesOf(anchorsOf({ key: graphqlKey, rows, admitGraphqlSamples: false })), A.length)).toStrictEqual([
    1, 1,
  ]);
  expect(lanesOf([])).toStrictEqual([]);
  const known = [observed(1, 100, 50 * MINUTE, tokenA), observed(2, 200, 50 * MINUTE + 3 * SECOND, tokenB)];
  expect(A.length(lanesOf(anchorsOf({ key: graphqlKey, rows: known, admitGraphqlSamples: false })))).toBe(2);
});

it("D2c applies all three inferred-instance hourly baselines", () => {
  const before = calculated([
    laneARow(-5 * MINUTE, 100, 30 * MINUTE),
    laneBRow(10 * MINUTE, 120, 30 * MINUTE),
    laneARow(20 * MINUTE, 150, 30 * MINUTE),
  ]);
  assertSome(before.fleetUsed, 50);
  assertFalse(before.fleetUsedIsLowerBound);
  const inside = calculated([laneARow(15 * MINUTE, 20, 70 * MINUTE), laneBRow(20 * MINUTE, 35, 70 * MINUTE)]);
  assertSome(inside.fleetUsed, 35);
  assertFalse(inside.fleetUsedIsLowerBound);
  const partial = calculated([laneARow(10 * MINUTE, 100, 50 * MINUTE), laneBRow(20 * MINUTE, 125, 50 * MINUTE)]);
  assertSome(partial.fleetUsed, 25);
  assertTrue(partial.fleetUsedIsLowerBound);
  assertTrue(before.lanesInferred);
  assertTrue(inside.lanesInferred);
  assertTrue(partial.lanesInferred);
});

it("D2c counts a known lane's first window from zero only when it began inside the hour", () => {
  const inside = calculated([observed(15, 20, 70 * MINUTE, tokenA), observed(20, 35, 70 * MINUTE, tokenA)]);
  assertSome(inside.fleetUsed, 35);
  assertFalse(inside.fleetUsedIsLowerBound);
  assertFalse(inside.lanesInferred);
  const partial = calculated([observed(10, 100, 50 * MINUTE, tokenA), observed(20, 125, 50 * MINUTE, tokenA)]);
  assertSome(partial.fleetUsed, 25);
  assertTrue(partial.fleetUsedIsLowerBound);
  const single = calculated([observed(15, 20, 70 * MINUTE, tokenA)]);
  assertSome(single.fleetUsed, 20);
});

it("D2c prevents the cross-epoch bridge between differently interleaved PIDs", () => {
  const rows = [
    laneARow(MINUTE, 10, 30 * MINUTE),
    laneBRow(1.5 * MINUTE, 11, 30 * MINUTE),
    laneARow(2 * MINUTE, 20, 31 * MINUTE),
    laneBRow(2.5 * MINUTE, 21, 31 * MINUTE),
    laneARow(61 * MINUTE, 10, 90 * MINUTE),
    laneBRow(62 * MINUTE, 20, 91 * MINUTE),
    laneARow(63 * MINUTE, 21, 91 * MINUTE),
    laneBRow(64 * MINUTE, 12, 90 * MINUTE),
  ];
  const anchors = anchorsOf({ key: graphqlKey, rows, admitGraphqlSamples: false });
  const lanes = lanesOf(anchors);
  expect(A.map(lanes, A.length)).toStrictEqual([2, 2, 2, 2]);
  const windows = windowsOf({ key: graphqlKey, rows, admitGraphqlSamples: false });
  assertFalse(A.some(windows, (window) => window.crossesReset));
  const later = calculated(rows, HOUR);
  assertSome(later.fleetUsed, 3);
  assertTrue(later.lanesInferred);
  assertTrue(later.fleetUsedIsLowerBound);
});

it("D2c never marks a jitter-chained inferred instance as a reset crossing", () => {
  const rows = [
    laneARow(MINUTE, 10, 50 * MINUTE),
    laneBRow(2 * MINUTE, 20, 50 * MINUTE + 8 * SECOND),
    laneARow(3 * MINUTE, 30, 50 * MINUTE + 4 * SECOND),
  ];
  const windows = windowsOf({ key: graphqlKey, rows, admitGraphqlSamples: false });
  expect(A.length(windows)).toBe(2);
  assertFalse(A.some(windows, (window) => window.crossesReset));
  assertSome(calculated(rows).fleetUsed, 20);
});

it("D2c leaves an hour unmeasured when its instances have no in-hour anchors", () => {
  const hour = calculated([laneARow(-MINUTE, 10, 50 * MINUTE), laneBRow(61 * MINUTE, 20, 50 * MINUTE)]);
  assertNone(hour.fleetUsed);
  assertFalse(hour.lanesInferred);
  expect(hour.ghEstimated).toBe(0);
});
