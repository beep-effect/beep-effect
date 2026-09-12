import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import { readJsonText } from "../AcpJson.codec.ts";
import type * as RpcMessage from "effect/unstable/rpc/RpcMessage";
import type { JsonTextSyntaxError } from "../AcpJson.codec.ts";

// Inbound JSON-RPC frame decoding. This mirrors the private envelope mapping inside effect's
// `RpcSerialization.ndJsonRpc` (4.0.0-rc.113) so that the JSON text itself can be read through
// `readJsonText`, which the effect parser does not allow injecting. Batch responses are not
// correlated (ACP never sends JSON-RPC batches); every message is encoded individually.

const EFFECT_RPC_METHOD_PREFIX = "@effect/rpc/";
const DEFAULT_MAX_BUFFER_SIZE = 16 * 1024 * 1024;

/**
 * Union of the transport-encoded RPC messages that cross the ACP wire in either direction.
 *
 * @category models
 * @since 0.0.0
 */
export type AcpWireMessage = RpcMessage.FromClientEncoded | RpcMessage.FromServerEncoded;

type AcpFrameDecodeError = JsonTextSyntaxError | S.SchemaError | RpcSerialization.MaxBufferSizeExceeded;

const JsonRpcId = S.Union([S.Finite, S.String, S.Null]);
const JsonRpcHeaders = S.Array(S.Tuple([S.String, S.String]));
const JsonRpcControlTag = LiteralKit(["Ack", "Interrupt", "Ping", "Eof", "Pong"]);
const JsonRpcControlParams = S.Struct({ requestId: S.Union([S.String, S.Finite]) });
const JsonRpcErrorTag = LiteralKit(["Cause", "Defect"]);
const JsonRpcRequestFrame = S.Struct({
  method: S.String,
  id: S.optionalKey(JsonRpcId),
  params: S.optionalKey(S.Unknown),
  headers: S.optionalKey(JsonRpcHeaders),
  traceId: S.optionalKey(S.String),
  spanId: S.optionalKey(S.String),
  sampled: S.optionalKey(S.Boolean),
});
const JsonRpcErrorFrame = S.Struct({
  code: S.Finite,
  message: S.String,
  data: S.optionalKey(S.Unknown),
  _tag: S.optionalKey(JsonRpcErrorTag),
});
const JsonRpcResponseFrame = S.Struct({
  id: S.optionalKey(JsonRpcId),
  result: S.optionalKey(S.Unknown),
  chunk: S.optionalKey(S.Boolean),
  error: JsonRpcErrorFrame.pipe(S.NullOr, S.optionalKey),
});
const JsonRpcCauseEntry = S.Union([
  S.TaggedStruct("Fail", { error: S.Unknown }),
  S.TaggedStruct("Die", { defect: S.Unknown }),
  S.TaggedStruct("Interrupt", { fiberId: S.optionalKey(S.Finite) }),
]);

type ExitCause = Extract<RpcMessage.ExitEncoded<unknown, unknown>, { readonly _tag: "Failure" }>["cause"];
type ExitCauseEntry = ExitCause[number];

const decodeRequestFrame = S.decodeUnknownResult(JsonRpcRequestFrame);
const decodeResponseFrame = S.decodeUnknownResult(JsonRpcResponseFrame);
const decodeCauseEntries = S.decodeUnknownResult(S.Array(JsonRpcCauseEntry));
const decodeChunkValues = S.decodeUnknownResult(S.NonEmptyArray(S.Unknown));
const decodeControlTag = S.decodeUnknownResult(JsonRpcControlTag);
const decodeControlParams = S.decodeUnknownResult(JsonRpcControlParams);
const isJsonArray = S.is(S.Array(S.Unknown));

const toCauseEntry = Match.type<(typeof JsonRpcCauseEntry)["Type"]>().pipe(
  Match.tag("Interrupt", (entry): ExitCauseEntry => ({ _tag: "Interrupt", fiberId: entry.fiberId })),
  Match.orElse((entry): ExitCauseEntry => entry)
);

const toHeader = ([name, value]: readonly [string, string]): [string, string] => [name, value];

const toControlMessage = (tag: string, params: unknown): Result.Result<AcpWireMessage, S.SchemaError> =>
  Result.flatMap(decodeControlTag(tag), (control) => {
    const withRequestId = (
      make: (requestId: string | number) => AcpWireMessage
    ): Result.Result<AcpWireMessage, S.SchemaError> =>
      Result.map(decodeControlParams(params), ({ requestId }) => make(requestId));
    return Match.value(control).pipe(
      Match.when("Ack", () => withRequestId((requestId) => ({ _tag: "Ack", requestId }))),
      Match.when("Interrupt", () => withRequestId((requestId) => ({ _tag: "Interrupt", requestId }))),
      Match.when("Ping", () => Result.succeed<AcpWireMessage>({ _tag: "Ping" })),
      Match.when("Eof", () => Result.succeed<AcpWireMessage>({ _tag: "Eof" })),
      Match.when("Pong", () => Result.succeed<AcpWireMessage>({ _tag: "Pong" })),
      Match.exhaustive
    );
  });

const toRequestMessage = (
  frame: unknown,
  request: (typeof JsonRpcRequestFrame)["Type"]
): Result.Result<AcpWireMessage, S.SchemaError> => {
  const id = O.fromNullishOr(request.id);
  if (O.isNone(id) && Str.startsWith(EFFECT_RPC_METHOD_PREFIX)(request.method)) {
    return toControlMessage(Str.slice(Str.length(EFFECT_RPC_METHOD_PREFIX))(request.method), request.params);
  }
  return Result.succeed<AcpWireMessage>({
    _tag: "Request",
    id: O.getOrElse(id, () => ""),
    tag: request.method,
    payload: request.params ?? null,
    headers: A.map(request.headers ?? [], toHeader),
    ...(P.hasProperty(frame, "id") ? {} : { isNotification: true as const }),
    ...O.getSomesStruct({
      traceId: O.fromUndefinedOr(request.traceId),
      spanId: O.fromUndefinedOr(request.spanId),
      sampled: O.fromUndefinedOr(request.sampled),
    }),
  });
};

const toResponseMessage = (
  response: (typeof JsonRpcResponseFrame)["Type"]
): Result.Result<AcpWireMessage, S.SchemaError> => {
  const requestId = O.getOrElse(O.fromNullishOr(response.id), () => "");
  const error = O.fromNullishOr(response.error);
  if (O.isSome(error) && error.value._tag === "Defect") {
    return Result.succeed<AcpWireMessage>({ _tag: "Defect", defect: error.value.data });
  }
  if (response.chunk === true) {
    return Result.map(
      decodeChunkValues(response.result),
      (values): AcpWireMessage => ({ _tag: "Chunk", requestId, values })
    );
  }
  return Result.succeed<AcpWireMessage>({
    _tag: "Exit",
    requestId,
    exit: O.match(error, {
      onNone: (): RpcMessage.ExitEncoded<unknown, unknown> => ({ _tag: "Success", value: response.result }),
      onSome: (error): RpcMessage.ExitEncoded<unknown, unknown> => ({
        _tag: "Failure",
        cause:
          error._tag === "Cause"
            ? Result.getOrElse(
                Result.map(decodeCauseEntries(error.data), A.map(toCauseEntry)),
                (): ExitCause => [{ _tag: "Die", defect: error }]
              )
            : [{ _tag: "Die", defect: error }],
      }),
    }),
  });
};

const decodeJsonRpcMessage = (frame: unknown): Result.Result<AcpWireMessage, S.SchemaError> =>
  P.hasProperty(frame, "method")
    ? Result.flatMap(decodeRequestFrame(frame), (request) => toRequestMessage(frame, request))
    : Result.flatMap(decodeResponseFrame(frame), toResponseMessage);

const decodeJsonRpcFrame = (frame: unknown): Result.Result<ReadonlyArray<AcpWireMessage>, S.SchemaError> =>
  isJsonArray(frame) ? Result.all(A.map(frame, decodeJsonRpcMessage)) : Result.map(decodeJsonRpcMessage(frame), A.of);

/**
 * Builds a stateful ndjson frame decoder for the ACP transport.
 *
 * **Details**
 *
 * Each call to the returned function appends one chunk to a line buffer, reads every complete
 * line through {@link readJsonText}, and maps the JSON-RPC envelope to the encoded RPC messages
 * that effect's `RpcSerialization.ndJsonRpc` produces. A line or trailing remainder above 16 MiB
 * fails with `MaxBufferSizeExceeded` and discards the buffer.
 *
 * **Example** (Decode one notification frame)
 *
 * ```ts
 * import { makeNdJsonRpcFrameDecoder } from "./jsonrpc.ts"
 * import * as Result from "effect/Result"
 *
 * const decode = makeNdJsonRpcFrameDecoder()
 * console.log(Result.isSuccess(decode('{"jsonrpc":"2.0","method":"x/ping"}\n')))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeNdJsonRpcFrameDecoder = (): ((
  chunk: Uint8Array
) => Result.Result<ReadonlyArray<AcpWireMessage>, AcpFrameDecodeError>) => {
  const decoder = new TextDecoder();
  let buffer = "";
  const exceeds = (size: number): boolean => size > DEFAULT_MAX_BUFFER_SIZE;
  const failBufferSize = (): Result.Result<never, RpcSerialization.MaxBufferSizeExceeded> => {
    buffer = "";
    return Result.fail(new RpcSerialization.MaxBufferSizeExceeded({ maxBufferSize: DEFAULT_MAX_BUFFER_SIZE }));
  };
  return (chunk) => {
    buffer += decoder.decode(chunk, { stream: true });
    const batches = A.empty<ReadonlyArray<AcpWireMessage>>();
    let position = 0;
    let newline = buffer.indexOf("\n", position);
    while (newline !== -1) {
      if (exceeds(newline - position)) {
        return failBufferSize();
      }
      const line = buffer.slice(position, newline);
      position = newline + 1;
      const decoded = Result.flatMap(readJsonText(line), decodeJsonRpcFrame);
      if (Result.isFailure(decoded)) {
        buffer = buffer.slice(position);
        return Result.fail(decoded.failure);
      }
      A.appendInPlace(batches, decoded.success);
      newline = buffer.indexOf("\n", position);
    }
    buffer = buffer.slice(position);
    if (exceeds(Str.length(buffer))) {
      return failBufferSize();
    }
    return Result.succeed(A.flatten(batches));
  };
};
