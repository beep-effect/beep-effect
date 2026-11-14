/**
 * The webhook Lambda's program: verify, filter by repository and labels, and
 * enqueue one runner request on the matching pool's build queue.
 *
 * **Details**
 *
 * Ported from `lambdas/functions/webhook/src/{webhook,runners}` of
 * github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MessageQueue } from "./MessageQueue.service.ts";
import { WebhookRejected } from "./RunnerFleet.errors.ts";
import { ActionRequestMessage } from "./RunnerMessages.models.ts";
import { constantTimeEqual, hmacSha256Hex } from "./WebCrypto.ts";
import { WebhookResponse, WorkflowJobEvent } from "./WorkflowJob.models.ts";
import type { LabelMatchMode } from "./RunnerPool.models.ts";
import type { PoolMatcher, WebhookRuntimeConfig } from "./RunnerRuntime.models.ts";
import type { WebhookRequest } from "./WorkflowJob.models.ts";

const decodeWorkflowJobEvent = S.decodeUnknownEffect(S.fromJsonString(WorkflowJobEvent));
const encodeActionRequest = S.encodeEffect(S.fromJsonString(ActionRequestMessage));

/**
 * Verifies GitHub's `x-hub-signature-256` header over the raw body.
 *
 * **Example** (Reject a missing signature)
 *
 * ```ts
 * import { verifySignature } from "@beep/alchemy-github-runners/Webhook.program"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Redacted from "effect/Redacted"
 *
 * const program = verifySignature({ secret: Redacted.make("s"), body: "{}", signature: O.none() })
 * console.log(Effect.runSync(Effect.flip(program)).statusCode) // 401
 * ```
 *
 * @param input - The webhook secret, the raw body and the header value when present.
 * @returns Success when the signature matches; `WebhookRejected` with status 401 otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const verifySignature = Effect.fn("Webhook.verifySignature")(function* (input: {
  readonly secret: Redacted.Redacted<string>;
  readonly body: string;
  readonly signature: O.Option<string>;
}) {
  const rejected = WebhookRejected.make({ statusCode: 401, message: "Unable to verify signature!" });
  const signature = yield* Effect.fromOption(input.signature).pipe(Effect.mapError(() => rejected));
  const expected = `sha256=${yield* hmacSha256Hex(Redacted.value(input.secret), input.body)}`;
  if (!constantTimeEqual(expected, signature)) {
    return yield* rejected;
  }
});

/**
 * Whether a pool may take a job with these labels (case-insensitive).
 *
 * **Details**
 *
 * Upstream `canRunJob` semantics: `bidirectional` needs equal sets; `all`
 * needs every job label among the pool's; `any` needs one. For `all` and
 * `any`, a job without labels is accepted only by a pool that would reject
 * every label (upstream's inverted empty-label rule).
 *
 * **Example** (Bidirectional match)
 *
 * ```ts
 * import { canRunJob } from "@beep/alchemy-github-runners/Webhook.program"
 *
 * console.log(canRunJob({ jobLabels: ["Beep-EC2-Heavy"], poolLabels: ["beep-ec2-heavy"], mode: "bidirectional" })) // true
 * ```
 *
 * @param input - The job's labels, the pool's labels and the match mode.
 * @returns Whether the pool accepts the job.
 * @category use-cases
 * @since 0.0.0
 */
export const canRunJob = (input: {
  readonly jobLabels: ReadonlyArray<string>;
  readonly poolLabels: ReadonlyArray<string>;
  readonly mode: LabelMatchMode;
}): boolean => {
  const job = A.map(input.jobLabels, Str.toLowerCase);
  const pool = A.map(input.poolLabels, Str.toLowerCase);
  const inPool = (label: string) => A.contains(pool, label);
  if (input.mode === "bidirectional") {
    return A.every(job, inPool) && A.every(pool, (label) => A.contains(job, label));
  }
  const matched = input.mode === "all" ? A.every(job, inPool) : A.some(job, inPool);
  return A.isReadonlyArrayEmpty(job) ? !matched : matched;
};

const isStrict = (matcher: PoolMatcher) => matcher.labelMatch !== "any";

/**
 * The pool a job goes to: strict pools (bidirectional or all) are tried
 * before `any` pools, and the first match in declaration order wins.
 *
 * **Example** (Route a heavy job)
 *
 * ```ts
 * import { selectPool } from "@beep/alchemy-github-runners/Webhook.program"
 * import { PoolMatcher } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 *
 * const heavy = PoolMatcher.make({ pool: "heavy", queueUrl: "q1", labels: ["beep-ec2-heavy"], labelMatch: "bidirectional" })
 * console.log(selectPool({ pools: [heavy], jobLabels: ["beep-ec2-heavy"] }))
 * ```
 *
 * @param input - The fleet's pools in declaration order and the job's labels.
 * @returns The selected pool, if any accepts the job.
 * @category use-cases
 * @since 0.0.0
 */
export const selectPool = ({
  pools,
  jobLabels,
}: {
  readonly pools: ReadonlyArray<PoolMatcher>;
  readonly jobLabels: ReadonlyArray<string>;
}): O.Option<PoolMatcher> =>
  pipe(
    A.appendAll(
      A.filter(pools, isStrict),
      A.filter(pools, (pool) => !isStrict(pool))
    ),
    A.findFirst((pool) => canRunJob({ jobLabels, poolLabels: pool.labels, mode: pool.labelMatch }))
  );

const header = (request: WebhookRequest, name: string) => O.fromUndefinedOr(request.headers[name]);

const respond = (statusCode: number, body: string) => WebhookResponse.make({ statusCode, body });

/**
 * Handles one webhook delivery end to end.
 *
 * **Details**
 *
 * Order matches upstream: signature first (401), then event type (202 for
 * anything but `workflow_job`), payload decode (400), repository allow list
 * (403), action (201 and no dispatch unless `queued`), label match (202 when
 * no pool accepts), then one SQS message to the selected pool (201). Queue
 * failures surface as `AwsApiError`; the Lambda boundary answers 500.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleWebhook } from "@beep/alchemy-github-runners/Webhook.program"
 *
 * console.log(typeof handleWebhook)
 * ```
 *
 * @param input - Runtime config, webhook secret and the delivery.
 * @returns The HTTP response to send back.
 * @category use-cases
 * @since 0.0.0
 */
export const handleWebhook = Effect.fn("Webhook.handle")(function* (input: {
  readonly config: WebhookRuntimeConfig;
  readonly secret: Redacted.Redacted<string>;
  readonly request: WebhookRequest;
}) {
  const { config, request } = input;
  const outcome = yield* Effect.gen(function* () {
    yield* verifySignature({
      secret: input.secret,
      body: request.body,
      signature: header(request, "x-hub-signature-256"),
    });
    const eventType = O.getOrElse(header(request, "x-github-event"), () => "");
    if (eventType !== "workflow_job") {
      return respond(202, `Unsupported event type: ${eventType}`);
    }
    const event = yield* decodeWorkflowJobEvent(request.body).pipe(
      Effect.mapError(() => WebhookRejected.make({ statusCode: 400, message: "Malformed workflow_job payload" }))
    );
    const repository = event.repository.full_name;
    if (A.isReadonlyArrayNonEmpty(config.repositoryAllowList) && !A.contains(config.repositoryAllowList, repository)) {
      return yield* WebhookRejected.make({
        statusCode: 403,
        message: `Received event from unauthorized repository ${repository}`,
      });
    }
    if (event.action !== "queued") {
      return respond(201, "Workflow job not queued, not dispatching to queue.");
    }
    const labels = event.workflow_job.labels;
    const pool = selectPool({ pools: config.pools, jobLabels: labels });
    if (O.isNone(pool)) {
      return respond(
        202,
        `Received event contains runner labels '${A.join(labels, ",")}' from '${repository}' that are not accepted.`
      );
    }
    const queue = yield* MessageQueue;
    const body = yield* encodeActionRequest(
      ActionRequestMessage.make({
        id: event.workflow_job.id,
        eventType,
        repositoryName: event.repository.name,
        repositoryOwner: event.repository.owner.login,
        installationId: O.getOrElse(
          O.map(O.fromUndefinedOr(event.installation), ({ id }) => id),
          () => 0
        ),
        queueId: pool.value.queueUrl,
        repoOwnerType: event.repository.owner.type,
        labels,
      })
    ).pipe(Effect.orDie);
    yield* queue.send({ queueUrl: pool.value.queueUrl, body, delaySeconds: O.none() });
    return respond(201, `Successfully queued job for ${repository} to the queue(s) ${pool.value.queueUrl}`);
  }).pipe(
    Effect.catchTag("WebhookRejected", (rejected) => Effect.succeed(respond(rejected.statusCode, rejected.message)))
  );
  return outcome;
});
