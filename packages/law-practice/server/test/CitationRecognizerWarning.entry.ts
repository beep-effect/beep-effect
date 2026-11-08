/** Warning-after-recognition qualification fixture, never a production entry.
 * @internal @packageDocumentation @since 0.0.0
 */
import { EyeciteRpcs } from "@beep/eyecite/protocol";
import { recognizeEyecite } from "@beep/eyecite/recognize";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";

const main = Effect.gen(function* () {
  const context = yield* Layer.build(
    Layer.merge(
      BunStdio.layer,
      RpcSerialization.layerSchemaBinary({ maxFrameSize: 8_000_000, fingerprintPayloads: true })
    )
  );
  return yield* Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio;
    const protocol = yield* RpcServer.makeProtocolStdio;
    const handlers = yield* Layer.build(
      EyeciteRpcs.toLayer({
        Recognize: (input) =>
          recognizeEyecite(input).pipe(
            Effect.tap(() =>
              Stream.make("PRIVATE-WORKER-SOURCE-SENTINEL").pipe(
                Stream.run(stdio.stderr({ endOnDone: false })),
                Effect.orDie
              )
            )
          ),
      })
    );
    return yield* RpcServer.make(EyeciteRpcs).pipe(
      Effect.provideService(RpcServer.Protocol, protocol),
      Effect.provideContext(handlers)
    );
  }).pipe(Effect.provideContext(context));
}).pipe(Effect.scoped);
BunRuntime.runMain(main);
