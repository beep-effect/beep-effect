import * as Domain from "@alchemy.run/domain";
import { PartyModel } from "./Party.model.ts";

/**
 * What an operating agent run reaches: read a claim, propose a disposition.
 * The boundary admits an agent only with a live accountable human.
 *
 * @category apis
 * @since 0.0.0
 */
export class AgentApi extends Domain.Api(
  "AgentApi",
  {
    model: PartyModel,
    commands: ["ProposeDisposition"],
    views: ["ClaimReview"],
    queries: [],
    streams: [],
  },
  { description: "Read a claim and propose a disposition on it, as an agent run." },
) {}
