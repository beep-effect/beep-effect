import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { CapabilityId } from "./Ids.ts";

/**
 * Refused: no grant on the invocation covers this operation of this
 * capability on this resource, now. Every context's commands, guarded reads
 * and queries refuse with it, so a caller handles one shape.
 *
 * **Example** (Refuse an accept without a review grant)
 * ```ts
 * import { CapabilityId } from "@proto/kernel/Ids";
 * import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
 *
 * const refusal = new MissingGrant({ capability: CapabilityId.make("party.review"), operation: "AcceptClaim" });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class MissingGrant extends Domain.Rejection(
  "MissingGrant",
  { capability: CapabilityId, operation: S.String },
  { httpApiStatus: 403, description: "No grant on the invocation covers this operation on this resource." },
) {}
