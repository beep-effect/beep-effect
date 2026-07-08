/**
 * Pure review-thread write planning for Yeet closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O } from "@beep/utils";
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as Str from "effect/String";

/**
 * Maximum body size accepted for an explicit closeout review-thread reply.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { CLOSEOUT_REPLY_BODY_MAX_CHARS } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(CLOSEOUT_REPLY_BODY_MAX_CHARS, 16 * 1024)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const CLOSEOUT_REPLY_BODY_MAX_CHARS = 16 * 1024;

/**
 * GraphQL mutation used to reply to a pull request review thread.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { REPLY_THREAD_MUTATION } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(REPLY_THREAD_MUTATION.includes("addPullRequestReviewThreadReply"), true)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const REPLY_THREAD_MUTATION =
  "mutation($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) { comment { id url } } }";

/**
 * GraphQL mutation used to resolve a pull request review thread.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { RESOLVE_THREAD_MUTATION } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(RESOLVE_THREAD_MUTATION.includes("resolveReviewThread"), true)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const RESOLVE_THREAD_MUTATION =
  "mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { id isResolved } } }";

type CloseoutWriteIntent = {
  readonly body: O.Option<string>;
  readonly kind: "reply" | "resolve";
  readonly threadId: string;
};

type CloseoutWritePlanInput = {
  readonly knownThreadIds: ReadonlyArray<string>;
  readonly replyBody: string;
  readonly replyThread: string;
  readonly resolveThreads: string;
};

const caseSensitiveTokens: (value: string) => ReadonlyArray<string> = flow(
  Str.split(","),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty)
);

/**
 * Plan explicit closeout write actions from CLI flag values.
 *
 * @param input - Known thread ids plus reply and resolve flag values from the
 * closeout command.
 * @returns Planned write intents, or an error explaining why no writes should
 * run.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as O from "effect/Option"
 * import { closeoutWritePlan } from "@beep/repo-cli/test/Yeet"
 *
 * const plan = closeoutWritePlan({
 *   knownThreadIds: ["PRRT_1", "PRRT_2"],
 *   replyBody: "Fixed in the latest push.",
 *   replyThread: "PRRT_1",
 *   resolveThreads: "PRRT_2"
 * })
 *
 * strictEqual(O.isNone(plan.error), true)
 * strictEqual(plan.intents.length, 2)
 * ```
 * @category planning
 * @since 0.0.0
 */
export const closeoutWritePlan = (
  input: CloseoutWritePlanInput
): { readonly error: O.Option<string>; readonly intents: ReadonlyArray<CloseoutWriteIntent> } => {
  const reply = Str.trim(input.replyThread);
  const body = input.replyBody;
  const resolves = caseSensitiveTokens(input.resolveThreads);

  if (Str.isNonEmpty(reply) !== Str.isNonEmpty(Str.trim(body))) {
    return {
      error: O.some("yeet closeout requires --reply-thread and --reply-body together."),
      intents: [],
    };
  }
  if (Str.isNonEmpty(reply) && body.length > CLOSEOUT_REPLY_BODY_MAX_CHARS) {
    return {
      error: O.some(`yeet closeout --reply-body exceeds ${CLOSEOUT_REPLY_BODY_MAX_CHARS} characters.`),
      intents: [],
    };
  }

  const requestedIds = pipe(Str.isNonEmpty(reply) ? [reply, ...resolves] : [...resolves], A.dedupe);
  const unknownIds = pipe(
    requestedIds,
    A.filter((threadId) => !A.contains(input.knownThreadIds, threadId))
  );
  if (!A.isReadonlyArrayEmpty(unknownIds)) {
    return {
      error: O.some(
        `yeet closeout cannot write to unknown review thread id(s): ${A.join(unknownIds, ", ")}. Copy ids from the closeout report.`
      ),
      intents: [],
    };
  }

  return {
    error: O.none(),
    intents: [
      ...(Str.isNonEmpty(reply) ? [{ body: O.some(body), kind: "reply" as const, threadId: reply }] : []),
      ...pipe(
        resolves,
        A.map((threadId) => ({ body: O.none<string>(), kind: "resolve" as const, threadId }))
      ),
    ],
  };
};

/**
 * Plan explicit closeout write actions from CLI flag values.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as O from "effect/Option"
 * import { closeoutWritePlanForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const plan = closeoutWritePlanForTesting({
 *   knownThreadIds: ["PRRT_1"],
 *   replyBody: "",
 *   replyThread: "",
 *   resolveThreads: "PRRT_1"
 * })
 *
 * strictEqual(O.isNone(plan.error), true)
 * strictEqual(plan.intents[0]?.kind, "resolve")
 * ```
 * @category testing
 * @since 0.0.0
 */
export const closeoutWritePlanForTesting = closeoutWritePlan;
