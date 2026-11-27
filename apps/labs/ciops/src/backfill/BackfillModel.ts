/**
 * Service facade over the SCHE-06 backfill and fairness model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { attemptVerdict, conditionalDeadline, queueOrder } from "./Policy.ts";
import { simulateStream } from "./Simulation.ts";
import type * as O from "effect/Option";
import type {
  AttemptVerdict,
  BackfillPolicy,
  QueuedUnit,
  SchedulerView,
  SimulationInputError,
  SimulationReport,
  UnitArrival,
} from "./Schemas.ts";

const $I = $CiopsId.create("backfill/BackfillModel");

interface BackfillModelShape {
  readonly deadline: (policy: BackfillPolicy, view: SchedulerView, unit: QueuedUnit) => Effect.Effect<O.Option<number>>;
  readonly order: (policy: BackfillPolicy, view: SchedulerView) => Effect.Effect<ReadonlyArray<QueuedUnit>>;
  readonly simulate: (
    policy: BackfillPolicy,
    arrivals: ReadonlyArray<UnitArrival>
  ) => Effect.Effect<SimulationReport, SimulationInputError>;
  readonly verdict: (policy: BackfillPolicy, view: SchedulerView, nonce: string) => Effect.Effect<AttemptVerdict>;
}

/**
 * Service tag for the backfill and fairness model.
 *
 * **Details**
 *
 * `verdict`, `order` and `deadline` read the scheduler view used by the live
 * `selfMayAttempt`. `simulate` drives an arrival stream to quiescence through
 * the same verdict and journals every event.
 *
 * **Example** (Simulate an empty stream)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BackfillModel, BackfillModelLive } from "@/backfill/BackfillModel"
 * import { BackfillPolicy } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const policy = BackfillPolicy.make({
 *   capacityTokens: PosInt.make(10),
 *   publishAgingMillis: PosInt.make(120_000),
 *   protectAfterMillis: PosInt.make(120_000),
 *   fairnessWindowMillis: PosInt.make(1_800_000),
 *   promotionOverheadMillis: S.Natural.make(0),
 *   backfill: "easy",
 *   fairness: "origin-checkout"
 * })
 * const program = Effect.flatMap(BackfillModel, (model) => model.simulate(policy, []))
 * const report = Effect.runSync(Effect.provide(program, BackfillModelLive))
 * console.log(report.outcomes.length) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BackfillModel extends Context.Service<BackfillModel, BackfillModelShape>()($I`BackfillModel`) {}

/**
 * In-process layer over the pure policy and simulator.
 *
 * **Example** (Provide the model)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { BackfillModel, BackfillModelLive } from "@/backfill/BackfillModel"
 *
 * const program = Effect.provide(Effect.map(BackfillModel, (model) => model.verdict), BackfillModelLive)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BackfillModelLive: Layer.Layer<BackfillModel> = Layer.succeed(
  BackfillModel,
  BackfillModel.of({
    verdict: Effect.fn("BackfillModel.verdict")((policy: BackfillPolicy, view: SchedulerView, nonce: string) =>
      Effect.succeed(attemptVerdict(view, policy, nonce))
    ),
    order: Effect.fn("BackfillModel.order")((policy: BackfillPolicy, view: SchedulerView) =>
      Effect.succeed(queueOrder(view, policy))
    ),
    deadline: Effect.fn("BackfillModel.deadline")((policy: BackfillPolicy, view: SchedulerView, unit: QueuedUnit) =>
      Effect.succeed(conditionalDeadline(view, policy, unit))
    ),
    simulate: simulateStream,
  })
);
