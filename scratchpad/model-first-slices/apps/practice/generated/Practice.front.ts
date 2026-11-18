// Generated from the composed deployment descriptors by scripts/entries.ts. Do not edit:
// `bun run entries` rewrites it, and `bun run entries --check` fails on drift.
import * as Docker from "@alchemy.run/docker";
import * as Cluster from "@alchemy.run/effect-cluster";
import type { HttpEffect } from "alchemy/Http";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { Database } from "../src/Cluster.ts";
import { AuthorityGateway, RunsGateway, Session, authority, conformance, party, runs } from "./Practice.entry.ts";

/** The front: every context's Apis by first path segment; the conformance app at the root. */
export default class PracticeFront extends Docker.Service<PracticeFront>()(
  "PracticeFront",
  Effect.gen(function* () {
    const database = yield* Cluster.Database.Database;
    return {
      main: import.meta.url,
      port: 3000,
      // No host port (phase 6): the conformance driver runs as a service on the stack's network.
      networks: database.network?.kind === "docker" ? [{ name: database.network.name }] : [],
      // Queries run on the front, reading the directory in the cluster's Postgres.
      // Docker.Service rebuilds the front's image only when these props change, not when the code
      // it imports does (notes/phase-5.md): bump FRONT_REVISION to force a new front image.
      env: { CLUSTER_DATABASE_URL: database.url, FRONT_REVISION: "3" },
    };
  }).pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off -- the front class's deploy-time props are an Alchemy class entry point, and Alchemy provides a class's layers per deploy on purpose (alchemy Platform.ts provideClassLayer: a longer-lived build skips source registration on the next deploy). Owner: @proto/practice. Exit: when the stack provides Database through its providers instead, proved by a deploy.
    Effect.provide(Database),
  ),
  Effect.gen(function* () {
    // The parts the Apis call through, built once into the front's scope as each context builds its
    // own model (D39): the Apis serve requests long after this effect returns.
    const parts = yield* Layer.build(Layer.mergeAll(AuthorityGateway, RunsGateway, Session));
    const routes: Readonly<Record<string, HttpEffect>> = {
      ...(yield* authority.apis),
      ...(yield* party.apis.pipe(Effect.provideContext(parts))),
      ...(yield* runs.apis.pipe(Effect.provideContext(parts))),
      ...(yield* conformance.apis),
    };
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const segment = pipe(new URL(request.url, "http://front").pathname, Str.split("/"), A.get(1), O.getOrElse(() => ""));
        // A path no context serves goes to the root app; with none, it is not found.
        return yield* O.match(O.orElse(R.get(routes, segment), () => R.get(routes, "")), {
          onNone: () => Effect.succeed(HttpServerResponse.empty({ status: 404 })),
          onSome: (route) => route,
        });
      }),
    };
  }),
) {}
