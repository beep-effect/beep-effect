import * as Domain from "@alchemy.run/domain";
import { GrantId, PrincipalId } from "@proto/kernel/Ids";
import { carry, Provenance } from "@proto/kernel/Invocation";

/**
 * The fact: the grant reached its expiry.
 *
 * @category events
 * @since 0.0.0
 */
export class GrantExpired extends Domain.Event("GrantExpired", carry({ holder: PrincipalId })) {}

/**
 * A deadline: expire the grant if its expiry has passed. It never rejects,
 * so it can be scheduled; it records nothing when the grant is no longer
 * active or its expiry moved later. Only the model's own policy schedules
 * it, with the provenance that armed it, so it declares no middleware.
 *
 * @category commands
 * @since 0.0.0
 */
export class ExpireGrant extends Domain.Command(
  "ExpireGrant",
  { target: GrantId, input: { provenance: Provenance }, events: [GrantExpired] },
  { description: "Expire a grant whose expiry has passed." },
) {}
