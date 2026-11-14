// Generated from the composed deployment descriptors by scripts/entries.ts. Do not edit:
// `bun run entries` rewrites it, and `bun run entries --check` fails on drift.
import * as Docker from "@alchemy.run/docker";
import * as Cluster from "@alchemy.run/effect-cluster";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import { Database } from "../src/Cluster.ts";
import { AuthorityGateway, RunsGateway, Session, authority, conformance, party, runs } from "./Practice.entry.ts";

/** The front's one host port (swarm ingress; see notes/phase-5.md on binding). */
export const FRONT_PORT = 18640;

/** The front: every context's Apis by first path segment; the conformance app at the root. */
export default class PracticeFront extends Docker.Service<PracticeFront>()(
  "PracticeFront",
  Effect.gen(function* () {
    const database = yield* Cluster.Database.Database;
    return {
      main: import.meta.url,
      port: 3000,
      ports: [{ external: FRONT_PORT, internal: 3000 }],
      networks: database.network?.kind === "docker" ? [{ name: database.network.name }] : [],
      // Queries run on the front, reading the directory in the cluster's Postgres.
      // Docker.Service rebuilds the front's image only when these props change, not when the code
      // it imports does (notes/phase-5.md): bump FRONT_REVISION to force a new front image.
      env: { CLUSTER_DATABASE_URL: database.url, FRONT_REVISION: "3" },
    };
  }).pipe(Effect.provide(Database)),
  Effect.gen(function* () {
    const routes: Readonly<Record<string, Effect.Effect<unknown, unknown, unknown>>> = {
      ...(yield* authority.apis),
      ...(yield* party.apis.pipe(Effect.provide(Layer.mergeAll(AuthorityGateway, RunsGateway, Session)))),
      ...(yield* runs.apis.pipe(Effect.provide(Layer.mergeAll(AuthorityGateway, Session)))),
      ...(yield* conformance.apis),
    };
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const segment = new URL(request.url, "http://front").pathname.split("/")[1] ?? "";
        return yield* (routes[segment] ?? routes[""])!;
      }),
    } as never;
  }),
) {}
