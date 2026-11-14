import * as Docker from "@alchemy.run/docker";
import * as Cluster from "@alchemy.run/effect-cluster";
import { reviewerFetch } from "@proto/party-host/ReviewerApi.http";
import * as Effect from "effect/Effect";
import { Database } from "./Cluster.ts";
import PartyLive from "./cluster/Party.ts";

/** Published on the host: http://localhost:8080. */
export const PORT = 8080;

/**
 * The ReviewerApi over HTTP, as a service on the local Docker swarm. Building
 * it builds the Party model's Layer, which brings the model's entity, the
 * pool and the database with it.
 *
 * @category services
 * @since 0.0.0
 */
export default class PracticeApi extends Docker.Service<PracticeApi>()(
  "PracticeApi",
  Effect.gen(function* () {
    const database = yield* Cluster.Database.Database;
    return {
      main: import.meta.url,
      port: 3000,
      ports: [{ external: PORT, internal: 3000 }],
      networks: database.network?.kind === "docker" ? [{ name: database.network.name }] : [],
    };
  }).pipe(Effect.provide(Database)),
  Effect.gen(function* () {
    return { fetch: yield* reviewerFetch };
  }).pipe(Effect.provide(PartyLive)),
) {}
