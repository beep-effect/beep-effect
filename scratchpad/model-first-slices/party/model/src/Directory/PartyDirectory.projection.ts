import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { PartiesMerged } from "../Party/MergeParties.command.ts";
import { Party } from "../Party/Party.aggregate.ts";
import { PartyRegistered } from "../Party/RegisterParty.command.ts";

/**
 * Every party, one row each, in a store outside the model, for searches
 * across keys.
 *
 * @category projections
 * @since 0.0.0
 */
export class PartyDirectory extends Domain.Projection(
  "PartyDirectory",
  { from: [Party], key: Party, on: [PartyRegistered, PartiesMerged] },
  { description: "The party directory: one row per party, for search." },
) {}
