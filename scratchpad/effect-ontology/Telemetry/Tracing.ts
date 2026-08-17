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

import { Layer } from "effect";
import { OtlpTracer } from "effect/unstable/observability";

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
export interface TracingConfig {
  /** Service name for traces */
  readonly serviceName: string;
  /** OTLP endpoint URL (defaults to http://localhost:4318/v1/traces for Jaeger OTLP) */
  readonly otlpEndpoint?: string;
  /** Enable/disable tracing (defaults to true) */
  readonly enabled?: boolean;
}

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
 * @param config - Tracing configuration
 * @returns Layer that provides tracing (requires HttpClient)
 * @category layers
 * @since 0.0.0
 */
export const makeTracingLayer = (config: TracingConfig) => {
  if (config.enabled === false) {
    return Layer.empty;
  }

  // Default to Jaeger's OTLP endpoint (Jaeger supports OTLP natively)
  // For Jaeger: http://localhost:4318/v1/traces (OTLP HTTP)
  const otlpEndpoint = config.otlpEndpoint ?? "http://localhost:4318/v1/traces";

  return OtlpTracer.layer({
    url: otlpEndpoint,
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
