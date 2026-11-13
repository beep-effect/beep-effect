/**
 * Shared check-run schema for merge gating and post-merge completion observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Yeet/internal/MergeGate");

/**
 * One check run on the head commit, reduced to what the gate reads.
 *
 * **Details**
 *
 * `checkSuiteId` is the check suite the run reports into, none when GitHub
 * sent none (and in reads recorded before the gate kept it). The gate maps it
 * to the workflow run that owns the suite to find required checks a newer run
 * shadows.
 *
 * **Example** (A green required run)
 *
 * ```ts
 * import { MergeGateCheckRun } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const run = MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" })
 * console.log(run.name) // "Lint"
 * console.log(O.isNone(run.checkSuiteId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateCheckRun extends S.Opaque<MergeGateCheckRun, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Finite,
    name: S.NonEmptyString,
    status: S.String,
    conclusion: S.NullOr(S.String),
    checkSuiteId: S.Int.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("MergeGateCheckRun", {
      description: "One check run on the pull request head, as the gate reads it.",
    })
  )
) {}

/**
 * Whether a check run conclusion counts as green for the gate: success,
 * skipped, or neutral. A pending run (no conclusion) is not green.
 *
 * **Example** (Classify conclusions)
 *
 * ```ts
 * import { mergeGateGoodConclusion } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(mergeGateGoodConclusion("skipped")) // true
 * console.log(mergeGateGoodConclusion(null)) // false
 * ```
 *
 * @param conclusion - The run's conclusion, `null` while it runs.
 * @returns Whether the run is green.
 * @category predicates
 * @since 0.0.0
 */
export const mergeGateGoodConclusion = (conclusion: string | null): boolean =>
  conclusion === "success" || conclusion === "skipped" || conclusion === "neutral";
