import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef, Hop, type Invocation, Provenance } from "@proto/kernel/Invocation";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import { $AuthorityContractId } from "@proto/kernel/Identity";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AuthorityContractId.create("Authority.gateway");

/**
 * What a hop asks to be re-admitted with: the provenance it continues and the hop it adds.
 *
 * @category models
 * @since 0.0.0
 */
export const ReadmitRequest = { provenance: Provenance, hop: Hop };

/**
 * What granting a run asks for: the requester's provenance and hop, the
 * grant (or delegation) the run's authority derives from, the delegation id
 * and run to create, and the narrowed terms.
 *
 * @category models
 * @since 0.0.0
 */
export const RunGrantRequest = {
  provenance: Provenance,
  hop: Hop,
  source: GrantRef,
  delegation: DelegationId,
  run: RunId,
  terms: GrantTerms,
};

/**
 * A run's authority, granted: its delegation, the human who answers for it,
 * and the provenance the run acts under (an agent root naming that human).
 *
 * @category models
 * @since 0.0.0
 */
export const RunGrant = S.Struct({ delegation: DelegationId, accountable: PrincipalId, provenance: Provenance });
/**
 * @category models
 * @since 0.0.0
 */
export type RunGrant = typeof RunGrant.Type;

/**
 * Refused: the run's authority could not be granted, and why (the requester
 * does not hold the source, the terms widen it, the source is not active).
 *
 * @category errors
 * @since 0.0.0
 */
export class RunGrantRefused extends S.TaggedError<RunGrantRefused, { readonly brand: unique symbol }>()("RunGrantRefused", { reason: S.String }) {}

/**
 * Why `grantRun` refused: the run's authority could not be granted, or the
 * requester's hop was not re-admitted.
 *
 * **Example** (Rendering a refusal)
 * ```ts
 * import { RunGrantRefusal, RunGrantRefused } from "@proto/authority-contract/Authority.gateway";
 *
 * const reason = RunGrantRefusal.match(RunGrantRefused.make({ reason: "NotHeld" }), {
 *   RunGrantRefused: (refused) => refused.reason,
 *   ReadmissionRefused: (refused) => `readmission:${refused.reason}`,
 * });
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const RunGrantRefusal = S.Union([RunGrantRefused, ReadmissionRefused]).pipe(
  $I.annoteSchema("RunGrantRefusal", { description: "Why granting a run's authority was refused." }),
  S.toTaggedUnion("_tag"),
);
/**
 * @category errors
 * @since 0.0.0
 */
export type RunGrantRefusal = typeof RunGrantRefusal.Type;

/**
 * The authority context's synchronous contract for other contexts' hosts.
 * A product context declares its own port and adapts it to this service;
 * only the authority host implements it, so only authority builds an
 * `Invocation`.
 *
 * **Gotchas**
 *
 * In memory it is a Layer; across processes it is the same operations over
 * RPC, and the calling host must then authenticate itself. It trusts the
 * provenance it is handed, as the library trusts in-process request context
 * (D25).
 *
 * @category contracts
 * @since 0.0.0
 */
export class AuthorityGateway extends Context.Service<
  AuthorityGateway,
  {
    /** Rebuild the invocation for the next hop from live grants, or refuse. */
    readonly readmit: (request: {
      readonly provenance: Provenance;
      readonly hop: Hop;
    }) => Effect.Effect<Invocation, ReadmissionRefused>;
    /**
     * Delegate narrowed terms to a run and assign its accountable human, as
     * the re-admitted requester. Returns once the delegation is open.
     */
    readonly grantRun: (request: {
      readonly provenance: Provenance;
      readonly hop: Hop;
      readonly source: GrantRef;
      readonly delegation: DelegationId;
      readonly run: RunId;
      readonly terms: GrantTerms;
    }) => Effect.Effect<RunGrant, RunGrantRefusal>;
  }
>()($I`AuthorityGateway`) {}
