/**
 * Tail-wait A/B for SCHE-06 over a recorded admission journal (PLAN slice 12).
 *
 * **Details**
 *
 * The replay joins each nonce's admitted and released rows into one
 * {@link UnitArrival}: its recorded enqueue instant, weight, priority, origin,
 * checkout and true hold (release minus admission). Each arrival declares a
 * causal ETA ({@link ReplayEtaEstimator}): a quantile of the same kind's holds
 * already released when it enqueued. Every arm then runs the slice 11
 * simulator on the same stream, and the report sets the arms beside the waits
 * the deployed scheduler actually recorded.
 *
 * **Gotchas**
 *
 * The simulator admits against one constant capacity and has none of the
 * live scheduler's skippable tickets (same-checkout lease, legacy origin
 * owner, review-fix class cap) or its memory-driven capacity. Arms are
 * comparable with each other; the recorded summary calibrates how far the
 * constant-capacity replay sits from the live machine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// fallow-ignore-file code-duplication -- the SCHE-06 lab model and its live port in @beep/repo-cli (QualityScheduler.ts) are deliberately mirrored: the property laws and the tail-wait A/B read this copy, and a lab app cannot be a dependency of the CLI. Owner: @beep/ciops. Exit: delete the mirrored functions here and import the live verdict once a shared scheduler-policy module exists that both packages depend on.

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PosInt } from "../projection/PosInt.ts";
import { AdmissionJournalEvent } from "../projection/Schemas.ts";
import {
  BackfillPolicy,
  ReplayArmResult,
  ReplayReport,
  ReplayStream,
  ReplayTiming,
  SimulationEvent,
  SimulationInputError,
  UnitArrival,
  WaitSummary,
} from "./Schemas.ts";
import { simulateStream } from "./Simulation.ts";
import type { AdmissionPriority, AdmissionWorkKind } from "../projection/Schemas.ts";
import type { ReplayArmSpec, ReplayEtaEstimator } from "./Schemas.ts";

interface RecordedChain {
  readonly admittedAtMillis: number;
  readonly checkoutKey: string;
  readonly enqueuedAtMillis: number;
  readonly holdMillis: number;
  readonly kind: AdmissionWorkKind;
  readonly nonce: string;
  readonly originKey: string;
  readonly priority: AdmissionPriority;
  readonly releasedAtMillis: number;
  readonly weightTokens: number;
}

interface ChainRows {
  readonly admitted: O.Option<Extract<AdmissionJournalEvent, { readonly _tag: "admission-admitted" }>>;
  readonly checkoutKey: O.Option<string>;
  readonly releasedAtMillis: O.Option<number>;
}

const emptyRows: ChainRows = { admitted: O.none(), checkoutKey: O.none(), releasedAtMillis: O.none() };

const nonEmptyCheckout = (event: object): O.Option<string> =>
  "checkoutRoot" in event && O.isOption(event.checkoutRoot)
    ? O.filter(event.checkoutRoot as O.Option<string>, Str.isNonEmpty)
    : O.none();

const foldRow = (rows: ChainRows, event: AdmissionJournalEvent): ChainRows =>
  Match.value(event).pipe(
    Match.tag("admission-admitted", (admitted): ChainRows => ({ ...rows, admitted: O.some(admitted) })),
    Match.tag(
      "admission-released",
      (released): ChainRows => ({
        ...rows,
        releasedAtMillis: O.some(released.releasedAtMillis),
        checkoutKey: O.orElse(rows.checkoutKey, () => nonEmptyCheckout(released)),
      })
    ),
    Match.tag(
      "admission-enqueued",
      (enqueued): ChainRows => ({ ...rows, checkoutKey: O.orElse(rows.checkoutKey, () => nonEmptyCheckout(enqueued)) })
    ),
    Match.orElse(() => rows)
  );

const chainOrder: Order.Order<RecordedChain> = pipe(
  Order.mapInput(Order.Number, (chain: RecordedChain) => chain.enqueuedAtMillis),
  Order.combine(Order.mapInput(Order.String, (chain: RecordedChain) => chain.nonce))
);

const joinChains = (
  events: ReadonlyArray<AdmissionJournalEvent>
): { readonly chains: ReadonlyArray<RecordedChain>; readonly skipped: number } => {
  const byNonce = A.reduce(events, HashMap.empty<string, ChainRows>(), (index, event) =>
    HashMap.set(
      index,
      event.nonce,
      foldRow(
        O.getOrElse(HashMap.get(index, event.nonce), () => emptyRows),
        event
      )
    )
  );
  const joined = A.map(HashMap.toEntries(byNonce), ([nonce, rows]) =>
    O.zipWith(rows.admitted, rows.releasedAtMillis, (admitted, releasedAtMillis) => ({
      nonce,
      kind: admitted.kind,
      priority: admitted.priority,
      weightTokens: admitted.weightTokens,
      originKey: admitted.originKey,

      checkoutKey: O.getOrElse(rows.checkoutKey, () => nonce),
      enqueuedAtMillis: admitted.enqueuedAtMillis,
      admittedAtMillis: admitted.admittedAtMillis,
      releasedAtMillis,
      holdMillis: N.max(releasedAtMillis - admitted.admittedAtMillis, 1),
    }))
  );
  const chains = A.sort(A.getSomes(joined), chainOrder);
  return { chains, skipped: A.length(joined) - A.length(chains) };
};

const nearestRank = (sorted: ReadonlyArray<number>, permille: number): number =>
  A.match(sorted, {
    onEmpty: () => 0,
    onNonEmpty: (samples) =>
      A.getUnsafe(
        samples,
        N.clamp(Math.ceil((permille * A.length(samples)) / 1000) - 1, { minimum: 0, maximum: A.length(samples) - 1 })
      ),
  });

/**
 * Nearest-rank wait quantiles of one population of waits.
 *
 * **Example** (Summarize three waits)
 *
 * ```ts
 * import { summarizeWaits } from "@/backfill/JournalReplay"
 *
 * const summary = summarizeWaits([0, 1_000, 90_000])
 * console.log(summary.maxMillis, summary.overMinute) // 90000 1
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const summarizeWaits = (waits: ReadonlyArray<number>): WaitSummary => {
  const sorted = A.sort(
    A.map(waits, (wait) => N.max(Math.round(wait), 0)),
    Order.Number
  );
  const count = A.length(sorted);
  return WaitSummary.make({
    count: S.Natural.make(count),
    p50Millis: S.Natural.make(nearestRank(sorted, 500)),
    p90Millis: S.Natural.make(nearestRank(sorted, 900)),
    p95Millis: S.Natural.make(nearestRank(sorted, 950)),
    p99Millis: S.Natural.make(nearestRank(sorted, 990)),
    maxMillis: S.Natural.make(nearestRank(sorted, 1000)),
    meanMillis: S.Natural.make(count === 0 ? 0 : Math.round(N.sumAll(sorted) / count)),
    overMinute: S.Natural.make(A.length(A.filter(sorted, (wait) => wait > 60_000))),
  });
};

const releaseOrder: Order.Order<RecordedChain> = Order.mapInput(
  Order.Number,
  (chain: RecordedChain) => chain.releasedAtMillis
);

const causalEta = (
  estimator: ReplayEtaEstimator,
  released: ReadonlyArray<RecordedChain>,
  chain: RecordedChain
): O.Option<PosInt> => {
  const prior = pipe(
    A.filter(released, (done) => done.kind === chain.kind && done.releasedAtMillis <= chain.enqueuedAtMillis),
    A.takeRight(estimator.historyLimit),
    A.map((done) => done.holdMillis),
    A.sort(Order.Number)
  );
  return A.length(prior) < estimator.minSamples
    ? O.none()
    : PosInt.makeOption(N.max(nearestRank(prior, estimator.quantilePermille), 1));
};

/**
 * The replay stream of one journal: recorded arrivals with causal ETAs, rebased to the first enqueue.
 *
 * **Example** (An empty journal replays nothing)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { arrivalsFromJournal } from "@/backfill/JournalReplay"
 * import { ReplayEtaEstimator } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const estimator = ReplayEtaEstimator.make({
 *   quantilePermille: PosInt.make(900),
 *   minSamples: PosInt.make(5),
 *   historyLimit: PosInt.make(200)
 * })
 * console.log(arrivalsFromJournal([], estimator).arrivals.length) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const arrivalsFromJournal: {
  (estimator: ReplayEtaEstimator): (events: ReadonlyArray<AdmissionJournalEvent>) => ReplayStream;
  (events: ReadonlyArray<AdmissionJournalEvent>, estimator: ReplayEtaEstimator): ReplayStream;
} = dual(2, (events: ReadonlyArray<AdmissionJournalEvent>, estimator: ReplayEtaEstimator): ReplayStream => {
  const { chains, skipped } = joinChains(events);
  const released = A.sort(chains, releaseOrder);
  const origin = O.getOrElse(
    O.map(A.head(chains), (chain) => chain.enqueuedAtMillis),
    () => 0
  );
  const last = O.getOrElse(
    O.map(A.last(chains), (chain) => chain.enqueuedAtMillis),
    () => origin
  );
  const arrivals = A.map(chains, (chain) =>
    UnitArrival.make({
      nonce: chain.nonce,
      originKey: chain.originKey,
      checkoutKey: chain.checkoutKey,
      priority: chain.priority,
      requestedWeightTokens: chain.weightTokens,
      enqueuedAtMillis: S.Natural.make(chain.enqueuedAtMillis - origin),
      etaMillis: causalEta(estimator, released, chain),
      holdMillis: PosInt.make(Math.round(chain.holdMillis)),
    })
  );
  return ReplayStream.make({
    arrivals,
    recordedWaits: A.map(chains, (chain) => chain.admittedAtMillis - chain.enqueuedAtMillis),
    skipped: S.Natural.make(skipped),
    spanMillis: S.Natural.make(last - origin),
  });
});

/**
 * The deployed timing: 120 s publish aging and protection, a 30-minute
 * fairness window and the 5 s heartbeat as promotion overhead.
 *
 * @category models
 * @since 0.0.0
 */
export const deployedReplayTiming: ReplayTiming = ReplayTiming.make({
  publishAgingMillis: PosInt.make(120_000),
  protectAfterMillis: PosInt.make(120_000),
  fairnessWindowMillis: PosInt.make(1_800_000),
  promotionOverheadMillis: S.Natural.make(5_000),
});

const runArm = Effect.fnUntraced(function* (
  timing: ReplayTiming,
  arrivals: ReadonlyArray<UnitArrival>,
  arm: ReplayArmSpec
): Effect.fn.Return<ReplayArmResult, SimulationInputError> {
  const policy = BackfillPolicy.make({
    capacityTokens: arm.capacityTokens,
    publishAgingMillis: timing.publishAgingMillis,
    protectAfterMillis: timing.protectAfterMillis,
    fairnessWindowMillis: timing.fairnessWindowMillis,
    promotionOverheadMillis: S.Natural.make(timing.promotionOverheadMillis),
    backfill: arm.backfill,
    fairness: arm.fairness,
  });
  const report = yield* simulateStream(policy, arrivals);
  return ReplayArmResult.make({
    arm,
    waits: summarizeWaits(A.map(report.outcomes, (outcome) => outcome.admittedAtMillis - outcome.enqueuedAtMillis)),
    backfills: S.Natural.make(A.length(A.filter(report.outcomes, (outcome) => outcome.route === "backfill"))),
    breaches: S.Natural.make(A.length(A.filter(report.events, SimulationEvent.guards.BoundBreached))),
    peakActiveTokens: report.peakActiveTokens,
  });
});

/**
 * Replay one journal through every arm and set the results beside the recorded waits.
 *
 * **Example** (Replay an empty journal)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { deployedReplayTiming, replayTailWaits } from "@/backfill/JournalReplay"
 * import { ReplayArmSpec, ReplayEtaEstimator } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const estimator = ReplayEtaEstimator.make({
 *   quantilePermille: PosInt.make(900),
 *   minSamples: PosInt.make(5),
 *   historyLimit: PosInt.make(200)
 * })
 * const arm = ReplayArmSpec.make({ capacityTokens: PosInt.make(10), backfill: "off", fairness: "off" })
 * const report = Effect.runSync(replayTailWaits([], estimator, [arm], deployedReplayTiming))
 * console.log(report.chains) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const replayTailWaits = Effect.fn("BackfillModel.replayTailWaits")(function* (
  events: ReadonlyArray<AdmissionJournalEvent>,
  estimator: ReplayEtaEstimator,
  arms: ReadonlyArray<ReplayArmSpec>,
  timing: ReplayTiming = deployedReplayTiming
): Effect.fn.Return<ReplayReport, SimulationInputError> {
  const stream = arrivalsFromJournal(events, estimator);
  const results = yield* Effect.forEach(arms, (arm) => runArm(timing, stream.arrivals, arm), { concurrency: 1 });
  return ReplayReport.make({
    chains: S.Natural.make(A.length(stream.arrivals)),
    skipped: S.Natural.make(stream.skipped),
    spanMillis: S.Natural.make(stream.spanMillis),
    etaDeclared: S.Natural.make(A.length(A.filter(stream.arrivals, (arrival) => O.isSome(arrival.etaMillis)))),
    estimator,
    recorded: summarizeWaits(stream.recordedWaits),
    arms: results,
  });
});

const ReplayTag = S.Literals([
  "admission-admitted",
  "admission-released",
  "admission-enqueued",
  "admission-withdrawn",
  "admission-lease-evicted",
  "admission-ticket-evicted",
]);
const decodeReplayTag = S.decodeUnknownOption(S.fromJsonString(S.Struct({ _tag: ReplayTag })));
const decodeJournalRow = S.decodeUnknownOption(S.fromJsonString(AdmissionJournalEvent));

/**
 * Decode raw journal lines for the replay, failing only on schema drift.
 *
 * **Details**
 *
 * A line whose `_tag` is a replay tag must decode; one that does not is a
 * newer row shape the lab decoder must learn, and the replay refuses it
 * rather than shrinking. Every other line is opaque and counted, not decoded:
 * worker `admission-routed` rows, torn tails the journal writer can leave,
 * and tags this lab does not know.
 *
 * **Example** (A routed row is opaque)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeJournalLines } from "@/backfill/JournalReplay"
 *
 * const read = Effect.runSync(decodeJournalLines(['{"_tag":"admission-routed","nonce":"r"}']))
 * console.log(read.events.length, read.opaqueLines) // 0 1
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const decodeJournalLines = Effect.fn("BackfillModel.decodeJournalLines")(function* (
  lines: ReadonlyArray<string>
): Effect.fn.Return<
  { readonly events: ReadonlyArray<AdmissionJournalEvent>; readonly opaqueLines: number },
  SimulationInputError
> {
  const replayLines = A.filter(lines, (line) => O.isSome(decodeReplayTag(line)));
  const decoded = A.map(replayLines, (line) => decodeJournalRow(line));
  const drifted = A.length(A.filter(decoded, O.isNone));
  if (drifted > 0) {
    return yield* SimulationInputError.make({
      message: `${drifted} of ${A.length(replayLines)} replay rows did not decode; update the lab journal decoder before replaying.`,
    });
  }
  return { events: A.getSomes(decoded), opaqueLines: A.length(lines) - A.length(replayLines) };
});
