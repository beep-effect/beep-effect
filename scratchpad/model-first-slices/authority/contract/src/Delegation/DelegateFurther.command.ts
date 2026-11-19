import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, GrantId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import { TermsWiden } from "../TermsWiden.rejection.ts";
import { DelegationNotActive } from "./DelegationNotActive.rejection.ts";
import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("Delegation/DelegateFurther.command");

/**
 * Refused: only the agent run holding a delegation delegates it further.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotDelegationHolder extends S.TaggedError<NotDelegationHolder, { readonly brand: unique symbol }>()(
  "NotDelegationHolder",
  {},
  $I.annote("NotDelegationHolder", { httpApiStatus: 403, description: "Only the agent run holding a delegation may delegate it further." }),
) {}

/**
 * The fact: the run holding this delegation passed narrower terms of it to another run.
 *
 * @category events
 * @since 0.0.0
 */
export class DelegationExtended extends Domain.Event(
  "DelegationExtended",
  carry({ holder: RunId, grant: GrantId, child: DelegationId, to: RunId, terms: GrantTerms }),
  { description: "The run holding this delegation passed narrower terms of it to another agent run." },
) {}

/**
 * Delegate narrower terms of a delegation to another run: a child run, or
 * the run a bounded run continues as. Only the holding run may, and only narrower.
 *
 * @category commands
 * @since 0.0.0
 */
export class DelegateFurther extends Domain.Command(
  "DelegateFurther",
  {
    target: DelegationId,
    middleware: [Session],
    input: { child: DelegationId, to: RunId, terms: GrantTerms },
    events: [DelegationExtended],
    rejects: [DelegationNotActive, TermsWiden, NotDelegationHolder],
  },
  { description: "Delegate narrower terms of a delegation you hold, as an agent run, to another run." },
) {}
