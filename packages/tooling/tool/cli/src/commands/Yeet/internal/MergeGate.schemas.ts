/**
 * Shared check-run schema for merge gating and post-merge completion observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Yeet/internal/MergeGate");

/**
 * One check run on the head commit, reduced to what the gate reads.
 *
 * **Example** (A green required run)
 *
 * ```ts
 * import { MergeGateCheckRun } from "@beep/repo-cli/test/Yeet"
 *
 * const run = MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" })
 * console.log(run.name) // "Lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateCheckRun extends S.Class<MergeGateCheckRun>($I`MergeGateCheckRun`)(
  {
    id: S.Finite,
    name: S.NonEmptyString,
    status: S.String,
    conclusion: S.NullOr(S.String),
  },
  $I.annote("MergeGateCheckRun", { description: "One check run on the pull request head, as the gate reads it." })
) {}
