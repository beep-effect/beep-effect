/**
 * Review hub service contract: the four operations the hub's MCP tools serve.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { AnswerRow, VerdictRow } from "@beep/law-practice-domain";
import type * as Effect from "effect/Effect";
import type { RecordVerdictInput } from "../ReviewQueue/ReviewQueue.ports.ts";
import type { ReviewHubToolError } from "./ReviewHub.errors.ts";
import type { LockBatchRequest, OpenItems, OpenItemsRequest, RecordAnswerRequest } from "./ReviewHub.schemas.ts";

const $I = $LawPracticeUseCasesId.create("ReviewHub/ReviewHub.ports");

/**
 * Service shape of the review hub.
 *
 * **Details**
 *
 * Each operation fails only with a `ReviewHubToolError` carrying a stable
 * code, so a tool can return the failure as it is. Only `openItems` reads;
 * the other three append one row.
 *
 * **Example** (Name a hub operation)
 *
 * ```ts
 * import type { ReviewHubShape } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * const operation: keyof ReviewHubShape = "openItems"
 * console.log(operation) // "openItems"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ReviewHubShape {
  /** Lock one batch and return its lock row; `not-found` for a batch with no verdicts, `locked` when already locked. */
  readonly lockBatch: (request: LockBatchRequest) => Effect.Effect<VerdictRow, ReviewHubToolError>;
  /** The open verdict items plus the question digest for the day, in store order. */
  readonly openItems: (request: OpenItemsRequest) => Effect.Effect<OpenItems, ReviewHubToolError>;
  /** Look up the stored question, then record the answer; `not-found`, `repair-required` or `unknown-option` when it does not fit. */
  readonly recordAnswer: (request: RecordAnswerRequest) => Effect.Effect<AnswerRow, ReviewHubToolError>;
  /** Record a verdict as the item's next revision in the batch; `repair-required` for an unrepaired legacy import, `locked` when the batch is locked. */
  readonly recordVerdict: (input: RecordVerdictInput) => Effect.Effect<VerdictRow, ReviewHubToolError>;
}

/**
 * The workstation review hub: the review queue, the question queue and the
 * item store behind one set of operations.
 *
 * **Example** (Reference the hub service)
 *
 * ```ts
 * import { ReviewHub } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(ReviewHub.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ReviewHub extends Context.Service<ReviewHub, ReviewHubShape>()($I`ReviewHub`) {}
