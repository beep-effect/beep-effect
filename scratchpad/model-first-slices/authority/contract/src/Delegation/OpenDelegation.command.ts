import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, GrantId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { carry, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("Delegation/OpenDelegation.command");

/**
 * Refused: a delegation id is opened once.
 *
 * @category rejections
 * @since 0.0.0
 */
export class DelegationAlreadyOpen extends S.TaggedError<DelegationAlreadyOpen, { readonly brand: unique symbol }>()(
  "DelegationAlreadyOpen",
  {},
  $I.annote("DelegationAlreadyOpen", { httpApiStatus: 409, description: "This delegation id was already opened." }),
) {}

/**
 * The fact: an agent run holds a delegation of a grant (directly, or through
 * a parent delegation), on these terms.
 *
 * @category events
 * @since 0.0.0
 */
export class DelegationOpened extends Domain.Event(
  "DelegationOpened",
  carry({
    parent: GrantId,
    parentDelegation: S.OptionFromNullOr(DelegationId),
    holder: RunId,
    delegator: PrincipalId,
    terms: GrantTerms,
  }),
  { description: "An agent run now holds a delegation of a grant, directly or through a parent delegation, on these terms." },
) {}

/**
 * Open a delegation its parent already checked. Sent only by the authority
 * model's own policy on `GrantDelegated` or `DelegationExtended`, with the
 * triggering provenance; no Api serves it, so it declares no middleware.
 *
 * @category commands
 * @since 0.0.0
 */
export class OpenDelegation extends Domain.Command(
  "OpenDelegation",
  {
    target: DelegationId,
    input: {
      parent: GrantId,
      parentDelegation: S.OptionFromNullOr(DelegationId),
      holder: RunId,
      delegator: PrincipalId,
      terms: GrantTerms,
      provenance: Provenance,
    },
    events: [DelegationOpened],
    rejects: [DelegationAlreadyOpen],
  },
  { description: "Open a delegation of a grant to an agent run, on terms its parent already checked." },
) {}
