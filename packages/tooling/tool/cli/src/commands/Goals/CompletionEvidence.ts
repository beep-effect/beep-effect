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

import { Git } from "@beep/git/Git";
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubContent } from "@beep/github/GitHubContent";
import { Repo } from "@beep/github/Repo";
import { ReviewThread } from "@beep/github/ReviewThread";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Cache from "effect/Cache";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  GithubClientRequest,
  layerGithubClientFor,
  layerGithubRepoFor,
  selectGithubIdentity,
} from "../../internal/github/GithubIdentity.ts";
import { rulesetRequiredContextsFromRules, YeetRulesetRulesPayload } from "../Yeet/internal/Settle.ts";
import { YeetCommandError } from "../Yeet/Yeet.errors.ts";
import {
  GoalCompletionCheckPages,
  GoalCompletionCommit,
  GoalCompletionPull,
  GoalCompletionRuleSuite,
  GoalCompletionRuleSuiteList,
  GoalCompletionRulesetHistory,
  GoalCompletionRulesetList,
  GoalCompletionRulesetListEntry,
  GoalCompletionRulesetVersion,
  GoalCompletionSuitePages,
  GoalCompletionTimelinePages,
  GoalMergeTimeEvidence,
} from "./CompletionEvidence.schemas.ts";
import { GoalCompletionIo, GoalMergeTimeEvidenceProvider } from "./CompletionEvidence.service.ts";
import {
  GoalAttributedRedFact,
  GoalCheckConclusion,
  GoalCompletionEvidenceGap,
  GoalCompletionEvidenceUnknown,
  GoalCompletionEvidenceUnsatisfied,
  GoalCompletionEvidenceVerified,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  goalClaimSourceRank,
} from "./Goals.schemas.ts";
import type * as Context from "effect/Context";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  GoalCompletionEvidenceInput,
  GoalMergeTimeEvidenceRequest,
  GoalObservedCheckRun,
} from "./CompletionEvidence.schemas.ts";
import type {
  GoalCompletionEvidenceVerdict,
  GoalCompletionOutcome,
  GoalRedAttributionClaim,
  GoalRuleSourceHistory,
} from "./Goals.schemas.ts";

const decodeObservation =
  <Schema extends S.Top & { readonly DecodingServices: never }>(schema: Schema) =>
  (value: unknown) =>
    S.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "Invalid goal completion GitHub payload" }))
    );

/**
 * Resolve typed completion reads from a fixture port or the git and GitHub kits.
 *
 * **Example** (Inspect the reader factory)
 *
 * ```ts
 * import { goalCompletionIo } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof goalCompletionIo)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const goalCompletionIo = Effect.fn("Goals.Completion.io")(function* () {
  const supplied = yield* Effect.serviceOption(GoalCompletionIo);
  if (O.isSome(supplied)) return supplied.value;
  const context = yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner>();
  const error = () => YeetCommandError.make({ message: "goal completion GitHub observation: read failed" });
  // Each read owns its scope: the returned port accepts roots later and outlives this factory.
  // The same precedence as Yeet: `BEEP_GH_TOKEN_REF`, then the GitHub App, then the gh login. A host
  // whose `gh` refuses `gh auth token` reaches GitHub through the 1Password reference.
  const github = <A, E>(root: string, read: Effect.Effect<A, E, GitHubClient | Repo>) =>
    Effect.flatMap(
      Effect.flatMap(selectGithubIdentity(O.none()), (identity) =>
        Layer.build(
          Layer.mergeAll(
            layerGithubClientFor(GithubClientRequest.make({ identity, cwd: root }), { retry: "off" }),
            layerGithubRepoFor(root)
          )
        )
      ),
      (services) => Effect.provideContext(read, services)
    ).pipe(Effect.scoped, Effect.provideContext(context), Effect.mapError(error));
  const read = <A, I>(
    root: string,
    operation: (client: GitHubClient["Service"], at: { owner: string; repo: string }) => Effect.Effect<A, I>
  ) =>
    github(
      root,
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        const repo = yield* Repo;
        return yield* operation(client, { owner: repo.owner, repo: repo.repo });
      })
    );
  const gitRead = <A, E>(operation: (git: Git["Service"]) => Effect.Effect<A, E>) =>
    Effect.flatMap(Git, operation).pipe(
      Effect.provideServiceEffect(Git, Git.make),
      Effect.provideContext(context),
      Effect.mapError(() => YeetCommandError.make({ message: "Goal completion git read failed" }))
    );
  return GoalCompletionIo.of({
    manifestAtHead: Effect.fn("GoalCompletionIo.manifestAtHead")((root, head, path) =>
      gitRead((git) => git.show(root, head, path))
    ),
    originUrl: Effect.fn("GoalCompletionIo.originUrl")((root) => gitRead((git) => git.remoteUrl(root))),
    hostedManifest: Effect.fn("GoalCompletionIo.hostedManifest")((root, head, path) =>
      github(
        root,
        Effect.flatMap(Layer.build(GitHubContent.layer), (services) =>
          Effect.provideContext(
            Effect.flatMap(GitHubContent, (content) => content.getFileOption(path, { ref: head })),
            services
          )
        ).pipe(Effect.scoped)
      )
    ),
    pullRequest: Effect.fn("GoalCompletionIo.pullRequest")((root, number) =>
      read(root, (client, at) =>
        client
          .requestDecoded(
            "GET /repos/{owner}/{repo}/pulls/{pull_number}",
            { ...at, pull_number: number },
            GoalCompletionPull
          )
          .pipe(Effect.map(GoalCompletionPull.make))
      )
    ),
    commit: Effect.fn("GoalCompletionIo.commit")((root, sha) =>
      read(root, (client, at) =>
        client
          .requestDecoded("GET /repos/{owner}/{repo}/commits/{ref}", { ...at, ref: sha }, GoalCompletionCommit)
          .pipe(Effect.map(GoalCompletionCommit.make))
      )
    ),
    checkRuns: Effect.fn("GoalCompletionIo.checkRuns")((root, sha) =>
      read(root, (client, at) =>
        client
          .paginate("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
            ...at,
            ref: sha,
            filter: "all",
            per_page: 100,
          })
          .pipe(Effect.map((check_runs) => [{ check_runs }]))
      ).pipe(Effect.flatMap(decodeObservation(GoalCompletionCheckPages)))
    ),
    timeline: Effect.fn("GoalCompletionIo.timeline")((root, number) =>
      read(root, (client, at) =>
        client
          .paginate("GET /repos/{owner}/{repo}/issues/{issue_number}/timeline", {
            ...at,
            issue_number: number,
            per_page: 100,
          })
          .pipe(Effect.map((rows) => [rows]))
      ).pipe(Effect.flatMap(decodeObservation(GoalCompletionTimelinePages)))
    ),
    checkSuites: Effect.fn("GoalCompletionIo.checkSuites")((root, sha) =>
      read(root, (client, at) =>
        client
          .paginate("GET /repos/{owner}/{repo}/commits/{ref}/check-suites", { ...at, ref: sha, per_page: 100 })
          .pipe(Effect.map((check_suites) => [{ check_suites }]))
      ).pipe(Effect.flatMap(decodeObservation(GoalCompletionSuitePages)))
    ),
    rulesetHistory: Effect.fn("GoalCompletionIo.rulesetHistory")((root, id) =>
      read(root, (client, at) =>
        client
          .paginate("GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history", { ...at, ruleset_id: id, per_page: 100 })
          .pipe(Effect.map((rows) => [rows]))
      ).pipe(Effect.flatMap(decodeObservation(GoalCompletionRulesetHistory)))
    ),
    rulesetVersion: Effect.fn("GoalCompletionIo.rulesetVersion")((root, id, version) =>
      read(root, (client, at) =>
        client
          .requestDecoded(
            "GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}",
            { ...at, ruleset_id: id, version_id: version },
            GoalCompletionRulesetVersion
          )
          .pipe(Effect.map(GoalCompletionRulesetVersion.make))
      )
    ),
    ruleSuites: Effect.fn("GoalCompletionIo.ruleSuites")((root, ref) =>
      read(root, (client, at) =>
        client
          .paginate("GET /repos/{owner}/{repo}/rulesets/rule-suites", {
            ...at,
            ref,
            time_period: "month",
            per_page: 100,
          })
          .pipe(Effect.map((rows) => [rows]))
      ).pipe(Effect.flatMap(decodeObservation(GoalCompletionRuleSuiteList)))
    ),
    ruleSuite: Effect.fn("GoalCompletionIo.ruleSuite")((root, id) =>
      read(root, (client, at) =>
        client
          .requestDecoded(
            "GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}",
            { ...at, rule_suite_id: id },
            GoalCompletionRuleSuite
          )
          .pipe(Effect.map(GoalCompletionRuleSuite.make))
      )
    ),
    rulesets: Effect.fn("GoalCompletionIo.rulesets")((root) =>
      read(root, (client, at) =>
        client
          .paginate("GET /repos/{owner}/{repo}/rulesets", { ...at, includes_parents: true, per_page: 100 })
          .pipe(Effect.map((rows) => [rows]))
      ).pipe(Effect.flatMap(decodeObservation(GoalCompletionRulesetList)))
    ),
    reviewThreads: Effect.fn("GoalCompletionIo.reviewThreads")((root, number) =>
      github(
        root,
        Effect.flatMap(Layer.build(ReviewThread.layer), (services) =>
          Effect.provideContext(
            ReviewThread.use((threads) => threads.list(number)),
            services
          )
        ).pipe(Effect.scoped)
      )
    ),
  });
});

// The listing key joins the checkout root and ref with a NUL, which neither a
// path nor a git ref can contain.
const RULE_SUITES_KEY_SEPARATOR = "\u0000";

/**
 * Wraps a completion port so each `ruleSuites` listing is read once per root and ref.
 *
 * **Details**
 *
 * One command run observes many packets that share a base branch, and each
 * listing pages a month of rule suites. A successful listing is kept for the
 * life of the returned port; a failed one is not kept, so the next call reads
 * again. Every other read passes through unchanged.
 *
 * **Example** (Memoize a port's rule-suite listing)
 *
 * ```ts
 * import { goalCompletionIo, memoizeGoalCompletionRuleSuites } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * import * as Effect from "effect/Effect"
 *
 * const port = Effect.flatMap(goalCompletionIo(), memoizeGoalCompletionRuleSuites)
 * console.log(Effect.isEffect(port)) // true
 * ```
 *
 * @param port - The completion port whose listing reads are memoized.
 * @returns The same port with a memoized `ruleSuites`.
 * @category combinators
 * @since 0.0.0
 */
export const memoizeGoalCompletionRuleSuites = Effect.fn("Goals.CompletionEvidence.memoizeRuleSuites")(function* (
  port: GoalCompletionIo["Service"]
) {
  const listings = yield* Cache.makeWith(
    (key: string) => {
      const parts = Str.split(key, RULE_SUITES_KEY_SEPARATOR);
      return port.ruleSuites(A.headNonEmpty(parts), A.lastNonEmpty(parts));
    },
    {
      capacity: 64,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
    }
  );
  return GoalCompletionIo.of({
    ...port,
    ruleSuites: Effect.fn("GoalCompletionIo.ruleSuites")((root, ref) =>
      Cache.get(listings, `${root}${RULE_SUITES_KEY_SEPARATOR}${ref}`)
    ),
  });
});

/**
 * The completion port for one command run: a provided port or the live kits, with memoized rule-suite listings.
 *
 * **Details**
 *
 * Provide it once around a whole run. A port already provided outside the run
 * (a test fixture) is the one it wraps.
 *
 * **Example** (Provide the run's completion port)
 *
 * ```ts
 * import { GoalCompletionIoLive } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(GoalCompletionIoLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GoalCompletionIoLive: Layer.Layer<GoalCompletionIo, never, ChildProcessSpawner.ChildProcessSpawner> =
  Layer.effect(GoalCompletionIo, Effect.flatMap(goalCompletionIo(), memoizeGoalCompletionRuleSuites));

/**
 * Read one decoded observation through the typed completion port.
 *
 * **Example** (Inspect the typed reader)
 *
 * ```ts
 * import { readGoalCompletion } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalCompletion)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCompletion = Effect.fn("Goals.Completion.read")(function* <A>(
  root: string,
  read: (io: GoalCompletionIo["Service"], root: string) => Effect.Effect<A, YeetCommandError>
) {
  const io = yield* goalCompletionIo();
  return yield* read(io, root);
});

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
  state: GoalCompletionRulesetVersion["state"],
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
  ruleset: GoalCompletionRulesetListEntry,
  base: string,
  mergedAt: DateTime.Utc
) {
  if (ruleset.source_type !== "Repository")
    return yield* YeetCommandError.make({
      message: "Inherited ruleset history is unavailable through the repository-only adapter",
    });
  const pages = yield* readGoalCompletion(root, (io, root) => io.rulesetHistory(root, ruleset.id));
  const history = A.flatten(pages);
  const version = A.reduce(
    A.filter(history, (row) => DateTime.toEpochMillis(row.updated_at) <= DateTime.toEpochMillis(mergedAt)),
    O.none<GoalCompletionRulesetHistory[number][number]>(),
    (found, row) =>
      O.isNone(found) || DateTime.isGreaterThan(row.updated_at, found.value.updated_at) ? O.some(row) : found
  );
  if (O.isNone(version)) {
    if (ruleset.created_at !== undefined && DateTime.isGreaterThan(ruleset.created_at, mergedAt)) return O.none();
    return yield* YeetCommandError.make({ message: "No historical ruleset version covers this merge" });
  }
  const source = `repos/{owner}/{repo}/rulesets/${ruleset.id}/history/${version.value.version_id}`;
  const { state } = yield* readGoalCompletion(root, (io, root) =>
    io.rulesetVersion(root, ruleset.id, version.value.version_id)
  );
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
  found: S.Option(S.Struct({ source: S.NonEmptyString, suite: GoalCompletionRuleSuite })),
  gap: S.Option(GoalCompletionEvidenceGap),
});

// GitHub lists rule suites for the last month at most.
const RULE_SUITE_LISTING_DAYS = 31;

// An older merge push has no listed suite and stays rule-suite-unavailable
// rather than being guessed; past the listing window the listing is not read.
const readMergeRuleSuite = Effect.fn("Goals.CompletionEvidence.ruleSuite")(function* (
  root: string,
  base: string,
  mergeCommit: string,
  mergedAt: DateTime.Utc
) {
  const now = yield* DateTime.now;
  if (DateTime.isGreaterThan(now, DateTime.add(mergedAt, { days: RULE_SUITE_LISTING_DAYS })))
    return SuiteLookup.make({ found: O.none(), gap: O.some("rule-suite-unavailable") });
  const ref = `refs/heads/${base}`;
  const pages = yield* readGoalCompletion(root, (io, root) => io.ruleSuites(root, ref));
  const listed = A.flatten(pages);
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
  const suite = yield* readGoalCompletion(root, (io, root) => io.ruleSuite(root, only.value));
  return SuiteLookup.make({ found: O.some({ source, suite }), gap: O.none() });
});

const successful = (conclusion: GoalCheckConclusion): boolean =>
  conclusion === "success" || conclusion === "neutral" || conclusion === "skipped";

// Binds each required context to the newest run on the accepted head when the
// facts are read, whenever that run started or finished. Newer runs (higher
// check-run id) supersede older ones, so any rerun replaces an older result,
// before or after the merge. A run not yet completed is pending and unknown; a
// context with no run on the head is unknown.
const goalRequiredCheckFacts = ({
  contexts,
  checkRuns,
  head,
}: {
  readonly contexts: ReadonlyArray<string>;
  readonly checkRuns: ReadonlyArray<GoalObservedCheckRun>;
  readonly head: string;
}): ReadonlyArray<GoalRequiredCheckFact> =>
  A.map(A.dedupe(A.filter(contexts, Str.isNonEmpty)), (context) => {
    const newest = A.reduce(
      A.filter(checkRuns, (run) => run.name === context && run.head_sha === head),
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
        const completed = run.status === "completed";
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

const ClaimStrength = Order.mapInput(Order.Number, (claim: GoalRedAttributionClaim) =>
  goalClaimSourceRank(claim.source)
);

const claimValue = (claim: GoalRedAttributionClaim): string => `${claim.attribution}#${claim.fixPullRequest}`;

// One claim per context. Claims that agree collapse to the strongest source;
// claims that disagree leave the context unattributed (fail closed).
const attributionsByContext = (
  claims: ReadonlyArray<GoalRedAttributionClaim>
): HashMap.HashMap<string, GoalRedAttributionClaim> =>
  HashMap.fromIterable(
    A.getSomes(
      A.map(R.values(A.groupBy(claims, (claim) => claim.context)), (group) =>
        A.length(A.dedupe(A.map(group, claimValue))) === 1
          ? O.some([A.headNonEmpty(group).context, A.headNonEmpty(A.sort(group, ClaimStrength))] as const)
          : O.none()
      )
    )
  );

// The fact a claim attributes for one context: a head-bound red, or, when no
// run on the head ever reported, the context's missing fact. A pending run is
// neither, so it is never attributed.
const attributedRedOf = (
  facts: ReadonlyArray<GoalRequiredCheckFact>,
  claim: O.Option<GoalRedAttributionClaim>
): O.Option<GoalAttributedRedFact> =>
  O.flatMap(claim, (claim) =>
    O.map(
      O.orElse(
        A.findFirst(facts, (fact) => fact.outcome === "unsatisfied"),
        () => (A.every(facts, (fact) => O.isNone(fact.checkRunId)) ? A.head(facts) : O.none())
      ),
      (fact) =>
        GoalAttributedRedFact.make({
          context: fact.context,
          checkRunId: fact.checkRunId,
          conclusion: O.isNone(fact.checkRunId) ? "unknown" : fact.conclusion,
          observed: O.isNone(fact.checkRunId) ? "missing" : "red",
          attribution: claim.attribution,
          fixPullRequest: claim.fixPullRequest,
          decisionFile: claim.decisionFile,
          source: claim.source,
        })
    )
  );

/**
 * Decides merge-time completion evidence without IO: verified only when every required context is green or attributed.
 *
 * **Details**
 *
 * A head-bound required red that no claim in `redAttributions` covers is
 * `unsatisfied` even when other evidence is missing. A claim covers a red, or a
 * required context that never reported a run on the accepted head, with the
 * same context; two claims that disagree about one context cover nothing. A
 * context whose run is still pending is neither red nor missing, so a claim
 * cannot cover it. GitHub's failed required-status-checks evaluation in the
 * merge-push rule suite (a bypass merge) is not a red by itself: the verdict
 * records it as `ruleSuiteBypassed`. A recovered evaluate-mode version does
 * not gate; a recovered inactive or non-matching version contradicts the
 * merge-push rule suite and is an `inventory-mismatch`, so the outcome is
 * `unknown`. Otherwise any gap is `unknown`, attributions or not: no
 * inventory, no rule suite for the merge commit, a rule suite bound to another
 * commit, partial ruleset reads, a required-check source with no recovered
 * history version (deleted or unsupported), stored provider gaps, no required
 * contexts, or a context neither green nor attributed on the accepted head.
 * Completeness is re-derived from the stored rule suite; the
 * `inventoryComplete` flag alone never verifies.
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
 * @param input - Accepted head, merge commit, stored inventory, head-bound facts and red attributions.
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
  const claims = attributionsByContext(input.redAttributions);
  const reds = A.filter(relevant, (fact) => fact.outcome === "unsatisfied" && headBound(fact));
  const unattributed = A.filter(reds, (fact) => !HashMap.has(claims, fact.context));
  const boundSources = O.match(boundInventory, {
    onNone: A.empty<GoalMergeTimeRuleSource>,
    onSome: (value) => value.ruleSources,
  });
  // Active at push: GitHub's own failed evaluation, recorded but not a red by itself.
  const activeRed = A.some(
    boundSources,
    (source) => source.enforcement === "active" && source.history !== "not-gating" && failedRequiredChecks(source)
  );
  // Deleted since merge, with history showing it gated the merge: also a bypass.
  const recoveredRed = A.some(
    boundSources,
    (source) => source.enforcement === "deleted ruleset" && source.history === "gating" && failedRequiredChecks(source)
  );
  if (A.isReadonlyArrayNonEmpty(unattributed))
    return GoalCompletionEvidenceUnsatisfied.make({ reds: unattributed, ruleSuiteRed: activeRed });
  const headFacts = (context: string): ReadonlyArray<GoalRequiredCheckFact> =>
    A.filter(relevant, (fact) => fact.context === context && headBound(fact));
  const attributedReds = A.getSomes(
    A.map(A.dedupe(contexts), (context) => attributedRedOf(headFacts(context), HashMap.get(claims, context)))
  );
  const covered = (context: string): boolean =>
    A.some(headFacts(context), (fact) => fact.outcome === "verified") ||
    A.some(attributedReds, (red) => red.context === context);
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
        ...(A.isReadonlyArrayEmpty(contexts) || !A.every(contexts, covered)
          ? A.of<GoalCompletionEvidenceGap>("required-check-unobserved")
          : []),
      ]),
  });
  // Gaps win over attributions: without the inventory nobody knows which contexts were required.
  if (A.isReadonlyArrayNonEmpty(gaps)) return GoalCompletionEvidenceUnknown.make({ gaps });
  // No gap means contexts is non-empty and each has a green or attributed head
  // fact, so `relevant` is non-empty; the verified schema enforces that minimum.
  return GoalCompletionEvidenceVerified.make({
    facts: relevant,
    attributedReds,
    ruleSuiteBypassed: activeRed || recoveredRed,
  });
};

const describeAttributedRed = (red: GoalAttributedRedFact): string =>
  `${red.context} (${red.observed === "missing" ? "never reported, " : ""}${red.attribution}, fix #${red.fixPullRequest}, ${red.decisionFile})`;

const describeVerified = (value: GoalCompletionEvidenceVerified): string => {
  const green = A.length(A.filter(value.facts, (fact) => fact.outcome === "verified"));
  const attributed = A.isReadonlyArrayNonEmpty(value.attributedReds)
    ? `; attributed: ${A.join(A.map(value.attributedReds, describeAttributedRed), "; ")}`
    : "";
  const bypassed = value.ruleSuiteBypassed ? "; bypassed: the merge-push rule suite failed required status checks" : "";
  return `Merge-time evidence verified: complete rule-suite inventory and ${green} green required contexts at the accepted head${attributed}${bypassed}.`;
};

/**
 * Describes a completion-evidence verdict in one line for receipts and doctor output.
 *
 * **Details**
 *
 * A verified verdict lists every attributed red with its cause, fix PR and
 * decision file, and says `bypassed` when the merge-push rule suite failed
 * its required-status-checks evaluation.
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
    verified: describeVerified,
    unsatisfied: (value) =>
      `Merge-time evidence unsatisfied: ${A.length(value.reds)} unattributed required red(s) at the accepted head${value.ruleSuiteRed ? "; the merge-push rule suite failed required status checks" : ""}.`,
    unknown: (value) => `Merge-time evidence unknown: ${A.join(value.gaps, ", ")}.`,
  });

const ruleSourcesOf = (
  suite: GoalCompletionRuleSuite,
  surviving: ReadonlyArray<number>
): ReadonlyArray<GoalMergeTimeRuleSource> => {
  const keyOf = (evaluation: GoalCompletionRuleSuite["rule_evaluations"][number]): string =>
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
 * evaluate, or the reverse, is `inventory-mismatch`. GitHub lists rule suites
 * for one month, so a merge older than 31 days skips the listing and records
 * `rule-suite-unavailable`. Each required context binds to the newest run on
 * the accepted head at read time, whether it ran before or after the merge.
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
  const listed = yield* readGoalCompletion(root, (io, root) => io.rulesets(root)).pipe(
    Effect.map(A.flatten),
    Effect.option
  );
  const current = O.getOrElse(listed, A.empty<GoalCompletionRulesetListEntry>);
  const reads = yield* Effect.forEach(
    current,
    Effect.fn("Goals.CompletionEvidence.survivingRuleset")(function* (ruleset) {
      const read: O.Option<HistoricalRead> = yield* readHistoricalRuleset(root, ruleset, base, mergedAt).pipe(
        Effect.option
      );
      return { ruleset, read };
    })
  );
  const lookup = yield* readMergeRuleSuite(root, base, mergeCommit, mergedAt).pipe(
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
      const history = yield* readHistoricalRuleset(
        root,
        GoalCompletionRulesetListEntry.make({ id, source_type: "Repository" }),
        base,
        mergedAt
      ).pipe(Effect.option);
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
    facts: goalRequiredCheckFacts({ contexts, checkRuns: request.checkRuns, head: acceptedHead }),
  });
});

type MergeTimeEvidenceServices = Effect.Services<ReturnType<typeof observeGoalMergeTimeEvidence>>;

/**
 * Live merge-time evidence provider over the typed GitHub kit observations and {@link GoalCompletionIo} port.
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
