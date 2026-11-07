/** Isolated Node entrypoint. Never import into the parent.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationDiffWorkerProgram } from "./DiffWorkerProgram.ts";

const main = Layer.mergeAll(NodeCrypto.layerDigest, NodeFileSystem.layer, NodeStdio.layer).pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(citationDiffWorkerProgram, context)),
  Effect.scoped
);
NodeRuntime.runMain(main);
