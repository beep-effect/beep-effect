import * as Domain from "@alchemy.run/domain";
import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";

/**
 * Refused: the run already has an accountable human.
 *
 * @category rejections
 * @since 0.0.0
 */
export class AccountabilityAlreadyAssigned extends Domain.Rejection(
  "AccountabilityAlreadyAssigned",
  {},
  { httpApiStatus: 409, description: "This agent run already has an accountable human." },
) {}

/**
 * The fact: a human answers for everything the run does, on whose behalf it acts.
 *
 * @category events
 * @since 0.0.0
 */
export class AccountabilityAssigned extends Domain.Event(
  "AccountabilityAssigned",
  carry({ run: RunId, accountable: PrincipalId, onBehalfOf: PrincipalId }),
) {}

/**
 * Take accountability for an agent run. A human root answers for it
 * themselves; an agent-rooted invocation (a parent run starting a child, or
 * a run continuing as a new run) names its own accountable human, so every
 * run in a lineage answers to the same person.
 *
 * @category commands
 * @since 0.0.0
 */
export class AssignAccountability extends Domain.Command(
  "AssignAccountability",
  {
    target: RunId,
    middleware: [Session],
    events: [AccountabilityAssigned],
    rejects: [AccountabilityAlreadyAssigned],
  },
  { description: "Take accountability for an agent run, as the signed-in human." },
) {}
