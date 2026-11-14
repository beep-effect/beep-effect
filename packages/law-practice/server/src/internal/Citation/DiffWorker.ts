/** Exact default diff through the existing shared admission/physical owner.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
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
import {
  CitationNativeProcessOwnerSnapshot,
  citationNativeProcessCommand,
  withCitationNativeProcess,
} from "./NativeProcess.ts";
import { CitationPythonSliceLayout, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeStart } from "./NativeLane.ts";
import type { CitationNativeProcessRuntime, CitationOwnedNativeProcess } from "./NativeProcess.ts";
import type { CitationPythonUnicodeFailure, CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DiffWorker");
const failure = (reason: CitationDiffWorkerFailure["reason"]) => CitationDiffWorkerFailure.make({ reason });
const invalidInput = () => CitationDiffKernelFailure.make({ reason: "invalid-input" });
const layout = (source: CitationPythonUnicodeStorage, units: number) =>
  CitationPythonSliceLayout.make({
    width: source.width,
    byteLength: source.bytes.byteLength,
    pythonLength: source.bytes.byteLength / source.width,
    utf16Units: units,
  });
const UnicodeValue = S.toType(CitationPythonUnicodeStorage).pipe(
  $I.annoteSchema("UnicodeValue", { description: "Captured static boundary codec for bounded citation processing." })
);
/** Capture policy, runtime, Clock, Scope, process spawner and optional composed
 * native admission owners. Methods require CitationInvocation. Both layouts and the complete
 * request are preflighted before receiving copies or native admission. One
 * extraction timer covers preparation, queueing, startup and RPC; the existing
 * physical owner independently confirms retirement before publication/reuse.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDiffWorker = Effect.fn("Citation.makeDiffWorker")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  useDmp = true
) {
  const algorithm = yield* S.decodeUnknownEffect(S.Boolean)(useDmp).pipe(
    Effect.mapError(() => failure("invalid-runtime"))
  );
  const {
    operation: engineOperation,
    timed,
    deadline,
    deadlineLimit,
    operationTimed,
    failSafety,
  } = yield* makeCitationRegexTiming(limits, false);
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    CitationSafetyLimitExceeded.make({ operation: engineOperation, limit });
  const unicode = yield* makeCitationPythonUnicode(
    {
      ...limits,
      producedTextUtf16: limits.diffInputUtf16,
      operationDeadline: deadline,
    },
    engineOperation
  );
  let closed = false;
  let pending = A.empty<CitationOwnedNativeProcess<CitationDiffWorkerFailure>>();
  let failed = A.empty<CitationOwnedNativeProcess<CitationDiffWorkerFailure>>();
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      closed = true;
    })
  );
  const ensureOpen = Effect.suspend(() =>
    closed ? Effect.fail(failure("closed")) : failed.length > 0 ? Effect.fail(failure("quarantined")) : Effect.void
  );
  const track = Effect.fn("Citation.trackDiffJob")(function* (record: Effect.Success<ReturnType<CitationNativeStart>>) {
    let acknowledged = false;
    const process: CitationOwnedNativeProcess<CitationDiffWorkerFailure> = {
      retire: Effect.fn("Citation.retireDiffJob")(function* (retry) {
        yield* record.process.retire(retry).pipe(
          Effect.tapError(() =>
            Effect.sync(() => {
              if (!acknowledged && !A.contains(failed, process)) failed = A.append(failed, process);
            })
          ),
          Effect.mapError((error) => (error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error))
        );
      }),
    };
    pending = A.append(pending, process);
    yield* record.onRetired(
      Effect.sync(() => {
        acknowledged = true;
        pending = A.filter(pending, (entry) => entry !== process);
        failed = A.filter(failed, (entry) => entry !== process);
      })
    );
    return { child: Exit.mapError(record.child, (error) => failure(error.reason)), process };
  });
  const reap = Effect.fn("Citation.reapDiffJobs")(function* () {
    for (const record of pending) yield* record.retire(true);
  });
  const path = yield* Path.Path;
  const assetPath = yield* path
    .fromFileUrl(new URL("../../../assets/citation-diff/kernel.wasm", import.meta.url))
    .pipe(Effect.mapError(() => failure("invalid-runtime")));
  const argument = yield* encodeCitationDiffStartup(
    CitationDiffWorkerStartup.make({ maximum: limits.processMessageBytes, assetPath, useDmp: algorithm })
  );
  yield* preflightCitationDiffControlFrames(limits.processMessageBytes);
  const nativeError = (error: CitationPythonUnicodeFailure) =>
    error.reason === "deadline-exceeded"
      ? safety(deadlineLimit)
      : error.reason === "limit-exceeded"
        ? safety("diffInputUtf16")
        : invalidInput();
  const evaluate = Effect.fn("Citation.evaluateDiffProcess")(
    (
      start: CitationNativeStart,
      reserve: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded>,
      beforeInput: unknown,
      afterInput: unknown,
      maximumSteps: unknown = limits.diffSteps
    ) =>
      withCitationNativeProcess(
        {
          ensureOpen,
          start: (command) =>
            start("diff", command).pipe(
              Effect.mapError((error) => (error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error)),
              Effect.flatMap(track)
            ),
        },
        Effect.succeed({ release: Effect.void, quarantine: Effect.void }),
        () => failure("invalid-runtime"),
        (operation) =>
          Effect.gen(function* () {
            const quota = yield* S.decodeUnknownEffect(CitationDiffWorkerJob.fields.maximumSteps)(maximumSteps).pipe(
              Effect.mapError(() => failure("invalid-runtime"))
            );
            if (quota > limits.diffSteps) return yield* safety("diffSteps");
            const beforeRaw = yield* S.decodeUnknownEffect(UnicodeValue)(beforeInput).pipe(
              Effect.mapError(invalidInput)
            );
            const afterRaw = yield* S.decodeUnknownEffect(UnicodeValue)(afterInput).pipe(Effect.mapError(invalidInput));
            let after = O.none<CitationPythonUnicodeValue>();
            let measured = O.none<CitationDiffJobLayout>();
            const before = yield* unicode
              .fromStorageReserved(beforeRaw, (beforeUnits) =>
                unicode
                  .fromStorageReserved(
                    afterRaw,
                    Effect.fnUntraced(function* (afterUnits) {
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
      ).pipe(operationTimed, Effect.catchTag("CitationSafetyLimitExceeded", failSafety))
  );
  return {
    evaluate,
    snapshot: Effect.sync(() =>
      CitationNativeProcessOwnerSnapshot.make({ processes: pending.length, quarantined: failed.length, closed })
    ),
    reap,
  };
});
