import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { PartyModel } from "./Party.model.ts";

/**
 * What intake reaches (people at a desk, and pollers acting as the system):
 * register parties and assert claims. Every kind is listed; `[]` serves none.
 *
 * @category apis
 * @since 0.0.0
 */
export class IntakeApi extends Domain.Api(
  "IntakeApi",
  {
    model: PartyModel,
    commands: ["AssertClaim", "RegisterParty"],
    views: [],
    queries: [],
    streams: [],
  },
  { description: "Register parties and assert claims about them for review.", audience: "intake" },
) {}
