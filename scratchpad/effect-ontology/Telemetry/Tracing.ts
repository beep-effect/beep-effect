/**
 * OpenTelemetry Tracing Layer
 *
 * **Details**
 *
 * Creates OTLP tracer layer using Effect's built-in OtlpTracer.
 * This avoids OpenTelemetry SDK version compatibility issues.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { Layer } from "effect";
import * as S from "effect/Schema";
import { OtlpTracer } from "effect/unstable/observability";

const $I = $ScratchpadId.create("effect-ontology/Telemetry/Tracing");

/**
 * Service identity, OTLP endpoint, and enablement policy for OpenTelemetry
 * tracing.
 *
 * **Example** (Construct tracing config with defaults)
 *
 * ```ts
 * import { TracingConfig } from "@effect-ontology/Telemetry/Tracing"
 *
 * const config = TracingConfig.make({ serviceName: "effect-ontology" })
 * console.log(config.serviceName) // "effect-ontology"
 * console.log(config.enabled) // true
 * ```
 *
 * @see {@link makeTracingLayer} for turning this config into an OTLP tracer layer.
 * @category configuration
 * @since 0.0.0
 */
export class TracingConfig extends S.Class<TracingConfig>($I`TracingConfig`)(
  {
    serviceName: S.NonEmptyString,
    otlpEndpoint: URLStr.pipe(SchemaUtils.withKeyDefaults(URLStr.make("https://localhost:4318/v1/traces"))),
    enabled: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
  },
  $I.annote("TracingConfig", {
    description: "Service identity, OTLP trace endpoint, and tracing enablement policy.",
  })
) {}

/**
 * Constructor input accepted by {@link TracingConfig}.
 *
 * @see {@link TracingConfig} for the runtime schema and constructor defaults.
 * @category type-level
 * @since 0.0.0
 */
export type TracingConfigInput = (typeof TracingConfig)["~type.make.in"];

/**
 * Builds an OTLP tracer layer from {@link TracingConfig} input.
 *
 * **Details**
 *
 * Uses Effect's built-in OtlpTracer (HttpClient export, batching, shutdown)
 * instead of the OpenTelemetry JS SDK.
 *
 * **Gotchas**
 *
 * `enabled: false` returns {@link TracingTestLayer} (`Layer.empty`); no spans
 * are exported.
 *
 * **Example** (Disable tracing with an empty layer)
 *
 * ```ts
 * import { TracingTestLayer, makeTracingLayer } from "@effect-ontology/Telemetry/Tracing"
 *
 * const disabled = makeTracingLayer({ serviceName: "effect-ontology", enabled: false })
 * console.log(disabled === TracingTestLayer) // true
 * ```
 *
 * @see {@link TracingConfig} for the decoded enablement and endpoint fields.
 * @category layers
 * @since 0.0.0
 */
export const makeTracingLayer = (input: TracingConfigInput) => {
  const config = TracingConfig.make(input);
  if (!config.enabled) {
    return Layer.empty;
  }

  // Default to Jaeger's OTLP endpoint (Jaeger supports OTLP natively)
  // For Jaeger: https://localhost:4318/v1/traces (OTLP HTTP)
  return OtlpTracer.layer({
    url: config.otlpEndpoint,
    resource: {
      serviceName: config.serviceName,
    },
    exportInterval: "1 seconds", // Export every second for faster feedback
    shutdownTimeout: "5 seconds",
  });
};

/**
 * No-op tracing layer used by tests and by {@link makeTracingLayer} when
 * tracing is disabled.
 *
 * **Example** (Reuse the empty tracer in tests)
 *
 * ```ts
 * import { TracingTestLayer, makeTracingLayer } from "@effect-ontology/Telemetry/Tracing"
 *
 * console.log(TracingTestLayer === makeTracingLayer({ serviceName: "test", enabled: false })) // true
 * ```
 *
 * @see {@link makeTracingLayer} for the production OTLP layer constructor.
 * @category layers
 * @since 0.0.0
 */
export const TracingTestLayer: Layer.Layer<never> = Layer.empty;
