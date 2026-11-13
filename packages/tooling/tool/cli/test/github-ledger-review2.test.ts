import { CredentialFingerprint, RateLimitObservation, RateLimitSnapshot } from "@beep/github/Resilience";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  anchorsOf,
  BucketKey,
  DEFAULT_COMMAND_LABEL,
  GithubBudgetLedger,
  GithubIdentityLabel,
  GithubLedgerRow,
  GithubLedgerStore,
  HostLabel,
  hourOf,
  lanesOf,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreLive,
  makeGithubLedgerStoreMemory,
  readingOfTransport,
  reserveOf,
  SampleBucket,
  SampleRowJson,
  windowsOf,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { withLayer } from "./support/GithubLedgerFakes.ts";

const T = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-13T00:00:00Z"));
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const at = (minute: number) => DateTime.makeUnsafe(T + minute * MINUTE);
const host = HostLabel.make("hub");
const identity = GithubIdentityLabel.make("user:alice");
const a = CredentialFingerprint.make("aaaaaaaaaaaa");
const b = CredentialFingerprint.make("bbbbbbbbbbbb");
const graphql = BucketKey.make({ identity, resource: "graphql" });
const core = BucketKey.make({ identity, resource: "core" });
const row = (minute: number, used: number, reset: number, credential: O.Option<CredentialFingerprint>) =>
  GithubLedgerRow.cases.Transport.make({
    at: at(minute),
    host,
    command: DEFAULT_COMMAND_LABEL,
    identity,
    credential,
    resource: "graphql",
    kind: "graphql",
    operation: "Query",
    status: 200,
    outcome: "ok",
    limit: 5000,
    remaining: 5000 - used,
    used: O.some(used),
    resetAt: DateTime.makeUnsafe(T + reset),
    nominalCost: 1,
    pid: 42,
  });
const sample = (minute: number, remaining: number, reset: number, credential: O.Option<CredentialFingerprint>) =>
  GithubLedgerRow.cases.Sample.make({
    at: at(minute),
    host,
    command: DEFAULT_COMMAND_LABEL,
    identity,
    credential,
    trigger: "timer",
    selfCost: "confirmed-free",
    buckets: [
      SampleBucket.make({ resource: "core", limit: 5000, used: 5000 - remaining, remaining, resetAt: at(reset) }),
    ],
  });
const observation = (minute: number, remaining: number, reset: number, credential: O.Option<CredentialFingerprint>) =>
  RateLimitObservation.make({
    at: at(minute),
    budgetLabel: O.some(identity),
    credential: "token",
    fingerprint: credential,
    operation: "Query",
    kind: "graphql",
    status: 200,
    outcome: "ok",
    snapshot: RateLimitSnapshot.make({
      resource: "graphql",
      limit: 5000,
      remaining,
      used: O.some(5000 - remaining),
      resetEpochSeconds: (T + reset) / SECOND,
    }),
  });
const coreObservation = (
  minute: number,
  remaining: number,
  reset: number,
  credential: O.Option<CredentialFingerprint>
) => {
  const graphqlObservation = observation(minute, remaining, reset, credential);
  return RateLimitObservation.make({
    ...graphqlObservation,
    kind: "rest",
    snapshot: RateLimitSnapshot.make({ ...graphqlObservation.snapshot, resource: "core" }),
  });
};
const hour = (rows: ReadonlyArray<GithubLedgerRow>, minute = 0) =>
  hourOf({
    hour: at(minute),
    key: graphql,
    rows,
    windows: windowsOf({ key: graphql, rows, admitGraphqlSamples: false }),
    costs: [],
  });
const ledgerOver = (store: GithubLedgerStore["Service"]) =>
  withLayer(layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(Layer.succeed(GithubLedgerStore, store))));
const root = (name: string) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown({ BEEP_GITHUB_LEDGER_STATE_ROOT: `/review2-${name}` })
  );
const live = layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreLive));
const checkBelow = Effect.fnUntraced(function* (key: BucketKey) {
  const ledger = yield* GithubBudgetLedger;
  const signal = yield* ledger.reserve(key);
  expect(signal.state._tag).toBe("Below");
});

describe("GitHub ledger second review regressions", () => {
  it("D2d attaches the upgrade instance and counts 110 instead of 210", () => {
    const measured = hour([row(15, 100, 70 * MINUTE, O.none()), row(20, 110, 70 * MINUTE, O.some(a))]);
    assertSome(measured.fleetUsed, 110);
    assertTrue(measured.lanesInferred);
  });

  it("D2e leaves multi-candidate instances ambiguous even with a closest reset or tie", () => {
    const first = row(20, 110, 70 * MINUTE, O.some(a));
    const second = row(21, 120, 70 * MINUTE + 6 * SECOND, O.some(b));
    const unknown = row(15, 100, 70 * MINUTE + 5 * SECOND, O.none());
    const grouped = lanesOf(anchorsOf({ key: graphql, rows: [unknown, first, second], admitGraphqlSamples: false }));
    deepStrictEqual(
      A.map(grouped, (lane) => A.map(lane, (anchor) => anchor.source)),
      [["pid:42"], [a], [b]]
    );
    const tied = row(15, 100, 70 * MINUTE + 3 * SECOND, O.none());
    const tieGroups = lanesOf(anchorsOf({ key: graphql, rows: [second, tied, first], admitGraphqlSamples: false }));
    deepStrictEqual(
      A.map(tieGroups, (lane) => A.map(lane, (anchor) => anchor.source)),
      [["pid:42"], [a], [b]]
    );
  });

  it("D2e an earlier single-candidate attachment cannot resolve another ambiguous instance", () => {
    const knownA = row(20, 110, 70 * MINUTE + 2 * SECOND, O.some(a));
    const knownB = row(22, 120, 70 * MINUTE + 8 * SECOND, O.some(b));
    const early = row(10, 90, 70 * MINUTE + 11 * SECOND, O.none());
    const tied = row(15, 100, 70 * MINUTE + 5 * SECOND, O.none());
    const grouped = lanesOf(
      anchorsOf({ key: graphql, rows: [knownA, tied, knownB, early], admitGraphqlSamples: false })
    );
    deepStrictEqual(
      A.map(grouped, (lane) => A.map(lane, (anchor) => anchor.source)),
      [["pid:42", b], ["pid:42"], [a]]
    );
  });

  it("D2e excludes the ambiguous credential switch and counts 320 as an inferred lower bound", () => {
    const rows = [
      row(15, 100, 70 * MINUTE, O.none()),
      row(20, 110, 70 * MINUTE, O.some(a)),
      row(25, 200, 70 * MINUTE, O.none()),
      row(30, 210, 70 * MINUTE, O.some(b)),
    ];
    const measured = hour(rows);
    assertSome(measured.fleetUsed, 320);
    assertTrue(measured.fleetUsedIsLowerBound);
    assertTrue(measured.lanesInferred);
  });

  it("D2e keeps depleted ambiguous readings eligible for reserve", () => {
    const rows = [
      row(18, 4900, 70 * MINUTE, O.none()),
      row(20, 110, 70 * MINUTE, O.some(a)),
      row(25, 210, 70 * MINUTE, O.some(b)),
    ];
    const signal = reserveOf({ now: at(26), admitGraphqlSamples: false })(graphql, A.map(rows, readingOfTransport));
    expect(signal.state._tag).toBe("Below");
  });

  it("D2e marks every hour touched by ambiguous anchors without counting their rise", () => {
    const rows = [
      row(55, 100, 130 * MINUTE, O.none()),
      row(56, 110, 130 * MINUTE, O.some(a)),
      row(65, 200, 130 * MINUTE, O.none()),
      row(70, 210, 130 * MINUTE, O.some(b)),
    ];
    const first = hour(rows);
    const second = hour(rows, 60);
    assertSome(first.fleetUsed, 110);
    assertSome(second.fleetUsed, 210);
    assertTrue(first.fleetUsedIsLowerBound);
    assertTrue(second.fleetUsedIsLowerBound);
    assertTrue(first.lanesInferred);
    assertTrue(second.lanesInferred);
  });

  it("D2d marks a mixed lane's initial contribution even when its ending window is in the next hour", () => {
    const rows = [row(15, 100, 70 * MINUTE, O.none()), row(65, 110, 70 * MINUTE, O.some(a))];
    const first = hour(rows);
    const second = hour(rows, 60);
    assertSome(first.fleetUsed, 100);
    assertSome(second.fleetUsed, 10);
    assertTrue(first.lanesInferred);
    assertTrue(second.lanesInferred);
  });

  it.effect("review2 retains two unknown windows from one PID through memory restart and service cache/throttle", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(T + 10 * MINUTE);
      const store = yield* makeGithubLedgerStoreMemory;
      yield* store.writeLatestTransport(readingOfTransport(row(8, 4900, 40 * MINUTE, O.none())));
      yield* store.writeLatestTransport(readingOfTransport(row(9, 1000, 41 * MINUTE, O.none())));
      const readings = yield* store.latestTransport;
      expect(A.length(readings)).toBe(2);
      yield* checkBelow(graphql).pipe(ledgerOver(store));
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        yield* ledger.recordTransport(observation(9, 100, 40 * MINUTE, O.none()));
        yield* ledger.recordTransport(observation(9, 4000, 41 * MINUTE, O.none()));
        yield* checkBelow(graphql);
      }).pipe(ledgerOver(store));
      yield* checkBelow(graphql).pipe(ledgerOver(store));
    })
  );

  it.effect("review2 retains samples per credential through a fresh memory service", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(T + 10 * MINUTE);
      const store = yield* makeGithubLedgerStoreMemory;
      yield* store.writeLatestSample(sample(8, 100, 40, O.some(a)));
      yield* store.writeLatestSample(sample(9, 4000, 41, O.some(b)));
      const samples = yield* store.latestSamples;
      expect(A.length(samples)).toBe(2);
      yield* checkBelow(core).pipe(ledgerOver(store));
    })
  );

  it.effect("review2 coalesces jitter neighbours across second boundaries without overwriting separate windows", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      yield* store.writeLatestTransport(readingOfTransport(row(7, 100, 40 * MINUTE + SECOND, O.none())));
      yield* store.writeLatestTransport(readingOfTransport(row(8, 200, 40 * MINUTE + 8 * SECOND, O.none())));
      const distinct = yield* store.latestTransport;
      expect(A.length(distinct)).toBe(2);
      yield* store.writeLatestTransport(readingOfTransport(row(9, 300, 40 * MINUTE + 4 * SECOND, O.none())));
      yield* store.writeLatestTransport(readingOfTransport(row(6, 400, 40 * MINUTE + 5 * SECOND, O.none())));
      const merged = yield* store.latestTransport;
      expect(A.map(merged, (reading) => reading.remaining)).toStrictEqual([4700]);
      yield* store.writeLatestTransport(readingOfTransport(row(9, 0, 40 * MINUTE + 4 * SECOND, O.none())));
      const idleAndBusy = yield* store.latestTransport;
      expect(A.length(idleAndBusy)).toBe(2);
    })
  );
});

it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("review2 restarts with two sample credentials and retains a legacy sample as one source", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(T + 10 * MINUTE);
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        yield* ledger.recordSample(sample(8, 100, 40, O.some(a)));
        yield* ledger.recordSample(sample(9, 4000, 41, O.some(b)));
      }).pipe(withLayer(live), root("samples"));
      yield* checkBelow(core).pipe(withLayer(live), root("samples"));
      const fs = yield* FileSystem.FileSystem;
      const files = yield* fs.readDirectory("/review2-samples/latest");
      assertTrue(A.contains(files, "sample-user_alice-aaaaaaaaaaaa.json"));
      assertTrue(A.contains(files, "sample-user_alice-bbbbbbbbbbbb.json"));
      const text = yield* S.encodeEffect(SampleRowJson)(sample(9, 5000, 42, O.none()));
      yield* fs.writeFileString("/review2-samples/latest/sample-user_alice.json", text);
      yield* Effect.gen(function* () {
        const store = yield* GithubLedgerStore;
        const samples = yield* store.latestSamples;
        expect(A.length(samples)).toBe(3);
      }).pipe(withLayer(live), root("samples"));
    })
  );

  it.effect("review2 persists both unknown windows through independent throttles and a live restart", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(T + 10 * MINUTE);
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        yield* ledger.recordTransport(observation(9, 100, 40 * MINUTE, O.none()));
        yield* ledger.recordTransport(observation(9, 4000, 41 * MINUTE, O.none()));
        yield* checkBelow(graphql);
        const store = yield* GithubLedgerStore;
        const readings = yield* store.latestTransport;
        expect(A.length(readings)).toBe(2);
      }).pipe(withLayer(live), root("transport"));
      yield* checkBelow(graphql).pipe(withLayer(live), root("transport"));
    })
  );

  it.effect("review2 removes superseded live instance files when jitter bridges neighbours", () =>
    Effect.gen(function* () {
      yield* Effect.gen(function* () {
        const store = yield* GithubLedgerStore;
        yield* store.writeLatestTransport(readingOfTransport(row(7, 100, 40 * MINUTE + SECOND, O.none())));
        yield* store.writeLatestTransport(readingOfTransport(row(8, 200, 40 * MINUTE + 8 * SECOND, O.none())));
        yield* store.writeLatestTransport(readingOfTransport(row(9, 300, 40 * MINUTE + 4 * SECOND, O.none())));
        const readings = yield* store.latestTransport;
        expect(A.length(readings)).toBe(1);
      }).pipe(withLayer(live), root("neighbours"));
      const fs = yield* FileSystem.FileSystem;
      const files = yield* fs.readDirectory("/review2-neighbours/latest");
      expect(A.length(files)).toBe(1);
    })
  );
});

const verifyExpiry = Effect.gen(function* () {
  yield* TestClock.setTime(T + 10 * MINUTE);
  const ledger = yield* GithubBudgetLedger;
  const store = yield* GithubLedgerStore;
  yield* ledger.recordTransport(observation(8, 100, 40 * MINUTE, O.none()));
  yield* ledger.recordTransport(
    RateLimitObservation.make({ ...observation(8, 100, 40 * MINUTE, O.none()), budgetLabel: O.some("user:bob") })
  );
  yield* ledger.recordTransport(observation(9, 4000, 41 * MINUTE, O.some(b)));
  yield* ledger.recordTransport(coreObservation(10, 4000, 41 * MINUTE, O.some(b)));
  yield* ledger.recordSample(sample(8, 100, 40, O.none()));
  yield* ledger.recordSample(sample(9, 4000, 40, O.some(a)));
  yield* TestClock.setTime(T + 42 * MINUTE);
  yield* ledger.prune;
  const transports = yield* store.latestTransport;
  const samples = yield* store.latestSamples;
  expect(A.map(transports, (reading) => [reading.source, reading.key.resource])).toStrictEqual([[b, "core"]]);
  deepStrictEqual(
    A.map(samples, (row) => row.credential),
    [O.some(a)]
  );
  const cached = yield* ledger.latest(core);
  const cachedSource = O.map(cached, (reading) => reading.source);
  assertSome(cachedSource, b);
  // One GraphQL token can read two windows, so its readings are window instances that expire too.
  const graphqlCached = yield* ledger.latest(graphql);
  assertNone(graphqlCached);
  const expiredOnly = yield* ledger.latest(
    BucketKey.make({ identity: GithubIdentityLabel.make("user:bob"), resource: "graphql" })
  );
  assertNone(expiredOnly);
  // Known REST fingerprints retain sequence continuity; their reset readings remain
  // until normal age retention, while expired window instances disappear.
  const signal = yield* ledger.reserve(graphql);
  expect(signal.state._tag).toBe("Unknown");
});

it.effect("review2 expires window instances from memory retention cache and throttle", () =>
  Effect.gen(function* () {
    const store = yield* makeGithubLedgerStoreMemory;
    yield* verifyExpiry.pipe(ledgerOver(store));
  })
);

it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("review2 expires window instance files while keeping known REST credentials", () =>
    verifyExpiry.pipe(withLayer(live), root("expiry"))
  );
});

it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("review2 preserves old instance files when the replacement write fails", () =>
    Effect.gen(function* () {
      yield* Effect.gen(function* () {
        const store = yield* GithubLedgerStore;
        yield* store.writeLatestTransport(readingOfTransport(row(7, 100, 40 * MINUTE + SECOND, O.none())));
        yield* store.writeLatestTransport(readingOfTransport(row(8, 200, 40 * MINUTE + 8 * SECOND, O.none())));
      }).pipe(withLayer(live), root("failed-write"));
      const fs = yield* FileSystem.FileSystem;
      const failedFs = {
        ...fs,
        rename: (path: string) =>
          Effect.fail(
            PlatformError.systemError({
              _tag: "PermissionDenied",
              module: "FileSystem",
              method: "rename",
              pathOrDescriptor: path,
            })
          ),
      };
      yield* Effect.gen(function* () {
        const store = yield* GithubLedgerStore;
        const error = yield* Effect.flip(
          store.writeLatestTransport(readingOfTransport(row(9, 300, 40 * MINUTE + 4 * SECOND, O.none())))
        );
        expect(error.reason).toBe("write");
      }).pipe(withLayer(live), root("failed-write"), Effect.provideService(FileSystem.FileSystem, failedFs));
      yield* Effect.gen(function* () {
        const store = yield* GithubLedgerStore;
        const readings = yield* store.latestTransport;
        expect(A.length(readings)).toBe(2);
      }).pipe(withLayer(live), root("failed-write"));
    })
  );
});

const verifyDriftingRetention = Effect.gen(function* () {
  yield* TestClock.setTime(T + 5);
  const store = yield* GithubLedgerStore;
  const resets = [100_000, 105_000, 110_000, 100_500];
  yield* Effect.forEach(resets, (reset, index) =>
    store.writeLatestTransport({
      ...readingOfTransport(row(0, 4900, reset, O.none())),
      asOf: DateTime.makeUnsafe(T + index + 1),
      remaining: index === 3 ? 4000 : 100,
      used: O.some(index === 3 ? 1000 : 4900),
    })
  );
  const retained = yield* store.latestTransport;
  deepStrictEqual(
    A.sort(
      A.map(retained, (reading) => DateTime.toEpochMillis(reading.resetAt) - T),
      Order.Number
    ),
    [100_500, 110_000]
  );
  yield* checkBelow(graphql);
});

it.effect("review3 retains distinct drifted instances with unique keys in memory and after restart", () =>
  Effect.gen(function* () {
    const store = yield* makeGithubLedgerStoreMemory;
    yield* verifyDriftingRetention.pipe(ledgerOver(store));
    yield* checkBelow(graphql).pipe(ledgerOver(store));
    yield* TestClock.setTime(T + 110_001);
    yield* Effect.gen(function* () {
      const ledger = yield* GithubBudgetLedger;
      yield* ledger.prune;
      const retained = yield* store.latestTransport;
      expect(A.length(retained)).toBe(0);
      const cached = yield* ledger.latest(graphql);
      assertNone(cached);
    }).pipe(ledgerOver(store));
  })
);

it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("review3 retains unique live filenames after reset drift and expires suffixed instances", () =>
    Effect.gen(function* () {
      yield* verifyDriftingRetention.pipe(withLayer(live), root("drift"));
      yield* checkBelow(graphql).pipe(withLayer(live), root("drift"));
      const fs = yield* FileSystem.FileSystem;
      const files = yield* fs.readDirectory("/review2-drift/latest");
      assertTrue(A.contains(files, `transport-user_alice-graphql-instance-busy-${T / SECOND + 100}-1.json`));
      expect(A.length(files)).toBe(2);
      yield* TestClock.setTime(T + 110_001);
      yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        yield* ledger.prune;
        const store = yield* GithubLedgerStore;
        const retained = yield* store.latestTransport;
        expect(A.length(retained)).toBe(0);
      }).pipe(withLayer(live), root("drift"));
      const expired = yield* fs.readDirectory("/review2-drift/latest");
      deepStrictEqual(expired, ["summary.json"]);
    })
  );
});
