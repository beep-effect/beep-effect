import * as AWS from "@alchemy.run/aws";
import * as Docker from "@alchemy.run/docker";
import { aiMetricsStackName, aiMetricsStackProgram } from "@beep/infra-hosts/AiMetricsStack";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import * as Layer from "effect/Layer";

// decision: shared-alchemy-state-store
const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * AI metrics (Arize Phoenix) on dankserver. `prod` runs from the operator
 * workstation only and refuses CI (D21); the stage lease in the shared store
 * is the overlap guard. Configuration: the JSON file named by
 * `BEEP_AI_METRICS_HOST_CONFIG`. The OpenClaw stack is the sibling entry,
 * `openclaw.alchemy.run.ts`. Runbook: docs/runbooks/alchemy-infra.md.
 */
export default Alchemy.Stack(
  aiMetricsStackName,
  {
    providers: Layer.mergeAll(Docker.providers(), Command.providers()),
    state,
  },
  aiMetricsStackProgram
);
