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
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
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
import { prepareCitationHtmlRpc } from "./HtmlWorkerRpc.ts";
import { CitationNativeProcessAdmission, makeCitationNativeProcessAdmission } from "./NativeAdmission.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type { CitationCleanerWork } from "./CleanerPipeline.ts";
import type { CitationNativeProcessLease } from "./NativeAdmission.ts";

const CitationEngineLimitsType = S.toType(CitationEngineLimits);
const NativeStorage = S.toType(CitationPythonUnicodeStorage);
const NaturalJson = S.fromJsonString(S.Natural);

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorker");
const RuntimePath = S.NonEmptyString.check(S.isMaxLength(4096)).pipe(
  $I.annoteSchema("RuntimePath", {
    description: "Explicit trusted local worker executable/script/working-directory path.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationHtmlWorkerRuntime extends S.Opaque<CitationHtmlWorkerRuntime, { readonly brand: unique symbol }>()(
  S.Struct({ executable: RuntimePath, workerFile: RuntimePath, cwd: RuntimePath }).pipe(
    $I.annoteSchema("CitationHtmlWorkerRuntime", {
      description: "Injected Bun runtime capability, never a raw-text request field or ambient configuration.",
    })
  )
) {}
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
const Phase = LiteralKit(["starting", "running", "stopping", "quarantined"]).pipe(
  $I.annoteSchema("Phase", { description: "Private live process ownership phase, never a success receipt." })
);
// This is a runtime service contract: Scope, Ref and Fiber handles are not data.
interface OwnedProcess {
  readonly handle: Ref.Ref<O.Option<ChildProcessHandle>>;
  readonly phase: Ref.Ref<typeof Phase.Type>;
  readonly quarantine: Effect.Effect<void>;
  readonly retire: Effect.Effect<boolean>;
  readonly retirement: Ref.Ref<O.Option<Fiber.Fiber<boolean>>>;
  readonly retirementLock: Semaphore.Semaphore;
  readonly scope: Scope.Closeable;
}
const failure = (reason: CitationHtmlWorkerFailure["reason"]) => CitationHtmlWorkerFailure.make({ reason });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit });
const Text = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16));
const StageText = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16));
const Output = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16));
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
    Effect.mapError(() => failure("invalid-runtime"))
  );
  const limits = CitationEngineLimits.make({
    ...decodedLimits,
    cleanDeadline: decodedLimits.cleanDeadline.pipe(Duration.toMillis, Duration.millis),
    operationDeadline: decodedLimits.operationDeadline.pipe(Duration.toMillis, Duration.millis),
    queueDeadline: decodedLimits.queueDeadline.pipe(Duration.toMillis, Duration.millis),
    cleanupDeadline: decodedLimits.cleanupDeadline.pipe(Duration.toMillis, Duration.millis),
  });
  const runtime = yield* S.decodeUnknownEffect(CitationHtmlWorkerRuntime)(runtimeInput).pipe(
    Effect.mapError(() => failure("invalid-runtime"))
  );
  const clock = yield* Clock.Clock;
  const spawner = yield* ChildProcessSpawner;
  const ownerScope = yield* Scope.Scope;
  // Standalone private workers own a local pool. Engine composition supplies one
  // shared service before constructing any of its builtin/native adapters.
  const suppliedAdmission = yield* Effect.serviceOption(CitationNativeProcessAdmission);
  const nativeAdmission = O.isSome(suppliedAdmission)
    ? suppliedAdmission.value
    : yield* makeCitationNativeProcessAdmission(limits).pipe(Effect.mapError(() => failure("invalid-runtime")));
  const preparation = yield* makeCitationHtmlInput(limits);
  const slots = yield* Semaphore.make(limits.concurrentOperations);
  const queueSlots = yield* Semaphore.make(limits.queuedOperations);
  const birthLock = yield* Semaphore.make(1);
  const closed = yield* Ref.make(false);
  const active = yield* Ref.make(0);
  const queued = yield* Ref.make(0);
  const owned = yield* Ref.make<ReadonlyArray<OwnedProcess>>([]);
  const quarantine = Effect.gen(function* () {
    const phases = yield* Effect.forEach(yield* Ref.get(owned), (lease) => Ref.get(lease.phase), { concurrency: 1 });
    return A.filter(phases, (phase) => phase === "quarantined").length;
  });
  const ensureOpen = Effect.gen(function* () {
    if (yield* Ref.get(closed)) return yield* failure("closed");
    if ((yield* quarantine) > 0) return yield* failure("quarantined");
  });
  const startRetirement = Effect.fn("Citation.startHtmlRetirement")((lease: OwnedProcess, retry: boolean) =>
    lease.retirementLock.withPermit(
      Effect.gen(function* () {
        const previous = yield* Ref.get(lease.retirement);
        if (O.isSome(previous)) {
          const state = yield* Effect.sync(() => O.fromUndefinedOr(previous.value.pollUnsafe()));
          if (O.isNone(state) || !retry || (Exit.isSuccess(state.value) && state.value.value)) return previous.value;
        }
        yield* Ref.set(lease.phase, "stopping");
        // Explicit retirement daemon: at most one per owned lease, holding its
        // process and admission permit until acknowledged, even after Scope exit.
        const task = yield* lease.retire.pipe(Effect.provideService(Clock.Clock, clock), Effect.forkDetach);
        yield* Ref.set(lease.retirement, O.some(task));
        return task;
      })
    )
  );
  const awaitRetirement = Effect.fn("Citation.awaitHtmlRetirement")(function* (lease: OwnedProcess, retry: boolean) {
    const task = yield* startRetirement(lease, retry);
    const observed = yield* Fiber.await(task).pipe(Effect.interruptible, Effect.timeoutOption(limits.cleanupDeadline));
    if (O.isSome(observed) && Exit.isSuccess(observed.value) && observed.value.value) return;
    yield* Ref.set(lease.phase, "quarantined");
    yield* lease.quarantine;
    if (O.isNone(observed)) return yield* safety("cleanupDeadline");
    return yield* failure("cleanup-unconfirmed");
  });
  const snapshot = Effect.gen(function* () {
    return CitationHtmlWorkerSnapshot.make({
      active: yield* Ref.get(active),
      queued: yield* Ref.get(queued),
      processes: (yield* Ref.get(owned)).length,
      quarantined: yield* quarantine,
      closed: yield* Ref.get(closed),
    });
  });
  const reap = Effect.fn("Citation.reapHtmlWorkers")(
    function* () {
      const records = yield* birthLock.withPermit(Ref.get(owned));
      yield* Effect.forEach(records, (lease) => awaitRetirement(lease, true), {
        concurrency: limits.concurrentOperations,
        discard: true,
      });
    },
    Effect.provideService(Clock.Clock, clock)
  );
  yield* Scope.addFinalizer(
    ownerScope,
    Effect.gen(function* () {
      yield* Ref.set(closed, true);
      yield* reap().pipe(
        Effect.catchCause(() => Effect.logError("Citation HTML ownership remains quarantined after the cleanup window"))
      );
    })
  );
  const validateSource = Effect.fnUntraced(function* (input: unknown, kind: "raw" | "text" | "bytes" | "unicode") {
    if (kind === "bytes") {
      yield* S.decodeUnknownEffect(S.Uint8Array)(input).pipe(
        Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
      );
    } else if (kind === "unicode") {
      yield* S.decodeUnknownEffect(NativeStorage)(input).pipe(
        Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
      );
    } else {
      const text = yield* S.decodeUnknownEffect(kind === "text" ? StageText : Text)(input).pipe(
        Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
      );
      if (kind === "raw" && Str.length(text) > limits.sourceUtf16) return yield* safety("sourceUtf16");
    }
  });
  const clean = Effect.fn("Citation.cleanHtmlProcess")(
    function* (input: unknown, remaining: number, kind: "raw" | "text" | "bytes" | "unicode") {
      yield* validateSource(input, kind);
      const outputUtf16 = yield* S.decodeEffect(Output)(remaining).pipe(
        Effect.mapError(() => failure("invalid-runtime"))
      );
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
          let lease = O.none<OwnedProcess>();
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
            const argument = yield* S.encodeEffect(NaturalJson)(limits.processMessageBytes).pipe(
              Effect.mapError(() => failure("invalid-runtime"))
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
            const resource = yield* birthLock
              .withPermit(
                Effect.gen(function* () {
                  // Do not interrupt the ownership transfer between OS spawn and the
                  // spawner's registered handle. No request bytes are sent in it.
                  yield* Effect.interruptible(Effect.void);
                  yield* ensureOpen;
                  const scope = yield* Scope.make();
                  const handle = yield* Ref.make(O.none<ChildProcessHandle>());
                  const phase = yield* Ref.make<typeof Phase.Type>("starting");
                  const retirement = yield* Ref.make(O.none<Fiber.Fiber<boolean>>());
                  const retirementLock = yield* Semaphore.make(1);
                  const resource: OwnedProcess = {
                    scope,
                    handle,
                    phase,
                    retirement,
                    retirementLock,
                    quarantine: Effect.suspend(() =>
                      O.isSome(nativeLease) ? nativeLease.value.quarantine : Effect.void
                    ),
                    retire: Effect.gen(function* () {
                      const child = yield* Ref.get(handle);
                      if (O.isSome(child)) {
                        const running = yield* child.value.isRunning.pipe(Effect.orElseSucceed(() => true));
                        if (running)
                          yield* Effect.exit(
                            child.value.kill({ killSignal: "SIGKILL", forceKillAfter: Duration.zero })
                          );
                        if (yield* child.value.isRunning.pipe(Effect.orElseSucceed(() => true))) return false;
                      }
                      const finalized = yield* Effect.exit(Scope.close(scope, Exit.void));
                      if (Exit.isFailure(finalized)) return false;
                      yield* Ref.update(owned, (records) => A.filter(records, (entry) => entry !== resource));
                      yield* release;
                      return true;
                    }).pipe(Effect.withSpan("Citation.retireHtmlProcess")),
                  };
                  lease = O.some(resource);
                  yield* Ref.update(owned, (records) => A.append(records, resource));
                  const child = yield* spawner
                    .spawn(
                      ChildProcess.make(
                        runtime.executable,
                        ["--no-env-file", "--no-install", runtime.workerFile, argument],
                        {
                          cwd: runtime.cwd,
                          env: {},
                          extendEnv: false,
                          shell: false,
                          detached: false,
                          stdin: "pipe",
                          stdout: "pipe",
                          stderr: "ignore",
                          killSignal: "SIGKILL",
                          forceKillAfter: Duration.zero,
                        }
                      )
                    )
                    .pipe(
                      Effect.provideService(Scope.Scope, scope),
                      Effect.mapError(() => failure("spawn-failed"))
                    );
                  yield* Ref.set(handle, O.some(child));
                  yield* Ref.set(phase, "running");
                  return child;
                })
              )
              .pipe(Effect.uninterruptible);
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
          if (O.isSome(lease)) yield* awaitRetirement(lease.value, false);
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
