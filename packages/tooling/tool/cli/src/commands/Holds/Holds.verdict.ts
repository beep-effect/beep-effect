/**
 * Hold probe verdict rules: a probe is trusted only when its control still
 * reproduces the recorded failure, and a flip needs two consecutive passing runs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import { ProbeOutcome as ProbeOutcomeSchema, ProbeRunVerdict as ProbeRunVerdictSchema } from "./Holds.schemas.ts";
import type { HoldVerdict, ProbeOutcome, ProbeRun, ProbeRunVerdict } from "./Holds.schemas.ts";

/**
 * Judge one control-plus-candidate run.
 *
 * **Details**
 *
 * A control that passes means the probe no longer detects the hazard, so the
 * run is `probe-broken` whatever the candidate did. An inconclusive control or
 * candidate is never read as a pass.
 *
 * **Example** (A control that still fails and a candidate that passes)
 *
 * ```ts
 * import { judgeProbeRun, ProbeOutcome } from "@beep/repo-cli/commands/Holds"
 *
 * const verdict = judgeProbeRun(ProbeOutcome.cases.Reproduced.make({}), ProbeOutcome.cases.Passed.make({}))
 * console.log(verdict) // "candidate-passed"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const judgeProbeRun: {
  (candidate: ProbeOutcome): (control: ProbeOutcome) => ProbeRunVerdict;
  (control: ProbeOutcome, candidate: ProbeOutcome): ProbeRunVerdict;
} = dual(
  2,
  (control: ProbeOutcome, candidate: ProbeOutcome): ProbeRunVerdict =>
    ProbeOutcomeSchema.match(control, {
      Passed: (): ProbeRunVerdict => "probe-broken",
      Inconclusive: (): ProbeRunVerdict => "inconclusive",
      Reproduced: () =>
        ProbeOutcomeSchema.match(candidate, {
          Reproduced: (): ProbeRunVerdict => "still-holds",
          Passed: (): ProbeRunVerdict => "candidate-passed",
          Inconclusive: (): ProbeRunVerdict => "inconclusive",
        }),
    })
);

const verdictOf = (run: ProbeRun): ProbeRunVerdict => run.verdict;

/**
 * Fold a hold's probe history, newest run first, into whether it is safe to act.
 *
 * **Example** (Two consecutive passes flip a hold)
 *
 * ```ts
 * import { confirmHoldVerdict } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(confirmHoldVerdict(["candidate-passed", "candidate-passed"])) // "Flipped"
 * console.log(confirmHoldVerdict(["candidate-passed", "still-holds"])) // "Unconfirmed"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const confirmHoldVerdict = (newestFirst: ReadonlyArray<ProbeRunVerdict>): HoldVerdict =>
  pipe(
    A.head(newestFirst),
    O.match({
      onNone: (): HoldVerdict => "Inconclusive",
      onSome: (latest) =>
        ProbeRunVerdictSchema.match(latest, {
          "probe-broken": (): HoldVerdict => "ProbeBroken",
          "still-holds": (): HoldVerdict => "StillHolds",
          inconclusive: (): HoldVerdict => "Inconclusive",
          "candidate-passed": (): HoldVerdict =>
            pipe(A.get(newestFirst, 1), O.exists(ProbeRunVerdictSchema.is["candidate-passed"]))
              ? "Flipped"
              : "Unconfirmed",
        }),
    })
  );

/**
 * {@link confirmHoldVerdict} over recorded runs, newest first.
 *
 * **Example** (No runs yet)
 *
 * ```ts
 * import { confirmHoldRuns } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(confirmHoldRuns([])) // "Inconclusive"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const confirmHoldRuns = (newestFirst: ReadonlyArray<ProbeRun>): HoldVerdict =>
  confirmHoldVerdict(A.map(newestFirst, verdictOf));
