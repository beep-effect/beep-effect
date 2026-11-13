import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Actor } from "@proto/kernel/Actor";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { PartyId } from "./Party.id.ts";

/**
 * Refused: this merge cannot happen, and why.
 *
 * @category rejections
 * @since 0.0.0
 */
export class MergeVetoed extends Domain.Rejection(
  "MergeVetoed",
  { reason: S.Literals(["not-registered", "self-merge", "other-org"]) },
  { httpApiStatus: 409, description: "The parties cannot be merged." },
) {}

/**
 * The fact: the absorbed party is now part of this one.
 *
 * @category events
 * @since 0.0.0
 */
export class PartiesMerged extends Domain.Event("PartiesMerged", {
  absorbed: PartyId,
  by: Actor,
}) {}

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
    rejects: [MergeVetoed],
  },
  { description: "Merge the absorbed party into the target party, which survives.", audience: "reviewer" },
) {}
