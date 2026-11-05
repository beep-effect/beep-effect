/**
 * Private Bun process entrypoint; never import this module in the parent.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationHtmlWorkerProgram } from "./HtmlWorkerProgram.ts";

const main = Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer, BunPath.layer, BunStdio.layer).pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(citationHtmlWorkerProgram, context)),
  Effect.scoped
);
BunRuntime.runMain(main);
