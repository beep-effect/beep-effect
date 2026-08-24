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
 * Tracing configuration
 *
 * **Example** (Reference TracingConfig fields)
 *
 * ```ts
 * import type { TracingConfig } from "@effect-ontology/Telemetry/Tracing"
 *
 * const tracingConfigFields: ReadonlyArray<keyof TracingConfig> = ["serviceName", "otlpEndpoint", "enabled"]
 *
 * console.log(tracingConfigFields)
 * ```
 *
 * @category type-level
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
 * **Example** (Configure tracing)
 *
 * ```ts
 * import type { TracingConfigInput } from "@effect-ontology/Telemetry/Tracing"
 *
 * const config: TracingConfigInput = { serviceName: "effect-ontology" }
 * console.log(config)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TracingConfigInput = (typeof TracingConfig)["~type.make.in"];

/**
 * Create OpenTelemetry tracing layer using Effect's OtlpTracer.
 *
 * **Details**
 *
 * Uses Effect's built-in OTLP implementation which:
 * - Uses Effect's HttpClient for HTTP requests
 * - Has built-in batching and shutdown handling
 * - Avoids OpenTelemetry JS SDK version compatibility issues
 *
 * **Example** (Inspect make tracing layer)
 *
 * ```ts
 * import { makeTracingLayer } from "@effect-ontology/Telemetry/Tracing"
 *
 * console.log(makeTracingLayer)
 * ```
 *
 * @param input - Tracing configuration.
 * @returns Layer that provides tracing (requires HttpClient)
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
 * Test layer (no-op)
 *
 * **Details**
 *
 * Use in tests to avoid OpenTelemetry setup overhead.
 *
 * **Example** (Inspect tracing test layer)
 *
 * ```ts
 * import { TracingTestLayer } from "@effect-ontology/Telemetry/Tracing"
 *
 * console.log(TracingTestLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TracingTestLayer: Layer.Layer<never> = Layer.empty;
