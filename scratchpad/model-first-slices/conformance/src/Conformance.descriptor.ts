import { Conformance } from "@proto/conformance-upstream/model";
import { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { TwoRunnersModel } from "./TwoRunners.model.ts";

/**
 * The conformance models' deployment descriptor: upstream's conformance
 * model and the two-runners slot, hosted on the same pool as the prototype.
 *
 * @category deployment
 * @since 0.0.0
 */
export const ConformanceDeployment = DeploymentDescriptor.make({
  context: "conformance",
  models: [Conformance.modelName, TwoRunnersModel.modelName],
  processes: [],
  publishes: [],
  consumes: [],
  cluster: {
    module: "@proto/conformance/Conformance.cluster",
    export: "ConformanceCluster",
    parts: [{ name: "Conformance", uses: [] }],
    apis: [],
  },
});
