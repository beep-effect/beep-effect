/**
 * Live execution-authority configuration resolution.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import {
  EpistemicConfig,
  EpistemicDestinationAllowlistConfig,
  EpistemicPolicyRevisionConfig,
  EpistemicServerConfig,
} from "./ServerConfig.ts";

const readEpistemicConfig = Effect.fn("Epistemic.Config.read")(function* () {
  const destinationAllowlist = yield* EpistemicDestinationAllowlistConfig;
  const policyRevision = yield* EpistemicPolicyRevisionConfig;
  return EpistemicServerConfig.make({ destinationAllowlist, policyRevision });
});

/**
 * Live execution-authority configuration layer.
 *
 * @example
 * ```ts
 * import { EpistemicConfigLive } from "@beep/epistemic-config/layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(EpistemicConfigLive)) // true
 * ```
 *
 * @effects Reads `EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST` and
 * `EPISTEMIC_POLICY_REVISION` from the ambient `ConfigProvider`. Both are
 * optional; malformed values stay typed configuration errors rather than
 * defects, so the entrypoint decides startup policy.
 * @category layers
 * @since 0.0.0
 */
export const EpistemicConfigLive = Layer.effect(EpistemicConfig, readEpistemicConfig());
