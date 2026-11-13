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
import { fleetLive, lambdaHandler, SqsEvent } from "./Runtime.ts";

const decodeSqs = S.decodeUnknownOption(SqsEvent);
const decodeEvent = S.decodeUnknownEffect(TerminationEvent);
const decodeRetry = S.decodeEffect(S.fromJsonString(DeregisterRetryMessage));

/**
 * Lambda handler: deregister runners of reclaimed or stopping instances. A
 * retry record that still fails is rethrown so SQS redelivers it and its DLQ
 * eventually takes it.
 *
 * @internal
 */
export const handler = lambdaHandler({
  config: TerminationWatcherRuntimeConfig,
  layer: (config) => fleetLive({ app: config.app, ghesApiUrl: config.ghesApiUrl }),
  run: Effect.fn("termination-watcher.run")(function* (config, raw) {
    const sqs = decodeSqs(raw);
    if (sqs._tag === "Some") {
      yield* Effect.forEach(
        sqs.value.Records,
        (record) =>
          decodeRetry(record.body).pipe(Effect.flatMap((message) => handleDeregisterRetry({ config, message }))),
        { discard: true }
      );
      return;
    }
    const event = yield* decodeEvent(raw);
    const outcomes = yield* handleTerminationEvent({ config, event });
    yield* Effect.logInfo("termination watcher", outcomes);
  }),
  fallback: (): void => undefined,
});
