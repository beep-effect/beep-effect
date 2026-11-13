import * as Domain from "@alchemy.run/domain";
import { carry, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { ClaimId } from "./Claim.id.ts";

/**
 * The fact: the merge an accepted `SameParty` claim implies did not happen,
 * and why (re-admission refused, merge vetoed, or no grant).
 *
 * @category events
 * @since 0.0.0
 */
export class MergeRefused extends Domain.Event("MergeRefused", carry({ reason: S.String })) {}

/**
 * Record a refused merge on the claim. Sent only by the model's own merge
 * policy, with the provenance it acted on; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class RecordMergeRefused extends Domain.Command(
  "RecordMergeRefused",
  { target: ClaimId, input: { reason: S.String, provenance: Provenance }, events: [MergeRefused] },
  { description: "Record that an accepted claim's merge was refused." },
) {}
