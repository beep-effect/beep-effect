import { effectiveTier, StrictDesktop, TelemetryTier } from "@beep/observability/catalog";
import {
  coarsenMetricValue,
  durationBucketOf,
  GateRule,
  GateRules,
  layerInMemoryEgressSink,
  layerStrictOtlp,
  makeStrictGate,
  ShapeOnlySpan,
  StrictEgressSink,
  StrictGate,
  StrictGateRulesOn,
} from "@beep/observability/strict";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as OtlpExporter from "effect/observability/OtlpExporter";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  batchCanary,
  representativeLogs,
  representativeMetrics,
  representativeTraces,
} from "./support/StrictGate.batches.ts";
import { bodyJson, bodyText, demoConfig, layerTestSalt } from "./support/StrictGate.harness.ts";
import type { TelemetryRefusalTag } from "@beep/observability/catalog";

const SpanBody = S.Struct({
  resourceSpans: S.Array(
    S.Struct({
      resource: S.Unknown,
      scopeSpans: S.Array(S.Struct({ scope: S.Unknown, spans: S.Array(S.Unknown) })),
    })
  ),
});
const decodeSpanBody = S.decodeUnknownEffect(SpanBody);
const decodeShapeOnlySpan = S.decodeUnknownEffect(ShapeOnlySpan);
const decodeSpans = (spans: ReadonlyArray<unknown>) =>
  Effect.forEach(spans, (span) => decodeShapeOnlySpan(span, { onExcessProperty: "error" }));

type Gate = Effect.Success<ReturnType<typeof makeStrictGate>>;

const countOf = (ledger: HashMap.HashMap<TelemetryRefusalTag, number>, tag: TelemetryRefusalTag): number =>
  O.getOrElse(HashMap.get(ledger, tag), () => 0);

const exportedSpans = Effect.fnUntraced(function* (gate: Gate) {
  const body = yield* bodyJson(gate.serialization.traces(representativeTraces())).pipe(Effect.flatMap(decodeSpanBody));
  return A.flatMap(body.resourceSpans, (resource) => A.flatMap(resource.scopeSpans, (scope) => scope.spans));
});

// Rules that guard content; span ids, timestamps and names guard linkage and
// are checked by their own test.
const contentRules = A.filter(
  GateRule.literals,
  (rule) => rule !== "span-ids" && rule !== "span-timestamps" && rule !== "span-name" && rule !== "metric-values"
);

const MetricsBody = S.fromJsonString(
  S.Struct({
    resourceMetrics: S.Array(
      S.Struct({
        scopeMetrics: S.Array(S.Struct({ metrics: S.Array(S.Record(S.String, S.Unknown)) })),
      })
    ),
  })
);
const decodeMetricsBody = S.decodeUnknownEffect(MetricsBody);

// The exported metric entries with the given name, as decoded JSON records.
const exportedMetrics = Effect.fnUntraced(function* (rules: GateRules, name: string) {
  const gate = yield* makeStrictGate(demoConfig(rules));
  const body = yield* decodeMetricsBody(bodyText(gate.serialization.metrics(representativeMetrics())));
  const metrics = A.flatMap(body.resourceMetrics, (resource) =>
    A.flatMap(resource.scopeMetrics, (scope) => scope.metrics)
  );
  return { gate, metrics: A.filter(metrics, (metric) => metric.name === name) };
});

const leaks = Effect.fnUntraced(function* (rules: GateRules) {
  const gate = yield* makeStrictGate(demoConfig(rules));
  return A.some(
    [
      bodyText(gate.serialization.traces(representativeTraces())),
      bodyText(gate.serialization.metrics(representativeMetrics())),
      bodyText(gate.serialization.logs(representativeLogs())),
    ],
    Str.includes(batchCanary())
  );
});

const encodeUnknownJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const tracesText = (gate: Gate): string => bodyText(gate.serialization.traces(representativeTraces()));
const metricsText = (gate: Gate): string => bodyText(gate.serialization.metrics(representativeMetrics()));
const logsText = (gate: Gate): string => bodyText(gate.serialization.logs(representativeLogs()));

// Acceptance #3: one mutant per gate rule. Each names the batch to serialize
// and the bytes that rule alone keeps out of it, so turning exactly that rule
// off makes the needle appear. The mapped type makes a new rule without a
// mutant a type error, and the completeness test makes it a red test.
type GateMutant = { readonly exported: (gate: Gate) => string; readonly needle: () => string };

const gateMutants: { readonly [Rule in GateRule]: GateMutant } = {
  "span-name": { exported: tracesText, needle: () => '"name":"db.query"' },
  "span-attributes": { exported: tracesText, needle: batchCanary },
  "span-events": { exported: tracesText, needle: batchCanary },
  "span-links": { exported: tracesText, needle: batchCanary },
  "span-status-message": { exported: tracesText, needle: batchCanary },
  "span-ids": { exported: tracesText, needle: () => '"spanId":"b7ad6b7169203331"' },
  "span-timestamps": { exported: tracesText, needle: () => '"startTimeUnixNano":"1700000123456789000"' },
  resource: { exported: tracesText, needle: batchCanary },
  logs: { exported: logsText, needle: batchCanary },
  "metric-names": { exported: metricsText, needle: batchCanary },
  "metric-attributes": { exported: metricsText, needle: batchCanary },
  "metric-values": { exported: metricsText, needle: () => '"asInt":1234567' },
};

const exportsNeedle = Effect.fnUntraced(function* (rules: GateRules, mutant: GateMutant) {
  const gate = yield* makeStrictGate(demoConfig(rules));
  return F.pipe(mutant.exported(gate), Str.includes(mutant.needle()));
});

describe("StrictGate", () => {
  it.layer(layerTestSalt, { timeout: "10 seconds" })((it) => {
    it.effect("has a mutant for every gate rule", () =>
      Effect.sync(() => {
        expect(A.sort(R.keys(gateMutants), Order.String)).toEqual(A.sort(GateRule.literals, Order.String));
      })
    );

    it.effect("exports no mutant's needle with every rule on", () =>
      Effect.gen(function* () {
        for (const rule of GateRule.literals) {
          expect([rule, yield* exportsNeedle(StrictGateRulesOn, gateMutants[rule])]).toEqual([rule, false]);
        }
      })
    );

    for (const rule of GateRule.literals) {
      it.effect(`goes red when only the ${rule} rule is off`, () =>
        Effect.gen(function* () {
          const exportsNeedle1 = yield* exportsNeedle({ ...StrictGateRulesOn, [rule]: false }, gateMutants[rule]);
          expect(exportsNeedle1).toBe(true);
        })
      );
    }

    it.effect("exports only tool spans, in the shape-only wire shape, under their tool ids", () =>
      Effect.gen(function* () {
        const gate = yield* makeStrictGate(demoConfig());
        const spans = yield* exportedSpans(gate).pipe(Effect.flatMap(decodeSpans));
        expect(A.map(spans, (span) => span.name)).toEqual(["lookup", "search"]);
        for (const span of spans) {
          expect(span.events).toEqual([]);
          expect(span.links).toEqual([]);
          expect(span.status).toEqual({ code: span.name === "search" ? 2 : 1 });
          expect([span.startTimeUnixNano, span.endTimeUnixNano]).toEqual([
            "1700000100000000000",
            "1700000100000000000",
          ]);
        }
        expect(A.map(spans, (span) => A.map(span.attributes, (attribute) => attribute.key))).toEqual([
          ["beep.privacy_tier", "beep.demo.tool", "beep.duration_bucket"],
          ["beep.demo.tool", "beep.duration_bucket"],
        ]);
        expect(A.map(spans, (span) => A.map(span.attributes, (attribute) => attribute.value.stringValue))).toEqual([
          ["shape-only", "lookup", "50ms"],
          ["search", "5s"],
        ]);
      })
    );

    it.effect("keys ids per batch: parent links hold inside a batch and nothing links across batches", () =>
      Effect.gen(function* () {
        const gate = yield* makeStrictGate(demoConfig());
        const first = yield* exportedSpans(gate).pipe(Effect.flatMap(decodeSpans));
        const second = yield* exportedSpans(gate).pipe(Effect.flatMap(decodeSpans));
        const idsOf = A.flatMap((span: ShapeOnlySpan) => [span.traceId, span.spanId]);
        // The handler span still names the dispatch span as its parent, and both share one trace.
        expect(A.map(first, (span) => span.parentSpanId)).toEqual(
          expect.arrayContaining(A.map(A.take(first, 1), (span) => span.spanId))
        );
        expect(A.dedupe(A.map(first, (span) => span.traceId))).toHaveLength(1);
        expect(idsOf(first)).not.toContain("b7ad6b7169203331");
        expect(A.intersection(idsOf(first), idsOf(second))).toEqual([]);
      })
    );

    it.effect("counts every span-level drop under its refusal tag", () =>
      Effect.gen(function* () {
        const gate = yield* makeStrictGate(demoConfig());
        yield* exportedSpans(gate);
        const ledger = yield* gate.ledger;
        expect(countOf(ledger, "span-name-not-allowed")).toBe(1);
        expect(countOf(ledger, "attribute-not-allowed")).toBe(3);
        expect(countOf(ledger, "span-event-dropped")).toBe(1);
        expect(countOf(ledger, "span-link-dropped")).toBe(1);
        expect(countOf(ledger, "span-status-message-dropped")).toBe(1);
        expect(countOf(ledger, "resource-rebuilt")).toBe(1);
      })
    );

    it.effect("rebuilds the resource from constants and names no host", () =>
      Effect.gen(function* () {
        const gate = yield* makeStrictGate(demoConfig());
        const text = bodyText(gate.serialization.traces(representativeTraces()));
        expect(Str.includes(batchCanary())(text)).toBe(false);
        expect(Str.includes("host.name")(text)).toBe(false);
        expect(Str.includes('"key":"beep.key_epoch"')(text)).toBe(true);
      })
    );

    it.effect("keeps allowlisted metric points, refuses the rest, and appends the refusal counter", () =>
      Effect.gen(function* () {
        const gate = yield* makeStrictGate(demoConfig());
        const text = bodyText(gate.serialization.metrics(representativeMetrics()));
        const ledger = yield* gate.ledger;
        expect(countOf(ledger, "metric-not-allowed")).toBe(2);
        expect(countOf(ledger, "metric-attribute-not-allowed")).toBe(1);
        expect(Str.includes(batchCanary())(text)).toBe(false);
        expect(Str.includes('"name":"beep.demo.calls"')(text)).toBe(true);
        expect(Str.includes('"name":"beep.telemetry.refused"')(text)).toBe(true);
        expect(Str.includes('"stringValue":"metric-not-allowed"')(text)).toBe(true);
      })
    );

    it.effect("drops every log record and counts each one", () =>
      Effect.gen(function* () {
        const gate = yield* makeStrictGate(demoConfig());
        const text = bodyText(gate.serialization.logs(representativeLogs()));
        expect(text).toBe('{"resourceLogs":[]}');
        const ledger2 = yield* gate.ledger;
        expect(countOf(ledger2, "log-record-dropped")).toBe(2);
      })
    );

    it.effect.prop(
      "leaks the canary exactly when some content rule is off, for any rule table",
      [Arbitrary.schema(GateRules)],
      ([rules]) =>
        Effect.gen(function* () {
          const leaks3 = yield* leaks(rules);
          expect(leaks3).toBe(A.some(contentRules, (rule) => !rules[rule]));
        }),
      { arbitrary: fcRuns(25) }
    );

    it.effect("floors every number point and histogram count onto the 1/2.5/5 ladder", () =>
      Effect.gen(function* () {
        expect(A.map([0, 0.4, 1, 2.4, 3.7, 9, 24, 26, 1_234_567, 9e15, -42], coarsenMetricValue)).toEqual([
          0, 0, 1, 2, 2, 5, 10, 25, 1_000_000, 1_000_000_000_000, -25,
        ]);
        const { metrics } = yield* exportedMetrics(StrictGateRulesOn, "beep.demo.calls");
        const text = yield* encodeUnknownJson(metrics);
        expect(Str.includes('"asInt":1000000')(text)).toBe(true);
        expect(Str.includes('"asDouble":2')(text)).toBe(true);
        expect(Str.includes("1234567")(text)).toBe(false);
        expect(Str.includes("3.7")(text)).toBe(false);
      })
    );

    it.effect("keeps histogram bounds, coarsens its counts and drops sum, min and max", () =>
      Effect.gen(function* () {
        const { gate, metrics } = yield* exportedMetrics(StrictGateRulesOn, "beep.demo.latency");
        const text = yield* encodeUnknownJson(metrics);
        // The count is the sum of the coarsened buckets, so the point stays
        // OTLP-consistent (2 + 10 + 1000).
        expect(Str.includes('"count":1012')(text)).toBe(true);
        expect(Str.includes('"bucketCounts":[2,10,1000]')(text)).toBe(true);
        expect(Str.includes('"explicitBounds":[10,100]')(text)).toBe(true);
        for (const key of ['"sum":', '"min":', '"max":']) {
          expect([key, Str.includes(key)(text)]).toEqual([key, false]);
        }
        const ledger4 = yield* gate.ledger;
        expect(countOf(ledger4, "metric-value-dropped")).toBe(3);
      })
    );

    it.effect("takes an allowlisted metric's description and unit from the catalog, never the input", () =>
      Effect.gen(function* () {
        const { metrics } = yield* exportedMetrics(StrictGateRulesOn, "beep.demo.latency");
        const text = yield* encodeUnknownJson(metrics);
        // Both input series (histogram and refused exponential) carry the catalog identity.
        expect(A.dedupe(A.map(metrics, (metric) => `${metric.description}|${metric.unit}`))).toEqual([
          "Demo tool latency by tool.|ms",
        ]);
        expect(Str.includes(batchCanary())(text)).toBe(false);
        const { metrics: raw } = yield* exportedMetrics(
          { ...StrictGateRulesOn, "metric-names": false },
          "beep.demo.latency"
        );
        const argument = Str.includes(batchCanary());
        const encodedUnknownJson = yield* encodeUnknownJson(raw);
        expect(argument(encodedUnknownJson)).toBe(true);
      })
    );

    it.effect("refuses an exponential histogram series and counts it", () =>
      Effect.gen(function* () {
        const { gate, metrics } = yield* exportedMetrics(StrictGateRulesOn, "beep.demo.latency");
        const argument1 = Str.includes("exponentialHistogram");
        const encodedUnknownJson1 = yield* encodeUnknownJson(metrics);
        expect(argument1(encodedUnknownJson1)).toBe(false);
        // The exponential series and the unknown metric name.
        const ledger5 = yield* gate.ledger;
        expect(countOf(ledger5, "metric-not-allowed")).toBe(2);
      })
    );

    it.effect("exports raw values and histogram aggregates when the metric-values rule is off", () =>
      Effect.gen(function* () {
        const { metrics: calls } = yield* exportedMetrics(
          { ...StrictGateRulesOn, "metric-values": false },
          "beep.demo.calls"
        );
        const { metrics: latency } = yield* exportedMetrics(
          { ...StrictGateRulesOn, "metric-values": false },
          "beep.demo.latency"
        );
        const argument2 = Str.includes('"asInt":1234567');
        const encodedUnknownJson2 = yield* encodeUnknownJson(calls);
        expect(argument2(encodedUnknownJson2)).toBe(true);
        const latencyText = yield* encodeUnknownJson(latency);
        expect(Str.includes('"sum":98765.4')(latencyText)).toBe(true);
        expect(Str.includes("exponentialHistogram")(latencyText)).toBe(true);
      })
    );
  });
});

describe("strict tier", () => {
  it.effect("never lets a strict desktop resolve above shape-only", () =>
    Effect.sync(() => {
      for (const identitySource of ["vouched", "self-claimed"] as const) {
        const context = StrictDesktop.make({ identitySource });
        for (const requested of TelemetryTier.literals) {
          expect(effectiveTier(context, requested)).toBe("shape-only");
        }
      }
    })
  );

  it.effect("buckets durations by their upper bound", () =>
    Effect.sync(() => {
      expect(A.map([0, 10, 11, 999, 1_000, 2_501, 10_000, 10_001], durationBucketOf)).toEqual([
        "10ms",
        "10ms",
        "50ms",
        "1s",
        "1s",
        "5s",
        "10s",
        "over-10s",
      ]);
    })
  );
});

const demoCalls = Metric.counter("beep.demo.calls", { description: "Demo tool calls by tool." });

const strictOtlp = layerStrictOtlp(demoConfig()).pipe(
  Layer.provideMerge(layerInMemoryEgressSink()),
  Layer.provide(layerTestSalt)
);

describe("layerStrictOtlp", () => {
  it.layer(strictOtlp, { timeout: "10 seconds" })((it) => {
    it.effect("exports through the gate, holds every body back, and counts the refused egress", () =>
      Effect.gen(function* () {
        yield* Effect.logError(batchCanary()).pipe(Effect.withSpan("mcp.tool.call.lookup"));
        yield* Metric.update(Metric.withAttributes(demoCalls, { "beep.demo.tool": "lookup" }), 1);
        yield* (yield* OtlpExporter.Flusher).flush;
        const ledger = yield* (yield* StrictGate).ledger;
        expect(countOf(ledger, "egress-refused")).toBeGreaterThanOrEqual(3);
        // The gate drops every log record the process emits, counted at export.
        // Under CI the test runner's trace instrumentation logs into the same
        // batch, so the count is at least this test's one record; the canary
        // check below is what proves nothing of the record left.
        expect(countOf(ledger, "log-record-dropped")).toBeGreaterThanOrEqual(1);

        const records = yield* (yield* StrictEgressSink).records;
        expect(A.dedupe(A.map(records, (record) => record.signal))).toEqual(
          expect.arrayContaining(["traces", "metrics", "logs"])
        );
        expect(A.some(records, (record) => Str.includes(batchCanary())(record.body))).toBe(false);
        expect(
          A.some(records, (record) => record.signal === "traces" && Str.includes('"name":"lookup"')(record.body))
        ).toBe(true);
        expect(
          A.some(
            records,
            (record) => record.signal === "metrics" && Str.includes('"name":"beep.demo.calls"')(record.body)
          )
        ).toBe(true);
      })
    );
  });
});
