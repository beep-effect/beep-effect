import { fcRuns } from "@beep/fc-runs";
import {
  AccountHeadroomInput,
  AccountHeadroomSource,
  AccountsReportInput,
  AccountsReportInputJson,
  AccountsWindowRemaining,
  checkFreshness,
  layerPalantiriClientInProcess,
  layerParcels,
  PalantiriClient,
  ParcelEnvelope,
  Parcels,
  ParcelsReadSpan,
  reduceAccountHeadroom,
  SourceFailed,
  traceParentFromConfig,
  withTraceParent,
} from "@beep/palantiri";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";
import * as TestClock from "effect/testing/TestClock";
import { accountItems, failingSources } from "./fixtures/Sources.ts";
import type { Freshness } from "@beep/palantiri";

const NOON = "2026-10-14T12:00:00.000Z";
const NOON_TIME = DateTime.makeUnsafe(NOON);
const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const TRACEPARENT = `00-${TRACE_ID}-00f067aa0ca902c7-01`;

const encodeParcelEnvelopeJson = S.encodeEffect(S.fromJsonString(ParcelEnvelope));
const window = (kind: string, usedPercent: number) => ({ kind, scope: null, usedPercent, resetsAt: null });
const scopedWindow = (scope: string, usedPercent: number) => ({
  kind: "weekly-scoped",
  scope,
  usedPercent,
  resetsAt: null,
});

const row = (provider: string, label: string, outcome: Record<string, unknown>) => ({
  usage: { account: { provider, label, source: `/auth/${provider}-${label}.json` }, outcome },
  estimated: false,
});

const ok = (windows: ReadonlyArray<Record<string, unknown>>, asOf: string | null = null) => ({
  _tag: "Ok",
  identity: "someone@example.com",
  plan: "max",
  windows,
  credits: [],
  limitResets: null,
  asOf,
});

// Shaped like `beep accounts status --json`, including the fields the
// library ignores (identity, source, detail), which carry emails and paths.
const reportDocument = (generatedAt: string, rows: ReadonlyArray<ReturnType<typeof row>>) => ({
  schemaVersion: "accounts-status/v2",
  generatedAt,
  groups: [{ section: "mixed", rows }],
});

const decodeReport = S.decodeUnknownEffect(AccountsReportInput);

const sampleReport = decodeReport(
  reportDocument(NOON, [
    row("claude", "zed@example.com", ok([window("weekly", 40), window("session", 90)])),
    row("claude", "amy@example.com", ok([window("weekly", 70), scopedWindow("opus", 50), scopedWindow("sonnet", 10)])),
    row("codex", "work@example.com", { _tag: "NeedsLogin", detail: "login for work@example.com expired" }),
    row("grok", "x@example.com", { _tag: "Failed", detail: "timeout reading /home/x/.cli-proxy-api" }),
    // A collector snapshot ten hours old: retained, so it keeps its own asOf.
    row("grok-bot", "bot@example.com", ok([window("weekly", 24)], "2026-10-14T02:00:00.000Z")),
  ])
);

const EXPECTED = ["claude", "codex", "grok", "grok-bot"];

const inputOf = (expectedProviders: ReadonlyArray<string>) => (report: AccountsReportInput) =>
  AccountHeadroomInput.make({ report, expectedProviders: O.some(expectedProviders) });

const sampleInput = sampleReport.pipe(Effect.map(inputOf(EXPECTED)));

const reasonOf = (freshness: Freshness): string => (freshness._tag === "Unknown" ? freshness.reason : "fresh");

const sourceLayer = (snapshot: Effect.Effect<AccountHeadroomInput, SourceFailed>) =>
  Layer.succeed(AccountHeadroomSource, { snapshot });

const parcelsWith = (snapshot: Effect.Effect<AccountHeadroomInput, SourceFailed>) =>
  layerParcels.pipe(Layer.provide(Layer.merge(failingSources, sourceLayer(snapshot))));

describe("checkFreshness", () => {
  it.effect("is Fresh within the bound and Unknown{stale} past it", () =>
    Effect.gen(function* () {
      const asOf = NOON_TIME;
      yield* asOf.pipe(DateTime.toEpochMillis, TestClock.setTime);
      yield* TestClock.adjust(Duration.minutes(4));
      const now1 = yield* DateTime.now;
      const early = checkFreshness(now1, Duration.minutes(5), [asOf]);
      expect(early._tag).toBe("Fresh");
      yield* TestClock.adjust(Duration.minutes(2));
      const now2 = yield* DateTime.now;
      const late = checkFreshness(now2, Duration.minutes(5), [asOf]);
      expect(late._tag).toBe("Unknown");
      expect(late._tag === "Unknown" ? late.reason : "fresh").toBe("stale");
    })
  );

  it("is Unknown{no-source} with no readings", () => {
    const freshness = checkFreshness(DateTime.makeUnsafe(NOON), Duration.minutes(5), []);
    expect(freshness._tag === "Unknown" ? freshness.reason : "fresh").toBe("no-source");
  });
});

describe("reduceAccountHeadroom", () => {
  it.effect("numbers accounts per provider and never leaks a label", () =>
    Effect.gen(function* () {
      const sampleInput3 = yield* sampleInput;
      const parcel = reduceAccountHeadroom(sampleInput3, NOON_TIME, 20);
      const items = A.map(accountItems(parcel), (item) => [
        item.provider,
        item.account,
        item.state,
        reasonOf(item.freshness),
      ]);
      expect(items).toEqual([
        ["claude", 1, "ok", "fresh"],
        ["claude", 2, "ok", "fresh"],
        ["codex", 1, "needs-login", "unreachable"],
        ["grok", 1, "failed", "unreachable"],
        ["grok-bot", 1, "ok", "stale"],
      ]);
      // amy sorts before zed, so ordinal 1 carries amy's 30% weekly headroom.
      expect(A.map(accountItems(parcel)[0]?.windows ?? [], (window) => window.remainingPercent)).toEqual([30, 50, 90]);
      const json = yield* encodeParcelEnvelopeJson(parcel);
      expect(pipe(json, Str.includes("@"))).toBe(false);
      expect(pipe(json, Str.includes("/home"))).toBe(false);
      expect(pipe(json, Str.includes("example"))).toBe(false);
    })
  );

  it.effect("is Fresh with one stale item, and the summary names the split", () =>
    Effect.gen(function* () {
      const sampleInput4 = yield* sampleInput;
      const parcel = reduceAccountHeadroom(sampleInput4, NOON_TIME, 20);
      expect(parcel.freshness._tag).toBe("Fresh");
      const stale = A.findFirst(accountItems(parcel), (item) => item.provider === "grok-bot");
      assertSome(
        O.map(stale, (item) => reasonOf(item.freshness)),
        "stale"
      );
      assertSome(
        O.flatMap(stale, (item) => (item.freshness._tag === "Unknown" ? item.freshness.asOf : O.none())),
        DateTime.makeUnsafe("2026-10-14T02:00:00.000Z")
      );
      expect(parcel.summary).toBe(
        "2 of 5 accounts fresh; 1 stale (grok-bot), 2 unreachable (codex, grok); most weekly headroom: claude #2 at 60%"
      );
    })
  );

  it.effect("is Unknown{attribution-incomplete} when the provider listing failed", () =>
    Effect.gen(function* () {
      const report = yield* sampleReport;
      const parcel = reduceAccountHeadroom(
        AccountHeadroomInput.make({ report, expectedProviders: O.none() }),
        NOON_TIME,
        20
      );
      expect(reasonOf(parcel.freshness)).toBe("attribution-incomplete");
      expect(parcel.summary).toContain("provider listing unavailable");
    })
  );

  it.effect("is Unknown{attribution-incomplete} when an expected provider has no item", () =>
    Effect.gen(function* () {
      const argument = inputOf([...EXPECTED, "muse"]);
      const sampleReport1 = yield* sampleReport;
      const input = argument(sampleReport1);
      const parcel = reduceAccountHeadroom(input, NOON_TIME, 20);
      expect(reasonOf(parcel.freshness)).toBe("attribution-incomplete");
      expect(parcel.summary).toContain("no reading from muse");
    })
  );

  it.effect("caps items at the budget with an N-of-M receipt", () =>
    Effect.gen(function* () {
      const sampleInput5 = yield* sampleInput;
      const parcel = reduceAccountHeadroom(sampleInput5, NOON_TIME, 3);
      expect(parcel.items.length).toBe(3);
      expect(parcel.receipt).toEqual({ shown: 3, total: 5 });
    })
  );

  it.effect("is Unknown{stale} when the report it served is older than five minutes", () =>
    Effect.gen(function* () {
      const sampleInput6 = yield* sampleInput;
      const parcel = reduceAccountHeadroom(sampleInput6, DateTime.add(NOON_TIME, { minutes: 6 }), 20);
      expect(reasonOf(parcel.freshness)).toBe("stale");
    })
  );

  it.effect("round-trips the report through its JSON codec", () =>
    Effect.gen(function* () {
      const report = yield* sampleReport;
      const text = yield* S.encodeEffect(AccountsReportInputJson)(report);
      const back = yield* S.decodeEffect(AccountsReportInputJson)(text);
      expect(back.groups[0]?.rows.length).toBe(5);
    })
  );
});

const failingSource = Effect.fail(
  SourceFailed.make({ parcel: "account-headroom", detail: "accounts report unavailable" })
);

describe("account-headroom properties", () => {
  it.effect.prop(
    "keeps one item per account, numbers each provider from 1, and round-trips the envelope",
    [Arbitrary.schema(AccountsReportInput)],
    Effect.fnUntraced(function* ([report]) {
      const rows = A.flatMap(report.groups, (group) => group.rows);
      const parcel = reduceAccountHeadroom(inputOf([])(report), report.generatedAt, 500);
      expect(parcel.receipt.total).toBe(rows.length);
      const ordinals = A.map(accountItems(parcel), (item) => [item.provider, item.account] as const);
      A.forEach(ordinals, ([provider, ordinal], index) => {
        const before = A.filter(A.take(ordinals, index), ([other]) => other === provider);
        expect(ordinal).toBe(before.length + 1);
      });
      const codec = S.fromJsonString(ParcelEnvelope);
      const back = yield* codec
        .pipe(S.encodeEffect)(parcel)
        .pipe(Effect.flatMap(S.decodeEffect(codec)));
      expect(back.receipt).toEqual(parcel.receipt);
    }),
    { arbitrary: fcRuns(24) }
  );
});

describe("Parcels.read", () => {
  it.layer(parcelsWith(failingSource), { timeout: "30 seconds" })("with a failing source", (it) => {
    it.effect("serves Unknown{unreachable}", () =>
      Effect.gen(function* () {
        const parcel = yield* Parcels.use((parcels) => parcels.read("account-headroom"));
        expect(parcel.items).toEqual([]);
        expect(reasonOf(parcel.freshness)).toBe("unreachable");
        expect(parcel.summary).toBe("account headroom unavailable: accounts report unavailable");
      })
    );
  });

  it.layer(parcelsWith(sampleInput.pipe(Effect.orDie)), { timeout: "30 seconds" })("with a working source", (it) => {
    it.effect("fails an unknown id with UnknownParcel", () =>
      Effect.gen(function* () {
        const error = yield* Parcels.use((parcels) => parcels.read("weather")).pipe(Effect.flip);
        expect(error._tag).toBe("UnknownParcel");
        expect(error.parcel).toBe("weather");
      })
    );

    it.effect("records the Parcels.read span and gauges only fresh items", () =>
      Effect.gen(function* () {
        const spans = MutableHashMap.empty<string, Tracer.NativeSpan>();
        const tracer = Tracer.make({
          span(options) {
            const span = new Tracer.NativeSpan(options);
            MutableHashMap.set(spans, options.name, span);
            return span;
          },
        });
        yield* NOON_TIME.pipe(DateTime.toEpochMillis, TestClock.setTime);
        yield* Parcels.use((parcels) => parcels.read("account-headroom")).pipe(
          Effect.withSpan("caller"),
          Effect.withTracer(tracer)
        );
        const read = MutableHashMap.get(spans, ParcelsReadSpan.name);
        assertSome(
          O.map(read, (span) => span.attributes.get("beep.parcel")),
          "account-headroom"
        );
        assertSome(
          O.map(read, (span) => span.attributes.get("beep.parcel_freshness")),
          "fresh"
        );
        const snapshot7 = yield* Metric.snapshot;
        const gauges = A.filter(snapshot7, (metric) => metric.id === AccountsWindowRemaining.name);
        const readings = A.map(gauges, (metric) => [
          metric.attributes?.["beep.provider"],
          metric.attributes?.["beep.window"],
        ]);
        expect(readings).toContainEqual(["anthropic", "weekly"]);
        expect(readings).toContainEqual(["anthropic", "session"]);
        // grok-bot's only reading is stale, so xai never gets a series.
        expect(A.some(readings, ([provider]) => provider === "xai")).toBe(false);
        const weekly = A.findFirst(gauges, (metric) => metric.attributes?.["beep.window"] === "weekly");
        // The best Claude account has 60% of its week left.
        assertSome(
          O.map(weekly, (metric) => metric.state),
          { value: 60 }
        );
        // Each model group's weekly window is its own series, never merged into one max.
        const scoped = A.filterMap(gauges, (metric) =>
          metric.attributes?.["beep.window"] === "weekly-scoped"
            ? Result.succeed([metric.attributes?.["beep.window_scope"], metric.state])
            : Result.failVoid
        );
        expect(scoped).toHaveLength(2);
        expect(scoped).toContainEqual(["opus", { value: 50 }]);
        expect(scoped).toContainEqual(["sonnet", { value: 90 }]);
        assertSome(
          O.map(weekly, (metric) => metric.attributes?.["beep.window_scope"]),
          "all"
        );
        // A private registry, so series other blocks recorded cannot leak in (the
        // registry type is the Map Effect defines).
      }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
    );
  });
});

const clientLayer = layerPalantiriClientInProcess.pipe(
  Layer.provide(parcelsWith(sampleInput.pipe(Effect.orDie))),
  // Parcels never serve files, so the file-response support gets a no-op filesystem.
  Layer.provide(Layer.mergeAll(FileSystem.layerNoop({}), Path.layer))
);

describe("in-process client", () => {
  it.layer(clientLayer, { timeout: "30 seconds" })((it) => {
    it.effect("serves the encoded envelope and the 404 for an unknown parcel", () =>
      Effect.gen(function* () {
        const client = yield* PalantiriClient;
        const parcel = yield* client.parcels.read({ params: { id: "account-headroom" }, query: { budget: 2 } });
        expect(parcel.receipt).toEqual({ shown: 2, total: 5 });
        const error = yield* client.parcels.read({ params: { id: "weather" }, query: {} }).pipe(Effect.flip);
        expect(error._tag).toBe("UnknownParcel");
      })
    );
  });
});

describe("stale gauge series in a long-lived host", () => {
  const providersOf = Effect.map(Metric.snapshot, (snapshot) =>
    A.dedupe(
      A.filterMap(snapshot, (metric) =>
        metric.id === AccountsWindowRemaining.name
          ? Result.succeed(`${metric.attributes?.["beep.provider"]}`)
          : Result.failVoid
      )
    )
  );

  it.effect("drops a provider's series once its reading is stale", () =>
    Effect.gen(function* () {
      const parcels = yield* sampleInput.pipe(Effect.orDie, parcelsWith, Layer.build, Effect.map(Context.get(Parcels)));
      yield* NOON_TIME.pipe(DateTime.toEpochMillis, TestClock.setTime);
      yield* parcels.read("account-headroom");
      const providersOf8 = yield* providersOf;
      expect(providersOf8).toEqual(["anthropic"]);
      // Same process, same registry: ten minutes on, every Claude reading is past its bound.
      yield* TestClock.adjust(Duration.minutes(10));
      const later = yield* parcels.read("account-headroom");
      expect(A.every(later.items, (item) => item.freshness._tag === "Unknown")).toBe(true);
      const providersOf9 = yield* providersOf;
      expect(providersOf9).toEqual([]);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
  );

  it.effect("drops every series once the source fails", () =>
    Effect.gen(function* () {
      const failing = yield* Ref.make(false);
      const snapshot = Effect.flatMap(Ref.get(failing), (fail) =>
        fail
          ? Effect.fail(SourceFailed.make({ parcel: "account-headroom", detail: "accounts report unavailable" }))
          : sampleInput.pipe(Effect.orDie)
      );
      const parcels = yield* snapshot.pipe(parcelsWith, Layer.build, Effect.map(Context.get(Parcels)));
      yield* NOON_TIME.pipe(DateTime.toEpochMillis, TestClock.setTime);
      yield* parcels.read("account-headroom");
      const providersOf10 = yield* providersOf;
      expect(providersOf10).toEqual(["anthropic"]);
      yield* Ref.set(failing, true);
      const later = yield* parcels.read("account-headroom");
      expect(reasonOf(later.freshness)).toBe("unreachable");
      const providersOf11 = yield* providersOf;
      expect(providersOf11).toEqual([]);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
  );
});

describe("TRACEPARENT", () => {
  const withEnv = (env: Record<string, string>) =>
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

  it.effect("parses the caller's trace id", () =>
    Effect.gen(function* () {
      const parent = yield* traceParentFromConfig.pipe(withEnv({ TRACEPARENT }));
      assertSome(
        O.map(parent, (span) => span.traceId),
        TRACE_ID
      );
      const missing = yield* traceParentFromConfig.pipe(withEnv({}));
      assertNone(missing);
      const malformed = yield* traceParentFromConfig.pipe(withEnv({ TRACEPARENT: "garbage" }));
      assertNone(malformed);
    })
  );

  it.effect("nests a read under the caller's trace", () =>
    Effect.gen(function* () {
      const traceId = yield* Effect.currentSpan.pipe(
        Effect.map((span) => span.traceId),
        Effect.withSpan("Parcels.read"),
        withTraceParent,
        withEnv({ TRACEPARENT })
      );
      expect(traceId).toBe(TRACE_ID);
    })
  );
});
