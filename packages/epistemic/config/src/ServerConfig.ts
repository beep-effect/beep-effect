/**
 * Server-only execution-authority configuration contract.
 *
 * Owns the three settings the authority boundary is evaluated against: which
 * destinations may be reached at all, and which policy revision every grant and
 * record is pinned to. Destination audience is not configured here — it is
 * derived from the destination itself by the resolver in `./Audience.ts`, so a
 * caller can never self-declare a friendlier audience.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PolicyRevision, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant";
import { $EpistemicConfigId } from "@beep/identity/packages";
import { Config, Context } from "effect";
import * as S from "effect/Schema";

const $I = $EpistemicConfigId.create("ServerConfig");

/**
 * Policy revision applied when `EPISTEMIC_POLICY_REVISION` is unset.
 *
 * @example
 * ```ts
 * import { defaultPolicyRevision } from "@beep/epistemic-config/server"
 *
 * console.log(defaultPolicyRevision) // "1.0.0"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultPolicyRevision = PolicyRevision.fromUnknown("1.0.0");

/**
 * Destination allowlist configuration declaration.
 *
 * Absent or empty means the empty allowlist, which denies every governed egress
 * and keeps `ontology_publish_provenance` unregistered — the fail-closed
 * default. A present-but-malformed entry (a blank between commas, a
 * non-string) stays a typed configuration error rather than being dropped,
 * because a silently discarded entry is indistinguishable from a denial the
 * operator did not intend.
 *
 * @example
 * ```ts
 * import { EpistemicDestinationAllowlistConfig } from "@beep/epistemic-config/server"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const program = EpistemicDestinationAllowlistConfig.pipe(
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({
 *         EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST: "https://registry.example"
 *       })
 *     )
 *   )
 * )
 *
 * Effect.runPromise(program).then(console.log) // ["https://registry.example"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EpistemicDestinationAllowlistConfig = Config.schema(
  Config.Array(SinkDestination),
  "EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST"
).pipe(Config.withDefault<ReadonlyArray<SinkDestination>>([]));

/**
 * Pinned policy revision configuration declaration.
 *
 * @example
 * ```ts
 * import { EpistemicPolicyRevisionConfig } from "@beep/epistemic-config/server"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const program = EpistemicPolicyRevisionConfig.pipe(
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({ EPISTEMIC_POLICY_REVISION: "2.1.0" })
 *     )
 *   )
 * )
 *
 * Effect.runPromise(program).then(console.log) // "2.1.0"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EpistemicPolicyRevisionConfig = Config.schema(PolicyRevision, "EPISTEMIC_POLICY_REVISION").pipe(
  Config.withDefault(defaultPolicyRevision)
);

/**
 * Server-only execution-authority settings.
 *
 * @example
 * ```ts
 * import { defaultPolicyRevision, EpistemicServerConfig } from "@beep/epistemic-config/server"
 * import { SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant"
 *
 * const config = EpistemicServerConfig.make({
 *   destinationAllowlist: [SinkDestination.fromUnknown("https://registry.example")],
 *   policyRevision: defaultPolicyRevision
 * })
 * console.log(config.destinationAllowlist.length) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class EpistemicServerConfig extends S.Class<EpistemicServerConfig>($I`EpistemicServerConfig`)(
  {
    destinationAllowlist: S.Array(SinkDestination).annotateKey({
      description: "Destinations governed egress may reach; empty denies every destination.",
    }),
    policyRevision: PolicyRevision.annotateKey({
      description: "Policy revision every grant and execution record is pinned to.",
    }),
  },
  $I.annote("EpistemicServerConfig", {
    title: "Epistemic server config",
    description: "Server-only execution-authority settings: destination allowlist and pinned policy revision.",
  })
) {}

/**
 * Resolved execution-authority configuration service shape.
 *
 * @example
 * ```ts
 * import { defaultPolicyRevision, EpistemicServerConfig } from "@beep/epistemic-config/server"
 * import type { EpistemicConfigShape } from "@beep/epistemic-config/server"
 *
 * const shape: EpistemicConfigShape = EpistemicServerConfig.make({
 *   destinationAllowlist: [],
 *   policyRevision: defaultPolicyRevision
 * })
 * console.log(shape.destinationAllowlist.length) // 0
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EpistemicConfigShape = EpistemicServerConfig;

/**
 * Context service supplying resolved server-only execution-authority configuration.
 *
 * @example
 * ```ts
 * import { EpistemicConfig } from "@beep/epistemic-config/server"
 * import { Effect } from "effect"
 *
 * const allowlist = EpistemicConfig.pipe(
 *   Effect.map((config) => config.destinationAllowlist)
 * )
 *
 * console.log(Effect.isEffect(allowlist)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EpistemicConfig extends Context.Service<EpistemicConfig, EpistemicConfigShape>()($I`EpistemicConfig`) {}
