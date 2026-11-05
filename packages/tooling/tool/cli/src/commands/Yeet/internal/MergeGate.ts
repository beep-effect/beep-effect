/**
 * The orchestrator's merge gate: re-verify one pull request at a pinned head
 * against AGENTS.md "Mergeable" plus the review-window ruling, then squash-merge.
 *
 * **Details**
 *
 * This is the CLI home of the gate the orchestrator session ran by hand on
 * 2026-10-06 (`merge.sh <pr> <sha10>`). The decision is a pure function of a
 * {@link MergeGateRead} so it can be tested from recorded GitHub payloads;
 * {@link readMergeGate} is the only read the decision depends on, and
 * {@link executeMergeGate} the only place that merges. After an S11 merge the
 * gate also lists and cancels the merged head's leftover runs and posts a
 * comment, all best effort. Every unknown fails closed: an unreadable ruleset,
 * a GraphQL thread count that did not come back, a missing head commit time,
 * a commitlint run that gave no verdict, and, in strict mode, a required
 * context with no check run.
 *
 * The read also predicts the squash commit message GitHub will write for the
 * merge (`SquashCommitlint.ts`) and lints it with the repo's commitlint: `main`
 * is squash-only and its Commitlint range is previous-main..new-main, so a
 * squash body that fails `commitlint.config.ts` is a red on `main` that only
 * the next merge clears (ep47, 2026-10-19). A failing or missing verdict holds
 * the gate as `squash-commitlint`, in relaxed mode too.
 *
 * **Gotchas**
 *
 * A non-required red or pending check (Heavy / Coverage Regression, a
 * rate-limited Vercel deploy) is never tolerated by name alone. The caller
 * passes `--tolerate "<check>=<attribution>"` after reading the run, and the
 * attribution is echoed in the merge line so the hand-off log carries it.
 *
 * `--relaxed` is the S11 merge (operator ruling 2026-10-09, AGENTS.md
 * "Mergeable"): no pending check holds and no inherited red holds, required
 * ones included, but the structural, ruleset, window and thread holds stay,
 * and a head on which not one required context has run still holds. Since
 * 2026-11-02 a red the PR introduced holds as `own-red`: the same required
 * check is a completed success on the merge-base commit or on the base tip
 * (`compare/base...head`, then each commit's check runs) and nothing
 * attributes it (`--tolerate`, the body's "Inherited reds (S11)" section
 * stamped with this head, the `unblocks-main` label). On
 * 2026-11-02 #2522 (a stale schema-catalog shard, Repo Sanity) and #2526
 * (repo-cli-3 package-scripts expectations) merged over their own reds and
 * each cost an unblocker. Every check that was not green is recorded with its
 * attribution in the merge line and in a PR comment, and the merged head's
 * leftover workflow runs are cancelled.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { outstanding, ReviewThread } from "@beep/github/ReviewThread";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubRest } from "../../../internal/github/index.ts";
import { RepoRunContext } from "../../../internal/repo-run/index.ts";
import { enforceReviewerGate, withReviewerOperatorClient } from "../../Reviewer/ReviewerRuleset.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { parseYeetInheritedRedsRecord, provideYeetGhLogin, yeetGithubFailure } from "./GhOps.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import { MergeGateCheckRun } from "./MergeGate.schemas.ts";
import { readYeetReviewWindow, renderYeetReviewWindow, YeetReviewWindow } from "./ReviewWindow.ts";
import { readYeetRulesetRequiredContexts } from "./Settle.ts";
import { broadcastPacketSiblings } from "./Siblings.ts";
import {
  readSquashCommitlint,
  renderSquashCommitlintVerdict,
  SquashCommitlintReport,
  SquashPullRequestFacts,
} from "./SquashCommitlint.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubCheckRunRecord, GithubWorkflowRunRecord } from "../../../internal/github/index.ts";
import type { YeetGithubServices } from "./GhOps.ts";

export { MergeGateCheckRun } from "./MergeGate.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MergeGate");

/**
 * A check the orchestrator tolerates red or pending, with the attribution that
 * justifies it: non-required checks only, unless the gate is `--relaxed` (S11),
 * where it attributes required checks too.
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
export class MergeGateTolerance extends S.Opaque<MergeGateTolerance, { readonly brand: unique symbol }>()(
  S.Struct({ check: S.NonEmptyString, attribution: S.NonEmptyString }).pipe(
    $I.annoteSchema("MergeGateTolerance", {
      description:
        "A check tolerated red or pending with its attribution: non-required only, unless the gate is relaxed (S11).",
    })
  )
) {}

/**
 * Build a parser for one `"<check>=<attribution>"` flag value: split on the
 * first `=`, trim both sides, refuse an empty side. `--tolerate` and
 * `yeet ready --inherited` share this form.
 *
 * **Example** (Parse an attributed check into a tolerance)
 *
 * ```ts
 * import { MergeGateTolerance, parseAttributedCheck } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const parse = parseAttributedCheck((fields) => MergeGateTolerance.make(fields))
 * console.log(O.getOrThrow(parse("Lint = red on main since 2c1cb448ba")).check) // "Lint"
 * console.log(O.isNone(parse("Lint"))) // true
 * ```
 *
 * @param make - Builds the model from the trimmed check name and attribution.
 * @returns A parser that yields none when there is no `=` or either side is empty.
 * @category parsing
 * @since 0.0.0
 */
export const parseAttributedCheck =
  <A>(make: (fields: { readonly check: string; readonly attribution: string }) => A) =>
  (value: string): O.Option<A> =>
    Str.indexOf("=")(value).pipe(
      O.map((separator) => ({
        check: Str.trim(Str.slice(0, separator)(value)),
        attribution: Str.trim(Str.slice(separator + 1)(value)),
      })),
      O.filter(({ check, attribution }) => Str.isNonEmpty(check) && Str.isNonEmpty(attribution)),
      O.map(make)
    );

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
export const parseMergeGateTolerance = parseAttributedCheck((fields) => MergeGateTolerance.make(fields));

const AttributedCheckJson = S.fromJsonString(S.String);
const encodeAttributedCheckJson = S.encodeEffect(AttributedCheckJson);

/**
 * Decode every value of one repeatable `"<check>=<attribution>"` flag, or
 * refuse naming each malformed value before anything is read.
 *
 * **Example** (Decode the tolerances)
 *
 * ```ts
 * import { decodeAttributedCheckFlags, parseMergeGateTolerance } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const tolerances = decodeAttributedCheckFlags("tolerate", ["Lint=flake"], parseMergeGateTolerance)
 * console.log(Effect.isEffect(tolerances)) // true
 * ```
 *
 * @param flag - The flag name, without the leading dashes, for the refusal.
 * @param values - The raw flag values.
 * @param parse - The parser for one value.
 * @returns The parsed values, or a `YeetCommandError` naming the malformed ones.
 * @category parsing
 * @since 0.0.0
 */
export const decodeAttributedCheckFlags = Effect.fnUntraced(function* <A>(
  flag: string,
  values: ReadonlyArray<string>,
  parse: (value: string) => O.Option<A>
): Effect.fn.Return<ReadonlyArray<A>, YeetCommandError> {
  const parsed = A.map(values, parse);
  const malformed = A.filter(A.zip(values, parsed), ([, value]) => O.isNone(value));
  if (A.isReadonlyArrayNonEmpty(malformed)) {
    const quoted = yield* Effect.forEach(malformed, ([value]) =>
      encodeAttributedCheckJson(value).pipe(
        Effect.mapError(YeetCommandError.new("Failed to encode a malformed attributed check."))
      )
    );
    return yield* YeetCommandError.make({
      message: `--${flag} needs "<check name>=<attribution>"; got ${A.join(quoted, ", ")}.`,
      exitCode: 1,
    });
  }
  return A.getSomes(parsed);
});

/**
 * Whether a check that did not hold an S11 merge was red or still pending.
 *
 * **Example** (Narrow a state)
 *
 * ```ts
 * import { MergeGateCheckState } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(MergeGateCheckState.is.red("red")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeGateCheckState = LiteralKit(["red", "pending"]).pipe(
  $I.annoteSchema("MergeGateCheckState", {
    description: "Whether a check that was not green at an S11 merge was red or still pending.",
  })
);

/**
 * Whether a check that was not green at an S11 merge was red or still pending.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeGateCheckState = typeof MergeGateCheckState.Type;

/**
 * One check that was not green when an S11 (`--relaxed`) merge went through.
 *
 * **Details**
 *
 * `required` is membership in the base ruleset's contexts; `attribution` is
 * the matching `--tolerate` text, else {@link MERGE_GATE_S11_DEFAULT_ATTRIBUTION}.
 *
 * **Example** (A required red recorded at merge)
 *
 * ```ts
 * import { MergeGateCheckAtMerge } from "@beep/repo-cli/test/Yeet"
 *
 * const entry = MergeGateCheckAtMerge.make({
 *   check: "Lint",
 *   state: "red",
 *   required: true,
 *   attribution: "inherited: red on main since 2c1cb448ba, fix in #1477",
 * })
 * console.log(entry.state) // "red"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateCheckAtMerge extends S.Opaque<MergeGateCheckAtMerge, { readonly brand: unique symbol }>()(
  S.Struct({
    check: S.NonEmptyString,
    state: MergeGateCheckState,
    required: S.Boolean,
    attribution: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("MergeGateCheckAtMerge", {
      description: "One check that was not green when an S11 merge went through, with its attribution.",
    })
  )
) {}

/**
 * The attribution an S11 merge records for a check no `--tolerate` named.
 *
 * **Example** (Read the default attribution)
 *
 * ```ts
 * import { MERGE_GATE_S11_DEFAULT_ATTRIBUTION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(MERGE_GATE_S11_DEFAULT_ATTRIBUTION.startsWith("S11:")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MERGE_GATE_S11_DEFAULT_ATTRIBUTION = "S11: unattributed at merge; the same-day fix PR burns it down";

/**
 * The label that marks a pull request as the one fix for a red `main`: under
 * S11 every red on it is inherited by definition, so the gate merges over them.
 *
 * **Example** (Read the label)
 *
 * ```ts
 * import { MERGE_GATE_UNBLOCKS_MAIN_LABEL } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(MERGE_GATE_UNBLOCKS_MAIN_LABEL) // "unblocks-main"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MERGE_GATE_UNBLOCKS_MAIN_LABEL = "unblocks-main";

/**
 * The check runs on one commit of the pull request's base branch, reduced to
 * the latest per name by the gate.
 *
 * **Example** (A green base)
 *
 * ```ts
 * import { MergeGateBaseRuns, MergeGateCheckRun } from "@beep/repo-cli/test/Yeet"
 *
 * const base = MergeGateBaseRuns.make({
 *   sha: "2c1cb448ba0000000000000000000000000000ab",
 *   checkRuns: [MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" })],
 * })
 * console.log(base.checkRuns.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateBaseRuns extends S.Opaque<MergeGateBaseRuns, { readonly brand: unique symbol }>()(
  S.Struct({ sha: S.NonEmptyString, checkRuns: S.Array(MergeGateCheckRun) }).pipe(
    $I.annoteSchema("MergeGateBaseRuns", {
      description: "The check runs on one base-branch commit, half of the inherited-red evidence.",
    })
  )
) {}

/**
 * The evidence that tells a red the PR inherited from one it introduced: the
 * check runs on the merge-base commit and on the base branch tip.
 *
 * **Details**
 *
 * Both come from one `compare/<base>...<head>` read (`merge_base_commit` and
 * `base_commit`). Hosted CI tests `refs/pull/N/merge`, the head on the base
 * tip at run time, so neither commit alone is what CI saw: a `main` red at
 * the merge-base that was fixed later would excuse a red the PR now causes, and
 * a `main` red introduced after the merge-base would read as the PR's own. A
 * red is inherited only when the check is not a completed success on both
 * commits; green on either makes it the PR's own. When the PR is up to date
 * with its base the two are the same commit.
 *
 * **Example** (An up-to-date PR)
 *
 * ```ts
 * import { MergeGateBaseEvidence, MergeGateBaseRuns } from "@beep/repo-cli/test/Yeet"
 *
 * const base = MergeGateBaseRuns.make({ sha: "2c1cb448ba0000000000000000000000000000ab", checkRuns: [] })
 * console.log(MergeGateBaseEvidence.make({ mergeBase: base, baseTip: base }).baseTip.sha === base.sha) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateBaseEvidence extends S.Opaque<MergeGateBaseEvidence, { readonly brand: unique symbol }>()(
  S.Struct({ mergeBase: MergeGateBaseRuns, baseTip: MergeGateBaseRuns }).pipe(
    $I.annoteSchema("MergeGateBaseEvidence", {
      description: "Check runs on the merge-base commit and the base tip: the inherited-red evidence.",
    })
  )
) {}

/**
 * Everything the gate decides on, read once from GitHub at a point in time.
 *
 * **Details**
 *
 * `requiredContexts` is `None` when the base ruleset could not be read;
 * `unresolvedThreads` is `None` when the GraphQL thread read failed or was
 * truncated; `window` is `unknown` when the review-window reads failed;
 * `squashCommitlint` carries an `unavailable` verdict when commitlint could not
 * judge the predicted squash message; `baseRuns` is `None` when the merge-base
 * commit, the base tip or their check runs could not be read. Each unknown
 * holds the gate rather than reading as "nothing to worry about". `labels` are
 * the PR's label names and `attributedChecks` the check names its body
 * attributes in the "Inherited reds (S11)" section, counted only when that
 * section is stamped with this head; both feed the relaxed gate's
 * inherited-versus-own distinction.
 *
 * **Example** (Build a read)
 *
 * ```ts
 * import { MergeGateRead, SquashCommitlintPass, SquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 *
 * const read = MergeGateRead.make({
 *   prNumber: 1459,
 *   title: "feat(ciops): P2 projection",
 *   headSha: "212fe39b4f0000000000000000000000000000ab",
 *   draft: false,
 *   mergeableState: "clean",
 *   labels: [],
 *   attributedChecks: [],
 *   requiredContexts: O.some(["Lint"]),
 *   checkRuns: [],
 *   baseRuns: O.none(),
 *   window: { _tag: "elapsed", anchor: "ready-for-review", anchoredAt: "2026-10-06T08:00:52Z", windowMs: 1200000 },
 *   unresolvedThreads: O.some(0),
 *   squashCommitlint: {
 *     message: SquashCommitMessage.make({ header: "feat(ciops): P2 projection (#1459)", body: "" }),
 *     verdict: SquashCommitlintPass.make({}),
 *   },
 *   readAt: DateTime.makeUnsafe(0),
 * })
 * console.log(read.prNumber) // 1459
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateRead extends S.Opaque<MergeGateRead, { readonly brand: unique symbol }>()(
  S.Struct({
    prNumber: S.Finite,
    title: S.String,
    headSha: S.NonEmptyString,
    draft: S.Boolean,
    mergeableState: S.String,
    labels: S.Array(S.String),
    attributedChecks: S.Array(S.NonEmptyString),
    requiredContexts: S.NonEmptyString.pipe(S.Array, S.Option),
    checkRuns: S.Array(MergeGateCheckRun),
    baseRuns: S.Option(MergeGateBaseEvidence),
    window: YeetReviewWindow,
    unresolvedThreads: S.Option(S.Finite),
    squashCommitlint: SquashCommitlintReport,
    readAt: S.DateTimeUtcFromString,
  }).pipe($I.annoteSchema("MergeGateRead", { description: "The pull request facts the merge gate decides on." }))
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
  "squash-commitlint",
  "required-contexts-unknown",
  "required-pending",
  "required-red",
  "own-red",
  "base-runs-unknown",
  "pending",
  "red",
  "review-window-unknown",
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
 * **Example** (A routed hold)
 *
 * ```ts
 * import { MergeGateHold } from "@beep/repo-cli/test/Yeet"
 *
 * const held = MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" })
 * console.log(held._tag) // "hold"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateHold extends S.Opaque<MergeGateHold, { readonly brand: unique symbol }>()(
  S.TaggedStruct("hold", { prNumber: S.Finite, reason: MergeGateHoldReason, detail: S.NonEmptyString }).pipe(
    $I.annoteSchema("MergeGateHold", { description: "The merge gate refused on its first unmet criterion." })
  )
) {}

/**
 * The gate is met: merge at this head with this squash title.
 *
 * **Details**
 *
 * `atMerge` lists every check that was not green when a `relaxed` (S11) gate
 * was met, required first and then by name; it is empty when not relaxed.
 *
 * **Example** (A met gate)
 *
 * ```ts
 * import { MergeGateMerge } from "@beep/repo-cli/test/Yeet"
 *
 * const met = MergeGateMerge.make({
 *   prNumber: 7,
 *   headSha: "abc",
 *   commitTitle: "fix: x (#7)",
 *   windowAgeSeconds: 1260,
 *   tolerated: [],
 *   relaxed: false,
 *   atMerge: [],
 * })
 * console.log(met._tag) // "merge"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateMerge extends S.Opaque<MergeGateMerge, { readonly brand: unique symbol }>()(
  S.TaggedStruct("merge", {
    prNumber: S.Finite,
    headSha: S.NonEmptyString,
    commitTitle: S.NonEmptyString,
    windowAgeSeconds: S.Finite,
    tolerated: S.Array(MergeGateTolerance),
    relaxed: S.Boolean,
    atMerge: S.Array(MergeGateCheckAtMerge),
  }).pipe($I.annoteSchema("MergeGateMerge", { description: "The merge gate is met at a pinned head." }))
) {}

/**
 * The gate's verdict.
 *
 * **Example** (Check a decision)
 *
 * ```ts
 * import { MergeGateDecision, MergeGateHold } from "@beep/repo-cli/test/Yeet"
 *
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MergeGateDecision)(MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" }))) // true
 * ```
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
 * The window itself (20 minutes by default, `BEEP_YEET_REVIEW_WINDOW`) is
 * read by `readYeetReviewWindow`, the same reader `yeet monitor` uses, so one
 * definition governs both. `forceWindow` exists for one case only: a fix that
 * unblocks `main`. The ruling text is in `feedback-review-window-before-merge`;
 * the flag is recorded in the merge line so the hand-off log shows every override.
 * `relaxed` is the S11 merge: no red or pending check holds, and `tolerate`
 * may then attribute required checks too.
 *
 * **Example** (State the caller's assertions)
 *
 * ```ts
 * import { MergeGateOptions } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime";
 * const options = MergeGateOptions.make({
 *   wantSha: "abc",
 *   now: DateTime.makeUnsafe(0),
 *   tolerate: [],
 *   forceWindow: false,
 *   relaxed: false,
 * })
 * console.log(options.forceWindow) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateOptions extends S.Opaque<MergeGateOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    wantSha: S.NonEmptyString,
    now: S.DateTimeUtcFromString,
    tolerate: S.Array(MergeGateTolerance),
    forceWindow: S.Boolean,
    relaxed: S.Boolean,
  }).pipe($I.annoteSchema("MergeGateOptions", { description: "What the caller asserts when it asks the gate." }))
) {}

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
export class MergeGateInput extends S.Opaque<MergeGateInput, { readonly brand: unique symbol }>()(
  S.Struct({ read: MergeGateRead, options: MergeGateOptions }).pipe(
    $I.annoteSchema("MergeGateInput", { description: "The read and the caller's assertions the gate decides from." })
  )
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

const holdWhen = (
  condition: boolean,
  prNumber: number,
  reason: MergeGateHoldReason,
  detail: string
): O.Option<MergeGateHold> => (condition ? O.some(hold(prNumber, reason, detail)) : O.none());

const names = (runs: ReadonlyArray<MergeGateCheckRun>): string =>
  A.join(
    A.map(runs, (run) => run.name),
    ", "
  );

const sameHead = (want: string, head: string): boolean => Str.startsWith(want)(head) || want === head;

// Cheap structural refusals, before any check is read.
const structuralHold = ({ read, options }: MergeGateInput): O.Option<MergeGateHold> =>
  O.firstSomeOf([
    holdWhen(
      !sameHead(options.wantSha, read.headSha),
      read.prNumber,
      "head-moved",
      `head is ${Str.slice(0, 10)(read.headSha)}, caller saw ${Str.slice(0, 10)(options.wantSha)}`
    ),
    holdWhen(read.draft, read.prNumber, "draft", "still draft; the owner flips ready at content-final"),
    holdWhen(
      read.mergeableState === "dirty",
      read.prNumber,
      "conflicting",
      "conflicts with the base; owner merges main"
    ),
  ]);

// The squash message GitHub will write is commitlint input on main; a failing
// or missing verdict holds in both modes, like the structural refusals.
const squashCommitlintHold = (read: MergeGateRead): O.Option<MergeGateHold> =>
  holdWhen(
    read.squashCommitlint.verdict._tag !== "pass",
    read.prNumber,
    "squash-commitlint",
    renderSquashCommitlintVerdict(read.squashCommitlint.verdict)
  );

const runsHold = (
  runs: ReadonlyArray<MergeGateCheckRun>,
  prNumber: number,
  reason: MergeGateHoldReason,
  prefix: string
): O.Option<MergeGateHold> => holdWhen(A.isReadonlyArrayNonEmpty(runs), prNumber, reason, `${prefix}: ${names(runs)}`);

const isPending = (run: MergeGateCheckRun): boolean => run.status !== "completed";
const isRed = (run: MergeGateCheckRun): boolean => !goodConclusion(run.conclusion);

// The ruleset is how the gate tells required from optional, so an unreadable
// or empty one holds in both modes, relaxed included.
const requiredContextsStep = (read: MergeGateRead): Result.Result<ReadonlyArray<string>, MergeGateHold> =>
  O.match(read.requiredContexts, {
    onNone: () =>
      Result.fail(
        hold(read.prNumber, "required-contexts-unknown", "base ruleset unreadable; never evaluate the gate without it")
      ),
    onSome: (contexts) =>
      A.isReadonlyArrayNonEmpty(contexts)
        ? Result.succeed(contexts)
        : Result.fail(
            hold(
              read.prNumber,
              "required-contexts-unknown",
              "base ruleset requires no status checks; no CI evidence to gate on"
            )
          ),
  });

// Required contexts must be registered, complete and green; every other check
// must be too unless the caller attributed it with --tolerate.
const checksHold = (
  { read, options }: MergeGateInput,
  latest: HashMap.HashMap<string, MergeGateCheckRun>,
  contexts: ReadonlyArray<string>
): O.Option<MergeGateHold> => {
  const required = HashSet.fromIterable(contexts);
  const tolerated = HashSet.fromIterable(A.map(options.tolerate, (tolerance) => tolerance.check));
  const runs = latest.pipe(HashMap.values, A.fromIterable);
  const requiredRuns = A.filter(runs, (run) => HashSet.has(required, run.name));
  const optionalRuns = A.filter(runs, (run) => !HashSet.has(required, run.name) && !HashSet.has(tolerated, run.name));
  const missing = A.filter(contexts, (context) => !HashMap.has(latest, context));
  return O.firstSomeOf([
    holdWhen(
      A.isReadonlyArrayNonEmpty(missing),
      read.prNumber,
      "required-pending",
      `required context(s) not registered on the head: ${A.join(missing, ", ")}`
    ),
    runsHold(A.filter(requiredRuns, isPending), read.prNumber, "required-pending", "required still running"),
    runsHold(A.filter(requiredRuns, isRed), read.prNumber, "required-red", "required red"),
    runsHold(
      A.filter(optionalRuns, isPending),
      read.prNumber,
      "pending",
      'still running, pass --tolerate "<check>=<attribution>" to merge over it'
    ),
    runsHold(A.filter(optionalRuns, isRed), read.prNumber, "red", "red, attribute it before tolerating"),
  ]);
};

// S11 merges over failing jobs, never without CI evidence: when not one
// required context has registered a run on the head (CI never fired, as on an
// informally stacked PR), relaxed mode holds like strict mode does.
const relaxedEvidenceHold = (
  { read }: MergeGateInput,
  latest: HashMap.HashMap<string, MergeGateCheckRun>,
  contexts: ReadonlyArray<string>
): O.Option<MergeGateHold> =>
  holdWhen(
    !A.some(contexts, (context) => HashMap.has(latest, context)),
    read.prNumber,
    "required-pending",
    `no required context has run on the head (${A.join(contexts, ", ")}); S11 merges over failing jobs, never without CI evidence`
  );

const baseRunIsGreen = (run: MergeGateCheckRun): boolean => !isPending(run) && !isRed(run);

const isUnblocksMain = (read: MergeGateRead): boolean => A.contains(read.labels, MERGE_GATE_UNBLOCKS_MAIN_LABEL);

// A red the PR attributes: --tolerate names it, or the body's "Inherited reds
// (S11)" section (written by `yeet ready --inherited`) does.
const isAttributed = ({ read, options }: MergeGateInput, check: string): boolean =>
  A.contains(read.attributedChecks, check) || A.some(options.tolerate, (tolerance) => tolerance.check === check);

const latestBaseRun = (base: MergeGateBaseRuns, check: string): O.Option<MergeGateCheckRun> =>
  HashMap.get(latestRunPerName(base.checkRuns), check);

const describeBaseRun = (run: MergeGateCheckRun): string =>
  `run ${run.id} ${isPending(run) ? run.status : (run.conclusion ?? "without conclusion")}`;

const sha10 = Str.slice(0, 10);

// The two base commits, once when the PR is up to date with its base.
const evidenceCommits = (evidence: MergeGateBaseEvidence): ReadonlyArray<readonly [string, MergeGateBaseRuns]> =>
  evidence.mergeBase.sha === evidence.baseTip.sha
    ? [["merge-base", evidence.mergeBase]]
    : [
        ["merge-base", evidence.mergeBase],
        ["base tip", evidence.baseTip],
      ];

// The first base commit on which the check completed green: proof the PR owns the red.
const greenBaseRun = (
  evidence: MergeGateBaseEvidence,
  check: string
): O.Option<readonly [string, MergeGateBaseRuns, MergeGateCheckRun]> =>
  A.findFirst(
    A.getSomes(
      A.map(evidenceCommits(evidence), ([label, base]) =>
        O.map(latestBaseRun(base, check), (run) => [label, base, run] as const)
      )
    ),
    ([, , run]) => baseRunIsGreen(run)
  );

// S11 as amended 2026-11-02: a relaxed merge still holds on a red required
// check the PR introduced. A red is inherited when the same check is not a
// completed success on the merge-base commit nor on the base tip (red, pending
// or absent on both), when the PR attributes it, or when the PR carries the
// unblocks-main label; every other red is the PR's own and holds as `own-red`.
// An unattributed red with no readable base holds too: an unknown base never
// proves a red inherited.
const ownRedHold = (
  input: MergeGateInput,
  latest: HashMap.HashMap<string, MergeGateCheckRun>,
  contexts: ReadonlyArray<string>
): O.Option<MergeGateHold> => {
  const { read } = input;
  if (isUnblocksMain(read)) return O.none();
  const required = HashSet.fromIterable(contexts);
  const unattributedReds = latest.pipe(
    HashMap.values,
    A.fromIterable,
    A.filter(
      (run) => HashSet.has(required, run.name) && !isPending(run) && isRed(run) && !isAttributed(input, run.name)
    )
  );
  if (!A.isReadonlyArrayNonEmpty(unattributedReds)) return O.none();
  return O.match(read.baseRuns, {
    onNone: () =>
      O.some(
        hold(
          read.prNumber,
          "base-runs-unknown",
          `base check runs unreadable for ${names(unattributedReds)}; an unknown base never proves a red inherited`
        )
      ),
    onSome: (evidence) => {
      const own = A.getSomes(
        A.map(unattributedReds, (run) =>
          O.map(
            greenBaseRun(evidence, run.name),
            ([label, base, baseRun]) => `${run.name} (base run ${baseRun.id} green at ${label} ${sha10(base.sha)})`
          )
        )
      );
      return holdWhen(A.isReadonlyArrayNonEmpty(own), read.prNumber, "own-red", A.join(own, ", "));
    },
  });
};

// Describe the check on each base commit, for the attribution of an inherited red.
const baseEvidenceText = (evidence: MergeGateBaseEvidence, check: string): string =>
  A.join(
    A.map(evidenceCommits(evidence), ([label, base]) =>
      O.match(latestBaseRun(base, check), {
        onNone: () => `no run on ${label} ${sha10(base.sha)}`,
        onSome: (run) => `${describeBaseRun(run)} on ${label} ${sha10(base.sha)}`,
      })
    ),
    "; "
  );

// The attribution a relaxed merge records for a red no --tolerate named: the
// label, the body record, or the merge-base evidence, else the S11 default.
const inheritedAttribution = (read: MergeGateRead, check: string): O.Option<string> =>
  isUnblocksMain(read)
    ? O.some(`inherited: ${MERGE_GATE_UNBLOCKS_MAIN_LABEL} PR, the fix for a red main`)
    : A.contains(read.attributedChecks, check)
      ? O.some('inherited: attributed in the PR body ("Inherited reds (S11)")')
      : read.baseRuns.pipe(
          O.filter((evidence) => O.isNone(greenBaseRun(evidence, check))),
          O.filter((evidence) => A.some(evidenceCommits(evidence), ([, base]) => O.isSome(latestBaseRun(base, check)))),
          O.map((evidence) => `inherited: ${baseEvidenceText(evidence, check)}`)
        );

const atMergeOrder = Order.combine(
  Order.mapInput(Order.flip(Order.Boolean), (entry: MergeGateCheckAtMerge) => entry.required),
  Order.mapInput(Order.String, (entry: MergeGateCheckAtMerge) => entry.check)
);

// S11: no inherited check holds, so record every one that is not green. An
// unregistered required context and a run still going are pending; a completed
// run with a bad conclusion is red. --tolerate supplies the attribution for
// required and optional checks alike; a red without one carries the evidence
// that made it inherited when the gate has any.
const checksAtMerge = (
  { read, options }: MergeGateInput,
  latest: HashMap.HashMap<string, MergeGateCheckRun>,
  contexts: ReadonlyArray<string>
): ReadonlyArray<MergeGateCheckAtMerge> => {
  const required = HashSet.fromIterable(contexts);
  const atMerge = (check: string, state: MergeGateCheckState) =>
    MergeGateCheckAtMerge.make({
      check,
      state,
      required: HashSet.has(required, check),
      attribution: A.findFirst(options.tolerate, (tolerance) => tolerance.check === check).pipe(
        O.map((tolerance) => tolerance.attribution),
        O.orElse(() => (state === "red" ? inheritedAttribution(read, check) : O.none())),
        O.getOrElse(() => MERGE_GATE_S11_DEFAULT_ATTRIBUTION)
      ),
    });
  const unregistered = A.filter(A.dedupe(contexts), (context) => !HashMap.has(latest, context));
  const notGreen = latest.pipe(
    HashMap.values,
    A.fromIterable,
    A.filter((run) => isPending(run) || isRed(run))
  );
  return A.sort(
    [
      ...A.map(unregistered, (context) => atMerge(context, "pending")),
      ...A.map(notGreen, (run) => atMerge(run.name, isPending(run) ? "pending" : "red")),
    ],
    atMergeOrder
  );
};

// An unknown window always holds; an open one holds unless the caller forced
// it. Otherwise the step yields how long the window has run, for the merge line.
const windowStep = ({ read, options }: MergeGateInput): Result.Result<number, MergeGateHold> => {
  const window = read.window;
  if (window._tag === "unknown") {
    return Result.fail(hold(read.prNumber, "review-window-unknown", renderYeetReviewWindow(window)));
  }
  if (!options.forceWindow && window._tag === "open") {
    return Result.fail(hold(read.prNumber, "review-window-open", renderYeetReviewWindow(window)));
  }
  return Result.succeed(
    DateTime.make(window.anchoredAt).pipe(
      O.map((anchored) => Math.floor((DateTime.toEpochMillis(options.now) - DateTime.toEpochMillis(anchored)) / 1000)),
      O.getOrElse(() => 0)
    )
  );
};

const threadsHold = (read: MergeGateRead): O.Option<MergeGateHold> =>
  O.match(read.unresolvedThreads, {
    onNone: () =>
      O.some(
        hold(
          read.prNumber,
          "threads-unknown",
          "review threads unreadable (GraphQL quota?); a missing count is never zero"
        )
      ),
    onSome: (count) => holdWhen(count > 0, read.prNumber, "threads-unresolved", `${count} unresolved thread(s)`),
  });

/**
 * Decide the gate from one read. Pure, so recorded payloads prove every branch.
 *
 * **Details**
 *
 * Criteria in order, first failure wins: head unchanged since the caller
 * looked; not draft; not conflicting; the predicted squash commit message
 * passes commitlint; base ruleset readable; every required
 * context registered, complete and green; every other check complete and
 * green unless tolerated with an attribution; review window known and
 * elapsed unless forced; thread count known and zero. The order puts
 * the cheap structural refusals first and the two judgment calls (window,
 * threads) last, matching the hand-run gate.
 *
 * With `relaxed` (S11) a pending check never holds, and a red one holds only
 * when the PR introduced it: a required red whose check is a completed success
 * on the merge-base commit or on the base tip, that neither `--tolerate` nor
 * the PR body (on this head) attributes, on a PR without the `unblocks-main`
 * label (`own-red`, amendment of 2026-11-02). An unattributed red with no readable merge-base runs holds
 * as `base-runs-unknown`. Every other check that is not green is recorded in
 * `atMerge` instead. Relaxed mode still holds when not one required context
 * has registered a run on the head (no CI evidence). Every other criterion,
 * the ruleset included, holds exactly as it does without it.
 *
 * **Example** (A draft never merges)
 *
 * ```ts
 * import { MergeGateRead, SquashCommitlintPass, SquashCommitMessage, decideMergeGate } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 *
 * const read = MergeGateRead.make({
 *   prNumber: 1,
 *   title: "fix: x",
 *   headSha: "abc",
 *   draft: true,
 *   mergeableState: "clean",
 *   labels: [],
 *   attributedChecks: [],
 *   requiredContexts: O.some([]),
 *   checkRuns: [],
 *   baseRuns: O.none(),
 *   window: { _tag: "unknown", reason: "not read" },
 *   unresolvedThreads: O.some(0),
 *   squashCommitlint: {
 *     message: SquashCommitMessage.make({ header: "fix: x (#1)", body: "" }),
 *     verdict: SquashCommitlintPass.make({}),
 *   },
 *   readAt: DateTime.makeUnsafe(0),
 * })
 * const decision = decideMergeGate({
 *   read,
 *   options: { wantSha: "abc", now: DateTime.makeUnsafe(0), tolerate: [], forceWindow: false, relaxed: true },
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
  const latest = latestRunPerName(read.checkRuns);
  const contexts = requiredContextsStep(read);
  const window = windowStep(input);
  return O.firstSomeOf([
    structuralHold(input),
    squashCommitlintHold(read),
    // The ruleset holds in both modes; relaxed mode only needs one required run.
    Result.match(contexts, {
      onFailure: O.some,
      onSuccess: (required) =>
        options.relaxed
          ? O.orElse(relaxedEvidenceHold(input, latest, required), () => ownRedHold(input, latest, required))
          : checksHold(input, latest, required),
    }),
    Result.getFailure(window),
    threadsHold(read),
  ]).pipe(
    O.getOrElse(
      (): MergeGateDecision =>
        MergeGateMerge.make({
          prNumber: read.prNumber,
          headSha: read.headSha,
          commitTitle: `${read.title} (#${read.prNumber})`,
          // Every hold above is None here, so the ruleset and window steps succeeded.
          windowAgeSeconds: Result.getOrThrow(window),
          tolerated: A.filter(options.tolerate, (tolerance) => HashMap.has(latest, tolerance.check)),
          relaxed: options.relaxed,
          atMerge: options.relaxed ? checksAtMerge(input, latest, Result.getOrThrow(contexts)) : [],
        })
    )
  );
};

const attributedList = (
  label: string,
  entries: ReadonlyArray<MergeGateTolerance | MergeGateCheckAtMerge>
): O.Option<string> =>
  A.isReadonlyArrayNonEmpty(entries)
    ? O.some(
        `${label}: ${A.join(
          A.map(entries, (entry) => `${entry.check} [${entry.attribution}]`),
          "; "
        )}`
      )
    : O.none();

// The non-empty "reds at merge" and "pending at merge" lists, in that order.
const atMergeLists = (atMerge: ReadonlyArray<MergeGateCheckAtMerge>): ReadonlyArray<string> =>
  A.getSomes([
    attributedList(
      "reds at merge",
      A.filter(atMerge, (entry) => entry.state === "red")
    ),
    attributedList(
      "pending at merge",
      A.filter(atMerge, (entry) => entry.state === "pending")
    ),
  ]);

const suffixed = (lists: ReadonlyArray<string>): string =>
  A.join(
    A.map(lists, (list) => ` ${list}`),
    ""
  );

const renderMerge = (decision: MergeGateMerge): string => {
  const met = `at ${Str.slice(0, 10)(decision.headSha)} (window ${decision.windowAgeSeconds}s)`;
  return decision.relaxed
    ? `#${decision.prNumber} GATE-MET (S11) ${met}${suffixed(atMergeLists(decision.atMerge))}`
    : `#${decision.prNumber} GATE-MET ${met}${suffixed(A.getSomes([attributedList("tolerated", decision.tolerated)]))}`;
};

/**
 * Render a decision as the one line the hand-off log keeps.
 *
 * **Details**
 *
 * A relaxed (S11) merge renders as `GATE-MET (S11)` followed by the checks
 * that were red, then those still pending, each with its attribution.
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
 * @category formatting
 * @since 0.0.0
 */
export const renderMergeGateDecision = (decision: MergeGateDecision): string =>
  decision._tag === "hold"
    ? `#${decision.prNumber} HOLD ${decision.reason}: ${decision.detail}`
    : renderMerge(decision);

const GhCompare = S.Struct({
  merge_base_commit: S.Struct({ sha: S.String }),
  base_commit: S.Struct({ sha: S.String }),
});

const COMPARE_ROUTE = "GET /repos/{owner}/{repo}/compare/{basehead}";

const toMergeGateCheckRun = (run: GithubCheckRunRecord): MergeGateCheckRun =>
  MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: O.getOrNull(run.conclusion) });

const readBaseCommitRuns = (sha: string) =>
  GithubRest.use((rest) => rest.checkRuns(sha)).pipe(
    Effect.mapBoth({
      onFailure: yeetGithubFailure(`gh api base check-runs ${sha10(sha)}`),
      onSuccess: (runs) => MergeGateBaseRuns.make({ sha, checkRuns: A.map(runs, toMergeGateCheckRun) }),
    })
  );

// The inherited-red evidence: one compare of base...head names the merge-base
// commit and the base tip; then every check run on each (one read when they
// are the same commit). Any read failing yields None, which holds an
// unattributed relaxed red (an unknown base is never green) and nothing else.
// The kit's `GitHubCommit.compare` projects the merge-base and base-tip commits
// away, so the compare stays a `GitHubClient` read of this module's schema.
const readMergeBaseRuns = Effect.fnUntraced(function* (
  baseRef: string,
  headSha: string
): Effect.fn.Return<O.Option<MergeGateBaseEvidence>, never, GitHubClient | GithubRest | Repo> {
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  return yield* client
    .requestDecoded(COMPARE_ROUTE, { owner, repo, basehead: `${baseRef}...${headSha}` }, GhCompare)
    .pipe(
      Effect.mapError(yeetGithubFailure("gh api compare base...head")),
      Effect.flatMap((compare) =>
        readBaseCommitRuns(compare.merge_base_commit.sha).pipe(
          Effect.flatMap((mergeBase) =>
            (compare.base_commit.sha === mergeBase.sha
              ? Effect.succeed(mergeBase)
              : readBaseCommitRuns(compare.base_commit.sha)
            ).pipe(Effect.map((baseTip) => MergeGateBaseEvidence.make({ mergeBase, baseTip })))
          )
        )
      ),
      Effect.asSome,
      Effect.orElseSucceed(O.none<MergeGateBaseEvidence>)
    );
});

/**
 * Read everything the gate needs for one pull request, once.
 *
 * **Details**
 *
 * REST for the pull request and check runs (core quota); the review window
 * and the base ruleset through the same readers `yeet monitor` uses; one
 * GraphQL query for the unresolved thread count; REST again for the
 * repository's squash defaults and the PR commits, from which the squash
 * message is predicted and linted. The thread read is the only call allowed to
 * fail softly, and it fails to `None`, which the decision treats as a hold; a
 * commitlint run that cannot happen is an `unavailable` verdict, held the same way.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readMergeGate) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readMergeGate = Effect.fn("Yeet.readMergeGate")(function* (
  context: RepoRunContext,
  prNumber: number
): Effect.fn.Return<
  MergeGateRead,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | YeetGithubServices
> {
  const rest = yield* GithubRest;
  const reviewThreads = yield* ReviewThread;
  const pull = yield* rest.pullRequest(prNumber).pipe(Effect.mapError(yeetGithubFailure(`gh api pulls/${prNumber}`)));
  const checkRuns = yield* rest.checkRuns(pull.headSha).pipe(Effect.mapError(yeetGithubFailure("gh api check-runs")));
  // Every page of threads is read; a read that fails is unknown, never zero.
  const unresolvedThreads = yield* reviewThreads.list(prNumber).pipe(
    Effect.map((read) => O.some(outstanding(read))),
    Effect.orElseSucceed(O.none<number>)
  );
  const body = O.liftPredicate(pull.body, Str.isNonEmpty);
  // The PR's own base decides the required contexts, not the caller's --base.
  const ruleset = yield* readYeetRulesetRequiredContexts(
    RepoRunContext.make({ ...context, base: `origin/${pull.baseRef}` })
  );
  const squashCommitlint = yield* readSquashCommitlint(
    context,
    SquashPullRequestFacts.make({ number: pull.number, title: pull.title, body })
  );
  const baseRuns = yield* readMergeBaseRuns(pull.baseRef, pull.headSha);
  return MergeGateRead.make({
    prNumber: pull.number,
    title: pull.title,
    headSha: pull.headSha,
    draft: pull.draft,
    mergeableState: O.getOrElse(pull.mergeableState, () => "unknown"),
    labels: pull.labels,
    // The body record counts only on the head it was stamped for; a later push falls back to the base evidence.
    attributedChecks: parseYeetInheritedRedsRecord(pull.body).pipe(
      O.filter((record) => Str.startsWith(record.head)(pull.headSha)),
      O.map((record) => record.checks),
      O.getOrElse(() => A.empty<string>())
    ),
    requiredContexts: O.map(ruleset, (rules) => rules.contexts),
    checkRuns: A.map(checkRuns, toMergeGateCheckRun),
    baseRuns,
    window: yield* readYeetReviewWindow({ prNumber: pull.number, headSha: pull.headSha }),
    unresolvedThreads,
    squashCommitlint,
    readAt: yield* DateTime.now,
  });
});

/**
 * Result of the squash merge GitHub reported.
 *
 * **Example** (A confirmed merge)
 *
 * ```ts
 * import { MergeGateMerged } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(MergeGateMerged.make({ prNumber: 7, mergeSha: "feedface", commitTitle: "fix: x (#7)" }).prNumber) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateMerged extends S.Opaque<MergeGateMerged, { readonly brand: unique symbol }>()(
  S.Struct({ prNumber: S.Finite, mergeSha: S.String, commitTitle: S.NonEmptyString }).pipe(
    $I.annoteSchema("MergeGateMerged", { description: "The squash merge GitHub confirmed." })
  )
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
 * **Example** (Build the merge effect)
 *
 * ```ts
 * import { executeMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof executeMergeGate) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const executeMergeGate = Effect.fn("Yeet.executeMergeGate")(function* (
  decision: MergeGateMerge
): Effect.fn.Return<
  MergeGateMerged,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | GithubRest | FileSystem.FileSystem
> {
  yield* enforceReviewerGate(decision.prNumber, decision.headSha).pipe(
    withReviewerOperatorClient(process.cwd()),
    Effect.mapError((error) => YeetCommandError.make({ message: error.message, exitCode: 1 }))
  );
  // No commit message: GitHub writes the body its squash settings prescribe.
  const result = yield* GithubRest.use((rest) =>
    rest.mergePullRequest(decision.prNumber, {
      sha: decision.headSha,
      commitTitle: decision.commitTitle,
      method: "squash",
    })
  ).pipe(Effect.mapError(yeetGithubFailure(`gh api merge #${decision.prNumber}`)));
  if (!result.merged) {
    return yield* YeetCommandError.make({
      message: `GitHub did not merge #${decision.prNumber}: ${Str.isEmpty(result.message) ? "no message" : result.message}`,
      exitCode: 1,
    });
  }
  return MergeGateMerged.make({
    prNumber: decision.prNumber,
    mergeSha: result.sha,
    commitTitle: decision.commitTitle,
  });
});

/**
 * Options for one `yeet merge-gate` run.
 *
 * **Example** (Describe one run)
 *
 * ```ts
 * import { MergeGateRunOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const run = MergeGateRunOptions.make({
 *   prNumber: 7,
 *   wantSha: "abc",
 *   tolerate: [],
 *   forceWindow: false,
 *   relaxed: false,
 *   dryRun: true,
 * })
 * console.log(run.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateRunOptions extends S.Opaque<MergeGateRunOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    prNumber: S.Finite,
    wantSha: S.NonEmptyString,
    tolerate: S.Array(MergeGateTolerance),
    forceWindow: S.Boolean,
    relaxed: S.Boolean,
    dryRun: S.Boolean,
  }).pipe($I.annoteSchema("MergeGateRunOptions", { description: "One merge-gate invocation." }))
) {}

// Best-effort steps after a merge print a warning and never fail the command:
// the merge already happened.
const warnAfterMerge = (what: string) => (error: YeetCommandError) =>
  Console.error(`[yeet] warning: ${what} failed after the merge; continuing: ${error.message}`);

const s11MergeComment = (decision: MergeGateMerge, merged: MergeGateMerged, windowForced: boolean): string =>
  A.join(
    [
      `yeet merge-gate (S11): merged ${Str.slice(0, 10)(decision.headSha)} as ${Str.slice(0, 10)(merged.mergeSha)}.`,
      ...atMergeLists(decision.atMerge),
      `Merged under operator ruling S11 (AGENTS.md "Mergeable"): threads addressed, no conflict, ${
        windowForced ? "review window forced (a fix that unblocks main)" : "review window elapsed"
      }. Owner: \`bun run beep yeet sweep --retire\` from the lane.`,
    ],
    "\n\n"
  );

const postS11MergeComment = Effect.fn("Yeet.postS11MergeComment")(function* (
  decision: MergeGateMerge,
  merged: MergeGateMerged,
  windowForced: boolean
) {
  yield* GithubRest.use((rest) =>
    rest.createIssueComment(decision.prNumber, s11MergeComment(decision, merged, windowForced))
  ).pipe(Effect.mapError(yeetGithubFailure(`gh api comment #${decision.prNumber}`)));
  yield* Console.log(`[yeet] recorded the S11 merge in a comment on #${decision.prNumber}`);
});

// Only non-terminal runs on the merged head are cancelled. Listing and each
// cancellation are independently best effort after the merge.
const cancelMergedHeadRuns = Effect.fn("Yeet.cancelMergedHeadRuns")(function* (headSha: string) {
  const rest = yield* GithubRest;
  const runs = yield* rest.workflowRunsForSha(headSha).pipe(
    Effect.mapError(yeetGithubFailure("gh api merged head runs")),
    Effect.catch((error) =>
      warnAfterMerge("listing the merged head's workflow runs")(error).pipe(
        Effect.as(A.empty<GithubWorkflowRunRecord>())
      )
    )
  );
  const runIds = A.dedupe(
    A.map(
      A.filter(runs, (run) => run.headSha === headSha && run.status !== "completed"),
      (run) => run.id
    )
  );
  const [cancelled, failures] = yield* Effect.partition(runIds, (runId) =>
    rest.cancelWorkflowRun(runId).pipe(Effect.mapError(yeetGithubFailure(`gh api cancel run ${runId}`)))
  );
  yield* Effect.forEach(failures, warnAfterMerge("cancelling a leftover workflow run"), { discard: true });
  yield* Console.log(
    `[yeet] cancelled ${A.length(cancelled)} of ${A.length(runIds)} active workflow run(s) on ${Str.slice(0, 10)(headSha)}`
  );
});

/**
 * Read, decide, print, and merge unless the gate held or `--dry-run` was passed.
 *
 * **Details**
 *
 * The predicted squash message's commitlint verdict is printed first, for
 * every outcome, so the hand-off log shows what GitHub would have written. A
 * hold exits non-zero with the routed reason so a background waiter can
 * loop on it; a merge prints the merge sha and any tolerated attribution (a
 * relaxed merge prints its at-merge lists instead). The
 * window override is printed whenever it was used. After a relaxed (S11)
 * merge it posts one PR comment recording the checks that were not green and
 * cancels the merged head's active workflow runs across all pages. After any
 * merge of a PR that touched `goals/<slug>/**` it comments on every other open
 * PR on that packet with the merged sibling and its predicted conflicting
 * files (B2, 2026-11-05). All three are best effort, so a failure prints a
 * warning and the command still succeeds. A dry run does none of them.
 *
 * **Example** (Build the gate effect)
 *
 * ```ts
 * import { runMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runMergeGate) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const runMergeGate = Effect.fn("Yeet.runMergeGate")(function* (
  context: RepoRunContext,
  options: MergeGateRunOptions
): Effect.fn.Return<
  MergeGateDecision,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | FileSystem.FileSystem
> {
  return yield* runMergeGateAsGhLogin(context, options).pipe(provideYeetGhLogin(context.repoRoot));
});

const runMergeGateAsGhLogin = Effect.fnUntraced(function* (context: RepoRunContext, options: MergeGateRunOptions) {
  const read = yield* readMergeGate(context, options.prNumber);
  yield* Console.log(
    `[yeet] squash-commitlint #${read.prNumber}: ${renderSquashCommitlintVerdict(read.squashCommitlint.verdict)} (header "${read.squashCommitlint.message.header}")`
  );
  const decision = decideMergeGate(
    MergeGateInput.make({
      read,
      options: MergeGateOptions.make({
        wantSha: options.wantSha,
        now: read.readAt,
        tolerate: options.tolerate,
        forceWindow: options.forceWindow,
        relaxed: options.relaxed,
      }),
    })
  );
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
  const merged = yield* executeMergeGate(decision);
  yield* Console.log(
    `[yeet] MERGED #${merged.prNumber} -> ${Str.slice(0, 10)(merged.mergeSha)} "${merged.commitTitle}"`
  );
  if (decision.relaxed) {
    yield* postS11MergeComment(decision, merged, options.forceWindow).pipe(
      Effect.catch(warnAfterMerge("the S11 merge comment"))
    );
    yield* cancelMergedHeadRuns(decision.headSha);
  }
  // B2 (2026-11-05): every open PR on a goal packet this merge touched is told to merge main now.
  yield* broadcastPacketSiblings(context, merged.prNumber, merged.mergeSha).pipe(
    Effect.catch(warnAfterMerge("the packet sibling broadcast"))
  );
  return decision;
});

/**
 * The `yeet merge-gate` flags as the CLI parses them, before `--tolerate` is decoded.
 *
 * **Example** (Describe an invocation)
 *
 * ```ts
 * import { MergeGateCommandOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const options = MergeGateCommandOptions.make({
 *   base: "origin/main",
 *   head: "HEAD",
 *   packetDir: ".beep/yeet",
 *   pr: 1459,
 *   sha: "212fe39b4f",
 *   tolerate: [],
 *   forceWindow: false,
 *   relaxed: false,
 *   dryRun: true,
 * })
 * console.log(options.pr) // 1459
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateCommandOptions extends S.Opaque<MergeGateCommandOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.String,
    head: S.String,
    packetDir: S.String,
    pr: S.Finite,
    sha: S.String,
    tolerate: S.Array(S.String),
    forceWindow: S.Boolean,
    relaxed: S.Boolean,
    dryRun: S.Boolean,
  }).pipe(
    $I.annoteSchema("MergeGateCommandOptions", {
      description: "Parsed yeet merge-gate flags before tolerances are decoded.",
    })
  )
) {}

/**
 * Run `yeet merge-gate`: decode the tolerances, resolve the repo root, gate, and merge.
 *
 * **Details**
 *
 * Unlike `yeet merge`, which merges the current branch's pull request and
 * sweeps the clone, this takes any pull request number and never sweeps: the
 * owning session retires its own lane after the orchestrator reports the
 * merge. A malformed `--tolerate` is refused before anything is read.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runYeetMergeGate) // "function"
 * ```
 *
 * @param options - The parsed command flags.
 * @returns Nothing; a hold fails with the routed reason.
 * @category workflows
 * @since 0.0.0
 */
export const runYeetMergeGate = Effect.fn("Yeet.runMergeGateCommand")(function* (options: MergeGateCommandOptions) {
  const tolerate = yield* decodeAttributedCheckFlags("tolerate", options.tolerate, parseMergeGateTolerance);
  const context = yield* hydrateYeetReadOnlyContext(options);
  yield* runMergeGate(
    context,
    MergeGateRunOptions.make({
      prNumber: options.pr,
      wantSha: options.sha,
      tolerate,
      forceWindow: options.forceWindow,
      relaxed: options.relaxed,
      dryRun: options.dryRun,
    })
  );
});
