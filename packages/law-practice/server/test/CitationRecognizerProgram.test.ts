import { EyeciteRpcs } from "@beep/eyecite/protocol";
import { citationRecognizerWorkerProgram } from "@beep/law-practice-server/internal/Citation/RecognizerWorkerProgram";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as Schedule from "effect/Schedule";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Socket from "effect/socket/Socket";

const ioFailure = () => PlatformError.systemError({ module: "Stdio", method: "test", _tag: "Unknown" });
// Exercise the production stdio program with supplied test/transport services.
// Real process responsiveness and physical retirement remain separate child tests.
const fixture = Effect.fnUntraced(function* (maximum: number) {
  const requests = new TransformStream<Uint8Array, Uint8Array>();
  const responses = new TransformStream<string | Uint8Array, string | Uint8Array>();
  const diagnostic = yield* Deferred.make<string | Uint8Array>();
  const writes = yield* Ref.make(0);
  const requestMaximum = yield* Ref.make(0);
  const responseMaximum = yield* Ref.make(0);
  const stdio = Stdio.layerTest({
    args: Effect.succeed([`${maximum}`]),
    stdin: Stream.fromReadableStream({ evaluate: () => requests.readable, onError: ioFailure }).pipe(
      Stream.tap((bytes) => Ref.update(requestMaximum, (n) => Math.max(n, bytes.byteLength)))
    ),
    stdout: (options) =>
      Sink.fromWritableStream({
        evaluate: () => responses.writable,
        onError: ioFailure,
        closeOnDone: options?.endOnDone !== false,
      }).pipe(
        Sink.mapInputEffect((chunk: string | Uint8Array) =>
          Ref.update(writes, (n) => n + 1).pipe(
            Effect.andThen(
              Ref.update(responseMaximum, (n) =>
                Math.max(n, typeof chunk === "string" ? new TextEncoder().encode(chunk).byteLength : chunk.byteLength)
              )
            ),
            Effect.as(chunk)
          )
        )
      ),
    stderr: () => Sink.forEach((chunk: string | Uint8Array) => Deferred.succeed(diagnostic, chunk).pipe(Effect.asVoid)),
  });
  const stdioContext = yield* Layer.build(stdio);
  const program = yield* citationRecognizerWorkerProgram.pipe(Effect.provideContext(stdioContext), Effect.forkScoped);
  const socket = yield* Socket.fromTransformStream(
    Effect.succeed({ readable: responses.readable, writable: requests.writable })
  );
  const serialization = yield* Layer.build(
    RpcSerialization.layerSchemaBinary({ maxFrameSize: 262_144, fingerprintPayloads: true })
  );
  const protocol = yield* RpcClient.makeProtocolSocket({
    retryTransientErrors: false,
    retryPolicy: Schedule.recurs(0),
    pingInterval: Duration.hours(1),
  }).pipe(Effect.provideService(Socket.Socket, socket), Effect.provideContext(serialization));
  const client = yield* RpcClient.make(EyeciteRpcs, {
    disableTracing: true,
    generateRequestId: () => RpcMessage.RequestId(0),
  }).pipe(Effect.provideService(RpcClient.Protocol, protocol));
  yield* Effect.yieldNow;
  return { client, program, diagnostic, writes, requestMaximum, responseMaximum };
});

it.layer(Layer.empty, { excludeTestServices: true })("recognizer stdio boundary", (it) => {
  it.effect("rejects invalid startup ceilings before opening standard I/O", () =>
    Effect.gen(function* () {
      for (const args of [[], ["0"], ["private-invalid"], ["1", "extra"]]) {
        const context = yield* Layer.build(Stdio.layerTest({ args: Effect.succeed(args) }));
        const failure = yield* citationRecognizerWorkerProgram.pipe(Effect.provideContext(context), Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      }
    })
  );
  it.effect("runs actual recognition over supplied binary RPC and deterministic standard I/O", () =>
    Effect.gen(function* () {
      const { client, program, writes } = yield* fixture(262_144);
      const output = yield* client.Recognize({ source: "35 U.S.C. 101", sourceUtf16: 1000, candidates: 10 });
      expect(output.tokens).toHaveLength(1);
      expect(A.getUnsafe(output.tokens, 0)).toMatchObject({ type: "statute", title: 35, section: "101" });
      const count = yield* Ref.get(writes);
      expect(count).toBeGreaterThan(0);
      yield* Fiber.interrupt(program);
    })
  );
  it.effect("refuses an amplified encoded reply before stdout and emits only the fixed diagnostic", () =>
    Effect.gen(function* () {
      const source = `${Str.repeat(50)("Alpha ")}v. Beta, 123 U.S. 100 (1900).`;
      const probe = yield* fixture(262_144);
      const observed = yield* probe.client.Recognize({ source, sourceUtf16: 1000, candidates: 10 });
      expect(observed.tokens).toHaveLength(1);
      const requestBytes = yield* Ref.get(probe.requestMaximum);
      const responseBytes = yield* Ref.get(probe.responseMaximum);
      expect(responseBytes).toBeGreaterThan(requestBytes);
      yield* Fiber.interrupt(probe.program);
      const { client, program, diagnostic, writes } = yield* fixture(requestBytes);
      const pending = yield* client
        .Recognize({ source, sourceUtf16: 1000, candidates: 10 })
        .pipe(Effect.exit, Effect.forkChild);
      const refused = yield* Deferred.await(diagnostic).pipe(Effect.timeout(Duration.seconds(2)));
      expect(refused).toBe("recognizer-output-refused");
      const count = yield* Ref.get(writes);
      expect(count).toBe(0);
      yield* Fiber.interrupt(pending);
      yield* Fiber.interrupt(program);
    })
  );
});
