/**
 * Effect RPC over the existing bounded, already-decoded HTML conversation.
 * The process owner alone controls deadlines, quarantine and retirement.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import {
  CitationHtmlWorkerError,
  CitationHtmlWorkerFailure,
  CitationHtmlWorkerJob,
  CitationHtmlWorkerReply,
  CitationHtmlWorkerSuccess,
  decodeCitationHtmlReply,
  encodeCitationHtmlJob,
  readCitationHtmlFrames,
} from "./HtmlWorkerProtocol.ts";
import {
  citationNativeRpcExit,
  citationNativeRpcFailure,
  makeCitationNativeRpcDelivery,
  makeCitationNativeRpcTransport,
  receiveCitationNativeConversation,
} from "./NativeRpc.ts";
import { CitationNativeWasmStartup } from "./NativeWasm.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorkerRpc");
/** Trusted server startup; the asset path never substitutes for digest authentication.
 * @internal @category models @since 0.0.0
 */
export class CitationHtmlWorkerStartup extends S.Opaque<CitationHtmlWorkerStartup, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("citation-html-startup/v1"),
    ...CitationNativeWasmStartup.fields,
  }).pipe(
    $I.annoteSchema("CitationHtmlWorkerStartup", {
      description: "Explicit trusted HTML kernel asset path and complete message ceiling; no ambient configuration.",
    })
  )
) {}

/**
 * Shared procedure contract. The wire boundary owns codecs and pre-allocation
 * checks; RPC receives schema-decoded values without another encoding pass.
 * @internal @category services @since 0.0.0
 */
export const CitationHtmlRpcs = RpcGroup.make(
  Rpc.make("Clean", {
    payload: CitationHtmlWorkerJob,
    success: CitationHtmlWorkerSuccess.fields.text,
    error: CitationHtmlWorkerError.fields.failure,
  })
);
const invalid = () => CitationHtmlWorkerFailure.make({ reason: "invalid-frame" });

/**
 * Encode before spawn, then execute one call per scoped RPC conversation.
 * No messages are retained in an RPC buffer before client startup.
 * A reply is delivered to RPC only after complete framing and EOF validation.
 * Physical retirement remains the enclosing process owner's responsibility.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationHtmlRpc = Effect.fn("Citation.prepareHtmlRpc")(function* (
  job: CitationHtmlWorkerJob,
  maximum: number
) {
  const frame = yield* encodeCitationHtmlJob(job, maximum);
  return Effect.fn("Citation.callHtmlRpc")((child: Pick<ChildProcessHandle, "stdin" | "stdout">) =>
    Effect.scoped(
      Effect.gen(function* () {
        const transport = yield* makeCitationNativeRpcTransport(child, frame, () =>
          CitationHtmlWorkerFailure.make({ reason: "channel-failed" })
        );
        const rpc = yield* RpcClient.makeNoSerialization(CitationHtmlRpcs, transport.options);
        const deliver = makeCitationNativeRpcDelivery({
          sent: transport.sent,
          write: rpc.write,
          requestId: transport.requestId,
        });
        const errorOf = citationNativeRpcFailure(CitationHtmlWorkerReply.guards.Failure);
        const receive = receiveCitationNativeConversation<
          CitationHtmlWorkerReply,
          string,
          typeof CitationHtmlWorkerError.fields.failure.Type,
          CitationHtmlWorkerFailure | CitationSafetyLimitExceeded
        >({
          read: (onFrame) => readCitationHtmlFrames(child.stdout, maximum, 3, onFrame),
          decode: decodeCitationHtmlReply,
          isReady: CitationHtmlWorkerReply.guards.Ready,
          isStarted: CitationHtmlWorkerReply.guards.Started,
          isTerminal: CitationHtmlWorkerReply.isAnyOf(["Success", "Failure"]),
          terminal: (reply) =>
            citationNativeRpcExit(
              CitationHtmlWorkerReply.guards.Success(reply) ? O.some(reply.text) : O.none(),
              errorOf(reply),
              invalid
            ),
          invalid,
        }).pipe(Effect.flatMap(deliver));
        return yield* Effect.zipWith(receive, rpc.client.Clean(job), (_received, value) => value, { concurrent: true });
      })
    )
  );
});
