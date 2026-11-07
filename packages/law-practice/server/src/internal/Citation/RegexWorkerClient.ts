/** One scoped Effect RPC conversation over bounded native frames.
 * @internal @packageDocumentation @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as RpcClient from "effect/rpc/RpcClient";
import {
  citationNativeRpcExit,
  citationNativeRpcFailure,
  makeCitationNativeRpcDelivery,
  makeCitationNativeRpcTransport,
  receiveCitationNativeConversation,
} from "./NativeRpc.ts";
import { CitationRegexWorkerFailure, readCitationRegexFrames } from "./RegexWorkerProtocol.ts";
import { CitationRegexRpcs, CitationRegexWorkerReply, decodeCitationRegexReply } from "./RegexWorkerRpc.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type { CitationRegexWorkerJob } from "./RegexWorkerProtocol.ts";
import type { CitationRegexExecutionFailure } from "./RegexWorkerRpc.ts";

const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
/** Terminal delivery waits for framing, EOF and request write. Physical child
 * retirement remains the enclosing owner's responsibility.
 * @internal @category operations @since 0.0.0
 */
export const callCitationRegexRpc = Effect.fn("Citation.callRegexRpc")(
  (
    child: Pick<ChildProcessHandle, "stdin" | "stdout">,
    job: CitationRegexWorkerJob,
    frame: Uint8Array,
    maximum: number
  ) =>
    Effect.scoped(
      Effect.gen(function* () {
        const transport = yield* makeCitationNativeRpcTransport(child, frame, () =>
          CitationRegexWorkerFailure.make({ reason: "channel-failed" })
        );
        const rpc = yield* RpcClient.makeNoSerialization(CitationRegexRpcs, transport.options);
        const deliver = makeCitationNativeRpcDelivery({
          sent: transport.sent,
          write: rpc.write,
          requestId: transport.requestId,
        });
        const errorOf = citationNativeRpcFailure(CitationRegexWorkerReply.guards.Failure);
        const receive = receiveCitationNativeConversation<
          typeof CitationRegexWorkerReply.Type,
          Uint8Array,
          CitationRegexExecutionFailure,
          CitationRegexWorkerFailure | CitationSafetyLimitExceeded
        >({
          read: (onFrame) => readCitationRegexFrames(child.stdout, maximum, 3, onFrame),
          decode: decodeCitationRegexReply,
          isReady: CitationRegexWorkerReply.guards.Ready,
          isStarted: CitationRegexWorkerReply.guards.Started,
          isTerminal: CitationRegexWorkerReply.isAnyOf(["Complete", "Failure"]),
          terminal: (reply, body) =>
            citationNativeRpcExit(
              CitationRegexWorkerReply.guards.Complete(reply) ? O.some(body) : O.none(),
              errorOf(reply),
              invalid
            ),
          invalid,
        }).pipe(Effect.flatMap(deliver));
        return yield* Effect.zipWith(receive, rpc.client.Evaluate(job), (_received, value) => value, {
          concurrent: true,
        });
      })
    )
);
