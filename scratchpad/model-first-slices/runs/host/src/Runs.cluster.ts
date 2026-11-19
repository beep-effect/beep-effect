import { RunsApi } from "@proto/runs-model/RunsApi.api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { hostRuns } from "./Host.ts";
import { ClaimDecidedInboxLive, ClaimDecidedInboxPoller } from "./Inbox/ClaimDecided.inbox.ts";
import { PgInboxStore } from "./Inbox/PgInboxStore.adapter.ts";
import { RunsGatewayLive } from "./RunsGateway.adapter.ts";

/**
 * The runs context on a cluster (D13, D39): its model hosted once on the
 * pool's platform; the runs gateway; the `ClaimDecided` inbox with its
 * store in the cluster's Postgres; and the Runs Api, which is the only way
 * a run is read from outside (its `RunState` query).
 *
 * @category cluster
 * @since 0.0.0
 */
export const RunsCluster = <ROut, E, R>(platform: Layer.Layer<ROut, E, R>) => {
  const hosted = hostRuns(platform);
  return {
    parts: {
      RunsGateway: RunsGatewayLive.pipe(Layer.provide(hosted)),
      ClaimDecidedInbox: ClaimDecidedInboxPoller.pipe(
        Layer.provide(ClaimDecidedInboxLive),
        Layer.provide(Layer.merge(hosted, PgInboxStore)),
      ),
    },
    // Built into the caller's scope, not with `Effect.provide`: the Apis serve requests long after
    // this effect returns, so the hosted model's scope must stay open with the caller's (D39).
    apis: Effect.gen(function* () {
      const context = yield* Layer.build(hosted);
      return yield* Effect.map(RunsApi, (api) => ({ runs: api.fetch })).pipe(Effect.provideContext(context));
    }),
  };
};
