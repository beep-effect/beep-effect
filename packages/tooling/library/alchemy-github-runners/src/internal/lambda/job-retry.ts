/**
 * Job-retry Lambda entry (SQS job-retry queue).
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { handleJobRetry } from "../../JobRetry.program.ts";
import { ActionRequestMessage } from "../../RunnerMessages.models.ts";
import { PoolRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { defineLambda, fleetLive, lambdaHandler, SqsEvent } from "./Runtime.ts";

const decodeEvent = S.decodeUnknownEffect(SqsEvent);
const decodeMessage = S.decodeEffect(S.fromJsonString(ActionRequestMessage));

/**
 * Lambda handler: re-check each delayed job; a failing record is logged and
 * dropped, as upstream does.
 *
 * @internal
 */
export const definition = defineLambda({
  config: PoolRuntimeConfig,
  layer: fleetLive,
  run: Effect.fn("JobRetryLambda.run")(function* (config, raw) {
    const event = yield* decodeEvent(raw);
    yield* Effect.forEach(
      event.Records,
      (record) =>
        decodeMessage(record.body).pipe(
          Effect.flatMap((message) => handleJobRetry({ config, message })),
          Effect.catchCause((cause) => Effect.logWarning("job retry failed", cause))
        ),
      { discard: true }
    );
  }),
  fallback: (): void => undefined,
});

/**
 * The Lambda entry point.
 *
 * @internal
 */
export const handler = lambdaHandler(definition);
