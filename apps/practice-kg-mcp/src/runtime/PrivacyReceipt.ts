/**
 * The weekly privacy receipt of the practice KG host: what its strict-tier
 * telemetry refused and held back over the last 7 days, rendered locally as
 * Markdown with counts and names only.
 *
 * **Details**
 *
 * The receipt reads the telemetry key and the encrypted spool without
 * writing anything. It reports refusal counts by tag, spool segment counts
 * and sizes, the key's wrapping path and epoch, and the attribute keys and
 * metric names the spooled exports carry. It never prints an attribute
 * value, a tool argument, a span name or a path: the telemetry directory
 * appears only as the `<telemetry dir>` token, and a name outside the
 * catalog is counted, never printed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeKgMcpId } from "@beep/identity/packages";
import {
  Instrument,
  SchemaFailureTagKey,
  TelemetryRefusalTag,
  TelemetryRefused,
  TelemetryTier,
} from "@beep/observability/catalog";
import {
  RefusalLedger,
  StrictSignal,
  StrictSpoolKey,
  StrictSpoolOperation,
  StrictSpoolOptions,
  StrictSpoolOutcome,
  surveyStrictSpool,
} from "@beep/observability/strict";
import { LiteralKit } from "@beep/schema";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import * as A from "effect/Array";
import * as BigInt_ from "effect/BigInt";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeKgTelemetryCatalog, resolvePracticeKgTelemetryTier } from "./Telemetry.ts";
import {
  DpapiPort,
  layerPracticeKgDpapi,
  PracticeKgKeyReport,
  readPracticeKgSpoolKey,
  resolvePracticeKgTelemetryDir,
} from "./TelemetryKey.ts";
import type { StrictEgressRecord, StrictSpoolSurvey, StrictSpoolSurveyEntry } from "@beep/observability/strict";

const $I = $PracticeKgMcpId.create("runtime/PrivacyReceipt");

// How far back the privacy receipt looks.
const PrivacyReceiptWindow: Duration.Duration = Duration.days(7);

// Whether the host resolved a telemetry directory.
const PracticeKgTelemetryDirStatus = LiteralKit(["resolved", "unresolved"]).pipe(
  $I.annoteSchema("PracticeKgTelemetryDirStatus", {
    description: "Whether the practice KG host resolved a telemetry directory.",
  })
);

/**
 * The span of time a receipt covers: from `startMillis` (inclusive) to
 * `endMillis` (exclusive), in Unix milliseconds.
 *
 * **Example** (A 7-day window)
 *
 * ```ts
 * import { PracticeKgReceiptWindow } from "../../src/runtime/PrivacyReceipt.ts"
 *
 * console.log(PracticeKgReceiptWindow.make({ startMillis: 0, endMillis: 604_800_000 }).endMillis) // 604800000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgReceiptWindow extends S.Opaque<PracticeKgReceiptWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    startMillis: S.Natural,
    endMillis: S.Natural,
  }).pipe(
    $I.annoteSchema("PracticeKgReceiptWindow", {
      description: "Receipt window in Unix milliseconds: inclusive start, exclusive end.",
    })
  )
) {}

const SignalCounts = S.Struct({
  traces: S.Natural,
  metrics: S.Natural,
  logs: S.Natural,
}).pipe(
  $I.annoteSchema("SignalCounts", {
    description: "Spool segment counts by OTLP signal.",
  })
);

// Whether the receipt read the spool: `read`, `no-key` when the key did not
// load so no segment could be opened, or `survey-failed` when the key loaded
// but the spool could not be surveyed, naming only the spool operation that
// failed (never a path or message).
const PracticeKgReceiptSpoolStatus = S.TaggedUnion({
  read: {},
  "no-key": {},
  "survey-failed": { operation: StrictSpoolOperation },
}).pipe(
  $I.annoteSchema("PracticeKgReceiptSpoolStatus", {
    description: "Whether the privacy receipt read the spool, had no key, or failed to survey it (operation only).",
  })
);

type PracticeKgReceiptSpoolStatus = typeof PracticeKgReceiptSpoolStatus.Type;

// What the receipt says about the spool over its window: whether it was read,
// the opened segments sealed in the window by signal, their bytes on disk with
// the refused ones, the segments sealed before the window, and the segments in
// the window that did not open, by tag.
const PracticeKgReceiptSpool = S.Struct({
  status: PracticeKgReceiptSpoolStatus,
  segments: SignalCounts,
  bytes: S.Natural,
  earlier: S.Natural,
  refused: RefusalLedger,
}).pipe(
  $I.annoteSchema("PracticeKgReceiptSpool", {
    description: "Spool counts over the receipt window: opened segments by signal, bytes, earlier and refused.",
  })
);
type PracticeKgReceiptSpool = typeof PracticeKgReceiptSpool.Type;

/**
 * The weekly privacy receipt: counts and names only.
 *
 * **Details**
 *
 * `refusals` is how much each refusal counter of the strict gate grew in the
 * window, read from the `beep.telemetry.refused` points of the spooled
 * metric exports. `truncated` names the tags whose growth is a lower bound
 * because a series' points before the window were evicted (see
 * {@link summarizePracticeKgSpool}). `attributeKeys` and `metricNames` are the catalogued names
 * the spooled exports in the window carry; `unlistedNames` counts any other
 * name, which is never printed.
 *
 * **Example** (Build an empty receipt)
 *
 * ```ts
 * import { PracticeKgPrivacyReceipt } from "../../src/runtime/PrivacyReceipt.ts"
 * import * as HashMap from "effect/HashMap"
 *
 * const receipt = PracticeKgPrivacyReceipt.make({
 *   window: { startMillis: 0, endMillis: 604_800_000 },
 *   tier: "shape-only",
 *   telemetryDir: "unresolved",
 *   key: { status: "missing" },
 *   spool: {
 *     status: { _tag: "no-key" },
 *     segments: { traces: 0, metrics: 0, logs: 0 },
 *     bytes: 0,
 *     earlier: 0,
 *     refused: HashMap.empty(),
 *   },
 *   refusals: HashMap.empty(),
 *   truncated: [],
 *   attributeKeys: [],
 *   metricNames: [],
 *   unlistedNames: 0,
 * })
 * console.log(receipt.tier) // "shape-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgPrivacyReceipt extends S.Opaque<PracticeKgPrivacyReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    window: PracticeKgReceiptWindow,
    tier: TelemetryTier,
    telemetryDir: PracticeKgTelemetryDirStatus,
    key: PracticeKgKeyReport,
    spool: PracticeKgReceiptSpool,
    refusals: RefusalLedger,
    truncated: S.Array(TelemetryRefusalTag),
    attributeKeys: S.Array(S.String),
    metricNames: S.Array(S.String),
    unlistedNames: S.Natural,
  }).pipe(
    $I.annoteSchema("PracticeKgPrivacyReceipt", {
      description: "Weekly strict-tier privacy receipt: refusal and spool counts, key path and epoch, names only.",
    })
  )
) {}

/**
 * What {@link summarizePracticeKgSpool} derives from a spool survey: the
 * spool section, the refusal growth and the names of a receipt.
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgSpoolSummary = Pick<
  PracticeKgPrivacyReceipt,
  "spool" | "refusals" | "truncated" | "attributeKeys" | "metricNames" | "unlistedNames"
>;

// The spool section of a receipt whose spool was not read, and why.
const unreadPracticeKgReceiptSpool = (status: PracticeKgReceiptSpoolStatus): PracticeKgReceiptSpool =>
  PracticeKgReceiptSpool.make({
    status,
    segments: { traces: 0, metrics: 0, logs: 0 },
    bytes: 0,
    earlier: 0,
    refused: HashMap.empty(),
  });

// Resource attributes the strict gate stamps from constants; they are names
// the receipt may print even though the catalog does not declare them.
const resourceKeys = ["service.name", "service.version", "beep.key_epoch"] as const;

const catalogAttributeKeys: HashSet.HashSet<string> = HashSet.fromIterable([
  ...A.map(PracticeKgTelemetryCatalog.attributes, (attribute) => attribute.key),
  ...resourceKeys,
]);

const catalogMetricNames: HashSet.HashSet<string> = HashSet.fromIterable(
  A.flatMap(PracticeKgTelemetryCatalog.instruments, (instrument) =>
    Instrument.guards.MetricInstrument(instrument) ? [instrument.name] : []
  )
);

const decodeJson = S.decodeUnknownOption(S.fromJsonString(S.Unknown));
const isKeyValue = S.is(S.Struct({ key: S.String, value: S.Unknown }));

const RefusedPoints = S.Struct({
  resourceMetrics: S.Array(
    S.Struct({
      scopeMetrics: S.Array(
        S.Struct({
          metrics: S.Array(
            S.Struct({
              name: S.String,
              sum: S.optionalKey(
                S.Struct({
                  dataPoints: S.Array(
                    S.Struct({
                      attributes: S.Array(S.Struct({ key: S.String, value: S.Struct({ stringValue: S.String }) })),
                      startTimeUnixNano: S.String,
                      asInt: S.Union([S.Finite, S.String]),
                    })
                  ),
                })
              ),
            })
          ),
        })
      ),
    })
  ),
});
const decodeRefusedPoints = S.decodeUnknownOption(RefusedPoints);

// Every attribute key in some decoded JSON, in visit order.
const attributeKeysIn = (value: unknown): ReadonlyArray<string> => {
  if (A.isArray(value)) {
    return A.flatMap(value, attributeKeysIn);
  }
  if (!P.isObject(value)) {
    return [];
  }
  return [...(isKeyValue(value) ? [value.key] : []), ...A.flatMap(R.values(value), attributeKeysIn)];
};

const MetricNames = S.Struct({
  resourceMetrics: S.Array(
    S.Struct({ scopeMetrics: S.Array(S.Struct({ metrics: S.Array(S.Struct({ name: S.String })) })) })
  ),
});
const decodeMetricNames = S.decodeUnknownOption(MetricNames);

// The metric names of one decoded metrics body.
const metricNamesIn = (value: unknown): ReadonlyArray<string> =>
  decodeMetricNames(value).pipe(
    O.map((decoded) =>
      A.flatMap(decoded.resourceMetrics, (resource) =>
        A.flatMap(resource.scopeMetrics, (scope) => A.map(scope.metrics, (metric) => metric.name))
      )
    ),
    O.getOrElse(A.empty)
  );

type RefusedPoint = {
  readonly series: string;
  readonly tag: string;
  readonly startNanos: string;
  readonly value: number;
};
type RefusedMetric = (typeof RefusedPoints.Type)["resourceMetrics"][number]["scopeMetrics"][number]["metrics"][number];
type RefusedDataPoint = NonNullable<RefusedMetric["sum"]>["dataPoints"][number];

const pointsOf = (point: RefusedDataPoint): ReadonlyArray<RefusedPoint> =>
  pipe(
    point.attributes,
    A.filter((attribute) => attribute.key === SchemaFailureTagKey),
    A.flatMap((attribute) =>
      O.toArray(
        O.map(P.isNumber(point.asInt) ? O.some(point.asInt) : Num.parse(point.asInt), (value) => ({
          series: `${attribute.value.stringValue}\u0000${point.startTimeUnixNano}`,
          tag: attribute.value.stringValue,
          startNanos: point.startTimeUnixNano,
          value,
        }))
      )
    )
  );

const refusedPointsOf = (metric: RefusedMetric): ReadonlyArray<RefusedPoint> =>
  metric.name === TelemetryRefused.name
    ? A.flatMap(O.match(O.fromUndefinedOr(metric.sum), { onNone: () => [], onSome: (sum) => sum.dataPoints }), pointsOf)
    : [];

// The `beep.telemetry.refused` points of one metrics body.
const refusedPointsIn = (body: string): ReadonlyArray<RefusedPoint> =>
  decodeJson(body).pipe(
    O.flatMap(decodeRefusedPoints),
    O.map((decoded) =>
      A.flatMap(decoded.resourceMetrics, (resource) =>
        A.flatMap(resource.scopeMetrics, (scope) => A.flatMap(scope.metrics, refusedPointsOf))
      )
    ),
    O.getOrElse(A.empty)
  );

const isTelemetryRefusalTag = S.is(TelemetryRefusalTag);

const ledgerFrom = (entries: ReadonlyArray<readonly [string, number]>): RefusalLedger =>
  A.reduce(entries, HashMap.empty<TelemetryRefusalTag, number>(), (ledger, [tag, count]) =>
    count > 0 && isTelemetryRefusalTag(tag)
      ? HashMap.set(ledger, tag, O.getOrElse(HashMap.get(ledger, tag), () => 0) + count)
      : ledger
  );

/**
 * Summarizes a spool survey over a window into the spool section, the
 * refusal growth and the names of a receipt.
 *
 * **Details**
 *
 * The strict gate exports its refusal counters as cumulative points, one
 * series per tag and process start. For each series the receipt takes the
 * largest value sealed in the window minus the largest sealed before it, so
 * a counter that kept growing across the window start is not counted twice.
 * A series whose process started before the window but whose points before
 * it were all evicted takes its earliest surviving point as the baseline and
 * its tag is listed in `truncated`, so its count is a lower bound and never
 * overstates.
 * Two processes started in the same 5-minute export window share a series
 * and are undercounted, never overcounted.
 *
 * **Example** (Summarize an empty survey)
 *
 * ```ts
 * import { PracticeKgReceiptWindow, summarizePracticeKgSpool } from "../../src/runtime/PrivacyReceipt.ts"
 * import { StrictSpoolSurvey } from "@beep/observability/strict"
 *
 * const summary = summarizePracticeKgSpool(
 *   StrictSpoolSurvey.make({ entries: [] }),
 *   PracticeKgReceiptWindow.make({ startMillis: 0, endMillis: 604_800_000 })
 * )
 * console.log(summary.spool.bytes) // 0
 * ```
 *
 * @param survey - Every spool segment, oldest first.
 * @param window - The receipt window.
 * @category combinators
 * @since 0.0.0
 */
export const summarizePracticeKgSpool: {
  (window: PracticeKgReceiptWindow): (survey: StrictSpoolSurvey) => PracticeKgSpoolSummary;
  (survey: StrictSpoolSurvey, window: PracticeKgReceiptWindow): PracticeKgSpoolSummary;
} = dual(2, (survey: StrictSpoolSurvey, window: PracticeKgReceiptWindow): PracticeKgSpoolSummary => {
  const earlier = A.filter(survey.entries, (entry) => entry.sealedAtMillis < window.startMillis);
  const within = A.filter(
    survey.entries,
    (entry) => entry.sealedAtMillis >= window.startMillis && entry.sealedAtMillis < window.endMillis
  );
  const opened = (entries: ReadonlyArray<StrictSpoolSurveyEntry>): ReadonlyArray<StrictEgressRecord> =>
    A.flatMap(entries, (entry) => (StrictSpoolOutcome.guards.opened(entry.outcome) ? [entry.outcome.record] : []));
  const openedWithin = opened(within);
  const countSignal = (signal: StrictSignal): number =>
    A.length(A.filter(openedWithin, (record) => record.signal === signal));

  const pointsIn = (entries: ReadonlyArray<StrictSpoolSurveyEntry>): ReadonlyArray<RefusedPoint> =>
    pipe(
      opened(entries),
      A.filter((record) => record.signal === StrictSignal.Enum.metrics),
      A.flatMap((record) => refusedPointsIn(record.body))
    );
  // Per series: the largest point, or the first one in segment order.
  const fold = (
    points: ReadonlyArray<RefusedPoint>,
    keep: (current: RefusedPoint, next: RefusedPoint) => RefusedPoint
  ): HashMap.HashMap<string, RefusedPoint> =>
    A.reduce(points, HashMap.empty<string, RefusedPoint>(), (bySeries, point) =>
      HashMap.set(
        bySeries,
        point.series,
        O.match(HashMap.get(bySeries, point.series), { onNone: () => point, onSome: (current) => keep(current, point) })
      )
    );
  const largest = (current: RefusedPoint, next: RefusedPoint): RefusedPoint =>
    current.value >= next.value ? current : next;
  const before = fold(pointsIn(earlier), largest);
  const withinPoints = pointsIn(within);
  const first = fold(withinPoints, (current) => current);
  const windowStartNanos = BigInt(window.startMillis) * BigInt(1_000_000);
  // A series whose process started before the window but has no surviving
  // point before it lost those points to eviction: its earliest surviving
  // point is the baseline, so the growth is a lower bound.
  const startedBeforeWindow = (point: RefusedPoint): boolean =>
    BigInt_.fromString(point.startNanos).pipe(
      O.map((start) => start < windowStartNanos),
      O.getOrElse(() => true)
    );
  const growth = pipe(
    fold(withinPoints, largest),
    HashMap.values,
    A.fromIterable,
    A.map((peak) =>
      O.match(HashMap.get(before, peak.series), {
        onSome: (previous) => ({ tag: peak.tag, count: Math.max(0, peak.value - previous.value), truncated: false }),
        onNone: () =>
          startedBeforeWindow(peak)
            ? {
                tag: peak.tag,
                count: O.match(HashMap.get(first, peak.series), {
                  onNone: () => 0,
                  onSome: (earliest) => Math.max(0, peak.value - earliest.value),
                }),
                truncated: true,
              }
            : { tag: peak.tag, count: peak.value, truncated: false },
      })
    )
  );

  const decoded = A.map(openedWithin, (record) => [record.signal, decodeJson(record.body).pipe(O.getOrNull)] as const);
  const seenKeys = A.dedupe(A.flatMap(decoded, ([, body]) => attributeKeysIn(body)));
  const seenMetrics = A.dedupe(
    A.flatMap(decoded, ([signal, body]) => (signal === StrictSignal.Enum.metrics ? metricNamesIn(body) : []))
  );
  const listedKeys = A.filter(seenKeys, (key) => HashSet.has(catalogAttributeKeys, key));
  const listedMetrics = A.filter(seenMetrics, (name) => HashSet.has(catalogMetricNames, name));

  return {
    spool: PracticeKgReceiptSpool.make({
      status: PracticeKgReceiptSpoolStatus.cases.read.make({}),
      segments: {
        traces: countSignal(StrictSignal.Enum.traces),
        metrics: countSignal(StrictSignal.Enum.metrics),
        logs: countSignal(StrictSignal.Enum.logs),
      },
      bytes: A.reduce(within, 0, (total, entry) => total + entry.sizeBytes),
      earlier: A.length(earlier),
      refused: ledgerFrom(
        A.flatMap(within, (entry) =>
          StrictSpoolOutcome.guards.refused(entry.outcome) ? [[entry.outcome.tag, 1] as const] : []
        )
      ),
    }),
    refusals: ledgerFrom(A.map(growth, (row) => [row.tag, row.count] as const)),
    truncated: pipe(
      growth,
      A.flatMap((row) => (row.truncated && isTelemetryRefusalTag(row.tag) ? [row.tag] : [])),
      A.dedupe,
      A.sort(Order.String)
    ),
    attributeKeys: A.sort(listedKeys, Order.String),
    metricNames: A.sort(listedMetrics, Order.String),
    unlistedNames: A.length(seenKeys) - A.length(listedKeys) + A.length(seenMetrics) - A.length(listedMetrics),
  };
});

const isoOf = (millis: number): string => DateTime.formatIso(DateTime.makeUnsafe(millis));

const ledgerOrder: Order.Order<readonly [TelemetryRefusalTag, number]> = Order.mapInput(Order.String, ([tag]) => tag);

// A count, or a lower bound when the tag's baseline was truncated.
const countCell = (receipt: PracticeKgPrivacyReceipt, tag: TelemetryRefusalTag, count: number): string =>
  A.contains(receipt.truncated, tag) ? `≥ ${count}, baseline truncated` : `${count}`;

// The gate (non-spool) rows: every counted tag, plus every truncated tag that
// grew by 0 since its earliest surviving point, so an unknown pre-window
// history is never printed as "None.".
const gateRows = (receipt: PracticeKgPrivacyReceipt): ReadonlyArray<string> => {
  const counted = HashMap.filter(receipt.refusals, (_, tag) => !isSpoolTag(tag));
  const truncatedOnly = A.filter(receipt.truncated, (tag) => !isSpoolTag(tag) && !HashMap.has(counted, tag));
  const rows = A.sort([...A.fromIterable(counted), ...A.map(truncatedOnly, (tag) => [tag, 0] as const)], ledgerOrder);
  return A.match(rows, {
    onEmpty: () => ["None."],
    onNonEmpty: (nonEmpty) => [
      "| Tag | Count |",
      "| --- | ---: |",
      ...A.map(nonEmpty, ([tag, count]) => `| ${tag} | ${countCell(receipt, tag, count)} |`),
    ],
  });
};

// Every spool refusal tag the kernel declares, in its declared order:
// `spool-evicted`, `spool-evict-failed` and `spool-write-failed` from the gate
// counter,
// `spool-tier-refused` and `spool-segment-invalid` from the survey.
const spoolTags = A.filter(TelemetryRefusalTag.literals, Str.startsWith("spool-"));
const isSpoolTag = (tag: TelemetryRefusalTag): boolean => A.contains(spoolTags, tag);

const countIn = (ledger: RefusalLedger, tag: TelemetryRefusalTag): number =>
  O.getOrElse(HashMap.get(ledger, tag), () => 0);

// One row per spool tag, zero rows included, summing the gate counter growth
// and the segments the survey refused.
const spoolRows = (receipt: PracticeKgPrivacyReceipt): ReadonlyArray<string> => [
  "| Tag | Count |",
  "| --- | ---: |",
  ...A.map(
    spoolTags,
    (tag) =>
      `| ${tag} | ${countCell(receipt, tag, countIn(receipt.refusals, tag) + countIn(receipt.spool.refused, tag))} |`
  ),
];

const nameRows = (names: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.match(names, { onEmpty: () => ["None."], onNonEmpty: A.map((name) => `- \`${name}\``) });

const keyLine = (key: PracticeKgKeyReport): string =>
  A.join(
    [
      `- Key: \`<telemetry dir>/key.<epoch>.dpapi\`, ${key.status}`,
      ...O.toArray(O.map(O.fromUndefinedOr(key.protection), (protection) => `protection ${protection}`)),
      ...O.toArray(O.map(O.fromUndefinedOr(key.epoch), (epoch) => `epoch ${epoch}`)),
    ],
    ", "
  );

const spoolLine = (spool: PracticeKgReceiptSpool): string =>
  PracticeKgReceiptSpoolStatus.match(spool.status, {
    read: () =>
      `- Spool: \`<telemetry dir>/spool\`, ${spool.segments.traces + spool.segments.metrics + spool.segments.logs} segments in the window (traces ${spool.segments.traces}, metrics ${spool.segments.metrics}, logs ${spool.segments.logs}), ${spool.bytes} bytes; segments sealed before the window: ${spool.earlier}`,
    "no-key": () => "- Spool: not read (no key loaded)",
    "survey-failed": (failed) => `- Spool: not read (the key loaded but the spool \`${failed.operation}\` step failed)`,
  });

/**
 * Renders a receipt as Markdown: counts, refusal tag names, the key's
 * wrapping path and epoch, and catalogued names. It prints no value, no
 * argument and no path beyond the `<telemetry dir>` token.
 *
 * **Example** (Render the heading)
 *
 * ```ts
 * import { PracticeKgPrivacyReceipt, renderPracticeKgPrivacyReceipt } from "../../src/runtime/PrivacyReceipt.ts"
 * import * as HashMap from "effect/HashMap"
 *
 * const text = renderPracticeKgPrivacyReceipt(
 *   PracticeKgPrivacyReceipt.make({
 *     window: { startMillis: 0, endMillis: 604_800_000 },
 *     tier: "shape-only",
 *     telemetryDir: "unresolved",
 *     key: { status: "missing" },
 *     spool: {
 *       status: { _tag: "no-key" },
 *       segments: { traces: 0, metrics: 0, logs: 0 },
 *       bytes: 0,
 *       earlier: 0,
 *       refused: HashMap.empty(),
 *     },
 *     refusals: HashMap.empty(),
 *     truncated: [],
 *     attributeKeys: [],
 *     metricNames: [],
 *     unlistedNames: 0,
 *   })
 * )
 * console.log(text.startsWith("# practice-kg-mcp privacy receipt")) // true
 * ```
 *
 * @param receipt - The receipt to render.
 * @category formatting
 * @since 0.0.0
 */
export const renderPracticeKgPrivacyReceipt = (receipt: PracticeKgPrivacyReceipt): string =>
  A.join(
    [
      "# practice-kg-mcp privacy receipt",
      "",
      `- Window: ${isoOf(receipt.window.startMillis)} to ${isoOf(receipt.window.endMillis)}`,
      `- Tier: ${receipt.tier}; nothing leaves this computer, every export is held back in the spool`,
      `- Telemetry directory: \`<telemetry dir>\` (${receipt.telemetryDir})`,
      keyLine(receipt.key),
      spoolLine(receipt.spool),
      "",
      "## Refusals in the window",
      "",
      ...gateRows(receipt),
      "",
      "## Spool refusals in the window",
      "",
      ...spoolRows(receipt),
      "",
      "## Exported attribute keys",
      "",
      ...nameRows(receipt.attributeKeys),
      "",
      "## Exported metrics",
      "",
      ...nameRows(receipt.metricNames),
      "",
      `Names outside the catalog (counted, never printed): ${receipt.unlistedNames}`,
      "",
    ],
    "\n"
  );

/**
 * Builds the receipt for the last 7 days from the resolved telemetry
 * directory, without writing anything.
 *
 * **Details**
 *
 * The key is read with {@link readPracticeKgSpoolKey}, never created or
 * rotated, and the spool with `surveyStrictSpool`, which never creates its
 * directory. A key that does not load leaves the spool unread as `no-key`; a
 * survey that fails after the key loaded leaves it unread as `survey-failed`
 * with the failed spool operation.
 *
 * **Example** (Build the receipt)
 *
 * ```ts
 * import { runPracticeKgPrivacyReceipt } from "../../src/runtime/PrivacyReceipt.ts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runPracticeKgPrivacyReceipt())) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runPracticeKgPrivacyReceipt = Effect.fn("PracticeKgPrivacyReceipt.run")(function* () {
  const path = yield* Path.Path;
  const platform = yield* HostProcessPlatform;
  const directory = yield* resolvePracticeKgTelemetryDir(platform);
  const { tier } = yield* resolvePracticeKgTelemetryTier;
  const endMillis = yield* Clock.currentTimeMillis;
  const window = PracticeKgReceiptWindow.make({
    startMillis: Math.max(0, endMillis - Duration.toMillis(PrivacyReceiptWindow)),
    endMillis,
  });
  const unread = (status: PracticeKgReceiptSpoolStatus) => ({
    spool: unreadPracticeKgReceiptSpool(status),
    refusals: HashMap.empty<TelemetryRefusalTag, number>(),
    truncated: [],
    attributeKeys: [],
    metricNames: [],
    unlistedNames: 0,
  });
  const found = yield* O.match(directory, {
    onNone: () =>
      Effect.succeed({
        telemetryDir: "unresolved" as const,
        key: PracticeKgKeyReport.make({ status: "missing" }),
        ...unread(PracticeKgReceiptSpoolStatus.cases["no-key"].make({})),
      }),
    onSome: Effect.fnUntraced(function* (telemetryDir: string) {
      const [key, material] = yield* Layer.build(layerPracticeKgDpapi(platform)).pipe(
        Effect.flatMap((ports) =>
          readPracticeKgSpoolKey(telemetryDir).pipe(Effect.provideService(DpapiPort, Context.get(ports, DpapiPort)))
        ),
        Effect.scoped,
        Effect.orElseSucceed(() => [PracticeKgKeyReport.make({ status: "unreadable" }), O.none()] as const)
      );
      const summary = yield* O.match(material, {
        onNone: () => Effect.succeed(unread(PracticeKgReceiptSpoolStatus.cases["no-key"].make({}))),
        onSome: (spoolKey) =>
          surveyStrictSpool(StrictSpoolOptions.make({ directory: path.join(telemetryDir, "spool"), tier })).pipe(
            Effect.provideService(StrictSpoolKey, spoolKey),
            Effect.map(summarizePracticeKgSpool(window)),
            // Only the operation tag of a failed survey reaches the receipt.
            Effect.catchTag("StrictSpoolError", (error) =>
              Effect.succeed(
                unread(PracticeKgReceiptSpoolStatus.cases["survey-failed"].make({ operation: error.operation }))
              )
            )
          ),
      });
      return { telemetryDir: "resolved" as const, key, ...summary };
    }),
  });
  return PracticeKgPrivacyReceipt.make({ window, tier, ...found });
});

/**
 * Prints a privacy receipt to stdout as Markdown.
 *
 * **Example** (Print the receipt)
 *
 * ```ts
 * import { printPracticeKgPrivacyReceipt, runPracticeKgPrivacyReceipt } from "../../src/runtime/PrivacyReceipt.ts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(printPracticeKgPrivacyReceipt(runPracticeKgPrivacyReceipt()))) // true
 * ```
 *
 * @param receipt - The receipt to build and print.
 * @category use-cases
 * @since 0.0.0
 */
export const printPracticeKgPrivacyReceipt = Effect.fn("PracticeKgPrivacyReceipt.print")(function* <E, R>(
  receipt: Effect.Effect<PracticeKgPrivacyReceipt, E, R>
) {
  const receipt1 = yield* receipt;
  yield* Console.log(renderPracticeKgPrivacyReceipt(receipt1));
});
