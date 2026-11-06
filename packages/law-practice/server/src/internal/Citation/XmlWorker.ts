/** Captured XML worker using the existing markup process owner and typed RPC.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { makeCitationMarkupWorker } from "./MarkupWorker.ts";
import { prepareCitationNativeRuntime } from "./NativeProcess.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { captureCitationTextReservation } from "./TextBudget.ts";
import { CitationXmlKernelFailure } from "./XmlBalanceKernel.ts";
import {
  CitationXmlWorkerFailure,
  CitationXmlWorkerJob,
  CitationXmlWorkerReply,
  encodeCitationXmlReply,
  preflightCitationXmlJob,
} from "./XmlWorkerProtocol.ts";
import { CitationXmlWorkerStartup, prepareCitationXmlRpc } from "./XmlWorkerRpc.ts";
import type { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/XmlWorker");
/** Capture per-operation text authority, policy, native lifetime and explicit
 * runtime. Inputs are immutable adapter-owned native values through preflight;
 * raw callers must first use their owning source adapter. The returned method
 * has R=never and never publishes a reply before acknowledged physical exit.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationXmlWorker = Effect.fn("Citation.makeXmlWorker")(function* (
  policy: unknown,
  runtimeInput: unknown
) {
  const failure = (reason: CitationXmlWorkerFailure["reason"]) => CitationXmlWorkerFailure.make({ reason });
  const invalid = () => failure("invalid-runtime");
  const { limits, runtime } = yield* prepareCitationNativeRuntime(policy, runtimeInput, invalid);
  const path = yield* Path.Path;
  const assetPath = yield* path
    .fromFileUrl(new URL("../../../assets/citation-xml/kernel.wasm", import.meta.url))
    .pipe(Effect.mapError(invalid));
  const argument = yield* S.encodeEffect(S.fromJsonString(CitationXmlWorkerStartup))(
    CitationXmlWorkerStartup.make({ maximum: limits.processMessageBytes, assetPath })
  ).pipe(Effect.mapError(invalid));
  const owner = yield* makeCitationMarkupWorker(limits, runtime, argument, "annotate", failure);
  const unicode = yield* makeCitationPythonUnicode({ ...limits, producedTextUtf16: limits.sourceUtf16 }, "annotate");
  const reserve = yield* captureCitationTextReservation;
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    CitationSafetyLimitExceeded.make({ operation: "annotate", limit });
  const balance = Effect.fn("Citation.balanceXmlInWorker")((source: CitationPythonUnicodeStorage) =>
    owner.run(
      Effect.gen(function* () {
        yield* preflightCitationXmlJob(source.width, source.bytes.byteLength, limits.processMessageBytes);
        for (const reply of [
          CitationXmlWorkerReply.cases.Ready.make({}),
          CitationXmlWorkerReply.cases.Started.make({}),
          CitationXmlWorkerReply.cases.Success.make({ balanced: false }),
          CitationXmlWorkerReply.cases.Failure.make({ failure: safety("processMessageBytes") }),
        ])
          yield* encodeCitationXmlReply(reply, limits.processMessageBytes);
        const prepared = yield* unicode.fromStorageReserved(source, reserve).pipe(
          Effect.mapError((error) => {
            if (error._tag === "CitationSafetyLimitExceeded") return safety(error.limit);
            if (error.reason === "limit-exceeded") return safety("sourceUtf16");
            if (error.reason === "deadline-exceeded")
              return safety(
                Duration.isLessThanOrEqualTo(limits.operationDeadline, limits.annotateDeadline)
                  ? "operationDeadline"
                  : "annotateDeadline"
              );
            return CitationXmlKernelFailure.make({ reason: "invalid-input" });
          })
        );
        return yield* prepareCitationXmlRpc(
          CitationXmlWorkerJob.make({ width: prepared.storage.width, bytes: prepared.storage.bytes }),
          limits.processMessageBytes
        );
      })
    )
  );
  return { balance, snapshot: owner.snapshot, reap: owner.reap };
});

/** Captured private balance capability; query calls require no caller services.
 * @internal @category services @since 0.0.0
 */
export class CitationXmlBalance extends Context.Service<
  CitationXmlBalance,
  Pick<Effect.Success<ReturnType<typeof makeCitationXmlWorker>>, "balance">
>()($I`CitationXmlBalance`) {}
