/**
 * The orchestrator's merge gate: re-verify one pull request at a pinned head
 * against AGENTS.md "Mergeable" plus the review-window ruling, then squash-merge.
 *
 * **Details**
 *
 * This is the CLI home of the gate the orchestrator session ran by hand on
 * 2026-10-06 (`merge.sh <pr> <sha10>`). The decision is a pure function of a
 * {@link MergeGateRead} so it can be tested from recorded GitHub payloads;
 * {@link readMergeGate} is the only place that talks to `gh`, and
 * {@link executeMergeGate} the only place that writes. Every unknown fails
 * closed: an unreadable ruleset, a GraphQL thread count that did not come
 * back, a missing head commit time, a required context with no check run.
 *
 * **Gotchas**
 *
 * A non-required red or pending check (Heavy / Coverage Regression, a
 * rate-limited Vercel deploy) is never tolerated by name alone. The caller
 * passes `--tolerate "<check>=<attribution>"` after reading the run, and the
 * attribution is echoed in the merge line so the hand-off log carries it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Console, DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ghOutput } from "../../../internal/github/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { readYeetRulesetRequiredContexts } from "./Settle.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { GhCommandFailure } from "../../../internal/github/index.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MergeGate");

/**
 * The review window the operator ruled on 2026-10-06: twenty minutes after the
 * later of "marked ready" and the head commit.
 *
 * @category constants
 * @since 0.0.0
 */
export const MERGE_GATE_REVIEW_WINDOW_SECONDS = 20 * 60;

/**
 * One check run on the head commit, reduced to what the gate reads.
 *
 * **Example** (A green required run)
 *
 * ```ts
 * import { MergeGateCheckRun } from "@beep/repo-cli/test/Yeet"
 *
 * const run = MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" })
 * console.log(run.name) // "Lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateCheckRun extends S.Class<MergeGateCheckRun>($I`MergeGateCheckRun`)(
  {
    id: S.Finite,
    name: S.NonEmptyString,
    status: S.String,
    conclusion: S.NullOr(S.String),
  },
  $I.annote("MergeGateCheckRun", { description: "One check run on the pull request head, as the gate reads it." })
) {}

/**
 * A non-required check the orchestrator tolerates red or pending, with the
 * attribution that justifies it.
 *
 * **Example** (Tolerate an inherited coverage red)
 *
 * ```ts
 * import { MergeGateTolerance } from "@beep/repo-cli/test/Yeet"
 *
 * const tolerance = MergeGateTolerance.make({
 *   check: "Heavy / Coverage Regression",
 *   attribution: "inherited: red on main since 2c1cb448ba, fix in #1477",
 * })
 * console.log(tolerance.check)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateTolerance extends S.Class<MergeGateTolerance>($I`MergeGateTolerance`)(
  { check: S.NonEmptyString, attribution: S.NonEmptyString },
  $I.annote("MergeGateTolerance", {
    description: "A non-required check tolerated red or pending, with the attribution that justifies it.",
  })
) {}

/**
 * Parse one `--tolerate "<check>=<attribution>"` argument.
 *
 * **Example** (Parse a tolerance)
 *
 * ```ts
 * import { parseMergeGateTolerance } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(parseMergeGateTolerance("Heavy / Coverage Regression=inherited from main"))) // true
 * console.log(O.isNone(parseMergeGateTolerance("Heavy / Coverage Regression"))) // true
 * ```
 *
 * @param value - One `--tolerate` argument.
 * @returns The tolerance, or none when the form is wrong.
 * @category models
 * @since 0.0.0
 */
export const parseMergeGateTolerance = (value: string): O.Option<MergeGateTolerance> => {
  const separator = value.indexOf("=");
  if (separator < 0) return O.none();
  const check = Str.trim(value.slice(0, separator));
  const attribution = Str.trim(value.slice(separator + 1));
  return Str.isEmpty(check) || Str.isEmpty(attribution)
    ? O.none()
    : O.some(MergeGateTolerance.make({ check, attribution }));
};

/**
 * Everything the gate decides on, read once from GitHub at a point in time.
 *
 * **Details**
 *
 * `requiredContexts` is `None` when the base ruleset could not be read;
 * `unresolvedThreads` is `None` when the GraphQL thread read failed or was
 * truncated; `headCommittedAt` is `None` when the commit read failed. Each
 * `None` holds the gate rather than reading as "nothing to worry about".
 *
 * **Example** (Build a read)
 *
 * ```ts
 * import { MergeGateRead } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const read = MergeGateRead.make({
 *   prNumber: 1459,
 *   title: "feat(ciops): P2 projection",
 *   headSha: "212fe39b4f0000000000000000000000000000ab",
 *   draft: false,
 *   mergeableState: "clean",
 *   createdAt: DateTime.makeUnsafe(0),
 *   requiredContexts: O.some(["Lint"]),
 *   checkRuns: [],
 *   readyAt: O.none(),
 *   headCommittedAt: O.some(DateTime.makeUnsafe(0)),
 *   unresolvedThreads: O.some(0),
 *   readAt: DateTime.makeUnsafe(0),
 * })
 * console.log(read.prNumber) // 1459
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateRead extends S.Class<MergeGateRead>($I`MergeGateRead`)(
  {
    prNumber: S.Finite,
    title: S.String,
    headSha: S.NonEmptyString,
    draft: S.Boolean,
    mergeableState: S.String,
    createdAt: S.DateTimeUtcFromString,
    requiredContexts: S.NonEmptyString.pipe(S.Array, S.Option),
    checkRuns: S.Array(MergeGateCheckRun),
    readyAt: S.Option(S.DateTimeUtcFromString),
    headCommittedAt: S.Option(S.DateTimeUtcFromString),
    unresolvedThreads: S.Option(S.Finite),
    readAt: S.DateTimeUtcFromString,
  },
  $I.annote("MergeGateRead", { description: "The pull request facts the merge gate decides on." })
) {}

/**
 * Why the gate held, as a closed domain so a caller can route each hold.
 *
 * **Example** (Narrow a reason)
 *
 * ```ts
 * import { MergeGateHoldReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(MergeGateHoldReason.is["review-window-open"]("review-window-open")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeGateHoldReason = LiteralKit([
  "head-moved",
  "draft",
  "conflicting",
  "required-contexts-unknown",
  "required-pending",
  "required-red",
  "pending",
  "red",
  "head-time-unknown",
  "review-window-open",
  "threads-unknown",
  "threads-unresolved",
]).pipe($I.annoteSchema("MergeGateHoldReason", { description: "The first unmet merge-gate criterion." }));

/**
 * The first unmet merge-gate criterion.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeGateHoldReason = typeof MergeGateHoldReason.Type;

/**
 * The gate held: nothing is merged, and the reason is routed to whoever owns it.
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateHold extends S.TaggedClass<MergeGateHold>($I`MergeGateHold`)(
  "hold",
  { prNumber: S.Finite, reason: MergeGateHoldReason, detail: S.NonEmptyString },
  $I.annote("MergeGateHold", { description: "The merge gate refused on its first unmet criterion." })
) {}

/**
 * The gate is met: merge at this head with this squash title.
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateMerge extends S.TaggedClass<MergeGateMerge>($I`MergeGateMerge`)(
  "merge",
  {
    prNumber: S.Finite,
    headSha: S.NonEmptyString,
    commitTitle: S.NonEmptyString,
    windowAgeSeconds: S.Finite,
    tolerated: S.Array(MergeGateTolerance),
  },
  $I.annote("MergeGateMerge", { description: "The merge gate is met at a pinned head." })
) {}

/**
 * The gate's verdict.
 *
 * @category models
 * @since 0.0.0
 */
export const MergeGateDecision = S.Union([MergeGateHold, MergeGateMerge]).pipe(
  $I.annoteSchema("MergeGateDecision", { description: "Hold with a routed reason, or merge at a pinned head." })
);

/**
 * Hold with a routed reason, or merge at a pinned head.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeGateDecision = typeof MergeGateDecision.Type;

/**
 * What the caller asserts about the merge: the head it saw, the time, the
 * attributed tolerances, and whether the review window is overridden.
 *
 * **Details**
 *
 * `forceWindow` exists for one case only: a fix that unblocks `main`. The
 * ruling text is in `feedback-review-window-before-merge`; the flag is
 * recorded in the merge line so the hand-off log shows every override.
 *
 * @category models
 * @since 0.0.0
 */
export const MergeGateOptions = S.Struct({
  wantSha: S.NonEmptyString,
  now: S.DateTimeUtcFromString,
  tolerate: S.Array(MergeGateTolerance),
  forceWindow: S.Boolean,
  windowSeconds: S.Finite,
}).pipe($I.annoteSchema("MergeGateOptions", { description: "What the caller asserts when it asks the gate." }));

/**
 * What the caller asserts when it asks the gate.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeGateOptions = typeof MergeGateOptions.Type;

/**
 * One gate question: the read and what the caller asserts about it.
 *
 * **Example** (Build a question)
 *
 * ```ts
 * import { MergeGateInput } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof MergeGateInput.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateInput extends S.Class<MergeGateInput>($I`MergeGateInput`)(
  { read: MergeGateRead, options: MergeGateOptions },
  $I.annote("MergeGateInput", { description: "The read and the caller's assertions the gate decides from." })
) {}

const goodConclusion = (conclusion: string | null): boolean =>
  conclusion === "success" || conclusion === "skipped" || conclusion === "neutral";

const latestRunPerName = (runs: ReadonlyArray<MergeGateCheckRun>): HashMap.HashMap<string, MergeGateCheckRun> =>
  A.reduce(runs, HashMap.empty<string, MergeGateCheckRun>(), (latest, run) =>
    latest.pipe(
      HashMap.get(run.name),
      O.exists((current) => current.id >= run.id)
    )
      ? latest
      : HashMap.set(latest, run.name, run)
  );

const hold = (prNumber: number, reason: MergeGateHoldReason, detail: string): MergeGateHold =>
  MergeGateHold.make({ prNumber, reason, detail });

const names = (runs: ReadonlyArray<MergeGateCheckRun>): string =>
  A.join(
    A.map(runs, (run) => run.name),
    ", "
  );

const sameHead = (want: string, head: string): boolean => Str.startsWith(want)(head) || want === head;

/**
 * Decide the gate from one read. Pure, so recorded payloads prove every branch.
 *
 * **Details**
 *
 * Criteria in order, first failure wins: head unchanged since the caller
 * looked; not draft; not conflicting; base ruleset readable; every required
 * context registered, complete and green; every other check complete and
 * green unless tolerated with an attribution; head commit time known; review
 * window elapsed unless forced; thread count known and zero. The order puts
 * the cheap structural refusals first and the two judgment calls (window,
 * threads) last, matching the hand-run gate.
 *
 * **Example** (A draft never merges)
 *
 * ```ts
 * import { MergeGateRead, decideMergeGate } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const read = MergeGateRead.make({
 *   prNumber: 1,
 *   title: "fix: x",
 *   headSha: "abc",
 *   draft: true,
 *   mergeableState: "clean",
 *   createdAt: DateTime.makeUnsafe(0),
 *   requiredContexts: O.some([]),
 *   checkRuns: [],
 *   readyAt: O.none(),
 *   headCommittedAt: O.some(DateTime.makeUnsafe(0)),
 *   unresolvedThreads: O.some(0),
 *   readAt: DateTime.makeUnsafe(0),
 * })
 * const decision = decideMergeGate({
 *   read,
 *   options: { wantSha: "abc", now: DateTime.makeUnsafe(0), tolerate: [], forceWindow: false, windowSeconds: 1200 },
 * })
 * console.log(decision._tag) // "hold"
 * ```
 *
 * @param input - The read and the caller's assertions.
 * @returns Hold with a routed reason, or merge at the pinned head.
 * @category workflows
 * @since 0.0.0
 */
export const decideMergeGate = (input: MergeGateInput): MergeGateDecision => {
  const { read, options } = input;
  const n = read.prNumber;
  if (!sameHead(options.wantSha, read.headSha)) {
    return hold(n, "head-moved", `head is ${read.headSha.slice(0, 10)}, caller saw ${options.wantSha.slice(0, 10)}`);
  }
  if (read.draft) return hold(n, "draft", "still draft; the owner flips ready at content-final");
  if (read.mergeableState === "dirty") return hold(n, "conflicting", "conflicts with the base; owner merges main");
  if (O.isNone(read.requiredContexts)) {
    return hold(n, "required-contexts-unknown", "base ruleset unreadable; never evaluate the gate without it");
  }
  const required = HashSet.fromIterable(read.requiredContexts.value);
  const latest = latestRunPerName(read.checkRuns);
  const missing = A.filter(read.requiredContexts.value, (context) => !HashMap.has(latest, context));
  if (A.isReadonlyArrayNonEmpty(missing)) {
    return hold(n, "required-pending", `required context(s) not registered on the head: ${A.join(missing, ", ")}`);
  }
  const runs = latest.pipe(HashMap.values, A.fromIterable);
  const requiredRuns = A.filter(runs, (run) => HashSet.has(required, run.name));
  const requiredPending = A.filter(requiredRuns, (run) => run.status !== "completed");
  if (A.isReadonlyArrayNonEmpty(requiredPending)) {
    return hold(n, "required-pending", `required still running: ${names(requiredPending)}`);
  }
  const requiredRed = A.filter(requiredRuns, (run) => !goodConclusion(run.conclusion));
  if (A.isReadonlyArrayNonEmpty(requiredRed)) {
    return hold(n, "required-red", `required red: ${names(requiredRed)}`);
  }
  const toleratedNames = HashSet.fromIterable(A.map(options.tolerate, (tolerance) => tolerance.check));
  const optionalRuns = A.filter(
    runs,
    (run) => !HashSet.has(required, run.name) && !HashSet.has(toleratedNames, run.name)
  );
  const optionalPending = A.filter(optionalRuns, (run) => run.status !== "completed");
  if (A.isReadonlyArrayNonEmpty(optionalPending)) {
    return hold(
      n,
      "pending",
      `still running, pass --tolerate "<check>=<attribution>" to merge over it: ${names(optionalPending)}`
    );
  }
  const optionalRed = A.filter(optionalRuns, (run) => !goodConclusion(run.conclusion));
  if (A.isReadonlyArrayNonEmpty(optionalRed)) {
    return hold(n, "red", `red, attribute it before tolerating: ${names(optionalRed)}`);
  }
  if (O.isNone(read.headCommittedAt)) {
    return hold(n, "head-time-unknown", "head commit time unreadable; the review window cannot be measured");
  }
  const readyAt = O.getOrElse(read.readyAt, () => read.createdAt);
  const windowStart = DateTime.max(readyAt, read.headCommittedAt.value);
  const windowAgeSeconds = Math.floor(
    (DateTime.toEpochMillis(options.now) - DateTime.toEpochMillis(windowStart)) / 1000
  );
  if (!options.forceWindow && windowAgeSeconds < options.windowSeconds) {
    const left = Math.ceil((options.windowSeconds - windowAgeSeconds) / 60);
    return hold(n, "review-window-open", `${left} min left; window started ${DateTime.formatIso(windowStart)}`);
  }
  if (O.isNone(read.unresolvedThreads)) {
    return hold(n, "threads-unknown", "review threads unreadable (GraphQL quota?); a missing count is never zero");
  }
  if (read.unresolvedThreads.value > 0) {
    return hold(n, "threads-unresolved", `${read.unresolvedThreads.value} unresolved thread(s)`);
  }
  const used = A.filter(options.tolerate, (tolerance) => HashMap.has(latest, tolerance.check));
  return MergeGateMerge.make({
    prNumber: n,
    headSha: read.headSha,
    commitTitle: `${read.title} (#${n})`,
    windowAgeSeconds,
    tolerated: used,
  });
};

/**
 * Render a decision as the one line the hand-off log keeps.
 *
 * **Example** (Render a hold)
 *
 * ```ts
 * import { MergeGateHold, renderMergeGateDecision } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderMergeGateDecision(MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" })))
 * // "#7 HOLD draft: still draft"
 * ```
 *
 * @param decision - The gate verdict.
 * @returns One line for the hand-off log.
 * @category rendering
 * @since 0.0.0
 */
export const renderMergeGateDecision = (decision: MergeGateDecision): string =>
  decision._tag === "hold"
    ? `#${decision.prNumber} HOLD ${decision.reason}: ${decision.detail}`
    : `#${decision.prNumber} GATE-MET at ${decision.headSha.slice(0, 10)} (window ${decision.windowAgeSeconds}s)${
        A.isReadonlyArrayNonEmpty(decision.tolerated)
          ? ` tolerated: ${A.join(
              A.map(decision.tolerated, (tolerance) => `${tolerance.check} [${tolerance.attribution}]`),
              "; "
            )}`
          : ""
      }`;

const GhPull = S.Struct({
  number: S.Finite,
  title: S.String,
  draft: S.Boolean,
  created_at: S.String,
  mergeable_state: S.NullOr(S.String),
  head: S.Struct({ sha: S.String }),
});
const GhCheckRuns = S.Struct({
  check_runs: S.Array(S.Struct({ id: S.Finite, name: S.String, status: S.String, conclusion: S.NullOr(S.String) })),
});
const GhTimelinePages = S.Struct({ event: S.String, created_at: S.optionalKey(S.String) }).pipe(S.Array, S.Array);
const GhCommit = S.Struct({ commit: S.Struct({ committer: S.Struct({ date: S.String }) }) });
const GhThreads = S.Struct({
  data: S.Struct({
    repository: S.Struct({
      pullRequest: S.Struct({
        reviewThreads: S.Struct({ totalCount: S.Finite, nodes: S.Array(S.Struct({ isResolved: S.Boolean })) }),
      }),
    }),
  }),
});
const GhMergeResult = S.Struct({ merged: S.Boolean, sha: S.optionalKey(S.String), message: S.optionalKey(S.String) });

const decodePull = S.decodeUnknownEffect(S.fromJsonString(GhPull));
const decodeCheckRunPages = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhCheckRuns)));
const decodeTimelinePages = S.decodeUnknownEffect(S.fromJsonString(GhTimelinePages));
const decodeCommit = S.decodeUnknownEffect(S.fromJsonString(GhCommit));
const decodeThreads = S.decodeUnknownEffect(S.fromJsonString(GhThreads));
const decodeMergeResult = S.decodeUnknownEffect(S.fromJsonString(GhMergeResult));

const THREADS_QUERY =
  "query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){totalCount nodes{isResolved}}}}}";

const ghFailure = (what: string) => (failure: GhCommandFailure) =>
  YeetCommandError.make({
    message: `${what} failed (${failure._tag}${failure._tag === "nonzero-exit" ? ` ${failure.exitCode}: ${Str.trim(failure.output)}` : ""}).`,
    command: failure.command,
    exitCode: 1,
  });

const gh = (context: RepoRunContext, label: string, args: ReadonlyArray<string>) =>
  ghOutput({ args, cwd: context.repoRoot, label, onFailure: ghFailure(label) });

const decodeOrFail = <A>(what: string, decode: (input: unknown) => Effect.Effect<A, S.SchemaError>, input: string) =>
  decode(input).pipe(Effect.mapError(YeetCommandError.new(`Failed to decode ${what}.`)));

const instant = (value: string): O.Option<DateTime.Utc> => DateTime.make(value);

/**
 * Read everything the gate needs for one pull request, once.
 *
 * **Details**
 *
 * REST for the pull request, check runs, timeline and head commit (core
 * quota); one GraphQL query for the unresolved thread count; the base ruleset
 * through the same reader `yeet monitor` uses. The thread read is the only
 * call allowed to fail softly, and it fails to `None`, which the decision
 * treats as a hold.
 *
 * @category workflows
 * @since 0.0.0
 */
export const readMergeGate = Effect.fn("Yeet.readMergeGate")(function* (
  context: RepoRunContext,
  prNumber: number
): Effect.fn.Return<MergeGateRead, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const pull = yield* decodeOrFail(
    "the pull request",
    decodePull,
    yield* gh(context, `gh api pulls/${prNumber}`, ["api", `repos/{owner}/{repo}/pulls/${prNumber}`])
  );
  // `--slurp` wraps pages in an array; fold the pages back into one check_runs list.
  const checkRunPages = yield* decodeOrFail(
    "the head check runs",
    decodeCheckRunPages,
    yield* gh(context, "gh api check-runs", [
      "api",
      `repos/{owner}/{repo}/commits/${pull.head.sha}/check-runs?per_page=100`,
      "--paginate",
      "--slurp",
    ])
  );
  const checkRuns = A.flatMap(checkRunPages, (page) => page.check_runs);
  const timeline = yield* decodeOrFail(
    "the pull request timeline",
    decodeTimelinePages,
    yield* gh(context, "gh api timeline", [
      "api",
      `repos/{owner}/{repo}/issues/${prNumber}/timeline?per_page=100`,
      "--paginate",
      "--slurp",
    ])
  );
  const readyAt = A.findLast(
    A.flatten(timeline),
    (event) => event.event === "ready_for_review" && event.created_at !== undefined
  ).pipe(O.flatMap((event) => instant(event.created_at ?? "")));
  const headCommittedAt = yield* gh(context, "gh api commit", [
    "api",
    `repos/{owner}/{repo}/commits/${pull.head.sha}`,
  ]).pipe(
    Effect.flatMap((output) => decodeOrFail("the head commit", decodeCommit, output)),
    Effect.map((commit) => instant(commit.commit.committer.date)),
    Effect.orElseSucceed(O.none<DateTime.Utc>)
  );
  const unresolvedThreads = yield* gh(context, "gh api graphql threads", [
    "api",
    "graphql",
    "-f",
    `query=${THREADS_QUERY}`,
    "-F",
    "owner={owner}",
    "-F",
    "name={repo}",
    "-F",
    `number=${prNumber}`,
  ]).pipe(
    Effect.flatMap((output) => decodeOrFail("the review threads", decodeThreads, output)),
    Effect.map(({ data }) => {
      const threads = data.repository.pullRequest.reviewThreads;
      // More threads than one page: the count is unknown, never a lower bound.
      return threads.totalCount > A.length(threads.nodes)
        ? O.none<number>()
        : O.some(A.length(A.filter(threads.nodes, (node) => !node.isResolved)));
    }),
    Effect.orElseSucceed(O.none<number>)
  );
  const ruleset = yield* readYeetRulesetRequiredContexts(context);
  return MergeGateRead.make({
    prNumber: pull.number,
    title: pull.title,
    headSha: pull.head.sha,
    draft: pull.draft,
    mergeableState: pull.mergeable_state ?? "unknown",
    createdAt: O.getOrElse(instant(pull.created_at), () => DateTime.makeUnsafe(0)),
    requiredContexts: O.map(ruleset, (rules) => rules.contexts),
    checkRuns: A.map(checkRuns, (run) =>
      MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion })
    ),
    readyAt,
    headCommittedAt,
    unresolvedThreads,
    readAt: yield* DateTime.now,
  });
});

/**
 * Result of the squash merge GitHub reported.
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateMerged extends S.Class<MergeGateMerged>($I`MergeGateMerged`)(
  { prNumber: S.Finite, mergeSha: S.String, commitTitle: S.NonEmptyString },
  $I.annote("MergeGateMerged", { description: "The squash merge GitHub confirmed." })
) {}

/**
 * Squash-merge at the pinned head with `<title> (#n)` as the commit title.
 *
 * **Gotchas**
 *
 * The `sha` field makes GitHub refuse server-side when the head moved between
 * the read and the merge, so a push landing in that window is never merged
 * sight-unseen.
 *
 * @category workflows
 * @since 0.0.0
 */
export const executeMergeGate = Effect.fn("Yeet.executeMergeGate")(function* (
  context: RepoRunContext,
  decision: MergeGateMerge
): Effect.fn.Return<MergeGateMerged, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* decodeOrFail(
    "the merge result",
    decodeMergeResult,
    yield* gh(context, `gh api merge #${decision.prNumber}`, [
      "api",
      "-X",
      "PUT",
      `repos/{owner}/{repo}/pulls/${decision.prNumber}/merge`,
      "-f",
      "merge_method=squash",
      "-f",
      `sha=${decision.headSha}`,
      "-f",
      `commit_title=${decision.commitTitle}`,
    ])
  );
  if (!result.merged) {
    return yield* YeetCommandError.make({
      message: `GitHub did not merge #${decision.prNumber}: ${result.message ?? "no message"}`,
      exitCode: 1,
    });
  }
  return MergeGateMerged.make({
    prNumber: decision.prNumber,
    mergeSha: result.sha ?? "",
    commitTitle: decision.commitTitle,
  });
});

/**
 * Options for one `yeet merge-gate` run.
 *
 * @category models
 * @since 0.0.0
 */
export const MergeGateRunOptions = S.Struct({
  prNumber: S.Finite,
  wantSha: S.NonEmptyString,
  tolerate: S.Array(MergeGateTolerance),
  forceWindow: S.Boolean,
  dryRun: S.Boolean,
}).pipe($I.annoteSchema("MergeGateRunOptions", { description: "One merge-gate invocation." }));

/**
 * One merge-gate invocation.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeGateRunOptions = typeof MergeGateRunOptions.Type;

/**
 * Read, decide, print, and merge unless the gate held or `--dry-run` was passed.
 *
 * **Details**
 *
 * A hold exits non-zero with the routed reason so a background waiter can
 * loop on it; a merge prints the merge sha and any tolerated attribution. The
 * window override is printed whenever it was used.
 *
 * @category workflows
 * @since 0.0.0
 */
export const runMergeGate = Effect.fn("Yeet.runMergeGate")(function* (
  context: RepoRunContext,
  options: MergeGateRunOptions
): Effect.fn.Return<MergeGateDecision, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const read = yield* readMergeGate(context, options.prNumber);
  const decision = decideMergeGate({
    read,
    options: {
      wantSha: options.wantSha,
      now: read.readAt,
      tolerate: options.tolerate,
      forceWindow: options.forceWindow,
      windowSeconds: MERGE_GATE_REVIEW_WINDOW_SECONDS,
    },
  });
  yield* Console.log(
    `[yeet] ${renderMergeGateDecision(decision)}${options.forceWindow ? " (review window forced)" : ""}`
  );
  if (decision._tag === "hold") {
    return yield* YeetCommandError.make({ message: renderMergeGateDecision(decision), exitCode: 1 });
  }
  if (options.dryRun) {
    yield* Console.log(`[yeet] dry run: would squash-merge #${decision.prNumber} as "${decision.commitTitle}"`);
    return decision;
  }
  const merged = yield* executeMergeGate(context, decision);
  yield* Console.log(`[yeet] MERGED #${merged.prNumber} -> ${merged.mergeSha.slice(0, 10)} "${merged.commitTitle}"`);
  return decision;
});
