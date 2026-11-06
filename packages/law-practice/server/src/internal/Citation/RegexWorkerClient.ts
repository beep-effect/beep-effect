/** One scoped Effect RPC conversation over bounded native frames.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as RpcClient from "effect/rpc/RpcClient";
import { makeCitationNativeRpcTransport } from "./NativeRpc.ts";
import { CitationRegexWorkerFailure, readCitationRegexFrames } from "./RegexWorkerProtocol.ts";
import { CitationRegexRpcs, CitationRegexWorkerReply, decodeCitationRegexReply } from "./RegexWorkerRpc.ts";
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
        const requestId = transport.requestId;
        const rpc = yield* RpcClient.makeNoSerialization(CitationRegexRpcs, transport.options);
        let step = 0;
        let candidate = O.none<Exit.Exit<Uint8Array, CitationRegexExecutionFailure>>();
        const receive = readCitationRegexFrames(
          child.stdout,
          maximum,
          3,
          Effect.fnUntraced(function* (body) {
            const message = yield* decodeCitationRegexReply(body);
            if (
              (step === 0 && !CitationRegexWorkerReply.guards.Ready(message)) ||
              (step === 1 && !CitationRegexWorkerReply.guards.Started(message)) ||
              (step === 2 && !CitationRegexWorkerReply.isAnyOf(["Complete", "Failure"])(message))
            )
              return yield* invalid();
            if (CitationRegexWorkerReply.guards.Complete(message)) candidate = O.some(Exit.succeed(body));
            if (CitationRegexWorkerReply.guards.Failure(message)) {
              const exit = Exit.fail(message.failure);
              candidate = O.some(exit);
            }
            step++;
          })
        ).pipe(
          Effect.andThen(
            Effect.gen(function* () {
              const exit = yield* Effect.fromOption(candidate).pipe(Effect.mapError(invalid));
              yield* transport.sent;
              yield* rpc.write({ _tag: "Exit", clientId: 0, requestId, exit });
            })
          )
        );
        const [, body] = yield* Effect.all([receive, rpc.client.Evaluate(job)], { concurrency: 2 });
        return body;
      })
    )
);
