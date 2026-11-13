import { AuthorityModel } from "@proto/authority-model/Authority.model";
import { DeploymentDescriptor } from "@proto/kernel/Deployment";

/**
 * The authority host's deployment descriptor (D13): its model, the gateway
 * other hosts re-admit through, and the session boundary.
 *
 * @category deployment
 * @since 0.0.0
 */
export const AuthorityDeployment = DeploymentDescriptor.make({
  context: "authority",
  models: [AuthorityModel.modelName],
  processes: [
    { name: "AuthorityGateway", kind: "gateway" },
    { name: "Session", kind: "session" },
  ],
  publishes: [],
  consumes: [],
});
