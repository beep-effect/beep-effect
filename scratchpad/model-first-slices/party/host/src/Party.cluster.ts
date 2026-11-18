import { AgentApi } from "@proto/party-model/AgentApi.api";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import { ReviewerApi } from "@proto/party-model/ReviewerApi.api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PgPartyDirectoryStore } from "./Directory/PgPartyDirectoryStore.adapter.ts";
import { PartyFactsFeedLive } from "./Facts/PartyFactsFeed.adapter.ts";
import { hostParty } from "./Host.ts";

/**
 * The Party context on a cluster (D13, D39): its model hosted once on the
 * pool's platform with the directory in Postgres; the fact feed the runs
 * inbox reads; and its Apis for the front.
 *
 * @category cluster
 * @since 0.0.0
 */
export const PartyCluster = <ROut, E, R>(platform: Layer.Layer<ROut, E, R>) => {
  const hosted = hostParty(platform, PgPartyDirectoryStore);
  return {
    parts: { PartyFactsFeed: PartyFactsFeedLive.pipe(Layer.provide(hosted)) },
    // Built into the caller's scope, not with `Effect.provide`: the Postgres directory connects
    // lazily, inside a query, and needs the hosted Layer's scope still open then.
    apis: Effect.gen(function* () {
      const context = yield* Layer.build(hosted);
      return yield* Effect.gen(function* () {
        return {
          reviewer: (yield* ReviewerApi).fetch,
          intake: (yield* IntakeApi).fetch,
          agent: (yield* AgentApi).fetch,
        };
      }).pipe(Effect.provideContext(context));
    }),
  };
};
