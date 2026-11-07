/** Upstream typed XML RPC over the existing one-job bounded transport.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import {
  citationNativeRpcExit,
  citationNativeRpcFailure,
  makeCitationNativeRpcClient,
  receiveCitationNativeConversation,
} from "./NativeRpc.ts";
import { CitationNativeWasmStartup } from "./NativeWasm.ts";
import {
  CitationXmlWorkerFailure,
  CitationXmlWorkerJob,
  CitationXmlWorkerReply,
  decodeCitationXmlReply,
  encodeCitationXmlJob,
  readCitationXmlFrames,
} from "./XmlWorkerProtocol.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const $I = $LawPracticeServerId.create("internal/Citation/XmlWorkerRpc");
/** @internal @category models @since 0.0.0 */
export class CitationXmlWorkerStartup extends S.Opaque<CitationXmlWorkerStartup, { readonly brand: unique symbol }>()(
  S.Struct({ version: S.tag("citation-xml-startup/v1"), ...CitationNativeWasmStartup.fields }).pipe(
    $I.annoteSchema("CitationXmlWorkerStartup", {
      description: "Trusted explicit XML kernel location and complete frame ceiling.",
    })
  )
) {}
/** @internal @category services @since 0.0.0 */
export const CitationXmlRpcs = RpcGroup.make(
  Rpc.make("Balance", {
    payload: CitationXmlWorkerJob,
    success: CitationXmlWorkerReply.cases.Success.fields.balanced,
    error: CitationXmlWorkerReply.cases.Failure.fields.failure,
  })
);
/** @internal @category operations @since 0.0.0 */
export const prepareCitationXmlRpc = Effect.fn("Citation.prepareXmlRpc")(function* (
  job: CitationXmlWorkerJob,
  maximum: number
) {
  const frame = yield* encodeCitationXmlJob(job, maximum);
  return Effect.fn("Citation.callXmlRpc")((child: Pick<ChildProcessHandle, "stdin" | "stdout">) =>
    Effect.scoped(
      Effect.gen(function* () {
        const invalid = () => CitationXmlWorkerFailure.make({ reason: "invalid-frame" });
        const { client, deliver } = yield* makeCitationNativeRpcClient(CitationXmlRpcs, child, frame, () =>
          CitationXmlWorkerFailure.make({ reason: "channel-failed" })
        );
        const errorOf = citationNativeRpcFailure(CitationXmlWorkerReply.guards.Failure);
        const receive = receiveCitationNativeConversation<
          CitationXmlWorkerReply,
          boolean,
          typeof CitationXmlWorkerReply.cases.Failure.fields.failure.Type,
          CitationXmlWorkerFailure | CitationSafetyLimitExceeded
        >({
          read: (onFrame) => readCitationXmlFrames(child.stdout, maximum, 3, onFrame),
          decode: decodeCitationXmlReply,
          isReady: CitationXmlWorkerReply.guards.Ready,
          isStarted: CitationXmlWorkerReply.guards.Started,
          isTerminal: CitationXmlWorkerReply.isAnyOf(["Success", "Failure"]),
          terminal: (reply) =>
            citationNativeRpcExit(
              CitationXmlWorkerReply.guards.Success(reply) ? O.some(reply.balanced) : O.none(),
              errorOf(reply),
              invalid
            ),
          invalid,
        }).pipe(Effect.flatMap(deliver));
        return yield* Effect.zipWith(receive, client.Balance(job), (_received, value) => value, { concurrent: true });
      })
    )
  );
});
