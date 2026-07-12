/**
 * Server-side observability layer composition for OTLP and devtools.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Duration, Layer, Metric } from "effect";
import { dual } from "effect/Function";
import * as Otlp from "effect/unstable/observability/Otlp";
import { layerMinimumLogLevel } from "../Logging.ts";
import { ServerObservabilityConfig, toOtlpResource } from "./Config.ts";
import { layerFilteredDevTools } from "./DevTools.ts";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type { DevToolsSpanFilter } from "./DevTools.ts";

/**
 * Server-only local LGTM wiring for Effect OTLP + optional devtools.
 *
 * @example
 * ```typescript
 * import { ServerObservabilityConfig, layerLocalLgtmServer } from "@beep/observability/server"
 *
 * const config = ServerObservabilityConfig.make({
 *   devtoolsEnabled: false,
 *   devtoolsUrl: "ws://localhost:34437",
 *   environment: "test",
 *   minLogLevel: "Info",
 *   otlpBaseUrl: "http://localhost:4318",
 *   otlpEnabled: false,
 *   otlpResourceAttributes: {},
 *   prometheusPrefix: "beep",
 *   serviceName: "beep-api",
 *   serviceVersion: "0.0.0"
 * })
 * const ObservabilityLive = layerLocalLgtmServer(config)
 * console.log(ObservabilityLive)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerLocalLgtmServer: {
  (
    config: ServerObservabilityConfig,
    options?: {
      readonly shouldPublishDevToolsSpan?: DevToolsSpanFilter | undefined;
    }
  ): Layer.Layer<never, never, HttpClient.HttpClient>;
  (options: {
    readonly shouldPublishDevToolsSpan?: DevToolsSpanFilter | undefined;
  }): (config: ServerObservabilityConfig) => Layer.Layer<never, never, HttpClient.HttpClient>;
} = dual(
  (args) => ServerObservabilityConfig.is(args[0]),
  (
    config: ServerObservabilityConfig,
    options?: {
      readonly shouldPublishDevToolsSpan?: DevToolsSpanFilter | undefined;
    }
  ): Layer.Layer<never, never, HttpClient.HttpClient> =>
    Layer.mergeAll(
      Metric.enableRuntimeMetricsLayer,
      layerMinimumLogLevel(config.minLogLevel),
      config.otlpEnabled
        ? Otlp.layerProtobuf({
            baseUrl: config.otlpBaseUrl,
            resource: toOtlpResource(config),
            loggerExportInterval: Duration.seconds(1),
            loggerMergeWithExisting: true,
            metricsExportInterval: Duration.seconds(10),
            metricsTemporality: "cumulative",
            tracerExportInterval: Duration.seconds(5),
            shutdownTimeout: Duration.seconds(3),
          })
        : Layer.empty,
      config.devtoolsEnabled
        ? layerFilteredDevTools({
            url: config.devtoolsUrl,
            shouldPublish: options?.shouldPublishDevToolsSpan ?? (() => true),
          })
        : Layer.empty
    )
);
