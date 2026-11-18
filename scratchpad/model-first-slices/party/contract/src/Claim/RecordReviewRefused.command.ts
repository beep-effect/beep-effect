import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { carry, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { ClaimId } from "./Claim.id.ts";

/**
 * The fact: a review run could not start or could not continue, and why.
 *
 * @category events
 * @since 0.0.0
 */
export class ReviewRefused extends Domain.Event("ReviewRefused", carry({ run: RunId, reason: S.String }), { description: "A review run could not start or could not continue, and why." }) {}

/**
 * Record a refused review run on the claim. Sent only by the model's own
 * policy and saga, with the provenance they acted on; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class RecordReviewRefused extends Domain.Command(
  "RecordReviewRefused",
  { target: ClaimId, input: { run: RunId, reason: S.String, provenance: Provenance }, events: [ReviewRefused] },
  { description: "Record that a review run was refused." },
) {}
