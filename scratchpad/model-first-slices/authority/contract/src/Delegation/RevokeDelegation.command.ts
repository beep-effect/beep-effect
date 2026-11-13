import * as Domain from "@alchemy.run/domain";
import { DelegationId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import { DelegationNotActive } from "./DelegationNotActive.rejection.ts";
import { NotDelegator } from "./NotDelegator.rejection.ts";

/**
 * The fact: the delegation no longer authorizes anything.
 *
 * @category events
 * @since 0.0.0
 */
export class DelegationRevoked extends Domain.Event("DelegationRevoked", carry({ holder: RunId })) {}

/**
 * Revoke an active delegation.
 *
 * @category commands
 * @since 0.0.0
 */
export class RevokeDelegation extends Domain.Command(
  "RevokeDelegation",
  {
    target: DelegationId,
    middleware: [Session],
    events: [DelegationRevoked],
    rejects: [DelegationNotActive, NotDelegator],
  },
  { description: "Revoke a delegation." },
) {}
