/** Isolated Bun entrypoint. Never import into the parent.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationDiffWorkerProgram } from "./DiffWorkerProgram.ts";

const main = Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer, BunStdio.layer).pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(citationDiffWorkerProgram, context)),
  Effect.scoped
);
BunRuntime.runMain(main);
