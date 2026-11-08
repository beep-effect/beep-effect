/** Isolated Bun recognizer entrypoint; never import into the supervisor.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationRecognizerWorkerProgram } from "./RecognizerWorkerProgram.ts";

const main = Layer.build(BunStdio.layer).pipe(
  Effect.flatMap((context) => citationRecognizerWorkerProgram.pipe(Effect.provideContext(context))),
  Effect.scoped
);
BunRuntime.runMain(main);
