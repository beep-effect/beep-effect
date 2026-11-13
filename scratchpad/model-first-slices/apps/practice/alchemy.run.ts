import * as Docker from "@alchemy.run/docker";
import * as Cluster from "@alchemy.run/effect-cluster";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import PartyMailboxPollerLive from "./src/cluster/PartyMailboxPoller.ts";
import PracticeApi from "./src/PracticeApi.ts";

/**
 * The practice deployment: the Party model and its mailbox poller on a local
 * Docker swarm. Type-checked only; never deployed by the prototype.
 */
export default Alchemy.Stack(
  "Practice",
  {
    providers: Layer.mergeAll(Docker.providers(), Cluster.providers()),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    // Brings the model's entity, the pool and the database with it.
    const api = yield* PracticeApi;
    return { api: api.name };
    // Nothing calls a singleton; its Layer is provided to the stack.
  }).pipe(Effect.provide(PartyMailboxPollerLive)),
);
