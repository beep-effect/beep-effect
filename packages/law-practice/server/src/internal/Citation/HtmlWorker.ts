/**
 * Parent-owned one-process-per-operation HTML supervisor. Only retirement
 * tasks are detached: their explicit daemon lifetime preserves exact child
 * ownership after caller cancellation or a cleanup deadline. No replacement
 * is admitted while a quarantined child remains unacknowledged.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { CitationCleanerProduced } from "./CleanerPipeline.ts";
import { CitationCleanerTextAllocation, citationCleanerHtmlTextOutput } from "./CleanerTextIdentity.ts";
import { CitationHtmlInputFailure, makeCitationHtmlInput } from "./HtmlInput.ts";
import {
  CitationHtmlWorkerFailure,
  CitationHtmlWorkerJob,
  preflightCitationHtmlControlFrames,
  preflightCitationHtmlJob,
} from "./HtmlWorkerProtocol.ts";
import { CitationHtmlWorkerStartup, prepareCitationHtmlRpc } from "./HtmlWorkerRpc.ts";
import { CitationNativeProcessAdmission, makeCitationNativeProcessAdmission } from "./NativeAdmission.ts";
import {
  CitationNativeProcessRuntime,
  citationNativeProcessCommand,
  makeCitationNativeProcessOwner,
} from "./NativeProcess.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import type { CitationCleanerWork } from "./CleanerPipeline.ts";
import type { CitationNativeProcessLease } from "./NativeAdmission.ts";
import type { CitationOwnedNativeProcess } from "./NativeProcess.ts";

const CitationEngineLimitsType = S.toType(CitationEngineLimits);
const NativeStorage = S.toType(CitationPythonUnicodeStorage);

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorker");
/** @internal @category models @since 0.0.0 */
export class CitationHtmlWorkerSnapshot extends S.Opaque<
  CitationHtmlWorkerSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    active: S.Natural,
    queued: S.Natural,
    processes: S.Natural,
    quarantined: S.Natural,
    closed: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationHtmlWorkerSnapshot", {
      description: "Source-free ownership/admission diagnostics for one supervisor lifetime.",
    })
  )
) {}
/**
 * Complete native stage text and original operation-owned charge tickets.
 * The charge fields preserve live issuance; decoding cannot mint authority.
 * @internal @category models @since 0.0.0
 */
export class CitationHtmlCleanerStage extends S.Opaque<CitationHtmlCleanerStage, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
    charges: CitationCleanerProduced.fields.charges,
    allocation: CitationCleanerTextAllocation,
  }).pipe(
    $I.annoteSchema("CitationHtmlCleanerStage", {
      description: "Complete bounded HTML text plus live text reservations, pending runtime value issuance.",
    })
  )
) {}
const failure = (reason: CitationHtmlWorkerFailure["reason"]) => CitationHtmlWorkerFailure.make({ reason });
const invalidRuntime = () => failure("invalid-runtime");
const invalidInput = () => CitationHtmlInputFailure.make({ reason: "invalid-input" });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit });
const Text = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16));
const StageText = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16));
const Output = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16));
const WorkerStartupJson = S.fromJsonString(CitationHtmlWorkerStartup).pipe(
  $I.annoteSchema("WorkerStartupJson", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
/**
 * Capture Clock, process spawner and owning Scope. Returned methods have
 * R = never. Admission includes preparation; one clean timer covers preparation,
 * startup and all traffic/native work. Mandatory retirement has its separate
 * cleanup window and must acknowledge exit before publication/permit reuse.
 * Scope teardown stops admission and retains bounded retirement daemons for
 * any ownership still quarantined after its cleanup window.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationHtmlWorker = Effect.fn("Citation.makeHtmlWorker")(function* (
  policy: unknown,
  runtimeInput: unknown
) {
  const decodedLimits = yield* S.decodeUnknownEffect(CitationEngineLimitsType)(policy).pipe(
    Effect.mapError(invalidRuntime)
  );
  const limits = CitationEngineLimits.make({
    ...decodedLimits,
    cleanDeadline: decodedLimits.cleanDeadline.pipe(Duration.toMillis, Duration.millis),
    operationDeadline: decodedLimits.operationDeadline.pipe(Duration.toMillis, Duration.millis),
    queueDeadline: decodedLimits.queueDeadline.pipe(Duration.toMillis, Duration.millis),
    cleanupDeadline: decodedLimits.cleanupDeadline.pipe(Duration.toMillis, Duration.millis),
  });
  const runtime = yield* S.decodeUnknownEffect(CitationNativeProcessRuntime)(runtimeInput).pipe(
    Effect.mapError(invalidRuntime)
  );
  const clock = yield* Clock.Clock;
  const path = yield* Path.Path;
  const assetPath = yield* path
    .fromFileUrl(new URL("../../../assets/citation-html/kernel.wasm", import.meta.url))
    .pipe(Effect.mapError(() => failure("invalid-runtime")));
  const argument = yield* S.encodeEffect(WorkerStartupJson)(
    CitationHtmlWorkerStartup.make({ maximum: limits.processMessageBytes, assetPath })
  ).pipe(Effect.mapError(() => failure("invalid-runtime")));
  // Standalone private workers own a local pool. Engine composition supplies one
  // shared service before constructing any of its builtin/native adapters.
  const suppliedAdmission = yield* Effect.serviceOption(CitationNativeProcessAdmission);
  const nativeAdmission = O.isSome(suppliedAdmission)
    ? suppliedAdmission.value
    : yield* makeCitationNativeProcessAdmission(limits).pipe(Effect.mapError(invalidRuntime));
  const preparation = yield* makeCitationHtmlInput(limits);
  const slots = yield* Semaphore.make(limits.concurrentOperations);
  const queueSlots = yield* Semaphore.make(limits.queuedOperations);
  const nativeOwner = yield* makeCitationNativeProcessOwner(limits, "clean", failure);
  const ensureOpen = nativeOwner.ensureOpen;
  const active = yield* Ref.make(0);
  const queued = yield* Ref.make(0);
  const snapshot = Effect.gen(function* () {
    return CitationHtmlWorkerSnapshot.make({
      ...(yield* nativeOwner.snapshot),
      active: yield* Ref.get(active),
      queued: yield* Ref.get(queued),
    });
  });
  const reap = nativeOwner.reap;
  const validateSource = Effect.fnUntraced(function* (input: unknown, kind: "raw" | "text" | "bytes" | "unicode") {
    if (kind === "bytes") {
      yield* S.decodeUnknownEffect(S.Uint8Array)(input).pipe(Effect.mapError(invalidInput));
    } else if (kind === "unicode") {
      yield* S.decodeUnknownEffect(NativeStorage)(input).pipe(Effect.mapError(invalidInput));
    } else {
      const text = yield* S.decodeUnknownEffect(kind === "text" ? StageText : Text)(input).pipe(
        Effect.mapError(invalidInput)
      );
      if (kind === "raw" && Str.length(text) > limits.sourceUtf16) return yield* safety("sourceUtf16");
    }
  });
  const clean = Effect.fn("Citation.cleanHtmlProcess")(
    function* (input: unknown, remaining: number, kind: "raw" | "text" | "bytes" | "unicode") {
      yield* validateSource(input, kind);
      const outputUtf16 = yield* S.decodeEffect(Output)(remaining).pipe(Effect.mapError(invalidRuntime));
      if (outputUtf16 > limits.producedTextUtf16) return yield* safety("producedTextUtf16");
      yield* preflightCitationHtmlControlFrames(limits.processMessageBytes);
      return yield* Effect.uninterruptibleMask(
        Effect.fnUntraced(function* (restore) {
          yield* ensureOpen;
          const claimed = yield* Ref.make(false);
          const activate = Ref.set(claimed, true).pipe(Effect.andThen(Ref.update(active, (value) => value + 1)));
          let nativeLease = O.none<CitationNativeProcessLease>();
          const release = Effect.gen(function* () {
            if (yield* Ref.getAndSet(claimed, false)) {
              if (O.isSome(nativeLease)) yield* nativeLease.value.release;
              yield* Ref.update(active, (value) => value - 1);
              yield* slots.release(1);
            }
          });
          yield* Effect.gen(function* () {
            if (yield* slots.takeIfAvailable(1)) return yield* activate;
            yield* Effect.acquireUseRelease(
              Effect.gen(function* () {
                if (!(yield* queueSlots.takeIfAvailable(1))) return yield* safety("queuedOperations");
                yield* Ref.update(queued, (value) => value + 1);
              }),
              () =>
                slots.take(1).pipe(
                  Effect.timeoutOrElse({
                    duration: limits.queueDeadline,
                    orElse: () => Effect.fail(safety("queueDeadline")),
                  }),
                  Effect.interruptible,
                  Effect.andThen(activate)
                ),
              () => Ref.update(queued, (value) => value - 1).pipe(Effect.andThen(queueSlots.release(1)))
            );
          }).pipe(Effect.onError(() => release));
          let lease = O.none<CitationOwnedNativeProcess<CitationHtmlWorkerFailure>>();
          const body = Effect.gen(function* () {
            yield* ensureOpen;
            const prepare =
              kind === "bytes"
                ? preparation.prepareBytes
                : kind === "unicode"
                  ? preparation.prepareUnicode
                  : preparation.prepareStage;
            const prepared = yield* prepare(input, (layout) =>
              preflightCitationHtmlJob(layout, outputUtf16, limits.processMessageBytes).pipe(Effect.asVoid)
            );
            const call = yield* prepareCitationHtmlRpc(
              CitationHtmlWorkerJob.make({
                encoding: prepared.encoding,
                bytes: prepared.bytes,
                fullHtml: prepared.fullHtml,
                outputUtf16,
              }),
              limits.processMessageBytes
            );
            yield* nativeAdmission.acquire("clean").pipe(
              Effect.mapError((error) =>
                error._tag === "CitationSafetyLimitExceeded"
                  ? error
                  : failure(error.reason === "quarantined" ? "quarantined" : "closed")
              ),
              Effect.tap((permit) =>
                Effect.sync(() => {
                  nativeLease = O.some(permit);
                })
              ),
              Effect.uninterruptible
            );
            const started = yield* nativeOwner
              .start(citationNativeProcessCommand(runtime, argument), {
                quarantine: Effect.suspend(() => (O.isSome(nativeLease) ? nativeLease.value.quarantine : Effect.void)),
                release,
              })
              .pipe(
                Effect.tap((started) =>
                  Effect.sync(() => {
                    lease = O.some(started.process);
                  })
                ),
                Effect.uninterruptible
              );
            const resource = yield* started.child;
            return yield* call(resource);
          });
          const outcome = yield* Effect.exit(
            restore(
              body.pipe(
                Effect.timeoutOrElse({
                  duration: limits.cleanDeadline,
                  orElse: () => Effect.fail(safety("cleanDeadline")),
                })
              )
            )
          );
          if (O.isSome(lease)) yield* lease.value.retire(false);
          else yield* release;
          return yield* outcome;
        })
      ).pipe(
        Effect.timeoutOrElse({
          duration: limits.operationDeadline,
          orElse: () => Effect.fail(safety("operationDeadline")),
        })
      );
    },
    Effect.provideService(Clock.Clock, clock)
  );
  const stage = Effect.fn("Citation.stageHtmlProcess")(
    (input: unknown, work: CitationCleanerWork, kind: Parameters<typeof clean>[2]) =>
      work
        .withTextCapacity((remaining) =>
          clean(input, remaining, kind).pipe(Effect.map((text) => ({ value: text, units: Str.length(text) })))
        )
        .pipe(
          Effect.map(({ value, charges }) =>
            CitationHtmlCleanerStage.make({ ...citationCleanerHtmlTextOutput(value), charges })
          )
        )
  );
  return {
    snapshot,
    reap,
    clean: (input: unknown) => clean(input, limits.producedTextUtf16, "raw"),
    cleanBytes: (input: unknown) => clean(input, limits.producedTextUtf16, "bytes"),
    cleanUnicode: (input: unknown) => clean(input, limits.producedTextUtf16, "unicode"),
    stageBytes: (input: unknown, work: CitationCleanerWork) => stage(input, work, "bytes"),
    stageUnicode: (input: unknown, work: CitationCleanerWork) => stage(input, work, "unicode"),
    stage: (input: unknown, work: CitationCleanerWork) => stage(input, work, "text"),
  };
});
