/** Looping isolated regex RPC server. Only the parent owns kill deadlines.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { citationNativeRpcRequest, runCitationNativeRpcJob } from "./NativeRpc.ts";
import { CitationRegexResultEnvelope } from "./RegexResult.ts";
import { decodeCitationRegexSessionJob } from "./RegexSessionProtocol.ts";
import {
  CitationRegexSessionComplete,
  CitationRegexSessionFailure,
  CitationRegexSessionReady,
  CitationRegexSessionRpcs,
  CitationRegexSessionStarted,
  decodeCitationRegexSessionStartup,
  encodeCitationRegexSessionReply,
  preflightCitationRegexSessionControls,
} from "./RegexSessionRpc.ts";
import { makeCitationRegexEvaluation } from "./RegexWorkerEvaluation.ts";
import { CitationRegexWorkerFailure, CitationRegexWorkerJob, readCitationRegexFrames } from "./RegexWorkerProtocol.ts";
import { CitationRegexWorkerStartup } from "./RegexWorkerRpc.ts";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import type { CitationRegexSessionReply } from "./RegexSessionRpc.ts";

const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const decodeResult = makeCitationNativeJsonDecoder({
  codec: S.fromJsonString(CitationRegexResultEnvelope),
  propertyCeiling: 5,
  maximumDepth: 1,
  invalid,
});
/** @internal @category programs @since 0.0.0 */
export const citationRegexSessionProgram = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const args = yield* stdio.args;
  const startup = yield* decodeCitationRegexSessionStartup(args);
  const maximum = startup.limits.processMessageBytes;
  yield* preflightCitationRegexSessionControls(maximum);
  const send = Effect.fn("Citation.sendRegexSessionReply")((reply: CitationRegexSessionReply) =>
    encodeCitationRegexSessionReply(reply, maximum).pipe(
      Effect.flatMap((frame) => Stream.run(Stream.make(frame), stdio.stdout({ endOnDone: false }))),
      Effect.catchTag("PlatformError", () => Effect.fail(CitationRegexWorkerFailure.make({ reason: "channel-failed" })))
    )
  );
  yield* send(CitationRegexSessionReady.make({}));
  let sequence = 0;
  yield* readCitationRegexFrames(
    stdio.stdin,
    maximum,
    "continuous",
    Effect.fnUntraced(function* (bytes) {
      const job = yield* decodeCitationRegexSessionJob(bytes);
      if (job.sequence !== sequence) return yield* invalid();
      sequence++;
      yield* send(CitationRegexSessionStarted.make({ sequence: job.sequence }));
      // Re-derive the program against this job's descriptor. No cross-job cache.
      const evaluator = yield* makeCitationRegexEvaluation(
        CitationRegexWorkerStartup.make({ ...startup, engine: job.engine, descriptor: job.descriptor })
      );
      const handlers = yield* CitationRegexSessionRpcs.toHandlers({
        Evaluate: (request) =>
          evaluator
            .evaluate(
              CitationRegexWorkerJob.make({
                patternWidth: request.patternWidth,
                patternBytes: request.patternBytes,
                sourceWidth: request.sourceWidth,
                sourceBytes: request.sourceBytes,
                flags: request.flags,
                maxMatches: request.maxMatches,
                mode: request.mode,
              })
            )
            .pipe(Effect.catchDefect(() => Effect.interrupt)),
      });
      const request = citationNativeRpcRequest<RpcGroup.Rpcs<typeof CitationRegexSessionRpcs>>("Evaluate", job);
      yield* Effect.scoped(
        runCitationNativeRpcJob(
          CitationRegexSessionRpcs,
          { ...request, id: RpcMessage.RequestId(job.sequence) },
          Effect.fnUntraced(function* (exit) {
            if (Exit.isFailure(exit)) {
              const failure = yield* exit.cause.pipe(
                Cause.findErrorOption,
                Effect.fromOption,
                Effect.mapError(invalid)
              );
              return yield* send(CitationRegexSessionFailure.make({ sequence: job.sequence, failure }));
            }
            const result = yield* decodeResult(exit.value);
            yield* send(CitationRegexSessionComplete.make({ ...result, sequence: job.sequence })).pipe(
              Effect.catchTag("CitationSafetyLimitExceeded", (failure) =>
                send(CitationRegexSessionFailure.make({ sequence: job.sequence, failure }))
              )
            );
          })
        ).pipe(Effect.provideContext(handlers))
      );
    })
  );
}).pipe(Effect.withSpan("Citation.regexSessionProgram"));
