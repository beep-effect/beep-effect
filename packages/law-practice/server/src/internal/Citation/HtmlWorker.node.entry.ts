/** Isolated Node HTML entrypoint. Never import into the parent.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationHtmlWorkerProgram } from "./HtmlWorkerProgram.ts";

const main = Layer.mergeAll(NodeCrypto.layerDigest, NodeFileSystem.layer, NodePath.layer, NodeStdio.layer).pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(citationHtmlWorkerProgram, context)),
  Effect.scoped
);
NodeRuntime.runMain(main);
