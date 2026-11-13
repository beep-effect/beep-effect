/**
 * The job-retry Lambda's program: a delayed re-check that puts a job back on
 * the build queue while GitHub still reports it queued.
 *
 * **Details**
 *
 * Ported from `lambdas/functions/control-plane/src/scale-runners/job-retry.ts`
 * of github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { GitHubRunners } from "./GitHubApp.service.ts";
import { installationTokenFor, ownerOf } from "./internal/Installation.ts";
import { MessageQueue } from "./MessageQueue.service.ts";
import { ActionRequestMessage } from "./RunnerMessages.models.ts";
import type { PoolRuntimeConfig } from "./RunnerRuntime.models.ts";

const encodeActionRequest = S.encodeEffect(S.fromJsonString(ActionRequestMessage));

/**
 * Re-checks one retry message.
 *
 * **Details**
 *
 * When the job is still queued the message, retry counter included, goes
 * back to the pool's build queue so scale-up tries again; otherwise nothing
 * happens. The retry counter is what bounds the loop: scale-up stops
 * publishing once it reaches the policy's `maxAttempts`.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleJobRetry } from "@beep/alchemy-github-runners/JobRetry.program"
 *
 * console.log(typeof handleJobRetry)
 * ```
 *
 * @param input - Pool runtime config and the retry message.
 * @returns Whether the job was re-queued.
 * @category use-cases
 * @since 0.0.0
 */
export const handleJobRetry = Effect.fn("JobRetry.handle")(function* (input: {
  readonly config: PoolRuntimeConfig;
  readonly message: ActionRequestMessage;
}) {
  const { config, message } = input;
  const github = yield* GitHubRunners;
  const queue = yield* MessageQueue;
  const token = yield* installationTokenFor(
    ownerOf({ runnerType: config.runnerType, message }),
    message.installationId
  );
  const queued = yield* github.isJobQueued(token, {
    owner: message.repositoryOwner,
    repo: message.repositoryName,
    jobId: message.id,
  });
  if (!queued) {
    return false;
  }
  const body = yield* encodeActionRequest(message).pipe(Effect.orDie);
  yield* queue.send({ queueUrl: config.buildQueueUrl, body, delaySeconds: O.none() });
  return true;
});
