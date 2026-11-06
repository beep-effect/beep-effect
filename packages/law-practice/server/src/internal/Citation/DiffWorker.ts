/** Exact default diff through the existing shared admission/physical owner.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { CitationDiffKernelFailure } from "./DiffKernel.ts";
import { unpackCitationDiffSteps } from "./DiffSteps.ts";
import {
  CitationDiffJobLayout,
  CitationDiffWorkerFailure,
  CitationDiffWorkerJob,
  encodeCitationDiffJob,
  preflightCitationDiffControlFrames,
  preflightCitationDiffJob,
} from "./DiffWorkerProtocol.ts";
import { CitationDiffWorkerStartup, callCitationDiffRpc, encodeCitationDiffStartup } from "./DiffWorkerRpc.ts";
import { acquireCitationNativeLease, captureCitationNativeAdmission } from "./NativeAdmission.ts";
import {
  citationNativeProcessCommand,
  makeCitationNativeProcessOwner,
  prepareCitationNativeRuntime,
  withCitationNativeProcess,
} from "./NativeProcess.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationPythonSliceLayout, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
import { captureCitationTextReservation } from "./TextBudget.ts";
import type { CitationPythonUnicodeFailure, CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const failure = (reason: CitationDiffWorkerFailure["reason"]) => CitationDiffWorkerFailure.make({ reason });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const invalidInput = () => CitationDiffKernelFailure.make({ reason: "invalid-input" });
const layout = (source: CitationPythonUnicodeStorage, units: number) =>
  CitationPythonSliceLayout.make({
    width: source.width,
    byteLength: source.bytes.byteLength,
    pythonLength: source.bytes.byteLength / source.width,
    utf16Units: units,
  });
/** Capture policy, runtime, Clock, Scope, process spawner and optional composed
 * text/admission owners. Methods have R=never. Both layouts and the complete
 * request are preflighted before receiving copies or native admission. One
 * extraction timer covers preparation, queueing, startup and RPC; the existing
 * physical owner independently confirms retirement before publication/reuse.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDiffWorker = Effect.fn("Citation.makeDiffWorker")(function* (
  policy: unknown,
  runtimeInput: unknown
) {
  const { limits, runtime } = yield* prepareCitationNativeRuntime(policy, runtimeInput, () =>
    failure("invalid-runtime")
  );
  const { timed, deadline, deadlineLimit, operationTimed } = yield* makeCitationRegexTiming(limits, false);
  const unicode = yield* makeCitationPythonUnicode({
    ...limits,
    producedTextUtf16: limits.diffInputUtf16,
    cleanDeadline: deadline,
    operationDeadline: deadline,
  });
  const reserve = yield* captureCitationTextReservation;
  const admission = yield* captureCitationNativeAdmission(limits, () => failure("invalid-runtime"));
  const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure);
  const path = yield* Path.Path;
  const assetPath = yield* path
    .fromFileUrl(new URL("../../../assets/citation-diff/kernel.wasm", import.meta.url))
    .pipe(Effect.mapError(() => failure("invalid-runtime")));
  const argument = yield* encodeCitationDiffStartup(
    CitationDiffWorkerStartup.make({ maximum: limits.processMessageBytes, assetPath })
  );
  yield* preflightCitationDiffControlFrames(limits.processMessageBytes);
  const nativeError = (error: CitationPythonUnicodeFailure) =>
    error.reason === "deadline-exceeded"
      ? safety(deadlineLimit)
      : error.reason === "limit-exceeded"
        ? safety("diffInputUtf16")
        : invalidInput();
  const evaluate = Effect.fn("Citation.evaluateDiffProcess")(
    (beforeInput: unknown, afterInput: unknown, maximumSteps: unknown = limits.diffSteps) =>
      withCitationNativeProcess(
        owner,
        acquireCitationNativeLease(admission, "extract", false, failure),
        () => failure("invalid-runtime"),
        (operation) =>
          Effect.gen(function* () {
            const quota = yield* S.decodeUnknownEffect(CitationDiffWorkerJob.fields.maximumSteps)(maximumSteps).pipe(
              Effect.mapError(() => failure("invalid-runtime"))
            );
            if (quota > limits.diffSteps) return yield* safety("diffSteps");
            const beforeRaw = yield* S.decodeUnknownEffect(S.toType(CitationPythonUnicodeStorage))(beforeInput).pipe(
              Effect.mapError(invalidInput)
            );
            const afterRaw = yield* S.decodeUnknownEffect(S.toType(CitationPythonUnicodeStorage))(afterInput).pipe(
              Effect.mapError(invalidInput)
            );
            let after = O.none<CitationPythonUnicodeValue>();
            let measured = O.none<CitationDiffJobLayout>();
            const before = yield* unicode
              .fromStorageReserved(beforeRaw, (beforeUnits) =>
                unicode
                  .fromStorageReserved(afterRaw, (afterUnits) =>
                    Effect.gen(function* () {
                      const plan = CitationDiffJobLayout.make({
                        before: layout(beforeRaw, beforeUnits),
                        after: layout(afterRaw, afterUnits),
                        maximumSteps: quota,
                        maximumInputUtf16: limits.diffInputUtf16,
                      });
                      yield* preflightCitationDiffJob(plan, limits.processMessageBytes);
                      if (beforeUnits + afterUnits > limits.producedTextUtf16)
                        return yield* safety("producedTextUtf16");
                      yield* reserve(beforeUnits + afterUnits);
                      yield* operation.acquire;
                      measured = O.some(plan);
                    })
                  )
                  .pipe(
                    Effect.tap((value) =>
                      Effect.sync(() => {
                        after = O.some(value);
                      })
                    ),
                    Effect.asVoid
                  )
              )
              .pipe(
                Effect.mapError((error) => (error._tag === "CitationPythonUnicodeFailure" ? nativeError(error) : error))
              );
            const afterValue = yield* Effect.fromOption(after).pipe(Effect.mapError(() => failure("invalid-runtime")));
            const plan = yield* Effect.fromOption(measured).pipe(Effect.mapError(() => failure("invalid-runtime")));
            const job = CitationDiffWorkerJob.make({
              beforeWidth: before.storage.width,
              afterWidth: afterValue.storage.width,
              beforeBytes: before.storage.bytes,
              afterBytes: afterValue.storage.bytes,
              maximumSteps: quota,
              maximumInputUtf16: limits.diffInputUtf16,
            });
            const frame = yield* encodeCitationDiffJob(job, plan, limits.processMessageBytes);
            const child = yield* operation.start(citationNativeProcessCommand(runtime, argument));
            const bytes = yield* callCitationDiffRpc(child, job, frame, limits.processMessageBytes);
            return yield* unpackCitationDiffSteps(bytes, quota, before.pythonLength, afterValue.pythonLength);
          }).pipe(timed)
      ).pipe(operationTimed)
  );
  return { evaluate, snapshot: owner.snapshot, reap: owner.reap };
});
