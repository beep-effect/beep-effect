/** Private isolated Node regex entrypoint. Never import into the parent.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationRegexWorkerProgram } from "./RegexWorkerProgram.ts";

const main = Layer.merge(NodeCrypto.layerDigest, NodeStdio.layer).pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(citationRegexWorkerProgram, context)),
  Effect.scoped
);
NodeRuntime.runMain(main);
