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
