/**
 * Observability context supplied by the native desktop shell to the renderer
 * runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogLevel } from "@beep/schema/Logs";
import * as S from "effect/Schema";

const $I = $ProfessionalDesktopId.create("runtime/RendererObservabilityConfig");

/**
 * Observability context decoded from the native desktop shell at bootstrap.
 *
 * **Details**
 *
 * Required fields must be non-empty, and `logLevel` is bound to the canonical
 * `LogLevel` domain that `@beep/agents-client` already guards its
 * `__BEEP_LOG_LEVEL__` reader with, so shell drift fails the bootstrap decode
 * loudly instead of being coerced to `Info` downstream. `buildCommit` and
 * `otlpUrl` are absent as `Option` values rather than `undefined`, so consumers
 * never re-test presence or emptiness by hand.
 *
 * **Example** (Decode a native shell payload)
 *
 * ```ts
 * import { RendererObservabilityConfig } from "@/runtime/RendererObservabilityConfig"
 * import * as Effect from "effect/Effect";
 * const decoded = RendererObservabilityConfig.decode({
 *   deploymentEnvironment: "development",
 *   launchId: "launch-1",
 *   logLevel: "Info",
 *   qaSessionId: "qa-1"
 * })
 * console.log(Effect.runSync(decoded).deploymentEnvironment) // "development"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RendererObservabilityConfig extends S.Class<RendererObservabilityConfig>($I`RendererObservabilityConfig`)(
  {
    buildCommit: S.OptionFromOptional(S.NonEmptyString),
    deploymentEnvironment: S.NonEmptyString,
    launchId: S.NonEmptyString,
    logLevel: LogLevel,
    otlpUrl: S.OptionFromOptional(S.NonEmptyString),
    qaSessionId: S.NonEmptyString,
  },
  $I.annote("RendererObservabilityConfig", {
    description: "Observability context supplied by the native desktop shell to the renderer runtime.",
  })
) {
  static readonly decode = S.decodeUnknownEffect(RendererObservabilityConfig);
}
