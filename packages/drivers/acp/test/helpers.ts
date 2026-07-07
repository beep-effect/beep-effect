import { Client as AcpClient } from "@beep/acp";
import * as Effect from "effect/Effect";
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

export const jsonRpcRequest = <A, I>(method: string, params: S.Codec<A, I>) =>
  S.Struct({
    headers: JsonRpcHeaders,
    id: JsonRpcId,
    jsonrpc: S.Literal("2.0"),
    method: S.Literal(method),
    params,
  });

export const jsonRpcNotification = <A, I>(method: string, params: S.Codec<A, I>) =>
  S.Struct({
    jsonrpc: S.Literal("2.0"),
    method: S.Literal(method),
    params,
  });

export const jsonRpcResponse = <A, I>(result: S.Codec<A, I>) =>
  S.Struct({
    id: JsonRpcId,
    jsonrpc: S.Literal("2.0"),
    result,
  });

export const encodeJsonl = <A, I>(schema: S.Codec<A, I>, value: A) =>
  Effect.map(S.encodeEffect(S.fromJsonString(schema))(value), (encoded) => encoder.encode(`${encoded}\n`));

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
