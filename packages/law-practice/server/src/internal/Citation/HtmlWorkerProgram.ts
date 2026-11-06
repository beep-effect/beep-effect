/**
 * One-job HTML process program. Read and emit only bounded schema messages;
 * load only the bundled authenticated kernel. The parent owns all deadlines.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { CitationHtmlInput } from "./HtmlInput.ts";
import { citationHtmlKernelAsset, makeCitationHtmlKernel } from "./HtmlKernel.ts";
import {
  CitationHtmlWorkerError,
  CitationHtmlWorkerFailure,
  CitationHtmlWorkerReady,
  CitationHtmlWorkerStarted,
  CitationHtmlWorkerSuccess,
  decodeCitationHtmlJob,
  encodeCitationHtmlReply,
  preflightCitationHtmlControlFrames,
  readCitationHtmlFrames,
} from "./HtmlWorkerProtocol.ts";
import { CitationHtmlRpcs, CitationHtmlWorkerStartup } from "./HtmlWorkerRpc.ts";
import { citationNativeRpcRequest, makeCitationNativeRpcServer } from "./NativeRpc.ts";
import { loadCitationNativeWasmAsset } from "./NativeWasm.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import type { CitationHtmlWorkerJob, CitationHtmlWorkerReply } from "./HtmlWorkerProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorkerProgram");
const badRuntime = () => CitationHtmlWorkerFailure.make({ reason: "invalid-runtime" });
const badFrame = () => CitationHtmlWorkerFailure.make({ reason: "invalid-frame" });
const WorkerArguments = S.Tuple([S.String.check(S.isMaxLength(32768))]).pipe(
  $I.annoteSchema("WorkerArguments", { description: "Captured static boundary codec for bounded citation processing." })
);
const WorkerStartupJson = S.fromJsonString(CitationHtmlWorkerStartup).pipe(
  $I.annoteSchema("WorkerStartupJson", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
/**
 * Execute exactly one framed native request. Scope exit closes standard output
 * through the runtime; no successful reply authorizes parent slot reuse before
 * the parent independently confirms process cleanup.
 * @internal
 * @category programs
 * @since 0.0.0
 */
export const citationHtmlWorkerProgram = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  const citationResult1 = yield* stdio.args;
  const [argument] = yield* S.decodeUnknownEffect(WorkerArguments)(citationResult1).pipe(Effect.mapError(badRuntime));
  const startup = yield* S.decodeEffect(WorkerStartupJson, { onExcessProperty: "error" })(argument).pipe(
    Effect.mapError(badRuntime)
  );
  const maximum = startup.maximum;
  yield* preflightCitationHtmlControlFrames(maximum);
  const asset = yield* loadCitationNativeWasmAsset(startup.assetPath, citationHtmlKernelAsset, badRuntime);
  const kernel = yield* makeCitationHtmlKernel(asset);
  const send = Effect.fn("Citation.sendHtmlWorkerReply")((reply: CitationHtmlWorkerReply) =>
    encodeCitationHtmlReply(reply, maximum).pipe(
      Effect.flatMap((bytes) => Stream.run(Stream.make(bytes), stdio.stdout({ endOnDone: false }))),
      Effect.mapError((error) =>
        error._tag === "CitationSafetyLimitExceeded" || error._tag === "CitationHtmlWorkerFailure"
          ? error
          : CitationHtmlWorkerFailure.make({ reason: "channel-failed" })
      )
    )
  );
  yield* send(CitationHtmlWorkerReady.make({}));
  let request = O.none<CitationHtmlWorkerJob>();
  yield* readCitationHtmlFrames(
    stdio.stdin,
    maximum,
    1,
    Effect.fnUntraced(function* (bytes) {
      const citationResult3 = yield* decodeCitationHtmlJob(bytes);
      request = O.some(citationResult3);
    })
  );
  const job = yield* Effect.fromOption(request).pipe(Effect.mapError(badFrame));
  yield* send(CitationHtmlWorkerStarted.make({}));
  const handlers = yield* CitationHtmlRpcs.toHandlers({
    Clean: (job) =>
      kernel
        .run({
          input: CitationHtmlInput.make({ encoding: job.encoding, bytes: job.bytes, fullHtml: job.fullHtml }),
          outputUtf16: job.outputUtf16,
        })
        .pipe(Effect.catchDefect(() => Effect.interrupt)),
  });
  const completed = yield* Deferred.make<void, CitationHtmlWorkerFailure | CitationSafetyLimitExceeded>();
  const onFromServer = (response: RpcMessage.FromServer<RpcGroup.Rpcs<typeof CitationHtmlRpcs>>) => {
    if (response._tag !== "Exit") return Effect.void;
    const reply = Exit.isSuccess(response.exit)
      ? Effect.succeed(CitationHtmlWorkerSuccess.make({ text: response.exit.value }))
      : response.exit.cause.pipe(
          Cause.findErrorOption,
          Effect.fromOption,
          Effect.mapBoth({ onSuccess: (failure) => CitationHtmlWorkerError.make({ failure }), onFailure: badFrame })
        );
    return Deferred.complete(
      completed,
      reply.pipe(
        Effect.flatMap(send),
        Effect.catchTag("CitationSafetyLimitExceeded", (failure) => send(CitationHtmlWorkerError.make({ failure })))
      )
    ).pipe(Effect.asVoid);
  };
  const server = yield* makeCitationNativeRpcServer(CitationHtmlRpcs, onFromServer).pipe(
    Effect.provideContext(handlers)
  );
  yield* server.write(0, citationNativeRpcRequest<RpcGroup.Rpcs<typeof CitationHtmlRpcs>>("Clean", job));
  yield* Deferred.await(completed);
}).pipe(Effect.withSpan("Citation.htmlWorkerProgram"));
