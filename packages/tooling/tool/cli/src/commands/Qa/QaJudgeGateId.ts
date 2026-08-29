/**
 * Central gate-identifier domain for the QA judge contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit } from "@beep/schema/LiteralKit";
import { makeGateId } from "@beep/skill-contract";

/**
 * Finite branded gate-id domain shared by QA judge declarations and evaluators.
 *
 * **Details**
 *
 * This is the only gate-id literal domain for the QA judge. Declarations,
 * evaluators, and the aggregate contract all derive their ids from it.
 *
 * **Example** (Construct the cited-artifact gate id)
 *
 * ```ts
 * import { QaJudgeGateId } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(QaJudgeGateId.make("cited-artifact-exists"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const QaJudgeGateId = makeGateId(
  LiteralKit([
    "cited-artifact-exists",
    "cited-event-id-exists",
    "declared-round-coherent",
    "evidence-cross-check-clean",
    "judge-output-inventory-decodes",
  ])
);

/**
 * Runtime type decoded by {@link QaJudgeGateId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type QaJudgeGateId = typeof QaJudgeGateId.Type;
