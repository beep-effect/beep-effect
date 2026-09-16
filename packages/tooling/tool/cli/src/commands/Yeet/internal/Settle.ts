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
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
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
 * head; `timeoutMs` is the `--settle-timeout` budget.
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
  },
  $I.annote("YeetSettleInput", {
    description: "Expected contexts, reported checks, closeout binding, and elapsed wait for one settle evaluation.",
  })
) {}

/**
 * The settle rule's answer for one poll.
 *
 * **Details**
 *
 * `settled` says the required census is complete for this head. `reason` is
 * the wait reason the gate line names: `registration` or `required-pending`
 * while unsettled, `settle-timeout` when the budget expired unsettled,
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
  },
  $I.annote("YeetSettleVerdict", {
    description: "Whether the required census settled, the wait reason the gate line names, and the census behind it.",
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

// The settle budget is a registration budget: it counts only while nothing has
// registered or an expected context is still missing. A registered check that
// is queued or running is GitHub's to time out, not ours.
const settleBudgetApplies = (input: YeetSettleInput, census: YeetExpectedContextCensus): boolean =>
  inRegistrationWindow(input, census) || A.isReadonlyArrayNonEmpty(census.missing);

const unsettledReason = (input: YeetSettleInput, census: YeetExpectedContextCensus): O.Option<YeetSettleReason> =>
  inRegistrationWindow(input, census)
    ? O.some(YeetSettleReason.Enum.registration)
    : A.isReadonlyArrayNonEmpty(census.missing) || A.isReadonlyArrayNonEmpty(census.pending)
      ? O.some(YeetSettleReason.Enum["required-pending"])
      : O.none();

/**
 * Decide whether one poll's observations settle the head.
 *
 * **Details**
 *
 * The timeout bounds registration, never execution: it expires only while no
 * check has registered for the head or at least one expected context is
 * missing (no exact name, no matrix child). A required check that has
 * registered and is queued or running is waited for however long GitHub takes
 * — its own job timeout is the bound there. A settled head never times out.
 * On expiry the verdict reports `settle-timeout` with the census that was
 * still open, so the operator sees which contexts never came (ruling 49,
 * amending ruling 45 after PR #1149's own babysit hit the budget with two
 * heavy lanes registered but queued).
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
  const census = censusFor(input);
  const unsettled = unsettledReason(input, census);
  const timedOut = input.waitedMs >= input.timeoutMs && settleBudgetApplies(input, census);
  return O.match(unsettled, {
    onSome: (reason) =>
      YeetSettleVerdict.make({
        settled: false,
        reason: O.some(timedOut ? YeetSettleReason.Enum["settle-timeout"] : reason),
        census,
        waitedMs: input.waitedMs,
        timeoutMs: input.timeoutMs,
      }),
    onNone: () =>
      YeetSettleVerdict.make({
        settled: true,
        reason: input.closeoutBound ? O.none() : O.some(YeetSettleReason.Enum["closeout-pending"]),
        census,
        waitedMs: input.waitedMs,
        timeoutMs: input.timeoutMs,
      }),
  });
};

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
const renderWaited = (verdict: YeetSettleVerdict): string =>
  A.isReadonlyArrayNonEmpty(verdict.census.missing) || O.exists(verdict.reason, YeetSettleReason.is.registration)
    ? `waited ${Duration.format(Duration.millis(verdict.waitedMs))} of ${Duration.format(Duration.millis(verdict.timeoutMs))}`
    : `waited ${Duration.format(Duration.millis(verdict.waitedMs))}; registered checks are GitHub's to time out`;

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
    ]),
    Match.when("closeout-pending", () => [
      "settle: closeout-pending; required census settled, running the read-first closeout",
      ...renderNames("tolerated matrix parents", verdict.census.unmatched),
    ]),
    Match.when("registration", () => [
      "settle: registration; no checks reported for this head yet",
      renderWaited(verdict),
    ]),
    Match.when("required-pending", () => [
      "settle: required-pending",
      ...renderCensusTail(verdict),
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
 * ```
 *
 * @param reason - The verdict's reason.
 * @returns Which timeline field the loop stamps on first observation of that reason.
 * @category utilities
 * @since 0.0.0
 */
export const yeetSettleStampFor = (reason: O.Option<YeetSettleReason>): O.Option<"settledAt"> =>
  O.isNone(reason) || O.exists(reason, YeetSettleReason.is["closeout-pending"]) ? O.some("settledAt") : O.none();
