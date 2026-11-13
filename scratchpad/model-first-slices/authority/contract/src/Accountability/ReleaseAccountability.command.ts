import * as Domain from "@alchemy.run/domain";
import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";

/**
 * Refused: the caller is not the run's live accountable human.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotAccountable extends Domain.Rejection(
  "NotAccountable",
  {},
  { httpApiStatus: 403, description: "The caller is not this run's live accountable human." },
) {}

/**
 * The fact: the human no longer answers for the run, so the boundary no
 * longer admits it.
 *
 * @category events
 * @since 0.0.0
 */
export class AccountabilityReleased extends Domain.Event(
  "AccountabilityReleased",
  carry({ run: RunId, accountable: PrincipalId }),
) {}

/**
 * Release accountability for an agent run. After this the boundary refuses it.
 *
 * @category commands
 * @since 0.0.0
 */
export class ReleaseAccountability extends Domain.Command(
  "ReleaseAccountability",
  {
    target: RunId,
    middleware: [Session],
    events: [AccountabilityReleased],
    rejects: [NotAccountable],
  },
  { description: "Release accountability for an agent run you answer for." },
) {}
