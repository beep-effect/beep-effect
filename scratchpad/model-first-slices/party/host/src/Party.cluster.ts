import { AgentApi } from "@proto/party-model/AgentApi.api";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { PartyDirectoryGeneration } from "@proto/party-model/Directory/PartyDirectory.handler";
import { switchIfBehind } from "@proto/party-model/Directory/RebuildDirectory";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import { PgPartyDirectoryStore } from "./Directory/PgPartyDirectoryStore.adapter.ts";
import { PartyFactsFeedLive } from "./Facts/PartyFactsFeed.adapter.ts";
import { hostParty } from "./Host.ts";
import { reviewerFetchAt } from "./ReviewerApi.http.ts";

/**
 * The end of a directory rebuild, on every runner for as long as it lives:
 * while queries read a generation older than the one this build writes,
 * wait for the new one to catch up, then switch. A deploy that bumps no
 * generation finds nothing to do and stops after its first look.
 *
 * **Details**
 *
 * A look that fails is reported and repeated: the new generation still
 * behind, or no database yet (the deploy builds every runner Layer once
 * without one).
 */
const DirectorySwitch = switchIfBehind(PartyDirectoryGeneration).pipe(
  Effect.as(true),
  Effect.catchCause((cause) =>
    Effect.as(Effect.logInfo(`party directory: generation ${PartyDirectoryGeneration} is not the active one yet`, cause), false),
  ),
  Effect.repeat({ schedule: Schedule.spaced("2 seconds"), until: (switched) => switched }),
  Effect.forkScoped,
  Layer.effectDiscard,
);

/**
 * The Party context on a cluster (D13, D39): its model hosted once on the
 * pool's platform with the directory in Postgres; the fact feed the runs
 * inbox reads; the switch that ends a directory rebuild; and its Apis for
 * the front, the reviewer's also as plain
 * HTTP JSON under `reviewer-http`.
 *
 * @category cluster
 * @since 0.0.0
 */
export const PartyCluster = <ROut, E, R>(platform: Layer.Layer<ROut, E, R>) => {
  const hosted = hostParty(platform, PgPartyDirectoryStore);
  return {
    parts: {
      PartyFactsFeed: PartyFactsFeedLive.pipe(Layer.provide(hosted)),
      DirectorySwitch: DirectorySwitch.pipe(Layer.provide(Layer.merge(hosted, PgPartyDirectoryStore))),
    },
    // Built into the caller's scope, not with `Effect.provide`: the Postgres directory connects
    // lazily, inside a query, and needs the hosted Layer's scope still open then.
    apis: Effect.gen(function* () {
      const context = yield* Layer.build(hosted);
      return yield* Effect.gen(function* () {
        return {
          reviewer: (yield* ReviewerApi).fetch,
          intake: (yield* IntakeApi).fetch,
          agent: (yield* AgentApi).fetch,
          "reviewer-http": yield* reviewerFetchAt("/reviewer-http"),
        };
      }).pipe(Effect.provideContext(context));
    }),
  };
};
