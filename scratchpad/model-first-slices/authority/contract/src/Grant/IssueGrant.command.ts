import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { GrantId, PrincipalId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";

/**
 * Refused: a grant id is issued once.
 *
 * @category rejections
 * @since 0.0.0
 */
export class GrantAlreadyIssued extends Domain.Rejection(
  "GrantAlreadyIssued",
  {},
  { httpApiStatus: 409, description: "This grant id was already issued." },
) {}

/**
 * The fact: a principal now holds a capability on a resource, on these terms.
 *
 * @category events
 * @since 0.0.0
 */
export class GrantIssued extends Domain.Event("GrantIssued", carry({ holder: PrincipalId, terms: GrantTerms })) {}

/**
 * Issue a grant of a capability to a principal. The capability is named by
 * id; the authority context never imports the context that declares it.
 *
 * @category commands
 * @since 0.0.0
 */
export class IssueGrant extends Domain.Command(
  "IssueGrant",
  {
    target: GrantId,
    middleware: [Session],
    input: { holder: PrincipalId, terms: GrantTerms },
    events: [GrantIssued],
    rejects: [GrantAlreadyIssued, MissingGrant],
  },
  { description: "Issue a principal a grant of one capability on one resource, until an optional expiry." },
) {}
