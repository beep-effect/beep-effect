/** Isolated Bun recognizer entrypoint; never import into the supervisor.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Layer from "effect/Layer";
import { citationRecognizerWorkerProgram } from "./RecognizerWorkerProgram.ts";

const main = Layer.effectDiscard(citationRecognizerWorkerProgram).pipe(Layer.provide(BunStdio.layer), Layer.launch);
BunRuntime.runMain(main);
