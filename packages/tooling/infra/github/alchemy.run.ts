import * as AWS from "@alchemy.run/aws";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { productionConfig, productionStage } from "./src/Production.ts";
import { declareStack } from "./src/Stack.ts";

/**
 * The shared Alchemy state store (goals/infra-alchemy-rebuild, D6 and D17):
 * one account-regional S3 bucket, `alchemy-state-<accountId>-<region>-an`,
 * SSE-KMS with the AWS-managed S3 key, bucket keys on, customer-provided keys
 * blocked. Account, region and credentials come from the process
 * environment: exported from aws-vault on a workstation, set by the GitHub
 * OIDC state role in CI. Runbook: docs/runbooks/alchemy-infra.md.
 */
export const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The stack's program, exported so tests deploy it into in-memory state.
 *
 * Every stage targets the live repository with the same configuration: the
 * repository, its ruleset and its labels are singletons, so nothing here may
 * derive a name from the stage. `prod` deploys only from CI. Any other stage
 * is a plan-only preview of `prod` and refuses to start unless
 * `INFRA_GITHUB_LIVE_PREVIEW=plan-only` acknowledges that it reads the live
 * repository; every resource is retained, so destroying a preview stage
 * deletes nothing on GitHub.
 */
export const program = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  if (stack.stage === productionStage) {
    yield* Config.Literal("true", "CI");
  } else {
    yield* Config.Literal("plan-only", "INFRA_GITHUB_LIVE_PREVIEW");
  }
  return yield* declareStack(productionConfig);
});

export default Alchemy.Stack(
  "InfraGithub",
  {
    providers: GitHub.providers(),
    state,
  },
  program
);
