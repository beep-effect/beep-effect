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
import {
  allMessageIds,
  batchItemFailures,
  defineLambda,
  fleetLive,
  lambdaHandler,
  processRecords,
  SqsEvent,
} from "./Runtime.ts";

const decodeEvent = S.decodeUnknownEffect(SqsEvent);
const decodeMessage = S.decodeEffect(S.fromJsonString(ActionRequestMessage));

/**
 * Lambda handler: re-check each delayed job. A record that fails (malformed, or a
 * GitHub or SQS error) is reported as a batch item failure so SQS redelivers it
 * and the job-retry queue's DLQ takes it after `maxReceiveCount`.
 *
 * @internal
 */
export const definition = defineLambda({
  config: PoolRuntimeConfig,
  layer: fleetLive,
  run: Effect.fn("JobRetryLambda.run")(function* (config, raw) {
    const event = yield* decodeEvent(raw);
    return yield* processRecords(event, (body) =>
      decodeMessage(body).pipe(Effect.flatMap((message) => handleJobRetry({ config, message })))
    );
  }),
  fallback: (raw) => batchItemFailures(allMessageIds(raw)),
});

/**
 * The Lambda entry point.
 *
 * @internal
 */
export const handler = lambdaHandler(definition);
