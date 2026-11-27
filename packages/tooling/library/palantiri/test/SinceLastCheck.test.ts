import {
  AppErrorClassesMissingSource,
  InboxRowInput,
  LedgerRowInput,
  layerParcels,
  ParcelEnvelope,
  ParcelItem,
  ParcelReadOptions,
  Parcels,
  reduceAppErrorClasses,
  reduceSinceLastCheck,
  SinceLastCheckInput,
  SinceLastCheckSource,
  SourceFailed,
  sinceLastCheckBaseline,
  sinceLastCheckCursor,
} from "@beep/palantiri";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { failingSources } from "./fixtures/Sources.ts";
import type { Freshness, SessionChange } from "@beep/palantiri";

const encodeParcelEnvelope = S.encodeEffect(S.fromJsonString(ParcelEnvelope));

const NOW = DateTime.makeUnsafe("2026-10-15T12:00:00.000Z");
const minutesAgo = (minutes: number) => DateTime.subtract(NOW, { minutes });

const reasonOf = (freshness: Freshness): string => (freshness._tag === "Unknown" ? freshness.reason : "fresh");

const ledgerRow = (
  lane: string,
  recordedMinutesAgo: number,
  ownSession = false,
  summary: O.Option<string> = O.none()
) =>
  LedgerRowInput.make({
    lane,
    branch: `feat/${lane}`,
    state: "open",
    pr: O.none(),
    next: `next step in ${lane}`,
    summary,
    recordedAt: minutesAgo(recordedMinutesAgo),
    ownSession,
  });

const inboxRow = (observedMinutesAgo: number, acked = false) =>
  InboxRowInput.make({
    kind: "pr-merge-ready",
    severity: "P1",
    prNumber: O.some(1817),
    summary: "pull request is merge-ready",
    observedAt: O.some(minutesAgo(observedMinutesAgo)),
    acked,
    superseded: false,
  });

const changes = (parcel: ParcelEnvelope): ReadonlyArray<SessionChange> =>
  A.filter(parcel.items, ParcelItem.guards.SessionChange);

describe("reduceSinceLastCheck", () => {
  it("lists changes newer than the cursor, newest first, without the session's own notes", () => {
    const input = SinceLastCheckInput.make({
      cursor: O.some(minutesAgo(30)),
      lane: "palantiri-parcels-p2",
      ledger: [
        ledgerRow("lane-a", 10),
        ledgerRow("lane-b", 45),
        ledgerRow("palantiri-parcels-p2", 5, true),
        ledgerRow("lane-c", 1, false, O.some("mailed someone@example.com from /home/someone/src")),
      ],
      inbox: [inboxRow(20), inboxRow(40), inboxRow(3, true)],
      inboxReadable: true,
    });
    const parcel = reduceSinceLastCheck(input, NOW, 20);
    expect(A.map(changes(parcel), (change) => [change.source, change.lane])).toEqual([
      ["ledger", "lane-c"],
      ["ledger", "lane-a"],
      ["inbox", "palantiri-parcels-p2"],
    ]);
    expect(parcel.summary).toBe(
      "3 changes since 2026-10-15T11:30:00.000Z: 2 session notes (lane-c, lane-a), 1 inbox row"
    );
    expect(changes(parcel)[0]?.text).toBe("mailed [email] from $HOME/src");
    expect(parcel.freshness._tag).toBe("Fresh");
  });

  it("falls back to the session's newest own note when there is no cursor", () => {
    const input = SinceLastCheckInput.make({
      cursor: O.none(),
      lane: "main",
      ledger: [ledgerRow("main", 15, true), ledgerRow("lane-a", 20), ledgerRow("lane-b", 10)],
      inbox: [],
      inboxReadable: true,
    });
    assertSome(sinceLastCheckBaseline(input), minutesAgo(15));
    expect(A.map(changes(reduceSinceLastCheck(input, NOW, 20)), (change) => change.lane)).toEqual(["lane-b"]);
  });

  it("is Unknown{attribution-incomplete} when the inbox is unreadable, and caps at the budget", () => {
    const input = SinceLastCheckInput.make({
      cursor: O.none(),
      lane: "main",
      ledger: [ledgerRow("lane-a", 1), ledgerRow("lane-b", 2), ledgerRow("lane-c", 3)],
      inbox: [],
      inboxReadable: false,
    });
    const parcel = reduceSinceLastCheck(input, NOW, 2);
    expect(reasonOf(parcel.freshness)).toBe("attribution-incomplete");
    expect(parcel.receipt).toEqual({ shown: 2, total: 3 });
    expect(parcel.summary).toContain("since the first check");
    expect(parcel.summary).toContain("; inbox unreadable");
  });

  it.effect("encodes without addresses or home paths", () =>
    Effect.gen(function* () {
      const input = SinceLastCheckInput.make({
        cursor: O.none(),
        lane: "main",
        ledger: [ledgerRow("lane-a", 1, false, O.some("ping a@b.example about /Users/someone/x and @beep/palantiri"))],
        inbox: [],
        inboxReadable: true,
      });
      const json = yield* encodeParcelEnvelope(reduceSinceLastCheck(input, NOW, 20));
      expect(pipe(json, Str.includes("@"))).toBe(false);
      expect(pipe(json, Str.includes("/Users/"))).toBe(false);
      expect(pipe(json, Str.includes("/home/"))).toBe(false);
    })
  );
});

describe("sinceLastCheckCursor", () => {
  const busy = SinceLastCheckInput.make({
    cursor: O.some(minutesAgo(60)),
    lane: "main",
    ledger: [ledgerRow("lane-a", 50), ledgerRow("lane-b", 40), ledgerRow("lane-c", 30), ledgerRow("lane-d", 20)],
    inbox: [],
    inboxReadable: true,
  });

  it("serves the oldest changes past the budget and stops the cursor at the newest one served", () => {
    const parcel = reduceSinceLastCheck(busy, NOW, 2);
    expect(A.map(changes(parcel), (change) => change.lane)).toEqual(["lane-b", "lane-a"]);
    expect(parcel.receipt.shown).toBe(2);
    expect(parcel.receipt.total).toBe(4);
    expect(parcel.summary).toContain("2 newer changes pending, read again");
    assertSome(sinceLastCheckCursor(busy, NOW, 2), minutesAgo(40));
    const next = SinceLastCheckInput.make({ ...busy, cursor: O.some(minutesAgo(40)) });
    expect(
      A.map(changes(reduceSinceLastCheck(next, NOW, 2)), (change) => change.lane),
      "the next read from that cursor serves the two held back"
    ).toEqual(["lane-d", "lane-c"]);
    assertSome(sinceLastCheckCursor(next, NOW, 2), NOW);
  });

  it("never splits changes that share the boundary timestamp", () => {
    const tied = SinceLastCheckInput.make({
      cursor: O.some(minutesAgo(60)),
      lane: "main",
      ledger: [ledgerRow("lane-a", 20), ledgerRow("lane-b", 20), ledgerRow("lane-c", 30)],
      inbox: [],
      inboxReadable: true,
    });
    expect(
      A.map(changes(reduceSinceLastCheck(tied, NOW, 2)), (change) => change.lane),
      "[a@t2, b@t2, c@t1] with budget 2: serving [b, c] and moving to t2 would lose a"
    ).toEqual(["lane-c"]);
    assertSome(sinceLastCheckCursor(tied, NOW, 2), minutesAgo(30));
    const next = SinceLastCheckInput.make({ ...tied, cursor: O.some(minutesAgo(30)) });
    expect(
      pipe(
        changes(reduceSinceLastCheck(next, NOW, 2)),
        A.map((change) => change.lane),
        A.sort(Order.String)
      )
    ).toEqual(["lane-a", "lane-b"]);
    assertSome(sinceLastCheckCursor(next, NOW, 2), NOW);
  });

  it("serves a whole same-timestamp group past the budget rather than stall", () => {
    const burst = SinceLastCheckInput.make({
      cursor: O.some(minutesAgo(60)),
      lane: "main",
      ledger: [ledgerRow("lane-a", 20), ledgerRow("lane-b", 20), ledgerRow("lane-c", 20), ledgerRow("lane-d", 5)],
      inbox: [],
      inboxReadable: true,
    });
    const parcel = reduceSinceLastCheck(burst, NOW, 2);
    expect(changes(parcel)).toHaveLength(3);
    expect(parcel.summary).toContain("1 newer change pending");
    assertSome(sinceLastCheckCursor(burst, NOW, 2), minutesAgo(20));
  });

  it("moves to the read time when everything fit, and stays put when the inbox was unreadable", () => {
    assertSome(sinceLastCheckCursor(busy, NOW, 20), NOW);
    assertNone(sinceLastCheckCursor(SinceLastCheckInput.make({ ...busy, inboxReadable: false }), NOW, 20));
  });
});

describe("Parcels.read since-last-check", () => {
  const inMemoryCursorStore = Effect.gen(function* () {
    const cursor = yield* Ref.make(O.none<DateTime.Utc>());
    const source = SinceLastCheckSource.of({
      read: Effect.fn("SinceLastCheckSource.memory.read")(() =>
        Ref.get(cursor).pipe(
          Effect.map((stored) =>
            SinceLastCheckInput.make({
              cursor: stored,
              lane: "main",
              ledger: [ledgerRow("lane-a", 10)],
              inbox: [],
              inboxReadable: true,
            })
          )
        )
      ),
      advance: Effect.fn("SinceLastCheckSource.memory.advance")((_session, at) => Ref.set(cursor, O.some(at))),
    });
    return Layer.succeed(SinceLastCheckSource, source);
  });

  it.layer(layerParcels.pipe(Layer.provide(Layer.merge(failingSources, Layer.unwrap(inMemoryCursorStore)))), {
    timeout: "30 seconds",
  })("with a cursor store", (it) => {
    it.effect("needs a session id, then advances the cursor on read", () =>
      Effect.gen(function* () {
        yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
        const anonymous = yield* Parcels.use((parcels) => parcels.read("since-last-check"));
        expect(reasonOf(anonymous.freshness)).toBe("attribution-incomplete");
        expect(anonymous.summary).toBe("since last check needs a session id");
        const options = ParcelReadOptions.make({ session: O.some("session-1") });
        const first = yield* Parcels.use((parcels) => parcels.read("since-last-check", options));
        expect(first.receipt.total).toBe(1);
        const second = yield* Parcels.use((parcels) => parcels.read("since-last-check", options));
        expect(second.receipt.total).toBe(0);
        expect(second.summary).toBe("nothing new since 2026-10-15T12:00:00.000Z");
      })
    );
  });

  it.layer(
    layerParcels.pipe(
      Layer.provide(
        Layer.merge(
          failingSources,
          Layer.succeed(SinceLastCheckSource, {
            read: Effect.fn("SinceLastCheckSource.empty.read")(() =>
              Effect.succeed(
                SinceLastCheckInput.make({ cursor: O.none(), lane: "main", ledger: [], inbox: [], inboxReadable: true })
              )
            ),
            advance: Effect.fn("SinceLastCheckSource.readOnly.advance")(() =>
              Effect.fail(SourceFailed.make({ parcel: "since-last-check", detail: "read-only state" }))
            ),
          })
        )
      )
    ),
    { timeout: "30 seconds" }
  )("with a cursor that cannot be saved", (it) => {
    it.effect("still serves the parcel and says the cursor was not saved", () =>
      Effect.gen(function* () {
        const parcel = yield* Parcels.use((parcels) =>
          parcels.read("since-last-check", ParcelReadOptions.make({ session: O.some("session-1") }))
        );
        expect(parcel.summary).toBe("nothing new since the first check; read cursor not saved (read-only state)");
      })
    );
  });
});

describe("app-error-classes", () => {
  it("is Unknown{no-source} with no items, naming the missing adapter", () => {
    const parcel = reduceAppErrorClasses(NOW, 20);
    expect(reasonOf(parcel.freshness)).toBe("no-source");
    expect(parcel.freshness._tag === "Unknown" ? O.getOrUndefined(parcel.freshness.detail) : "").toBe(
      AppErrorClassesMissingSource
    );
    expect(parcel.items).toEqual([]);
    expect(parcel.receipt).toEqual({ shown: 0, total: 0 });
    expect(parcel.summary).toBe("app error classes unavailable: no telemetry query adapter exists yet");
  });

  it.layer(layerParcels.pipe(Layer.provide(failingSources)), { timeout: "30 seconds" })((it) => {
    it.effect("is served through Parcels.read without a source port", () =>
      Effect.gen(function* () {
        const parcel = yield* Parcels.use((parcels) => parcels.read("app-error-classes"));
        expect(parcel.key).toBe("app");
        expect(reasonOf(parcel.freshness)).toBe("no-source");
      })
    );
  });
});
