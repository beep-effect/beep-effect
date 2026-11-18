import * as Domain from "@alchemy.run/domain";
import { PartiesMerged } from "@proto/party-contract/Party/MergeParties.command";
import { PartyRegistered } from "@proto/party-contract/Party/RegisterParty.command";
import { Party } from "../Party/Party.aggregate.ts";

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
