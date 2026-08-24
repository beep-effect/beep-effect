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

const ProviderInstanceNotFoundFields = { providerInstanceId: Agents.ProviderInstanceId } satisfies S.Struct.Fields;
const sameProviderInstanceNotFoundFields = S.toEquivalence(
  S.TaggedStruct("ProviderInstanceNotFound", ProviderInstanceNotFoundFields)
);
const sameProviderInstanceNotFound = (self: ProviderInstanceNotFound, that: ProviderInstanceNotFound): boolean =>
  sameProviderInstanceNotFoundFields(self, that);

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
  ProviderInstanceNotFoundFields,
  $I.annoteClass<
    S.declare<ProviderInstanceNotFound>,
    readonly [S.TaggedStruct<"ProviderInstanceNotFound", typeof ProviderInstanceNotFoundFields>]
  >("ProviderInstanceNotFound", {
    description: "The requested provider instance does not exist.",
    toEquivalence: () => sameProviderInstanceNotFound,
  })
) {}

const ProviderUnauthenticatedFields = {
  providerInstanceId: Agents.ProviderInstanceId,
  guidance: S.NonEmptyString,
} satisfies S.Struct.Fields;
const sameProviderUnauthenticatedFields = S.toEquivalence(
  S.TaggedStruct("ProviderUnauthenticated", ProviderUnauthenticatedFields)
);
const sameProviderUnauthenticated = (self: ProviderUnauthenticated, that: ProviderUnauthenticated): boolean =>
  sameProviderUnauthenticatedFields(self, that);

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
  ProviderUnauthenticatedFields,
  $I.annoteClass<
    S.declare<ProviderUnauthenticated>,
    readonly [S.TaggedStruct<"ProviderUnauthenticated", typeof ProviderUnauthenticatedFields>]
  >("ProviderUnauthenticated", {
    description: "The provider CLI is unauthenticated and requires login.",
    toEquivalence: () => sameProviderUnauthenticated,
  })
) {}

const ProviderProbeUnavailableFields = { guidance: S.NonEmptyString } satisfies S.Struct.Fields;
const sameProviderProbeUnavailableFields = S.toEquivalence(
  S.TaggedStruct("ProviderProbeUnavailable", ProviderProbeUnavailableFields)
);
const sameProviderProbeUnavailable = (self: ProviderProbeUnavailable, that: ProviderProbeUnavailable): boolean =>
  sameProviderProbeUnavailableFields(self, that);

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
  ProviderProbeUnavailableFields,
  $I.annoteClass<
    S.declare<ProviderProbeUnavailable>,
    readonly [S.TaggedStruct<"ProviderProbeUnavailable", typeof ProviderProbeUnavailableFields>]
  >("ProviderProbeUnavailable", {
    description: "The provider probe or its persistence boundary is unavailable.",

    toEquivalence: () => sameProviderProbeUnavailable,
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
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ProviderActionError", { description: "Client-safe provider-instance action failures." }),
  SchemaUtils.withCodecStatics
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
