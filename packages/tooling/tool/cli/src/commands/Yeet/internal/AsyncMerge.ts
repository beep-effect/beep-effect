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
 * The legacy `PUT pulls/{n}/merge` call stays reachable for one working day
 * after the async port merges: `BEEP_YEET_MERGE_ENDPOINT=legacy` routes every
 * merge through it (goals/yeet-async-merge-and-stacks, slice A).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Config from "effect/Config";
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
 * The environment switch that routes Yeet merges back to the legacy endpoint.
 *
 * **Example** (Read the switch name)
 *
 * ```ts
 * import { YEET_MERGE_ENDPOINT_ENV } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MERGE_ENDPOINT_ENV) // "BEEP_YEET_MERGE_ENDPOINT"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_MERGE_ENDPOINT_ENV = "BEEP_YEET_MERGE_ENDPOINT" as const;

/**
 * Which GitHub endpoint a Yeet merge calls.
 *
 * **Details**
 *
 * `async` is `PUT pulls/{n}/merge-async` and the default. `legacy` is the old
 * `PUT pulls/{n}/merge`, kept for one working day after the async port merged;
 * it ignores `bypassRules`, because the legacy call cannot express one.
 *
 * **Example** (Check an endpoint)
 *
 * ```ts
 * import { YeetMergeEndpoint } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMergeEndpoint.is.async("async")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMergeEndpoint = LiteralKit(["async", "legacy"]).pipe(
  $I.annoteSchema("YeetMergeEndpoint", { description: "Which GitHub endpoint a Yeet merge calls." })
);

/**
 * Which GitHub endpoint a Yeet merge calls.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetMergeEndpoint = typeof YeetMergeEndpoint.Type;

/**
 * The name a log line or hold gives an endpoint: `merge-async`, or
 * `merge (legacy)`.
 *
 * **Example** (Name both endpoints)
 *
 * ```ts
 * import { renderYeetMergeEndpoint } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMergeEndpoint("async")) // "merge-async"
 * console.log(renderYeetMergeEndpoint("legacy")) // "merge (legacy)"
 * ```
 *
 * @param endpoint - The endpoint that merged or refused.
 * @returns Its display name.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMergeEndpoint = (endpoint: YeetMergeEndpoint): string =>
  YeetMergeEndpoint.match(endpoint, { async: () => "merge-async", legacy: () => "merge (legacy)" });

/**
 * The configured merge endpoint: `BEEP_YEET_MERGE_ENDPOINT`, else `async`.
 *
 * **Example** (Resolve without an override)
 *
 * ```ts
 * import { YeetMergeEndpointConfig } from "@beep/repo-cli/test/Yeet"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 *
 * const program = YeetMergeEndpointConfig.pipe(
 *   Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
 * )
 * console.log(Effect.runSync(program)) // "async"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const YeetMergeEndpointConfig: Config.Config<YeetMergeEndpoint> = Config.schema(
  YeetMergeEndpoint,
  YEET_MERGE_ENDPOINT_ENV
).pipe(Config.withDefault("async"));

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
 *   endpoint: "async",
 *   message: "A conversation must be resolved before this pull request can be merged.",
 * })
 * console.log(settled._tag) // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMergeSettlement = S.TaggedUnion({
  Merged: { endpoint: YeetMergeEndpoint, sha: S.NonEmptyString, message: S.String, attached: S.Boolean },
  Failed: { endpoint: YeetMergeEndpoint, message: S.String },
  Unsettled: { endpoint: YeetMergeEndpoint, message: S.String, uuid: S.Option(S.String) },
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
const settleOutcome = (outcome: AsyncOutcome, attached: boolean): YeetMergeSettlement =>
  GithubAsyncMergeOutcome.match(outcome, {
    Merged: ({ sha, message }) => Settlement.Merged.make({ endpoint: "async", sha, message, attached }),
    Failed: ({ message }) => Settlement.Failed.make({ endpoint: "async", message }),
    Pending: ({ uuid, message }) =>
      Settlement.Unsettled.make({
        endpoint: "async",
        message: `still pending when the poll ran out: ${message}`,
        uuid: O.some(uuid),
      }),
    Enqueued: ({ uuid, message }) =>
      Settlement.Unsettled.make({ endpoint: "async", message: `enqueued, not merged: ${message}`, uuid }),
    Expired: ({ uuid }) =>
      Settlement.Unsettled.make({
        endpoint: "async",
        message: "GitHub holds no result for the request (expired after 24 hours, or never this pull request's)",
        uuid: O.some(uuid),
      }),
  });

const settleAsync = Effect.fn("Yeet.settleAsyncMerge")(function* (
  pullRequestNumber: number,
  request: GithubAsyncMergeRequest,
  poll: YeetAsyncMergePoll
): Effect.fn.Return<YeetMergeSettlement, GitHubError, GithubRest> {
  const rest = yield* GithubRest;
  const accepted = yield* rest.requestAsyncMerge(pullRequestNumber, request);
  yield* Effect.annotateCurrentSpan({ pullRequestNumber, accepted: accepted._tag, bypassRules: request.bypassRules });
  if (!GithubAsyncMergeOutcome.guards.Pending(accepted)) return settleOutcome(accepted, false);
  if (accepted.inFlight) {
    yield* Console.log(
      `[yeet] #${pullRequestNumber}: a merge request was already in flight (${accepted.uuid}); waiting on it`
    );
  }
  const final = yield* rest.asyncMergeResult(pullRequestNumber, accepted.uuid).pipe(
    Effect.repeat({
      schedule: Schedule.spaced(poll.interval),
      times: poll.attempts,
      while: GithubAsyncMergeOutcome.guards.Pending,
    })
  );
  return settleOutcome(final, accepted.inFlight);
});

const settleLegacy = Effect.fn("Yeet.settleLegacyMerge")(function* (
  pullRequestNumber: number,
  request: GithubAsyncMergeRequest
): Effect.fn.Return<YeetMergeSettlement, GitHubError, GithubRest> {
  const rest = yield* GithubRest;
  const merged = yield* rest.mergePullRequest(pullRequestNumber, {
    sha: request.sha,
    commitTitle: request.commitTitle,
    commitMessage: request.commitMessage,
    method: request.method,
  });
  return merged.merged
    ? Settlement.Merged.make({ endpoint: "legacy", sha: merged.sha, message: merged.message, attached: false })
    : Settlement.Failed.make({ endpoint: "legacy", message: merged.message });
});

/**
 * Merge one pull request and wait for GitHub to settle it.
 *
 * **Details**
 *
 * Reads {@link YeetMergeEndpointConfig}; a value that does not parse falls back
 * to `async` with a warning, because the async call is the one that holds a
 * failed rule as a failure. On `async` it sends one `merge-async` request
 * (a 409 attaches to the request already in flight instead of sending
 * another) and polls the result under `poll`. On `legacy` it sends the old
 * merge call once. A `GitHubError` is a request that never reached a verdict
 * (transport, auth, an unexpected status); the caller decides whether that
 * is a hold or an uncertain merge.
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
 * @param request - The pinned request; `bypassRules` is honoured only by `async`.
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
  const endpoint = yield* YeetMergeEndpointConfig.pipe(
    Effect.catch((error) =>
      Console.error(
        `[yeet] warning: ${YEET_MERGE_ENDPOINT_ENV} is invalid, merging through async: ${error.message}`
      ).pipe(Effect.as<YeetMergeEndpoint>("async"))
    )
  );
  return yield* YeetMergeEndpoint.match(endpoint, {
    async: () => settleAsync(pullRequestNumber, request, poll),
    legacy: () => settleLegacy(pullRequestNumber, request),
  });
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
 *   YeetMergeSettlement.cases.Unsettled.make({ endpoint: "async", message: "still pending", uuid: O.none() })
 * )
 * console.log(line) // "merge-async unsettled: still pending"
 * ```
 *
 * @param settlement - How the merge ended.
 * @returns The rendered line.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMergeSettlement = (settlement: YeetMergeSettlement): string => {
  const endpoint = renderYeetMergeEndpoint(settlement.endpoint);
  return YeetMergeSettlement.match(settlement, {
    Merged: ({ sha, attached }) =>
      `${endpoint} merged as ${sha}${attached ? " (attached to an in-flight request)" : ""}`,
    Failed: ({ message }) =>
      `${endpoint} failed: ${Str.isEmpty(oneLine(message)) ? "GitHub sent no message" : oneLine(message)}`,
    Unsettled: ({ message, uuid }) =>
      `${endpoint} unsettled: ${oneLine(message)}${O.getOrElse(
        O.map(uuid, (id) => ` (request ${id})`),
        () => ""
      )}`,
  });
};
