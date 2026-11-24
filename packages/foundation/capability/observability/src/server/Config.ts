/**
 * Server observability configuration and resource conversion helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import * as LogLevel from "effect/LogLevel";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("server/Config");

/**
 * **Example** (Creating server observability config)
 *
 * ```typescript
 * import { ServerObservabilityConfig } from "@beep/observability/server"
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
 * console.log(config.serviceName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ServerObservabilityConfig extends S.Opaque<ServerObservabilityConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    serviceName: S.String,
    serviceVersion: S.String,
    environment: S.String,
    minLogLevel: S.Literals(LogLevel.values),
    otlpBaseUrl: S.String,
    otlpEnabled: S.Boolean,
    otlpResourceAttributes: S.Record(S.String, S.String),
    devtoolsEnabled: S.Boolean,
    devtoolsUrl: S.String,
    prometheusPrefix: S.String,
  }).pipe(
    $I.annoteSchema("ServerObservabilityConfig", {
      description: "Server-only observability configuration.",
    })
  )
) {
  static readonly is = S.is(ServerObservabilityConfig);
}

/**
 * Convert server config into OTLP resource attributes.
 *
 * **Example** (Convert config to OTLP resource)
 *
 * ```typescript
 * import { ServerObservabilityConfig, toOtlpResource } from "@beep/observability/server"
 *
 * const config = ServerObservabilityConfig.make({
 *   devtoolsEnabled: false,
 *   devtoolsUrl: "ws://localhost:34437",
 *   environment: "test",
 *   minLogLevel: "Info",
 *   otlpBaseUrl: "http://localhost:4318",
 *   otlpEnabled: true,
 *   otlpResourceAttributes: { region: "local" },
 *   prometheusPrefix: "beep",
 *   serviceName: "beep-api",
 *   serviceVersion: "0.0.0"
 * })
 * const resource = toOtlpResource(config)
 * console.log(resource.serviceName)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const toOtlpResource = (config: ServerObservabilityConfig) => ({
  serviceName: config.serviceName,
  serviceVersion: config.serviceVersion,
  attributes: {
    deployment_environment: config.environment,
    ...config.otlpResourceAttributes,
  },
});
