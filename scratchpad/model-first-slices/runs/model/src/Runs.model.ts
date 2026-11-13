import * as Domain from "@alchemy.run/domain";
import { AgentRun } from "./Run/AgentRun.aggregate.ts";
import { ContinueAtBound } from "./Run/ContinueAtBound.policy.ts";
import { GrantOnRequest } from "./Run/GrantOnRequest.policy.ts";
import { OpenChildOnRequest } from "./Run/OpenChildOnRequest.policy.ts";
import { SessionRuns } from "./Run/SessionRuns.view.ts";

/**
 * The runs context (D28): agent runs, their budget ledger and their lineage.
 * A product context executes a run and reports to it; the authority context
 * grants it.
 *
 * @category models
 * @since 0.0.0
 */
export class RunsModel extends Domain.Model(
  "Runs",
  {
    aggregates: [AgentRun],
    views: [SessionRuns],
    policies: [GrantOnRequest, OpenChildOnRequest, ContinueAtBound],
  },
  { description: "Agent runs: lifecycle, budget, grants, lineage and continuation." },
) {}
