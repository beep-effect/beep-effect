/**
 * OpenTelemetry Tracing Layer
 *
 * Creates OTLP tracer layer using Effect's built-in OtlpTracer.
 * This avoids OpenTelemetry SDK version compatibility issues.
 *
 * @module Telemetry/Tracing
 * @since 2.0.0
 */

import { OtlpTracer } from "effect/unstable/observability"
import type { HttpClient } from "effect/unstable/http/HttpClient"
import { Layer } from "effect"

/**
 * Tracing configuration
 *
 * @since 2.0.0
 * @category config
 */
export interface TracingConfig {
  /** Service name for traces */
  readonly serviceName: string
  /** OTLP endpoint URL (defaults to http://localhost:4318/v1/traces for Jaeger OTLP) */
  readonly otlpEndpoint?: string
  /** Enable/disable tracing (defaults to true) */
  readonly enabled?: boolean
}

/**
 * Create OpenTelemetry tracing layer using Effect's OtlpTracer.
 *
 * Uses Effect's built-in OTLP implementation which:
 * - Uses Effect's HttpClient for HTTP requests
 * - Has built-in batching and shutdown handling
 * - Avoids OpenTelemetry JS SDK version compatibility issues
 *
 * @param config - Tracing configuration
 * @returns Layer that provides tracing (requires HttpClient)
 *
 * @since 2.0.0
 * @category constructors
 */
export const makeTracingLayer = (
  config: TracingConfig
): Layer.Layer<never, never, HttpClient> => {
  if (config.enabled === false) {
    return Layer.empty as Layer.Layer<never, never, HttpClient>
  }

  // Default to Jaeger's OTLP endpoint (Jaeger supports OTLP natively)
  // For Jaeger: http://localhost:4318/v1/traces (OTLP HTTP)
  const otlpEndpoint = config.otlpEndpoint ?? "http://localhost:4318/v1/traces"

  return OtelTracer.layer({
    url: otlpEndpoint,
    resource: {
      serviceName: config.serviceName
    },
    exportInterval: "1 seconds", // Export every second for faster feedback
    shutdownTimeout: "5 seconds"
  })
}

/**
 * Test layer (no-op)
 *
 * Use in tests to avoid OpenTelemetry setup overhead.
 *
 * @since 2.0.0
 * @category layers
 */
export const TracingTestLayer: Layer.Layer<never> = Layer.empty
