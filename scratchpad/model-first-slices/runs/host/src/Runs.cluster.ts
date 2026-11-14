import type { AuthorityGateway } from "@proto/authority-contract/Authority.gateway";
import { RunId } from "@proto/kernel/Ids";
import type { Session } from "@proto/kernel/Session.middleware";
import type { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway";
import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";
import { RunsApi } from "@proto/runs-model/RunsApi.api";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import { hostRuns } from "./Host.ts";
import { ClaimDecidedInboxLive, ClaimDecidedInboxPoller } from "./Inbox/ClaimDecided.inbox.ts";
import { PgInboxStore } from "./Inbox/PgInboxStore.adapter.ts";
import { RunsGatewayLive } from "./RunsGateway.adapter.ts";

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
  const state = Effect.gen(function* () {
    const runs = yield* AgentRun;
    return Effect.gen(function* () {
      const request = yield* HttpServerRequest;
      const url = new URL(request.url, "http://front");
      const run = yield* runs.get(RunId.make(url.searchParams.get("run") ?? ""));
      return yield* HttpServerResponse.json(run);
    });
  });
  return {
    parts: {
      RunsGateway: RunsGatewayLive.pipe(Layer.provide(hosted)) as Layer.Layer<
        Layer.Success<typeof RunsGatewayLive>,
        E,
        R | AuthorityGateway
      >,
      ClaimDecidedInbox: ClaimDecidedInboxPoller.pipe(
        Layer.provide(ClaimDecidedInboxLive),
        Layer.provide(Layer.merge(hosted, PgInboxStore)),
      ) as Layer.Layer<never, E, R | AuthorityGateway | PartyFactsFeed>,
    },
    apis: Effect.gen(function* () {
      return { runs: (yield* RunsApi).fetch, "runs-state": yield* state };
    }).pipe(Effect.provide(hosted)) as Effect.Effect<
      Readonly<Record<string, Effect.Effect<unknown, unknown, unknown>>>,
      E,
      R | AuthorityGateway | Session
    >,
  };
};
