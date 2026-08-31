/**
 * Provider-instance actionable errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as Agents from "@beep/shared-domain/identity/Agents";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.errors");

/**
 *  Requested provider instance does not exist.
 *
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
export class ProviderInstanceNotFound extends S.TaggedError<ProviderInstanceNotFound>($I`ProviderInstanceNotFound`)(
  "ProviderInstanceNotFound",
  { providerInstanceId: Agents.ProviderInstanceId },
  $I.annoteError<ProviderInstanceNotFound>("ProviderInstanceNotFound", {
    description: "The requested provider instance does not exist.",
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
export class ProviderUnauthenticated extends S.TaggedError<ProviderUnauthenticated>($I`ProviderUnauthenticated`)(
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
export class ProviderProbeUnavailable extends S.TaggedError<ProviderProbeUnavailable>($I`ProviderProbeUnavailable`)(
  "ProviderProbeUnavailable",
  { guidance: S.NonEmptyString },
  $I.annoteError<ProviderProbeUnavailable>("ProviderProbeUnavailable", {
    description: "The provider probe or its persistence boundary is unavailable.",
  })
) {}

/**
 *  Tagged union of client-safe provider-instance failures.
 *
 * **Example** (Check action error membership)
 *
 * ```ts
 * import { ProviderActionError, ProviderProbeUnavailable } from "@beep/agents-use-cases/public"
 * console.log(ProviderActionError.is(ProviderProbeUnavailable.make({ guidance: "Try again." }))) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ProviderActionError = S.Union([
  ProviderInstanceNotFound,
  ProviderUnauthenticated,
  ProviderProbeUnavailable,
]).pipe(
  // fallow-ignore-next-line code-duplication -- preserve the selected guard through Effect's tagged-union rebuild
  $I.annoteSchema("ProviderActionError", { description: "Client-safe provider-instance action failures." }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("_tag"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 *  Runtime type for {@link ProviderActionError}.
 *
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
