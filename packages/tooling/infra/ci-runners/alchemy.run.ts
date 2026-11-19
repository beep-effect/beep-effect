import * as AWS from "@alchemy.run/aws";
import * as Alchemy from "alchemy";
import { program } from "./src/CiRunners.ts";
import { providers } from "./src/Providers.ts";

/**
 * The shared Alchemy state store (goals/infra-alchemy-rebuild, D6 and D17):
 * one account-regional S3 bucket, `alchemy-state-<accountId>-<region>-an`,
 * SSE-KMS with the AWS-managed S3 key, bucket keys on, customer-provided keys
 * blocked. Account, region and credentials come from the process
 * environment: exported from aws-vault on a workstation, set by the GitHub
 * OIDC deploy role in CI. Runbook: docs/runbooks/alchemy-infra.md.
 */
const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The self-hosted CI runner fleet, built beside the Pulumi
 * `beep-ci-runners/production` fleet under new names (D12). `prod` runs only
 * in CI (`CI=true`); every stage refuses another account and any name that
 * overlaps the live fleet.
 */
export default Alchemy.Stack("CiRunners", { providers, state }, program);
