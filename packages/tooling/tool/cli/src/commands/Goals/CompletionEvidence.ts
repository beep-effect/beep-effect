/**
 * Merge-time completion evidence: GitHub reads, the live provider and the pure verdict.
 *
 * **Details**
 *
 * GitHub's current ruleset list omits rulesets deleted since a merge, so it
 * cannot prove a complete merge-time inventory. The rule suite GitHub records
 * for the merge push can: it lists every rule source evaluated for that push,
 * deleted rulesets included, with GitHub's own required-status-checks result.
 * The provider joins that rule suite with each ruleset's history version at
 * merge and binds every required context to the accepted head.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ghOutput } from "../../internal/github/index.ts";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import { GhBranchRule, rulesetRequiredContextsFromRules, YeetRulesetRulesPayload } from "../Yeet/internal/Settle.ts";
import { YeetCommandError } from "../Yeet/Yeet.errors.ts";
import { GoalMergeTimeEvidence } from "./CompletionEvidence.schemas.ts";
import { GoalCompletionIo, GoalMergeTimeEvidenceProvider } from "./CompletionEvidence.service.ts";
import {
  GoalCheckConclusion,
  GoalCompletionEvidenceGap,
  GoalCompletionEvidenceUnknown,
  GoalCompletionEvidenceUnsatisfied,
  GoalCompletionEvidenceVerified,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  GoalRuleEnforcement,
  GoalRuleEvaluationResult,
  GoalRuleSuiteResult,
} from "./Goals.schemas.ts";
import type * as Context from "effect/Context";
import type {
  GoalCompletionEvidenceInput,
  GoalMergeTimeEvidenceRequest,
  GoalObservedCheckRun,
} from "./CompletionEvidence.schemas.ts";
import type { GoalCompletionEvidenceVerdict, GoalCompletionOutcome, GoalRuleSourceHistory } from "./Goals.schemas.ts";

const gitAdapter = {
  onSpawnFailure: (command: string) => (_cause: unknown) => YeetCommandError.make({ message: `Cannot run ${command}` }),
  onNonZeroExit: ({ commandLine }: { readonly commandLine: string }) =>
    YeetCommandError.make({ message: `${commandLine} failed` }),
  onTruncated: O.none<(command: string) => YeetCommandError>(),
};

/**
 * Runs one read-only git command through the provided port, or the repository git adapter.
 *
 * **Example** (Inspect the git reader)
 *
 * ```ts
 * import { readGoalCompletionGit } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalCompletionGit)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCompletionGit = Effect.fn("Goals.Completion.git")(function* (
  root: string,
  args: ReadonlyArray<string>
) {
  const io = yield* Effect.serviceOption(GoalCompletionIo);
  return yield* O.isSome(io) ? io.value.git(root, args) : runGitOutput(root, args, gitAdapter);
});

/**
 * Runs one read-only GitHub request through the provided port, or the `gh` adapter.
 *
 * **Example** (Inspect the GitHub reader)
 *
 * ```ts
 * import { readGoalCompletionGithub } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalCompletionGithub)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCompletionGithub = Effect.fn("Goals.Completion.github")(function* (
  root: string,
  args: ReadonlyArray<string>
) {
  const io = yield* Effect.serviceOption(GoalCompletionIo);
  return yield* O.isSome(io)
    ? io.value.github(root, args)
    : ghOutput({
        cwd: root,
        args,
        label: "goal completion GitHub observation",
        onFailure: (failure) => YeetCommandError.make({ message: `${failure.label}: ${failure._tag}` }),
      });
});

/**
 * Reads one GitHub request and decodes its JSON body; a decode failure is a typed read failure.
 *
 * **Example** (Inspect the JSON reader)
 *
 * ```ts
 * import { readGoalCompletionJson } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalCompletionJson)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCompletionJson = Effect.fn("Goals.Completion.readJson")(function* <
  Sch extends S.Codec<unknown, unknown>,
>(root: string, args: ReadonlyArray<string>, schema: Sch) {
  const text = yield* readGoalCompletionGithub(root, args);
  return yield* JsonStringCodec(schema)
    .decode(text)
    .pipe(Effect.mapError(() => YeetCommandError.make({ message: "Invalid goal completion GitHub payload" })));
});

const RulesetListEntry = S.Struct({
  id: S.Int,
  source_type: S.String,
  created_at: S.optionalKey(S.DateTimeUtcFromString),
});
const RulesetList = RulesetListEntry.pipe(S.Array, S.Array);
const RulesetHistory = S.Struct({ version_id: S.Int, updated_at: S.DateTimeUtcFromString }).pipe(S.Array, S.Array);
const RulesetVersion = S.Struct({
  state: S.Struct({
    enforcement: S.String,
    target: S.String,
    conditions: S.Struct({ ref_name: S.Struct({ include: S.Array(S.String), exclude: S.Array(S.String) }) }),
    rules: S.Array(GhBranchRule),
  }),
});
const RuleSuiteList = S.Struct({ id: S.Int, ref: S.String, after_sha: S.String }).pipe(S.Array, S.Array);
const RuleEvaluation = S.Struct({
  rule_source: S.Struct({
    type: S.NonEmptyString,
    id: S.OptionFromOptionalNullOr(S.Int),
    name: S.OptionFromOptionalNullOr(S.String),
  }),
  enforcement: GoalRuleEnforcement,
  result: GoalRuleEvaluationResult,
  rule_type: S.NonEmptyString,
});
const RuleSuite = S.Struct({
  id: S.Int,
  ref: S.NonEmptyString,
  after_sha: S.NonEmptyString,
  pushed_at: S.DateTimeUtcFromString,
  result: GoalRuleSuiteResult,
  rule_evaluations: S.Array(RuleEvaluation),
});

const RULESETS_ENDPOINT = "repos/{owner}/{repo}/rulesets?per_page=100&includes_parents=true";
const REQUIRED_STATUS_CHECKS = "required_status_checks";

// How a merge-time ruleset version relates to the base branch: it gated the
// merge (`applies`), was in evaluate mode (`evaluate`, never gating), or was
// inactive or did not target this branch (`mismatch`). A rule-suite source was
// evaluated by GitHub on this branch, so `mismatch` means GitHub's two records disagree.
const HistoricalApplicability = LiteralKit(["applies", "evaluate", "mismatch"]);

const applicabilityOfEnforcement = (enforcement: string): typeof HistoricalApplicability.Type =>
  Match.value(enforcement).pipe(
    Match.when("active", () => HistoricalApplicability.Enum.applies),
    Match.when("evaluate", () => HistoricalApplicability.Enum.evaluate),
    Match.orElse(() => HistoricalApplicability.Enum.mismatch)
  );

const historicalRulesetApplicability = Effect.fn("Goals.Completion.rulesetApplies")(function* (
  state: typeof RulesetVersion.Type.state,
  base: string
) {
  if (state.target !== "branch") return HistoricalApplicability.Enum.mismatch;
  const patterns = A.appendAll(state.conditions.ref_name.include, state.conditions.ref_name.exclude);
  if (base !== "main" && A.contains(patterns, "~DEFAULT_BRANCH"))
    return yield* YeetCommandError.make({
      message: "Historical ruleset ~DEFAULT_BRANCH needs an independently observed default branch",
    });
  const matches = (pattern: string): boolean =>
    pattern === "~ALL" || (pattern === "~DEFAULT_BRANCH" && base === "main") || pattern === `refs/heads/${base}`;
  if (A.some(patterns, Str.includes("*")))
    return yield* YeetCommandError.make({
      message: "Historical ruleset glob requires an independently evaluated branch snapshot",
    });
  const targetsBase =
    A.some(state.conditions.ref_name.include, matches) && !A.some(state.conditions.ref_name.exclude, matches);
  return targetsBase ? applicabilityOfEnforcement(state.enforcement) : HistoricalApplicability.Enum.mismatch;
});

const readHistoricalRuleset = Effect.fn("Goals.Completion.historicalRuleset")(function* (
  root: string,
  ruleset: typeof RulesetListEntry.Type,
  base: string,
  mergedAt: DateTime.Utc
) {
  if (ruleset.source_type !== "Repository")
    return yield* YeetCommandError.make({
      message: "Inherited ruleset history is unavailable through the repository-only adapter",
    });
  const history = A.flatten(
    yield* readGoalCompletionJson(
      root,
      ["api", `repos/{owner}/{repo}/rulesets/${ruleset.id}/history?per_page=100`, "--paginate", "--slurp"],
      RulesetHistory
    )
  );
  const version = A.reduce(
    A.filter(history, (row) => DateTime.toEpochMillis(row.updated_at) <= DateTime.toEpochMillis(mergedAt)),
    O.none<(typeof RulesetHistory.Type)[number][number]>(),
    (found, row) =>
      O.isNone(found) || DateTime.isGreaterThan(row.updated_at, found.value.updated_at) ? O.some(row) : found
  );
  if (O.isNone(version)) {
    if (ruleset.created_at !== undefined && DateTime.isGreaterThan(ruleset.created_at, mergedAt)) return O.none();
    return yield* YeetCommandError.make({ message: "No historical ruleset version covers this merge" });
  }
  const source = `repos/{owner}/{repo}/rulesets/${ruleset.id}/history/${version.value.version_id}`;
  const { state } = yield* readGoalCompletionJson(root, ["api", source], RulesetVersion);
  // An evaluate-mode version at merge is a recovered fact that the ruleset did not
  // gate this merge. An inactive or non-matching version contradicts the merge-push
  // rule suite that evaluated it on this branch, so it is a mismatch (unknown).
  const applicability = yield* historicalRulesetApplicability(state, base);
  const applies = applicability === "applies";
  const folded = rulesetRequiredContextsFromRules(
    YeetRulesetRulesPayload.make({ base, readAt: DateTime.formatIso(mergedAt), rules: state.rules })
  );
  return O.some({
    id: ruleset.id,
    source,
    applies,
    applicability,
    contexts: applies ? folded.contexts : A.empty<string>(),
  });
});

type HistoricalRead = O.Option<{
  readonly id: number;
  readonly source: string;
  readonly applies: boolean;
  readonly applicability: typeof HistoricalApplicability.Type;
  readonly contexts: ReadonlyArray<string>;
}>;

const SuiteLookup = S.Struct({
  found: S.Option(S.Struct({ source: S.NonEmptyString, suite: RuleSuite })),
  gap: S.Option(GoalCompletionEvidenceGap),
});

// GitHub lists rule suites for the last month at most; an older merge push has
// no listed suite and stays rule-suite-unavailable rather than being guessed.
const readMergeRuleSuite = Effect.fn("Goals.CompletionEvidence.ruleSuite")(function* (
  root: string,
  base: string,
  mergeCommit: string
) {
  const ref = `refs/heads/${base}`;
  const listed = A.flatten(
    yield* readGoalCompletionJson(
      root,
      [
        "api",
        `repos/{owner}/{repo}/rulesets/rule-suites?ref=${ref}&time_period=month&per_page=100`,
        "--paginate",
        "--slurp",
      ],
      RuleSuiteList
    )
  );
  // Offset pagination can repeat a row when new pushes arrive mid-read; one suite id is one suite.
  const ids = A.dedupe(
    A.map(
      A.filter(listed, (row) => row.after_sha === mergeCommit && row.ref === ref),
      (row) => row.id
    )
  );
  const only = A.length(ids) === 1 ? A.head(ids) : O.none<number>();
  if (O.isNone(only))
    return SuiteLookup.make({
      found: O.none(),
      gap: O.some(A.isReadonlyArrayEmpty(ids) ? "rule-suite-unavailable" : "inventory-mismatch"),
    });
  const source = `repos/{owner}/{repo}/rulesets/rule-suites/${only.value}`;
  const suite = yield* readGoalCompletionJson(root, ["api", source], RuleSuite);
  return SuiteLookup.make({ found: O.some({ source, suite }), gap: O.none() });
});

const successful = (conclusion: GoalCheckConclusion): boolean =>
  conclusion === "success" || conclusion === "neutral" || conclusion === "skipped";

const notAfter = (time: O.Option<DateTime.Utc>, limit: DateTime.Utc): boolean =>
  O.exists(time, (value) => DateTime.toEpochMillis(value) <= DateTime.toEpochMillis(limit));

// Binds each required context to the newest run on the accepted head that
// started before merge. Newer runs (higher check-run id) supersede older ones,
// so a pre-merge green rerun replaces an older red. A run not completed by merge
// is pending and unknown; a context with no pre-merge run on the head is unknown.
const goalRequiredCheckFacts = ({
  contexts,
  checkRuns,
  head,
  mergedAt,
}: {
  readonly contexts: ReadonlyArray<string>;
  readonly checkRuns: ReadonlyArray<GoalObservedCheckRun>;
  readonly head: string;
  readonly mergedAt: DateTime.Utc;
}): ReadonlyArray<GoalRequiredCheckFact> =>
  A.map(A.dedupe(A.filter(contexts, Str.isNonEmpty)), (context) => {
    const newest = A.reduce(
      A.filter(checkRuns, (run) => run.name === context && run.head_sha === head && notAfter(run.started_at, mergedAt)),
      O.none<GoalObservedCheckRun>(),
      (found, run) => (O.isNone(found) || run.id > found.value.id ? O.some(run) : found)
    );
    return O.match(newest, {
      onNone: () =>
        GoalRequiredCheckFact.make({
          context,
          head,
          checkRunId: O.none(),
          conclusion: "unknown",
          outcome: "unknown",
          source: "check-run",
        }),
      onSome: (run) => {
        const completed = run.status === "completed" && notAfter(run.completed_at, mergedAt);
        const conclusion: GoalCheckConclusion = completed
          ? S.is(GoalCheckConclusion)(run.conclusion)
            ? run.conclusion
            : "unknown"
          : "pending";
        const outcome: GoalCompletionOutcome = completed
          ? successful(conclusion)
            ? "verified"
            : "unsatisfied"
          : "unknown";
        return GoalRequiredCheckFact.make({
          context,
          head,
          checkRunId: O.some(run.id),
          conclusion,
          outcome,
          source: "check-run",
        });
      },
    });
  });

const requiresChecks = (source: GoalMergeTimeRuleSource): boolean =>
  source.enforcement !== "evaluate" && O.isSome(source.requiredStatusChecks);

// Whether a rule source gated the merge: recovered history wins over the
// enforcement GitHub reported at push time (a deleted ruleset reports
// `deleted ruleset`, which says nothing about its merge-time enforcement).
const gatesAtMerge = (source: GoalMergeTimeRuleSource): boolean =>
  O.isSome(source.requiredStatusChecks) &&
  source.history !== "not-gating" &&
  (source.history === "gating" || source.enforcement !== "evaluate");

const failedRequiredChecks = (source: GoalMergeTimeRuleSource): boolean =>
  O.contains(source.requiredStatusChecks, "fail");

const missingVersionGap = (source: GoalMergeTimeRuleSource): GoalCompletionEvidenceGap =>
  source.sourceType === "ruleset" && (!source.survives || source.enforcement === "deleted ruleset")
    ? "deleted-ruleset-unrecoverable"
    : "unsupported-rule-source";

/**
 * Decides merge-time completion evidence without IO: verified only on complete, head-bound, green facts.
 *
 * **Details**
 *
 * A head-bound required red, or a failed required-status-checks rule from a
 * source active at the merge push, is `unsatisfied` even when other evidence is
 * missing. A failed rule from a ruleset deleted since then whose recovered
 * history shows it gated the merge is `unsatisfied` once the rest of the
 * evidence is complete, and `unknown` before that; it is never `verified`. A
 * recovered evaluate-mode version does not gate; a recovered inactive or
 * non-matching version contradicts the merge-push rule suite and is an
 * `inventory-mismatch`, so the outcome is `unknown`. Otherwise any gap is
 * `unknown`: no inventory, no rule suite for the
 * merge commit, a rule suite bound to another commit, partial ruleset reads, a
 * required-check source with no recovered history version (deleted or
 * unsupported), stored provider gaps, no required contexts, or a context
 * without a green fact on the accepted head. Completeness is re-derived from
 * the stored rule suite; the `inventoryComplete` flag alone never verifies.
 *
 * **Example** (No inventory is unknown)
 *
 * ```ts
 * import { decideGoalCompletionEvidence } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * import { GoalCompletionEvidenceInput } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as O from "effect/Option"
 *
 * const verdict = decideGoalCompletionEvidence(
 *   GoalCompletionEvidenceInput.make({ acceptedHead: O.some("head"), mergeCommit: O.some("merge"), requiredChecks: O.none(), facts: [] })
 * )
 * console.log(verdict._tag) // "unknown"
 * ```
 *
 * @param input - Accepted head, merge commit, stored inventory and head-bound facts.
 * @returns The verified, unsatisfied or unknown verdict.
 * @category validation
 * @since 0.0.0
 */
export const decideGoalCompletionEvidence = (input: GoalCompletionEvidenceInput): GoalCompletionEvidenceVerdict => {
  const headBound = (fact: GoalRequiredCheckFact): boolean => O.contains(input.acceptedHead, fact.head);
  const contexts = O.match(input.requiredChecks, { onNone: A.empty<string>, onSome: (snapshot) => snapshot.contexts });
  const relevant = A.filter(input.facts, (fact) => A.contains(contexts, fact.context));
  const inventory = O.flatMap(input.requiredChecks, (snapshot) => snapshot.mergeTimeInventory);
  const boundInventory = O.filter(inventory, (value) => O.contains(input.mergeCommit, value.afterSha));
  const reds = A.filter(relevant, (fact) => fact.outcome === "unsatisfied" && headBound(fact));
  const boundSources = O.match(boundInventory, {
    onNone: A.empty<GoalMergeTimeRuleSource>,
    onSome: (value) => value.ruleSources,
  });
  // Active at push: GitHub's own failed evaluation is a known required red.
  const activeRed = A.some(
    boundSources,
    (source) => source.enforcement === "active" && source.history !== "not-gating" && failedRequiredChecks(source)
  );
  // Deleted since merge, with history showing it gated the merge: a red too,
  // but reported as unsatisfied only once the rest of the evidence is complete.
  const recoveredRed = A.some(
    boundSources,
    (source) => source.enforcement === "deleted ruleset" && source.history === "gating" && failedRequiredChecks(source)
  );
  if (A.isReadonlyArrayNonEmpty(reds) || activeRed)
    return GoalCompletionEvidenceUnsatisfied.make({ reds, ruleSuiteRed: activeRed });
  const gaps = O.match(input.requiredChecks, {
    onNone: () => A.of<GoalCompletionEvidenceGap>("inventory-unobserved"),
    onSome: (snapshot) =>
      A.dedupe([
        ...snapshot.gaps,
        ...(O.isNone(inventory) ? A.of<GoalCompletionEvidenceGap>("rule-suite-unavailable") : []),
        ...(O.isSome(inventory) && O.isNone(boundInventory)
          ? A.of<GoalCompletionEvidenceGap>("inventory-mismatch")
          : []),
        ...(snapshot.rulesetReadsComplete ? [] : A.of<GoalCompletionEvidenceGap>("partial-ruleset-reads")),
        ...(A.some(boundSources, (source) => source.history === "conflicting")
          ? A.of<GoalCompletionEvidenceGap>("inventory-mismatch")
          : []),
        ...O.match(inventory, {
          onNone: A.empty<GoalCompletionEvidenceGap>,
          onSome: (value) =>
            A.map(
              A.filter(value.ruleSources, (source) => gatesAtMerge(source) && O.isNone(source.version)),
              missingVersionGap
            ),
        }),
        ...(A.isReadonlyArrayEmpty(contexts) ||
        A.some(
          contexts,
          (context) =>
            !A.some(relevant, (fact) => fact.context === context && fact.outcome === "verified" && headBound(fact))
        )
          ? A.of<GoalCompletionEvidenceGap>("required-check-unobserved")
          : []),
      ]),
  });
  if (A.isReadonlyArrayNonEmpty(gaps)) return GoalCompletionEvidenceUnknown.make({ gaps });
  if (recoveredRed) return GoalCompletionEvidenceUnsatisfied.make({ reds, ruleSuiteRed: true });
  // No gap means contexts is non-empty and each has a green fact, so `relevant`
  // is non-empty; the verified schema enforces that minimum.
  return GoalCompletionEvidenceVerified.make({ facts: relevant });
};

/**
 * Describes a completion-evidence verdict in one line for receipts and doctor output.
 *
 * **Example** (Describe an unknown verdict)
 *
 * ```ts
 * import { describeGoalCompletionEvidence } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * import { GoalCompletionEvidenceUnknown } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(describeGoalCompletionEvidence(GoalCompletionEvidenceUnknown.make({ gaps: ["rule-suite-unavailable"] })))
 * ```
 *
 * @param verdict - Verdict from {@link decideGoalCompletionEvidence}.
 * @returns A plain sentence naming the verdict and its gaps or reds.
 * @category formatting
 * @since 0.0.0
 */
export const describeGoalCompletionEvidence = (verdict: GoalCompletionEvidenceVerdict): string =>
  Match.valueTags(verdict, {
    verified: (value) =>
      `Merge-time evidence verified: complete rule-suite inventory and ${A.length(value.facts)} green required contexts at the accepted head.`,
    unsatisfied: (value) =>
      `Merge-time evidence unsatisfied: ${A.length(value.reds)} required red(s) at the accepted head${value.ruleSuiteRed ? "; the merge-push rule suite failed required status checks" : ""}.`,
    unknown: (value) => `Merge-time evidence unknown: ${A.join(value.gaps, ", ")}.`,
  });

const ruleSourcesOf = (
  suite: typeof RuleSuite.Type,
  surviving: ReadonlyArray<number>
): ReadonlyArray<GoalMergeTimeRuleSource> => {
  const keyOf = (evaluation: typeof RuleEvaluation.Type): string =>
    `${evaluation.rule_source.type}:${O.getOrElse(O.map(evaluation.rule_source.id, String), () => "")}`;
  const keys = A.dedupe(A.map(suite.rule_evaluations, keyOf));
  return A.getSomes(
    A.map(keys, (key) => {
      const group = A.filter(suite.rule_evaluations, (evaluation) => keyOf(evaluation) === key);
      const statusRule = A.findFirst(group, (evaluation) => evaluation.rule_type === REQUIRED_STATUS_CHECKS);
      return O.map(A.head(group), (first) => {
        const representative = O.getOrElse(statusRule, () => first);
        return GoalMergeTimeRuleSource.make({
          sourceType: first.rule_source.type,
          rulesetId: first.rule_source.id,
          name: first.rule_source.name,
          enforcement: representative.enforcement,
          requiredStatusChecks: O.map(statusRule, (evaluation) => evaluation.result),
          survives:
            first.rule_source.type === "ruleset" && O.exists(first.rule_source.id, (id) => A.contains(surviving, id)),
          version: O.none(),
        });
      });
    })
  );
};

/**
 * Reads the merge-time required-check inventory and binds every required context to the accepted head.
 *
 * **Details**
 *
 * Never fails. Reads that fail become gaps: `network-failure` for an
 * unreadable ruleset list or rule suite, `partial-ruleset-reads` for a
 * surviving ruleset whose history cannot be read, and
 * `deleted-ruleset-unrecoverable` for a rule-suite ruleset that current
 * enumeration no longer lists and whose history GitHub no longer serves.
 * A surviving ruleset that history says applied but the rule suite did not
 * evaluate, or the reverse, is `inventory-mismatch`.
 *
 * **Example** (Inspect the live provider operation)
 *
 * ```ts
 * import { observeGoalMergeTimeEvidence } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof observeGoalMergeTimeEvidence)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const observeGoalMergeTimeEvidence = Effect.fn("Goals.CompletionEvidence.observe")(function* (
  root: string,
  request: GoalMergeTimeEvidenceRequest
) {
  const { base, mergeCommit, mergedAt, acceptedHead } = request;
  const listed = yield* readGoalCompletionJson(
    root,
    ["api", RULESETS_ENDPOINT, "--paginate", "--slurp"],
    RulesetList
  ).pipe(Effect.map(A.flatten), Effect.option);
  const current = O.getOrElse(listed, A.empty<typeof RulesetListEntry.Type>);
  const reads = yield* Effect.forEach(
    current,
    Effect.fn("Goals.CompletionEvidence.survivingRuleset")(function* (ruleset) {
      const read: O.Option<HistoricalRead> = yield* readHistoricalRuleset(root, ruleset, base, mergedAt).pipe(
        Effect.option
      );
      return { ruleset, read };
    })
  );
  const lookup = yield* readMergeRuleSuite(root, base, mergeCommit).pipe(
    Effect.orElseSucceed(() => SuiteLookup.make({ found: O.none(), gap: O.some("network-failure") }))
  );
  const surviving = A.map(current, (ruleset) => ruleset.id);
  const applied = A.filter(
    pipe(
      reads,
      A.map((entry) => entry.read),
      A.getSomes,
      A.getSomes
    ),
    (version) => version.applies
  );
  const sources = O.match(lookup.found, {
    onNone: A.empty<GoalMergeTimeRuleSource>,
    onSome: ({ suite }) => ruleSourcesOf(suite, surviving),
  });
  const resolved = yield* Effect.forEach(
    sources,
    Effect.fn("Goals.CompletionEvidence.ruleSource")(function* (source) {
      const none = {
        source,
        recovered: O.none<{ readonly source: string; readonly contexts: ReadonlyArray<string> }>(),
        gap: O.none<GoalCompletionEvidenceGap>(),
      };
      if (!requiresChecks(source)) return none;
      if (source.sourceType !== "ruleset" || O.isNone(source.rulesetId))
        return { ...none, gap: O.some<GoalCompletionEvidenceGap>("unsupported-rule-source") };
      const id = source.rulesetId.value;
      if (source.survives) {
        const entry = A.findFirst(reads, (row) => row.ruleset.id === id);
        return O.match(
          O.flatMap(entry, (row) => row.read),
          {
            onNone: () => ({
              ...none,
              gap: O.some<GoalCompletionEvidenceGap>(
                O.exists(entry, (row) => row.ruleset.source_type !== "Repository")
                  ? "unsupported-rule-source"
                  : "partial-ruleset-reads"
              ),
            }),
            onSome: (read) =>
              O.match(
                O.filter(read, (version) => version.applies),
                {
                  onNone: () => ({ ...none, gap: O.some<GoalCompletionEvidenceGap>("inventory-mismatch") }),
                  onSome: (version) => ({
                    ...none,
                    source: GoalMergeTimeRuleSource.make({
                      ...source,
                      version: O.some(version.source),
                      history: "gating",
                    }),
                  }),
                }
              ),
          }
        );
      }
      // Deleted since merge: GitHub's ruleset history is the only authoritative
      // record of its rules. When history is gone, no contexts are invented.
      const history = yield* readHistoricalRuleset(root, { id, source_type: "Repository" }, base, mergedAt).pipe(
        Effect.option
      );
      // Recovered history restores the ruleset's enforcement at merge: an active,
      // applicable version gates; an evaluate-mode version does not, so the
      // remaining evidence decides. An inactive or non-matching version
      // contradicts the rule suite (GitHub evaluated it on this branch), so it
      // is `conflicting`: an inventory mismatch, never verified.
      // A deleted ruleset has no listed creation time, so a read that finds no
      // version at merge fails rather than returning none; both are unrecoverable.
      return O.match(O.flatten(history), {
        onNone: () => ({ ...none, gap: O.some<GoalCompletionEvidenceGap>("deleted-ruleset-unrecoverable") }),
        onSome: (version) => ({
          ...none,
          source: GoalMergeTimeRuleSource.make({
            ...source,
            version: O.some(version.source),
            history: Match.value(version.applicability).pipe(
              Match.when("applies", (): GoalRuleSourceHistory => "gating"),
              Match.when("evaluate", (): GoalRuleSourceHistory => "not-gating"),
              Match.orElse((): GoalRuleSourceHistory => "conflicting")
            ),
          }),
          gap:
            version.applicability === "mismatch"
              ? O.some<GoalCompletionEvidenceGap>("inventory-mismatch")
              : O.none<GoalCompletionEvidenceGap>(),
          recovered: version.applies
            ? O.some({ source: version.source, contexts: version.contexts })
            : O.none<{ readonly source: string; readonly contexts: ReadonlyArray<string> }>(),
        }),
      });
    })
  );
  const evaluatedRulesets = A.getSomes(
    A.map(
      A.filter(sources, (source) => requiresChecks(source) && source.sourceType === "ruleset"),
      (source) => source.rulesetId
    )
  );
  const unevaluated = A.filter(
    applied,
    (version) => A.isReadonlyArrayNonEmpty(version.contexts) && !A.contains(evaluatedRulesets, version.id)
  );
  const recovered = A.getSomes(A.map(resolved, (row) => row.recovered));
  const versions = A.appendAll(
    A.map(applied, (version) => ({ source: version.source, contexts: version.contexts })),
    recovered
  );
  const readsComplete = A.every(reads, (entry) => O.isSome(entry.read));
  const gaps = A.dedupe([
    ...(O.isNone(listed) ? A.of<GoalCompletionEvidenceGap>("network-failure") : []),
    ...O.toArray(lookup.gap),
    ...(readsComplete ? [] : A.of<GoalCompletionEvidenceGap>("partial-ruleset-reads")),
    ...A.getSomes(A.map(resolved, (row) => row.gap)),
    ...(O.isSome(lookup.found) && A.isReadonlyArrayNonEmpty(unevaluated)
      ? A.of<GoalCompletionEvidenceGap>("inventory-mismatch")
      : []),
  ]);
  const inventory = O.map(lookup.found, ({ source, suite }) =>
    GoalMergeTimeInventory.make({
      source,
      ruleSuiteId: suite.id,
      ref: suite.ref,
      afterSha: suite.after_sha,
      pushedAt: suite.pushed_at,
      result: suite.result,
      ruleSources: A.map(resolved, (row) => row.source),
    })
  );
  if (A.isReadonlyArrayEmpty(versions) && O.isNone(inventory))
    return GoalMergeTimeEvidence.make({ requiredChecks: O.none(), facts: [] });
  const contexts = A.dedupe(A.flatMap(versions, (version) => version.contexts));
  return GoalMergeTimeEvidence.make({
    requiredChecks: O.some(
      GoalRequiredCheckSnapshot.make({
        contexts,
        sources: A.map(versions, (version) => version.source),
        effectiveAt: mergedAt,
        inventoryComplete: O.isSome(inventory) && A.isReadonlyArrayEmpty(gaps),
        rulesetReadsComplete: readsComplete,
        mergeTimeInventory: inventory,
        gaps,
      })
    ),
    facts: goalRequiredCheckFacts({ contexts, checkRuns: request.checkRuns, head: acceptedHead, mergedAt }),
  });
});

type MergeTimeEvidenceServices = Effect.Services<ReturnType<typeof observeGoalMergeTimeEvidence>>;

/**
 * Live merge-time evidence provider over the existing `gh` REST adapter and {@link GoalCompletionIo} port.
 *
 * **Example** (Provide the live provider)
 *
 * ```ts
 * import { GoalMergeTimeEvidenceProviderLive } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof GoalMergeTimeEvidenceProviderLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GoalMergeTimeEvidenceProviderLive = Layer.effect(
  GoalMergeTimeEvidenceProvider,
  Effect.contextWith((context: Context.Context<MergeTimeEvidenceServices>) =>
    Effect.succeed(
      GoalMergeTimeEvidenceProvider.of({
        observe: Effect.fn("GoalMergeTimeEvidenceProvider.observe")((root, request) =>
          observeGoalMergeTimeEvidence(root, request).pipe(Effect.provideContext(context))
        ),
      })
    )
  )
);

/**
 * Resolves the provided merge-time evidence provider, or the live provider when none is provided.
 *
 * **Example** (Inspect the provider resolver)
 *
 * ```ts
 * import { readGoalMergeTimeEvidence } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalMergeTimeEvidence)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalMergeTimeEvidence = Effect.fn("Goals.CompletionEvidence.read")(function* (
  root: string,
  request: GoalMergeTimeEvidenceRequest
) {
  const provider = yield* Effect.serviceOption(GoalMergeTimeEvidenceProvider);
  return yield* O.isSome(provider)
    ? provider.value.observe(root, request)
    : observeGoalMergeTimeEvidence(root, request);
});
