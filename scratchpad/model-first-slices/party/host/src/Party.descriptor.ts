import { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyModel } from "@proto/party-model/Party.model";
import * as A from "@beep/utils/Array";
import * as R from "effect/Record";

/**
 * The Party host's deployment descriptor (D13): its model, its processes,
 * and every `ClaimDecided` version its outbox publishes, read from the
 * contract so the two cannot drift.
 *
 * @category deployment
 * @since 0.0.0
 */
export const PartyDeployment = DeploymentDescriptor.make({
  context: "party",
  models: [PartyModel.modelName],
  processes: [
    { name: "MailboxPoller", kind: "poller" },
    { name: "PartyFactsFeed", kind: "feed" },
    { name: "DirectorySwitch", kind: "poller" },
  ],
  publishes: A.map(R.keys(ClaimDecided.versions), (version) => ({
    producer: ClaimDecided.producer,
    contract: ClaimDecided.contract,
    version: Number(version),
  })),
  cluster: {
    module: "@proto/party-host/Party.cluster",
    export: "PartyCluster",
    parts: [
      { name: "PartyFactsFeed", uses: ["AuthorityGateway", "RunsGateway"] },
      { name: "DirectorySwitch", uses: ["AuthorityGateway", "RunsGateway"] },
    ],
    apis: ["AuthorityGateway", "RunsGateway", "Session"],
  },
});
