/**
 * Review hub MCP tools: the contract the review-queue pane calls.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnswerRow, VerdictRow } from "@beep/law-practice-domain";
import { annotateFourHints, FourHintAnnotations } from "@beep/mcp-kit";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import { RecordVerdictInput } from "../ReviewQueue/ReviewQueue.ports.ts";
import { ReviewHubToolError } from "./ReviewHub.errors.ts";
import { LockBatchRequest, OpenItems, OpenItemsRequest, RecordAnswerRequest } from "./ReviewHub.schemas.ts";

const localStoreReadHints = FourHintAnnotations.make({
  destructive: false,
  idempotent: true,
  openWorld: false,
  readOnly: true,
});

const localStoreAppendHints = FourHintAnnotations.make({
  destructive: false,
  idempotent: false,
  openWorld: false,
  readOnly: false,
});

/**
 * Lists the items waiting for the attorney: the open verdict items plus the
 * question digest for the given day, in store order.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { OpenItemsTool } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(OpenItemsTool.name) // "review_open_items"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const OpenItemsTool = annotateFourHints(
  Tool.make("review_open_items", {
    description:
      "List the review items waiting for the attorney on a day: verdict items without a final verdict, and the questions the daily digest selects, in store order.",
    failure: ReviewHubToolError,
    failureMode: "return",
    parameters: OpenItemsRequest,
    success: OpenItems,
  }),
  localStoreReadHints
);

/**
 * Records the attorney's verdict on one item as its next revision in a batch.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { RecordVerdictTool } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(RecordVerdictTool.name) // "review_record_verdict"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RecordVerdictTool = annotateFourHints(
  Tool.make("review_record_verdict", {
    description:
      "Record the attorney's verdict (right, wrong, partly or withdrawn) on one review item in a batch. Fails with code locked when the batch is locked.",
    failure: ReviewHubToolError,
    failureMode: "return",
    parameters: RecordVerdictInput,
    success: VerdictRow,
  }),
  localStoreAppendHints
);

/**
 * Locks one review batch, so it accepts no further verdicts.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { LockBatchTool } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(LockBatchTool.name) // "review_lock_batch"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const LockBatchTool = annotateFourHints(
  Tool.make("review_lock_batch", {
    description:
      "Lock one review batch and return its lock row. Fails with code not-found when the batch has no verdicts and locked when it is already locked.",
    failure: ReviewHubToolError,
    failureMode: "return",
    parameters: LockBatchRequest,
    success: VerdictRow,
  }),
  localStoreAppendHints
);

/**
 * Records the attorney's answer to one stored question.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { RecordAnswerTool } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(RecordAnswerTool.name) // "review_record_answer"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RecordAnswerTool = annotateFourHints(
  Tool.make("review_record_answer", {
    description:
      "Record the attorney's answer to one stored question. Fails with code not-found when no such question is stored, repair-required when the stored question is a legacy import whose quote must be repaired first, and unknown-option when the answer names an option the question does not offer.",
    failure: ReviewHubToolError,
    failureMode: "return",
    parameters: RecordAnswerRequest,
    success: AnswerRow,
  }),
  localStoreAppendHints
);

/**
 * The review hub's four tools.
 *
 * **Details**
 *
 * Every tool returns a `ReviewHubToolError` as an MCP tool error, its JSON
 * the only text content. Only `review_open_items` is read-only.
 *
 * **Example** (List the tool names)
 *
 * ```ts
 * import { ReviewHubToolkit } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(Object.keys(ReviewHubToolkit.tools))
 * // ["review_open_items", "review_record_verdict", "review_lock_batch", "review_record_answer"]
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ReviewHubToolkit = Toolkit.make(OpenItemsTool, RecordVerdictTool, LockBatchTool, RecordAnswerTool);
