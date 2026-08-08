/**
 * Credential-keyed toolkit composition.
 *
 * Build-time helper that folds a set of {@link SourceAuth.SourceAuthRegistration}-tagged
 * layers into a single layer, applying the hybrid gate policy from
 * `SourceAuth`: `hard`-gated layers vanish from the fold entirely when their
 * credential is absent; `none`/`soft`-gated layers always fold in (they
 * degrade at call time instead — see `ApiKeyRequired`).
 *
 * Mounted layers fold via `Layer.mergeAll`, mirroring the seam already used
 * at `packages/drivers/nlp-mcp/src/Server.ts:101-107` (an equivalent
 * `Array.reduce(Layer.merge, Layer.empty)` fold works identically — see
 * `SPEC.md`; `Layer.orElse` does not exist in `effect@4`). Credential-
 * conditional layer selection happens inside an `Effect.gen` that a
 * `Layer.unwrap` promotes back into a `Layer`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import { decideSourceAuthMount, SourceAuthDecision } from "./SourceAuth.ts";
import type { Config } from "effect";
import type { SourceAuthRegistration } from "./SourceAuth.ts";

/**
 * One credential-gated layer entry: a {@link SourceAuth.SourceAuthRegistration}
 * paired with the layer that registers that source's toolkit into the host.
 *
 * @example
 * ```ts
 * import { Layer } from "effect"
 * import type { GatedLayer } from "@beep/mcp-kit"
 * import { SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const registration = SourceAuthRegistration.make({
 *   name: "Example",
 *   envVar: "MCP_KIT_EXAMPLE_DOES_NOT_EXIST",
 *   gate: "none"
 * })
 *
 * const entry: GatedLayer<never, never, never> = { layer: Layer.empty, registration }
 * console.log(entry.registration.name)
 * // "Example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface GatedLayer<ROut, E, RIn> {
  /**
   * The layer to fold in when the registration decides to mount.
   */
  readonly layer: Layer.Layer<ROut, E, RIn>;
  /**
   * The credential-gate registration that governs whether `layer` mounts.
   */
  readonly registration: SourceAuthRegistration;
}

/**
 * Pairs a {@link SourceAuth.SourceAuthRegistration} with the layer it gates,
 * producing a {@link GatedLayer} entry for {@link composeGatedLayers}.
 *
 * @example
 * ```ts
 * import { Layer } from "effect"
 * import * as O from "effect/Option"
 * import { gatedLayer, SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const registration = SourceAuthRegistration.make({
 *   name: "Example",
 *   envVar: "MCP_KIT_EXAMPLE_DOES_NOT_EXIST",
 *   gate: "none"
 * })
 *
 * const entry = gatedLayer(registration, Layer.empty)
 * console.log(entry.registration.name)
 * // "Example"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const gatedLayer: {
  <ROut, E, RIn>(registration: SourceAuthRegistration, layer: Layer.Layer<ROut, E, RIn>): GatedLayer<ROut, E, RIn>;
  <ROut, E, RIn>(layer: Layer.Layer<ROut, E, RIn>): (registration: SourceAuthRegistration) => GatedLayer<ROut, E, RIn>;
} = dual(
  2,
  <ROut, E, RIn>(registration: SourceAuthRegistration, layer: Layer.Layer<ROut, E, RIn>): GatedLayer<ROut, E, RIn> => ({
    registration,
    layer,
  })
);

/**
 * Folds credential-gated layers into a single layer, applying the hybrid
 * gate policy: `hard`-gated entries vanish from the fold when their
 * credential is absent; `none`/`soft`-gated entries always fold in.
 *
 * **When to use**
 *
 * Use at MCP host composition time to build one `McpServer`-mountable layer
 * from several credential-gated source toolkits, so a missing hard-gated
 * credential removes that source's tools entirely rather than registering
 * broken tools.
 *
 * @example
 * ```ts
 * import { Effect, Layer } from "effect"
 * import * as O from "effect/Option"
 * import { composeGatedLayers, gatedLayer, SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const hardGated = SourceAuthRegistration.make({
 *   name: "Example",
 *   envVar: "MCP_KIT_EXAMPLE_DOES_NOT_EXIST",
 *   gate: "hard"
 * })
 *
 * const composed = composeGatedLayers(gatedLayer(hardGated, Layer.empty))
 * const context = Effect.runSync(Effect.scoped(Layer.build(composed)))
 * console.log(context !== undefined)
 * // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const composeGatedLayers = <E = never, RIn = never>(
  ...entries: ReadonlyArray<GatedLayer<never, E, RIn>>
): Layer.Layer<never, Config.ConfigError | E, RIn> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const mounted: Array<Layer.Layer<never, E, RIn>> = [];

      for (const entry of entries) {
        const decision = yield* decideSourceAuthMount(entry.registration);
        if (SourceAuthDecision.$is("Mount")(decision)) {
          mounted.push(entry.layer);
        }
      }

      return A.match(mounted, {
        onEmpty: () => Layer.empty,
        onNonEmpty: (nonEmpty) => Layer.mergeAll(...nonEmpty),
      });
    })
  );
