/**
 * Schemas of strict-tier resolution: where the emitter context came from and
 * the tier a strict host runs at.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { TelemetryTier } from "../catalog/Catalog.literals.ts";
import { EmitterContext } from "../catalog/Catalog.models.ts";

const $I = $ObservabilityId.create("strict/StrictTier.schemas");

/**
 * Where a resolved emitter context came from: a tag that decoded, or the
 * fail-closed `StrictDesktop` default used when there was no tag or it did
 * not decode.
 *
 * **Example** (Read the fail-closed source)
 *
 * ```ts import.meta.vitest name="Read the fail-closed source"
 * import { StrictContextSource } from "@beep/observability/strict"
 *
 * StrictContextSource.Enum["fail-closed"] // => "fail-closed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StrictContextSource = LiteralKit(["tagged", "fail-closed"]).pipe(
  $I.annoteSchema("StrictContextSource", {
    description: "Whether a strict host's emitter context came from a decoded tag or the fail-closed default.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type StrictContextSource = typeof StrictContextSource.Type;

/**
 * The outcome of strict-tier resolution: the emitter context, where it came
 * from, and the effective tier.
 *
 * **Details**
 *
 * `tier` is the stricter of the context's ceiling and every tier request, so
 * a request can lower the tier and never raise it.
 *
 * **Example** (Describe a fail-closed resolution)
 *
 * ```ts import.meta.vitest name="Describe a fail-closed resolution"
 * import { StrictDesktop } from "@beep/observability/catalog"
 * import { StrictTierResolution } from "@beep/observability/strict"
 *
 * const resolution = StrictTierResolution.make({
 *   context: StrictDesktop.make({ identitySource: "self-claimed" }),
 *   contextSource: "fail-closed",
 *   tier: "shape-only",
 * })
 * resolution.tier // => "shape-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictTierResolution extends S.Opaque<StrictTierResolution, { readonly brand: unique symbol }>()(
  S.Struct({
    context: EmitterContext,
    contextSource: StrictContextSource,
    tier: TelemetryTier,
  }).pipe(
    $I.annoteSchema("StrictTierResolution", {
      description: "Resolved emitter context, its source, and the effective tier a strict host runs at.",
    })
  )
) {}
