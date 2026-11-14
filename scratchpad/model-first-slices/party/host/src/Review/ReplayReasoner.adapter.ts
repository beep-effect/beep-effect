import { Reasoner, ReasonerUnavailable } from "@proto/party-model/Review/Reasoner.external";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { ReasonerTape } from "./ReasonerTape.ts";

/**
 * Serve recorded calls back, by prompt version and idempotency key. A call
 * that was never recorded fails with the port's declared error, so a
 * changed prompt or a new call cannot pass a replayed evaluation silently.
 *
 * @category adapters
 * @since 0.0.0
 */
export const ReplayReasoner = Reasoner.toLayer(
  Effect.map(Effect.service(ReasonerTape), (tape) => ({
    assess: (request) =>
      Effect.flatMap(tape.find(request.promptVersion, request.idempotencyKey), (recorded) =>
        O.match(recorded, {
          onSome: (entry) => Effect.succeed(entry.result),
          onNone: () =>
            Effect.fail(
              ReasonerUnavailable.make({ reason: `not recorded: ${request.promptVersion}/${request.idempotencyKey}` }),
            ),
        }),
      ),
  })),
);
