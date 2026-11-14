/**
 * Pool configs and messages shared by the program tests.
 */

import {
  ActionRequestMessage,
  appParameterNames,
  JobRetryPolicy,
  LaunchTemplateRef,
  PoolRuntimeConfig,
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
  jobRetry: O.some(JobRetryPolicy.make({ maxAttempts: 2, delaySeconds: 120, delayBackoff: 2 })),
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
    app: appParameterNames("/beep-ci"),
  });

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
