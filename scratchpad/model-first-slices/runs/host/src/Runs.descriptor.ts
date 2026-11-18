import { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { RunsModel } from "@proto/runs-model/Runs.model";
import { ClaimDecidedVersion } from "./Inbox/ClaimDecided.inbox.ts";

/**
 * The runs host's deployment descriptor (D13): its model, its gateway and
 * inbox, and the one fact version the inbox consumes, read from the inbox
 * so the two cannot drift.
 *
 * @category deployment
 * @since 0.0.0
 */
export const RunsDeployment = DeploymentDescriptor.make({
  context: "runs",
  models: [RunsModel.modelName],
  processes: [
    { name: "RunsGateway", kind: "gateway" },
    { name: "ClaimDecidedInbox", kind: "inbox" },
  ],
  publishes: [],
  consumes: [{ producer: ClaimDecided.producer, contract: ClaimDecided.contract, version: ClaimDecidedVersion }],
  cluster: {
    module: "@proto/runs-host/Runs.cluster",
    export: "RunsCluster",
    parts: [
      { name: "RunsGateway", uses: ["AuthorityGateway"] },
      { name: "ClaimDecidedInbox", uses: ["AuthorityGateway", "PartyFactsFeed"] },
    ],
    apis: ["AuthorityGateway", "Session"],
  },
});
