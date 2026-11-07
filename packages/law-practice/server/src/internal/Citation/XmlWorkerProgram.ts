/** One XML query through upstream RPC and the shared native conversation.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { citationNativeRpcRequest, runCitationNativeRpcJob } from "./NativeRpc.ts";
import { loadCitationNativeWasmAsset, readCitationNativeWasmStartup } from "./NativeWasm.ts";
import { citationXmlKernelAsset, makeCitationXmlBalanceKernel } from "./XmlBalanceKernel.ts";
import {
  CitationXmlWorkerFailure,
  CitationXmlWorkerReply,
  decodeCitationXmlJob,
  encodeCitationXmlReply,
  readCitationXmlFrames,
} from "./XmlWorkerProtocol.ts";
import { CitationXmlRpcs, CitationXmlWorkerStartup } from "./XmlWorkerRpc.ts";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import type { CitationXmlWorkerJob } from "./XmlWorkerProtocol.ts";
/** @internal @category programs @since 0.0.0 */
export const citationXmlWorkerProgram = Effect.gen(function* () {
  const invalid = () => CitationXmlWorkerFailure.make({ reason: "invalid-frame" });
  const runtime = () => CitationXmlWorkerFailure.make({ reason: "invalid-runtime" });
  const { stdio, startup } = yield* readCitationNativeWasmStartup(S.fromJsonString(CitationXmlWorkerStartup), runtime);
  const asset = yield* loadCitationNativeWasmAsset(startup.assetPath, citationXmlKernelAsset, runtime);
  const kernel = yield* makeCitationXmlBalanceKernel(asset);
  const send = Effect.fn("Citation.sendXmlWorkerReply")((reply: CitationXmlWorkerReply) =>
    encodeCitationXmlReply(reply, startup.maximum).pipe(
      Effect.flatMap((bytes) => Stream.run(Stream.make(bytes), stdio.stdout({ endOnDone: false }))),
      Effect.mapError((error) =>
        error._tag === "CitationSafetyLimitExceeded" || error._tag === "CitationXmlWorkerFailure"
          ? error
          : CitationXmlWorkerFailure.make({ reason: "channel-failed" })
      )
    )
  );
  yield* send(CitationXmlWorkerReply.cases.Ready.make({}));
  let request = O.none<CitationXmlWorkerJob>();
  yield* readCitationXmlFrames(
    stdio.stdin,
    startup.maximum,
    1,
    Effect.fnUntraced(function* (body) {
      const decoded = yield* decodeCitationXmlJob(body);
      request = O.some(decoded);
    })
  );
  const job = yield* Effect.fromOption(request).pipe(Effect.mapError(invalid));
  yield* send(CitationXmlWorkerReply.cases.Started.make({}));
  const handlers = yield* CitationXmlRpcs.toHandlers({
    Balance: (value) =>
      kernel.balance({ width: value.width, bytes: value.bytes }).pipe(Effect.catchDefect(() => Effect.interrupt)),
  });
  yield* runCitationNativeRpcJob(
    CitationXmlRpcs,
    citationNativeRpcRequest<RpcGroup.Rpcs<typeof CitationXmlRpcs>>("Balance", job),
    (exit) => {
      const reply = Exit.isSuccess(exit)
        ? Effect.succeed(CitationXmlWorkerReply.cases.Success.make({ balanced: exit.value }))
        : exit.cause.pipe(
            Cause.findErrorOption,
            Effect.fromOption,
            Effect.mapBoth({
              onSuccess: (failure) => CitationXmlWorkerReply.cases.Failure.make({ failure }),
              onFailure: invalid,
            })
          );
      return reply.pipe(Effect.flatMap(send));
    }
  ).pipe(Effect.provideContext(handlers));
}).pipe(Effect.withSpan("Citation.xmlWorkerProgram"));
