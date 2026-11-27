import {
  InboxRowInput,
  LaneCheckoutInput,
  LaneRedsInput,
  LaneRedsSource,
  layerParcels,
  ParcelEnvelope,
  ParcelItem,
  Parcels,
  ProofJobInput,
  reduceLaneReds,
  SourceFailed,
} from "@beep/palantiri";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { failingSources } from "./fixtures/Sources.ts";
import type { Freshness, LaneRed } from "@beep/palantiri";

const NOW = DateTime.makeUnsafe("2026-10-15T12:00:00.000Z");
const minutesAgo = (minutes: number) => DateTime.subtract(NOW, { minutes });

const row = (overrides: Partial<InboxRowInput>) =>
  InboxRowInput.make({
    kind: "check-failed",
    severity: "P0",
    prNumber: O.some(1817),
    summary: "Check / Coverage FAILURE",
    observedAt: O.some(minutesAgo(2)),
    acked: false,
    superseded: false,
    ...overrides,
  });

const job = (branch: string, failed: boolean, submittedMinutesAgo: number, reason = "failure") =>
  ProofJobInput.make({
    branch,
    prNumber: O.none(),
    failed,
    reason,
    submittedAt: minutesAgo(submittedMinutesAgo),
    endedAt: O.some(minutesAgo(submittedMinutesAgo - 1)),
  });

const checkout = (lane: string, rows: ReadonlyArray<InboxRowInput>, jobs: O.Option<ReadonlyArray<ProofJobInput>>) =>
  LaneCheckoutInput.make({
    lane,
    branch: O.some(`feat/${lane}`),
    inboxReadable: true,
    skippedLines: 0,
    rows,
    jobs,
  });

const reds = (parcel: ParcelEnvelope): ReadonlyArray<LaneRed> => A.filter(parcel.items, ParcelItem.guards.LaneRed);

const encodeParcelEnvelopeJson = S.encodeEffect(S.fromJsonString(ParcelEnvelope));
const reasonOf = (freshness: Freshness): string => (freshness._tag === "Unknown" ? freshness.reason : "fresh");

const sample = LaneRedsInput.make({
  checkouts: [
    checkout(
      "lane-a",
      [
        row({}),
        row({ acked: true }),
        row({ superseded: true }),
        row({ kind: "base-drift", severity: "P2" }),
        row({ kind: "pr-merge-ready", severity: "P1" }),
        row({
          kind: "review-thread",
          severity: "P1",
          summary: "unresolved review thread",
          observedAt: O.some(minutesAgo(30)),
        }),
      ],
      O.some([job("feat/lane-a", true, 50), job("feat/lane-a", false, 20)])
    ),
    checkout(
      "lane-b",
      [row({ kind: "pr-comment", severity: "P1", summary: "comment from reviewer@example.com in /home/someone/x" })],
      O.some([job("feat/lane-b", true, 5, "timeout")])
    ),
  ],
});

describe("reduceLaneReds", () => {
  it("keeps open P0/P1 reds, P0 first, and a branch's newest failed job", () => {
    const parcel = reduceLaneReds(sample, NOW, 20);
    expect(
      A.map(reds(parcel), (red) => [red.lane, red.kind, red.severity, reasonOf(red.freshness)]),
      "acked, superseded, P2 and observation rows never count; a P1 thread seen 30 minutes ago is open but stale"
    ).toEqual([
      ["lane-a", "check-failed", "P0", "fresh"],
      ["lane-b", "pr-comment", "P1", "fresh"],
      ["lane-b", "proof-job-failed", "P1", "fresh"],
      ["lane-a", "review-thread", "P1", "stale"],
    ]);
    expect(parcel.freshness._tag).toBe("Fresh");
    expect(parcel.summary).toBe("3 of 4 reds fresh; 1 stale (lane-a); 1 P0, 3 P1 across 2 lanes");
  });

  it.effect("redacts addresses and home paths from summaries", () =>
    Effect.gen(function* () {
      const json = yield* encodeParcelEnvelopeJson(reduceLaneReds(sample, NOW, 20));
      expect(pipe(json, Str.includes("@"))).toBe(false);
      expect(pipe(json, Str.includes("/home/"))).toBe(false);
    })
  );

  it("caps reds at the budget with an N-of-M receipt", () => {
    const parcel = reduceLaneReds(sample, NOW, 2);
    expect(parcel.receipt).toEqual({ shown: 2, total: 4 });
  });

  it("reports no reds plainly", () => {
    const parcel = reduceLaneReds(LaneRedsInput.make({ checkouts: [checkout("main", [], O.some([]))] }), NOW, 20);
    expect(parcel.summary).toBe("no open P0/P1 reds across 1 lane");
    expect(parcel.freshness._tag).toBe("Fresh");
  });

  it("is Unknown{attribution-incomplete} when one checkout is unreadable or skipped lines", () => {
    const parcel = reduceLaneReds(
      LaneRedsInput.make({
        checkouts: [
          checkout("lane-a", [row({})], O.some([])),
          LaneCheckoutInput.make({ ...checkout("lane-b", [], O.none()), skippedLines: 2 }),
        ],
      }),
      NOW,
      20
    );
    expect(reasonOf(parcel.freshness)).toBe("attribution-incomplete");
    expect(parcel.summary).toBe(
      "1 of 1 red fresh; 1 P0, 0 P1 across 1 lane; unreadable: lane-b; 2 inbox lines skipped"
    );
  });

  it("names at most five stale lanes in the summary", () => {
    const old = (lane: string) => checkout(lane, [row({ observedAt: O.some(minutesAgo(60)) })], O.some([]));
    const parcel = reduceLaneReds(
      LaneRedsInput.make({ checkouts: A.map(["a", "b", "c", "d", "e", "f", "g"], old) }),
      NOW,
      20
    );
    expect(parcel.summary).toBe("0 of 7 reds fresh; 7 stale (a, b, c, d, e, +2 more); 7 P0, 0 P1 across 7 lanes");
  });

  it("is Unknown{unreachable} when no checkout could be read", () => {
    const parcel = reduceLaneReds(
      LaneRedsInput.make({
        checkouts: [LaneCheckoutInput.make({ ...checkout("lane-a", [], O.some([])), inboxReadable: false })],
      }),
      NOW,
      20
    );
    expect(reasonOf(parcel.freshness)).toBe("unreachable");
  });
});

describe("Parcels.read lane-reds", () => {
  const withSource = (snapshot: Effect.Effect<LaneRedsInput, SourceFailed>) =>
    layerParcels.pipe(Layer.provide(Layer.merge(failingSources, Layer.succeed(LaneRedsSource, { snapshot }))));

  it.layer(withSource(Effect.succeed(sample)), { timeout: "30 seconds" })("with a working source", (it) => {
    it.effect("serves the reds", () =>
      Effect.gen(function* () {
        yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
        const parcel = yield* Parcels.use((parcels) => parcels.read("lane-reds"));
        expect(parcel.key).toBe("lane");
        expect(parcel.receipt.total).toBe(4);
      })
    );
  });

  const unreadable = SourceFailed.make({ parcel: "lane-reds", detail: "checkout unreadable" });

  it.layer(unreadable.pipe(Effect.fail, withSource), { timeout: "30 seconds" })("with a failing source", (it) => {
    it.effect("serves Unknown{unreachable}", () =>
      Effect.gen(function* () {
        const parcel = yield* Parcels.use((parcels) => parcels.read("lane-reds"));
        expect(reasonOf(parcel.freshness)).toBe("unreachable");
        expect(parcel.summary).toBe("lane reds unavailable: checkout unreadable");
      })
    );
  });
});
