/** One-job default-diff child. The parent owns timing and physical retirement.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { citationDiffKernelAsset, makeCitationDiffKernel } from "./DiffKernel.ts";
import { packCitationDiffSteps } from "./DiffSteps.ts";
import {
  CitationDiffWorkerError,
  CitationDiffWorkerFailure,
  CitationDiffWorkerReady,
  CitationDiffWorkerStarted,
  CitationDiffWorkerSuccess,
  citationDiffOutputByteCapacity,
  decodeCitationDiffJob,
  encodeCitationDiffReply,
  preflightCitationDiffControlFrames,
  readCitationDiffFrames,
} from "./DiffWorkerProtocol.ts";
import { CitationDiffRpcs, CitationDiffWorkerStartup } from "./DiffWorkerRpc.ts";
import { citationNativeRpcRequest, runCitationNativeRpcJob } from "./NativeRpc.ts";
import { loadCitationNativeWasmAsset, readCitationNativeWasmStartup } from "./NativeWasm.ts";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import type { CitationDiffWorkerJob, CitationDiffWorkerReply } from "./DiffWorkerProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DiffWorkerProgram");
const badRuntime = () => CitationDiffWorkerFailure.make({ reason: "invalid-runtime" });
const badFrame = () => CitationDiffWorkerFailure.make({ reason: "invalid-frame" });
const WorkerStartupJson = S.fromJsonString(CitationDiffWorkerStartup).pipe(
  $I.annoteSchema("WorkerStartupJson", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
/** Execute one complete request via the upstream RPC server and pinned host.
 * Kernel output is bounded to the exact success-frame capacity before packed
 * output allocation. No native/codec defect becomes a source-bearing failure.
 * @internal @category programs @since 0.0.0
 */
export const citationDiffWorkerProgram = Effect.gen(function* () {
  const { stdio, startup } = yield* readCitationNativeWasmStartup(WorkerStartupJson, badRuntime);
  const maximum = startup.maximum;
  yield* preflightCitationDiffControlFrames(maximum);
  const maximumOutputBytes = yield* citationDiffOutputByteCapacity(maximum);
  const asset = yield* loadCitationNativeWasmAsset(startup.assetPath, citationDiffKernelAsset, badRuntime);
  const kernel = yield* makeCitationDiffKernel(asset);
  const send = Effect.fn("Citation.sendDiffWorkerReply")((reply: CitationDiffWorkerReply) =>
    encodeCitationDiffReply(reply, maximum).pipe(
      Effect.flatMap((bytes) => Stream.run(Stream.make(bytes), stdio.stdout({ endOnDone: false }))),
      Effect.mapError((error) =>
        error._tag === "CitationSafetyLimitExceeded" || error._tag === "CitationDiffWorkerFailure"
          ? error
          : CitationDiffWorkerFailure.make({ reason: "channel-failed" })
      )
    )
  );
  yield* send(CitationDiffWorkerReady.make({}));
  let request = O.none<CitationDiffWorkerJob>();
  yield* readCitationDiffFrames(
    stdio.stdin,
    maximum,
    1,
    Effect.fnUntraced(function* (body) {
      const job = yield* decodeCitationDiffJob(body);
      request = O.some(job);
    })
  );
  const job = yield* Effect.fromOption(request).pipe(Effect.mapError(badFrame));
  yield* send(CitationDiffWorkerStarted.make({}));
  const handlers = yield* CitationDiffRpcs.toHandlers({
    Diff: (job) =>
      kernel
        .run({
          before: { width: job.beforeWidth, bytes: job.beforeBytes },
          after: { width: job.afterWidth, bytes: job.afterBytes },
          maximumSteps: job.maximumSteps,
          maximumInputUtf16: job.maximumInputUtf16,
          maximumOutputBytes,
        })
        .pipe(
          Effect.flatMap((steps) => packCitationDiffSteps(steps, maximum)),
          Effect.catchTag("CitationDiffWorkerFailure", () => Effect.interrupt),
          Effect.catchDefect(() => Effect.interrupt)
        ),
  });
  yield* runCitationNativeRpcJob(
    CitationDiffRpcs,
    citationNativeRpcRequest<RpcGroup.Rpcs<typeof CitationDiffRpcs>>("Diff", job),
    (exit) => {
      const reply = Exit.isSuccess(exit)
        ? Effect.succeed(CitationDiffWorkerSuccess.make({ steps: exit.value }))
        : exit.cause.pipe(
            Cause.findErrorOption,
            Effect.fromOption,
            Effect.mapBoth({ onSuccess: (failure) => CitationDiffWorkerError.make({ failure }), onFailure: badFrame })
          );
      return reply.pipe(
        Effect.flatMap(send),
        Effect.catchTag("CitationSafetyLimitExceeded", (failure) => send(CitationDiffWorkerError.make({ failure })))
      );
    }
  ).pipe(Effect.provideContext(handlers));
}).pipe(Effect.withSpan("Citation.diffWorkerProgram"));
