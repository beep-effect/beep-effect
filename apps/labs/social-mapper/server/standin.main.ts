/**
 * Runs the stand-in site on a loopback port, for trying the app without a real account.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import { site } from "./StandIn.ts";

const Main = Layer.unwrap(
  Effect.map(Config.Port("SOCIAL_MAPPER_STANDIN_PORT").pipe(Config.withDefault(3942)), (port) =>
    HttpServer.serve(site).pipe(Layer.provide(BunHttpServer.layer({ hostname: "127.0.0.1", port })))
  )
);

Main.pipe(Layer.launch, BunRuntime.runMain);
