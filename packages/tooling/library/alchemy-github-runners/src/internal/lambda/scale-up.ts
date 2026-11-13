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
import { fleetLive, lambdaHandler, SqsEvent } from "./Runtime.ts";

const decodeEvent = S.decodeUnknownEffect(SqsEvent);
const decodeMessage = S.decodeOption(S.fromJsonString(ActionRequestMessage));

const failures = (ids: ReadonlyArray<string>) => ({
  batchItemFailures: A.map(ids, (itemIdentifier) => ({ itemIdentifier })),
});

/**
 * Lambda handler: launch runners for a build-queue batch; messages that must
 * come back are reported as batch item failures.
 *
 * @internal
 */
export const handler = lambdaHandler({
  config: PoolRuntimeConfig,
  layer: (config) => fleetLive({ app: config.app, ghesApiUrl: config.ghesApiUrl }),
  run: Effect.fn("ScaleUpLambda.run")(function* (config, raw) {
    const event = yield* decodeEvent(raw);
    const batch = A.getSomes(
      A.map(
        A.filter(
          event.Records,
          (record) => O.getOrElse(O.fromUndefinedOr(record.eventSource), () => "aws:sqs") === "aws:sqs"
        ),
        (record) =>
          O.map(decodeMessage(record.body), (message) =>
            QueuedActionRequest.make({ messageId: record.messageId, message })
          )
      )
    );
    const retry = yield* handleScaleUp({ config, batch });
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
