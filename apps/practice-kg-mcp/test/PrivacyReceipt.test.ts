import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  StrictEgressRecord,
  StrictSpoolOptions,
  StrictSpoolOutcome,
  StrictSpoolSurvey,
  StrictSpoolSurveyEntry,
} from "@beep/observability/strict";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as OtlpExporter from "effect/observability/OtlpExporter";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import {
  PracticeKgPrivacyReceipt,
  PracticeKgReceiptWindow,
  printPracticeKgPrivacyReceipt,
  renderPracticeKgPrivacyReceipt,
  runPracticeKgPrivacyReceipt,
  summarizePracticeKgSpool,
} from "../src/runtime/PrivacyReceipt.ts";
import { layerPracticeKgTelemetrySpooled } from "../src/runtime/Telemetry.ts";
import { layerPracticeKgDpapi, layerPracticeKgSpoolKey } from "../src/runtime/TelemetryKey.ts";
import golden from "./__golden__/privacy-receipt.golden.json" with { type: "json" };

// Assembled at runtime so no literal canary sits in source.
const canary = A.join(["Receipt", "Qz", "Canary", "6043"], "");

// Raw, lowercased, URL-encoded, base64, 8-character prefix and unsalted
// SHA-256 forms of the canary.
const canaryForms = [
  canary,
  Str.toLowerCase(canary),
  encodeURIComponent(canary),
  Base64.encode(canary),
  Str.slice(0, 8)(canary),
  new Bun.CryptoHasher("sha256").update(canary).digest("hex"),
];

const countCanaries = (text: string): number =>
  A.reduce(canaryForms, 0, (count, form) => count + A.length(Str.split(text, form)) - 1);

const day = Duration.toMillis(Duration.days(1));
const window = PracticeKgReceiptWindow.make({ startMillis: 10 * day, endMillis: 17 * day });

const refusedPoint = (tag: string, start: string, asInt: number | string) => ({
  attributes: [{ key: "beep.schema_failure_tag", value: { stringValue: tag } }],
  startTimeUnixNano: start,
  timeUnixNano: start,
  asInt,
});

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const metricsBody = (points: ReadonlyArray<unknown>, extra: ReadonlyArray<unknown> = []) =>
  encodeJson({
    resourceMetrics: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "practice-kg-mcp" } }] },
        scopeMetrics: [
          {
            scope: { name: "practice-kg-mcp" },
            metrics: [{ name: "beep.telemetry.refused", sum: { dataPoints: points } }, ...extra],
          },
        ],
      },
    ],
  });

const tracesBody = encodeJson({
  resourceSpans: [
    {
      resource: { attributes: [{ key: "beep.key_epoch", value: { stringValue: "3" } }] },
      scopeSpans: [
        {
          scope: { name: "practice-kg-mcp" },
          spans: [
            {
              name: "kg_find",
              attributes: [
                { key: "beep.practice_kg.tool", value: { stringValue: "kg_find" } },
                { key: "beep.duration_bucket", value: { stringValue: "50ms" } },
                { key: `leak.${Str.toLowerCase(canary)}`, value: { stringValue: canary } },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const opened = (sealedAtMillis: number, sizeBytes: number, signal: "traces" | "metrics" | "logs", body: string) =>
  StrictSpoolSurveyEntry.make({
    sealedAtMillis,
    sizeBytes,
    outcome: StrictSpoolOutcome.cases.opened.make({ record: StrictEgressRecord.make({ signal, body }) }),
  });

// One segment before the window, five in it (one refused) and one after it.
const makeSurvey = Effect.gen(function* () {
  const traces = yield* tracesBody;
  const earlierMetrics = yield* metricsBody([
    refusedPoint("log-record-dropped", "100", 4),
    refusedPoint("egress-refused", "100", 2),
    refusedPoint("spool-write-failed", "100", 1),
  ]);
  const metrics = yield* metricsBody(
    [
      refusedPoint("log-record-dropped", "100", 10),
      refusedPoint("egress-refused", "100", 5),
      // A process started inside the window: its whole count is in-window growth.
      refusedPoint("span-name-not-allowed", `${11 * day * 1_000_000}`, "7"),
      refusedPoint("spool-write-failed", "100", 3),
      // Started before the window, but no point before it survives: truncated.
      refusedPoint("spool-evict-failed", "100", 1),
      refusedPoint(canary, "900", 99),
    ],
    [
      { name: "beep.practice_kg.process.rss", gauge: { dataPoints: [{ attributes: [], asDouble: 1 }] } },
      { name: `beep.${Str.toLowerCase(canary)}.metric`, gauge: { dataPoints: [] } },
    ]
  );
  return StrictSpoolSurvey.make({
    entries: [
      opened(9 * day, 700, "metrics", earlierMetrics),
      opened(11 * day, 900, "metrics", metrics),
      opened(12 * day, 400, "traces", traces),
      StrictSpoolSurveyEntry.make({
        sealedAtMillis: 13 * day,
        sizeBytes: 100,
        outcome: StrictSpoolOutcome.cases.refused.make({ tag: "spool-segment-invalid" }),
      }),
      opened(14 * day, 50, "logs", '{"resourceLogs":[]}'),
      opened(17 * day, 999, "traces", traces),
    ],
  });
});

const receiptOf = (summary: ReturnType<typeof summarizePracticeKgSpool>) =>
  PracticeKgPrivacyReceipt.make({
    window,
    tier: "shape-only",
    telemetryDir: "resolved",
    key: { status: "loaded", protection: "dpapi-ffi", epoch: 3 },
    ...summary,
  });

describe("practice KG privacy receipt", () => {
  it.effect("renders the golden receipt: counts, tag and key names, the dir token, nothing else", () =>
    Effect.gen(function* () {
      const survey = yield* makeSurvey;
      const text = renderPracticeKgPrivacyReceipt(receiptOf(summarizePracticeKgSpool(survey, window)));
      expect(Str.split(text, "\n")).toEqual(golden);
      expect(countCanaries(text)).toBe(0);
      expect(Str.includes("kg_find")(text)).toBe(false);
      expect(Str.includes("50ms")(text)).toBe(false);
    })
  );

  it.effect("counts each refusal series' growth inside the window, never its total", () =>
    Effect.gen(function* () {
      const argument = summarizePracticeKgSpool(window);
      const madeSurvey = yield* makeSurvey;
      const { refusals, spool, truncated, unlistedNames } = argument(madeSurvey);
      expect(HashMap.toEntries(refusals)).toEqual(
        expect.arrayContaining([
          ["log-record-dropped", 6],
          ["egress-refused", 3],
          ["span-name-not-allowed", 7],
          ["spool-write-failed", 2],
        ])
      );
      expect(HashMap.size(refusals)).toBe(4);
      expect(truncated).toEqual(["spool-evict-failed"]);
      expect(spool.segments).toEqual({ traces: 1, metrics: 1, logs: 1 });
      expect([spool.bytes, spool.earlier]).toEqual([1_450, 1]);
      expect(HashMap.toEntries(spool.refused)).toEqual([["spool-segment-invalid", 1]]);
      // The unlisted attribute key and the unlisted metric name.
      expect(unlistedNames).toBe(2);
    })
  );

  it.effect("takes the earliest surviving point as the baseline when earlier points were evicted", () =>
    Effect.gen(function* () {
      // Process started before the window; its pre-window segments are gone.
      const first = yield* metricsBody([refusedPoint("egress-refused", "100", 40)]);
      const later = yield* metricsBody([refusedPoint("egress-refused", "100", 46)]);
      const evicted = StrictSpoolSurvey.make({
        entries: [opened(11 * day, 300, "metrics", first), opened(12 * day, 300, "metrics", later)],
      });
      const summary = summarizePracticeKgSpool(evicted, window);
      expect(HashMap.toEntries(summary.refusals)).toEqual([["egress-refused", 6]]);
      expect(summary.truncated).toEqual(["egress-refused"]);
      const text = renderPracticeKgPrivacyReceipt(receiptOf(summary));
      expect(Str.includes("| egress-refused | ≥ 6, baseline truncated |")(text)).toBe(true);
    })
  );

  it.effect("lists a truncated gate tag that grew by 0 instead of printing None", () =>
    Effect.gen(function* () {
      // Started before the window, one surviving point, no growth since it.
      const only = yield* metricsBody([refusedPoint("log-record-dropped", "100", 12)]);
      const summary = summarizePracticeKgSpool(
        StrictSpoolSurvey.make({ entries: [opened(11 * day, 300, "metrics", only)] }),
        window
      );
      expect(HashMap.size(summary.refusals)).toBe(0);
      expect(summary.truncated).toEqual(["log-record-dropped"]);
      const text = renderPracticeKgPrivacyReceipt(receiptOf(summary));
      const gateSection = Str.split(text, "## Spool refusals in the window")[0] ?? "";
      expect(Str.includes("| log-record-dropped | ≥ 0, baseline truncated |")(gateSection)).toBe(true);
      expect(Str.includes("None.")(gateSection)).toBe(false);
    })
  );
});

const telemetryDir = "/home/attorney/.local/state/beep/practice-kg/telemetry";
const spoolOptions = StrictSpoolOptions.make({ directory: `${telemetryDir}/spool`, tier: "shape-only" });

// The dev key port never spawns; any spawn is a defect.
const noSpawn = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make(() => Effect.die("The privacy receipt must not spawn a process off Windows"))
);

const volume = Layer.mergeAll(MemoryFileSystem.layer, Path.layer, noSpawn);

// Exports the canary through the spooled host telemetry, as a log body inside
// a tool span and as a span name; the final export runs when the scope closes.
const exportThroughSpool = Effect.gen(function* () {
  yield* Effect.logError(canary).pipe(Effect.withSpan("PracticeKgTools.kg_find"));
  yield* Effect.void.pipe(Effect.withSpan(`PracticeKgTools.${canary}`));
  yield* (yield* OtlpExporter.Flusher).flush;
}).pipe(
  provideScopedLayer(
    layerPracticeKgTelemetrySpooled(spoolOptions).pipe(
      Layer.provide(layerPracticeKgSpoolKey(telemetryDir)),
      Layer.provide(layerPracticeKgDpapi("linux"))
    )
  )
);

// A clock stopped at `millis`; its sleeps never end, so the exporter only
// exports when its scope closes.
const clockAt = (millis: number): Clock.Clock => ({
  currentTimeMillisUnsafe: () => millis,
  currentTimeMillis: Effect.succeed(millis),
  currentTimeNanosUnsafe: () => BigInt(millis) * BigInt(1_000_000),
  currentTimeNanos: Effect.succeed(BigInt(millis) * BigInt(1_000_000)),
  monotonicTimeNanosUnsafe: () => BigInt(millis) * BigInt(1_000_000),
  monotonicTimeNanos: Effect.succeed(BigInt(millis) * BigInt(1_000_000)),
  sleep: () => Effect.never,
});

const listTree = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readDirectory(directory, { recursive: true });
});

describe("practice-kg-mcp --privacy-receipt", () => {
  it.layer(volume, { timeout: "30 seconds" })((it) => {
    it.effect("reads the key and spool, writes nothing, and prints only counts and names", () =>
      Effect.gen(function* () {
        yield* exportThroughSpool.pipe(Effect.provideService(Clock.Clock, clockAt(0)));
        yield* exportThroughSpool.pipe(Effect.provideService(Clock.Clock, clockAt(9 * day)));
        const before = yield* listTree(telemetryDir);

        const receipt = yield* runPracticeKgPrivacyReceipt().pipe(
          Effect.provideService(Clock.Clock, clockAt(9 * day + 60_000))
        );
        yield* printPracticeKgPrivacyReceipt(Effect.succeed(receipt));
        const pipe1 = yield* TestConsole.logLines.pipe(Effect.map(A.map((line) => `${line}`)));
        const printed = A.join(pipe1, "\n");

        const listTree2 = yield* listTree(telemetryDir);
        expect(listTree2).toEqual(before);
        expect(receipt.telemetryDir).toBe("resolved");
        expect(receipt.key).toEqual({ status: "loaded", protection: "dev-file", epoch: 1 });
        expect(receipt.spool.status).toEqual({ _tag: "read" });
        expect(receipt.spool.earlier).toBeGreaterThan(0);
        expect(receipt.spool.segments.traces).toBeGreaterThan(0);
        expect(receipt.spool.segments.metrics).toBeGreaterThan(0);
        const expectedTags = ["log-record-dropped", "span-name-not-allowed", "resource-rebuilt"] as const;
        expect(A.filter(expectedTags, (tag) => !HashMap.has(receipt.refusals, tag))).toEqual([]);
        expect(receipt.attributeKeys).toEqual(expect.arrayContaining(["beep.practice_kg.tool", "service.name"]));
        expect(receipt.metricNames).toEqual(["beep.telemetry.refused"]);
        expect(Str.includes(telemetryDir)(printed)).toBe(false);
        expect(Str.includes("<telemetry dir>")(printed)).toBe(true);
        expect(countCanaries(printed)).toBe(0);
      }).pipe(
        Effect.provideService(HostProcessPlatform, "linux"),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PRACTICE_KG_TELEMETRY_DIR: telemetryDir })
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        // A registry of its own: coverage runs files unisolated, so the default
        // registry may already hold other files' metrics, which this export would carry.
        Effect.provideService(Metric.MetricRegistry, new Map())
      )
    );

    it.effect("reports a missing key and leaves the spool unread, creating nothing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const receipt = yield* runPracticeKgPrivacyReceipt();
        expect(receipt.key).toEqual({ status: "missing" });
        expect(receipt.spool.status).toEqual({ _tag: "no-key" });
        const exists3 = yield* fs.exists("/fresh");
        expect(exists3).toBe(false);
        expect(renderPracticeKgPrivacyReceipt(receipt)).toContain("- Spool: not read (no key loaded)");
      }).pipe(
        Effect.provideService(HostProcessPlatform, "linux"),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PRACTICE_KG_TELEMETRY_DIR: "/fresh/telemetry" })
        )
      )
    );

    it.effect("reports a survey that failed after the key loaded by its operation only", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const brokenDir = "/broken/telemetry";
        yield* Layer.build(layerPracticeKgSpoolKey(brokenDir).pipe(Layer.provide(layerPracticeKgDpapi("linux"))));
        // A file where the spool directory should be: listing it fails.
        yield* fs.writeFileString(`${brokenDir}/spool`, canary);
        const receipt = yield* runPracticeKgPrivacyReceipt();
        expect(receipt.key.status).toBe("loaded");
        expect(receipt.spool.status).toEqual({ _tag: "survey-failed", operation: "replay" });
        expect(HashMap.size(receipt.refusals)).toBe(0);
        const text = renderPracticeKgPrivacyReceipt(receipt);
        expect(text).toContain("- Spool: not read (the key loaded but the spool `replay` step failed)");
        expect(text).not.toContain("no key loaded");
        expect(Str.includes(brokenDir)(text)).toBe(false);
        expect(countCanaries(text)).toBe(0);
      }).pipe(
        Effect.provideService(HostProcessPlatform, "linux"),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PRACTICE_KG_TELEMETRY_DIR: "/broken/telemetry" })
        )
      )
    );
  });
});
