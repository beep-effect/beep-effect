/**
 * Live execution-authority configuration resolution.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  ExecutionAuthorityConfig,
  ExecutionAuthorityDestinationAllowlistConfig,
  ExecutionAuthorityPolicyRevisionConfig,
  ExecutionAuthorityServerConfig,
} from "./ServerConfig.ts";

const readExecutionAuthorityConfig = Effect.fn("ExecutionAuthority.Config.read")(function* () {
  const destinationAllowlist = yield* ExecutionAuthorityDestinationAllowlistConfig;
  const policyRevision = yield* ExecutionAuthorityPolicyRevisionConfig;
  return ExecutionAuthorityServerConfig.make({ destinationAllowlist, policyRevision });
});

/**
 * Live execution-authority configuration layer.
 *
 * **Example** (Verify Layer instance)
 *
 * ```ts
 * import { ExecutionAuthorityConfigLive } from "@beep/execution-authority-config/layer"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(ExecutionAuthorityConfigLive)) // true
 * ```
 *
 * @effects Reads `EXECUTION_AUTHORITY_EGRESS_DESTINATION_ALLOWLIST` and
 * `EXECUTION_AUTHORITY_POLICY_REVISION` from the ambient `ConfigProvider`. Both are
 * optional; malformed values stay typed configuration errors rather than
 * defects, so the entrypoint decides startup policy.
 * @category layers
 * @since 0.0.0
 */
export const ExecutionAuthorityConfigLive = Layer.effect(ExecutionAuthorityConfig, readExecutionAuthorityConfig());
