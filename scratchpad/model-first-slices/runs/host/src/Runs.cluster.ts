import { RunId } from "@proto/kernel/Ids";
import { AgentRun, StoredAgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import { RunsApi } from "@proto/runs-model/RunsApi.api";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { hostRuns } from "./Host.ts";
import { ClaimDecidedInboxLive, ClaimDecidedInboxPoller } from "./Inbox/ClaimDecided.inbox.ts";
import { PgInboxStore } from "./Inbox/PgInboxStore.adapter.ts";
import { RunsGatewayLive } from "./RunsGateway.adapter.ts";

/** A run's state as JSON, as its storage holds it: `null` for an absent value, not an `Option` object. */
const encodeRunState = S.encodeEffect(S.toCodecJson(StoredAgentRunState));

/**
 * The runs context on a cluster (D13, D39): its model hosted once on the
 * pool's platform; the runs gateway; the `ClaimDecided` inbox with its
 * store in the cluster's Postgres; the Runs Api; and a conformance-only
 * read of a run's state.
 *
 * @category cluster
 * @since 0.0.0
 */
export const RunsCluster = <ROut, E, R>(platform: Layer.Layer<ROut, E, R>) => {
  const hosted = hostRuns(platform);
  // A conformance-only read of a run's state, in its stored JSON form: the runs client, then the route.
  const state = Effect.map(Effect.service(AgentRun), (runs) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest;
      const url = new URL(request.url, "http://front");
      const run = yield* runs.get(RunId.make(url.searchParams.get("run") ?? ""));
      const stored = yield* Effect.orDie(encodeRunState(run));
      return yield* HttpServerResponse.json(stored);
    }),
  );
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
      return yield* Effect.gen(function* () {
        const api = (yield* RunsApi).fetch;
        const read = yield* state;
        return { runs: api, "runs-state": read };
      }).pipe(Effect.provideContext(context));
    }),
  };
};
