/** One-job isolated regex RPC server. Parent owns deadlines and retirement.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { citationNativeRpcRequest, makeCitationNativeRpcServer } from "./NativeRpc.ts";
import { makeCitationRegexEvaluation } from "./RegexWorkerEvaluation.ts";
import { CitationRegexWorkerFailure, decodeCitationRegexJob, readCitationRegexFrames } from "./RegexWorkerProtocol.ts";
import {
  CitationRegexRpcs,
  CitationRegexWorkerError,
  CitationRegexWorkerReady,
  CitationRegexWorkerStarted,
  decodeCitationRegexStartup,
  encodeCitationRegexControl,
  preflightCitationRegexControlFrames,
} from "./RegexWorkerRpc.ts";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import type { CitationRegexWorkerJob } from "./RegexWorkerProtocol.ts";
import type { CitationRegexExecutionFailure } from "./RegexWorkerRpc.ts";

const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
/** @internal @category programs @since 0.0.0 */
export const citationRegexWorkerProgram = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const citationResult1 = yield* stdio.args;
  const startup = yield* decodeCitationRegexStartup(citationResult1);
  const maximum = startup.limits.processMessageBytes;
  yield* preflightCitationRegexControlFrames(maximum);
  const evaluator = yield* makeCitationRegexEvaluation(startup);
  const sendControl = Effect.fn("Citation.sendRegexControl")(
    (control: CitationRegexWorkerReady | CitationRegexWorkerStarted | CitationRegexWorkerError) =>
      encodeCitationRegexControl(control, maximum).pipe(
        Effect.flatMap((frame) => Stream.run(Stream.make(frame), stdio.stdout({ endOnDone: false }))),
        Effect.mapError((error) =>
          error._tag === "PlatformError" ? CitationRegexWorkerFailure.make({ reason: "channel-failed" }) : error
        )
      )
  );
  yield* sendControl(CitationRegexWorkerReady.make({}));
  let request = O.none<CitationRegexWorkerJob>();
  yield* readCitationRegexFrames(
    stdio.stdin,
    maximum,
    1,
    Effect.fnUntraced(function* (body) {
      const citationResult2 = yield* decodeCitationRegexJob(body);
      request = O.some(citationResult2);
    })
  );
  const job = yield* Effect.fromOption(request).pipe(Effect.mapError(invalid));
  yield* sendControl(CitationRegexWorkerStarted.make({}));
  const handlers = yield* CitationRegexRpcs.toHandlers({
    Evaluate: (job) => evaluator.evaluate(job).pipe(Effect.catchDefect(() => Effect.interrupt)),
  });
  const completed = yield* Deferred.make<void, CitationRegexExecutionFailure>();
  const onFromServer = (response: RpcMessage.FromServer<RpcGroup.Rpcs<typeof CitationRegexRpcs>>) => {
    if (response._tag !== "Exit") return Effect.void;
    const send = Exit.isSuccess(response.exit)
      ? Stream.run(Stream.make(response.exit.value, new Uint8Array([10])), stdio.stdout({ endOnDone: false })).pipe(
          Effect.mapError(() => CitationRegexWorkerFailure.make({ reason: "channel-failed" }))
        )
      : response.exit.cause.pipe(
          Cause.findErrorOption,
          Effect.fromOption,
          Effect.mapError(invalid),
          Effect.flatMap((failure) => sendControl(CitationRegexWorkerError.make({ failure })))
        );
    return Deferred.complete(
      completed,
      send.pipe(
        Effect.catchTag("CitationSafetyLimitExceeded", (failure) =>
          sendControl(CitationRegexWorkerError.make({ failure }))
        )
      )
    ).pipe(Effect.asVoid);
  };
  const server = yield* makeCitationNativeRpcServer(CitationRegexRpcs, onFromServer).pipe(
    Effect.provideContext(handlers)
  );
  yield* server.write(0, citationNativeRpcRequest<RpcGroup.Rpcs<typeof CitationRegexRpcs>>("Evaluate", job));
  yield* Deferred.await(completed);
}).pipe(Effect.withSpan("Citation.regexWorkerProgram"));
