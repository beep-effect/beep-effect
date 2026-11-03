/** Shared physical child ownership, independent of RPC and operation admission.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type { CitationNativeProcessLease } from "./NativeAdmission.ts";

const $I = $LawPracticeServerId.create("internal/Citation/NativeProcess");
const LimitsType = S.toType(CitationEngineLimits);
const RuntimePath = S.NonEmptyString.check(S.isMaxLength(4096)).pipe(
  $I.annoteSchema("RuntimePath", {
    description: "Explicit trusted local worker executable/script/working-directory path.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationNativeProcessRuntime extends S.Opaque<
  CitationNativeProcessRuntime,
  { readonly brand: unique symbol }
>()(
  S.Struct({ executable: RuntimePath, workerFile: RuntimePath, cwd: RuntimePath }).pipe(
    $I.annoteSchema("CitationNativeProcessRuntime", {
      description: "Injected Bun runtime capability, never a raw-text request field or ambient configuration.",
    })
  )
) {}
/** Construct the same restricted Bun process for each native procedure.
 * @internal @category operations @since 0.0.0
 */
export const citationNativeProcessCommand: {
  (argument: string): (runtime: CitationNativeProcessRuntime) => ChildProcess.StandardCommand;
  (runtime: CitationNativeProcessRuntime, argument: string): ChildProcess.StandardCommand;
} = dual(2, (runtime: CitationNativeProcessRuntime, argument: string) =>
  ChildProcess.make(runtime.executable, ["--no-env-file", "--no-install", runtime.workerFile, argument], {
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
  })
);
/** @internal @category models @since 0.0.0 */
export const CitationNativeProcessFailureReason = LiteralKit([
  "invalid-runtime",
  "invalid-frame",
  "channel-failed",
  "spawn-failed",
  "cleanup-unconfirmed",
  "quarantined",
  "closed",
]).pipe(
  $I.annoteSchema("CitationNativeProcessFailureReason", {
    description: "Closed shared native transport/ownership reasons without source-bearing diagnostics.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationNativeProcessFailureReason = typeof CitationNativeProcessFailureReason.Type;
const Phase = LiteralKit(["starting", "running", "stopping", "quarantined"]).pipe(
  $I.annoteSchema("Phase", { description: "Private physical ownership phase, never a completion receipt." })
);
/** Runtime retirement authority bound to one exact owned child. Internal scopes,
 * references and fibers stay private; this capability is never request data.
 * @internal @category services @since 0.0.0
 */
export interface CitationOwnedNativeProcess<E> {
  readonly retire: (retry: boolean) => Effect.Effect<void, E | CitationSafetyLimitExceeded>;
}
interface OwnedProcess {
  readonly handle: Ref.Ref<O.Option<ChildProcessHandle>>;
  readonly phase: Ref.Ref<typeof Phase.Type>;
  readonly quarantine: Effect.Effect<void>;
  readonly retire: Effect.Effect<boolean>;
  readonly retirement: Ref.Ref<O.Option<Fiber.Fiber<boolean>>>;
  readonly retirementLock: Semaphore.Semaphore;
  readonly scope: Scope.Closeable;
}
/** @internal @category models @since 0.0.0 */
export class CitationNativeProcessOwnerSnapshot extends S.Opaque<
  CitationNativeProcessOwnerSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({ processes: S.Natural, quarantined: S.Natural, closed: S.Boolean }).pipe(
    $I.annoteSchema("CitationNativeProcessOwnerSnapshot", {
      description: "Source-free physical ownership diagnostics, separate from operation and native admission.",
    })
  )
) {}

/**
 * Capture Clock, spawner and owner Scope for exact-process retirement. Start
 * registers ownership before OS spawn and returns its Exit alongside the owned
 * resource even on spawn failure. Call it in a masked transfer and retain that
 * resource before inspecting the Exit. Acknowledged retirement alone invokes
 * the binding's release; timeout/cancellation retain it under quarantine.
 * Only retirement tasks detach, bounded by outstanding native leases. Methods
 * have R = never and retain authority after their owner Scope closes.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeProcessOwner = Effect.fn("Citation.makeNativeProcessOwner")(function* <E>(
  policy: unknown,
  operation: CitationSafetyLimitExceeded["operation"],
  fail: (reason: CitationNativeProcessFailureReason) => E
) {
  const limits = yield* S.decodeUnknownEffect(LimitsType)(policy).pipe(Effect.mapError(() => fail("invalid-runtime")));
  const cleanupDeadline = limits.cleanupDeadline.pipe(Duration.toMillis, Duration.millis);
  const concurrency = limits.concurrentOperations;
  const clock = yield* Clock.Clock;
  const spawner = yield* ChildProcessSpawner;
  const ownerScope = yield* Scope.Scope;
  const birthLock = yield* Semaphore.make(1);
  const closed = yield* Ref.make(false);
  const owned = yield* Ref.make<ReadonlyArray<OwnedProcess>>([]);
  const quarantine = Effect.gen(function* () {
    const phases = yield* Effect.forEach(yield* Ref.get(owned), (lease) => Ref.get(lease.phase), { concurrency: 1 });
    return A.filter(phases, (phase) => phase === "quarantined").length;
  });
  const ensureOpen = Effect.gen(function* () {
    if (yield* Ref.get(closed)) return yield* Effect.fail(fail("closed"));
    if ((yield* quarantine) > 0) return yield* Effect.fail(fail("quarantined"));
  });
  const startRetirement = Effect.fn("Citation.startNativeRetirement")((lease: OwnedProcess, retry: boolean) =>
    lease.retirementLock.withPermit(
      Effect.gen(function* () {
        const previous = yield* Ref.get(lease.retirement);
        if (O.isSome(previous)) {
          const state = yield* Effect.sync(() => O.fromUndefinedOr(previous.value.pollUnsafe()));
          if (O.isNone(state) || !retry || (Exit.isSuccess(state.value) && state.value.value)) return previous.value;
        }
        yield* Ref.set(lease.phase, "stopping");
        const task = yield* lease.retire.pipe(Effect.provideService(Clock.Clock, clock), Effect.forkDetach);
        yield* Ref.set(lease.retirement, O.some(task));
        return task;
      })
    )
  );
  const retire = Effect.fn("Citation.awaitNativeRetirement")(
    function* (lease: OwnedProcess, retry: boolean) {
      const task = yield* startRetirement(lease, retry);
      const observed = yield* Fiber.await(task).pipe(Effect.interruptible, Effect.timeoutOption(cleanupDeadline));
      if (O.isSome(observed) && Exit.isSuccess(observed.value) && observed.value.value) return;
      yield* Ref.set(lease.phase, "quarantined");
      yield* lease.quarantine;
      if (O.isNone(observed)) return yield* CitationSafetyLimitExceeded.make({ operation, limit: "cleanupDeadline" });
      return yield* Effect.fail(fail("cleanup-unconfirmed"));
    },
    Effect.provideService(Clock.Clock, clock)
  );
  const snapshot = Effect.gen(function* () {
    return CitationNativeProcessOwnerSnapshot.make({
      processes: (yield* Ref.get(owned)).length,
      quarantined: yield* quarantine,
      closed: yield* Ref.get(closed),
    });
  });
  const reap = Effect.fn("Citation.reapNativeWorkers")(
    function* () {
      const records = yield* birthLock.withPermit(Ref.get(owned));
      yield* Effect.forEach(records, (lease) => retire(lease, true), { concurrency, discard: true });
    },
    Effect.provideService(Clock.Clock, clock)
  );
  yield* Scope.addFinalizer(
    ownerScope,
    Effect.gen(function* () {
      yield* Ref.set(closed, true);
      yield* reap().pipe(
        Effect.catchCause(() =>
          Effect.logError("Citation native ownership remains quarantined after the cleanup window")
        )
      );
    })
  );
  const start = Effect.fn("Citation.startOwnedNativeProcess")(
    (command: ChildProcess.Command, binding: CitationNativeProcessLease) =>
      birthLock
        .withPermit(
          Effect.gen(function* () {
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
              quarantine: binding.quarantine,
              retire: Effect.gen(function* () {
                const child = yield* Ref.get(handle);
                if (O.isSome(child)) {
                  const running = yield* child.value.isRunning.pipe(Effect.orElseSucceed(() => true));
                  if (running)
                    yield* Effect.exit(child.value.kill({ killSignal: "SIGKILL", forceKillAfter: Duration.zero }));
                  if (yield* child.value.isRunning.pipe(Effect.orElseSucceed(() => true))) return false;
                }
                const finalized = yield* Effect.exit(Scope.close(scope, Exit.void));
                if (Exit.isFailure(finalized)) return false;
                yield* Ref.update(owned, (records) => A.filter(records, (entry) => entry !== resource));
                yield* binding.release;
                return true;
              }).pipe(Effect.withSpan("Citation.retireNativeProcess")),
            };
            yield* Ref.update(owned, (records) => A.append(records, resource));
            const child = yield* spawner.spawn(command).pipe(
              Effect.provideService(Scope.Scope, scope),
              Effect.mapError(() => fail("spawn-failed")),
              Effect.exit
            );
            if (Exit.isSuccess(child)) {
              yield* Ref.set(handle, O.some(child.value));
              yield* Ref.set(phase, "running");
            }
            const process: CitationOwnedNativeProcess<E> = { retire: (retry) => retire(resource, retry) };
            return { process, child };
          })
        )
        .pipe(Effect.uninterruptible, Effect.provideService(Clock.Clock, clock))
  );
  return { ensureOpen, snapshot, reap, start };
});
