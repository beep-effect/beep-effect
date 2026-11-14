import { MainRuleset, requiredChecks } from "@beep/infra-github/Config";
import { productionConfig } from "@beep/infra-github/Production";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import census from "./fixtures/census.json" with { type: "json" };

/**
 * `fixtures/census.json` is the live state of beep-effect/beep-effect read on
 * 2026-11-13 (names and non-secret settings only). These tests fail when the
 * declared configuration drifts from that capture, and when the capture holds
 * an object the configuration neither owns nor lists as unmanaged. A deliberate
 * change edits both the configuration and the snapshot in the same commit.
 */
const config = productionConfig;
const unmanagedNames = (objectClass: string) =>
  HashSet.fromIterable(
    A.map(
      A.filter(config.unmanaged, (object) => object.objectClass === objectClass),
      ({ name }) => name
    )
  );

const mainRuleset = O.getOrThrow(A.findFirst(census.rulesets, (ruleset) => ruleset.name === "main"));

/** The main ruleset as GitHub stores it, built from the declared configuration. */
const storedRuleset = (ruleset: MainRuleset) => {
  const pullRequest = ruleset.pullRequest;
  return {
    name: ruleset.name,
    target: "branch",
    enforcement: ruleset.enforcement,
    conditions: { ref_name: { exclude: ruleset.exclude, include: ruleset.include } },
    bypass_actors: A.map(ruleset.bypassActors, ({ actorType, actorId, bypassMode }) => ({
      actor_id: actorId,
      actor_type: actorType,
      bypass_mode: bypassMode,
    })),
    rules: [
      // Built from the flags, as plannedRuleTypes does, so a flag turned off shows as drift.
      ...(ruleset.deletion ? [{ type: "deletion" }] : []),
      ...(ruleset.nonFastForward ? [{ type: "non_fast_forward" }] : []),
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: pullRequest.requiredApprovingReviewCount,
          dismiss_stale_reviews_on_push: pullRequest.dismissStaleReviewsOnPush,
          required_reviewers: [],
          require_code_owner_review: pullRequest.requireCodeOwnerReview,
          dismissal_restriction: { enabled: false, allowed_actors: [] },
          require_last_push_approval: pullRequest.requireLastPushApproval,
          required_review_thread_resolution: pullRequest.requiredReviewThreadResolution,
          require_extra_approval_for_unattributed_changes: pullRequest.requireExtraApprovalForUnattributedChanges,
          allowed_merge_methods: pullRequest.allowedMergeMethods,
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: ruleset.strictRequiredStatusChecksPolicy,
          do_not_enforce_on_create: false,
          required_status_checks: A.map(requiredChecks(ruleset, O.none()), ({ context, integrationId }) => ({
            context,
            integration_id: integrationId,
          })),
        },
      },
    ],
  };
};

describe("the declared configuration matches the census", () => {
  it("repository settings", () => {
    const { settings } = config;
    expect({
      homepage: settings.homepage,
      default_branch: settings.defaultBranch,
      has_issues: settings.hasIssues,
      has_projects: settings.hasProjects,
      has_wiki: settings.hasWiki,
      has_discussions: settings.hasDiscussions,
      is_template: settings.isTemplate,
      allow_squash_merge: settings.allowSquashMerge,
      allow_merge_commit: settings.allowMergeCommit,
      allow_rebase_merge: settings.allowRebaseMerge,
      allow_auto_merge: settings.allowAutoMerge,
      delete_branch_on_merge: settings.deleteBranchOnMerge,
      topics: settings.topics,
    }).toEqual({ ...census.repository, full_name: undefined, topics: census.repository.topics });
    expect(`${config.owner}/${config.repository}`).toBe(census.repository.full_name);
  });

  it("main ruleset, in the shape GitHub stores it", () => {
    expect(storedRuleset(config.mainRuleset)).toEqual(mainRuleset);
  });

  it("main ruleset: a protection flag turned off shows as drift", () => {
    for (const flags of [{ deletion: false }, { nonFastForward: false }]) {
      expect(storedRuleset(MainRuleset.make({ ...config.mainRuleset, ...flags }))).not.toEqual(mainRuleset);
    }
  });

  it("owned environments: branch policies and variables", () => {
    for (const environment of config.environments) {
      const live = O.getOrThrow(A.findFirst(census.environments, ({ name }) => name === environment.name));
      expect(live.deployment_branch_policy).toEqual({ protected_branches: false, custom_branch_policies: true });
      expect(A.map(live.branch_policies, ({ name, type }) => `${type}:${name}`)).toEqual(
        A.map(environment.branches, (branch) => `branch:${branch}`)
      );
      expect(live.variables).toEqual(A.map(environment.variables, ({ name, value }) => ({ name, value })));
      expect(live.protection_rule_types).toEqual(["branch_policy"]);
    }
  });

  it("owned repository variables", () => {
    expect(census.variables_owned_values).toEqual(A.map(config.variables, ({ name, value }) => ({ name, value })));
  });

  it("labels", () => {
    expect(census.labels).toEqual(
      A.map(config.labels, ({ name, color, description }) => ({
        color,
        description: O.getOrNull(description),
        name,
      }))
    );
  });
});

describe("every live object is owned or listed as unmanaged", () => {
  it("rulesets", () => {
    const owned = HashSet.make(config.mainRuleset.name);
    for (const { name } of census.rulesets)
      expect(HashSet.has(owned, name) || HashSet.has(unmanagedNames("ruleset"), name)).toBe(true);
  });

  it("environments", () => {
    const owned = HashSet.fromIterable(A.map(config.environments, ({ name }) => name));
    for (const { name } of census.environments)
      expect([name, HashSet.has(owned, name) || HashSet.has(unmanagedNames("environment"), name)]).toEqual([
        name,
        true,
      ]);
  });

  it("repository variables", () => {
    const owned = HashSet.fromIterable(A.map(config.variables, ({ name }) => name));
    for (const name of census.variable_names)
      expect([name, HashSet.has(owned, name) || HashSet.has(unmanagedNames("variable"), name)]).toEqual([name, true]);
  });

  it("secrets, repository and environment, are all unmanaged on day one", () => {
    const environmentSecrets = A.flatMap(census.environments, ({ name, secret_names }) =>
      A.map(secret_names, (secret) => `${name}/${secret}`)
    );
    for (const name of [...census.secret_names, ...environmentSecrets])
      expect([name, HashSet.has(unmanagedNames("secret"), name)]).toEqual([name, true]);
  });

  it("webhooks", () => {
    for (const { name } of census.webhooks) expect(HashSet.has(unmanagedNames("webhook"), name)).toBe(true);
  });
});
