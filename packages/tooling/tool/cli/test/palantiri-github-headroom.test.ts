import { GithubHeadroomSource } from "@beep/palantiri";
import { makeGithubHeadroomSource } from "@beep/repo-cli/test/Palantiri";
import {
  BucketKey,
  BucketReading,
  CommandSpend,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerError,
  GithubLedgerStore,
  LedgerSummary,
  layerGithubBudgetLedger,
  makeGithubLedgerStoreMemory,
  UnattributedSpend,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as TestClock from "effect/testing/TestClock";
import type { GithubHeadroomInput } from "@beep/palantiri";
import type { GithubLedgerStoreShape } from "@beep/repo-cli/test/SharedInternals";

const NOW = DateTime.makeUnsafe("2026-11-10T21:00:00.000Z");
const alice = GithubIdentityLabel.make("user:alice");

const reading = (resource: "core" | "graphql", remaining: number) =>
  BucketReading.make({
    key: BucketKey.make({ identity: alice, resource }),
    limit: 5000,
    remaining,
    used: O.none(),
    resetAt: DateTime.add(NOW, { minutes: 30 }),
    asOf: DateTime.subtract(NOW, { minutes: 1 }),
    basis: "transport",
  });

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
    Effect.flatMap((context) => Context.get(context, GithubHeadroomSource).snapshot),
    Effect.scoped
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
      expect(O.flatMap(graphql, (bucket) => bucket.unattributedLastHour)).toEqual(O.some(230));
      expect(O.map(graphql, (bucket) => bucket.reserveFloor)).toEqual(O.some(750));
      expect(A.map(present.spenders, (spender) => [spender.command, spender.estimatedPoints])).toEqual([
        ["yeet monitor", 812],
      ]);
      expect(present.summaryAsOf).toEqual(O.some(summary.generatedAt));
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
