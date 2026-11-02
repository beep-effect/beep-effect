/**
 * Frozen pre-W4 declaration for `ops/review-thread-differential-w4.ts`: the reply mutation W4 deleted from
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/WritePlan.ts`, verbatim from main 930758e06b.
 */
/**
 * GraphQL mutation used to reply to a pull request review thread.
 *
 * **Example** (Verify reply mutation string)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { REPLY_THREAD_MUTATION } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(REPLY_THREAD_MUTATION.includes("addPullRequestReviewThreadReply"), true)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPLY_THREAD_MUTATION =
  "mutation($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) { comment { id url } } }";
