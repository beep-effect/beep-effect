import * as AWS from "@alchemy.run/aws";
import * as Alchemy from "alchemy";
import { program } from "./src/CostControls.ts";
import { providers } from "./src/Providers.ts";

// decision: shared-alchemy-state-store
const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * Account cost controls, replacing the Pulumi `AccountCostControls`
 * component of `beep-ci-runners/production`. `prod` runs only in CI
 * (`CI=true`) under the `alchemy-cost-controls-prod` concurrency group, and
 * every stage refuses an account other than the configured one.
 */
export default Alchemy.Stack("CostControls", { providers, state }, program);
