import {
  GithubHeadroomBucketInput,
  GithubHeadroomInput,
  GithubHeadroomSource,
  reduceGithubHeadroom,
} from "@beep/palantiri";
import { makeGithubHeadroomSource, renderParcel } from "@beep/repo-cli/test/Palantiri";
import {
  BucketKey,
  BucketReading,
  CommandSpend,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerError,
  GithubLedgerRow,
  GithubLedgerStore,
  HostLabel,
  LedgerSummary,
  layerGithubBudgetLedger,
  makeGithubLedgerStoreMemory,
  SampleBucket,
  UnattributedSpend,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { GithubLedgerStoreShape } from "@beep/repo-cli/test/SharedInternals";

const NOW = DateTime.makeUnsafe("2026-11-10T21:00:00.000Z");
const alice = GithubIdentityLabel.make("user:alice");

const reading = (resource: "core" | "graphql", remaining: number, minutesAgo = 1) =>
  BucketReading.make({
    key: BucketKey.make({ identity: alice, resource }),
    limit: 5000,
    remaining,
    used: O.none(),
    resetAt: DateTime.add(NOW, { minutes: 30 }),
    asOf: DateTime.subtract(NOW, { minutes: minutesAgo }),
    basis: "transport",
  });

// A /rate_limit sample of alice's graphql bucket, which REST misreports until calibration admits it.
const graphqlSample = (remaining: number) =>
  GithubLedgerRow.cases.Sample.make({
    at: DateTime.subtract(NOW, { minutes: 1 }),
    host: HostLabel.make("hub"),
    command: GithubLedgerCommandLabel.make("beep"),
    identity: alice,
    trigger: "timer",
    selfCost: "confirmed-free",
    buckets: [
      SampleBucket.make({
        resource: "graphql",
        limit: 5000,
        used: 5000 - remaining,
        remaining,
        resetAt: DateTime.add(NOW, { minutes: 30 }),
      }),
    ],
  });

const calibrationPair = (minutesAgo: number) =>
  GithubLedgerRow.cases.Calibration.make({
    at: DateTime.subtract(NOW, { minutes: minutesAgo }),
    host: HostLabel.make("hub"),
    identity: alice,
    restUsed: 100,
    restRemaining: 4900,
    restResetAt: DateTime.add(NOW, { minutes: 30 }),
    graphqlUsed: 110,
    graphqlRemaining: 4890,
    graphqlResetAt: DateTime.add(NOW, { minutes: 30 }),
    graphqlCost: 1,
    spanMillis: 200,
  });

const graphqlBuckets = (input: GithubHeadroomInput) =>
  input._tag === "Present"
    ? A.map(
        A.filter(input.buckets, (bucket) => bucket.resource === "graphql"),
        (bucket) => [bucket.remaining, bucket.basis, bucket.reserve] as const
      )
    : [];

const summary = LedgerSummary.make({
  generatedAt: DateTime.subtract(NOW, { minutes: 2 }),
  spenders: [
    CommandSpend.make({
      command: GithubLedgerCommandLabel.make("yeet monitor"),
      requests: 40,
      nominal: 40,
      estimatedPoints: 812,
      ghSpawns: 0,
    }),
  ],
  unattributedLastHour: [
    UnattributedSpend.make({
      key: BucketKey.make({ identity: alice, resource: "graphql" }),
      unattributed: O.some(230),
    }),
  ],
  lastRowAt: O.some(DateTime.subtract(NOW, { minutes: 1 })),
});

// The parcel must read `latest/` only: any raw-row access dies.
const latestOnly = (store: GithubLedgerStoreShape): GithubLedgerStoreShape => ({
  ...store,
  rows: () => Effect.die("the github-headroom source read raw rows"),
  rowHours: Effect.die("the github-headroom source listed raw row hours"),
});

const sourceOver = (store: GithubLedgerStoreShape) =>
  Layer.effect(GithubHeadroomSource, makeGithubHeadroomSource).pipe(
    Layer.provide(layerGithubBudgetLedger()),
    Layer.provide(Layer.succeed(GithubLedgerStore, latestOnly(store)))
  );

const snapshotOf = (store: GithubLedgerStoreShape) =>
  sourceOver(store).pipe(
    Layer.build,
    Effect.flatMap((context) => Context.get(context, GithubHeadroomSource).snapshot)
  );

describe("makeGithubHeadroomSource", () => {
  it.effect("maps readings, reserve signals and the summary from latest/ only", () =>
    Effect.gen(function* () {
      yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const store = yield* makeGithubLedgerStoreMemory;
      yield* store.writeLatestTransport(reading("core", 3120));
      yield* store.writeLatestTransport(reading("graphql", 412));
      yield* store.writeSummary(summary);
      const input = yield* snapshotOf(store);
      expect(input._tag).toBe("Present");
      const present = input as typeof GithubHeadroomInput.cases.Present.Type;
      const byResource = A.map(present.buckets, (bucket) => [bucket.resource, bucket.reserve, bucket.used] as const);
      expect(
        A.sort(
          byResource,
          Order.mapInput(Order.String, ([resource]: (typeof byResource)[number]) => resource)
        )
      ).toEqual([
        ["core", "clear", 1880],
        ["graphql", "below", 4588],
      ]);
      const graphql = A.findFirst(present.buckets, (bucket) => bucket.resource === "graphql");
      assertSome(
        O.flatMap(graphql, (bucket) => bucket.unattributedLastHour),
        230
      );
      assertSome(
        O.map(graphql, (bucket) => bucket.reserveFloor),
        750
      );
      expect(A.map(present.spenders, (spender) => [spender.command, spender.estimatedPoints])).toEqual([
        ["yeet monitor", 812],
      ]);
      assertSome(present.summaryAsOf, summary.generatedAt);
    })
  );

  it.effect("shows a bucket's numbers from the reading its reserve verdict rests on", () =>
    Effect.gen(function* () {
      yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const store = yield* makeGithubLedgerStoreMemory;
      // An older transport reading below the floor, and a newer REST sample that misreports the bucket.
      yield* store.writeLatestTransport(reading("graphql", 412, 3));
      yield* store.writeLatestSample(graphqlSample(4900));
      const input = yield* snapshotOf(store);
      expect(graphqlBuckets(input)).toStrictEqual([[412, "transport", "below"]]);
    })
  );

  it.effect("leaves out an uncalibrated graphql sample and serves a calibrated one, without raw rows", () =>
    Effect.gen(function* () {
      yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const store = yield* makeGithubLedgerStoreMemory;
      yield* store.writeLatestSample(graphqlSample(4900));
      const uncalibrated = yield* snapshotOf(store);
      expect(graphqlBuckets(uncalibrated)).toStrictEqual([]);
      yield* Effect.forEach(A.range(1, 6), (index) => store.appendCalibration(calibrationPair(index * 10)), {
        discard: true,
      });
      const calibrated = yield* snapshotOf(store);
      expect(graphqlBuckets(calibrated)).toStrictEqual([[4900, "sample", "clear"]]);
    })
  );

  it.effect("serves an empty ledger as Missing", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      const input = yield* snapshotOf(store);
      expect(input._tag).toBe("Missing");
    })
  );

  it.effect("maps a ledger read failure to SourceFailed naming only the reason", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      const broken: GithubLedgerStoreShape = {
        ...store,
        readSummary: Effect.fail(GithubLedgerError.make({ reason: "read", detail: "/state/beep/github/latest" })),
      };
      const failure = yield* snapshotOf(broken).pipe(Effect.flip);
      expect(failure.parcel).toBe("github-headroom");
      expect(failure.detail).toBe("the GitHub ledger read failed");
    })
  );
});

describe("renderParcel github-headroom", () => {
  const headroomBucket = (identity: string, remaining: number, minutesAgo: number, unattributed: O.Option<number>) =>
    GithubHeadroomBucketInput.make({
      identity,
      resource: "graphql",
      limit: 5000,
      remaining,
      used: 5000 - remaining,
      resetsAt: DateTime.add(NOW, { minutes: 30 }),
      asOf: DateTime.subtract(NOW, { minutes: minutesAgo }),
      basis: "transport",
      reserve: "below",
      reserveFloor: 750,
      unattributedLastHour: unattributed,
    });

  it("renders each bucket with its reserve, reset, unattributed spend and staleness", () => {
    const envelope = reduceGithubHeadroom(
      GithubHeadroomInput.cases.Present.make({
        generatedAt: NOW,
        buckets: [headroomBucket("user:alice", 412, 1, O.some(230)), headroomBucket("user:bob", 4000, 30, O.none())],
        spenders: [],
        summaryAsOf: O.none(),
        lastRowAt: O.none(),
      }),
      NOW,
      20
    );
    const lines = pipe(renderParcel(envelope), Str.split("\n"));
    expect(lines[0]).toBe(`github-headroom: ${envelope.summary}`);
    expect(A.drop(lines, 2)).toEqual([
      "  user:alice graphql  412/5000  reserve below (floor 750)  resets 2026-11-10T21:30:00.000Z  unattributed 1h 230",
      "  user:bob graphql  4000/5000  reserve below (floor 750)  resets 2026-11-10T21:30:00.000Z  [stale]",
      "  showing 2 of 2",
    ]);
  });
});
