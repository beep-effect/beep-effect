import * as Domain from "@alchemy.run/domain";
import { GrantId, PrincipalId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { GrantNotActive } from "./GrantNotActive.rejection.ts";

/**
 * The fact: the grant no longer authorizes anything, nor do delegations of it.
 *
 * @category events
 * @since 0.0.0
 */
export class GrantRevoked extends Domain.Event("GrantRevoked", carry({ holder: PrincipalId })) {}

/**
 * Revoke an active grant.
 *
 * @category commands
 * @since 0.0.0
 */
export class RevokeGrant extends Domain.Command(
  "RevokeGrant",
  {
    target: GrantId,
    middleware: [Session],
    events: [GrantRevoked],
    rejects: [GrantNotActive, MissingGrant],
  },
  { description: "Revoke an active grant, and with it every delegation of it." },
) {}
