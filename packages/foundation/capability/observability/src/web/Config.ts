/**
 * Browser observability configuration and resource conversion helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LogLevel } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("web/Config");

/**
 * Browser-only observability configuration.
 *
 * **Example** (Creating browser observability config)
 *
 * ```typescript
 * import { WebObservabilityConfig } from "@beep/observability/web"
 *
 * const config = WebObservabilityConfig.make({
 *   serviceName: "todox-web",
 *   serviceVersion: "0.0.0",
 *   environment: "development",
 *   minLogLevel: "Info",
 *   resourceAttributes: {},
 * })
 *
 * console.log(config.serviceName) // "todox-web"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebObservabilityConfig extends S.Class<WebObservabilityConfig>($I`WebObservabilityConfig`)(
  {
    serviceName: S.String,
    serviceVersion: S.String,
    environment: S.String,
    minLogLevel: LogLevel,
    resourceAttributes: S.Record(S.String, S.String),
  },
  $I.annote("WebObservabilityConfig", {
    description: "Browser-only observability configuration.",
  })
) {}

/**
 * Convert browser config into an OpenTelemetry resource shape.
 *
 * **Example** (Converting config to resource)
 *
 * ```typescript
 * import { WebObservabilityConfig, toWebResource } from "@beep/observability/web"
 *
 * const config = WebObservabilityConfig.make({
 *   serviceName: "todox-web",
 *   serviceVersion: "0.0.0",
 *   environment: "development",
 *   minLogLevel: "Info",
 *   resourceAttributes: {},
 * })
 *
 * const resource = toWebResource(config)
 * console.log(resource.serviceName) // "todox-web"
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const toWebResource = (config: WebObservabilityConfig) => ({
  serviceName: config.serviceName,
  serviceVersion: config.serviceVersion,
  attributes: {
    deployment_environment: config.environment,
    ...config.resourceAttributes,
  },
});
