import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, GrantId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import { TermsWiden } from "../TermsWiden.rejection.ts";
import { GrantNotActive } from "./GrantNotActive.rejection.ts";
import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("Grant/DelegateGrant.command");

/**
 * Refused: only the person who holds a grant delegates it.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotHolder extends S.TaggedError<NotHolder, { readonly brand: unique symbol }>()(
  "NotHolder",
  {},
  $I.annote("NotHolder", { httpApiStatus: 403, description: "Only the human holding a grant may delegate it." }),
) {}

/**
 * The fact: the holder delegated narrower terms of this grant to an agent run.
 *
 * @category events
 * @since 0.0.0
 */
export class GrantDelegated extends Domain.Event(
  "GrantDelegated",
  carry({ holder: PrincipalId, delegation: DelegationId, to: RunId, terms: GrantTerms }),
  { description: "The holder delegated narrower terms of this grant to an agent run." },
) {}

/**
 * Delegate part of a grant to an agent run. The delegated terms can only
 * narrow the grant's: same capability, a subset of its operations, a
 * resource it covers, and an expiry no later than its own.
 *
 * @category commands
 * @since 0.0.0
 */
export class DelegateGrant extends Domain.Command(
  "DelegateGrant",
  {
    target: GrantId,
    middleware: [Session],
    input: { delegation: DelegationId, to: RunId, terms: GrantTerms },
    events: [GrantDelegated],
    rejects: [GrantNotActive, TermsWiden, NotHolder],
  },
  { description: "Delegate narrower terms of a grant you hold to an agent run." },
) {}
