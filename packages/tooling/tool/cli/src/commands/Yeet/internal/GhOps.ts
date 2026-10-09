/**
 * `beep yeet gh`: REST-first pull-request operations for sessions and the
 * orchestrator.
 *
 * **Details**
 *
 * These are the operations the orchestrator ran by hand through `gh api`
 * REST loops on 2026-10-06 while GitHub GraphQL was exhausted
 * (`merge.sh`, `gate-loop.sh`, `flip-only.sh`, `flip-and-gate.sh`). Every read
 * and write goes through `GithubRest` (the REST budget) except the two that
 * only GraphQL can do: the draft-to-ready flip and the review-thread count,
 * both spent through `GraphqlBudget.guard`.
 *
 * The merge gate is a pure function of {@link YeetGhGateFacts} so it can be
 * tested from recorded payloads. Every unknown fails closed: an unreadable
 * ruleset, a thread read that did not come back (never read as zero), a
 * missing head commit time, a required context with no check run.
 *
 * Exit codes: 0 done, 75 a hold that time can clear (pending checks, the
 * review window, an unknown thread count, a spent GraphQL budget), 1 a
 * refusal that needs a person or a push.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { GitHubClient } from "@effected/github";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import {
  GithubCheckRunRecord,
  GithubClientRequest,
  GithubPullRequestRecord,
  GithubRest,
  GraphqlBudget,
  GraphqlBudgetPolicy,
  graphqlErrorToGitHubError,
  layerGithubClientFor,
  layerGithubRepoFor,
  layerGithubRest,
  layerGraphqlBudget,
  markPullRequestReadyDocument,
  readGithubReviewThreads,
  selectGithubIdentity,
} from "../../../internal/github/index.ts";
import {
  deriveYeetReviewThreadState,
  YeetReviewThreadNewestComment,
  YeetReviewThreadStateInput,
  yeetReviewThreadStateOutstanding,
} from "./ReviewThreadState.ts";
import type { GitHubError, Repo } from "@effected/github";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { CliReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import type {
  GithubIdentityError,
  GithubReviewThreads,
  GraphqlBudgetExhausted,
} from "../../../internal/github/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/GhOps");

/**
 * The review window the merge gate holds after the later of "marked ready"
 * and the head commit (operator ruling, 2026-10-06).
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_GH_REVIEW_WINDOW = Duration.minutes(20);

/**
 * Exit code for a hold that time can clear.
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_GH_EXIT_HOLD = 75;

/**
 * Why the merge gate holds or refuses.
 *
 * **Example** (List the reasons)
 *
 * ```ts
 * import { YeetGhGateReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetGhGateReason.literals.includes("threads-unknown")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetGhGateReason = LiteralKit([
  "not-open",
  "head-moved",
  "draft",
  "merge-conflict",
  "required-contexts-unknown",
  "required-red",
  "required-pending",
  "check-red",
  "check-pending",
  "review-window-open",
  "review-window-unknown",
  "threads-unknown",
  "threads-outstanding",
]).pipe($I.annoteSchema("YeetGhGateReason", { description: "Why the REST merge gate holds or refuses." }));

/**
 * Type of {@link YeetGhGateReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetGhGateReason = typeof YeetGhGateReason.Type;

const holdReasons = HashSet.make<ReadonlyArray<YeetGhGateReason>>(
  "required-pending",
  "check-pending",
  "review-window-open",
  "threads-unknown"
);

/**
 * One reason the gate is not met, with its detail.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGhGateFinding extends S.Class<YeetGhGateFinding>($I`YeetGhGateFinding`)(
  { reason: YeetGhGateReason, detail: S.String },
  $I.annote("YeetGhGateFinding", { description: "One reason the REST merge gate is not met." })
) {
  /**
   * Whether time alone can clear this finding.
   *
   * @returns True for pending checks, the review window, and an unknown thread count.
   */
  get isHold(): boolean {
    return HashSet.has(holdReasons, this.reason);
  }
}

/**
 * Everything the gate decides on, read once.
 *
 * **Details**
 *
 * `requiredContexts` is none when the ruleset read failed; `outstandingThreads`
 * is none when the GraphQL thread read failed or was not attempted;
 * `headCommittedAt` is none when the head commit read failed.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGhGateFacts extends S.Class<YeetGhGateFacts>($I`YeetGhGateFacts`)(
  {
    pullRequest: GithubPullRequestRecord,
    pinnedSha: S.String,
    requiredContexts: S.String.pipe(S.Array, S.Option),
    checkRuns: S.Array(GithubCheckRunRecord),
    readyAt: S.Option(S.DateTimeUtc),
    headCommittedAt: S.Option(S.DateTimeUtc),
    outstandingThreads: S.Option(S.Int),
    totalThreads: S.Option(S.Int),
    tolerated: S.Array(S.String),
    forceWindow: S.Boolean,
    now: S.DateTimeUtc,
  },
  $I.annote("YeetGhGateFacts", { description: "Everything the REST merge gate decides on." })
) {}

/**
 * What the REST merge gate concluded: every finding, the required-context
 * green count, and the review-window age.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGhGateVerdict extends S.Class<YeetGhGateVerdict>($I`YeetGhGateVerdict`)(
  {
    findings: S.Array(YeetGhGateFinding),
    requiredGreen: S.Int,
    requiredTotal: S.Int,
    windowAge: S.Option(S.Duration),
  },
  $I.annote("YeetGhGateVerdict", { description: "The REST merge gate's verdict." })
) {
  /**
   * Whether nothing holds or refuses the merge.
   *
   * @returns True when there are no findings.
   */
  get met(): boolean {
    return A.isReadonlyArrayEmpty(this.findings);
  }

  /**
   * Whether time alone can clear every finding.
   *
   * @returns True when every finding is a hold.
   */
  get onlyHolds(): boolean {
    return A.every(this.findings, (finding) => finding.isHold);
  }
}

const goodConclusions = HashSet.make("success", "skipped", "neutral");

const isGood = (run: GithubCheckRunRecord): boolean =>
  run.status === "completed" && O.exists(run.conclusion, (conclusion) => HashSet.has(goodConclusions, conclusion));

/**
 * Keep the newest run (highest id) per check name.
 *
 * **Example** (A re-run replaces the failed run)
 *
 * ```ts
 * import { GithubCheckRunRecord } from "@beep/repo-cli/test/SharedInternals"
 * import { latestCheckRunsByName } from "@beep/repo-cli/test/Yeet"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 *
 * const runs = [
 *   GithubCheckRunRecord.make({ id: 1, name: "Lint", status: "completed", conclusion: O.some("failure") }),
 *   GithubCheckRunRecord.make({ id: 2, name: "Lint", status: "completed", conclusion: O.some("success") })
 * ]
 * console.log(HashMap.size(latestCheckRunsByName(runs))) // 1
 * ```
 *
 * @param runs - Every check run on the head commit.
 * @returns The newest run per name.
 * @category decisions
 * @since 0.0.0
 */
export const latestCheckRunsByName = (
  runs: ReadonlyArray<GithubCheckRunRecord>
): HashMap.HashMap<string, GithubCheckRunRecord> =>
  A.reduce(runs, HashMap.empty<string, GithubCheckRunRecord>(), (latest, run) =>
    O.exists(HashMap.get(latest, run.name), (current) => current.id >= run.id)
      ? latest
      : HashMap.set(latest, run.name, run)
  );

const COMMIT_BODY_WIDTH = 99;

/**
 * Fold text into lines under 100 characters at word boundaries, the limit the
 * server-side commitlint applies to squash-merge bodies.
 *
 * **Example** (Fold a long line)
 *
 * ```ts
 * import { foldCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(foldCommitMessage("word ".repeat(40)).split("\n").every((line) => line.length < 100)) // true
 * ```
 *
 * @param text - The message body.
 * @returns The body with every line under 100 characters (a single word longer than that stays whole).
 * @category formatting
 * @since 0.0.0
 */
export const foldCommitMessage = (text: string): string =>
  A.join(
    A.flatMap(Str.split(text, "\n"), (line) =>
      A.reduce(Str.split(Str.trim(line), " "), A.empty<string>(), (lines, word) =>
        O.match(A.last(lines), {
          onNone: () => [word],
          onSome: (current) =>
            Str.isEmpty(current) || Str.length(current) + 1 + Str.length(word) <= COMMIT_BODY_WIDTH
              ? [...A.dropRight(lines, 1), Str.isEmpty(current) ? word : `${current} ${word}`]
              : [...lines, word],
        })
      )
    ),
    "\n"
  );

const finding = (reason: YeetGhGateReason, detail: string) => YeetGhGateFinding.make({ reason, detail });

const formatAge = (age: Duration.Duration): string => `${Math.floor(Duration.toMinutes(age))}m`;

const when = (condition: boolean, reason: YeetGhGateReason, detail: string): ReadonlyArray<YeetGhGateFinding> =>
  condition ? [finding(reason, detail)] : [];

const pullRequestFindings = (facts: YeetGhGateFacts): ReadonlyArray<YeetGhGateFinding> => {
  const pr = facts.pullRequest;
  const headMoved = !Str.startsWith(facts.pinnedSha)(pr.headSha) || Str.length(facts.pinnedSha) < 7;
  return [
    ...when(pr.state !== "open" || pr.merged, "not-open", `state=${pr.state} merged=${pr.merged}`),
    ...when(headMoved, "head-moved", `head is ${Str.slice(0, 10)(pr.headSha)}, pinned ${facts.pinnedSha}`),
    ...when(pr.draft, "draft", "the pull request is still a draft"),
    ...when(
      O.contains(pr.mergeableState, "dirty"),
      "merge-conflict",
      "the base has moved and the branch conflicts with it"
    ),
  ];
};

const conclusionOf = (run: GithubCheckRunRecord): string => O.getOrElse(run.conclusion, () => "?");

const RequiredContextState = LiteralKit(["green", "red", "pending"]);

const requiredContextState = (run: O.Option<GithubCheckRunRecord>): typeof RequiredContextState.Type =>
  O.match(run, {
    onNone: () => "pending",
    onSome: (found) => (isGood(found) ? "green" : found.status === "completed" ? "red" : "pending"),
  });

const requiredFindings = (
  required: ReadonlyArray<string>,
  latest: HashMap.HashMap<string, GithubCheckRunRecord>
): { readonly findings: ReadonlyArray<YeetGhGateFinding>; readonly green: number } => {
  const states = A.map(required, (context) => {
    const run = HashMap.get(latest, context);
    return { context, run, state: requiredContextState(run) };
  });
  const red = A.filter(states, (entry) => entry.state === "red");
  const pending = A.filter(states, (entry) => entry.state === "pending");
  const describeRed = (entry: (typeof states)[number]) =>
    `${entry.context}=${O.match(entry.run, { onNone: () => "?", onSome: conclusionOf })}`;
  const describePending = (entry: (typeof states)[number]) =>
    O.isNone(entry.run) ? `${entry.context} (no run)` : entry.context;
  return {
    findings: [
      ...when(A.isReadonlyArrayNonEmpty(red), "required-red", A.join(A.map(red, describeRed), ", ")),
      ...when(A.isReadonlyArrayNonEmpty(pending), "required-pending", A.join(A.map(pending, describePending), ", ")),
    ],
    green: A.length(A.filter(states, (entry) => entry.state === "green")),
  };
};

const otherCheckFindings = (
  latest: HashMap.HashMap<string, GithubCheckRunRecord>,
  requiredSet: HashSet.HashSet<string>,
  tolerated: HashSet.HashSet<string>
): ReadonlyArray<YeetGhGateFinding> => {
  const others = pipe(
    HashMap.toValues(latest),
    A.filter((run) => !HashSet.has(requiredSet, run.name) && !HashSet.has(tolerated, run.name) && !isGood(run)),
    A.sort(Order.mapInput(Str.Order, (run: GithubCheckRunRecord) => run.name))
  );
  const red = A.filter(others, (run) => run.status === "completed");
  const pending = A.filter(others, (run) => run.status !== "completed");
  return [
    ...when(
      A.isReadonlyArrayNonEmpty(red),
      "check-red",
      `${A.join(
        A.map(red, (run) => `${run.name}=${conclusionOf(run)}`),
        ", "
      )} (attribute it, then --tolerate "<name>")`
    ),
    ...when(
      A.isReadonlyArrayNonEmpty(pending),
      "check-pending",
      A.join(
        A.map(pending, (run) => run.name),
        ", "
      )
    ),
  ];
};

const reviewWindowAge = (facts: YeetGhGateFacts): O.Option<Duration.Duration> =>
  O.map(facts.headCommittedAt, (head) => {
    const start = DateTime.max(
      O.getOrElse(facts.readyAt, () => facts.pullRequest.createdAt),
      head
    );
    return Duration.millis(Math.max(0, DateTime.toEpochMillis(facts.now) - DateTime.toEpochMillis(start)));
  });

const reviewWindowFindings = (
  forceWindow: boolean,
  windowAge: O.Option<Duration.Duration>
): ReadonlyArray<YeetGhGateFinding> =>
  forceWindow
    ? []
    : O.match(windowAge, {
        onNone: () => [finding("review-window-unknown", "the head commit time could not be read")],
        onSome: (age) =>
          when(
            Duration.isLessThan(age, YEET_GH_REVIEW_WINDOW),
            "review-window-open",
            `age ${formatAge(age)}, ${Math.ceil(Duration.toMinutes(Duration.subtract(YEET_GH_REVIEW_WINDOW, age)))}m left`
          ),
      });

const threadFindings = (outstanding: O.Option<number>): ReadonlyArray<YeetGhGateFinding> =>
  O.match(outstanding, {
    onNone: () => [finding("threads-unknown", "the GraphQL thread read did not come back; never read as zero")],
    onSome: (count) => when(count > 0, "threads-outstanding", `${count} outstanding review thread(s)`),
  });

/**
 * Decide whether a pull request may merge at its pinned head.
 *
 * **Details**
 *
 * The gate mirrors AGENTS.md "Mergeable" plus the review-window ruling: open,
 * not draft, head at the pinned sha, every required context green on the
 * newest run, no other check red or pending unless tolerated by name, the
 * review window elapsed (unless forced), and zero outstanding threads read
 * from GraphQL. A thread count that did not come back is never zero.
 *
 * **Example** (A draft is refused)
 *
 * ```ts
 * import { decideYeetGhMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof decideYeetGhMergeGate) // "function"
 * ```
 *
 * @param facts - The reads.
 * @returns The verdict.
 * @category decisions
 * @since 0.0.0
 */
export const decideYeetGhMergeGate = (facts: YeetGhGateFacts): YeetGhGateVerdict => {
  const latest = latestCheckRunsByName(facts.checkRuns);
  const required = O.getOrElse(facts.requiredContexts, A.empty<string>);
  const requiredRead = requiredFindings(required, latest);
  const windowAge = reviewWindowAge(facts);
  const findings = [
    ...pullRequestFindings(facts),
    ...when(
      A.isReadonlyArrayEmpty(required),
      "required-contexts-unknown",
      "the base ruleset's required contexts could not be read"
    ),
    ...requiredRead.findings,
    ...otherCheckFindings(latest, HashSet.fromIterable(required), HashSet.fromIterable(facts.tolerated)),
    ...reviewWindowFindings(facts.forceWindow, windowAge),
    ...threadFindings(facts.outstandingThreads),
  ];
  return YeetGhGateVerdict.make({
    findings,
    requiredGreen: requiredRead.green,
    requiredTotal: A.length(required),
    windowAge,
  });
};

/**
 * Count the outstanding threads (unresolved, or resolved by the author with a
 * later human follow-up), using the same rule as the readiness monitor.
 *
 * **Example** (No threads)
 *
 * ```ts
 * import { GithubReviewThreads } from "@beep/repo-cli/test/SharedInternals"
 * import { countOutstandingThreads } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(countOutstandingThreads(GithubReviewThreads.make({ author: O.none(), threads: [] }))) // 0
 * ```
 *
 * @param read - The GraphQL thread read.
 * @returns The outstanding thread count.
 * @category decisions
 * @since 0.0.0
 */
export const countOutstandingThreads = (read: GithubReviewThreads): number =>
  A.length(
    A.filter(read.threads, (thread) =>
      yeetReviewThreadStateOutstanding(
        deriveYeetReviewThreadState(
          YeetReviewThreadStateInput.make({
            threadId: thread.id,
            isResolved: thread.isResolved,
            isOutdated: thread.isOutdated,
            path: O.fromNullishOr(thread.path),
            line: O.fromNullishOr(thread.line),
            pullRequestAuthor: read.author,
            resolvedBy: O.map(O.fromNullishOr(thread.resolvedBy), (actor) => actor.login),
            newestComment: pipe(
              A.last(thread.comments.nodes),
              O.flatMap((comment) =>
                O.map(O.fromNullishOr(comment.author), (author) =>
                  YeetReviewThreadNewestComment.make({
                    authorLogin: author.login,
                    authorKind: author.__typename === "Bot" ? "bot" : "user",
                    createdAt: O.fromUndefinedOr(comment.createdAt),
                  })
                )
              )
            ),
          })
        )
      )
    )
  );

/**
 * Options shared by every `yeet gh` subcommand.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGhCommonOptions extends S.Class<YeetGhCommonOptions>($I`YeetGhCommonOptions`)(
  { tokenRef: S.Option(S.String) },
  $I.annote("YeetGhCommonOptions", { description: "Options shared by every yeet gh subcommand." })
) {}

/**
 * The `GithubRest`, `GraphqlBudget`, and `GitHubClient` layer for one `yeet gh`
 * invocation, speaking as the selected identity.
 *
 * **Details**
 *
 * Each `yeet gh` handler builds this for its own scope ({@link withYeetGh}), so
 * the `--token-ref` flag decides the identity. A failure to resolve the identity
 * surfaces as `GithubIdentityError` (exit 1); the token is never printed.
 *
 * **Example** (Build the layer for the default identity)
 *
 * ```ts
 * import { layerYeetGh, YeetGhCommonOptions } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(typeof layerYeetGh(YeetGhCommonOptions.make({ tokenRef: O.none() }))) // "object"
 * ```
 *
 * @param options - The `--token-ref` value, if any.
 * @returns The composed layer.
 * @category layers
 * @since 0.0.0
 */
export const layerYeetGh = ({ tokenRef }: YeetGhCommonOptions) =>
  Layer.unwrap(
    Effect.map(selectGithubIdentity(tokenRef), (identity) =>
      Layer.mergeAll(layerGithubRest, layerGraphqlBudget).pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            layerGithubClientFor(GithubClientRequest.make({ identity, cwd: process.cwd() })),
            layerGithubRepoFor(process.cwd())
          )
        )
      )
    )
  );

/**
 * Run a GitHub program with the GitHub services built for its own scope, as the
 * identity `tokenRef` selects (none: `BEEP_GH_TOKEN_REF`, the App, or the gh login).
 *
 * **Example** (Read a pull request from another Yeet surface)
 *
 * ```ts
 * import { GithubRest } from "@beep/repo-cli/test/SharedInternals"
 * import { withYeetGh } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const program = withYeetGh(O.none())(
 *   Effect.gen(function* () {
 *     const rest = yield* GithubRest
 *     return yield* rest.pullRequest(1)
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param tokenRef - The `--token-ref` value, if any.
 * @returns A function that runs a program with `GithubRest`, `GraphqlBudget`, `GitHubClient`, and `Repo` provided.
 * @category layers
 * @since 0.0.0
 */
export const withYeetGh =
  (tokenRef: O.Option<string>) =>
  <A, E>(
    program: Effect.Effect<A, E, GithubRest | GraphqlBudget | GitHubClient | Repo>
  ): Effect.Effect<A, E | GithubIdentityError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> =>
    Effect.scoped(
      Effect.flatMap(Layer.build(layerYeetGh(YeetGhCommonOptions.make({ tokenRef }))), (context) =>
        Effect.provideContext(program, context)
      )
    );

/**
 * Flip a draft pull request to ready through the GraphQL budget guard, reading
 * its node id over REST. Already-ready is success.
 *
 * **Example** (Build the flip)
 *
 * ```ts
 * import { flipPullRequestReady } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(flipPullRequestReady(42))) // true
 * ```
 *
 * @param prNumber - Which pull request to flip.
 * @returns Nothing; an already-ready pull request is left alone.
 * @category commands
 * @since 0.0.0
 */
export const flipPullRequestReady = (prNumber: number) =>
  withYeetGh(O.none())(
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const pr = yield* rest.pullRequest(prNumber);
      if (pr.draft) yield* markPullRequestReady(pr.nodeId, GraphqlBudgetPolicy.default);
    })
  );

const report = (exitCode: number) => (message: string) => failWithReportedExit(message, exitCode);

const runGh = <A>(
  options: YeetGhCommonOptions,
  program: Effect.Effect<
    A,
    GitHubError | GraphqlBudgetExhausted | CliReportedExit,
    GithubRest | GraphqlBudget | GitHubClient | Repo
  >
): Effect.Effect<A, CliReportedExit, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> =>
  withYeetGh(options.tokenRef)(program).pipe(
    Effect.catchTags({
      GithubIdentityError: (error) => report(1)(`[gh] ${error.message}`),
      GitHubError: (error) => report(error.kind === "rateLimited" ? YEET_GH_EXIT_HOLD : 1)(`[gh] ${error.message}`),
      GraphqlBudgetExhausted: (error) => report(YEET_GH_EXIT_HOLD)(`[gh] ${error.message}`),
    })
  );

/**
 * Read the outstanding thread count through the budget guard. When GraphQL is
 * unavailable, a REST page of inline review comments that comes back empty
 * proves zero threads; anything else (comments exist, or REST failed too) is
 * none, never zero.
 */
const readOutstandingThreads = Effect.fn("YeetGh.readOutstandingThreads")(function* (
  number: number,
  policy: GraphqlBudgetPolicy
) {
  const budget = yield* GraphqlBudget;
  const rest = yield* GithubRest;
  return yield* readGithubReviewThreads(number).pipe(
    budget.guard("pullRequestReviewThreads", policy),
    Effect.map((read) => O.some({ outstanding: countOutstandingThreads(read), total: A.length(read.threads) })),
    Effect.catch((error) =>
      rest.hasReviewComments(number).pipe(
        Effect.flatMap((hasComments) =>
          hasComments
            ? Console.error(
                `[gh] review threads unknown for #${number}: ${error.message}; review comments exist, so REST cannot prove zero`
              ).pipe(Effect.as(O.none<{ readonly outstanding: number; readonly total: number }>()))
            : Console.error(
                `[gh] GraphQL thread read failed for #${number} (${error.message}); REST shows no review comments, so zero threads`
              ).pipe(Effect.as(O.some({ outstanding: 0, total: 0 })))
        ),
        Effect.catch((restError) =>
          Console.error(
            `[gh] review threads unknown for #${number}: ${error.message}; REST fallback failed: ${restError.message}`
          ).pipe(Effect.as(O.none<{ readonly outstanding: number; readonly total: number }>()))
        )
      )
    )
  );
});

const readGateFacts = Effect.fn("YeetGh.readGateFacts")(function* (options: {
  readonly number: number;
  readonly pinnedSha: O.Option<string>;
  readonly tolerated: ReadonlyArray<string>;
  readonly forceWindow: boolean;
  readonly readThreads: boolean;
  readonly policy: GraphqlBudgetPolicy;
}) {
  const rest = yield* GithubRest;
  const pr = yield* rest.pullRequest(options.number);
  const optional = <A, E, R>(label: string, effect: Effect.Effect<A, E & { readonly message: string }, R>) =>
    effect.pipe(
      Effect.asSome,
      Effect.catch((error: E & { readonly message: string }) =>
        Console.error(`[gh] ${label} unknown for #${options.number}: ${error.message}`).pipe(Effect.as(O.none<A>()))
      )
    );
  const [requiredContexts, checkRuns, readyAt, headCommittedAt] = yield* Effect.all(
    [
      optional("required contexts", rest.requiredStatusContexts(pr.baseRef)),
      rest.checkRuns(pr.headSha),
      rest.readyForReviewAt(options.number),
      optional("head commit time", rest.commitCommittedAt(pr.headSha)),
    ],
    { concurrency: 4 }
  );
  const threads = options.readThreads ? yield* readOutstandingThreads(options.number, options.policy) : O.none();
  return YeetGhGateFacts.make({
    pullRequest: pr,
    pinnedSha: O.getOrElse(options.pinnedSha, () => pr.headSha),
    requiredContexts,
    checkRuns,
    readyAt,
    headCommittedAt,
    outstandingThreads: O.map(threads, (read) => read.outstanding),
    totalThreads: O.map(threads, (read) => read.total),
    tolerated: options.tolerated,
    forceWindow: options.forceWindow,
    now: yield* DateTime.now,
  });
});

const renderVerdictLines = (facts: YeetGhGateFacts, verdict: YeetGhGateVerdict): ReadonlyArray<string> => {
  const pr = facts.pullRequest;
  return [
    `#${pr.number} ${pr.state}${pr.merged ? " merged" : ""} ${pr.draft ? "DRAFT" : "ready"} head=${Str.slice(0, 10)(pr.headSha)} mergeable=${O.getOrElse(pr.mergeableState, () => "?")} labels=[${A.join(pr.labels, ",")}]`,
    `  required: ${verdict.requiredGreen}/${verdict.requiredTotal} green`,
    `  review window: ready=${O.match(facts.readyAt, { onNone: () => "never(created)", onSome: DateTime.formatIso })} head=${O.match(facts.headCommittedAt, { onNone: () => "?", onSome: DateTime.formatIso })} age=${O.match(verdict.windowAge, { onNone: () => "?", onSome: formatAge })}${facts.forceWindow ? " (forced)" : ""}`,
    `  threads: ${O.match(facts.outstandingThreads, {
      onNone: () => "unknown",
      onSome: (count) => `${count} outstanding / ${O.getOrElse(facts.totalThreads, () => 0)}`,
    })}`,
    ...A.map(verdict.findings, (item) => `  ${item.isHold ? "HOLD" : "REFUSE"} ${item.reason}: ${item.detail}`),
    `  gate: ${verdict.met ? "MET" : verdict.onlyHolds ? "HOLD" : "REFUSED"}`,
  ];
};

/**
 * `yeet gh pr status <n>`: the REST gate view of one pull request.
 *
 * @param options - The parsed command flags and arguments.
 * @returns The command effect; holds exit 75 and refusals exit 1 through `CliReportedExit`.
 * @category commands
 * @since 0.0.0
 */
export const runYeetGhPrStatus = (
  options: YeetGhCommonOptions & { readonly number: number; readonly threads: boolean; readonly noWait: boolean }
) =>
  runGh(
    options,
    Effect.gen(function* () {
      const facts = yield* readGateFacts({
        number: options.number,
        pinnedSha: O.none(),
        tolerated: [],
        forceWindow: false,
        readThreads: options.threads,
        policy: options.noWait ? GraphqlBudgetPolicy.noWait : GraphqlBudgetPolicy.default,
      });
      const verdict = decideYeetGhMergeGate(facts);
      yield* Effect.forEach(renderVerdictLines(facts, verdict), (line) => Console.log(line), { discard: true });
      if (!options.threads) yield* Console.log("  (threads not read; pass --threads to spend GraphQL on them)");
    })
  );

/**
 * `yeet gh merge <n> --sha <sha>`: re-verify the gate over REST (threads over
 * budget-guarded GraphQL) and squash-merge pinned to the head sha.
 *
 * @param options - The parsed command flags and arguments.
 * @returns The command effect; holds exit 75 and refusals exit 1 through `CliReportedExit`.
 * @category commands
 * @since 0.0.0
 */
export const runYeetGhMerge = (
  options: YeetGhCommonOptions & {
    readonly number: number;
    readonly sha: string;
    readonly tolerate: ReadonlyArray<string>;
    readonly forceWindow: boolean;
    readonly dryRun: boolean;
    readonly noWait: boolean;
  }
) =>
  runGh(
    options,
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const facts = yield* readGateFacts({
        number: options.number,
        pinnedSha: O.some(Str.trim(options.sha)),
        tolerated: options.tolerate,
        forceWindow: options.forceWindow,
        readThreads: true,
        policy: options.noWait ? GraphqlBudgetPolicy.noWait : GraphqlBudgetPolicy.default,
      });
      const verdict = decideYeetGhMergeGate(facts);
      yield* Effect.forEach(renderVerdictLines(facts, verdict), (line) => Console.log(line), { discard: true });
      if (!verdict.met) {
        return yield* report(verdict.onlyHolds ? YEET_GH_EXIT_HOLD : 1)(
          `[gh] not merging #${options.number}: ${A.join(
            A.map(verdict.findings, (item) => item.reason),
            ", "
          )}`
        );
      }
      if (options.dryRun) {
        yield* Console.log(`[gh] dry run: #${options.number} would merge at ${facts.pullRequest.headSha}`);
        return;
      }
      const merged = yield* rest.mergePullRequest(options.number, {
        sha: facts.pullRequest.headSha,
        commitTitle: `${facts.pullRequest.title} (#${options.number})`,
        // GitHub would default the squash body to the commit list, whose lines can
        // break server-side commitlint (body lines under 100 characters).
        commitMessage: foldCommitMessage(
          `Squash-merged at ${facts.pullRequest.headSha} by beep yeet gh merge.${
            A.isReadonlyArrayNonEmpty(options.tolerate) ? ` Tolerated: ${A.join(options.tolerate, "; ")}.` : ""
          }`
        ),
        method: "squash",
      });
      yield* Console.log(
        `[gh] merged=${merged.merged} #${options.number} ${Str.slice(0, 10)(merged.sha)}${
          A.isReadonlyArrayNonEmpty(options.tolerate) ? ` tolerated=[${A.join(options.tolerate, "; ")}]` : ""
        }`
      );
    })
  );

/**
 * `yeet gh pr ready <n>`: the draft-to-ready flip, the one GraphQL mutation
 * with no REST equivalent, behind the budget guard. Already-ready is success.
 *
 * @param options - The parsed command flags and arguments.
 * @returns The command effect; holds exit 75 and refusals exit 1 through `CliReportedExit`.
 * @category commands
 * @since 0.0.0
 */
export const runYeetGhPrReady = (
  options: YeetGhCommonOptions & { readonly number: number; readonly noWait: boolean }
) =>
  runGh(
    options,
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const pr = yield* rest.pullRequest(options.number);
      if (!pr.draft) {
        yield* Console.log(`[gh] #${options.number} is already ready for review`);
        return;
      }
      yield* markPullRequestReady(pr.nodeId, options.noWait ? GraphqlBudgetPolicy.noWait : GraphqlBudgetPolicy.default);
      yield* Console.log(`[gh] #${options.number} marked ready for review`);
    })
  );

/**
 * Flip a draft to ready through the GraphQL budget guard.
 *
 * **Example** (Build the flip)
 *
 * ```ts
 * import { GraphqlBudgetPolicy } from "@beep/repo-cli/test/SharedInternals"
 * import { markPullRequestReady } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(markPullRequestReady("PR_kw", GraphqlBudgetPolicy.noWait))) // true
 * ```
 *
 * @param nodeId - The pull request's GraphQL node id (REST `node_id`).
 * @param policy - The budget policy.
 * @returns Nothing on success.
 * @category commands
 * @since 0.0.0
 */
export const markPullRequestReady = Effect.fn("YeetGh.markPullRequestReady")(function* (
  nodeId: string,
  policy: GraphqlBudgetPolicy
) {
  const client = yield* GitHubClient;
  const budget = yield* GraphqlBudget;
  yield* client
    .graphql(markPullRequestReadyDocument, { pullRequestId: nodeId })
    .pipe(Effect.mapError(graphqlErrorToGitHubError), budget.guard("markPullRequestReadyForReview", policy));
});

/**
 * `yeet gh pr label add|remove <n> <label>`.
 *
 * @param options - The parsed command flags and arguments.
 * @returns The command effect; holds exit 75 and refusals exit 1 through `CliReportedExit`.
 * @category commands
 * @since 0.0.0
 */
export const runYeetGhPrLabel = (
  options: YeetGhCommonOptions & {
    readonly action: "add" | "remove";
    readonly number: number;
    readonly label: string;
  }
) =>
  runGh(
    options,
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      if (options.action === "add") {
        const labels = yield* rest.addLabels(options.number, [options.label]);
        yield* Console.log(`[gh] #${options.number} labels: ${A.join(labels, ", ")}`);
        return;
      }
      yield* rest.removeLabel(options.number, options.label);
      yield* Console.log(`[gh] #${options.number} label removed: ${options.label}`);
    })
  );

/**
 * `yeet gh pr comment <n> --body <text>`.
 *
 * @param options - The parsed command flags and arguments.
 * @returns The command effect; holds exit 75 and refusals exit 1 through `CliReportedExit`.
 * @category commands
 * @since 0.0.0
 */
export const runYeetGhPrComment = (options: YeetGhCommonOptions & { readonly number: number; readonly body: string }) =>
  runGh(
    options,
    Effect.gen(function* () {
      if (Str.isEmpty(Str.trim(options.body))) {
        return yield* report(1)("[gh] --body must not be empty");
      }
      const rest = yield* GithubRest;
      const url = yield* rest.createIssueComment(options.number, options.body);
      yield* Console.log(`[gh] commented: ${url}`);
    })
  );

const failedConclusions = HashSet.make("failure", "timed_out", "cancelled", "startup_failure");
const cancellableStatuses = HashSet.make("queued", "waiting", "pending", "requested", "in_progress");

/**
 * `yeet gh checks rerun-failed|cancel-queued <n>`: act on the workflow runs of
 * the pull request's head commit.
 *
 * @param options - The parsed command flags and arguments.
 * @returns The command effect; holds exit 75 and refusals exit 1 through `CliReportedExit`.
 * @category commands
 * @since 0.0.0
 */
export const runYeetGhChecks = (
  options: YeetGhCommonOptions & { readonly action: "rerun-failed" | "cancel-queued"; readonly number: number }
) =>
  runGh(
    options,
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const pr = yield* rest.pullRequest(options.number);
      const runs = yield* rest.workflowRunsForSha(pr.headSha);
      const targets =
        options.action === "rerun-failed"
          ? A.filter(
              runs,
              (run) =>
                run.status === "completed" &&
                O.exists(run.conclusion, (conclusion) => HashSet.has(failedConclusions, conclusion))
            )
          : A.filter(runs, (run) => HashSet.has(cancellableStatuses, run.status));
      if (A.isReadonlyArrayEmpty(targets)) {
        yield* Console.log(
          `[gh] #${options.number} ${Str.slice(0, 10)(pr.headSha)}: no workflow runs to ${options.action}`
        );
        return;
      }
      yield* Effect.forEach(
        targets,
        (run) =>
          (options.action === "rerun-failed" ? rest.rerunFailedJobs(run.id) : rest.cancelWorkflowRun(run.id)).pipe(
            Effect.andThen(Console.log(`[gh] ${options.action} run ${run.id} (${run.name})`))
          ),
        { discard: true }
      );
    })
  );

/**
 * `yeet gh rate-limit`: REST core plus the one-point GraphQL probe (the
 * truth for GraphQL; REST misreports it).
 *
 * @param options - The parsed command flags and arguments.
 * @returns The command effect; holds exit 75 and refusals exit 1 through `CliReportedExit`.
 * @category commands
 * @since 0.0.0
 */
export const runYeetGhRateLimit = (options: YeetGhCommonOptions) =>
  runGh(
    options,
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const budget = yield* GraphqlBudget;
      const limits = yield* rest.rateLimit;
      yield* Console.log(
        `[gh] rest core: ${limits.core.remaining}/${limits.core.limit}, resets ${DateTime.formatIso(limits.core.resetAt)}`
      );
      const graphql = yield* budget.probe;
      yield* Console.log(
        `[gh] graphql: ${graphql.remaining} left (${graphql.source}), resets ${DateTime.formatIso(graphql.resetAt)}`
      );
    })
  );
