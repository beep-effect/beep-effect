/**
 * Service contracts of the strict-tier OTLP gate: the salt that keys span ids,
 * the gate that serializes every export into shape-only JSON, and the sink
 * that holds the export bodies the egress client never sends.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import * as OptionUtils from "@beep/utils/Option";
import * as A from "effect/Array";
import * as BigInt_ from "effect/BigInt";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as HttpBody from "effect/http/HttpBody";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { allowedAttributes } from "../catalog/Catalog.behavior.ts";
import { TelemetryTier } from "../catalog/Catalog.literals.ts";
import { Instrument } from "../catalog/Catalog.models.ts";
import { AttributeKeyName } from "../catalog/Catalog.names.ts";
import {
  DurationBucketKey,
  SchemaFailureTagKey,
  TelemetryRefusalTag,
  TelemetryRefused,
} from "../Observability.instruments.ts";
import {
  coarsenMetricValue,
  durationBucketOf,
  metricValueCeiling,
  ShapeOnlyAttribute,
  ShapeOnlyResource,
  StrictExportWindow,
} from "./StrictGate.schemas.ts";
import type { LogsData } from "effect/observability/OtlpLogger";
import type { MetricsData } from "effect/observability/OtlpMetrics";
import type { KeyValue } from "effect/observability/OtlpResource";
import type { OtlpSerialization } from "effect/observability/OtlpSerialization";
import type { TraceData } from "effect/observability/OtlpTracer";
import type { SignalKind } from "../catalog/Catalog.literals.ts";
import type { InstrumentCatalog, MetricInstrument } from "../catalog/Catalog.models.ts";
import type { RefusalLedger, StrictEgressRecord, StrictGateConfig } from "./StrictGate.schemas.ts";
import type { StrictSpoolError } from "./StrictSpool.errors.ts";

const $I = $ObservabilityId.create("strict/StrictGate.service");

/**
 * The secret that keys exported span ids.
 *
 * **Details**
 *
 * `keyedHex` returns the lowercase hex HMAC-SHA256 of `value` under the salt
 * followed by `nonce`. It must be synchronous, because the OTLP serializer
 * that calls it is. The salt itself never leaves the service.
 *
 * **Example** (Provide a test salt)
 *
 * ```ts
 * import { StrictSalt } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * const salt = Layer.succeed(
 *   StrictSalt,
 *   StrictSalt.of({ keyedHex: (_nonce, value) => value.padEnd(64, "0").slice(0, 64) })
 * )
 * console.log(Layer.isLayer(salt)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StrictSalt extends Context.Service<
  StrictSalt,
  {
    readonly keyedHex: (nonce: Uint8Array, value: string) => string;
  }
>()($I`StrictSalt`) {}

/**
 * The strict gate: a synchronous OTLP serializer that exports only
 * shape-only JSON, and the ledger of everything it refused.
 *
 * **Details**
 *
 * `serialization` is the `OtlpSerialization` the strict OTLP layer exports
 * through. `refuse` counts one refusal and `absorb` adds a whole ledger of
 * them, for callers outside the serializer such as the egress client and the
 * spool behind it. `ledger` reads the cumulative counts, which the metrics
 * serializer also appends as `beep.telemetry.refused` points.
 *
 * **Example** (Read the refusal ledger)
 *
 * ```ts
 * import { StrictGate } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 *
 * const refusals = Effect.gen(function* () {
 *   const gate = yield* StrictGate
 *   return HashMap.size(yield* gate.ledger)
 * })
 * console.log(Effect.isEffect(refusals)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StrictGate extends Context.Service<
  StrictGate,
  {
    readonly serialization: Context.Service.Shape<typeof OtlpSerialization>;
    readonly refuse: (tag: TelemetryRefusalTag) => Effect.Effect<void>;
    readonly absorb: (refusals: RefusalLedger) => Effect.Effect<void>;
    readonly ledger: Effect.Effect<RefusalLedger>;
  }
>()($I`StrictGate`) {}

/**
 * Where the egress client puts the export bodies it holds back.
 *
 * **Details**
 *
 * `record` never fails: it returns the refusals it caused (`spool-evicted`
 * for each old segment evicted, `spool-evict-failed` for each one it could
 * not remove, `spool-write-failed` for a body it could not write), and the
 * egress client adds them to the gate's ledger. `records` reads the held-back bodies back. The
 * in-memory sink keeps the most recent bodies only and is for tests; a
 * strict host records into the encrypted spool.
 *
 * **Example** (Read the held-back bodies)
 *
 * ```ts
 * import { StrictEgressSink } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 *
 * const count = Effect.gen(function* () {
 *   const sink = yield* StrictEgressSink
 *   return (yield* sink.records).length
 * })
 * console.log(Effect.isEffect(count)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StrictEgressSink extends Context.Service<
  StrictEgressSink,
  {
    readonly record: (record: StrictEgressRecord) => Effect.Effect<RefusalLedger>;
    readonly records: Effect.Effect<ReadonlyArray<StrictEgressRecord>, StrictSpoolError>;
  }
>()($I`StrictEgressSink`) {}

type ResourceSpans = TraceData["resourceSpans"][number];
type InputSpan = ResourceSpans["scopeSpans"][number]["spans"][number];
type ResourceMetrics = MetricsData["resourceMetrics"][number];
type InputMetric = ResourceMetrics["scopeMetrics"][number]["metrics"][number];

type NumberPoint = NonNullable<InputMetric["sum"]>["dataPoints"][number];
type HistogramPoint = NonNullable<InputMetric["histogram"]>["dataPoints"][number];

const windowNanos = Duration.toNanosUnsafe(StrictExportWindow);
const nanosPerMilli = BigInt(1_000_000);
const nonceBytes = 16;
const traceIdWidth = 32;
const spanIdWidth = 16;
const cumulativeTemporality = 2;
const tagOrder: Order.Order<readonly [TelemetryRefusalTag, number]> = Order.mapInput(Order.String, ([tag]) => tag);

const floorNanos = (nanos: bigint): bigint => (nanos / windowNanos) * windowNanos;

const floorWireNanos = (nanos: unknown): string =>
  pipe(
    O.liftPredicate(nanos, P.isString),
    O.flatMap(BigInt_.fromString),
    O.map((value) => `${floorNanos(value)}`),
    O.getOrElse(() => "0")
  );

const coarsenWireInt = (raw: number | string, coarsen: boolean): number | string => {
  if (!coarsen) {
    return raw;
  }
  const coarsened = pipe(
    O.liftPredicate(raw, P.isNumber),
    O.orElse(() => O.flatMap(BigInt_.fromString(`${raw}`), BigInt_.toNumber)),
    O.map(coarsenMetricValue),
    O.getOrElse(() => metricValueCeiling)
  );
  return P.isString(raw) ? `${coarsened}` : coarsened;
};

const durationMsOf = (span: InputSpan): number =>
  pipe(
    O.all([BigInt_.fromString(span.startTimeUnixNano), BigInt_.fromString(span.endTimeUnixNano)]),
    O.flatMap(([start, end]) => BigInt_.toNumber((end - start) / nanosPerMilli)),
    O.getOrElse(() => 0)
  );

const stringAttribute = (key: AttributeKeyName, value: string): ShapeOnlyAttribute =>
  ShapeOnlyAttribute.make({ key, value: { stringValue: value } });

const literalValuesFor = (
  catalog: InstrumentCatalog,
  signal: SignalKind
): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  const keys = allowedAttributes(catalog, signal, TelemetryTier.Enum["shape-only"]);
  return HashMap.fromIterable(
    A.flatMap(catalog.attributes, (attribute) =>
      HashSet.has(keys, attribute.key)
        ? O.match(attribute.values, {
            onNone: () => [],
            onSome: (values) => [[attribute.key, HashSet.fromIterable(values)] as const],
          })
        : []
    )
  );
};

const isLiteralAllowed =
  (allowed: HashMap.HashMap<string, HashSet.HashSet<string>>) =>
  (attribute: KeyValue): boolean =>
    pipe(
      HashMap.get(allowed, attribute.key),
      O.exists((values) => P.isString(attribute.value.stringValue) && HashSet.has(values, attribute.value.stringValue))
    );

const shapeOnlyMetrics = (catalog: InstrumentCatalog): HashMap.HashMap<string, MetricInstrument> =>
  HashMap.fromIterable(
    A.flatMap(catalog.instruments, (instrument) =>
      Instrument.guards.MetricInstrument(instrument) && TelemetryTier.is["shape-only"](instrument.minTier)
        ? [[instrument.name, instrument] as const]
        : []
    )
  );

const toolIdOf = (config: StrictGateConfig, name: string): O.Option<string> =>
  A.findFirst(config.toolSpanPrefixes, (prefix) => Str.startsWith(prefix)(name)).pipe(
    O.map((prefix) => Str.slice(Str.length(prefix))(name)),
    O.filter((toolId) => A.contains(config.toolIds, toolId))
  );

const logRecordCount = (data: LogsData): number =>
  A.reduce(data.resourceLogs, 0, (total, resourceLogs) =>
    A.reduce(resourceLogs.scopeLogs, total, (sum, scopeLogs) => sum + A.length(scopeLogs.logRecords ?? []))
  );

/**
 * Builds the strict gate for one configuration.
 *
 * **Details**
 *
 * Each trace serialization draws a fresh nonce, so one span id exports as
 * different keyed ids in different batches. Every drop or rewrite is counted
 * in the ledger under its {@link TelemetryRefusalTag}, and a rule turned off
 * in `config.rules` passes its data through unchanged.
 *
 * Under `metric-values`, a histogram's count is the sum of its coarsened
 * buckets, so the point stays consistent under OTLP, and exponential
 * histograms and summaries are refused whole: their value-derived bucket
 * layouts and quantiles cannot be floored onto the ladder. Under
 * `metric-names`, a metric's description and unit come from its catalog
 * entry, never from the input series.
 *
 * **Example** (Build a gate effect)
 *
 * ```ts
 * import { AttributeKeyName, InstrumentCatalog } from "@beep/observability/catalog"
 * import { makeStrictGate, StrictGateConfig } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 *
 * const gate = makeStrictGate(
 *   StrictGateConfig.make({
 *     serviceName: "demo-mcp",
 *     serviceVersion: "0.0.0",
 *     keyEpoch: "1",
 *     toolIds: ["lookup"],
 *     toolSpanPrefixes: ["mcp.tool.call."],
 *     toolKey: AttributeKeyName.make("beep.demo.tool"),
 *     catalog: InstrumentCatalog.make({ attributes: [], instruments: [] }),
 *   })
 * )
 * console.log(Effect.isEffect(gate)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeStrictGate = Effect.fn("StrictGate.make")(function* (config: StrictGateConfig) {
  const salt = yield* StrictSalt;
  const clock = yield* Clock.Clock;
  const { rules } = config;
  const counts = MutableHashMap.empty<TelemetryRefusalTag, number>();
  const count = (tag: TelemetryRefusalTag, by = 1): void => {
    if (by > 0) {
      MutableHashMap.set(counts, tag, O.getOrElse(MutableHashMap.get(counts, tag), () => 0) + by);
    }
  };
  const startedAt = `${floorNanos(clock.currentTimeNanosUnsafe())}`;
  const spanValues = literalValuesFor(config.catalog, "span");
  const metricValues = literalValuesFor(config.catalog, "metric");
  const metricInstruments = shapeOnlyMetrics(config.catalog);
  const resource = ShapeOnlyResource.make({
    attributes: [
      stringAttribute(AttributeKeyName.make("service.name"), config.serviceName),
      stringAttribute(AttributeKeyName.make("service.version"), config.serviceVersion),
      stringAttribute(AttributeKeyName.make("beep.privacy_tier"), TelemetryTier.Enum["shape-only"]),
      stringAttribute(AttributeKeyName.make("beep.key_epoch"), config.keyEpoch),
    ],
    droppedAttributesCount: 0,
  });
  const scope = { name: config.serviceName };

  const resourceFor = <R>(inputs: ReadonlyArray<{ readonly resource: R }>): ShapeOnlyResource | R | undefined => {
    if (rules.resource) {
      count(TelemetryRefusalTag.Enum["resource-rebuilt"], A.length(inputs));
      return resource;
    }
    return O.getOrUndefined(O.map(A.head(inputs), (input) => input.resource));
  };

  const dropAll = <X>(rule: boolean, tag: TelemetryRefusalTag, items: ReadonlyArray<X>): ReadonlyArray<X> => {
    if (rule) {
      count(tag, A.length(items));
      return [];
    }
    return items;
  };

  const spanAttributes = (span: InputSpan, toolId: O.Option<string>): ReadonlyArray<KeyValue | ShapeOnlyAttribute> => {
    const stamped = [
      ...O.match(toolId, { onNone: () => [], onSome: (id) => [stringAttribute(config.toolKey, id)] }),
      stringAttribute(DurationBucketKey, durationBucketOf(durationMsOf(span))),
    ];
    if (!rules["span-attributes"]) {
      return [...span.attributes, ...stamped];
    }
    const kept = A.filter(span.attributes, isLiteralAllowed(spanValues));
    count(TelemetryRefusalTag.Enum["attribute-not-allowed"], A.length(span.attributes) - A.length(kept));
    return [...kept, ...stamped];
  };

  const spanStatus = (span: InputSpan): InputSpan["status"] => {
    if (!rules["span-status-message"]) {
      return span.status;
    }
    if (P.isString(span.status.message)) {
      count(TelemetryRefusalTag.Enum["span-status-message-dropped"]);
    }
    return { code: span.status.code };
  };

  const shapeSpan =
    (nonce: Uint8Array) =>
    (span: InputSpan): ReadonlyArray<object> => {
      const toolId = toolIdOf(config, span.name);
      if (rules["span-name"] && O.isNone(toolId)) {
        count(TelemetryRefusalTag.Enum["span-name-not-allowed"]);
        return [];
      }
      const keyed = (id: string, width: number): string =>
        rules["span-ids"] ? Str.slice(0, width)(salt.keyedHex(nonce, id)) : id;
      const time = (nanos: string): string => (rules["span-timestamps"] ? floorWireNanos(nanos) : nanos);
      return [
        {
          traceId: keyed(span.traceId, traceIdWidth),
          spanId: keyed(span.spanId, spanIdWidth),
          ...OptionUtils.getSomesStruct({
            parentSpanId: O.map(O.fromUndefinedOr(span.parentSpanId), (parent) => keyed(parent, spanIdWidth)),
          }),
          name: O.getOrElse(toolId, () => span.name),
          kind: span.kind,
          startTimeUnixNano: time(span.startTimeUnixNano),
          endTimeUnixNano: time(span.endTimeUnixNano),
          attributes: spanAttributes(span, toolId),
          droppedAttributesCount: 0,
          events: dropAll(rules["span-events"], TelemetryRefusalTag.Enum["span-event-dropped"], span.events),
          droppedEventsCount: 0,
          status: spanStatus(span),
          links: dropAll(rules["span-links"], TelemetryRefusalTag.Enum["span-link-dropped"], span.links),
          droppedLinksCount: 0,
        },
      ];
    };

  const traces = (data: TraceData): HttpBody.HttpBody => {
    const nonce = globalThis.crypto.getRandomValues(new Uint8Array(nonceBytes));
    const spans = A.flatMap(data.resourceSpans, (resourceSpans) =>
      A.flatMap(resourceSpans.scopeSpans, (scopeSpans) => A.flatMap(scopeSpans.spans, shapeSpan(nonce)))
    );
    return HttpBody.jsonUnsafe({
      resourceSpans: [{ resource: resourceFor(data.resourceSpans), scopeSpans: [{ scope, spans }] }],
    });
  };

  const gateAttributes =
    (allowedKeys: HashSet.HashSet<string>) =>
    (attributes: ReadonlyArray<KeyValue>): O.Option<ReadonlyArray<KeyValue>> => {
      const allowed =
        !rules["metric-attributes"] ||
        A.every(
          attributes,
          (attribute) => HashSet.has(allowedKeys, attribute.key) && isLiteralAllowed(metricValues)(attribute)
        );
      if (!allowed) {
        count(TelemetryRefusalTag.Enum["metric-attribute-not-allowed"]);
      }
      return allowed ? O.some(attributes) : O.none();
    };

  const pointTimes = (point: { readonly startTimeUnixNano?: unknown; readonly timeUnixNano?: unknown }) => ({
    startTimeUnixNano: floorWireNanos(point.startTimeUnixNano),
    timeUnixNano: floorWireNanos(point.timeUnixNano),
  });

  const value = (raw: number): number => (rules["metric-values"] ? coarsenMetricValue(raw) : raw);

  const numberPoints = (allowedKeys: HashSet.HashSet<string>, points: ReadonlyArray<NumberPoint>) =>
    A.flatMap(points, (point) =>
      O.match(gateAttributes(allowedKeys)(point.attributes), {
        onNone: () => [],
        onSome: (attributes) => [
          {
            attributes,
            ...pointTimes(point),
            exemplars: [],
            ...(P.isNumber(point.asDouble) ? { asDouble: value(point.asDouble) } : {}),
            ...(P.isUndefined(point.asInt) ? {} : { asInt: coarsenWireInt(point.asInt, rules["metric-values"]) }),
          },
        ],
      })
    );

  const histogramPoints = (allowedKeys: HashSet.HashSet<string>, points: ReadonlyArray<HistogramPoint>) =>
    A.flatMap(points, (point) =>
      O.match(gateAttributes(allowedKeys)(point.attributes ?? []), {
        onNone: () => [],
        onSome: (attributes) => {
          const aggregates = { sum: point.sum, min: point.min, max: point.max };
          if (rules["metric-values"]) {
            count(
              TelemetryRefusalTag.Enum["metric-value-dropped"],
              A.length(A.filter([point.sum, point.min, point.max], P.isNotUndefined))
            );
          }
          const bucketCounts = A.map(point.bucketCounts ?? [], value);
          const countMatchingBuckets =
            rules["metric-values"] && A.isReadonlyArrayNonEmpty(bucketCounts)
              ? Num.sumAll(bucketCounts)
              : value(point.count ?? 0);
          return [
            {
              attributes,
              ...pointTimes(point),
              exemplars: [],
              count: countMatchingBuckets,
              bucketCounts,
              explicitBounds: point.explicitBounds ?? [],
              ...(rules["metric-values"] ? {} : aggregates),
            },
          ];
        },
      })
    );

  const refusedSeries = <D>(key: string, data: D | undefined): Record<string, D> => {
    if (P.isUndefined(data)) {
      return {};
    }
    if (rules["metric-values"]) {
      count(TelemetryRefusalTag.Enum["metric-not-allowed"]);
      return {};
    }
    return { [key]: data };
  };

  const gateMetric = (metric: InputMetric): ReadonlyArray<object> => {
    const found = HashMap.get(metricInstruments, metric.name);
    if (rules["metric-names"] && O.isNone(found)) {
      count(TelemetryRefusalTag.Enum["metric-not-allowed"]);
      return [];
    }
    const allowedKeys = O.match(found, {
      onNone: () => HashSet.empty<string>(),
      onSome: (instrument) => HashSet.fromIterable<string>(instrument.attributes),
    });
    const identity = rules["metric-names"]
      ? O.match(found, {
          onNone: () => ({ description: "" }),
          onSome: (instrument) => ({ description: instrument.description, unit: instrument.unit }),
        })
      : { description: metric.description, unit: metric.unit };
    const { sum, gauge, histogram } = metric;
    return [
      {
        name: metric.name,
        ...identity,
        ...(P.isUndefined(sum)
          ? {}
          : {
              sum: {
                aggregationTemporality: sum.aggregationTemporality,
                isMonotonic: sum.isMonotonic,
                dataPoints: numberPoints(allowedKeys, sum.dataPoints),
              },
            }),
        ...(P.isUndefined(gauge) ? {} : { gauge: { dataPoints: numberPoints(allowedKeys, gauge.dataPoints) } }),
        ...(P.isUndefined(histogram)
          ? {}
          : {
              histogram: {
                aggregationTemporality: histogram.aggregationTemporality,
                dataPoints: histogramPoints(allowedKeys, histogram.dataPoints),
              },
            }),
        ...refusedSeries("exponentialHistogram", metric.exponentialHistogram),
        ...refusedSeries("summary", metric.summary),
      },
    ];
  };

  const refusalMetric = (): object => ({
    name: TelemetryRefused.name,
    description: TelemetryRefused.description,
    unit: TelemetryRefused.unit,
    sum: {
      aggregationTemporality: cumulativeTemporality,
      isMonotonic: true,
      dataPoints: A.map(A.sort(A.fromIterable(counts), tagOrder), ([tag, total]) => ({
        attributes: [stringAttribute(SchemaFailureTagKey, tag)],
        startTimeUnixNano: startedAt,
        timeUnixNano: `${floorNanos(clock.currentTimeNanosUnsafe())}`,
        asInt: total,
      })),
    },
  });

  const metrics = (data: MetricsData): HttpBody.HttpBody => {
    const gated = A.flatMap(data.resourceMetrics, (resourceMetrics) =>
      A.flatMap(resourceMetrics.scopeMetrics, (scopeMetrics) => A.flatMap(scopeMetrics.metrics, gateMetric))
    );
    const exportedResource = resourceFor(data.resourceMetrics);
    return HttpBody.jsonUnsafe({
      resourceMetrics: [
        { resource: exportedResource, scopeMetrics: [{ scope, metrics: [...gated, refusalMetric()] }] },
      ],
    });
  };

  const logs = (data: LogsData): HttpBody.HttpBody => {
    if (!rules.logs) {
      return HttpBody.jsonUnsafe(data);
    }
    count(TelemetryRefusalTag.Enum["log-record-dropped"], logRecordCount(data));
    return HttpBody.jsonUnsafe({ resourceLogs: [] });
  };

  return StrictGate.of({
    serialization: { traces, metrics, logs },
    refuse: Effect.fn("StrictGate.refuse")((tag: TelemetryRefusalTag) => Effect.sync(() => count(tag))),
    absorb: Effect.fn("StrictGate.absorb")((refusals: RefusalLedger) =>
      Effect.sync(() => HashMap.forEach(refusals, (total, tag) => count(tag, total)))
    ),
    ledger: Effect.sync(() => HashMap.fromIterable(counts)),
  });
});
