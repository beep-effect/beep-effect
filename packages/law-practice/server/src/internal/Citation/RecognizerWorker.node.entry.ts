/** Isolated Node recognizer entrypoint; never import into the supervisor.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as Layer from "effect/Layer";
import { citationRecognizerWorkerProgram } from "./RecognizerWorkerProgram.ts";

const main = Layer.effectDiscard(citationRecognizerWorkerProgram).pipe(Layer.provide(NodeStdio.layer), Layer.launch);
NodeRuntime.runMain(main);
