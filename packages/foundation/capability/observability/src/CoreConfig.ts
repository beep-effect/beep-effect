/**
 * Browser-safe shared observability configuration schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LogLevel } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("CoreConfig");

const ObservabilityCoreConfigFields = {
  serviceName: S.String,
  serviceVersion: S.String,
  environment: S.String,
};

/**
 * Browser-safe shared observability configuration.
 *
 * **Details**
 *
 * Carries service identity, environment, and minimum log level for both
 * client and server observability wiring.
 *
 * **Example** (Creating a core config)
 *
 * ```ts import.meta.vitest name="Creating a core config"
 * import { ObservabilityCoreConfig } from "@beep/observability"
 *
 * const config: ObservabilityCoreConfig = {
 *   serviceName: "todox-web",
 *   serviceVersion: "0.0.0",
 *   environment: "test",
 *   minLogLevel: "Info"
 * }
 *
 * config.serviceName // => "todox-web"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservabilityCoreConfig = LogLevel.toTaggedUnion("minLogLevel")({
  All: ObservabilityCoreConfigFields,
  Fatal: ObservabilityCoreConfigFields,
  Error: ObservabilityCoreConfigFields,
  Warn: ObservabilityCoreConfigFields,
  Info: ObservabilityCoreConfigFields,
  Debug: ObservabilityCoreConfigFields,
  Trace: ObservabilityCoreConfigFields,
  None: ObservabilityCoreConfigFields,
}).pipe(
  $I.annoteSchema("ObservabilityCoreConfig", {
    description: "Browser-safe shared observability configuration.",
  })
);

/**
 * Type of {@link ObservabilityCoreConfig}
 *
 * **Example** (Typing a config parameter)
 *
 * ```typescript
 * import type { ObservabilityCoreConfig } from "@beep/observability"
 *
 * const serviceName = (config: ObservabilityCoreConfig) => config.serviceName
 * console.log(serviceName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservabilityCoreConfig = typeof ObservabilityCoreConfig.Type;
