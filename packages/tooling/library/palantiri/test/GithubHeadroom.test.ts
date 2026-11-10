import {
  Freshness,
  GithubHeadroomBucketInput,
  GithubHeadroomInput,
  GithubHeadroomSource,
  GithubSpender,
  githubHeadroomItems,
  layerParcels,
  ParcelEnvelope,
  ParcelItem,
  Parcels,
  reduceGithubHeadroom,
  SourceFailed,
} from "@beep/palantiri";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { failingSources } from "./fixtures/Sources.ts";

const ParcelEnvelopeJson = S.fromJsonString(ParcelEnvelope);

const NOW = DateTime.makeUnsafe("2026-11-10T21:00:00.000Z");
const minutesAgo = (minutes: number) => DateTime.subtract(NOW, { minutes });
const minutesAhead = (minutes: number) => DateTime.add(NOW, { minutes });

const bucket = (overrides: Partial<GithubHeadroomBucketInput>) =>
  GithubHeadroomBucketInput.make({
    identity: "user:alice",
    resource: "core",
    limit: 5000,
    remaining: 3120,
    used: 1880,
    resetsAt: minutesAhead(31),
    asOf: minutesAgo(1),
    basis: "transport",
    reserve: "clear",
    reserveFloor: 750,
    unattributedLastHour: O.none(),
    ...overrides,
  });

const spender = (command: string, estimatedPoints: number) =>
  GithubSpender.make({ command, requests: estimatedPoints, estimatedPoints, ghSpawns: 0 });

const present = (overrides: Partial<Omit<typeof GithubHeadroomInput.cases.Present.Type, "_tag">>) =>
  GithubHeadroomInput.cases.Present.make({
    generatedAt: NOW,
    buckets: [],
    spenders: [],
    summaryAsOf: O.some(minutesAgo(2)),
    lastRowAt: O.some(minutesAgo(1)),
    ...overrides,
  });

const healthy = present({
  buckets: [
    bucket({ resource: "search", limit: 30, remaining: 30, used: 0, reserveFloor: 5 }),
    bucket({
      resource: "graphql",
      remaining: 412,
      used: 4588,
      resetsAt: minutesAhead(40),
      reserve: "below",
      unattributedLastHour: O.some(230),
    }),
    bucket({}),
  ],
  spenders: [
    spender("session note", 3),
    spender("yeet monitor", 812),
    spender("gh-spawn pr view", 140),
    spender("x", 1),
  ],
});

const reasonOf = (freshness: Freshness) => (freshness._tag === "Unknown" ? freshness.reason : "fresh");

describe("githubHeadroomItems", () => {
  it("orders core, graphql, search per identity and checks each reading", () => {
    const items = githubHeadroomItems(
      present({
        buckets: [
          bucket({ identity: "user:bob", resource: "graphql", asOf: minutesAgo(20) }),
          bucket({ resource: "code_search", basis: "sample" }),
          ...healthy.buckets,
        ],
      }),
      NOW
    );
    expect(A.map(items, (item) => `${item.identity} ${item.resource}`)).toEqual([
      "user:alice core",
      "user:alice graphql",
      "user:alice search",
      "user:alice code_search",
      "user:bob graphql",
    ]);
    expect(items[3]?.sources).toEqual(["github-ledger", "github-rate-limit-sample"]);
    expect(items[0]?.sources).toEqual(["github-ledger"]);
    expect(reasonOf(items[4]!.freshness)).toBe("stale");
    expect(reasonOf(items[0]!.freshness)).toBe("fresh");
  });
});

describe("reduceGithubHeadroom", () => {
  it("serves a missing ledger as Unknown{no-source}", () => {
    const parcel = reduceGithubHeadroom(
      GithubHeadroomInput.cases.Missing.make({ detail: "no ledger directory" }),
      NOW,
      20
    );
    expect(parcel.parcel).toBe("github-headroom");
    expect(parcel.key).toBe("account");
    expect(reasonOf(parcel.freshness)).toBe("no-source");
    expect(parcel.summary).toBe("github headroom unknown: no ledger on this host");
    expect(parcel.receipt.total).toBe(0);
  });

  it("summarizes fresh buckets, the reserve verdict and the top spenders", () => {
    const parcel = reduceGithubHeadroom(healthy, NOW, 20);
    expect(parcel.freshness._tag).toBe("Fresh");
    expect(parcel.summary).toBe(
      "user:alice core 3120/5000 ↺21:31Z · graphql 412/5000 BELOW 15% ↺21:40Z · search 30/30; " +
        "top 1h here: yeet monitor 812, gh-spawn pr view 140, session note 3; unattributed 1h graphql 230"
    );
    expect(parcel.receipt.total).toBe(3);
  });

  it("marks an unknown reserve instead of judging it", () => {
    const parcel = reduceGithubHeadroom(present({ buckets: [bucket({ reserve: "unknown" })] }), NOW, 20);
    expect(parcel.summary).toMatch(/^user:alice core 3120\/5000 reserve \? ↺21:31Z; /);
  });

  it("never serves stale readings as headroom", () => {
    const parcel = reduceGithubHeadroom(
      present({ buckets: [bucket({ asOf: minutesAgo(47) }), bucket({ resource: "graphql", asOf: minutesAgo(52) })] }),
      NOW,
      20
    );
    expect(reasonOf(parcel.freshness)).toBe("stale");
    expect(parcel.summary).toMatch(/^github headroom unknown: last reading 47m ago \(sampler idle\?\); /);
    expect(parcel.summary).not.toContain("3120/5000");
  });

  it("names stale identities next to fresh ones and keeps the envelope fresh", () => {
    const parcel = reduceGithubHeadroom(
      present({ buckets: [bucket({}), bucket({ identity: "user:bob", asOf: minutesAgo(30) })] }),
      NOW,
      20
    );
    expect(reasonOf(parcel.freshness)).toBe("fresh");
    expect(parcel.freshness).toEqual(Freshness.cases.Fresh.make({ asOf: minutesAgo(1) }));
    expect(parcel.summary).toMatch(/^user:alice core 3120\/5000 ↺21:31Z; 1 stale \(user:bob\); /);
  });

  it("reports an old or absent summary without touching the headroom part", () => {
    const old = reduceGithubHeadroom(present({ buckets: [bucket({})], summaryAsOf: O.some(minutesAgo(20)) }), NOW, 20);
    expect(old.summary).toBe("user:alice core 3120/5000 ↺21:31Z; spenders unknown (summary 20m old)");
    const none = reduceGithubHeadroom(present({ buckets: [bucket({})], summaryAsOf: O.none() }), NOW, 20);
    expect(none.summary).toBe("user:alice core 3120/5000 ↺21:31Z; spenders unknown (no summary)");
  });

  it("serves no readings as Unknown{no-source}", () => {
    const parcel = reduceGithubHeadroom(present({}), NOW, 20);
    expect(reasonOf(parcel.freshness)).toBe("no-source");
    expect(parcel.summary).toMatch(/^github headroom unknown: no readings on this host; /);
  });

  it.effect("round-trips the envelope through JSON", () =>
    Effect.gen(function* () {
      const parcel = reduceGithubHeadroom(healthy, NOW, 2);
      const text = yield* S.encodeEffect(ParcelEnvelopeJson)(parcel);
      const back = yield* S.decodeEffect(ParcelEnvelopeJson)(text);
      expect(back.receipt).toEqual(parcel.receipt);
      expect(A.filter(back.items, ParcelItem.guards.GithubHeadroom)).toHaveLength(2);
    })
  );
});

describe("Parcels.read github-headroom", () => {
  const withSource = (snapshot: Effect.Effect<GithubHeadroomInput, SourceFailed>) =>
    layerParcels.pipe(Layer.provide(Layer.merge(failingSources, Layer.succeed(GithubHeadroomSource, { snapshot }))));

  it.layer(withSource(Effect.succeed(healthy)), { timeout: "30 seconds" })("with a working source", (it) => {
    it.effect("serves the buckets", () =>
      Effect.gen(function* () {
        yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
        const parcel = yield* Parcels.use((parcels) => parcels.read("github-headroom"));
        expect(parcel.freshness._tag).toBe("Fresh");
        expect(parcel.receipt.total).toBe(3);
      })
    );
  });

  const unreadable = SourceFailed.make({ parcel: "github-headroom", detail: "ledger unreadable" });

  it.layer(unreadable.pipe(Effect.fail, withSource), { timeout: "30 seconds" })("with a failing source", (it) => {
    it.effect("serves Unknown{unreachable}", () =>
      Effect.gen(function* () {
        const parcel = yield* Parcels.use((parcels) => parcels.read("github-headroom"));
        expect(reasonOf(parcel.freshness)).toBe("unreachable");
        expect(parcel.summary).toBe("github headroom unavailable: ledger unreadable");
      })
    );
  });
});
