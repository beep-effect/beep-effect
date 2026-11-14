/** Private isolated Node regex entrypoint. Never import into the parent.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationRegexSessionProgram } from "./RegexSessionProgram.ts";

const main = Layer.merge(NodeCrypto.layerDigest, NodeStdio.layer).pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(citationRegexSessionProgram, context)),
  Effect.scoped
);
NodeRuntime.runMain(main);
