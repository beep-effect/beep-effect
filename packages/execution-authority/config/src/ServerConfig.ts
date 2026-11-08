/**
 * Server-only execution-authority configuration contract.
 *
 * **Details**
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

import { PolicyRevision, SinkDestination } from "@beep/execution-authority-domain/values/ExecutionGrant";
import { $ExecutionAuthorityConfigId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $ExecutionAuthorityConfigId.create("ServerConfig");

/**
 * Policy revision applied when `EXECUTION_AUTHORITY_POLICY_REVISION` is unset.
 *
 * **Example** (Log default policy revision)
 *
 * ```ts
 * import { defaultPolicyRevision } from "@beep/execution-authority-config/server"
 *
 * console.log(defaultPolicyRevision) // "1.0.0"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultPolicyRevision = Result.getOrThrow(S.decodeResult(PolicyRevision)("1.0.0"));

/**
 * Destination allowlist configuration declaration.
 *
 * **Details**
 *
 * Absent or empty means the empty allowlist, which denies every governed egress
 * and keeps `ontology_publish_provenance` unregistered — the fail-closed
 * default. A present-but-malformed entry (a blank between commas, a
 * non-string) stays a typed configuration error rather than being dropped,
 * because a silently discarded entry is indistinguishable from a denial the
 * operator did not intend.
 *
 * **Example** (Load allowlist from provider)
 *
 * ```ts
 * import { ExecutionAuthorityDestinationAllowlistConfig } from "@beep/execution-authority-config/server"
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 * const program = ExecutionAuthorityDestinationAllowlistConfig.pipe(
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({
 *         EXECUTION_AUTHORITY_EGRESS_DESTINATION_ALLOWLIST: "https://registry.example"
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
export const ExecutionAuthorityDestinationAllowlistConfig = Config.Array(
  SinkDestination,
  "EXECUTION_AUTHORITY_EGRESS_DESTINATION_ALLOWLIST"
).pipe(Config.withDefault<ReadonlyArray<SinkDestination>>([]));

/**
 * Pinned policy revision configuration declaration.
 *
 * **Example** (Load pinned policy revision)
 *
 * ```ts
 * import { ExecutionAuthorityPolicyRevisionConfig } from "@beep/execution-authority-config/server"
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 * const program = ExecutionAuthorityPolicyRevisionConfig.pipe(
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({ EXECUTION_AUTHORITY_POLICY_REVISION: "2.1.0" })
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
export const ExecutionAuthorityPolicyRevisionConfig = Config.schema(
  PolicyRevision,
  "EXECUTION_AUTHORITY_POLICY_REVISION"
).pipe(Config.withDefault(defaultPolicyRevision));

/**
 * Server-only execution-authority settings.
 *
 * **Example** (Make server config instance)
 *
 * ```ts
 * import { defaultPolicyRevision, ExecutionAuthorityServerConfig } from "@beep/execution-authority-config/server"
 * import { SinkDestination } from "@beep/execution-authority-domain/values/ExecutionGrant"
 * import * as S from "effect/Schema"
 *
 * const config = ExecutionAuthorityServerConfig.make({
 *   destinationAllowlist: [S.decodeUnknownSync(SinkDestination)("https://registry.example")],
 *   policyRevision: defaultPolicyRevision
 * })
 * console.log(config.destinationAllowlist.length) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ExecutionAuthorityServerConfig extends S.Opaque<
  ExecutionAuthorityServerConfig,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    destinationAllowlist: S.Array(SinkDestination).annotateKey({
      description: "Destinations governed egress may reach; empty denies every destination.",
    }),
    policyRevision: PolicyRevision.annotateKey({
      description: "Policy revision every grant and execution record is pinned to.",
    }),
  }).pipe(
    $I.annoteSchema("ExecutionAuthorityServerConfig", {
      title: "Execution authority server config",
      description: "Server-only execution-authority settings: destination allowlist and pinned policy revision.",
    })
  )
) {}

/**
 * Resolved execution-authority configuration service shape.
 *
 * **Example** (Annotate resolved config shape)
 *
 * ```ts
 * import { defaultPolicyRevision, ExecutionAuthorityServerConfig } from "@beep/execution-authority-config/server"
 * import type { ExecutionAuthorityConfigShape } from "@beep/execution-authority-config/server"
 *
 * const shape: ExecutionAuthorityConfigShape = ExecutionAuthorityServerConfig.make({
 *   destinationAllowlist: [],
 *   policyRevision: defaultPolicyRevision
 * })
 * console.log(shape.destinationAllowlist.length) // 0
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionAuthorityConfigShape = ExecutionAuthorityServerConfig;

/**
 * Context service supplying resolved server-only execution-authority configuration.
 *
 * **Example** (Read allowlist from service)
 *
 * ```ts
 * import { ExecutionAuthorityConfig } from "@beep/execution-authority-config/server"
 * import * as Effect from "effect/Effect";
 * const allowlist = ExecutionAuthorityConfig.pipe(
 *   Effect.map((config) => config.destinationAllowlist)
 * )
 *
 * console.log(Effect.isEffect(allowlist)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ExecutionAuthorityConfig extends Context.Service<
  ExecutionAuthorityConfig,
  ExecutionAuthorityConfigShape
>()($I`ExecutionAuthorityConfig`) {}
