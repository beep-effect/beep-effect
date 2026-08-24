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
 * PR 1 contains only the migrated cited-artifact gate. PR 2 widens this one
 * registry-owned domain when the remaining judge rules become typed gates.
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
export const QaJudgeGateId = makeGateId(LiteralKit(["cited-artifact-exists"]));

/**
 * Runtime type decoded by {@link QaJudgeGateId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type QaJudgeGateId = typeof QaJudgeGateId.Type;
