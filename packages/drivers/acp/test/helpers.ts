import { Client as AcpClient } from "@beep/acp";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import type * as Cause from "effect/Cause";
import type { ChildProcessSpawner } from "effect/unstable/process";

const encoder = new TextEncoder();

const JsonRpcId = S.Union([S.Finite, S.String]);
const JsonRpcHeaders = S.Array(S.Unknown);

const jsonRpcRequestImpl = <A, I>(method: string, params: S.Codec<A, I>) =>
  S.Struct({
    headers: JsonRpcHeaders.pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
    id: JsonRpcId,
    jsonrpc: S.Literal("2.0"),
    method: S.Literal(method),
    params,
  });

export const jsonRpcRequest: {
  <A, I>(params: S.Codec<A, I>): (method: string) => ReturnType<typeof jsonRpcRequestImpl<A, I>>;
  <A, I>(method: string, params: S.Codec<A, I>): ReturnType<typeof jsonRpcRequestImpl<A, I>>;
} = dual(2, jsonRpcRequestImpl);

const jsonRpcNotificationImpl = <A, I>(method: string, params: S.Codec<A, I>) =>
  S.Struct({
    jsonrpc: S.Literal("2.0"),
    method: S.Literal(method),
    params,
  });

export const jsonRpcNotification: {
  <A, I>(params: S.Codec<A, I>): (method: string) => ReturnType<typeof jsonRpcNotificationImpl<A, I>>;
  <A, I>(method: string, params: S.Codec<A, I>): ReturnType<typeof jsonRpcNotificationImpl<A, I>>;
} = dual(2, jsonRpcNotificationImpl);

export const jsonRpcResponse = <A, I>(result: S.Codec<A, I>) =>
  S.Struct({
    id: JsonRpcId,
    jsonrpc: S.Literal("2.0"),
    result,
  });

export const encodeJsonl: {
  <A>(value: A): <I>(schema: S.Codec<A, I>) => Effect.Effect<Uint8Array<ArrayBuffer>, S.SchemaError>;
  <A, I>(schema: S.Codec<A, I>, value: A): Effect.Effect<Uint8Array<ArrayBuffer>, S.SchemaError>;
} = dual(2, <A, I>(schema: S.Codec<A, I>, value: A) =>
  Effect.map(S.encodeEffect(S.fromJsonString(schema))(value), (encoded) => encoder.encode(`${encoded}\n`))
);

// fallow-ignore-next-line code-duplication -- test transport stays independent from the package-internal process adapter
export const makeChildStdio = (handle: ChildProcessSpawner.ChildProcessHandle) =>
  Stdio.make({
    args: Effect.succeed([]),
    stdin: handle.stdout,
    stdout: () =>
      Sink.mapInput(handle.stdin, (chunk: string | Uint8Array) =>
        typeof chunk === "string" ? encoder.encode(chunk) : chunk
      ),
    stderr: () => Sink.drain,
  });

export const makeInMemoryStdio = Effect.fn("makeInMemoryStdio")(function* () {
  const input = yield* Queue.unbounded<Uint8Array, Cause.Done>();
  const output = yield* Queue.unbounded<string>();
  const decoder = new TextDecoder();

  return {
    input,
    output,
    stdio: Stdio.make({
      args: Effect.succeed([]),
      stdin: Stream.fromQueue(input),
      stdout: () =>
        Sink.forEach((chunk: string | Uint8Array) =>
          Queue.offer(output, typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true }))
        ),
      stderr: () => Sink.drain,
    }),
  };
});

export const makeTerminationError = AcpClient.makeTerminationError;
