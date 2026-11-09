/**
 * Isolated recognition program over supplied Effect RPC stdio and SchemaBinary.
 * @internal @packageDocumentation @since 0.0.0
 */
import { EyeciteRpcs } from "@beep/eyecite/protocol";
import { recognizeEyecite } from "@beep/eyecite/recognize";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";

const $I = $LawPracticeServerId.create("internal/Citation/RecognizerWorkerProgram");
const Startup = S.Tuple([S.FiniteFromString.pipe(S.decodeTo(CitationEngineLimits.fields.processMessageBytes))]).pipe(
  $I.annoteSchema("Startup", {
    description: "Trusted message ceiling only; source text never crosses argv or the environment.",
  })
);
const encoder = new TextEncoder();
/** Run the pinned recognizer in a dedicated runtime. An outbound oversized frame
 * emits a fixed source-free diagnostic and is refused before writing bytes.
 * Parent supervision must reject any diagnostic and independently confirm exit.
 * @internal @category operations @since 0.0.0
 */
export const citationRecognizerWorkerProgram = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const args = yield* stdio.args;
  const [maximum] = yield* S.decodeUnknownEffect(Startup)(args);
  const guarded = Stdio.Stdio.of({
    ...stdio,
    stdout: (options) =>
      stdio.stdout(options).pipe(
        Sink.mapInputEffect((chunk) => {
          const bytes = P.isString(chunk) ? encoder.encode(chunk) : chunk;
          if (bytes.byteLength <= maximum) return Effect.succeed(chunk);
          return Stream.make("recognizer-output-refused").pipe(
            Stream.run(stdio.stderr({ endOnDone: false })),
            Effect.andThen(
              Effect.fail(PlatformError.systemError({ module: "Stdio", method: "stdout", _tag: "Unknown" }))
            )
          );
        })
      ),
  });
  const serialization = yield* Layer.build(
    RpcSerialization.layerSchemaBinary({ maxFrameSize: maximum, fingerprintPayloads: true })
  );
  // Construct the supplied stdio protocol on this program's live fiber. Its
  // EOF writer finalizer then ends this one-shot process after pending replies.
  const protocol = yield* RpcServer.makeProtocolStdio.pipe(
    Effect.provideService(Stdio.Stdio, guarded),
    Effect.provideContext(serialization)
  );
  const handlers = yield* Layer.build(EyeciteRpcs.toLayer({ Recognize: recognizeEyecite }));
  return yield* RpcServer.make(EyeciteRpcs).pipe(
    Effect.provideService(RpcServer.Protocol, protocol),
    Effect.provideContext(handlers)
  );
}).pipe(Effect.withSpan("Citation.recognizerWorkerProgram"));
