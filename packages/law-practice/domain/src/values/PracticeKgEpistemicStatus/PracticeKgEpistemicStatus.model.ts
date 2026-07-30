/**
 * Closed epistemic-status domain for practice knowledge-graph rows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/PracticeKgEpistemicStatus");

/**
 * Epistemic labels stored on practice knowledge-graph projections.
 *
 * @remarks
 * The distinction is load-bearing rather than descriptive: rows labelled
 * `derived-from-official-records` are reconcilable against the corpus catalog,
 * while `candidate-unreviewed` rows come from enrichment or extraction and must
 * not be presented as settled fact.
 *
 * @example
 * ```ts
 * import { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(PracticeKgEpistemicStatus)("candidate-unreviewed")
 * console.log(status) // "candidate-unreviewed"
 * console.log(PracticeKgEpistemicStatus.Enum["derived-from-official-records"])
 * // "derived-from-official-records"
 * ```
 *
 * @see {@link PracticeKgProvenanceKind} for the source-reference kinds carried beside this label.
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgEpistemicStatus = LiteralKit(["derived-from-official-records", "candidate-unreviewed"]).pipe(
  $I.annoteSchema("PracticeKgEpistemicStatus", {
    description: "Authority label distinguishing deterministic spine rows from candidate claims.",
  })
);

/**
 * Runtime type for {@link PracticeKgEpistemicStatus}.
 *
 * @example
 * ```ts
 * import type { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values"
 *
 * const isSettled = (status: PracticeKgEpistemicStatus): boolean =>
 *   status === "derived-from-official-records"
 *
 * console.log(isSettled("candidate-unreviewed")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgEpistemicStatus = typeof PracticeKgEpistemicStatus.Type;
