import { AuthorityDeployment } from "@proto/authority-host/Authority.descriptor";
import { ConformanceDeployment } from "@proto/conformance/Conformance.descriptor";
import type { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { PartyDeployment } from "@proto/party-host/Party.descriptor";
import { RunsDeployment } from "@proto/runs-host/Runs.descriptor";

/**
 * The practice app's deployment: the descriptors its hosts publish, composed.
 * The app names no model or process itself (D13). Cluster entry modules will
 * be generated from this list; that is cluster work, not done here.
 *
 * @category deployment
 * @since 0.0.0
 */
export const PracticeDeployment: ReadonlyArray<DeploymentDescriptor> = [
  AuthorityDeployment,
  PartyDeployment,
  RunsDeployment,
];

/**
 * The conformance stage (D37): the practice deployment plus the conformance
 * models, on one pool. `scripts/entries.ts` generates the entry modules from
 * this list.
 *
 * @category deployment
 * @since 0.0.0
 */
export const ConformanceStack: ReadonlyArray<DeploymentDescriptor> = [...PracticeDeployment, ConformanceDeployment];
