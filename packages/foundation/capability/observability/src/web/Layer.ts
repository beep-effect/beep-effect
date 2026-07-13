/**
 * Browser observability layer construction for the Effect web SDK.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as WebSdk from "@effect/opentelemetry/WebSdk";
import { Layer } from "effect";
import { layerMinimumLogLevel } from "../Logging.ts";
import { toWebResource } from "./Config.ts";
import type { WebObservabilityConfig } from "./Config.ts";

/**
 * Thin browser-safe wrapper around `@effect/opentelemetry/WebSdk.layer`.
 *
 * @example
 * ```typescript
 * import { WebObservabilityConfig } from "@beep/observability/web"
 * import { layerWebSdk } from "@beep/observability/web"
 *
 * const config = WebObservabilityConfig.make({
 *   serviceName: "todox-web",
 *   serviceVersion: "0.0.0",
 *   environment: "development",
 *   minLogLevel: "Info",
 *   resourceAttributes: {},
 * })
 *
 * const layer = layerWebSdk(config)
 * console.log(layer)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerWebSdk = (
  config: WebObservabilityConfig
): Layer.Layer<import("@effect/opentelemetry/Resource").Resource> =>
  Layer.merge(
    WebSdk.layer(() => ({
      resource: toWebResource(config),
    })),
    layerMinimumLogLevel(config.minLogLevel)
  );
