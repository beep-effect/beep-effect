import * as Domain from "@alchemy.run/domain";
import { PartyCatalog } from "./Party.catalog.ts";

/**
 * An operating agent's client contract: the same RPC group as the model's
 * `AgentApi`.
 *
 * @category contracts
 * @since 0.0.0
 */
export class AgentContract extends Domain.Api(
  "AgentContract",
  { model: PartyCatalog, commands: ["ProposeDisposition"], views: ["ClaimReview"], queries: [], streams: [] },
  { description: "Read a claim and propose a disposition on it, as an agent run." },
) {}
