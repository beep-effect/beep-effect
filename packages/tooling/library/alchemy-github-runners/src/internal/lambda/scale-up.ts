/**
 * Scale-up Lambda entry (SQS build queue, partial batch responses).
 *
 * @internal
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ActionRequestMessage, QueuedActionRequest } from "../../RunnerMessages.models.ts";
import { PoolRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { handleScaleUp } from "../../ScaleUp.program.ts";
import { defineLambda, fleetLive, lambdaHandler, SqsEvent } from "./Runtime.ts";

const decodeEvent = S.decodeUnknownEffect(SqsEvent);
const decodeMessage = S.decodeOption(S.fromJsonString(ActionRequestMessage));

const failures = (ids: ReadonlyArray<string>) => ({
  batchItemFailures: A.map(ids, (itemIdentifier) => ({ itemIdentifier })),
});

// A body that does not decode is acknowledged: no resend can fix it. The line names the message, never its body.
const decodeRecord = (record: SqsEvent["Records"][number]) =>
  O.match(decodeMessage(record.body), {
    onNone: () =>
      Effect.logWarning("scale-up: a message that does not decode is dropped").pipe(
        Effect.annotateLogs({ messageId: record.messageId }),
        Effect.as(O.none<QueuedActionRequest>())
      ),
    onSome: (message) => Effect.succeedSome(QueuedActionRequest.make({ messageId: record.messageId, message })),
  });

/**
 * Lambda handler: launch runners for a build-queue batch; messages that must
 * come back are reported as batch item failures.
 *
 * @internal
 */
export const definition = defineLambda({
  config: PoolRuntimeConfig,
  layer: fleetLive,
  run: Effect.fn("ScaleUpLambda.run")(function* (config, raw) {
    const event = yield* decodeEvent(raw);
    const decoded = yield* Effect.forEach(
      A.filter(
        event.Records,
        (record) => O.getOrElse(O.fromUndefinedOr(record.eventSource), () => "aws:sqs") === "aws:sqs"
      ),
      decodeRecord,
      { concurrency: 1 }
    );
    const retry = yield* handleScaleUp({ config, batch: A.getSomes(decoded) });
    return failures(retry);
  }),
  fallback: (raw) =>
    failures(
      O.match(S.decodeUnknownOption(SqsEvent)(raw), {
        onNone: () => [],
        onSome: (event) => A.map(event.Records, (record) => record.messageId),
      })
    ),
});

/**
 * The Lambda entry point.
 *
 * @internal
 */
export const handler = lambdaHandler(definition);
