/**
 * Termination watcher Lambda entry: EventBridge events, plus SQS batches from
 * the deregister-retry queue.
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TerminationEvent } from "../../Ec2Events.models.ts";
import { DeregisterRetryMessage } from "../../RunnerMessages.models.ts";
import { TerminationWatcherRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { handleDeregisterRetry, handleTerminationEvent } from "../../TerminationWatcher.program.ts";
import {
  allMessageIds,
  batchItemFailures,
  defineLambda,
  fleetLive,
  lambdaHandler,
  processRecords,
  SqsEvent,
} from "./Runtime.ts";

const decodeSqs = S.decodeUnknownOption(SqsEvent);
const decodeEvent = S.decodeUnknownEffect(TerminationEvent);
const decodeRetry = S.decodeEffect(S.fromJsonString(DeregisterRetryMessage));

/**
 * Lambda handler: deregister runners of reclaimed or stopping instances. For a
 * deregister-retry batch it reports each record that failed as a batch item
 * failure, so SQS redelivers it and the retry queue's DLQ takes it after
 * `maxReceiveCount`; if the whole invocation fails, every record is reported.
 *
 * @internal
 */
export const definition = defineLambda({
  config: TerminationWatcherRuntimeConfig,
  layer: fleetLive,
  run: Effect.fn("TerminationWatcherLambda.run")(function* (config, raw) {
    const sqs = decodeSqs(raw);
    if (sqs._tag === "Some") {
      return yield* processRecords(sqs.value, (body) =>
        decodeRetry(body).pipe(Effect.flatMap((message) => handleDeregisterRetry({ config, message })))
      );
    }
    const event = yield* decodeEvent(raw);
    const outcomes = yield* handleTerminationEvent({ config, event });
    yield* Effect.logInfo("termination watcher", outcomes);
    return batchItemFailures([]);
  }),
  fallback: (raw) => batchItemFailures(allMessageIds(raw)),
});

/**
 * The Lambda entry point.
 *
 * @internal
 */
export const handler = lambdaHandler(definition);
