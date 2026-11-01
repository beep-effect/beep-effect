/**
 * Narrow lifecycle ports for an owning launch controller.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ManagedSessionIdentity } from "./AiProviderCliSession.models.ts";

/**
 * Read-only evidence from the actual operating-system child handle.
 * **Details** PID alone is not a durable identity. The controller must bind its
 * own launch occurrence before hashing or exporting it. Exit code is process
 * evidence, never a task-quality score. No stdio or kill capability is exposed.
 * **Example** (Inspect the owned process)
 * ```ts
 * import type { ManagedSessionProcess } from "@beep/ai-provider-cli"
 * const inspect = (process: ManagedSessionProcess) => process.isRunning
 * console.log(inspect)
 * ```
 * @category ports
 * @since 0.0.0
 */
export type ManagedSessionProcess = Pick<ChildProcessSpawner.ChildProcessHandle, "pid" | "exitCode" | "isRunning">;

/**
 * Explicit owner-supplied lifecycle observations, without telemetry dependencies.
 * **Details** started follows successful OS spawn and precedes initialization;
 * bound follows validated adapter initialization and preserves policyEvidence.
 * Each callback has a five-second deadline and is called once, without retries.
 * Failure closes the newly owned process before open fails. A callback may have
 * committed before losing its acknowledgment: the caller must reconcile its
 * durable attempt and must not call open again as a telemetry retry.
 * **Example** (Declare an observer port)
 * ```ts
 * import type { ManagedSessionObserver } from "@beep/ai-provider-cli"
 * const inspect = (observer: ManagedSessionObserver) => observer.started
 * console.log(inspect)
 * ```
 * @category ports
 * @since 0.0.0
 */
export interface ManagedSessionObserver {
  readonly bound: (identity: ManagedSessionIdentity) => Effect.Effect<void, ManagedSessionError>;
  readonly started: (process: ManagedSessionProcess) => Effect.Effect<void, ManagedSessionError>;
}

/**
 * Apply the fixed observation deadline without retrying an uncertain write.
 * **Example** (Bound one lifecycle observation)
 * ```ts
 * import { observeManagedSession } from "@beep/ai-provider-cli/AiProviderCliSession.lifecycle"
 * import * as Effect from "effect/Effect"
 * const observation = observeManagedSession("observe-started", Effect.void)
 * Effect.runPromise(observation)
 * ```
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const observeManagedSession = Effect.fn("AiProviderCliSession.observe")(
  (operation: "observe-started" | "observe-bound", effect: Effect.Effect<void, ManagedSessionError>) =>
    effect.pipe(
      Effect.mapError(() =>
        ManagedSessionError.make({
          reason: "transport",
          operation,
          message: "Launch observation failed; reconcile the owned attempt before retry",
        })
      ),
      Effect.timeoutOrElse({
        duration: Duration.seconds(5),
        orElse: () =>
          Effect.fail(
            ManagedSessionError.make({
              reason: "timeout",
              operation,
              message: "Launch observation deadline elapsed; reconcile the owned attempt before retry",
            })
          ),
      })
    )
);

/**
 * Observe a spawned child through the restricted process-evidence port.
 *
 * **Details**
 *
 * Copies only PID, exit and running evidence. When present, the
 * observer runs once under the existing deadline before adapter initialization;
 * uncertain observation is never retried here. The returned port is the same
 * object supplied to the observer and exposes no stdio or kill capability.
 *
 * **Example** (Inspect the started-process observer)
 *
 * ```ts
 * import { observeStartedManagedProcess } from "@beep/ai-provider-cli/AiProviderCliSession.lifecycle"
 * console.log(typeof observeStartedManagedProcess)
 * ```
 *
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const observeStartedManagedProcess = Effect.fnUntraced(function* (
  handle: ManagedSessionProcess,
  observer?: ManagedSessionObserver
) {
  const process = { pid: handle.pid, exitCode: handle.exitCode, isRunning: handle.isRunning };
  if (observer !== undefined)
    yield* observeManagedSession(
      "observe-started",
      Effect.suspend(() => observer.started(process))
    );
  return process;
});
