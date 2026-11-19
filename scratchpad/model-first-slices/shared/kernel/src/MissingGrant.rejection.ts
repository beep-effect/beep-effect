import * as S from "effect/Schema";
import { $KernelId } from "./Identity.ts";
import { CapabilityId } from "./Ids.ts";
import { Name } from "./Measure.ts";

const $I = $KernelId.create("MissingGrant.rejection");

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
 * const refusal = MissingGrant.make({ capability: CapabilityId.make("party.review"), operation: "AcceptClaim" });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class MissingGrant extends S.TaggedError<MissingGrant, { readonly brand: unique symbol }>()(
  "MissingGrant",
  { capability: CapabilityId, operation: Name },
  $I.annote("MissingGrant", {
    httpApiStatus: 403,
    description: "No grant on the invocation covers this operation on this resource.",
  }),
) {}
