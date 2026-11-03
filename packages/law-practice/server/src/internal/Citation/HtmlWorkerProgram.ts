/**
 * One-job HTML process program. Read and emit only bounded schema messages;
 * load only the bundled authenticated kernel. The parent owns all deadlines.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Headers from "effect/http/Headers";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcServer from "effect/rpc/RpcServer";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { CitationHtmlInput } from "./HtmlInput.ts";
import { makeCitationHtmlKernel } from "./HtmlKernel.ts";
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
import { CitationHtmlRpcs } from "./HtmlWorkerRpc.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { CitationHtmlWorkerJob, CitationHtmlWorkerReply } from "./HtmlWorkerProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorkerProgram");
const Args = S.Tuple([
  S.FiniteFromString.pipe(
    S.decodeTo(
      S.Int.check(S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.processMessageBytes))
    )
  ),
]).pipe(
  $I.annoteSchema("Args", {
    description: "Single explicit effective message ceiling; no ambient configuration is read.",
  })
);
const badRuntime = () => CitationHtmlWorkerFailure.make({ reason: "invalid-runtime" });
const badFrame = () => CitationHtmlWorkerFailure.make({ reason: "invalid-frame" });
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
  const [maximum] = yield* S.decodeUnknownEffect(Args)(yield* stdio.args).pipe(Effect.mapError(badRuntime));
  yield* preflightCitationHtmlControlFrames(maximum);
  const fs = yield* FileSystem.FileSystem;
  const assetPath = yield* (yield* Path.Path)
    .fromFileUrl(new URL("../../../assets/citation-html/kernel.wasm", import.meta.url))
    .pipe(Effect.mapError(badRuntime));
  const chunks = yield* Stream.runCollect(fs.stream(assetPath, { bytesToRead: 1753105 })).pipe(
    Effect.mapError(badRuntime)
  );
  const length = A.reduce(chunks, 0, (size, bytes) => size + bytes.byteLength);
  if (length !== 1753104) return yield* badRuntime();
  const asset = Bytes.concat(chunks);
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
      request = O.some(yield* decodeCitationHtmlJob(bytes));
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
  const server = yield* RpcServer.makeNoSerialization(CitationHtmlRpcs, {
    concurrency: 1,
    disableClientAcks: true,
    disableSpanPropagation: true,
    spanPrefix: "Citation.native",
    onFromServer: (response) => {
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
    },
  }).pipe(Effect.provideContext(handlers));
  yield* server.write(0, {
    _tag: "Request",
    id: RpcMessage.RequestId(0),
    tag: "Clean",
    payload: job,
    headers: Headers.empty,
  });
  yield* Deferred.await(completed);
}).pipe(Effect.withSpan("Citation.htmlWorkerProgram"));
