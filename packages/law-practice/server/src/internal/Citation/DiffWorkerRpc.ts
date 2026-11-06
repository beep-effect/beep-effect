/** Typed Effect RPC over the shared bounded one-job native conversation.
 * Physical retirement and deadlines remain the existing process owner's duty.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import {
  CitationDiffWorkerError,
  CitationDiffWorkerFailure,
  CitationDiffWorkerJob,
  CitationDiffWorkerReply,
  CitationDiffWorkerSuccess,
  decodeCitationDiffReply,
  readCitationDiffFrames,
} from "./DiffWorkerProtocol.ts";
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

const $I = $LawPracticeServerId.create("internal/Citation/DiffWorkerRpc");
/** Trusted server startup, separate from the native-text request. The asset
 * path conveys no authority to choose kernel code: its complete digest is pinned.
 * @internal @category models @since 0.0.0
 */
export class CitationDiffWorkerStartup extends S.Opaque<CitationDiffWorkerStartup, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("citation-diff-startup/v1"),
    ...CitationNativeWasmStartup.fields,
  }).pipe(
    $I.annoteSchema("CitationDiffWorkerStartup", {
      description: "Explicit trusted runtime asset path and complete message ceiling; no ambient configuration.",
    })
  )
) {}
/** @internal @category operations @since 0.0.0 */
const WorkerStartupJson = S.fromJsonString(CitationDiffWorkerStartup).pipe(
  $I.annoteSchema("WorkerStartupJson", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
export const encodeCitationDiffStartup = Effect.fn("Citation.encodeDiffStartup")((startup: CitationDiffWorkerStartup) =>
  S.encodeEffect(WorkerStartupJson)(startup).pipe(
    Effect.mapError(() => CitationDiffWorkerFailure.make({ reason: "invalid-runtime" }))
  )
);

/** @internal @category services @since 0.0.0 */
export const CitationDiffRpcs = RpcGroup.make(
  Rpc.make("Diff", {
    payload: CitationDiffWorkerJob,
    success: CitationDiffWorkerSuccess.fields.steps,
    error: CitationDiffWorkerError.fields.failure,
  })
);
const invalid = () => CitationDiffWorkerFailure.make({ reason: "invalid-frame" });
/** Call upstream RPC after full request preflight/encoding. Terminal delivery
 * waits for exact framing, EOF and the registered request's write acknowledgement.
 * @internal @category operations @since 0.0.0
 */
export const callCitationDiffRpc = Effect.fn("Citation.callDiffRpc")(
  (
    child: Pick<ChildProcessHandle, "stdin" | "stdout">,
    job: CitationDiffWorkerJob,
    frame: Uint8Array,
    maximum: number
  ) =>
    Effect.scoped(
      Effect.gen(function* () {
        const transport = yield* makeCitationNativeRpcTransport(child, frame, () =>
          CitationDiffWorkerFailure.make({ reason: "channel-failed" })
        );
        const rpc = yield* RpcClient.makeNoSerialization(CitationDiffRpcs, transport.options);
        const deliver = makeCitationNativeRpcDelivery({
          sent: transport.sent,
          write: rpc.write,
          requestId: transport.requestId,
        });
        const errorOf = citationNativeRpcFailure(CitationDiffWorkerReply.guards.Failure);
        const receive = receiveCitationNativeConversation<
          CitationDiffWorkerReply,
          Uint8Array,
          typeof CitationDiffWorkerError.fields.failure.Type,
          CitationDiffWorkerFailure | CitationSafetyLimitExceeded
        >({
          read: (onFrame) => readCitationDiffFrames(child.stdout, maximum, 3, onFrame),
          decode: decodeCitationDiffReply,
          isReady: CitationDiffWorkerReply.guards.Ready,
          isStarted: CitationDiffWorkerReply.guards.Started,
          isTerminal: CitationDiffWorkerReply.isAnyOf(["Success", "Failure"]),
          terminal: (reply) =>
            citationNativeRpcExit(
              CitationDiffWorkerReply.guards.Success(reply) ? O.some(reply.steps) : O.none(),
              errorOf(reply),
              invalid
            ),
          invalid,
        }).pipe(Effect.flatMap(deliver));
        return yield* Effect.zipWith(receive, rpc.client.Diff(job), (_received, value) => value, { concurrent: true });
      })
    )
);
