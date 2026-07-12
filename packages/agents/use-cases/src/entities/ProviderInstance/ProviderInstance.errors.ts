/** Provider-instance actionable errors. @packageDocumentation @since 0.0.0 */
import { $AgentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as Agents from "@beep/shared-domain/identity/Agents";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("entities/ProviderInstance/ProviderInstance.errors");

/** Requested provider instance does not exist.
 * @example
 * ```ts
 * import { ProviderInstanceNotFound } from "@beep/agents-use-cases/public"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * console.log(ProviderInstanceNotFound.make({ providerInstanceId: Agents.ProviderInstanceId.make(1) })._tag)
 * ```
 * @category errors @since 0.0.0
 */
export class ProviderInstanceNotFound extends TaggedErrorClass<ProviderInstanceNotFound>($I`ProviderInstanceNotFound`)(
  "ProviderInstanceNotFound",
  { providerInstanceId: Agents.ProviderInstanceId },
  $I.annote("ProviderInstanceNotFound", { description: "The requested provider instance does not exist." })
) {}

/** Provider CLI is logged out and requires the supplied domain guidance.
 * @example
 * ```ts
 * import { ProviderUnauthenticated } from "@beep/agents-use-cases/public"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * const error = ProviderUnauthenticated.make({ providerInstanceId: Agents.ProviderInstanceId.make(1), guidance: "Run `codex login` in your terminal, then probe again." })
 * console.log(error.guidance)
 * ```
 * @category errors @since 0.0.0
 */
export class ProviderUnauthenticated extends TaggedErrorClass<ProviderUnauthenticated>($I`ProviderUnauthenticated`)(
  "ProviderUnauthenticated",
  { providerInstanceId: Agents.ProviderInstanceId, guidance: S.NonEmptyString },
  $I.annote("ProviderUnauthenticated", { description: "The provider CLI is unauthenticated and requires login." })
) {}

/** Provider probing or persistence is temporarily unavailable.
 * @example
 * ```ts
 * import { ProviderProbeUnavailable } from "@beep/agents-use-cases/public"
 * const error = ProviderProbeUnavailable.make({ guidance: "Check the configured binary path, then probe again." })
 * console.log(error._tag)
 * ```
 * @category errors @since 0.0.0
 */
export class ProviderProbeUnavailable extends TaggedErrorClass<ProviderProbeUnavailable>($I`ProviderProbeUnavailable`)(
  "ProviderProbeUnavailable",
  { guidance: S.NonEmptyString },
  $I.annote("ProviderProbeUnavailable", {
    description: "The provider probe or its persistence boundary is unavailable.",
  })
) {}

/** Tagged union of client-safe provider-instance failures.
 * @example
 * ```ts
 * import { ProviderActionError, ProviderProbeUnavailable } from "@beep/agents-use-cases/public"
 * console.log(ProviderActionError.is(ProviderProbeUnavailable.make({ guidance: "Try again." }))) // true
 * ```
 * @category errors @since 0.0.0
 */
export const ProviderActionError = S.Union([
  ProviderInstanceNotFound,
  ProviderUnauthenticated,
  ProviderProbeUnavailable,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ProviderActionError", { description: "Client-safe provider-instance action failures." }),
  SchemaUtils.withCodecStatics
);

/** Runtime type for {@link ProviderActionError}.
 * @example
 * ```ts
 * import { ProviderProbeUnavailable, type ProviderActionError } from "@beep/agents-use-cases/public"
 * const error: ProviderActionError = ProviderProbeUnavailable.make({ guidance: "Try again." })
 * console.log(error._tag)
 * ```
 * @category errors @since 0.0.0
 */
export type ProviderActionError = typeof ProviderActionError.Type;
