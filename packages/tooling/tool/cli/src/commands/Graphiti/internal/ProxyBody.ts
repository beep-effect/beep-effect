/**
 * Bounded request-body reading and fast-lane MCP classification.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Chunk, Effect, flow, pipe, Ref, Result, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { Headers, HttpMethod } from "effect/unstable/http";
import {
  decodeGraphitiMcpJsonRpcRequest,
  isGraphitiProxyFastMcpMethod,
  isGraphitiProxyFastMcpToolName,
} from "./ProxySchemas.js";
import type { HttpServerRequest } from "effect/unstable/http";
import type { GraphitiMcpJsonRpcRequest } from "./ProxySchemas.js";

const utf8Decoder = new TextDecoder("utf-8");

type RequestBodyOutcome =
  | { readonly _tag: "Body"; readonly bodyBytes: O.Option<Uint8Array> }
  | { readonly _tag: "Oversized"; readonly declaredBytes: O.Option<number> }
  | { readonly _tag: "ReadError"; readonly cause: unknown };

const parseContentLength = (request: HttpServerRequest.HttpServerRequest): O.Option<number> =>
  pipe(
    Headers.get(request.headers, "content-length"),
    O.flatMap((raw) => {
      const parsed = globalThis.Number(pipe(raw, Str.trim));
      return globalThis.Number.isInteger(parsed) && parsed >= 0 ? O.some(parsed) : O.none<number>();
    })
  );

// Concatenate the bounded set of collected chunks into a single contiguous
// buffer. Only invoked once the running total is known to be within the cap, so
// the destination allocation is bounded by `maxBodyBytes`.
const concatChunkedBody = (chunks: Chunk.Chunk<Uint8Array>, totalBytes: number): Uint8Array => {
  const collected = Chunk.toReadonlyArray(chunks);
  const buffer = new Uint8Array(totalBytes);
  const writeChunk = (offset: number, chunk: Uint8Array): number => {
    buffer.set(chunk, offset);
    return offset + chunk.length;
  };
  A.reduce(collected, 0, writeChunk);
  return buffer;
};

/**
 * Read a proxy request body without exceeding the configured byte cap.
 *
 * @example
 * ```ts
 * import { readRequestBodyBytes } from "@beep/repo-cli/commands/Graphiti/internal/ProxyBody"
 * import { Effect } from "effect"
 * import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
 *
 * // Read the current request body inside an HTTP handler, capped at 1 KiB.
 * const program = Effect.gen(function* () {
 *   const request = yield* HttpServerRequest.HttpServerRequest
 *   return yield* readRequestBodyBytes(request, 1024)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category streams
 * @since 0.0.0
 */
export const readRequestBodyBytes: {
  (request: HttpServerRequest.HttpServerRequest, maxBodyBytes: number): Effect.Effect<RequestBodyOutcome>;
  (maxBodyBytes: number): (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<RequestBodyOutcome>;
} = dual(
  2,
  Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest, maxBodyBytes: number) {
    const method = HttpMethod.isHttpMethod(request.method) ? request.method : "GET";
    if (!HttpMethod.hasBody(method)) {
      return { _tag: "Body", bodyBytes: O.none<Uint8Array>() };
    }

    // Fail closed on an advertised Content-Length before buffering any bytes.
    const declaredBytes = parseContentLength(request);
    if (O.exists(declaredBytes, (length) => length > maxBodyBytes)) {
      return { _tag: "Oversized", declaredBytes };
    }

    // Bounded streaming read: track a running total as chunks arrive and stop the
    // stream as soon as the total crosses the cap. A client that omits or
    // understates Content-Length (chunked upload) can no longer force the proxy to
    // buffer the whole body before the size check runs; `takeUntil` keeps only the
    // chunk that pushes past the cap and then halts, so peak memory stays bounded
    // to ~maxBodyBytes plus a single trailing chunk.
    const chunksRef = yield* Ref.make(Chunk.empty<Uint8Array>());
    const totalRef = yield* Ref.make(0);

    const boundedBody = request.stream.pipe(
      Stream.mapAccum(
        () => 0,
        (runningTotal, chunk): readonly [number, ReadonlyArray<readonly [Uint8Array, number]>] => {
          const nextTotal = runningTotal + chunk.length;
          return [nextTotal, [[chunk, nextTotal]]];
        }
      ),
      Stream.takeUntil(([, runningTotal]) => runningTotal > maxBodyBytes)
    );

    const drainResult = yield* boundedBody.pipe(
      Stream.runForEach(
        Effect.fnUntraced(function* ([chunk, runningTotal]) {
          yield* Ref.update(chunksRef, (chunks) => Chunk.append(chunks, chunk));
          yield* Ref.set(totalRef, runningTotal);
        })
      ),
      Effect.result
    );

    if (Result.isFailure(drainResult)) {
      return { _tag: "ReadError", cause: drainResult.failure };
    }

    const total = yield* Ref.get(totalRef);
    if (total > maxBodyBytes) {
      // Drop the collected chunks so the oversized body is not retained.
      yield* Ref.set(chunksRef, Chunk.empty<Uint8Array>());
      return { _tag: "Oversized", declaredBytes };
    }

    const chunks = yield* Ref.get(chunksRef);
    return { _tag: "Body", bodyBytes: O.some(concatChunkedBody(chunks, total)) };
  })
);

/**
 * Tagged outcome of a bounded request-body read for testing assertions.
 *
 * @category testing
 * @since 0.0.0
 */
export type RequestBodyOutcomeForTesting = RequestBodyOutcome;

/**
 * Read a request body under the configured cap using a bounded streaming read.
 *
 * Exposed for tests: a client that omits or understates `Content-Length`
 * (chunked upload) is rejected as `Oversized` without buffering the entire body,
 * so peak memory stays bounded to roughly `maxBodyBytes` plus one trailing
 * chunk.
 *
 * @param request - Inbound proxied HTTP request.
 * @param maxBodyBytes - Maximum allowed body size in bytes.
 * @returns Effect producing the bounded request-body outcome.
 * @example
 * ```ts
 * console.log("readRequestBodyBytesForTesting")
 * ```
 * @category testing
 * @since 0.0.0
 */
export const readRequestBodyBytesForTesting: (
  request: HttpServerRequest.HttpServerRequest,
  maxBodyBytes: number
) => Effect.Effect<RequestBodyOutcome> = readRequestBodyBytes;

const isFastMcpRequestEnvelope = (envelope: GraphitiMcpJsonRpcRequest): boolean =>
  isGraphitiProxyFastMcpMethod(envelope.method) ||
  pipe(
    O.fromUndefinedOr(envelope.params),
    O.flatMap((params) => O.fromUndefinedOr(params.name)),
    O.exists(isGraphitiProxyFastMcpToolName)
  );

/**
 * Determine whether an MCP request body is cheap enough to bypass the serialized memory-work queue.
 *
 * @param bodyBytes - Optional UTF-8 JSON-RPC request body bytes.
 * @returns Whether the request can use the fast proxy lane.
 * @example
 * ```ts
 * import { isFastMcpRequestBody } from "@beep/repo-cli/commands/Graphiti/internal/ProxyServices"
 * import * as O from "effect/Option"
 *
 * console.log(isFastMcpRequestBody(O.none()))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const isFastMcpRequestBody: (bodyBytes: O.Option<Uint8Array>) => boolean = flow(
  O.match({
    onNone: () => true,
    onSome: (bytes) =>
      pipe(utf8Decoder.decode(bytes), decodeGraphitiMcpJsonRpcRequest, O.exists(isFastMcpRequestEnvelope)),
  })
);
