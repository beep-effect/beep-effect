/**
 * Server-only law-practice use-case exports (product service contracts).
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

/**
 * Claim self-check models, errors, USPTO claims port and service contract.
 *
 * **Example** (Verify the self-check service export)
 *
 * ```ts
 * import { ClaimSelfCheck } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(ClaimSelfCheck).includes("ClaimSelfCheck")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as ClaimSelfCheck from "./ClaimSelfCheck/index.ts";
/**
 * Local advisory claim self-check tool and source-quoted review envelopes.
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./ClaimSelfCheck.tools.ts";
/**
 * Daily notice: the count-only notice email, the notice-mailbox port and the
 * once-a-day notice contract.
 *
 * **Example** (Build a notice message)
 *
 * ```ts
 * import { DailyNotice } from "@beep/law-practice-use-cases/server"
 *
 * console.log(DailyNotice.noticeMessage(2).subject) // "Claude: 2 questions waiting"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as DailyNotice from "./DailyNotice/index.ts";
/** Document identification schemas, ports and pure pipeline. @category services @since 0.0.0 */
export * as DocumentIdentification from "./DocumentIdentification/index.ts";
/**
 * IR-to-law mapping service contract exports.
 *
 * **Example** (Verify IrToLaw factory export)
 *
 * ```ts
 * import * as IrToLaw from "@beep/law-practice-use-cases/IrToLaw"
 *
 * console.log(Object.keys(IrToLaw).includes("makeIrToLaw")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as IrToLaw from "./IrToLaw/index.ts";
/**
 * Mail-tagging ports, pure matter tagger, tagging job, attachment filer, and
 * undo exports.
 *
 * **Example** (Verify the tagger export)
 *
 * ```ts
 * import * as MailTagging from "@beep/law-practice-use-cases/MailTagging"
 *
 * console.log(Object.keys(MailTagging).includes("decideMatterTagging")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as MailTagging from "./MailTagging/index.ts";
/**
 * Office-action review loop service contract exports.
 *
 * **Example** (Verify review factory export)
 *
 * ```ts
 * import * as OfficeActionReview from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(Object.keys(OfficeActionReview).includes("makeOfficeActionReview")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as OfficeActionReview from "./OfficeActionReview/index.ts";
/** Atomic office-action evidence exports. @category services @since 0.0.0 */
export * as OfficeActionStructure from "./OfficeActionStructure/index.ts";
/**
 * Typed patent-claim candidate mapping exports.
 *
 * @category mapping
 * @since 0.0.0
 */
export * from "./PatentClaimCandidate/index.ts";
/**
 * Practice knowledge-graph MCP declaration exports.
 *
 * **Example** (Count practice KG tools)
 *
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(PracticeKgToolkit.tools).length) // 12
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./PracticeKg.correspondent-lookup.ts";
export * from "./PracticeKg.matter-lookup.ts";
export * from "./PracticeKg.tools.ts";
/**
 * Attorney question queue: answer submissions, typed errors, the answer-log
 * port and the queue contract.
 *
 * **Example** (Reference the question queue service)
 *
 * ```ts
 * import { QuestionQueue } from "@beep/law-practice-use-cases/server"
 *
 * console.log(QuestionQueue.QuestionQueue.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as QuestionQueue from "./QuestionQueue/index.ts";
/**
 * Question writes: proposed and applied calendar writes, typed errors, the
 * calendar port and the write contract.
 *
 * **Example** (Reference the question writes service)
 *
 * ```ts
 * import { QuestionWrites } from "@beep/law-practice-use-cases/server"
 *
 * console.log(QuestionWrites.QuestionWrites.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as QuestionWrites from "./QuestionWrites/index.ts";
/**
 * Workstation review hub: the tool failure, the tool envelopes, the hub
 * contract, its layer and the MCP tools.
 *
 * **Example** (List the review hub tools)
 *
 * ```ts
 * import { ReviewHub } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(ReviewHub.ReviewHubToolkit.tools).length) // 4
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as ReviewHub from "./ReviewHub/index.ts";
/**
 * Review-item store: the typed failure and the store port.
 *
 * **Example** (Reference the review-item store service)
 *
 * ```ts
 * import { ReviewItemStore } from "@beep/law-practice-use-cases/server"
 *
 * console.log(ReviewItemStore.ReviewItemStore.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as ReviewItemStore from "./ReviewItemStore/index.ts";
/**
 * Attorney review queue: typed errors, the verdict-log port and the queue
 * contract.
 *
 * **Example** (Reference the review queue service)
 *
 * ```ts
 * import { ReviewQueue } from "@beep/law-practice-use-cases/server"
 *
 * console.log(ReviewQueue.ReviewQueue.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as ReviewQueue from "./ReviewQueue/index.ts";
/**
 * Canonical toolkit composers.
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./Tools.ts";
/**
 * Verdict projector: claim-disposition projection values and the pure
 * projector contract.
 *
 * **Example** (Read the projector's confirm reason)
 *
 * ```ts
 * import { VerdictProjector } from "@beep/law-practice-use-cases/server"
 *
 * console.log(VerdictProjector.ATTORNEY_CONFIRMED_REASON) // "Attorney confirmed the finding"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as VerdictProjector from "./VerdictProjector/index.ts";
