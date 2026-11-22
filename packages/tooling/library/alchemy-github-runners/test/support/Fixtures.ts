/**
 * Pool configs and messages shared by the program tests.
 */

import {
  ActionRequestMessage,
  appParameterNames,
  JobRetryPolicy,
  LaunchTemplateRef,
  PoolRuntimeConfig,
  poolTokenPath,
  QueuedActionRequest,
  RunnerPool,
} from "@beep/alchemy-github-runners";
import * as O from "effect/Option";

export const heavyPool = RunnerPool.make({
  name: "heavy",
  instanceTypes: ["r7a.2xlarge", "m7i.4xlarge"],
  maximumCount: 2,
  labels: ["beep-ec2-heavy"],
  runnerGroup: "beep-ec2-heavy",
  runnerNamePrefix: "beep-ci-",
  jobRetry: JobRetryPolicy.makeOption({ maxAttempts: 2, delaySeconds: 120, delayBackoff: 2 }),
});

export const poolConfig = (pool: RunnerPool = heavyPool) =>
  PoolRuntimeConfig.make({
    pool,
    environment: `beep-ci-${pool.name}`,
    runnerType: "Org",
    subnetIds: ["subnet-a", "subnet-b", "subnet-c"],
    launchTemplate: LaunchTemplateRef.make({ launchTemplateId: "lt-heavy", version: "$Default" }),
    tokenPath: `/beep-ci/${pool.name}/tokens`,
    configPath: `/beep-ci/${pool.name}/config`,
    buildQueueUrl: `https://sqs.us-east-1.amazonaws.com/1/${pool.name}-build`,
    jobRetryQueueUrl: O.some(`https://sqs.us-east-1.amazonaws.com/1/${pool.name}-job-retry`),
    buildDlqUrl: O.some(`https://sqs.us-east-1.amazonaws.com/1/${pool.name}-build-dlq`),
    app: appParameterNames("/beep-ci"),
  });

/** The new fleet's production pools: `ghr:environment` `beep-fleet-prod-<pool>`, SSM root `/beep-fleet/prod`. */
export const liveHeavyPool = RunnerPool.make({ ...heavyPool, runnerNamePrefix: "beep-fleet-heavy-" });

export const liveOverflowPool = RunnerPool.make({
  ...heavyPool,
  name: "overflow",
  instanceTypes: ["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge"],
  maximumCount: 48,
  labels: ["beep-shard-overflow"],
  runnerGroup: "beep-shard-overflow",
  runnerNamePrefix: "beep-fleet-ovf-",
});

export const liveSsmRoot = "/beep-fleet/prod";

export const livePoolConfig = (pool: RunnerPool) =>
  PoolRuntimeConfig.make({
    ...poolConfig(pool),
    environment: `beep-fleet-prod-${pool.name}`,
    tokenPath: poolTokenPath(liveSsmRoot, pool.name),
    configPath: `${liveSsmRoot}/${pool.name}/config`,
    app: appParameterNames(liveSsmRoot),
  });

/** The pool environments the new fleet's termination watcher and sweep are given in production. */
export const liveEnvironments = ["beep-fleet-prod-heavy", "beep-fleet-prod-overflow"] as const;

/**
 * The tags the live terraform-module fleet (github-aws-runners/terraform-aws-github-runner v7.10.1, driven by
 * `infra/src/CiFleetController.ts`) writes on a runner instance of the pool with module `prefix` `beep-ci` (heavy)
 * or `beep-ovf` (overflow): the module's `Name`, `ghr:environment`, `ghr:runner_name_prefix` and
 * `ghr:ssm_config_path` (default `ssm_paths`, `use_prefix`), the scale-up Lambda's `ghr:Application`,
 * `ghr:created_by`, `ghr:Type` and `ghr:Owner`, the controller's `tags` and its `runner_ec2_tags`.
 */
export const oldFleetTags = (prefix: string): Readonly<Record<string, string>> => ({
  Name: `${prefix}-action-runner`,
  App: "ci-runners",
  ManagedBy: "pulumi-terraform-module",
  Project: "beep-ci",
  "ghr:environment": prefix,
  "ghr:runner_name_prefix": `${prefix}-`,
  "ghr:ssm_config_path": `/github-action-runners/${prefix}/runners/config`,
  "ghr:Application": "github-action-runner",
  "ghr:created_by": "scale-up-lambda",
  "ghr:Type": "Org",
  "ghr:Owner": "beep-effect",
  "beep-ci": "runner",
});

/** The old fleet's module prefixes: `beep-ci` (heavy) and `beep-ovf` (overflow). */
export const oldFleetPrefixes = ["beep-ci", "beep-ovf"] as const;

/** A live old-fleet runner's GitHub name: the pool's `runner_name_prefix` (`<prefix>-`) and the instance id. */
export const oldFleetRunnerName = (prefix: string) => (instanceId: string) => `${prefix}-${instanceId}`;

export const message = ({ id, ...overrides }: { readonly id: number } & Partial<ActionRequestMessage>) =>
  ActionRequestMessage.make({
    id,
    eventType: "workflow_job",
    repositoryName: "beep-effect",
    repositoryOwner: "beep-effect",
    installationId: 42,
    queueId: "https://sqs.us-east-1.amazonaws.com/1/heavy-build",
    repoOwnerType: "Organization",
    labels: ["beep-ec2-heavy"],
    ...overrides,
  });

export const queued = (input: { readonly id: number } & Partial<ActionRequestMessage>) =>
  QueuedActionRequest.make({ messageId: `m-${input.id}`, message: message(input) });
