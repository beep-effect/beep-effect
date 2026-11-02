/**
 * Human-authenticated, lossless ruleset updates and source-bound merge checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GitHubClient } from "@beep/github/GitHubClient";
import { PageOptions } from "@beep/github/Rest";
import { $RepoCliId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GithubClientRequest, GithubIdentity, layerGithubClientFor } from "../../internal/github/GithubIdentity.ts";
import { ReviewerError } from "./ReviewerErrors.ts";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ReviewerChangedFile } from "./ReviewerModels.ts";

const $I = $RepoCliId.create("commands/Reviewer/ReviewerRuleset.service");
const ROOT = "repos/beep-effect/beep-effect";
const REPO = { owner: "beep-effect", repo: "beep-effect" } as const;
const UnknownJson = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(UnknownJson);
const ObjectRecord = S.Record(S.String, S.Unknown);
const decodeObject = S.decodeUnknownEffect(ObjectRecord);
const decodeObjects = S.decodeUnknownEffect(S.Array(ObjectRecord));
class RequiredCheck extends S.Class<RequiredCheck, { readonly brand: unique symbol }>($I`RequiredCheck`)(
  { context: S.String, integration_id: S.Int.pipe(S.NullOr, S.optionalKey) },
  $I.annote("RequiredCheck", { description: "Required check and trusted App identity." })
) {}
const decodeRequired = S.decodeUnknownEffect(S.Array(RequiredCheck));
class Rule extends S.Class<Rule, { readonly brand: unique symbol }>($I`Rule`)(
  { type: S.String, parameters: S.optionalKey(ObjectRecord) },
  $I.annote("Rule", { description: "Effective branch rule." })
) {}
const decodeRules = S.decodeUnknownEffect(S.Array(Rule));
class Repository extends S.Class<Repository, { readonly brand: unique symbol }>($I`Repository`)(
  { default_branch: S.String },
  $I.annote("Repository", { description: "Repository default branch." })
) {}
const decodeRepo = S.decodeUnknownEffect(Repository);
class RuleSummary extends S.Class<RuleSummary, { readonly brand: unique symbol }>($I`RuleSummary`)(
  { id: S.Int, source_type: S.String, enforcement: S.String },
  $I.annote("RuleSummary", { description: "Ruleset source and activation." })
) {}
const decodeSummaries = S.decodeUnknownEffect(S.Array(RuleSummary));
const decodeLogin = S.decodeUnknownEffect(S.Struct({ login: S.String }));
class BranchRule extends S.Class<BranchRule, { readonly brand: unique symbol }>($I`BranchRule`)(
  { type: S.String, ruleset_id: S.Int, parameters: S.optionalKey(ObjectRecord) },
  $I.annote("BranchRule", { description: "Effective rule with originating ruleset." })
) {}
const decodeBranchRules = S.decodeUnknownEffect(S.Array(BranchRule));
class Check extends S.Class<Check, { readonly brand: unique symbol }>($I`Check`)(
  {
    id: S.Int,
    name: S.String,
    head_sha: S.String,
    status: S.String,
    conclusion: S.NullOr(S.String),
    app: S.Struct({ id: S.Int }),
    external_id: S.NullOr(S.String),
  },
  $I.annote("Check", { description: "A check's source identity and head." })
) {}
const decodeChecks = S.decodeUnknownEffect(S.Array(Check));
class PrHead extends S.Class<PrHead, { readonly brand: unique symbol }>($I`PrHead`)(
  { head: S.Struct({ sha: S.String }), base: S.Struct({ ref: S.String, sha: S.String }) },
  $I.annote("PrHead", { description: "Live pull request head and target branch." })
) {}
const decodePr = S.decodeUnknownEffect(PrHead);
/**
 * Check-run association to one PR, head revision, and base revision.
 *
 * **Example** (Decode a reviewer association)
 * ```ts
 * import { ReviewerCheckExternalId } from "@beep/repo-cli/commands/Reviewer";
 * import * as S from "effect/Schema";
 * console.log(S.is(ReviewerCheckExternalId)(`pr-7-${"a".repeat(40)}-${"b".repeat(40)}`)); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewerCheckExternalId = S.TemplateLiteralParser([
  "pr-",
  S.NumberFromString.check(S.isInt(), S.isGreaterThan(0)),
  "-",
  S.String.check(S.isPattern(/^[a-f0-9]{40}$/)),
  "-",
  S.String.check(S.isPattern(/^[a-f0-9]{40}$/)),
]).pipe(
  $I.annoteSchema("ReviewerCheckExternalId", {
    description: "Reviewer check association to a PR and exact head/base revisions.",
  })
);

/**
 * Encode the identity a reviewer check must carry to satisfy its PR gate.
 *
 * **Example** (Bind a check to the reviewed diff)
 * ```ts
 * import { reviewerCheckExternalId } from "@beep/repo-cli/commands/Reviewer";
 * console.log(reviewerCheckExternalId(7, "a".repeat(40), "b".repeat(40)).startsWith("pr-7-")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const reviewerCheckExternalId: {
  (sha: string, baseSha: string): (pr: number) => string;
  (pr: number, sha: string, baseSha: string): string;
} = dual(3, (pr: number, sha: string, baseSha: string): string => `pr-${pr}-${sha}-${baseSha}`);
const DocumentationPath = S.String.check(
  S.isPattern(
    /^(?!.*(?:^|\/)(?:\.[^/]+|__tests__|__fixtures__|tests?|fixtures?)(?:\/|$))(?!.*(?:^|\/)(?:AGENTS|CLAUDE|GEMINI|SKILL)\.md$)(?:docs\/.+\.(?:md|mdx|rst|txt)|(?:[^/]+\/)*README(?:[.-][^/]*)?\.md)$/i
  )
).pipe(
  $I.annoteSchema("DocumentationPath", { description: "Documentation paths outside agent and workflow configuration." })
);
const isDocumentationPath = S.is(DocumentationPath);
const fail = (message: string) => ReviewerError.make({ operation: "ruleset", message });

const ghFailure = () => fail("gh request failed; no response body was retained in the error.");

/**
 * The operator's `gh` login as a `@beep/github` client, for ruleset administration and the merge gate.
 *
 * **Details**
 *
 * Always the `gh-cli` identity (`gh auth token`, read through `@beep/commands`
 * `Run`): ruleset administration must speak as the human account that holds
 * repository administration, so neither `BEEP_GH_TOKEN_REF` nor an App
 * identity may replace it. A token that cannot be read fails with the same
 * sanitized `ReviewerError` a failed `gh` call reported.
 *
 * **Example** (Inspect the operator client layer)
 * ```ts
 * import { reviewerOperatorClient } from "@beep/repo-cli/commands/Reviewer";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(reviewerOperatorClient(process.cwd())));
 * ```
 *
 * @param cwd - Working directory for the `gh auth token` child process.
 * @returns A layer providing the operator's `GitHubClient`.
 * @category layers
 * @since 0.0.0
 */
export const reviewerOperatorClient = (
  cwd: string
): Layer.Layer<GitHubClient, ReviewerError, ChildProcessSpawner.ChildProcessSpawner> =>
  layerGithubClientFor(
    GithubClientRequest.make({
      identity: GithubIdentity.make({
        kind: "gh-cli",
        tokenRef: O.none(),
        appId: O.none(),
        installationId: O.none(),
        privateKeyRef: O.none(),
      }),
      cwd,
    })
  ).pipe(Layer.catchTag("GithubIdentityError", () => Layer.effect(GitHubClient, Effect.fail(ghFailure()))));

/**
 * Runs a gate or ruleset program with {@link reviewerOperatorClient} built for its own scope.
 *
 * **Details**
 *
 * For callers outside the `reviewer` command tree (Yeet's merge paths), which
 * hold no `GitHubClient` of their own for the operator login.
 *
 * **Example** (Gate a merge as the operator)
 * ```ts
 * import { enforceReviewerGate, withReviewerOperatorClient } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * const gated = enforceReviewerGate(123, "a".repeat(40)).pipe(withReviewerOperatorClient(process.cwd()));
 * console.log(Effect.isEffect(gated));
 * ```
 *
 * @param cwd - Working directory for the `gh auth token` child process.
 * @returns A function providing the operator client to a program.
 * @category layers
 * @since 0.0.0
 */
export const withReviewerOperatorClient =
  (cwd: string) =>
  <A, E, R>(
    program: Effect.Effect<A, E, R | GitHubClient>
  ): Effect.Effect<A, E | ReviewerError, Exclude<R, GitHubClient> | ChildProcessSpawner.ChildProcessSpawner> =>
    Effect.flatMap(Layer.build(reviewerOperatorClient(cwd)), (context) => Effect.provideContext(program, context)).pipe(
      Effect.scoped
    );

const api = Effect.fn("Reviewer.ghApi")(function* (path: string) {
  return yield* GitHubClient.use((client) => client.requestDecoded(`GET /${path}`, {}, S.Unknown)).pipe(
    Effect.mapError(() => fail("Cannot read GitHub administration data."))
  );
});

// Rewrites only the beep-reviewer entry; every other rule, parameter, and bypass actor is preserved.
const rewriteReviewerChecks = Effect.fnUntraced(function* (
  value: unknown,
  reviewer: ReadonlyArray<typeof RequiredCheck.Encoded>
) {
  const original = yield* decodeObject(value);
  const rules = yield* decodeObjects(original.rules);
  const target = A.filter(rules, (rule) => rule.type === "required_status_checks");
  if (target.length !== 1)
    return yield* fail("Expected exactly one required_status_checks rule; refusing an ambiguous update.");
  const updated = yield* Effect.forEach(
    rules,
    Effect.fn("Reviewer.updateRule")(function* (rule) {
      if (rule.type !== "required_status_checks") return rule;
      const parameters = yield* decodeObject(rule.parameters);
      const checks = yield* decodeObjects(parameters.required_status_checks);
      const others = A.filter(checks, (check) => check.context !== "beep-reviewer");
      return {
        ...rule,
        parameters: {
          ...parameters,
          required_status_checks: [...others, ...reviewer],
        },
      };
    })
  );
  return yield* decodeObject({ ...original, rules: updated });
});

/**
 * Adds one App-bound context while preserving all other rules, parameters, and bypass actors.
 *
 * **Example** (Retain unrelated settings)
 * ```ts
 * import { requireReviewerInRuleset } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(requireReviewerInRuleset({ rules: [] }, 42)));
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const requireReviewerInRuleset = Effect.fn("Reviewer.requireInRuleset")(
  (value: unknown, appId: number) =>
    rewriteReviewerChecks(value, [{ context: "beep-reviewer", integration_id: appId }]),
  Effect.mapError(() => fail("Cannot safely update this ruleset."))
);

/**
 * Removes the beep-reviewer context while preserving all other rules, parameters, and bypass actors.
 *
 * **Details**
 * Without the context, the shared merge gate is inactive and reviews become advisory.
 *
 * **Example** (Make the reviewer advisory)
 * ```ts
 * import { releaseReviewerInRuleset } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(releaseReviewerInRuleset({ rules: [] })));
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const releaseReviewerInRuleset = Effect.fn("Reviewer.releaseInRuleset")(
  (value: unknown) => rewriteReviewerChecks(value, []),
  Effect.mapError(() => fail("Cannot safely update this ruleset."))
);

// Selects the default branch's repository ruleset, prints the diff, and PUTs only on an explicit apply.
const updateReviewerRuleset = Effect.fnUntraced(function* (
  transform: (value: unknown) => Effect.Effect<typeof ObjectRecord.Type, ReviewerError>,
  apply: boolean,
  rulesetId: number | undefined
) {
  const client = yield* GitHubClient;
  const user = yield* client
    .requestDecoded("GET /user", {}, S.Unknown)
    .pipe(Effect.flatMap(decodeLogin), Effect.mapError(ghFailure));
  if (user.login !== "kriegcloud")
    return yield* fail("Ruleset administration must use Benjamin Oppold's gh login (kriegcloud).");
  const repo = yield* api(ROOT).pipe(Effect.flatMap(decodeRepo));
  const branchRules = yield* api(`${ROOT}/rules/branches/${encodeURIComponent(repo.default_branch)}`).pipe(
    Effect.flatMap(decodeBranchRules)
  );
  const listed = yield* client
    .paginate("GET /repos/{owner}/{repo}/rulesets", { ...REPO, includes_parents: true }, PageOptions.all)
    .pipe(Effect.mapError(ghFailure), Effect.flatMap(decodeSummaries));
  const candidates = A.filter(
    listed,
    (entry) =>
      entry.source_type === "Repository" &&
      entry.enforcement === "active" &&
      A.some(branchRules, (rule) => rule.ruleset_id === entry.id && rule.type === "required_status_checks") &&
      (rulesetId === undefined || entry.id === rulesetId)
  );
  if (candidates.length !== 1)
    return yield* fail(
      "Default branch has zero or multiple matching repository rulesets; select --ruleset-id explicitly."
    );
  const selected = A.head(candidates);
  if (O.isNone(selected)) return yield* fail("No ruleset selected.");
  const path = `${ROOT}/rulesets/${selected.value.id}`;
  const original = yield* api(path);
  const updated = yield* transform(original);
  const before = yield* encodeJson(original);
  const after = yield* encodeJson(updated);
  yield* Console.log(`--- ruleset ${selected.value.id}\n- ${before}\n+ ${after}`);
  if (!apply || before === after) return;
  if ((yield* api(path).pipe(Effect.flatMap(encodeJson))) !== before)
    return yield* fail("Ruleset changed during preview; rerun and inspect the new diff.");
  // PUT accepts only writable fields; the complete rules and bypass actors are preserved verbatim.
  // The PUT targets the previewed id: `Ruleset.upsert` re-resolves by name and
  // creates when the name is gone, which a concurrent rename must not trigger.
  yield* client
    .requestDecoded(
      "PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}",
      {
        ...REPO,
        ruleset_id: selected.value.id,
        name: updated.name,
        target: updated.target,
        enforcement: updated.enforcement,
        bypass_actors: updated.bypass_actors,
        conditions: updated.conditions,
        rules: updated.rules,
      },
      S.Unknown
    )
    .pipe(Effect.mapError(ghFailure));
});

/**
 * Prints a default-branch ruleset diff that requires the reviewer; only an explicit apply sends the PUT.
 *
 * **Details**
 * A ruleset id can disambiguate multiple active repository rulesets. Inherited organization rules
 * are never edited. A second read rejects concurrent edits before writing.
 *
 * **Example** (Compose a dry run)
 * ```ts
 * import { requireReviewerRuleset } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(requireReviewerRuleset(42, false, undefined)));
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const requireReviewerRuleset = Effect.fn("Reviewer.requireRuleset")(function* (
  appId: number,
  apply: boolean,
  rulesetId: number | undefined
) {
  return yield* updateReviewerRuleset((value) => requireReviewerInRuleset(value, appId), apply, rulesetId);
});

/**
 * Prints a default-branch ruleset diff that drops the reviewer requirement; only an explicit apply sends the PUT.
 *
 * **Details**
 * Use when the reviewer cannot run (for example, its model quota is exhausted). The merge gate
 * follows the ruleset, so `yeet merge` and `yeet merge-gate` stop waiting for a review once applied.
 * Restore enforcement with `beep reviewer ruleset require --apply`.
 *
 * **Example** (Compose a dry run)
 * ```ts
 * import { releaseReviewerRuleset } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(releaseReviewerRuleset(false, undefined)));
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const releaseReviewerRuleset = Effect.fn("Reviewer.releaseRuleset")(function* (
  apply: boolean,
  rulesetId: number | undefined
) {
  return yield* updateReviewerRuleset(releaseReviewerInRuleset, apply, rulesetId);
});

/**
 * Accepts only a successful completed check from the required App for this PR and exact head/base pair.
 *
 * **Example** (Reject a same-named check from another App)
 * ```ts
 * import { reviewerCheckSatisfied } from "@beep/repo-cli/commands/Reviewer";
 * console.log(reviewerCheckSatisfied([], "a".repeat(40), 42, 7, "b".repeat(40))); // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const reviewerCheckSatisfied: {
  (sha: string, appId: number, pr: number, baseSha: string): (checks: ReadonlyArray<typeof Check.Encoded>) => boolean;
  (checks: ReadonlyArray<typeof Check.Encoded>, sha: string, appId: number, pr: number, baseSha: string): boolean;
} = dual(
  5,
  (checks: ReadonlyArray<typeof Check.Encoded>, sha: string, appId: number, pr: number, baseSha: string): boolean => {
    const association = reviewerCheckExternalId(pr, sha, baseSha);
    const own = A.filter(
      checks,
      (check) =>
        check.name === "beep-reviewer" &&
        check.head_sha === sha &&
        check.app.id === appId &&
        check.external_id === association
    );
    const latest = A.reduce(own, O.none<typeof Check.Encoded>(), (previous, check) =>
      O.isNone(previous) || check.id > previous.value.id ? O.some(check) : previous
    );
    return O.isSome(latest) && latest.value.status === "completed" && latest.value.conclusion === "success";
  }
);

/**
 * Recognizes documentation-only paths conservatively, including both sides of a rename.
 *
 * **Example** (Classify documentation)
 * ```ts
 * import { reviewerDocsOnly } from "@beep/repo-cli/commands/Reviewer";
 * console.log(reviewerDocsOnly([{ filename: "docs/guide.md" }])); // true
 * console.log(reviewerDocsOnly([{ filename: "docs/guide.md", previous_filename: "src/code.ts" }])); // false
 * ```
 *
 * @param files - Complete changed-file list, including previous paths for renamed files.
 * @returns True only for a nonempty list whose current and previous paths all qualify as documentation.
 * @category predicates
 * @since 0.0.0
 */
export const reviewerDocsOnly = (files: ReadonlyArray<typeof ReviewerChangedFile.Encoded>) =>
  files.length > 0 &&
  A.every(
    files,
    (file) =>
      isDocumentationPath(file.filename) &&
      (file.previous_filename === undefined || isDocumentationPath(file.previous_filename))
  );

const requiredReviewerApp = Effect.fn("Reviewer.requiredApp")(function* (base: string) {
  const rules = yield* api(`${ROOT}/rules/branches/${encodeURIComponent(base)}`).pipe(Effect.flatMap(decodeRules));
  const required = yield* Effect.forEach(
    A.filter(rules, (rule) => rule.type === "required_status_checks"),
    (rule) => decodeRequired(rule.parameters?.required_status_checks)
  );
  const reviewers = A.filter(A.flatten(required), (check) => check.context === "beep-reviewer");
  if (reviewers.length === 0) return O.none<number>();
  const ids = A.dedupe(A.getSomes(A.map(reviewers, (check) => O.fromNullishOr(check.integration_id))));
  if (ids.length !== 1 || A.some(reviewers, (check) => check.integration_id == null))
    return yield* fail("beep-reviewer must be bound to exactly one integration_id.");
  const id = A.head(ids);
  if (O.isNone(id)) return yield* fail("Missing reviewer App id.");
  const configured = yield* Config.option(Config.Number("BEEP_REVIEWER_APP_ID"));
  if (O.isSome(configured) && configured.value !== id.value)
    return yield* fail("Configured reviewer App differs from the required ruleset App.");
  return O.some(id.value);
});
const readReviewerChecks = Effect.fn("Reviewer.readChecks")(function* (sha: string) {
  return yield* GitHubClient.use((client) =>
    client.paginate(
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
      { ...REPO, ref: sha, check_name: "beep-reviewer", filter: "all" },
      PageOptions.all
    )
  ).pipe(
    Effect.mapError(() => fail("Cannot read GitHub administration data.")),
    Effect.flatMap(decodeChecks)
  );
});

/**
 * Holds the fleet merge until the configured source-bound reviewer check succeeds on the current head.
 *
 * **Details**
 * Activation follows the effective branch ruleset, allowing provisioning before enforcement.
 * Once required, this gate remains mandatory even for Yeet's relaxed S11 merges.
 *
 * **Example** (Compose the head-pinned fleet gate)
 * ```ts
 * import { enforceReviewerGate } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(enforceReviewerGate(123, "a".repeat(40))));
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const enforceReviewerGate = Effect.fn("Reviewer.enforceGate")(
  function* (pr: number, sha: string) {
    const head = yield* api(`${ROOT}/pulls/${pr}`).pipe(Effect.flatMap(decodePr));
    if (head.head.sha !== sha) return yield* fail("PR head moved before reviewer gate.");
    const id = yield* requiredReviewerApp(head.base.ref);
    if (O.isNone(id)) return;
    const checks = yield* readReviewerChecks(sha);
    if (!reviewerCheckSatisfied(checks, sha, id.value, pr, head.base.sha))
      return yield* fail("Waiting for beep-reviewer from the required App on the current PR head and base.");
    const confirmed = yield* api(`${ROOT}/pulls/${pr}`).pipe(Effect.flatMap(decodePr));
    if (confirmed.head.sha !== sha || confirmed.base.sha !== head.base.sha || confirmed.base.ref !== head.base.ref)
      return yield* fail("PR head or base moved during reviewer gate.");
  },
  Effect.mapError(() =>
    fail("Reviewer merge gate held: require a successful current-head beep-reviewer check from the ruleset App.")
  )
);
