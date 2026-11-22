/**
 * The history slot: the contract a history service fills with a label per
 * failing item and a delta since the previous run, read under a deadline so
 * slow history never hides the verdict. `goals/gate-run-history` implements it;
 * this package ships the no-op layer and the test layers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { RunDelta } from "@beep/gate-report/ConsoleDocument";
import { GateReport } from "@beep/gate-report/GateReport";
import { Item } from "@beep/gate-report/Item";
import { fingerprint } from "@beep/gate-report/ItemKey";
import { HistoryLabel } from "@beep/gate-report/Vocabulary";
import { $RepoGateRunId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as Duration from "effect/Duration";

const $I = $RepoGateRunId.create("GateHistory");

/**
 * What history says about a report: a label per item, keyed by the item
 * key's fingerprint, the delta since the previous run of the same gate
 * and subject, and why the main baseline is absent when it is, which the
 * console says once.
 *
 * **Example** (Build an empty answer)
 *
 * ```ts
 * import { HistoryAnswer } from "@beep/repo-gate-run/GateHistory";
 *
 * console.log(Object.keys(HistoryAnswer.make({}).labels).length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryAnswer extends S.Opaque<HistoryAnswer, { readonly brand: unique symbol }>()(
  S.Struct({
    labels: S.Record(S.String, HistoryLabel).pipe(S.withConstructorDefault(Effect.succeed({}))),
    delta: S.OptionFromOptionalKey(RunDelta).pipe(S.withConstructorDefault(Effect.succeedNone)),
    baseline: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("HistoryAnswer", {
      description:
        "History labels by item fingerprint, the delta since the previous run, and why the main baseline is absent.",
    })
  )
) {}

/**
 * Reading history failed.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { HistoryReadError } from "@beep/repo-gate-run/GateHistory";
 *
 * console.log(HistoryReadError.make({ message: "store locked" })._tag); // HistoryReadError
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HistoryReadError extends S.TaggedError<HistoryReadError, { readonly brand: unique symbol }>(
  $I`HistoryReadError`
)(
  "HistoryReadError",
  { message: S.String },
  $I.annoteError<HistoryReadError>("HistoryReadError", {
    description: "Reading gate run history failed.",
  })
) {}

/**
 * The deadline a caller reads history under, in milliseconds, before it
 * renders without it. A store wait that cannot be interrupted can outlast it.
 *
 * **Example** (Read the default deadline)
 *
 * ```ts
 * import { DEFAULT_HISTORY_DEADLINE_MS } from "@beep/repo-gate-run/GateHistory";
 *
 * console.log(DEFAULT_HISTORY_DEADLINE_MS); // 250
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_HISTORY_DEADLINE_MS = 250;

/**
 * The history slot's operations.
 *
 * **Details**
 *
 * `read` answers for one report. A caller reads under its own deadline
 * ({@link DEFAULT_HISTORY_DEADLINE_MS} by default): past it, or on a
 * failure, the console renders without labels and delta and names what it
 * could not read. The answer's labels key on {@link fingerprint} of each
 * item key.
 *
 * **Example** (Read through the shape)
 *
 * ```ts
 * import type { GateHistoryShape } from "@beep/repo-gate-run/GateHistory";
 *
 * const readOf = (history: GateHistoryShape) => history.read;
 * console.log(typeof readOf); // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GateHistoryShape {
  readonly read: (report: GateReport) => Effect.Effect<HistoryAnswer, HistoryReadError>;
}

/**
 * The history slot service.
 *
 * **Example** (Provide the no-op layer)
 *
 * ```ts
 * import { GateHistory } from "@beep/repo-gate-run/GateHistory";
 * import * as Layer from "effect/Layer";
 *
 * console.log(Layer.isLayer(GateHistory.layerNone)); // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GateHistory extends Context.Service<GateHistory, GateHistoryShape>()($I`GateHistory`) {
  /**
   * No history: every read answers at once with no labels and no delta.
   *
   * **Example** (Reference the no-op layer)
   *
   * ```ts
   * import { GateHistory } from "@beep/repo-gate-run/GateHistory";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateHistory.layerNone)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerNone: Layer.Layer<GateHistory> = Layer.succeed(
    GateHistory,
    GateHistory.of({
      read: Effect.fn("GateHistory.read")(function* () {
        return HistoryAnswer.make({});
      }),
    })
  );

  /**
   * A fixed answer for every report, for tests.
   *
   * **Example** (Answer with a delta)
   *
   * ```ts
   * import { RunDelta } from "@beep/gate-report/ConsoleDocument";
   * import { GateHistory, HistoryAnswer } from "@beep/repo-gate-run/GateHistory";
   * import * as Layer from "effect/Layer";
   * import * as O from "effect/Option";
   *
   * const answer = HistoryAnswer.make({ delta: O.some(RunDelta.make({ fixed: 1, stillFailing: 0, new: 0 })) });
   * console.log(Layer.isLayer(GateHistory.layerTest(answer))); // true
   * ```
   *
   * @param answer - what every read returns
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (answer: HistoryAnswer): Layer.Layer<GateHistory> =>
    Layer.succeed(
      GateHistory,
      GateHistory.of({
        read: Effect.fn("GateHistory.read")(function* () {
          return answer;
        }),
      })
    );

  /**
   * Every read fails, for tests.
   *
   * **Example** (Fail every read)
   *
   * ```ts
   * import { GateHistory } from "@beep/repo-gate-run/GateHistory";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateHistory.layerFailing("store locked"))); // true
   * ```
   *
   * @param message - the failure every read reports
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFailing = (message: string): Layer.Layer<GateHistory> =>
    Layer.succeed(
      GateHistory,
      GateHistory.of({
        read: Effect.fn("GateHistory.read")(function* () {
          return yield* HistoryReadError.make({ message });
        }),
      })
    );

  /**
   * Every read answers only after `delay`, for tests of a missed deadline.
   *
   * **Example** (Answer too late)
   *
   * ```ts
   * import { GateHistory } from "@beep/repo-gate-run/GateHistory";
   * import * as Duration from "effect/Duration";
   * import * as Layer from "effect/Layer";
   *
   * const layer = GateHistory.layerSlow(Duration.seconds(5));
   * console.log(Layer.isLayer(layer)); // true
   * ```
   *
   * @param delay - how long every read takes
   * @category layers
   * @since 0.0.0
   */
  static readonly layerSlow = (delay: Duration.Duration): Layer.Layer<GateHistory> =>
    Layer.succeed(
      GateHistory,
      GateHistory.of({
        read: Effect.fn("GateHistory.read")(function* () {
          yield* Effect.sleep(delay);
          return HistoryAnswer.make({});
        }),
      })
    );
}

/**
 * Put history's labels on a report's items, by item key fingerprint.
 *
 * **Details**
 *
 * An item history names gets exactly that label; an item it does not name
 * keeps the label it had.
 *
 * **Example** (Label nothing)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { applyLabels } from "@beep/repo-gate-run/GateHistory";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1, passed: 1 }),
 * });
 * console.log(applyLabels(report, {}).items.length); // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const applyLabels: {
  (report: GateReport, labels: HistoryAnswer["labels"]): GateReport;
  (labels: HistoryAnswer["labels"]): (report: GateReport) => GateReport;
} = dual(
  2,
  (report: GateReport, labels: HistoryAnswer["labels"]): GateReport =>
    GateReport.make({
      ...report,
      items: A.map(report.items, (item) =>
        pipe(
          R.get(labels, fingerprint(item.key)),
          O.map((label) => Item.make({ ...item, label: O.some(label) })),
          O.getOrElse(() => item)
        )
      ),
    })
);
