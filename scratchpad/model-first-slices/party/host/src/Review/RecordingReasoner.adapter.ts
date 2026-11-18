import { type Assessed, type AssessRequest, Reasoner, type ReasonerUnavailable } from "@proto/party-model/Review/Reasoner.external";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { ReasonerTape } from "./ReasonerTape.ts";

/**
 * Record every call another reasoner answers, as a replayable fixture. A
 * call whose idempotency key is already on the tape returns the recorded
 * answer and calls nothing, so a retried call returns the first answer.
 *
 * **Example** (Record the fixture reasoner)
 * ```ts
 * import { assessWithFixture } from "@proto/party-host/Review/FixtureReasoner.adapter";
 * import { recordingReasoner } from "@proto/party-host/Review/RecordingReasoner.adapter";
 *
 * const recording = recordingReasoner(assessWithFixture);
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const recordingReasoner = (inner: (request: AssessRequest) => Effect.Effect<Assessed, ReasonerUnavailable>) =>
  Reasoner.toLayer(
    Effect.map(Effect.service(ReasonerTape), (tape) => ({
      assess: (request: AssessRequest) =>
        Effect.flatMap(tape.find(request.promptVersion, request.idempotencyKey), (recorded) =>
          O.match(recorded, {
            onSome: (entry) => Effect.succeed(entry.result),
            onNone: () =>
              inner(request).pipe(Effect.tap((result) => tape.record({ request, result }))),
          }),
        ),
    })),
  );
