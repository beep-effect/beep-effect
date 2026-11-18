/**
 * Service contract for the machine-wide admission scheduler (SCHE-08).
 *
 * Callers admit heavy work, read and repair admission state, flip the
 * mixed-checkout protocol gates and journal worker routing through this one
 * boundary instead of the scheduler's module functions. The live Layer,
 * `QualitySchedulerLive` in `QualityScheduler.ts`, delegates to the existing
 * implementation, so admission order, weights, the review-fix class cap and
 * journal rows are unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  AdmissionEvictionEmission,
  AdmissionJournalArchive,
  AdmissionJournalHistory,
  AdmissionPressureEmission,
  AdmissionProtocol,
  AdmissionUnitEmission,
} from "./AdmissionJournal.ts";
import type { MemoryStats } from "./MemoryStats.service.ts";
import type {
  AdmissionConfig,
  AdmissionRequest,
  AdmissionRoute,
  AdmissionSnapshot,
  QualitySchedulerError,
} from "./QualityScheduler.schemas.ts";
import type { AdmissionOriginGate } from "./QualityScheduler.ts";

const $I = $RepoCliId.create("internal/repo-run/QualityScheduler.service");

// Each operation keeps the requirements its implementation reads from the
// caller, as the scheduler's journal services do (see the service's Details).
type AdmissionDirectoryServices = SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path;
type AdmissionJournalServices = AdmissionDirectoryServices | Digest.Digest;
type AdmissionStateServices = AdmissionJournalServices | MemoryStats | ChildProcessSpawner.ChildProcessSpawner;

/**
 * Operations of the {@link QualityScheduler} service.
 *
 * @category services
 * @since 0.0.0
 */
export interface QualitySchedulerShape {
  /**
   * Run `use` under machine-wide weighted admission.
   *
   * Enqueues a durable ticket, waits until the request is first in priority
   * and FIFO order and its weight fits live capacity, runs `use` under a
   * heartbeated lease, then releases the lease. Interrupting a queued request
   * withdraws its ticket.
   */
  readonly admit: <Success, UseError, UseRequirements, OriginLease, GateError, GateRequirements>(
    request: AdmissionRequest,
    gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
    use: Effect.Effect<Success, UseError, UseRequirements>,
    config?: AdmissionConfig
  ) => Effect.Effect<
    Success,
    UseError | GateError | QualitySchedulerError,
    UseRequirements | GateRequirements | AdmissionStateServices
  >;
  /** List the admission-journal archive's day segments. */
  readonly archive: Effect.Effect<AdmissionJournalArchive, QualitySchedulerError, AdmissionDirectoryServices>;
  /** Fold the archived and live admission-journal rows into one history. */
  readonly history: Effect.Effect<AdmissionJournalHistory, QualitySchedulerError, AdmissionDirectoryServices>;
  /** Read capacity, leases and queue without repairing anything. */
  readonly observe: (
    config?: AdmissionConfig
  ) => Effect.Effect<AdmissionSnapshot, QualitySchedulerError, AdmissionStateServices>;
  /** Read the admission protocol marker (eviction, unit and pressure gates). */
  readonly protocol: Effect.Effect<AdmissionProtocol, QualitySchedulerError, AdmissionDirectoryServices>;
  /** Reap dead admission state; a dry run unless `apply` is set. */
  readonly reap: (options: {
    readonly apply: boolean;
  }) => Effect.Effect<AdmissionSnapshot, QualitySchedulerError, AdmissionStateServices>;
  /** Journal one routing decision a `worker` host made without the queue, best effort. */
  readonly recordRoute: (route: AdmissionRoute) => Effect.Effect<void, never, AdmissionJournalServices>;
  /** Turn eviction rows on or off; the unit gate keeps its state. */
  readonly setEvictionProtocol: (
    eviction: AdmissionEvictionEmission
  ) => Effect.Effect<AdmissionProtocol, QualitySchedulerError, AdmissionJournalServices>;
  /** Turn the capacity and host-pressure stamp on admitted and released rows on or off. */
  readonly setPressureProtocol: (
    pressure: AdmissionPressureEmission
  ) => Effect.Effect<AdmissionProtocol, QualitySchedulerError, AdmissionJournalServices>;
  /** Turn admission-unit fields, and the work kinds written behind them, on or off. */
  readonly setUnitProtocol: (
    units: AdmissionUnitEmission
  ) => Effect.Effect<AdmissionProtocol, QualitySchedulerError, AdmissionJournalServices>;
}

/**
 * The machine-wide admission scheduler as one service.
 *
 * **Details**
 *
 * Production code reaches the scheduler only through this service; the
 * `QualitySchedulerLive` Layer provides the real implementation. A test can
 * provide a recording or refusing implementation instead, for example to
 * check which work kind a command requests without touching admission state.
 *
 * Operations read their platform services and `MemoryStats` from the caller,
 * as they did as module functions, rather than from the Layer: resolving them
 * at Layer creation would hand the Layer's services to the admitted work and
 * the origin gate, and would fix the memory reading per Layer instead of per
 * call. The shared platform requirement is therefore expected
 * (\@effect-expect-leaking FileSystem | Path | SecureRandom).
 *
 * **Example** (Provide a scheduler that records the requested work kind)
 *
 * ```ts
 * import { QualityScheduler } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const requested: Array<string> = []
 * const recording = Layer.succeed(
 *   QualityScheduler,
 *   QualityScheduler.of({
 *     admit: (request, _gate, use) => Effect.andThen(Effect.sync(() => requested.push(request.kind)), use),
 *     observe: () => Effect.die("unused"),
 *     reap: () => Effect.die("unused"),
 *     protocol: Effect.die("unused"),
 *     setEvictionProtocol: () => Effect.die("unused"),
 *     setUnitProtocol: () => Effect.die("unused"),
 *     setPressureProtocol: () => Effect.die("unused"),
 *     history: Effect.die("unused"),
 *     archive: Effect.die("unused"),
 *     recordRoute: () => Effect.void
 *   })
 * )
 * console.log(Layer.isLayer(recording)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class QualityScheduler extends Context.Service<QualityScheduler, QualitySchedulerShape>()(
  $I`QualityScheduler`
) {}
