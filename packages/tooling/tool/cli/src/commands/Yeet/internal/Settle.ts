/**
 * The settle rule behind `yeet monitor --until-ready` (ttc B7).
 *
 * **Details**
 *
 * A pushed head "settles" when every required context the base branch's
 * ruleset expects has reported a terminal outcome and nothing required is still
 * pending. The expected set is read once per head from
 * `gh api repos/{owner}/{repo}/rules/branches/<base>`; `gh pr checks` alone
 * cannot express it, because `--required` only lists contexts that have already
 * registered (cli/cli #8855) and errors outright during the registration window
 * (cli/cli #7401). Matrix parents such as `Test Unit` never report under their
 * own name — their children register as `Test Unit (unit-a)` — so an expected
 * context with no exact match but at least one such child is tolerated by name
 * and its children are waited for instead. A context with neither an exact
 * match nor a child is missing, and missing holds the wait until the settle
 * timeout expires.
 *
 * One exception (ttc B8): contexts of a gated family — today `Heavy / *`,
 * admitted by the `ready-for-heavy` label — are absent by design while the
 * head's admission verdict is `hold`. Under `hold` they leave `missing` and
 * `pending` for the `gated` bucket, the wait reason becomes
 * `heavy-not-admitted` once nothing else is open, and the settle timeout is
 * not compared. `run` restores the B7 rule exactly; `skip-satisfied` settles
 * once every lane reports a terminal outcome: `pass` for a lane that passed
 * without work on a hosted runner, or `skip` where a lane is still skipped.
 *
 * **Gotchas**
 *
 * The verdict is pure: the loop owns the clock, the ruleset read, and the
 * closeout artifact, and hands their observations in through
 * {@link YeetSettleInput}. When the ruleset read failed the census falls back
 * to the `--required` rows alone, which reproduces the pre-B7 registration
 * patience rather than pretending to know the expected set.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Console, DateTime, Duration, Effect, HashSet, Match, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import {
  HEAVY_ADMISSION_LABEL,
  HEAVY_CONTEXT_PREFIX,
  HeavyAdmission,
  HeavyAdmissionVerdict,
} from "../../Ci/HeavyAdmission.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { YeetCheckOutcome, YeetSettleReason } from "./CheckOutcome.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Settle");

/**
 * One `required_status_checks` entry as `gh api .../rules/branches/<base>`
 * reports it.
 *
 * @category models
 * @since 0.0.0
 */
export class GhRulesetRequiredStatusCheck extends S.Class<GhRulesetRequiredStatusCheck>(
  $I`GhRulesetRequiredStatusCheck`
)(
  {
    context: S.String,
  },
  $I.annote("GhRulesetRequiredStatusCheck", {
    description: "One required status-check context named by a branch ruleset.",
  })
) {}

/**
 * One rule of the branch-rules payload. Only the `required_status_checks`
 * rule type carries contexts; every other type decodes with empty parameters,
 * and unknown keys are stripped at the boundary.
 *
 * **Example** (Decode a required-status-checks rule)
 *
 * ```ts
 * import { GhBranchRule } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const rule = S.decodeUnknownSync(GhBranchRule)({
 *   type: "required_status_checks",
 *   ruleset_id: 10240248,
 *   parameters: { required_status_checks: [{ context: "Lint" }], strict_required_status_checks_policy: false }
 * })
 * console.log(rule.parameters?.required_status_checks?.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhBranchRule extends S.Class<GhBranchRule>($I`GhBranchRule`)(
  {
    type: S.String,
    ruleset_id: S.optionalKey(S.Finite),
    parameters: S.Struct({
      required_status_checks: GhRulesetRequiredStatusCheck.pipe(S.Array, S.optionalKey),
    }).pipe(S.optionalKey),
  },
  $I.annote("GhBranchRule", {
    description: "One branch rule from the GitHub rules API, narrowed to the required-status-check contexts.",
  })
) {}

/**
 * The required contexts the base branch's rulesets expect, read once per head.
 *
 * **Details**
 *
 * `contexts` is deduplicated and sorted so two reads of the same ruleset are
 * equal by value; `rulesetIds` records which rulesets contributed so a gate
 * line can cite its source; `readAt` is the ISO instant of the read.
 *
 * **Example** (Construct an expected set)
 *
 * ```ts
 * import { YeetRulesetRequiredContexts } from "@beep/repo-cli/test/Yeet"
 *
 * const expected = YeetRulesetRequiredContexts.make({
 *   base: "main",
 *   contexts: ["Lint", "Test Unit"],
 *   rulesetIds: [10240248],
 *   readAt: "2026-09-16T00:00:00.000Z"
 * })
 * console.log(expected.contexts.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRulesetRequiredContexts extends S.Class<YeetRulesetRequiredContexts>($I`YeetRulesetRequiredContexts`)(
  {
    base: S.NonEmptyString,
    contexts: S.Array(S.NonEmptyString),
    rulesetIds: S.Array(S.Finite),
    readAt: S.String,
  },
  $I.annote("YeetRulesetRequiredContexts", {
    description: "Required status-check contexts the base branch ruleset expects for a pull request head.",
  })
) {}

/**
 * A family of expected contexts one label admits: every expected context
 * sharing `prefix`, held back from the census while admission is `hold`.
 *
 * **Example** (The heavy family)
 *
 * ```ts
 * import { YeetGatedContextFamily } from "@beep/repo-cli/test/Yeet"
 *
 * const family = YeetGatedContextFamily.make({
 *   prefix: "Heavy / ",
 *   admittedBy: "ready-for-heavy",
 *   members: ["Heavy / Check", "Heavy / Lint Policy"]
 * })
 * console.log(family.members.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGatedContextFamily extends S.Class<YeetGatedContextFamily>($I`YeetGatedContextFamily`)(
  {
    prefix: S.NonEmptyString,
    admittedBy: S.NonEmptyString,
    members: S.Array(S.NonEmptyString),
  },
  $I.annote("YeetGatedContextFamily", {
    description: "Expected contexts sharing a prefix that a single label admits, with the admitting label.",
  })
) {}

/**
 * Fold the expected set into its gated families: one family per distinct
 * gated prefix found among the contexts — today exactly `Heavy / `, admitted
 * by {@link HEAVY_ADMISSION_LABEL}. An expected set with no such context
 * yields no family.
 *
 * **Example** (Fold the heavy family out of a ruleset)
 *
 * ```ts
 * import { YeetRulesetRequiredContexts, yeetGatedFamiliesFor } from "@beep/repo-cli/test/Yeet"
 *
 * const families = yeetGatedFamiliesFor(YeetRulesetRequiredContexts.make({
 *   base: "main",
 *   contexts: ["Heavy / Check", "Heavy / Docgen", "Lint"],
 *   rulesetIds: [1],
 *   readAt: "2026-09-16T00:00:00.000Z"
 * }))
 * console.log(families.length, families[0]?.members) // 1 [ "Heavy / Check", "Heavy / Docgen" ]
 * ```
 *
 * @param expected - The folded expected set.
 * @returns The gated families among the expected contexts, possibly empty.
 * @category utilities
 * @since 0.0.0
 */
export const yeetGatedFamiliesFor = (expected: YeetRulesetRequiredContexts): ReadonlyArray<YeetGatedContextFamily> => {
  const members = A.filter(expected.contexts, Str.startsWith(HEAVY_CONTEXT_PREFIX));
  return A.isReadonlyArrayEmpty(members)
    ? A.empty<YeetGatedContextFamily>()
    : [YeetGatedContextFamily.make({ prefix: HEAVY_CONTEXT_PREFIX, admittedBy: HEAVY_ADMISSION_LABEL, members })];
};

const isRequiredStatusChecksRule = (rule: GhBranchRule): boolean => rule.type === "required_status_checks";

/**
 * The decoded branch-rules payload with the coordinates of its read.
 *
 * **Example** (Construct a payload)
 *
 * ```ts
 * import { GhBranchRule, YeetRulesetRulesPayload } from "@beep/repo-cli/test/Yeet"
 *
 * const payload = YeetRulesetRulesPayload.make({
 *   base: "main",
 *   readAt: "2026-09-16T00:00:00.000Z",
 *   rules: [GhBranchRule.make({ type: "pull_request", ruleset_id: 1 })]
 * })
 * console.log(payload.rules.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRulesetRulesPayload extends S.Class<YeetRulesetRulesPayload>($I`YeetRulesetRulesPayload`)(
  {
    base: S.NonEmptyString,
    readAt: S.String,
    rules: S.Array(GhBranchRule),
  },
  $I.annote("YeetRulesetRulesPayload", {
    description: "Decoded branch rules for one base branch, stamped with the read instant.",
  })
) {}

/**
 * Fold the branch-rules payload into the expected required-context set.
 *
 * **Example** (Fold two rules into one expected set)
 *
 * ```ts
 * import { GhBranchRule, rulesetRequiredContextsFromRules, YeetRulesetRulesPayload } from "@beep/repo-cli/test/Yeet"
 *
 * const expected = rulesetRequiredContextsFromRules(YeetRulesetRulesPayload.make({
 *   base: "main",
 *   readAt: "2026-09-16T00:00:00.000Z",
 *   rules: [
 *     GhBranchRule.make({ type: "pull_request", ruleset_id: 1 }),
 *     GhBranchRule.make({
 *       type: "required_status_checks",
 *       ruleset_id: 1,
 *       parameters: { required_status_checks: [{ context: "Test Unit" }, { context: "Lint" }] }
 *     })
 *   ]
 * }))
 * console.log(expected.contexts) // [ "Lint", "Test Unit" ]
 * ```
 *
 * @param input - Base branch name, read instant, and the decoded rules.
 * @returns The sorted, deduplicated expected set with its source ruleset ids.
 * @category utilities
 * @since 0.0.0
 */
export const rulesetRequiredContextsFromRules = (input: YeetRulesetRulesPayload): YeetRulesetRequiredContexts => {
  const statusRules = A.filter(input.rules, isRequiredStatusChecksRule);
  const contexts = pipe(
    statusRules,
    A.flatMap((rule) => rule.parameters?.required_status_checks ?? A.empty<GhRulesetRequiredStatusCheck>()),
    A.map((check) => check.context),
    A.filter(Str.isNonEmpty),
    A.dedupe,
    A.sort(Order.String)
  );
  const rulesetIds = pipe(
    statusRules,
    A.flatMap((rule) => O.toArray(O.fromUndefinedOr(rule.ruleset_id))),
    A.dedupe,
    A.sort(Order.Number)
  );
  return YeetRulesetRequiredContexts.make({ base: input.base, contexts, rulesetIds, readAt: input.readAt });
};

const decodeGhBranchRules = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhBranchRule)));

// `origin/main` → `main`: the rules API is keyed by branch name, not by ref.
const baseBranchName = (base: string): string => Str.replace(/^[^/]+\//u, "")(base);

/**
 * Read the base branch's required contexts from the GitHub rules API.
 *
 * **Details**
 *
 * `gh api repos/{owner}/{repo}/rules/branches/<base>` (gh expands the owner and
 * repo placeholders from the checkout's origin). Any failure — a non-zero exit,
 * a truncated capture, an undecodable payload — degrades to `None` after one
 * stderr line, so the settle rule falls back to registration patience instead
 * of failing the monitor: the ruleset is an accelerator for certainty, not a
 * precondition for it.
 *
 * **Example** (Build the reader effect)
 *
 * ```ts
 * import { readYeetRulesetRequiredContexts, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/settle",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * console.log(Effect.isEffect(readYeetRulesetRequiredContexts(context))) // true
 * ```
 *
 * @param context - Repo context naming the checkout and its base ref.
 * @returns The expected set, or `None` when the ruleset could not be read.
 * @category services
 * @since 0.0.0
 */
export const readYeetRulesetRequiredContexts = Effect.fn("Yeet.readYeetRulesetRequiredContexts")(function* (
  context: RepoRunContext
): Effect.fn.Return<O.Option<YeetRulesetRequiredContexts>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const base = baseBranchName(context.base);
  const readAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const read = runRepoCommandCapture(
    "gh",
    ["api", `repos/{owner}/{repo}/rules/branches/${base}`],
    context.repoRoot
  ).pipe(
    Effect.mapError(YeetCommandError.new("Failed to read the base branch ruleset.")),
    Effect.flatMap((result) =>
      result.exitCode === 0 && !result.truncated
        ? decodeGhBranchRules(result.output).pipe(
            Effect.mapError(YeetCommandError.new("Failed to decode the base branch ruleset."))
          )
        : Effect.fail(
            YeetCommandError.make({
              message: `gh api rules exited ${result.exitCode}${result.truncated ? " (truncated)" : ""}`,
              exitCode: 1,
            })
          )
    ),
    Effect.map((rules) => rulesetRequiredContextsFromRules(YeetRulesetRulesPayload.make({ base, readAt, rules })))
  );
  return yield* read.pipe(
    Effect.asSome,
    Effect.catch((error) =>
      Console.error(
        `[yeet] could not read the ${base} ruleset (${error.message}); settling on registration patience alone.`
      ).pipe(Effect.as(O.none<YeetRulesetRequiredContexts>()))
    )
  );
});

/**
 * Read the head's merge-base diff against the base ref, once per head, for the
 * heavy admission decision.
 *
 * **Details**
 *
 * `git diff --name-only <base>...HEAD` on the local remote-tracking ref is a
 * merge-base diff, so a stale ref still yields the head's own changes and no
 * fetch is needed. A failed or truncated read yields no paths, which can never
 * classify the head docs-only: the failure direction is `hold`, never a silent
 * `skip-satisfied`.
 *
 * **Example** (Build the reader effect)
 *
 * ```ts
 * import { readYeetChangedPaths, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/settle",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * console.log(Effect.isEffect(readYeetChangedPaths(context))) // true
 * ```
 *
 * @param context - Repo context naming the checkout and its base ref.
 * @param capture - The command capture to run `git` through; the repo capture by default.
 * @returns The changed paths, trimmed and non-empty; empty when the diff could not be read.
 * @category services
 * @since 0.0.0
 */
export const readYeetChangedPaths = Effect.fn("Yeet.readYeetChangedPaths")(function* (
  context: RepoRunContext,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture
): Effect.fn.Return<ReadonlyArray<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* capture("git", ["diff", "--name-only", `${context.base}...HEAD`], context.repoRoot).pipe(
    Effect.map((result) =>
      result.exitCode === 0 && !result.truncated
        ? pipe(Str.split(result.output, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty))
        : A.empty<string>()
    ),
    Effect.orElseSucceed(A.empty<string>)
  );
});

/**
 * One reported check as the settle rule sees it: name, classified outcome, and
 * whether `gh pr checks --required` listed it.
 *
 * **Example** (A pending required check)
 *
 * ```ts
 * import { YeetSettleCheck } from "@beep/repo-cli/test/Yeet"
 *
 * const check = YeetSettleCheck.make({ name: "Heavy / Check", outcome: "pending", required: true })
 * console.log(check.required) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetSettleCheck extends S.Class<YeetSettleCheck>($I`YeetSettleCheck`)(
  {
    name: S.NonEmptyString,
    outcome: YeetCheckOutcome,
    required: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
  },
  $I.annote("YeetSettleCheck", {
    description: "One reported PR check with its classified outcome and GitHub required flag.",
  })
) {}

/**
 * Whether the pull request view says the head no longer merges into its base.
 *
 * **Details**
 *
 * GitHub reports `mergeable: CONFLICTING` and `mergeStateStatus: DIRTY` for a
 * head whose base moved under it; either alone is taken as the conflict, since
 * the two fields lag each other by a poll. The comparison is case-insensitive
 * and an absent field never counts.
 *
 * **Example** (A dirty head)
 *
 * ```ts
 * import { yeetBaseConflictFor } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(yeetBaseConflictFor(O.some("MERGEABLE"), O.some("DIRTY"))) // true
 * console.log(yeetBaseConflictFor(O.none(), O.some("CLEAN"))) // false
 * ```
 *
 * @param mergeable - The view's `mergeable` field, when reported.
 * @param mergeStateStatus - The view's `mergeStateStatus` field, when reported.
 * @returns Whether the base conflict explains an empty check rollup.
 * @category predicates
 * @since 0.0.0
 */
export const yeetBaseConflictFor: {
  (mergeStateStatus: O.Option<string>): (mergeable: O.Option<string>) => boolean;
  (mergeable: O.Option<string>, mergeStateStatus: O.Option<string>): boolean;
} = dual(
  2,
  (mergeable: O.Option<string>, mergeStateStatus: O.Option<string>): boolean =>
    O.exists(mergeable, (value) => Str.toUpperCase(value) === "CONFLICTING") ||
    O.exists(mergeStateStatus, (value) => Str.toUpperCase(value) === "DIRTY")
);

/**
 * What {@link rememberRegistered} hands back: the head's registration memory
 * after this poll, the poll's checks with one synthetic pending row per
 * remembered name the poll did not report, and those recalled names.
 *
 * **Example** (Construct a recall)
 *
 * ```ts
 * import { YeetRegistrationRecall } from "@beep/repo-cli/test/Yeet"
 * import { HashSet } from "effect"
 *
 * const recall = YeetRegistrationRecall.make({ registered: HashSet.make("Lint"), checks: [], recalled: [] })
 * console.log(HashSet.size(recall.registered)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRegistrationRecall extends S.Class<YeetRegistrationRecall>($I`YeetRegistrationRecall`)(
  {
    registered: S.HashSet(S.String),
    checks: S.Array(YeetSettleCheck),
    recalled: S.Array(S.String),
  },
  $I.annote("YeetRegistrationRecall", {
    description:
      "Registration memory for one head plus the poll's checks with remembered-but-absent names kept pending.",
  })
) {}

/**
 * Remember which contexts have registered for a head, and keep a remembered
 * context that a later poll omits as `pending` rather than `missing`.
 *
 * **Details**
 *
 * GitHub can empty or truncate a rollup between polls (a base conflict, a
 * transient API gap) without any check having been withdrawn; a context that
 * once reported is therefore still queued or running, not unregistered, and
 * must not spend the registration budget. The synthetic rows are `pending`
 * and not `--required`, so under the ruleset census a remembered expected
 * context holds the settle by name while a remembered optional check does
 * not; the fallback census (no ruleset) ignores them.
 *
 * **Example** (A registered context goes absent)
 *
 * ```ts
 * import { rememberRegistered, YeetSettleCheck } from "@beep/repo-cli/test/Yeet"
 * import { HashSet } from "effect"
 *
 * const first = rememberRegistered(HashSet.empty(), [YeetSettleCheck.make({ name: "Lint", outcome: "pending" })])
 * const second = rememberRegistered(first.registered, [])
 * console.log(second.recalled) // [ "Lint" ]
 * console.log(second.checks[0]?.outcome) // "pending"
 * ```
 *
 * @param previous - The names observed registered on earlier polls of this head.
 * @param checks - This poll's reported checks.
 * @returns The grown memory, the checks with recalled names kept pending, and the recalled names.
 * @category utilities
 * @since 0.0.0
 */
export const rememberRegistered: {
  (checks: ReadonlyArray<YeetSettleCheck>): (previous: HashSet.HashSet<string>) => YeetRegistrationRecall;
  (previous: HashSet.HashSet<string>, checks: ReadonlyArray<YeetSettleCheck>): YeetRegistrationRecall;
} = dual(2, (previous: HashSet.HashSet<string>, checks: ReadonlyArray<YeetSettleCheck>): YeetRegistrationRecall => {
  const reported = HashSet.fromIterable(A.map(checks, (check) => check.name));
  const recalled = pipe(
    A.fromIterable(previous),
    A.filter((name) => !HashSet.has(reported, name)),
    A.sort(Order.String)
  );
  return YeetRegistrationRecall.make({
    registered: HashSet.union(previous, reported),
    checks: [
      ...checks,
      ...A.map(recalled, (name) => YeetSettleCheck.make({ name, outcome: "pending", required: false })),
    ],
    recalled,
  });
});

/**
 * Input to {@link matchExpectedContexts}: the expected contexts and the
 * reported checks of one poll.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetExpectedContextInput extends S.Class<YeetExpectedContextInput>($I`YeetExpectedContextInput`)(
  {
    expected: S.Array(S.NonEmptyString),
    checks: S.Array(YeetSettleCheck),
  },
  $I.annote("YeetExpectedContextInput", {
    description: "Expected required contexts paired with the checks one poll reported.",
  })
) {}

/**
 * How the expected contexts line up against the reported checks.
 *
 * **Details**
 *
 * - `matched`: expected contexts that a reported check names exactly.
 * - `unmatched`: expected contexts with no exact match but at least one matrix
 *   child (`<context> (<variant>)`) reported — tolerated by name, children
 *   waited for.
 * - `missing`: expected contexts with neither an exact match nor a child.
 * - `pending`: reported checks still pending that hold the settle: matched
 *   contexts, matrix children of unmatched contexts, and every `--required` row.
 * - `gated`: expected contexts of a gated family moved out of `missing` and
 *   `pending` while the head's admission verdict is `hold` (ttc B8); empty
 *   otherwise.
 *
 * Every list is sorted so equal censuses render identically.
 *
 * **Example** (Construct a census)
 *
 * ```ts
 * import { YeetExpectedContextCensus } from "@beep/repo-cli/test/Yeet"
 *
 * const census = YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: ["Test Unit"], pending: [], missing: [] })
 * console.log(census.unmatched) // [ "Test Unit" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetExpectedContextCensus extends S.Class<YeetExpectedContextCensus>($I`YeetExpectedContextCensus`)(
  {
    matched: S.Array(S.String),
    unmatched: S.Array(S.String),
    pending: S.Array(S.String),
    missing: S.Array(S.String),
    gated: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
  },
  $I.annote("YeetExpectedContextCensus", {
    description:
      "Expected contexts partitioned into matched, tolerated-unmatched, and missing, plus the pending checks that hold the settle.",
  })
) {}

const matrixChildPrefix = (context: string): string => `${context} (`;

const isMatrixChildOf = (context: string, name: string): boolean => Str.startsWith(matrixChildPrefix(context))(name);

/**
 * Line the expected required contexts up against one poll's reported checks.
 *
 * **Example** (A matrix parent is tolerated, a late context is missing)
 *
 * ```ts
 * import { matchExpectedContexts, YeetExpectedContextInput, YeetSettleCheck } from "@beep/repo-cli/test/Yeet"
 *
 * const census = matchExpectedContexts(YeetExpectedContextInput.make({
 *   expected: ["Lint", "Test Unit", "Heavy / Check"],
 *   checks: [
 *     YeetSettleCheck.make({ name: "Lint", outcome: "pass", required: true }),
 *     YeetSettleCheck.make({ name: "Test Unit (unit-a)", outcome: "pending", required: false }),
 *     YeetSettleCheck.make({ name: "Vercel", outcome: "fail", required: false })
 *   ]
 * }))
 * console.log(census.matched) // [ "Lint" ]
 * console.log(census.unmatched) // [ "Test Unit" ]
 * console.log(census.pending) // [ "Test Unit (unit-a)" ]
 * console.log(census.missing) // [ "Heavy / Check" ]
 * ```
 *
 * @param input - Expected contexts and reported checks.
 * @returns The sorted census.
 * @category utilities
 * @since 0.0.0
 */
export const matchExpectedContexts = (input: YeetExpectedContextInput): YeetExpectedContextCensus => {
  const reportedNames = HashSet.fromIterable(A.map(input.checks, (check) => check.name));
  const hasExactName = (context: string): boolean => HashSet.has(reportedNames, context);
  const hasMatrixChild = (context: string): boolean =>
    A.some(input.checks, (check) => isMatrixChildOf(context, check.name));
  const expected = pipe(input.expected, A.dedupe, A.sort(Order.String));
  const matched = A.filter(expected, hasExactName);
  const unmatched = A.filter(expected, (context) => !hasExactName(context) && hasMatrixChild(context));
  const missing = A.filter(expected, (context) => !hasExactName(context) && !hasMatrixChild(context));
  const matchedNames = HashSet.fromIterable(matched);
  const holdsSettle = (check: YeetSettleCheck): boolean =>
    check.required ||
    HashSet.has(matchedNames, check.name) ||
    A.some(unmatched, (context) => isMatrixChildOf(context, check.name));
  const pending = pipe(
    input.checks,
    A.filter((check) => YeetCheckOutcome.is.pending(check.outcome) && holdsSettle(check)),
    A.map((check) => check.name),
    A.dedupe,
    A.sort(Order.String)
  );
  return YeetExpectedContextCensus.make({ matched, unmatched, pending, missing });
};

// Without a ruleset the only required evidence is the `--required` rows
// themselves: pending ones hold the settle, and "no required row at all" is
// indistinguishable from the registration window.
const fallbackCensus = (checks: ReadonlyArray<YeetSettleCheck>): YeetExpectedContextCensus => {
  const required = A.filter(checks, (check) => check.required);
  const names = (values: ReadonlyArray<YeetSettleCheck>) =>
    pipe(
      values,
      A.map((check) => check.name),
      A.dedupe,
      A.sort(Order.String)
    );
  return YeetExpectedContextCensus.make({
    matched: names(required),
    unmatched: [],
    pending: names(A.filter(required, (check) => YeetCheckOutcome.is.pending(check.outcome))),
    missing: [],
  });
};

/**
 * Everything one poll hands the settle rule.
 *
 * **Details**
 *
 * `expected` is `None` when the ruleset read failed (fallback census).
 * `closeoutBound` is the `closeout-run` criterion: a closeout artifact bound to
 * this head exists. `waitedMs` counts from the first poll that observed this
 * head (or from the last admission flip); `timeoutMs` is the
 * `--settle-timeout` budget. `families` are the gated families folded from
 * the expected set and `admission` the head's heavy admission verdict; `None`
 * (the default) is the B7 rule with no gating. `baseConflict` says the pull
 * request no longer merges into its base (see {@link yeetBaseConflictFor}),
 * the state in which GitHub empties the check rollup.
 *
 * **Example** (Construct an input)
 *
 * ```ts
 * import { YeetSettleInput } from "@beep/repo-cli/test/Yeet"
 *
 * const input = YeetSettleInput.make({ checks: [], closeoutBound: false, waitedMs: 0, timeoutMs: 1_800_000 })
 * console.log(input.expected._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetSettleInput extends S.Class<YeetSettleInput>($I`YeetSettleInput`)(
  {
    expected: YeetRulesetRequiredContexts.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    checks: S.Array(YeetSettleCheck),
    closeoutBound: S.Boolean,
    waitedMs: S.Finite,
    timeoutMs: S.Finite,
    families: S.Array(YeetGatedContextFamily).pipe(SchemaUtils.withKeyDefaults(A.empty<YeetGatedContextFamily>())),
    admission: HeavyAdmission.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    baseConflict: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("YeetSettleInput", {
    description:
      "Expected contexts, reported checks, closeout binding, elapsed wait, gated families, heavy admission, and base-conflict state for one settle evaluation.",
  })
) {}

/**
 * The settle rule's answer for one poll.
 *
 * **Details**
 *
 * `settled` says the required census is complete for this head. `reason` is
 * the wait reason the gate line names: `registration`, `required-pending` or
 * `heavy-not-admitted` while unsettled, `settle-timeout` when the budget
 * expired unsettled (never while held, see {@link yeetSettleVerdictIsHeld}),
 * `closeout-pending` when settled but no closeout artifact binds the head, and
 * `None` when settled with the closeout bound — the state in which merge
 * readiness is evaluated.
 *
 * **Example** (A settled head awaiting closeout)
 *
 * ```ts
 * import { YeetExpectedContextCensus, YeetSettleVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetSettleVerdict.make({
 *   settled: true,
 *   reason: O.some("closeout-pending"),
 *   census: YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: [], pending: [], missing: [] }),
 *   waitedMs: 90_000,
 *   timeoutMs: 1_800_000
 * })
 * console.log(verdict.settled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetSettleVerdict extends S.Class<YeetSettleVerdict>($I`YeetSettleVerdict`)(
  {
    settled: S.Boolean,
    reason: YeetSettleReason.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    census: YeetExpectedContextCensus,
    waitedMs: S.Finite,
    timeoutMs: S.Finite,
    budgetApplies: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(true)),
      S.withConstructorDefault(Effect.succeed(true))
    ),
    admission: HeavyAdmission.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetSettleVerdict", {
    description:
      "Whether the required census settled, the wait reason the gate line names, the census behind it, whether the registration budget still applies, and the heavy admission it was judged under.",
  })
) {}

const censusFor = (input: YeetSettleInput): YeetExpectedContextCensus =>
  O.match(input.expected, {
    onNone: () => fallbackCensus(input.checks),
    onSome: (expected) =>
      matchExpectedContexts(YeetExpectedContextInput.make({ expected: expected.contexts, checks: input.checks })),
  });

// Zero reported checks is the registration window; with a fallback census,
// zero `--required` rows is the same window seen through cli/cli #8855.
const inRegistrationWindow = (input: YeetSettleInput, census: YeetExpectedContextCensus): boolean =>
  A.isReadonlyArrayEmpty(input.checks) || (O.isNone(input.expected) && A.isReadonlyArrayEmpty(census.matched));

// Under `hold`, every family member leaves `missing`, and every pending check
// that is a member or a member's matrix child leaves `pending`; the member
// names land in `gated`. Everything else in the census is untouched.
const gateCensus = (
  census: YeetExpectedContextCensus,
  families: ReadonlyArray<YeetGatedContextFamily>
): YeetExpectedContextCensus => {
  const members = A.flatMap(families, (family) => family.members);
  const memberNames = HashSet.fromIterable(members);
  const memberFor = (name: string): O.Option<string> =>
    HashSet.has(memberNames, name) ? O.some(name) : A.findFirst(members, (member) => isMatrixChildOf(member, name));
  const gated = pipe(
    [
      ...A.filter(census.missing, (context) => HashSet.has(memberNames, context)),
      ...A.flatMap(census.pending, (name) => O.toArray(memberFor(name))),
    ],
    A.dedupe,
    A.sort(Order.String)
  );
  return YeetExpectedContextCensus.make({
    matched: census.matched,
    unmatched: census.unmatched,
    pending: A.filter(census.pending, (name) => O.isNone(memberFor(name))),
    missing: A.filter(census.missing, (context) => !HashSet.has(memberNames, context)),
    gated,
  });
};

const admissionIsHold = (admission: O.Option<HeavyAdmission>): boolean =>
  O.exists(admission, (value) => HeavyAdmissionVerdict.is.hold(value.verdict));

// A head is held only when the gated contexts are the ONLY open work and the
// registration window is over: with nothing registered, a held head and a
// broken CI that never registers look the same, and with a non-gated context
// still missing or pending the B7 rule must keep judging that context (its
// registration budget, or GitHub's own execution bound). Held is therefore
// exactly the state whose reason is `heavy-not-admitted`.
const heldOutsideRegistration = (
  admission: O.Option<HeavyAdmission>,
  census: YeetExpectedContextCensus,
  registering: boolean
): boolean =>
  !registering &&
  admissionIsHold(admission) &&
  A.isReadonlyArrayNonEmpty(census.gated) &&
  A.isReadonlyArrayEmpty(census.missing) &&
  A.isReadonlyArrayEmpty(census.pending);

// The settle budget is a registration budget: it counts only while nothing has
// registered or an expected context is still missing. A registered check that
// is queued or running is GitHub's to time out, not ours. Under `hold` the
// gated contexts have already left `missing`, so a held head's absent heavy
// lanes never count as missing here either.
const settleBudgetApplies = (input: YeetSettleInput, census: YeetExpectedContextCensus): boolean =>
  inRegistrationWindow(input, census) || A.isReadonlyArrayNonEmpty(census.missing);

const unsettledReason = (input: YeetSettleInput, census: YeetExpectedContextCensus): O.Option<YeetSettleReason> =>
  inRegistrationWindow(input, census)
    ? O.some(YeetSettleReason.Enum.registration)
    : A.isReadonlyArrayNonEmpty(census.missing) || A.isReadonlyArrayNonEmpty(census.pending)
      ? O.some(YeetSettleReason.Enum["required-pending"])
      : A.isReadonlyArrayNonEmpty(census.gated)
        ? O.some(YeetSettleReason.Enum["heavy-not-admitted"])
        : O.none();

/**
 * Decide whether one poll's observations settle the head.
 *
 * **Details**
 *
 * A base conflict comes first: when the pull request no longer merges into
 * its base, GitHub empties the check rollup, so every expected context would
 * read as missing and the registration budget would expire on a head that is
 * merely unmerged. The verdict is then unsettled with reason `base-conflict`,
 * the budget never applies (never terminal), and the census is reported as
 * observed; a push that merges the base clears it. Otherwise the timeout
 * bounds registration, never execution: it expires only while no
 * check has registered for the head or at least one expected context is
 * missing (no exact name, no matrix child). A required check that has
 * registered and is queued or running is waited for however long GitHub takes
 * — its own job timeout is the bound there. A settled head never times out.
 * On expiry the verdict reports `settle-timeout` with the census that was
 * still open, so the operator sees which contexts never came (the B7 dogfood
 * amendment, after PR #1149's own babysit hit the budget with two heavy lanes
 * registered but queued). A held head (ttc B8) is the other exception. A head
 * is held exactly when admission is `hold`, gated contexts are the only open
 * work (`missing` and `pending` are both empty), and the head is outside the
 * registration window (at least one check has registered) — the state whose
 * reason is `heavy-not-admitted`: the timeout comparison is skipped entirely,
 * because the absent contexts are absent by design until the label lands.
 * With zero checks registered the reason stays `registration` and the
 * registration budget still applies even under `hold` — a broken CI that never
 * registers must time out. With a non-gated context still missing or pending
 * under `hold` the head is not held: the reason is `required-pending` and the
 * B7 rule judges that context alone (a missing one spends the budget, a
 * registered one is GitHub's to time out).
 *
 * **Example** (Registration, then required-pending, then settled)
 *
 * ```ts
 * import { deriveSettleVerdict, YeetRulesetRequiredContexts, YeetSettleCheck, YeetSettleInput } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const expected = O.some(YeetRulesetRequiredContexts.make({
 *   base: "main", contexts: ["Lint"], rulesetIds: [1], readAt: "2026-09-16T00:00:00.000Z"
 * }))
 * const registering = deriveSettleVerdict(YeetSettleInput.make({ expected, checks: [], closeoutBound: false, waitedMs: 5_000, timeoutMs: 60_000 }))
 * const pending = deriveSettleVerdict(YeetSettleInput.make({
 *   expected, checks: [YeetSettleCheck.make({ name: "Lint", outcome: "pending" })], closeoutBound: false, waitedMs: 20_000, timeoutMs: 60_000
 * }))
 * const settled = deriveSettleVerdict(YeetSettleInput.make({
 *   expected, checks: [YeetSettleCheck.make({ name: "Lint", outcome: "pass" })], closeoutBound: true, waitedMs: 40_000, timeoutMs: 60_000
 * }))
 * console.log(O.getOrNull(registering.reason)) // "registration"
 * console.log(O.getOrNull(pending.reason)) // "required-pending"
 * console.log(settled.settled, O.isNone(settled.reason)) // true true
 * ```
 *
 * @param input - One poll's observations.
 * @returns The settle verdict for that poll.
 * @category utilities
 * @since 0.0.0
 */
export const deriveSettleVerdict = (input: YeetSettleInput): YeetSettleVerdict => {
  const open = censusFor(input);
  const census = admissionIsHold(input.admission) ? gateCensus(open, input.families) : open;
  if (input.baseConflict) {
    return YeetSettleVerdict.make({
      settled: false,
      reason: O.some(YeetSettleReason.Enum["base-conflict"]),
      census,
      waitedMs: input.waitedMs,
      timeoutMs: input.timeoutMs,
      budgetApplies: false,
      admission: input.admission,
    });
  }
  const held = heldOutsideRegistration(input.admission, census, inRegistrationWindow(input, census));
  const unsettled = unsettledReason(input, census);
  // A held head's budget never applies: it neither times out nor shortens a
  // loop sleep, the same way a registered-but-queued check does not.
  const budgetApplies = !held && settleBudgetApplies(input, census);
  const timedOut = input.waitedMs >= input.timeoutMs && budgetApplies;
  return O.match(unsettled, {
    onSome: (reason) =>
      YeetSettleVerdict.make({
        settled: false,
        reason: O.some(timedOut ? YeetSettleReason.Enum["settle-timeout"] : reason),
        census,
        waitedMs: input.waitedMs,
        timeoutMs: input.timeoutMs,
        budgetApplies,
        admission: input.admission,
      }),
    onNone: () =>
      YeetSettleVerdict.make({
        settled: true,
        reason: input.closeoutBound ? O.none() : O.some(YeetSettleReason.Enum["closeout-pending"]),
        census,
        waitedMs: input.waitedMs,
        timeoutMs: input.timeoutMs,
        budgetApplies: false,
        admission: input.admission,
      }),
  });
};

/**
 * Whether a verdict is held: admission is `hold`, gated contexts are open, and
 * the head is outside the registration window.
 *
 * **Details**
 *
 * A held head never reaches `settle-timeout` and the loop sleeps its full
 * interval instead of racing the budget; `waitedMs` is still reported so the
 * gate line can say how long the head has waited for the label. Held means
 * the gated contexts are the only open work: a `hold` verdict whose reason is
 * `registration` (or a `settle-timeout` reached from that window) is not held,
 * nothing having registered yet, and neither is a `required-pending` one, a
 * non-gated context still being missing or pending.
 *
 * **Example** (A held head)
 *
 * ```ts
 * import { HeavyAdmission } from "@beep/repo-cli/commands/Ci"
 * import { YeetExpectedContextCensus, YeetSettleVerdict, yeetSettleVerdictIsHeld } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const census = YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: [], pending: [], missing: [], gated: ["Heavy / Check"] })
 * const hold = HeavyAdmission.make({ verdict: "hold", admitted: false, sources: [], docsOnly: false, changedPathCount: 1 })
 * const verdict = YeetSettleVerdict.make({ settled: false, reason: O.some("heavy-not-admitted"), census, waitedMs: 1, timeoutMs: 1, admission: O.some(hold) })
 * console.log(yeetSettleVerdictIsHeld(verdict)) // true
 * ```
 *
 * @param verdict - The verdict to inspect.
 * @returns Whether the wait is held by heavy admission rather than by the census.
 * @category predicates
 * @since 0.0.0
 */
export const yeetSettleVerdictIsHeld = (verdict: YeetSettleVerdict): boolean =>
  heldOutsideRegistration(
    verdict.admission,
    verdict.census,
    O.exists(
      verdict.reason,
      (reason) => YeetSettleReason.is.registration(reason) || YeetSettleReason.is["settle-timeout"](reason)
    )
  );

/**
 * Whether a head's settle clock restarts between two verdicts: the previous
 * verdict's budget did not apply and the next one's does.
 *
 * **Details**
 *
 * `waitedMs` keeps accumulating while the budget is suspended (a held head, a
 * base conflict, a registered check that is merely queued), so the first
 * verdict whose budget applies again would otherwise inherit that time and
 * expire at once. Restarting the clock on that transition covers every way the
 * budget can resume: admission `hold` → `run`, a base conflict clearing on the
 * same head, a rollup flap that moves a registered head back to `missing`. A
 * first observation (`None`) never resets, and neither does a poll that keeps
 * the budget in the same state.
 *
 * **Example** (Budget resumes after a base conflict)
 *
 * ```ts
 * import { YeetExpectedContextCensus, YeetSettleVerdict, yeetSettleClockReset } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const census = YeetExpectedContextCensus.make({ matched: [], unmatched: [], pending: [], missing: ["Lint"] })
 * const conflict = YeetSettleVerdict.make({ settled: false, reason: O.some("base-conflict"), census, waitedMs: 9_000, timeoutMs: 1_000, budgetApplies: false })
 * const registering = YeetSettleVerdict.make({ settled: false, reason: O.some("registration"), census, waitedMs: 9_000, timeoutMs: 1_000, budgetApplies: true })
 * console.log(yeetSettleClockReset(O.some(conflict), registering)) // true
 * console.log(yeetSettleClockReset(O.none(), registering)) // false
 * ```
 *
 * @param previous - The head's verdict from the last poll, when one exists.
 * @param next - The verdict just derived with the current clock.
 * @returns Whether the loop should restart the settle clock and re-derive.
 * @category predicates
 * @since 0.0.0
 */
export const yeetSettleClockReset: {
  (next: YeetSettleVerdict): (previous: O.Option<YeetSettleVerdict>) => boolean;
  (previous: O.Option<YeetSettleVerdict>, next: YeetSettleVerdict): boolean;
} = dual(
  2,
  (previous: O.Option<YeetSettleVerdict>, next: YeetSettleVerdict): boolean =>
    O.exists(previous, (value) => !value.budgetApplies) && next.budgetApplies
);

/**
 * Whether the settle census treats a reported check name as required: an
 * expected context matched by exact name, or a matrix child of a tolerated
 * expected parent (`Test Unit (unit-a)` under `Test Unit`).
 *
 * **Details**
 *
 * `gh pr checks --required` lists only exact context names, so a failed
 * matrix child of a required parent carries `required: false` from GitHub.
 * The merge loop's red triage and the watch's failure census both consult
 * this rule alongside that flag, so a required parent's children count as
 * required in every consumer. `None` (no settle verdict yet) requires nothing.
 *
 * **Example** (A matrix child of a required parent)
 *
 * ```ts
 * import { YeetExpectedContextCensus, YeetSettleVerdict, yeetSettleCensusRequires } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const census = YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: ["Test Unit"], pending: [], missing: [] })
 * const verdict = O.some(YeetSettleVerdict.make({ settled: false, reason: O.some("required-pending"), census, waitedMs: 1, timeoutMs: 1 }))
 * console.log(yeetSettleCensusRequires(verdict, "Test Unit (unit-a)")) // true
 * console.log(yeetSettleCensusRequires(verdict, "Vercel")) // false
 * ```
 *
 * @param verdict - The head's settle verdict, when one has been derived.
 * @param name - The reported check name.
 * @returns Whether the census requires that name.
 * @category predicates
 * @since 0.0.0
 */
export const yeetSettleCensusRequires: {
  (name: string): (verdict: O.Option<YeetSettleVerdict>) => boolean;
  (verdict: O.Option<YeetSettleVerdict>, name: string): boolean;
} = dual(2, (verdict: O.Option<YeetSettleVerdict>, name: string): boolean =>
  O.exists(
    verdict,
    (value) =>
      A.contains(value.census.matched, name) ||
      A.some(value.census.unmatched, (parent) => isMatrixChildOf(parent, name))
  )
);

/**
 * Whether a settle verdict ends the loop: only `settle-timeout` is terminal.
 *
 * **Example** (A timeout is terminal)
 *
 * ```ts
 * import { YeetExpectedContextCensus, YeetSettleVerdict, yeetSettleVerdictIsTerminal } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const census = YeetExpectedContextCensus.make({ matched: [], unmatched: [], pending: [], missing: ["Lint"] })
 * const verdict = YeetSettleVerdict.make({ settled: false, reason: O.some("settle-timeout"), census, waitedMs: 1, timeoutMs: 1 })
 * console.log(yeetSettleVerdictIsTerminal(verdict)) // true
 * ```
 *
 * @param verdict - The verdict to inspect.
 * @returns Whether the loop must exit with the settle-timeout outcome.
 * @category predicates
 * @since 0.0.0
 */
export const yeetSettleVerdictIsTerminal = (verdict: YeetSettleVerdict): boolean =>
  O.exists(verdict.reason, YeetSettleReason.is["settle-timeout"]);

const renderNames = (label: string, names: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(names) ? [] : [`${label}: ${A.join(names, ", ")}`];

// The budget is named only while it applies (registration or missing
// contexts); a registered-but-queued wait shows elapsed time alone.
// A held wait names the budget it is exempt from; otherwise the budget is
// named only while it applies (registration or missing contexts), and a
// registered-but-queued wait shows elapsed time alone.
const renderWaited = (verdict: YeetSettleVerdict): string =>
  yeetSettleVerdictIsHeld(verdict) || O.exists(verdict.reason, YeetSettleReason.is["base-conflict"])
    ? `waited ${Duration.format(Duration.millis(verdict.waitedMs))} (not counted toward the ${Duration.format(Duration.millis(verdict.timeoutMs))} settle timeout)`
    : A.isReadonlyArrayNonEmpty(verdict.census.missing) || O.exists(verdict.reason, YeetSettleReason.is.registration)
      ? `waited ${Duration.format(Duration.millis(verdict.waitedMs))} of ${Duration.format(Duration.millis(verdict.timeoutMs))}`
      : `waited ${Duration.format(Duration.millis(verdict.waitedMs))}; registered checks are GitHub's to time out`;

const renderGated = (verdict: YeetSettleVerdict): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(verdict.census.gated)
    ? []
    : [...renderNames("gated", verdict.census.gated), `admit: gh pr edit --add-label ${HEAVY_ADMISSION_LABEL}`];

const renderDocsOnly = (verdict: YeetSettleVerdict): ReadonlyArray<string> =>
  O.exists(verdict.admission, (admission) => HeavyAdmissionVerdict.is["skip-satisfied"](admission.verdict))
    ? ["heavy: docs-only, lanes pass without work"]
    : [];

const renderCensusTail = (verdict: YeetSettleVerdict): ReadonlyArray<string> => [
  ...renderNames("pending", verdict.census.pending),
  ...renderNames("missing", verdict.census.missing),
  ...renderNames("tolerated matrix parents", verdict.census.unmatched),
];

/**
 * Render the settle half of the monitor gate line, always naming the current
 * wait reason.
 *
 * **Example** (Render a required-pending wait)
 *
 * ```ts
 * import { renderYeetSettleDetail, YeetExpectedContextCensus, YeetSettleVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetSettleVerdict.make({
 *   settled: false,
 *   reason: O.some("required-pending"),
 *   census: YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: ["Test Unit"], pending: ["Test Unit (unit-a)"], missing: ["Heavy / Check"] }),
 *   waitedMs: 60_000,
 *   timeoutMs: 1_800_000
 * })
 * console.log(renderYeetSettleDetail(verdict))
 * // settle: required-pending; pending: Test Unit (unit-a); missing: Heavy / Check; tolerated matrix parents: Test Unit; waited 1m of 30m
 * ```
 *
 * **Example** (Render a base conflict)
 *
 * ```ts
 * import { renderYeetSettleDetail, YeetExpectedContextCensus, YeetSettleVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetSettleVerdict.make({
 *   settled: false,
 *   reason: O.some("base-conflict"),
 *   census: YeetExpectedContextCensus.make({ matched: [], unmatched: [], pending: [], missing: ["Lint", "Test Unit"] }),
 *   waitedMs: 120_000,
 *   timeoutMs: 1_800_000,
 *   budgetApplies: false
 * })
 * console.log(renderYeetSettleDetail(verdict))
 * // settle: base-conflict; merge origin/main and push; waited 2m (not counted toward the 30m settle timeout)
 * ```
 *
 * **Example** (Render a held wait)
 *
 * ```ts
 * import { HeavyAdmission } from "@beep/repo-cli/commands/Ci"
 * import { renderYeetSettleDetail, YeetExpectedContextCensus, YeetSettleVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetSettleVerdict.make({
 *   settled: false,
 *   reason: O.some("heavy-not-admitted"),
 *   census: YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: [], pending: [], missing: [], gated: ["Heavy / Check", "Heavy / Lint Policy"] }),
 *   waitedMs: 180_000,
 *   timeoutMs: 1_800_000,
 *   admission: O.some(HeavyAdmission.make({ verdict: "hold", admitted: false, sources: [], docsOnly: false, changedPathCount: 2 }))
 * })
 * console.log(renderYeetSettleDetail(verdict))
 * // settle: heavy-not-admitted; gated: Heavy / Check, Heavy / Lint Policy; admit: gh pr edit --add-label ready-for-heavy; waited 3m (not counted toward the 30m settle timeout)
 * ```
 *
 * @param verdict - The verdict to render.
 * @returns One line naming the reason and the open census.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetSettleDetail = (verdict: YeetSettleVerdict): string =>
  pipe(
    Match.value(O.getOrNull(verdict.reason)),
    Match.when(null, () => [
      "settle: settled; closeout bound",
      ...renderNames("tolerated matrix parents", verdict.census.unmatched),
      ...renderDocsOnly(verdict),
    ]),
    Match.when("closeout-pending", () => [
      "settle: closeout-pending; required census settled, running the read-first closeout",
      ...renderNames("tolerated matrix parents", verdict.census.unmatched),
      ...renderDocsOnly(verdict),
    ]),
    Match.when("base-conflict", () => ["settle: base-conflict", "merge origin/main and push", renderWaited(verdict)]),
    Match.when("registration", () => [
      "settle: registration; no checks reported for this head yet",
      renderWaited(verdict),
    ]),
    Match.when("required-pending", () => [
      "settle: required-pending",
      ...renderCensusTail(verdict),
      ...renderGated(verdict),
      ...renderDocsOnly(verdict),
      renderWaited(verdict),
    ]),
    Match.when("heavy-not-admitted", () => [
      "settle: heavy-not-admitted",
      ...renderGated(verdict),
      ...renderNames("tolerated matrix parents", verdict.census.unmatched),
      renderWaited(verdict),
    ]),
    Match.when("settle-timeout", () => [
      `settle: settle-timeout after ${Duration.format(Duration.millis(verdict.timeoutMs))}`,
      ...renderCensusTail(verdict),
    ]),
    Match.exhaustive,
    A.join("; ")
  );

/**
 * Every settle-rule schema, for arbitrary-based round-trip tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const yeetSettleSchemasForTesting = {
  GhBranchRule,
  GhRulesetRequiredStatusCheck,
  YeetExpectedContextCensus,
  YeetExpectedContextInput,
  YeetGatedContextFamily,
  YeetRegistrationRecall,
  YeetRulesetRequiredContexts,
  YeetSettleCheck,
  YeetSettleInput,
  YeetSettleVerdict,
} as const;

/**
 * Map a wait reason to the head-timeline stamp it produces, if any.
 *
 * **Example** (Closeout-pending stamps the settle instant)
 *
 * ```ts
 * import { yeetSettleStampFor } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(yeetSettleStampFor(O.some("closeout-pending")))) // "settledAt"
 * console.log(O.getOrNull(yeetSettleStampFor(O.some("registration")))) // null
 * console.log(O.getOrNull(yeetSettleStampFor(O.some("heavy-not-admitted")))) // null
 * console.log(O.getOrNull(yeetSettleStampFor(O.some("base-conflict")))) // null
 * ```
 *
 * @param reason - The verdict's reason.
 * @returns Which timeline field the loop stamps on first observation of that reason.
 * @category utilities
 * @since 0.0.0
 */
export const yeetSettleStampFor = (reason: O.Option<YeetSettleReason>): O.Option<"settledAt"> =>
  O.isNone(reason) || O.exists(reason, YeetSettleReason.is["closeout-pending"]) ? O.some("settledAt") : O.none();
