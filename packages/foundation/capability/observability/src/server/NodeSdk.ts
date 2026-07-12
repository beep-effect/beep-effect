/**
 * Node SDK observability layer construction for server runtimes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ObservabilityId } from "@beep/identity/packages";
import { DurationInput, LiteralKit, SchemaUtils } from "@beep/schema";
import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Duration, Layer } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { layerMinimumLogLevel } from "../Logging.ts";
import { ServerObservabilityConfig, toOtlpResource } from "./Config.ts";
import type * as OtelResource from "@effect/opentelemetry/Resource";
import type { LogRecordProcessor } from "@opentelemetry/sdk-logs";
import type { MetricReader } from "@opentelemetry/sdk-metrics";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";

const $I = $ObservabilityId.create("server/NodeSdk");
const isOTelLogRecordProcessor = (value: unknown): value is LogRecordProcessor => P.isUnknown(value);
const isOTelMetricReader = (value: unknown): value is MetricReader => P.isUnknown(value);
const isOTelSpanProcessor = (value: unknown): value is SpanProcessor => P.isUnknown(value);

const OTelLogRecordProcessor = S.declare<LogRecordProcessor>(isOTelLogRecordProcessor, {
  description: "OpenTelemetry log record processor supplied by a Node SDK caller.",
  expected: "LogRecordProcessor",
  identifier: $I`OTelLogRecordProcessor`,
});

const OTelMetricReader = S.declare<MetricReader>(isOTelMetricReader, {
  description: "OpenTelemetry metric reader supplied by a Node SDK caller.",
  expected: "MetricReader",
  identifier: $I`OTelMetricReader`,
});

const OTelSpanProcessor = S.declare<SpanProcessor>(isOTelSpanProcessor, {
  description: "OpenTelemetry span processor supplied by a Node SDK caller.",
  expected: "SpanProcessor",
  identifier: $I`OTelSpanProcessor`,
});

const NodeSdkLogRecordProcessorOption = S.Union([OTelLogRecordProcessor, S.Array(OTelLogRecordProcessor)]).pipe(
  $I.annoteSchema("NodeSdkLogRecordProcessorOption", {
    description: "One or more OpenTelemetry log record processors for the shared Node SDK layer.",
  })
);

const NodeSdkMetricReaderOption = S.Union([OTelMetricReader, S.Array(OTelMetricReader)]).pipe(
  $I.annoteSchema("NodeSdkMetricReaderOption", {
    description: "One or more OpenTelemetry metric readers for the shared Node SDK layer.",
  })
);

const NodeSdkSpanProcessorOption = S.Union([OTelSpanProcessor, S.Array(OTelSpanProcessor)]).pipe(
  $I.annoteSchema("NodeSdkSpanProcessorOption", {
    description: "One or more OpenTelemetry span processors for the shared Node SDK layer.",
  })
);

const NodeSdkMetricTemporality = LiteralKit(["cumulative", "delta"]).pipe(
  $I.annoteSchema("NodeSdkMetricTemporality", {
    description: "Metric temporality preference accepted by the Effect OpenTelemetry Node SDK.",
  })
);

/**
 * Additional controls for the shared Node SDK layer.
 *
 * @example
 * ```typescript
 * import { NodeSdkServerOptions } from "@beep/observability/server"
 *
 * const options = NodeSdkServerOptions.make({
 *   loggerMergeWithExisting: true
 * })
 * console.log(options.loggerMergeWithExisting)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class NodeSdkServerOptions extends S.Class<NodeSdkServerOptions>($I`NodeSdkServerOptions`)(
  {
    loggerExportInterval: DurationInput.pipe(SchemaUtils.withKeyDefaults(Duration.seconds(1))),
    loggerMergeWithExisting: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    logRecordProcessor: S.optionalKey(NodeSdkLogRecordProcessorOption),
    metricReader: S.optionalKey(NodeSdkMetricReaderOption),
    metricsExportInterval: DurationInput.pipe(SchemaUtils.withKeyDefaults(Duration.seconds(10))),
    metricTemporality: NodeSdkMetricTemporality.pipe(
      SchemaUtils.withKeyDefaults(NodeSdkMetricTemporality.Enum.cumulative)
    ),
    shutdownTimeout: DurationInput.pipe(SchemaUtils.withKeyDefaults(Duration.seconds(3))),
    spanProcessor: S.optionalKey(NodeSdkSpanProcessorOption),
  },
  $I.annote("NodeSdkServerOptions", {
    description: "Additional controls for the shared OpenTelemetry Node SDK server layer.",
  })
) {}

/**
 * Constructor input accepted by Node SDK layer builders before schema defaults are resolved.
 *
 * @example
 * ```typescript
 * import { NodeSdkServerOptions } from "@beep/observability/server"
 * import type { NodeSdkServerOptionsInput } from "@beep/observability/server"
 *
 * const input: NodeSdkServerOptionsInput = { loggerMergeWithExisting: false }
 * const options = NodeSdkServerOptions.make(input)
 * console.log(options.loggerMergeWithExisting)
 * // false
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type NodeSdkServerOptionsInput = (typeof NodeSdkServerOptions)["~type.make.in"];

const endpointUrl = (baseUrl: string, path: string): string => new URL(path, `${baseUrl}/`).toString();

/**
 * Convert the shared server observability config into a Node SDK resource shape.
 *
 * @example
 * ```typescript
 * import { ServerObservabilityConfig, toNodeSdkResource } from "@beep/observability/server"
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
 *   serviceName: "beep",
 *   serviceVersion: "0.0.0"
 * })
 * const resource = toNodeSdkResource(config)
 * console.log(resource.serviceName)
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const toNodeSdkResource = (config: ServerObservabilityConfig): NonNullable<NodeSdk.Configuration["resource"]> =>
  toOtlpResource(config);

/**
 * Build a Node SDK configuration with OTLP HTTP defaults for local LGTM.
 *
 * @example
 * ```typescript
 * import { ServerObservabilityConfig, makeNodeSdkServerConfig } from "@beep/observability/server"
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
 *   serviceName: "beep",
 *   serviceVersion: "0.0.0"
 * })
 * const sdkConfig = makeNodeSdkServerConfig(config)
 * console.log(sdkConfig.resource)
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const makeNodeSdkServerConfig: {
  (config: ServerObservabilityConfig, options?: NodeSdkServerOptionsInput | undefined): NodeSdk.Configuration;
  (options: NodeSdkServerOptionsInput | undefined): (config: ServerObservabilityConfig) => NodeSdk.Configuration;
} = dual(
  (args) => ServerObservabilityConfig.is(args[0]),
  (config: ServerObservabilityConfig, options?: NodeSdkServerOptionsInput | undefined): NodeSdk.Configuration => {
    const resolvedOptions = NodeSdkServerOptions.make(options ?? {});
    const loggerExportInterval = Duration.toMillis(Duration.fromInputUnsafe(resolvedOptions.loggerExportInterval));
    const metricsExportInterval = Duration.toMillis(Duration.fromInputUnsafe(resolvedOptions.metricsExportInterval));

    return {
      resource: toNodeSdkResource(config),
      spanProcessor:
        resolvedOptions.spanProcessor ??
        (config.otlpEnabled
          ? [
              new BatchSpanProcessor(
                new OTLPTraceExporter({
                  url: endpointUrl(config.otlpBaseUrl, "/v1/traces"),
                })
              ),
            ]
          : undefined),
      metricReader:
        resolvedOptions.metricReader ??
        (config.otlpEnabled
          ? [
              new PeriodicExportingMetricReader({
                exporter: new OTLPMetricExporter({
                  url: endpointUrl(config.otlpBaseUrl, "/v1/metrics"),
                }),
                exportIntervalMillis: metricsExportInterval,
              }),
            ]
          : undefined),
      logRecordProcessor:
        resolvedOptions.logRecordProcessor ??
        (config.otlpEnabled
          ? [
              new BatchLogRecordProcessor({
                exporter: new OTLPLogExporter({
                  url: endpointUrl(config.otlpBaseUrl, "/v1/logs"),
                }),
                scheduledDelayMillis: loggerExportInterval,
              }),
            ]
          : undefined),
      loggerMergeWithExisting: resolvedOptions.loggerMergeWithExisting,
      metricTemporality: resolvedOptions.metricTemporality,
      shutdownTimeout: resolvedOptions.shutdownTimeout,
    };
  }
);

/**
 * Build a Node SDK configuration that exports traces only.
 *
 * @example
 * ```typescript
 * import { ServerObservabilityConfig, makeNodeSdkServerTraceConfig } from "@beep/observability/server"
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
 *   serviceName: "beep",
 *   serviceVersion: "0.0.0"
 * })
 * const sdkConfig = makeNodeSdkServerTraceConfig(config)
 * console.log(sdkConfig.resource)
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const makeNodeSdkServerTraceConfig: {
  (config: ServerObservabilityConfig, options?: NodeSdkServerOptionsInput | undefined): NodeSdk.Configuration;
  (options: NodeSdkServerOptionsInput | undefined): (config: ServerObservabilityConfig) => NodeSdk.Configuration;
} = dual(
  (args) => ServerObservabilityConfig.is(args[0]),
  (config: ServerObservabilityConfig, options?: NodeSdkServerOptionsInput | undefined): NodeSdk.Configuration =>
    makeNodeSdkServerConfig(config, {
      ...options,
      logRecordProcessor: options?.logRecordProcessor ?? [],
      metricReader: options?.metricReader ?? [],
    })
);

type NodeSdkServerLayer = {
  (
    config: ServerObservabilityConfig,
    options?: NodeSdkServerOptionsInput | undefined
  ): Layer.Layer<OtelResource.Resource>;
  (
    options: NodeSdkServerOptionsInput | undefined
  ): (config: ServerObservabilityConfig) => Layer.Layer<OtelResource.Resource>;
};

const makeNodeSdkLayer = (
  config: ServerObservabilityConfig,
  makeConfig: () => NodeSdk.Configuration
): Layer.Layer<OtelResource.Resource> =>
  Layer.merge(NodeSdk.layer(makeConfig), layerMinimumLogLevel(config.minLogLevel));

/**
 * Build a shared Node SDK layer for server runtimes.
 *
 * @example
 * ```typescript
 * import { ServerObservabilityConfig, layerNodeSdkServer } from "@beep/observability/server"
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
 *   serviceName: "beep",
 *   serviceVersion: "0.0.0"
 * })
 * const NodeSdkLive = layerNodeSdkServer(config)
 * console.log(NodeSdkLive)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerNodeSdkServer: NodeSdkServerLayer = dual(
  (args) => ServerObservabilityConfig.is(args[0]),
  (
    config: ServerObservabilityConfig,
    options?: NodeSdkServerOptionsInput | undefined
  ): Layer.Layer<OtelResource.Resource> => makeNodeSdkLayer(config, () => makeNodeSdkServerConfig(config, options))
);

/**
 * Build a shared trace-only Node SDK layer for server runtimes.
 *
 * @example
 * ```typescript
 * import { ServerObservabilityConfig, layerNodeSdkServerTraces } from "@beep/observability/server"
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
 *   serviceName: "beep",
 *   serviceVersion: "0.0.0"
 * })
 * const NodeSdkLive = layerNodeSdkServerTraces(config)
 * console.log(NodeSdkLive)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerNodeSdkServerTraces: NodeSdkServerLayer = dual(
  (args) => ServerObservabilityConfig.is(args[0]),
  (
    config: ServerObservabilityConfig,
    options?: NodeSdkServerOptionsInput | undefined
  ): Layer.Layer<OtelResource.Resource> => makeNodeSdkLayer(config, () => makeNodeSdkServerTraceConfig(config, options))
);
