/**
 * The termination watcher Lambda's program: deregister a runner whose
 * instance is being reclaimed or stopped.
 *
 * **Details**
 *
 * Ported from `lambdas/functions/termination-watcher/src/{termination,termination-warning,deregister}.ts`
 * of github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice. Metrics are not ported.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Ec2Fleet } from "./Ec2Fleet.service.ts";
import { GitHubRunners } from "./GitHubApp.service.ts";
import { RunnerOwner } from "./GitHubRunners.models.ts";
import { installationTokenFor } from "./internal/Installation.ts";
import { MessageQueue } from "./MessageQueue.service.ts";
import { GitHubApiError } from "./RunnerFleet.errors.ts";
import { RunnerTag } from "./RunnerInstance.models.ts";
import { DeregisterRetryMessage } from "./RunnerMessages.models.ts";
import { RunnerType } from "./RunnerPool.models.ts";
import type { TerminationEvent } from "./Ec2Events.models.ts";
import type { TaggedInstance } from "./Ec2Fleet.models.ts";
import type { TerminationWatcherRuntimeConfig } from "./RunnerRuntime.models.ts";

const $I = $AlchemyGithubRunnersId.create("TerminationWatcher.program");

const encodeRetry = S.encodeEffect(S.fromJsonString(DeregisterRetryMessage));
const isRunnerType = S.is(RunnerType);

/**
 * Outcome of one deregistration attempt.
 *
 * **Example** (A busy runner)
 *
 * ```ts
 * import { DeregisterOutcome } from "@beep/alchemy-github-runners/TerminationWatcher.program"
 *
 * console.log(DeregisterOutcome.is["retry-queued"]("retry-queued")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeregisterOutcome = LiteralKit(["deregistered", "not-found", "retry-queued", "ignored"]).pipe(
  $I.annoteSchema("DeregisterOutcome", { description: "Outcome of one deregistration attempt." })
);

/**
 * Runtime type for {@link DeregisterOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeregisterOutcome = typeof DeregisterOutcome.Type;

/**
 * Whether an instance belongs to this watcher: its `ghr:environment` tag
 * starts with the configured prefix.
 *
 * **Example** (A heavy-pool instance)
 *
 * ```ts
 * import { matchesEnvironment } from "@beep/alchemy-github-runners/TerminationWatcher.program"
 * import { TaggedInstance } from "@beep/alchemy-github-runners/Ec2Fleet.models"
 *
 * const instance = TaggedInstance.make({ instanceId: "i-1", tags: { "ghr:environment": "beep-ci-heavy" } })
 * console.log(matchesEnvironment({ instance, prefix: "beep-ci" })) // true
 * ```
 *
 * @param input - The instance and the environment prefix.
 * @returns Whether the watcher should act on it.
 * @category use-cases
 * @since 0.0.0
 */
export const matchesEnvironment = (input: { readonly instance: TaggedInstance; readonly prefix: string }): boolean =>
  O.exists(O.fromUndefinedOr(input.instance.tags[RunnerTag.environment]), Str.startsWith(input.prefix));

/**
 * Finds the instance's runner on GitHub and deletes it.
 *
 * **Details**
 *
 * The runner is the one whose name contains the instance id. GitHub answers
 * 422 while the runner runs a job; that outcome is reported as `busy` so the
 * caller can schedule a retry. Any other failure propagates.
 *
 * **Example** (Wire the deregistration)
 *
 * ```ts
 * import { deregisterRunner } from "@beep/alchemy-github-runners/TerminationWatcher.program"
 *
 * console.log(typeof deregisterRunner)
 * ```
 *
 * @param input - The instance id and the runner's owner.
 * @returns `deregistered`, `not-found` or `busy`.
 * @category use-cases
 * @since 0.0.0
 */
export const deregisterRunner = Effect.fn("TerminationWatcher.deregisterRunner")(function* (input: {
  readonly instanceId: string;
  readonly owner: RunnerOwner;
}) {
  const github = yield* GitHubRunners;
  const token = yield* installationTokenFor(input.owner, 0);
  const runners = yield* github.listRunners(token, input.owner);
  const runner = A.findFirst(runners, (candidate) => Str.includes(input.instanceId)(candidate.name));
  if (O.isNone(runner)) {
    return "not-found" as const;
  }
  return yield* github.deleteRunner(token, input.owner, runner.value.id).pipe(
    Effect.as("deregistered" as const),
    Effect.catchIf(
      (error) => O.contains(error.status, 422),
      () => Effect.succeed("busy" as const)
    )
  );
});

const queueRetry = Effect.fn("TerminationWatcher.queueRetry")(function* (
  config: TerminationWatcherRuntimeConfig,
  message: DeregisterRetryMessage
) {
  const queue = yield* MessageQueue;
  const body = yield* encodeRetry(message).pipe(Effect.orDie);
  yield* queue.send({
    queueUrl: config.deregisterRetryQueueUrl,
    body,
    delaySeconds: O.some(config.retryDelaySeconds),
  });
});

/**
 * Handles a Spot interruption warning or an instance state change.
 *
 * **Details**
 *
 * Instances outside the watcher's environment prefix, or without a
 * `ghr:Owner` tag, are ignored. A busy runner is queued for a delayed retry.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleTerminationEvent } from "@beep/alchemy-github-runners/TerminationWatcher.program"
 *
 * console.log(typeof handleTerminationEvent)
 * ```
 *
 * @param input - Watcher config and the event.
 * @returns The outcome per described instance.
 * @category use-cases
 * @since 0.0.0
 */
export const handleTerminationEvent = Effect.fn("TerminationWatcher.handleEvent")(function* (input: {
  readonly config: TerminationWatcherRuntimeConfig;
  readonly event: TerminationEvent;
}) {
  const ec2 = yield* Ec2Fleet;
  const instanceId = input.event.detail["instance-id"];
  const instances = yield* ec2.describeInstances([instanceId]);
  return yield* Effect.forEach(
    instances,
    Effect.fnUntraced(function* (instance) {
      const owner = O.fromUndefinedOr(instance.tags[RunnerTag.owner]);
      const type = O.getOrElse(O.fromUndefinedOr(instance.tags[RunnerTag.type]), () => "Org");
      if (
        !matchesEnvironment({ instance, prefix: input.config.environmentPrefix }) ||
        O.isNone(owner) ||
        !isRunnerType(type)
      ) {
        return "ignored" as const;
      }
      const outcome = yield* deregisterRunner({
        instanceId: instance.instanceId,
        owner: RunnerOwner.make({ type, owner: owner.value }),
      });
      if (outcome !== "busy") {
        return outcome;
      }
      yield* queueRetry(
        input.config,
        DeregisterRetryMessage.make({
          instanceId: instance.instanceId,
          owner: owner.value,
          runnerType: type,
          runnerId: 0,
          retryCount: 0,
        })
      );
      return "retry-queued" as const;
    })
  );
});

/**
 * Handles one deregister-retry message.
 *
 * **Details**
 *
 * A still-busy runner is re-queued with the count incremented, at most
 * `maxDeregisterRetries` times. Past the cap the program fails with a
 * `GitHubApiError` (status 422): the Lambda reports the record as a batch item
 * failure, SQS redelivers it up to the queue's `maxReceiveCount` and the DLQ
 * takes it.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleDeregisterRetry } from "@beep/alchemy-github-runners/TerminationWatcher.program"
 *
 * console.log(typeof handleDeregisterRetry)
 * ```
 *
 * @param input - Watcher config and the retry message.
 * @returns The outcome.
 * @category use-cases
 * @since 0.0.0
 */
export const handleDeregisterRetry = Effect.fn("TerminationWatcher.handleRetry")(function* (input: {
  readonly config: TerminationWatcherRuntimeConfig;
  readonly message: DeregisterRetryMessage;
}) {
  const { message } = input;
  if (!isRunnerType(message.runnerType)) {
    return "ignored" as const;
  }
  const outcome = yield* deregisterRunner({
    instanceId: message.instanceId,
    owner: RunnerOwner.make({ type: message.runnerType, owner: message.owner }),
  });
  if (outcome !== "busy") {
    return outcome;
  }
  const retryCount = message.retryCount + 1;
  if (retryCount >= input.config.maxDeregisterRetries) {
    return yield* GitHubApiError.make({
      operation: "deregisterRetry",
      status: O.some(422),
      message: `Runner of ${message.instanceId} still busy after ${retryCount} retries`,
    });
  }
  yield* queueRetry(input.config, DeregisterRetryMessage.make({ ...message, retryCount }));
  return "retry-queued" as const;
});
