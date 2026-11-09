/** Typed recognizer failure fixture using the supplied RPC transport.
 * @internal @packageDocumentation @since 0.0.0
 */
import { EyeciteFailure, EyeciteRawRange, EyeciteRecognition, EyeciteRecognizeOutput } from "@beep/eyecite";
import { EyeciteRpcs } from "@beep/eyecite/protocol";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";

const handlers = EyeciteRpcs.toLayer({
  Recognize: ({ source }) =>
    Match.value(source).pipe(
      Match.when("Id.", () =>
        Effect.succeed(
          EyeciteRecognizeOutput.make({
            tokens: [
              EyeciteRecognition.cases.id.make({
                range: EyeciteRawRange.make({ start: 0, end: 999 }),
                components: [],
              }),
            ],
            outsideProfile: 0,
            excludedRanges: [],
          })
        )
      ),
      Match.when("PRIVATE-BACKEND-SOURCE-LIMIT", () => Effect.fail(EyeciteFailure.make({ reason: "source-limit" }))),
      Match.orElse(() => Effect.fail(EyeciteFailure.make({ reason: "parser-failed" })))
    ),
});
RpcServer.layer(EyeciteRpcs).pipe(
  Layer.provide(handlers),
  Layer.provide(RpcServer.layerProtocolStdio),
  Layer.provide(RpcSerialization.layerSchemaBinary({ maxFrameSize: 262_144, fingerprintPayloads: true })),
  Layer.provide(BunStdio.layer),
  Layer.launch,
  BunRuntime.runMain
);
