import * as Domain from "@alchemy.run/domain";
import { PartyCatalog } from "./Party.catalog.ts";

/**
 * Intake's client contract: the same RPC group as the model's `IntakeApi`.
 *
 * @category contracts
 * @since 0.0.0
 */
export class IntakeContract extends Domain.Api(
  "IntakeContract",
  { model: PartyCatalog, commands: ["AssertClaim", "AddEvidence", "RegisterParty"], views: [], queries: [], streams: [] },
  { description: "Register parties and assert claims about them for review." },
) {}
