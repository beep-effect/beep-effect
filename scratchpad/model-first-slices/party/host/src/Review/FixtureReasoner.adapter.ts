import { Reasoner } from "@proto/party/Review/Reasoner.external";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";

/**
 * A deterministic stand-in for a model driver: it proposes `accept` when the
 * evidence names at least two distinct sources, `reject` otherwise. Calls
 * through it are checked against the port's schemas like any adapter's.
 *
 * **Example** (Provide the fixture reasoner)
 * ```ts
 * import { FixtureReasoner } from "@proto/party-host/Review/FixtureReasoner.adapter";
 *
 * const layer = FixtureReasoner;
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const FixtureReasoner = Reasoner.toLayer(
  Effect.succeed({
    assess: ({ signals }) => {
      const sources = HashSet.size(HashSet.fromIterable(A.map(signals, (signal) => signal.source)));
      return Effect.succeed(
        sources >= 2
          ? { disposition: "accept" as const, rationale: `${sources} independent sources agree` }
          : { disposition: "reject" as const, rationale: "a single source is not corroboration" },
      );
    },
  }),
);
