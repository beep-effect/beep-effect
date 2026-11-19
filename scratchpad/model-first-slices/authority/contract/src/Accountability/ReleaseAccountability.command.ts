import * as Domain from "@alchemy.run/domain";
import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("Accountability/ReleaseAccountability.command");

/**
 * Refused: the caller is not the run's live accountable human.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotAccountable extends S.TaggedError<NotAccountable, { readonly brand: unique symbol }>()(
  "NotAccountable",
  {},
  $I.annote("NotAccountable", { httpApiStatus: 403, description: "The caller is not this run's live accountable human." }),
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
  { description: "The human no longer answers for the agent run, so the boundary stops admitting it." },
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
