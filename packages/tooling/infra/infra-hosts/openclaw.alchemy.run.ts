import * as AWS from "@alchemy.run/aws";
import { openClawStackName, openClawStackProgram } from "@beep/infra-hosts/OpenClawStack";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";

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
 * The OpenClaw generation applicator for the operator workstation. `prod`
 * runs from that workstation only, refuses CI (D21), and needs an armed sudo
 * ticket for its privileged steps. Configuration: the JSON file named by
 * `BEEP_OPENCLAW_HOST_CONFIG`. Deploy with
 * `bunx alchemy deploy openclaw.alchemy.run.ts --stage prod`.
 * Runbook: docs/runbooks/alchemy-infra.md.
 */
export default Alchemy.Stack(
  openClawStackName,
  {
    providers: Command.providers(),
    state,
  },
  openClawStackProgram
);
