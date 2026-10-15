/**
 * Human-authenticated, lossless ruleset updates and source-bound merge checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ReviewerError } from "./ReviewerErrors.ts";
import type { ReviewerChangedFile } from "./ReviewerModels.ts";

const $I = $RepoCliId.create("commands/Reviewer/ReviewerRuleset.service");
const ROOT = "repos/beep-effect/beep-effect";
const UnknownJson = S.fromJsonString(S.Unknown);
const decodeJson = S.decodeUnknownEffect(UnknownJson);
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
const decodeSummaryPages = S.decodeUnknownEffect(S.Array(S.Array(RuleSummary)));
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
class Checks extends S.Class<Checks, { readonly brand: unique symbol }>($I`Checks`)(
  { total_count: S.Int, check_runs: S.Array(Check) },
  $I.annote("Checks", { description: "Check-run page." })
) {}
const decodeChecks = S.decodeUnknownEffect(Checks);
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

/**
 * Runs gh with its existing login and streams optional input without a temporary file.
 *
 * **Example** (Compose an authenticated read)
 * ```ts
 * import { reviewerGh } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(reviewerGh(["api", "user"])));
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const reviewerGh = Effect.fn("Reviewer.gh")(function* (args: ReadonlyArray<string>, input?: string) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const child = yield* ChildProcess.make("gh", args, {
        stdout: "pipe",
        stderr: "ignore",
        ...O.getSomesStruct({
          stdin: O.map(O.fromUndefinedOr(input), (text) => Stream.make(new TextEncoder().encode(text))),
        }),
      });
      const [code, output] = yield* Effect.all(
        [child.exitCode, child.stdout.pipe(Stream.decodeText, Stream.mkString)],
        { concurrency: 2 }
      );
      if (code !== 0)
        return yield* fail(
          "gh request failed; verify the selected human account and repository administration permission."
        );
      return output;
    })
  ).pipe(Effect.mapError(() => fail("gh request failed; no response body was retained in the error.")));
});
const api = Effect.fn("Reviewer.ghApi")(function* (path: string) {
  return yield* reviewerGh(["api", path]).pipe(
    Effect.flatMap(decodeJson),
    Effect.mapError(() => fail("Cannot read GitHub administration data."))
  );
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
  function* (value: unknown, appId: number) {
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
            required_status_checks: [...others, { context: "beep-reviewer", integration_id: appId }],
          },
        };
      })
    );
    return yield* decodeObject({ ...original, rules: updated });
  },
  Effect.mapError(() => fail("Cannot safely update this ruleset."))
);

/**
 * Prints a default-branch ruleset diff; only an explicit apply sends the human-authenticated PUT.
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
  const user = yield* reviewerGh(["api", "user", "--jq", ".login"]);
  if (Str.trim(user) !== "kriegcloud")
    return yield* fail("Ruleset administration must use Benjamin Oppold's gh login (kriegcloud).");
  const repo = yield* api(ROOT).pipe(Effect.flatMap(decodeRepo));
  const branchRules = yield* api(`${ROOT}/rules/branches/${encodeURIComponent(repo.default_branch)}`).pipe(
    Effect.flatMap(decodeBranchRules)
  );
  const listed = yield* reviewerGh([
    "api",
    `${ROOT}/rulesets?includes_parents=true&per_page=100`,
    "--paginate",
    "--slurp",
  ]).pipe(Effect.flatMap(decodeJson), Effect.flatMap(decodeSummaryPages), Effect.map(A.flatten));
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
  const updated = yield* requireReviewerInRuleset(original, appId);
  const before = yield* encodeJson(original);
  const after = yield* encodeJson(updated);
  yield* Console.log(`--- ruleset ${selected.value.id}\n- ${before}\n+ ${after}`);
  if (!apply || before === after) return;
  if ((yield* api(path).pipe(Effect.flatMap(encodeJson))) !== before)
    return yield* fail("Ruleset changed during preview; rerun and inspect the new diff.");
  // PUT accepts only writable fields; the complete rules and bypass actors are preserved verbatim.
  const payload = yield* encodeJson({
    name: updated.name,
    target: updated.target,
    enforcement: updated.enforcement,
    bypass_actors: updated.bypass_actors,
    conditions: updated.conditions,
    rules: updated.rules,
  });
  yield* reviewerGh(["api", "--method", "PUT", path, "--input", "-"], payload);
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
  const checks: Array<Check> = [];
  let page = 1;
  while (true) {
    const batch = yield* api(
      `${ROOT}/commits/${sha}/check-runs?check_name=beep-reviewer&filter=all&per_page=100&page=${page}`
    ).pipe(Effect.flatMap(decodeChecks));
    checks.push(...batch.check_runs);
    if (page * 100 >= batch.total_count) break;
    page += 1;
  }
  return checks;
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
