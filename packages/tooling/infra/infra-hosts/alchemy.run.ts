import * as AWS from "@alchemy.run/aws";
import * as Docker from "@alchemy.run/docker";
import { aiMetricsStackName, aiMetricsStackProgram } from "@beep/infra-hosts/AiMetricsStack";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import * as Layer from "effect/Layer";

/**
 * The shared Alchemy state store (goals/infra-alchemy-rebuild, D6 and D17):
 * one account-regional S3 bucket, `alchemy-state-<accountId>-<region>-an`,
 * SSE-KMS with the AWS-managed S3 key, bucket keys on, customer-provided keys
 * blocked. Account, region and credentials come from the process
 * environment: exported from aws-vault on a workstation, set by the GitHub
 * OIDC state role in CI. Runbook: docs/runbooks/alchemy-infra.md.
 */
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
