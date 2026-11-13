import * as Domain from "@alchemy.run/domain";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { PartyId } from "./Party.id.ts";

/**
 * Refused: this merge cannot happen, and why. (Merging across orgs is now a
 * `MissingGrant`: the grant check names the survivor's org.)
 *
 * @category rejections
 * @since 0.0.0
 */
export class MergeVetoed extends Domain.Rejection(
  "MergeVetoed",
  { reason: S.Literals(["not-registered", "self-merge"]) },
  { httpApiStatus: 409, description: "The parties cannot be merged." },
) {}

/**
 * The fact: the absorbed party is now part of this one.
 *
 * @category events
 * @since 0.0.0
 */
export class PartiesMerged extends Domain.Event("PartiesMerged", carry({ absorbed: PartyId })) {}

/**
 * Merge another party into this one (the survivor).
 *
 * @category commands
 * @since 0.0.0
 */
export class MergeParties extends Domain.Command(
  "MergeParties",
  {
    target: PartyId,
    middleware: [Session],
    input: { absorbed: PartyId },
    events: [PartiesMerged],
    rejects: [MergeVetoed, MissingGrant],
  },
  { description: "Merge the absorbed party into the target party, which survives." },
) {}
