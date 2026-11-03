/**
 * Effect RPC over the existing bounded, already-decoded HTML conversation.
 * The process owner alone controls deadlines, quarantine and retirement.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as Stream from "effect/Stream";
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
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

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
        const requestId = RpcMessage.RequestId(0);
        const sent = yield* Deferred.make<void>();
        const rpc = yield* RpcClient.makeNoSerialization(CitationHtmlRpcs, {
          supportsAck: false,
          spanPrefix: "Citation.native",
          generateRequestId: () => requestId,
          onFromClient: ({ message }) =>
            message._tag === "Request"
              ? Stream.run(Stream.make(frame), child.stdin).pipe(
                  Effect.tap(() => Deferred.succeed(sent, undefined)),
                  Effect.mapError(() => CitationHtmlWorkerFailure.make({ reason: "channel-failed" }))
                )
              : Effect.void,
        });
        let step = 0;
        let terminal = O.none<CitationHtmlWorkerReply>();
        const receive = readCitationHtmlFrames(
          child.stdout,
          maximum,
          3,
          Effect.fnUntraced(function* (bytes) {
            const message = yield* decodeCitationHtmlReply(bytes);
            if (
              (step === 0 && !CitationHtmlWorkerReply.guards.Ready(message)) ||
              (step === 1 && !CitationHtmlWorkerReply.guards.Started(message)) ||
              (step === 2 && !CitationHtmlWorkerReply.isAnyOf(["Success", "Failure"])(message))
            )
              return yield* invalid();
            if (step === 2) terminal = O.some(message);
            step++;
          })
        ).pipe(
          Effect.andThen(
            Effect.gen(function* () {
              const reply = yield* Effect.fromOption(terminal).pipe(Effect.mapError(invalid));
              if (!CitationHtmlWorkerReply.isAnyOf(["Success", "Failure"])(reply)) return yield* invalid();
              // A complete early reply cannot precede registration of its call
              // or interrupt a still-pending request write.
              yield* Deferred.await(sent);
              yield* rpc.write({
                _tag: "Exit",
                clientId: 0,
                requestId,
                exit: CitationHtmlWorkerReply.guards.Success(reply)
                  ? Exit.succeed(reply.text)
                  : Exit.fail(reply.failure),
              });
            })
          )
        );
        const [, text] = yield* Effect.all([receive, rpc.client.Clean(job)], { concurrency: 2 });
        return text;
      })
    )
  );
});
