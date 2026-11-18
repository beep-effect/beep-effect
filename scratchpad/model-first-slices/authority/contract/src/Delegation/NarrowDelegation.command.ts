import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import { TermsWiden } from "../TermsWiden.rejection.ts";
import { DelegationNotActive } from "./DelegationNotActive.rejection.ts";
import { NotDelegator } from "./NotDelegator.rejection.ts";

/**
 * The fact: the delegation's terms now reach less far.
 *
 * @category events
 * @since 0.0.0
 */
export class DelegationNarrowed extends Domain.Event(
  "DelegationNarrowed",
  carry({ holder: RunId, terms: GrantTerms }),
) {}

/**
 * Narrow an active delegation. It can never widen.
 *
 * @category commands
 * @since 0.0.0
 */
export class NarrowDelegation extends Domain.Command(
  "NarrowDelegation",
  {
    target: DelegationId,
    middleware: [Session],
    input: { terms: GrantTerms },
    events: [DelegationNarrowed],
    rejects: [DelegationNotActive, TermsWiden, NotDelegator],
  },
  { description: "Narrow a delegation's operations, resource or expiry." },
) {}
