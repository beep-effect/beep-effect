/**
 * Provider-instance actionable errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsUseCasesId } from "@beep/identity/packages";
import { RowVersion } from "@beep/shared-domain/entity/EntityKit";
import * as Agents from "@beep/shared-domain/identity/Agents";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.errors");

/**
 * **Example** (Make not-found error)
 *
 * ```ts
 * import { ProviderInstanceNotFound } from "@beep/agents-use-cases/public"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * console.log(ProviderInstanceNotFound.make({ providerInstanceId: Agents.ProviderInstanceId.make(1) })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderInstanceNotFound extends S.TaggedError<
  ProviderInstanceNotFound,
  { readonly brand: unique symbol }
>($I`ProviderInstanceNotFound`)(
  "ProviderInstanceNotFound",
  { providerInstanceId: Agents.ProviderInstanceId },
  $I.annoteError<ProviderInstanceNotFound>("ProviderInstanceNotFound", {
    description: "The requested provider instance does not exist.",
  })
) {}

/**
 * **Details**
 *
 * `save` treats the instance's `rowVersion` as the version it was read at. A
 * concurrent `update` or `probe` stored a newer version first; re-read the
 * instance and apply the change again.
 *
 * **Example** (Make version-conflict error)
 *
 * ```ts
 * import { ProviderInstanceVersionConflict } from "@beep/agents-use-cases/public"
 * import { RowVersion } from "@beep/shared-domain/entity/EntityKit"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * const error = ProviderInstanceVersionConflict.make({
 *   actualRowVersion: RowVersion.make(3),
 *   expectedRowVersion: RowVersion.make(2),
 *   providerInstanceId: Agents.ProviderInstanceId.make(1)
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderInstanceVersionConflict extends S.TaggedError<
  ProviderInstanceVersionConflict,
  { readonly brand: unique symbol }
>($I`ProviderInstanceVersionConflict`)(
  "ProviderInstanceVersionConflict",
  {
    actualRowVersion: RowVersion,
    expectedRowVersion: RowVersion,
    providerInstanceId: Agents.ProviderInstanceId,
  },
  $I.annoteError<ProviderInstanceVersionConflict>("ProviderInstanceVersionConflict", {
    description: "The provider instance changed after it was read; the stale save was rejected.",
  })
) {}

/**
 *  Provider CLI is logged out and requires the supplied domain guidance.
 *
 * **Example** (Make unauthenticated error)
 *
 * ```ts
 * import { ProviderUnauthenticated } from "@beep/agents-use-cases/public"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * const error = ProviderUnauthenticated.make({ providerInstanceId: Agents.ProviderInstanceId.make(1), guidance: "Run `codex login` in your terminal, then probe again." })
 * console.log(error.guidance)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderUnauthenticated extends S.TaggedError<ProviderUnauthenticated, { readonly brand: unique symbol }>(
  $I`ProviderUnauthenticated`
)(
  "ProviderUnauthenticated",
  {
    providerInstanceId: Agents.ProviderInstanceId,
    guidance: S.NonEmptyString,
  },
  $I.annoteError<ProviderUnauthenticated>("ProviderUnauthenticated", {
    description: "The provider CLI is unauthenticated and requires login.",
  })
) {}

/**
 *  Provider probing or persistence is temporarily unavailable.
 *
 * **Example** (Make probe unavailable error)
 *
 * ```ts
 * import { ProviderProbeUnavailable } from "@beep/agents-use-cases/public"
 * const error = ProviderProbeUnavailable.make({ guidance: "Check the configured binary path, then probe again." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderProbeUnavailable extends S.TaggedError<
  ProviderProbeUnavailable,
  { readonly brand: unique symbol }
>($I`ProviderProbeUnavailable`)(
  "ProviderProbeUnavailable",
  { guidance: S.NonEmptyString },
  $I.annoteError<ProviderProbeUnavailable>("ProviderProbeUnavailable", {
    description: "The provider probe or its persistence boundary is unavailable.",
  })
) {}

/**
 * **Example** (Check action error membership)
 *
 * ```ts
 * import { ProviderActionError, ProviderProbeUnavailable } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 * console.log(S.is(ProviderActionError)(ProviderProbeUnavailable.make({ guidance: "Try again." }))) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ProviderActionError = S.Union([
  ProviderInstanceNotFound,
  ProviderInstanceVersionConflict,
  ProviderUnauthenticated,
  ProviderProbeUnavailable,
]).pipe(
  $I.annoteSchema("ProviderActionError", { description: "Client-safe provider-instance action failures." }),
  S.toTaggedUnion("_tag")
);

/**
 * **Example** (Type action error value)
 *
 * ```ts
 * import { ProviderProbeUnavailable, type ProviderActionError } from "@beep/agents-use-cases/public"
 * const error: ProviderActionError = ProviderProbeUnavailable.make({ guidance: "Try again." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type ProviderActionError = typeof ProviderActionError.Type;
