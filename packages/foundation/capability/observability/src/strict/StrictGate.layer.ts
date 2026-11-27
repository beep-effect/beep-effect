/**
 * Layers of the strict-tier OTLP export: the gate, the egress client that
 * never sends, the in-memory sink it writes to, and `layerStrictOtlp`, which
 * wires them under Effect's `Otlp.layer`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Otlp from "effect/observability/Otlp";
import * as OtlpExporter from "effect/observability/OtlpExporter";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import * as Str from "effect/String";
import { TelemetryRefusalTag } from "../Observability.instruments.ts";
import { StrictEgressRecord, StrictExportWindow, StrictSignal } from "./StrictGate.schemas.ts";
import { makeStrictGate, StrictEgressSink, StrictGate, StrictSalt } from "./StrictGate.service.ts";
import type * as HttpBody from "effect/http/HttpBody";
import type { StrictGateConfig } from "./StrictGate.schemas.ts";

const textDecoder = new TextDecoder();
const defaultSinkCapacity = 64;
const batchSizeAboveWindowTraffic = 1_000_000;

/**
 * Base URL the strict OTLP layer posts to. The `.invalid` top-level domain is
 * reserved and never resolves, and the strict egress client never sends.
 *
 * **Example** (Read the base URL)
 *
 * ```ts import.meta.vitest name="Read the base URL"
 * import { StrictEgressBaseUrl } from "@beep/observability/strict"
 *
 * StrictEgressBaseUrl // => "http://strict-egress.invalid"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const StrictEgressBaseUrl = "http://strict-egress.invalid";

/**
 * Provides {@link StrictGate} for one configuration.
 *
 * **Example** (Build the gate layer)
 *
 * ```ts
 * import { AttributeKeyName, InstrumentCatalog } from "@beep/observability/catalog"
 * import { layerStrictGate, StrictGateConfig } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * const gate = layerStrictGate(
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
 * console.log(Layer.isLayer(gate)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStrictGate = (config: StrictGateConfig): Layer.Layer<StrictGate, never, StrictSalt> =>
  Layer.effect(StrictGate, makeStrictGate(config));

const saltBytes = 32;

const concatBytes = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const joined = new Uint8Array(left.length + right.length);
  joined.set(left);
  joined.set(right, left.length);
  return joined;
};

/**
 * {@link StrictSalt} drawn fresh for each process and held only in memory.
 * Each id is keyed as `hmacSha256Hex(salt ‖ nonce, id)`.
 *
 * **Details**
 *
 * The caller supplies the synchronous HMAC-SHA256 primitive, so this entrypoint
 * stays free of platform types; a Bun host passes `Bun.CryptoHasher`. The salt
 * dies with the process, so no two runs share keyed ids.
 *
 * **Example** (Key ids with Bun)
 *
 * ```ts
 * import { layerInMemoryStrictSalt } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * const salt = layerInMemoryStrictSalt((key, value) => `${key.length}:${value}`)
 * console.log(Layer.isLayer(salt)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerInMemoryStrictSalt = (
  hmacSha256Hex: (key: Uint8Array, value: string) => string
): Layer.Layer<StrictSalt> =>
  Layer.sync(StrictSalt, () => {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(saltBytes));
    return StrictSalt.of({ keyedHex: (nonce, value) => hmacSha256Hex(concatBytes(salt, nonce), value) });
  });

/**
 * In-memory {@link StrictEgressSink} that keeps the most recent bodies, for
 * tests. It reports no refusals.
 *
 * **Example** (Keep the last eight bodies)
 *
 * ```ts
 * import { layerInMemoryEgressSink } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerInMemoryEgressSink(8))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerInMemoryEgressSink = (capacity: number = defaultSinkCapacity): Layer.Layer<StrictEgressSink> =>
  Layer.sync(StrictEgressSink, () => {
    const records = MutableRef.make<ReadonlyArray<StrictEgressRecord>>(A.empty());
    return StrictEgressSink.of({
      record: Effect.fn("StrictEgressSink.record")((record: StrictEgressRecord) =>
        Effect.sync(() => {
          MutableRef.update(records, (current) => A.takeRight(A.append(current, record), capacity));
          return HashMap.empty<TelemetryRefusalTag, number>();
        })
      ),
      records: Effect.sync(() => MutableRef.get(records)),
    });
  });

const bodyText: (body: HttpBody.HttpBody) => string = Match.typeTags<HttpBody.HttpBody>()({
  Uint8Array: (body) => textDecoder.decode(body.body),
  Empty: () => "",
  Raw: () => "",
  FormData: () => "",
  Stream: () => "",
});

const signalOf = (url: URL): O.Option<StrictSignal> =>
  A.findFirst(StrictSignal.literals, (signal) => Str.endsWith(`/v1/${signal}`)(url.pathname));

/**
 * The `HttpClient` the strict OTLP layer exports through. It never opens a
 * connection: each export is counted as `egress-refused`, its body goes to
 * the {@link StrictEgressSink}, and the exporter receives a synthetic
 * `204 No Content` so it keeps exporting each window.
 *
 * **Example** (Provide the egress client)
 *
 * ```ts
 * import { layerStrictEgress } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerStrictEgress)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStrictEgress: Layer.Layer<HttpClient.HttpClient, never, StrictGate | StrictEgressSink> = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const gate = yield* StrictGate;
    const sink = yield* StrictEgressSink;
    return HttpClient.make(
      Effect.fnUntraced(function* (request, url) {
        yield* gate.refuse(TelemetryRefusalTag.Enum["egress-refused"]);
        yield* pipe(
          signalOf(url),
          O.match({
            onNone: () => Effect.void,
            onSome: (signal) =>
              sink
                .record(StrictEgressRecord.make({ signal, body: bodyText(request.body) }))
                .pipe(Effect.flatMap(gate.absorb)),
          })
        );
        return HttpClientResponse.fromWeb(request, new Response(null, { status: 204 }));
      })
    );
  })
);

const layerStrictSerialization: Layer.Layer<OtlpSerialization.OtlpSerialization, never, StrictGate> = Layer.effect(
  OtlpSerialization.OtlpSerialization,
  Effect.map(Effect.service(StrictGate), (gate) => OtlpSerialization.OtlpSerialization.of(gate.serialization))
);

/**
 * Strict-tier OTLP export: Effect's `Otlp.layer` with the strict gate as its
 * serializer and the strict egress client as its `HttpClient`.
 *
 * **Details**
 *
 * Traces, metrics and logs export once per {@link StrictExportWindow}. The
 * OTLP logger replaces every existing logger, runtime metrics are not
 * enabled, and the resource is rebuilt from constants by the gate. The layer
 * also provides {@link StrictGate} for its ledger and the OTLP `Flusher` that
 * forces an export.
 *
 * **Gotchas**
 *
 * Provide a {@link StrictSalt} and a {@link StrictEgressSink}; the sink sits
 * outside this layer so a test can read it after the layer's scope closes and
 * runs the final export.
 *
 * **Example** (Wire the strict export)
 *
 * ```ts
 * import { AttributeKeyName, InstrumentCatalog } from "@beep/observability/catalog"
 * import { layerStrictOtlp, StrictGateConfig } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 *
 * const strict = layerStrictOtlp(
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
 * console.log(Layer.isLayer(strict)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStrictOtlp = (
  config: StrictGateConfig
): Layer.Layer<StrictGate | OtlpExporter.Flusher, never, StrictSalt | StrictEgressSink> => {
  const gate = layerStrictGate(config);
  return Layer.mergeAll(
    Otlp.layer({
      baseUrl: StrictEgressBaseUrl,
      resource: { serviceName: config.serviceName, serviceVersion: config.serviceVersion },
      maxBatchSize: batchSizeAboveWindowTraffic,
      loggerExportInterval: StrictExportWindow,
      loggerExcludeLogSpans: true,
      loggerMergeWithExisting: false,
      metricsExportInterval: StrictExportWindow,
      tracerExportInterval: StrictExportWindow,
    }),
    OtlpExporter.layerFlusher
  ).pipe(Layer.provide(Layer.mergeAll(layerStrictSerialization, layerStrictEgress)), Layer.provideMerge(gate));
};
