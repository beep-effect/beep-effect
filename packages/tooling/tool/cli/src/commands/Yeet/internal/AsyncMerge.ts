/**
 * Settle one pull-request merge through GitHub's async merge endpoint.
 *
 * **Details**
 *
 * Every Yeet merge (`yeet merge-gate`, `yeet merge`, `yeet gh merge` and the
 * owner checkpoint) goes through {@link settleYeetMerge}: one
 * `PUT pulls/{n}/merge-async` pinned to the gated head, then a bounded poll of
 * its result until GitHub reports a terminal outcome. GitHub evaluates the
 * base's rules after it accepts the request, so acceptance is never read as
 * success, and a request still pending when the poll budget runs out settles as
 * `Unsettled`, never as merged.
 *
 * It is the only merge call Yeet has: the legacy `PUT pulls/{n}/merge` call and
 * its environment switch were deleted after their watch day
 * (goals/yeet-async-merge-and-stacks, slice A).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubAsyncMergeOutcome, GithubRest } from "../../../internal/github/GithubRest.ts";
import type { GitHubError } from "@beep/github/GitHubError";
import type {
  GithubAsyncMergeOutcome as AsyncOutcome,
  GithubAsyncMergeRequest,
} from "../../../internal/github/GithubRest.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/AsyncMerge");

/**
 * The name a log line or hold gives the endpoint every Yeet merge calls.
 *
 * **Example** (Read the endpoint name)
 *
 * ```ts
 * import { YEET_MERGE_ENDPOINT_NAME } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MERGE_ENDPOINT_NAME) // "merge-async"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_MERGE_ENDPOINT_NAME = "merge-async" as const;

/**
 * How long a Yeet merge waits for GitHub to settle an accepted request.
 *
 * **Details**
 *
 * The poll reads the result once right away and then up to `attempts` more
 * times, `interval` apart. The default (2 seconds, 60 more reads) is about two
 * minutes; GitHub settled every observed request within 10 seconds.
 *
 * **Example** (A no-wait policy for tests)
 *
 * ```ts
 * import { YeetAsyncMergePoll } from "@beep/repo-cli/test/Yeet"
 * import * as Duration from "effect/Duration"
 *
 * const policy = YeetAsyncMergePoll.make({ attempts: 0, interval: Duration.zero })
 * console.log(policy.attempts) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAsyncMergePoll extends S.Opaque<YeetAsyncMergePoll, { readonly brand: unique symbol }>()(
  S.Struct({ attempts: S.Natural, interval: S.Duration }).pipe(
    $I.annoteSchema("YeetAsyncMergePoll", { description: "How long a Yeet merge polls an accepted request." })
  )
) {}

/**
 * The default poll: about two minutes, two seconds apart.
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { defaultYeetAsyncMergePoll } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(defaultYeetAsyncMergePoll.attempts) // 60
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultYeetAsyncMergePoll = YeetAsyncMergePoll.make({ attempts: 60, interval: Duration.seconds(2) });

/**
 * How one Yeet merge ended.
 *
 * **Details**
 *
 * - `Merged`: GitHub merged the pull request as `sha`. `attached` is true when
 *   another request for it was already in flight (HTTP 409) and this merge
 *   waited on that one, whose commit title may differ from the one sent here.
 *   `bypassRules` is whether the merging request asked GitHub to bypass the
 *   base's rules.
 * - `Failed`: GitHub refused or abandoned the merge; `message` is GitHub's own
 *   sentence. Nothing merged.
 * - `Unsettled`: GitHub accepted the request but no terminal outcome was seen:
 *   still pending when the poll ran out, queued, or the result expired. The
 *   merge may still happen; read the pull request before acting on it.
 *
 * **Example** (A refused merge)
 *
 * ```ts
 * import { YeetMergeSettlement } from "@beep/repo-cli/test/Yeet"
 *
 * const settled = YeetMergeSettlement.cases.Failed.make({
 *   message: "A conversation must be resolved before this pull request can be merged.",
 * })
 * console.log(settled._tag) // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMergeSettlement = S.TaggedUnion({
  Merged: {
    sha: S.NonEmptyString,
    message: S.String,
    attached: S.Boolean,
    bypassRules: S.Boolean,
  },
  Failed: { message: S.String },
  Unsettled: { message: S.String, uuid: S.Option(S.String) },
}).pipe(
  $I.annoteSchema("YeetMergeSettlement", {
    description: "How one Yeet merge ended: merged, failed with GitHub's sentence, or unsettled.",
  })
);

/**
 * How one Yeet merge ended.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetMergeSettlement = typeof YeetMergeSettlement.Type;

const Settlement = YeetMergeSettlement.cases;

// Every non-pending outcome, as the settlement it ends a merge with.
const settleOutcome = (outcome: AsyncOutcome, attached: boolean, bypassRules: boolean): YeetMergeSettlement =>
  GithubAsyncMergeOutcome.match(outcome, {
    Merged: ({ sha, message }) => Settlement.Merged.make({ sha, message, attached, bypassRules }),
    Failed: ({ message }) => Settlement.Failed.make({ message }),
    Pending: ({ uuid, message }) =>
      Settlement.Unsettled.make({
        message: `still pending when the poll ran out: ${message}`,
        uuid: O.some(uuid),
      }),
    Enqueued: ({ uuid, message }) => Settlement.Unsettled.make({ message: `enqueued, not merged: ${message}`, uuid }),
    Expired: ({ uuid }) =>
      Settlement.Unsettled.make({
        message: "GitHub holds no result for the request (expired after 24 hours, or never this pull request's)",
        uuid: O.some(uuid),
      }),
  });

// How an in-flight request (from a 409) differs from the one this caller asked for, if it does,
// as the phrase that follows "in flight with": "head <sha>" or "an unreported head", then
// "bypass_rules <bool>" or "an unreported bypass".
// A field GitHub did not report counts as a difference: the caller cannot vouch for it.
const inFlightMismatch = (
  inFlight: typeof GithubAsyncMergeOutcome.cases.Pending.Type,
  request: GithubAsyncMergeRequest
): O.Option<string> => {
  const head = O.match(inFlight.expectedHeadSha, {
    onNone: () => "an unreported head",
    onSome: (sha) => `head ${sha}`,
  });
  const bypass = O.match(inFlight.bypassRules, {
    onNone: () => "an unreported bypass",
    onSome: (bypassRules) => `bypass_rules ${bypassRules}`,
  });
  const sameHead = O.exists(inFlight.expectedHeadSha, (sha) => sha === request.sha);
  const sameBypass = O.exists(inFlight.bypassRules, (bypassRules) => bypassRules === request.bypassRules);
  return sameHead && sameBypass ? O.none() : O.some(`${head} and ${bypass}`);
};

/**
 * Merge one pull request and wait for GitHub to settle it.
 *
 * **Details**
 *
 * Sends one `merge-async` request (a 409 attaches to the request already in
 * flight instead of sending another) and polls the result under `poll`. A
 * `GitHubError` is a request that never reached a verdict (transport, auth, an
 * unexpected status); the caller decides whether that is a hold or an
 * uncertain merge.
 *
 * **Example** (Build the merge effect)
 *
 * ```ts
 * import { GithubAsyncMergeRequest } from "@beep/repo-cli/test/SharedInternals"
 * import { settleYeetMerge } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const request = GithubAsyncMergeRequest.make({ action: "direct_merge", method: "squash", sha: "abc" })
 * console.log(Effect.isEffect(settleYeetMerge(7, request))) // true
 * ```
 *
 * @param pullRequestNumber - The pull request to merge.
 * @param request - The pinned request, with the bypass it asks for.
 * @param poll - The settle budget; defaults to {@link defaultYeetAsyncMergePoll}.
 * @returns How the merge ended.
 * @category workflows
 * @since 0.0.0
 */
export const settleYeetMerge = Effect.fn("Yeet.settleMerge")(function* (
  pullRequestNumber: number,
  request: GithubAsyncMergeRequest,
  poll: YeetAsyncMergePoll = defaultYeetAsyncMergePoll
): Effect.fn.Return<YeetMergeSettlement, GitHubError, GithubRest> {
  const rest = yield* GithubRest;
  const accepted = yield* rest.requestAsyncMerge(pullRequestNumber, request);
  yield* Effect.annotateCurrentSpan({ pullRequestNumber, accepted: accepted._tag, bypassRules: request.bypassRules });
  if (!GithubAsyncMergeOutcome.guards.Pending(accepted)) return settleOutcome(accepted, false, request.bypassRules);
  if (accepted.inFlight) {
    // Attach only to a request this caller could have sent itself: the same pinned head and the
    // same bypass. Anything else is another session's merge, which this one must not report as its own.
    const mismatch = inFlightMismatch(accepted, request);
    if (O.isSome(mismatch)) {
      return Settlement.Unsettled.make({
        message: `another merge request is in flight with ${mismatch.value}`,
        uuid: O.some(accepted.uuid),
      });
    }
    yield* Console.log(
      `[yeet] #${pullRequestNumber}: a merge request was already in flight (${accepted.uuid}); waiting on it`
    );
  }
  // GitHub holds the accepted request: a poll that cannot be read leaves it unsettled, never failed,
  // because the merge may still land.
  return yield* rest.asyncMergeResult(pullRequestNumber, accepted.uuid).pipe(
    Effect.repeat({
      schedule: Schedule.spaced(poll.interval),
      times: poll.attempts,
      while: GithubAsyncMergeOutcome.guards.Pending,
    }),
    Effect.map((final) => settleOutcome(final, accepted.inFlight, request.bypassRules)),
    Effect.catch((error) =>
      Effect.succeed(
        Settlement.Unsettled.make({
          message: `accepted, but its result could not be read: ${error.message}`,
          uuid: O.some(accepted.uuid),
        })
      )
    )
  );
});

// GitHub's rule sentences arrive multi-line ("Repository rule violations found\n\nA
// conversation must be resolved..."); a hold detail and a log line are one line.
const oneLine = flow(Str.replace(/\s+/gu, " "), Str.trim);

/**
 * One line naming how a settled merge ended, for logs and hold details. GitHub's
 * multi-line sentences are folded onto one line.
 *
 * **Example** (Render a refusal)
 *
 * ```ts
 * import { renderYeetMergeSettlement, YeetMergeSettlement } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const line = renderYeetMergeSettlement(
 *   YeetMergeSettlement.cases.Unsettled.make({ message: "still pending", uuid: O.none() })
 * )
 * console.log(line) // "merge-async unsettled: still pending"
 * ```
 *
 * @param settlement - How the merge ended.
 * @returns The rendered line.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMergeSettlement = (settlement: YeetMergeSettlement): string =>
  YeetMergeSettlement.match(settlement, {
    Merged: ({ sha, attached }) =>
      `${YEET_MERGE_ENDPOINT_NAME} merged as ${sha}${attached ? " (attached to an in-flight request)" : ""}`,
    Failed: ({ message }) =>
      `${YEET_MERGE_ENDPOINT_NAME} failed: ${Str.isEmpty(oneLine(message)) ? "GitHub sent no message" : oneLine(message)}`,
    Unsettled: ({ message, uuid }) =>
      `${YEET_MERGE_ENDPOINT_NAME} unsettled: ${oneLine(message)}${O.getOrElse(
        O.map(uuid, (id) => ` (request ${id})`),
        () => ""
      )}`,
  });
