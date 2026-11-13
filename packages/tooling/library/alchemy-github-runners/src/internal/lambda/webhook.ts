/**
 * Webhook Lambda entry (function URL, payload 2.0).
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { RuntimeConfigError } from "../../RunnerFleet.errors.ts";
import { WebhookRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { SsmStore } from "../../SsmStore.service.ts";
import { handleWebhook } from "../../Webhook.program.ts";
import { WebhookRequest } from "../../WorkflowJob.models.ts";
import { awsLive, FunctionUrlEvent, lambdaHandler } from "./Runtime.ts";

const decodeEvent = S.decodeUnknownEffect(FunctionUrlEvent);

/**
 * Lambda handler: verify, filter and enqueue one `workflow_job` delivery.
 *
 * @internal
 */
export const handler = lambdaHandler({
  config: WebhookRuntimeConfig,
  layer: () => Layer.mergeAll(awsLive, Layer.empty),
  run: Effect.fn("WebhookLambda.run")(function* (config, raw) {
    const ssm = yield* SsmStore;
    const event = yield* decodeEvent(raw);
    const secret = yield* ssm.get(config.webhookSecretParameterName).pipe(
      Effect.flatMap(Effect.fromOption),
      Effect.mapError(() => RuntimeConfigError.make({ message: "webhook secret is unavailable" }))
    );
    const rawBody = event.body ?? "";
    const body =
      event.isBase64Encoded === true ? Result.getOrElse(Base64.decodeString(rawBody), () => rawBody) : rawBody;
    const headers = R.fromEntries(
      R.collect(
        event.headers ?? {},
        (name, value) => [Str.toLowerCase(name), O.getOrElse(O.fromUndefinedOr(value), () => "")] as const
      )
    );
    const response = yield* handleWebhook({ config, secret, request: WebhookRequest.make({ headers, body }) });
    return { statusCode: response.statusCode, body: response.body };
  }),
  fallback: () => ({ statusCode: 500, body: "Check the Lambda logs for the error details." }),
});
