/** Private isolated regex entrypoint. Never import into the parent.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { citationRegexWorkerProgram } from "./RegexWorkerProgram.ts";

const main = Layer.merge(BunCrypto.layerDigest, BunStdio.layer).pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(citationRegexWorkerProgram, context)),
  Effect.scoped
);
BunRuntime.runMain(main);
