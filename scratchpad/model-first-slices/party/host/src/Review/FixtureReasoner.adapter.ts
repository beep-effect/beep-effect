import { type AssessRequest, Reasoner } from "@proto/party-model/Review/Reasoner.external";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";

/**
 * A deterministic stand-in for a model: `accept` when the evidence names at
 * least two distinct sources, `reject` otherwise; usage grows with the
 * evidence and never exceeds the call's allowance. Deterministic, so a
 * retried call returns the same answer.
 *
 * **Example** (Assess directly)
 * ```ts
 * import { assessWithFixture } from "@proto/party-host/Review/FixtureReasoner.adapter";
 *
 * const assess = assessWithFixture;
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const assessWithFixture = (request: AssessRequest) => {
  const sources = HashSet.size(HashSet.fromIterable(A.map(request.signals, (signal) => signal.source)));
  return Effect.succeed({
    assessment:
      sources >= 2
        ? { disposition: "accept" as const, rationale: `${sources} independent sources agree` }
        : { disposition: "reject" as const, rationale: "a single source is not corroboration" },
    usage: { units: Math.min(request.maxAllowance, 5 + 3 * request.signals.length) },
    receipt: { idempotencyKey: request.idempotencyKey, promptVersion: request.promptVersion, model: "fixture-reasoner" },
  });
};

/**
 * The fixture reasoner as the port's adapter. Calls through it are checked
 * against the port's schemas like any adapter's.
 *
 * @category adapters
 * @since 0.0.0
 */
export const FixtureReasoner = Reasoner.toLayer(Effect.succeed({ assess: assessWithFixture }));
