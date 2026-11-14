/**
 * Queue messages between the webhook, scale-up, job-retry and termination
 * watcher Lambdas.
 *
 * **Details**
 *
 * Ported from github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); the
 * wire shape is upstream's, see the package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { RepositoryOwnerType } from "./WorkflowJob.models.ts";

const $I = $AlchemyGithubRunnersId.create("RunnerMessages.models");

/**
 * A request for one runner, sent by the webhook to a pool's build queue.
 *
 * **Details**
 *
 * Field names are upstream's `ActionRequestMessage`, so a message produced by
 * either implementation decodes in the other. `retryCounter` is present only
 * on messages the job-retry path re-published. `installationId` is `0` when
 * the delivery carried no installation.
 *
 * **Example** (A queued job for the heavy pool)
 *
 * ```ts
 * import { ActionRequestMessage } from "@beep/alchemy-github-runners/RunnerMessages.models"
 *
 * const message = ActionRequestMessage.make({
 *   id: 7,
 *   eventType: "workflow_job",
 *   repositoryName: "beep-effect",
 *   repositoryOwner: "beep-effect",
 *   installationId: 42,
 *   queueId: "https://sqs.us-east-1.amazonaws.com/123456789012/beep-ci-heavy-build",
 *   repoOwnerType: "Organization",
 *   labels: ["beep-ec2-heavy"],
 * })
 * console.log(message.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionRequestMessage extends S.Opaque<ActionRequestMessage, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int.annotateKey({ description: "Workflow job id." }),
    eventType: S.String.annotateKey({ description: "GitHub event name; scale-up supports workflow_job only." }),
    repositoryName: S.String,
    repositoryOwner: S.String,
    installationId: S.Int.annotateKey({ description: "App installation id, or 0 when unknown." }),
    queueId: S.String.annotateKey({ description: "URL of the build queue the message was sent to." }),
    repoOwnerType: RepositoryOwnerType,
    labels: S.Array(S.String).pipe(S.optionalKey, S.annotateKey({ description: "The job's labels as dispatched." })),
    retryCounter: S.Int.pipe(S.optionalKey, S.annotateKey({ description: "Job-retry attempts already made." })),
  }).pipe(
    $I.annoteSchema("ActionRequestMessage", {
      description: "A request for one runner, sent by the webhook to a pool's build queue.",
    })
  )
) {}

/**
 * An {@link ActionRequestMessage} paired with the SQS message id it arrived
 * under, which scale-up reports back as a batch item failure.
 *
 * **Example** (Pair a message with its SQS id)
 *
 * ```ts
 * import { ActionRequestMessage, QueuedActionRequest } from "@beep/alchemy-github-runners/RunnerMessages.models"
 *
 * const queued = QueuedActionRequest.make({
 *   messageId: "m-1",
 *   message: ActionRequestMessage.make({
 *     id: 7, eventType: "workflow_job", repositoryName: "r", repositoryOwner: "o",
 *     installationId: 0, queueId: "q", repoOwnerType: "Organization",
 *   }),
 * })
 * console.log(queued.messageId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QueuedActionRequest extends S.Opaque<QueuedActionRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    messageId: S.String.annotateKey({ description: "SQS message id." }),
    message: ActionRequestMessage,
  }).pipe(
    $I.annoteSchema("QueuedActionRequest", {
      description: "An action request paired with the SQS message id it arrived under.",
    })
  )
) {}

/**
 * A deregistration the termination watcher could not finish because the
 * runner was busy, re-queued with a delay.
 *
 * **Example** (Queue a retry)
 *
 * ```ts
 * import { DeregisterRetryMessage } from "@beep/alchemy-github-runners/RunnerMessages.models"
 *
 * const retry = DeregisterRetryMessage.make({
 *   instanceId: "i-0123456789abcdef0", owner: "beep-effect", runnerType: "Org", runnerId: 0, retryCount: 0,
 * })
 * console.log(retry.retryCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeregisterRetryMessage extends S.Opaque<DeregisterRetryMessage, { readonly brand: unique symbol }>()(
  S.Struct({
    instanceId: S.String,
    owner: S.String.annotateKey({ description: "Org name, or owner/repo for repository runners." }),
    runnerType: S.String.annotateKey({ description: "Org or Repo." }),
    runnerId: S.Int.annotateKey({ description: "GitHub runner id when known, else 0." }),
    retryCount: S.Int,
  }).pipe(
    $I.annoteSchema("DeregisterRetryMessage", {
      description: "A busy-runner deregistration re-queued with a delay.",
    })
  )
) {}
