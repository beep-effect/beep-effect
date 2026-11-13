/**
 * GitHub `workflow_job` webhook payloads and the webhook Lambda's request and
 * response shapes.
 *
 * Ported from `lambdas/functions/webhook` of github-aws-runners/terraform-aws-github-runner
 * v7.10.1 (MIT); see the package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyGithubRunnersId.create("WorkflowJob.models");

/**
 * Account type of a repository owner as GitHub reports it.
 *
 * **Example** (Check an owner type)
 *
 * ```ts
 * import { RepositoryOwnerType } from "@beep/alchemy-github-runners/WorkflowJob.models"
 *
 * console.log(RepositoryOwnerType.is.Organization("Organization")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RepositoryOwnerType = LiteralKit(["Organization", "User", "Bot", "Enterprise"]).pipe(
  $I.annoteSchema("RepositoryOwnerType", {
    description: "Account type of a repository owner as GitHub reports it.",
  })
);

/**
 * Runtime type for {@link RepositoryOwnerType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RepositoryOwnerType = typeof RepositoryOwnerType.Type;

/**
 * The parts of a `workflow_job` delivery the dispatcher reads.
 *
 * **Details**
 *
 * Unknown keys are ignored on decode, so the full GitHub payload decodes into
 * this subset. `installation` is absent for repository webhooks that are not
 * App deliveries; the dispatcher then sends installation id `0` and scale-up
 * resolves the installation itself.
 *
 * **Example** (Decode a queued job)
 *
 * ```ts
 * import { WorkflowJobEvent } from "@beep/alchemy-github-runners/WorkflowJob.models"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(WorkflowJobEvent)({
 *   action: "queued",
 *   workflow_job: { id: 7, run_id: 3, name: "check", labels: ["beep-ec2-heavy"] },
 *   repository: { name: "beep-effect", full_name: "beep-effect/beep-effect", owner: { login: "beep-effect", type: "Organization" } },
 *   installation: { id: 42 },
 * })
 * console.log(event.workflow_job.labels)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkflowJobEvent extends S.Opaque<WorkflowJobEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    action: S.String.annotateKey({ description: "Delivery action: queued, in_progress, completed or waiting." }),
    workflow_job: S.Struct({
      id: S.Int.annotateKey({ description: "Workflow job id." }),
      run_id: S.Int.annotateKey({ description: "Workflow run id." }),
      name: S.String.annotateKey({ description: "Job name." }),
      labels: S.Array(S.String).annotateKey({ description: "The job's `runs-on` labels." }),
    }),
    repository: S.Struct({
      name: S.String,
      full_name: S.String,
      owner: S.Struct({ login: S.String, type: RepositoryOwnerType }),
    }),
    installation: S.optionalKey(S.Struct({ id: S.Int })),
  }).pipe(
    $I.annoteSchema("WorkflowJobEvent", {
      description: "The parts of a workflow_job delivery the dispatcher reads.",
    })
  )
) {}

/**
 * An inbound webhook request: lower-cased headers and the raw body.
 *
 * **Details**
 *
 * The body stays a string because the HMAC signature covers the exact bytes
 * GitHub sent; it is parsed only after the signature verifies.
 *
 * **Example** (Build a request)
 *
 * ```ts
 * import { WebhookRequest } from "@beep/alchemy-github-runners/WorkflowJob.models"
 *
 * const request = WebhookRequest.make({ headers: { "x-github-event": "ping" }, body: "{}" })
 * console.log(request.headers["x-github-event"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebhookRequest extends S.Opaque<WebhookRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    headers: S.Record(S.String, S.String).annotateKey({ description: "Request headers with lower-cased names." }),
    body: S.String.annotateKey({ description: "Raw request body." }),
  }).pipe(
    $I.annoteSchema("WebhookRequest", {
      description: "An inbound webhook request: lower-cased headers and the raw body.",
    })
  )
) {}

/**
 * The webhook Lambda's HTTP answer.
 *
 * **Details**
 *
 * Status codes follow upstream: `201` dispatched or ignored action, `202` labels
 * not accepted or unsupported event, `401` bad signature, `403` repository not
 * in the allow list, `500` unexpected failure.
 *
 * **Example** (A rejected signature)
 *
 * ```ts
 * import { WebhookResponse } from "@beep/alchemy-github-runners/WorkflowJob.models"
 *
 * console.log(WebhookResponse.make({ statusCode: 401, body: "Unable to verify signature!" }).statusCode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WebhookResponse extends S.Opaque<WebhookResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    statusCode: S.Int.annotateKey({ description: "HTTP status code." }),
    body: S.String.pipe(S.withConstructorDefault(Effect.succeed(""))).annotateKey({
      description: "Plain-text response body.",
    }),
  }).pipe(
    $I.annoteSchema("WebhookResponse", {
      description: "The webhook Lambda's HTTP answer.",
    })
  )
) {}
