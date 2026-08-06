/**
 * Observability context supplied by the native desktop shell to the renderer
 * runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ProfessionalDesktopId.create("runtime/RendererObservabilityConfig");

/**
 * Observability context decoded from the native desktop shell at bootstrap.
 *
 * Required fields must be non-empty; `buildCommit` and `otlpUrl` are absent as
 * `Option` values rather than `undefined`, so consumers never re-test presence
 * or emptiness by hand.
 *
 * @example
 * ```ts
 * import { RendererObservabilityConfig } from "@/runtime/RendererObservabilityConfig"
 * import { Effect } from "effect"
 *
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
    logLevel: S.NonEmptyString,
    otlpUrl: S.OptionFromOptional(S.NonEmptyString),
    qaSessionId: S.NonEmptyString,
  },
  $I.annote("RendererObservabilityConfig", {
    description: "Observability context supplied by the native desktop shell to the renderer runtime.",
  })
) {
  static readonly decode = S.decodeUnknownEffect(RendererObservabilityConfig);
}
