import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readJsonText } from "../AcpJson.codec.ts";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import type { JsonTextSyntaxError } from "../AcpJson.codec.ts";

const DEFAULT_MAX_BUFFER_SIZE = 16 * 1024 * 1024;

/**
 * Union of the transport-encoded RPC messages that cross the ACP wire in either direction.
 *
 * @category models
 * @since 0.0.0
 */
export type AcpWireMessage = RpcMessage.FromClientEncoded | RpcMessage.FromServerEncoded;

/**
 * The transport-encoded RPC messages an inbound ACP frame can decode to.
 *
 * **Details**
 *
 * A peer frame never decodes to an effect-rpc control message or a connection-level `Defect`, so
 * a response, error responses included, can settle only the request with its id. A response
 * without an id decodes with the empty request id; the protocol logs and drops it.
 *
 * @category models
 * @since 0.0.0
 */
export type AcpInboundMessage =
  | RpcMessage.RequestEncoded
  | RpcMessage.ResponseChunkEncoded
  | RpcMessage.ResponseExitEncoded;

type AcpFrameDecodeError = JsonTextSyntaxError | S.SchemaError | RpcSerialization.MaxBufferSizeExceeded;

const JsonRpcId = S.Union([S.Finite, S.String, S.Null]);
const JsonRpcHeaders = S.Array(S.Tuple([S.String, S.String]));
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
  _tag: S.optionalKey(S.Unknown),
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
  S.TaggedStruct("Interrupt", { fiberId: S.Finite.pipe(S.NullOr, S.optionalKey) }),
]);

type ExitCause = Extract<RpcMessage.ExitEncoded<unknown, unknown>, { readonly _tag: "Failure" }>["cause"];
type ExitCauseEntry = ExitCause[number];

const decodeRequestFrame = S.decodeUnknownResult(JsonRpcRequestFrame);
const decodeResponseFrame = S.decodeUnknownResult(JsonRpcResponseFrame);
const decodeCauseEntries = S.decodeUnknownResult(S.Array(JsonRpcCauseEntry));
const decodeChunkValues = S.decodeUnknownResult(S.NonEmptyArray(S.Unknown));
const isJsonArray = S.is(S.Array(S.Unknown));

const toCauseEntry = Match.type<(typeof JsonRpcCauseEntry)["Type"]>().pipe(
  Match.tag("Interrupt", (entry): ExitCauseEntry => ({ _tag: "Interrupt", fiberId: entry.fiberId })),
  Match.orElse((entry): ExitCauseEntry => entry)
);

const toHeader = ([name, value]: readonly [string, string]): [string, string] => [name, value];

const toRequestMessage = (frame: unknown, request: (typeof JsonRpcRequestFrame)["Type"]): AcpInboundMessage => ({
  _tag: "Request",
  id: O.getOrElse(O.fromNullishOr(request.id), () => ""),
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

// decision: own-inbound-json-rpc-decoder
const toResponseMessage = (
  response: (typeof JsonRpcResponseFrame)["Type"]
): Result.Result<AcpInboundMessage, S.SchemaError> => {
  const requestId = O.getOrElse(O.fromNullishOr(response.id), () => "");
  const error = O.fromNullishOr(response.error);
  if (response.chunk === true) {
    return Result.map(
      decodeChunkValues(response.result),
      (values): AcpInboundMessage => ({ _tag: "Chunk", requestId, values })
    );
  }
  return Result.succeed<AcpInboundMessage>({
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
            : [{ _tag: "Fail", error }],
      }),
    }),
  });
};

const decodeJsonRpcMessage = (frame: unknown): Result.Result<AcpInboundMessage, S.SchemaError> =>
  P.hasProperty(frame, "method")
    ? Result.map(decodeRequestFrame(frame), (request) => toRequestMessage(frame, request))
    : Result.flatMap(decodeResponseFrame(frame), toResponseMessage);

const isKeepAliveLine = (line: string): boolean => Str.isEmpty(Str.trim(line));

const decodeJsonRpcFrame = (frame: unknown): Result.Result<ReadonlyArray<AcpInboundMessage>, S.SchemaError> =>
  isJsonArray(frame) ? Result.all(A.map(frame, decodeJsonRpcMessage)) : Result.map(decodeJsonRpcMessage(frame), A.of);

/**
 * Builds a stateful ndjson frame decoder for the ACP transport.
 *
 * **Details**
 *
 * Each call to the returned function appends one chunk to a line buffer, reads every complete
 * non-blank line through {@link readJsonText}, and maps the JSON-RPC envelope to the encoded RPC messages
 * that effect's `RpcSerialization.ndJsonRpc` produces, with two exceptions: an `@effect/rpc/*`
 * method stays an ordinary request or notification instead of an RPC control message, and an error
 * object tagged `Defect` stays the failure of its own request id instead of a connection-level
 * defect that would fail every in-flight call. A line or trailing
 * remainder above 16 MiB fails with `MaxBufferSizeExceeded` and discards the buffer.
 * Whitespace-only lines are skipped.
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
) => Result.Result<ReadonlyArray<AcpInboundMessage>, AcpFrameDecodeError>) => {
  const decoder = new TextDecoder();
  let buffer = "";
  const exceeds = (size: number): boolean => size > DEFAULT_MAX_BUFFER_SIZE;
  const failBufferSize = (): Result.Result<never, RpcSerialization.MaxBufferSizeExceeded> => {
    buffer = "";
    return Result.fail(new RpcSerialization.MaxBufferSizeExceeded({ maxBufferSize: DEFAULT_MAX_BUFFER_SIZE }));
  };
  return (chunk) => {
    buffer += decoder.decode(chunk, { stream: true });
    const batches = A.empty<ReadonlyArray<AcpInboundMessage>>();
    let position = 0;
    const newlines = /\n/g;
    for (let newline = newlines.exec(buffer); newline !== null; newline = newlines.exec(buffer)) {
      if (exceeds(newline.index - position)) {
        return failBufferSize();
      }
      const line = pipe(buffer, Str.slice(position, newline.index));
      position = newline.index + 1;
      if (isKeepAliveLine(line)) {
        continue;
      }
      const decoded = Result.flatMap(readJsonText(line), decodeJsonRpcFrame);
      if (Result.isFailure(decoded)) {
        buffer = pipe(buffer, Str.slice(position));
        return Result.fail(decoded.failure);
      }
      A.appendInPlace(batches, decoded.success);
    }
    buffer = pipe(buffer, Str.slice(position));
    if (exceeds(Str.length(buffer))) {
      return failBufferSize();
    }
    return Result.succeed(A.flatten(batches));
  };
};
