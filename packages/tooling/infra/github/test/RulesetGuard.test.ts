import { MainRuleset } from "@beep/infra-github/Config";
import { productionConfig } from "@beep/infra-github/Production";
import {
  decodeLiveRuleset,
  decodeLiveRulesetJson,
  guardAfterDeploy,
  guardRuleset,
  liveReviewerCheck,
  plannedFields,
  reviewerMismatchMessage,
} from "@beep/infra-github/RulesetGuard";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import census from "./fixtures/census.json" with { type: "json" };

const decodeLive = decodeLiveRuleset;

/** The census capture of ruleset 10240248, plus the server-managed fields GitHub returns. */
const liveMain = {
  id: 10_240_248,
  node_id: "RRS_fixture",
  source_type: "Repository",
  source: "beep-effect/beep-effect",
  created_at: "2025-11-20T22:12:15.649-06:00",
  updated_at: "2026-10-27T04:49:40.154-05:00",
  current_user_can_bypass: "always",
  _links: { self: { href: "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248" } },
  ...O.getOrThrow(A.findFirst(census.rulesets, (ruleset) => ruleset.name === "main")),
};

type Rule = { readonly type: string; readonly parameters?: Record<string, unknown> };

const editRule = (type: string, edit: (parameters: Record<string, unknown>) => Record<string, unknown>) => ({
  ...liveMain,
  rules: A.map(liveMain.rules as ReadonlyArray<Rule>, (rule) =>
    rule.type === type ? { ...rule, parameters: edit(rule.parameters ?? {}) } : rule
  ),
});

const withChecks = (extra: ReadonlyArray<unknown>) =>
  editRule("required_status_checks", (parameters) => ({
    ...parameters,
    required_status_checks: [...(parameters.required_status_checks as ReadonlyArray<unknown>), ...extra],
  }));

const guard = Effect.fn("RulesetGuardTest.guard")(function* (live: unknown) {
  const decoded = yield* decodeLive(live);
  return yield* Effect.exit(guardRuleset(productionConfig.mainRuleset, decoded));
});

const driftedFields = Effect.fn("RulesetGuardTest.drifted")(function* (live: unknown) {
  const decoded = yield* decodeLive(live);
  const failure = yield* Effect.flip(guardRuleset(productionConfig.mainRuleset, decoded));
  return A.map(failure.diffs, (diff) => diff.field);
});

/** Asserts the guard refuses `live` and names exactly `fields`. */
const expectDrift = Effect.fn("RulesetGuardTest.expectDrift")(function* (live: unknown, fields: ReadonlyArray<string>) {
  const drifted = yield* driftedFields(live);
  expect(drifted).toEqual(fields);
});

/** Asserts the guard passes `live`. */
const expectPass = Effect.fn("RulesetGuardTest.expectPass")(function* (live: unknown) {
  const exit = yield* guard(live);
  expect(exit._tag).toBe("Success");
});

describe("the ruleset 10240248 guard", () => {
  it.effect("passes the live ruleset as captured: the planned body equals it in every guarded field", () =>
    expectPass(liveMain)
  );

  it.effect("ignores server-managed fields", () =>
    expectPass({
      ...liveMain,
      id: 1,
      node_id: "other",
      updated_at: "2030-01-01T00:00:00Z",
      _links: {},
      current_user_can_bypass: "never",
    })
  );

  it.effect("carries a live beep-reviewer check in either position", () =>
    Effect.gen(function* () {
      const required = withChecks([{ context: "beep-reviewer", integration_id: 5_321_138 }]);
      const decoded = yield* decodeLive(required);
      expect(O.getOrNull(O.map(liveReviewerCheck(decoded), (check) => check.integrationId))).toBe(5_321_138);
      yield* expectPass(required);
      yield* expectPass(liveMain);
    })
  );

  it.effect("refuses a required check added or rebound by hand", () =>
    Effect.gen(function* () {
      yield* expectDrift(withChecks([{ context: "Extra", integration_id: 15_368 }]), ["requiredChecks"]);
      const rebound = editRule("required_status_checks", (parameters) => ({
        ...parameters,
        required_status_checks: A.map(
          parameters.required_status_checks as ReadonlyArray<{ context: string; integration_id: number }>,
          (check) => (check.context === "Lint" ? { context: "Lint", integration_id: 1 } : check)
        ),
      }));
      yield* expectDrift(rebound, ["requiredChecks"]);
      // A beep-reviewer entry without an App binding cannot be carried faithfully, so it is refused too.
      yield* expectDrift(withChecks([{ context: "beep-reviewer" }]), ["requiredChecks"]);
    })
  );

  it.effect("refuses a changed strict policy, bypass list, merge method set or condition", () =>
    Effect.gen(function* () {
      const strict = editRule("required_status_checks", (parameters) => ({
        ...parameters,
        strict_required_status_checks_policy: true,
      }));
      yield* expectDrift(strict, ["strictRequiredStatusChecksPolicy"]);
      yield* expectDrift({ ...liveMain, bypass_actors: A.take(liveMain.bypass_actors, 1) }, ["bypassActors"]);
      const squashOnly = editRule("pull_request", (parameters) => ({
        ...parameters,
        allowed_merge_methods: ["squash"],
      }));
      yield* expectDrift(squashOnly, ["allowedMergeMethods"]);
      yield* expectDrift({ ...liveMain, conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } } }, [
        "include",
      ]);
    })
  );

  it.effect("fails closed on any shape it cannot read", () =>
    Effect.gen(function* () {
      const unreadable = [
        // A rule type the stack does not write (the PUT would drop it).
        { ...liveMain, rules: [...(liveMain.rules as ReadonlyArray<Rule>), { type: "required_signatures" }] },
        // An unknown key inside a rule's parameters.
        editRule("required_status_checks", (parameters) => ({ ...parameters, required_reviewers_v2: [] })),
        // An unknown top-level key.
        { ...liveMain, merge_queue_policy: "new" },
        // An unknown condition.
        { ...liveMain, conditions: { ...liveMain.conditions, repository_name: { include: ["x"] } } },
        // Settings the provider never sends, away from their defaults (the PUT would reset them).
        editRule("pull_request", (parameters) => ({ ...parameters, required_reviewers: [{ reviewer_id: 1 }] })),
        editRule("pull_request", (parameters) => ({
          ...parameters,
          dismissal_restriction: { enabled: true, allowed_actors: [] },
        })),
        editRule("required_status_checks", (parameters) => ({ ...parameters, do_not_enforce_on_create: true })),
        // A missing guarded field.
        { ...liveMain, bypass_actors: undefined },
      ];
      for (const live of unreadable) {
        const exit = yield* Effect.exit(decodeLive(live));
        expect(exit._tag).toBe("Failure");
      }
      const text = yield* Effect.exit(decodeLiveRulesetJson("not json"));
      expect(text._tag).toBe("Failure");
    })
  );

  it.effect("the post-deploy check names a reviewer switch flipped during the deploy, either way", () =>
    Effect.gen(function* () {
      const withReviewer = yield* decodeLive(withChecks([{ context: "beep-reviewer", integration_id: 5_321_138 }]));
      const without = yield* decodeLive(liveMain);
      // Nothing moved: the after read equals what was written.
      const same = yield* Effect.exit(guardAfterDeploy(productionConfig.mainRuleset, withReviewer, withReviewer));
      expect(same._tag).toBe("Success");
      // Released during the window, then required during the window.
      for (const [before, after] of [
        [withReviewer, without],
        [without, withReviewer],
      ] as const) {
        const failure = yield* Effect.flip(guardAfterDeploy(productionConfig.mainRuleset, before, after));
        expect(failure._tag).toBe("ReviewerChangedDuringDeploy");
        if (failure._tag === "ReviewerChangedDuringDeploy") {
          expect(reviewerMismatchMessage(failure)).toMatch(
            /^ruleset-guard: beep-reviewer differs from what the deploy wrote \(written: .+; live now: .+\); confirm the switch position\.$/
          );
        }
      }
      // Any other difference is ordinary drift.
      const strict = yield* decodeLive(
        editRule("required_status_checks", (parameters) => ({
          ...parameters,
          strict_required_status_checks_policy: true,
        }))
      );
      const drift = yield* Effect.flip(guardAfterDeploy(productionConfig.mainRuleset, without, strict));
      expect(drift._tag).toBe("RulesetDrift");
    })
  );

  it.effect("rule types, a missing pull request rule and an absent extra-approval setting are all compared", () =>
    Effect.gen(function* () {
      // A declared ruleset without the deletion or non-fast-forward rule plans fewer rule types.
      const lean = MainRuleset.make({ ...productionConfig.mainRuleset, deletion: false, nonFastForward: false });
      expect(plannedFields(lean, O.none()).ruleTypes).toEqual(["pull_request", "required_status_checks"]);
      // A live ruleset with no pull request rule differs in the rule types, the settings and the merge methods.
      const noPullRequest = {
        ...liveMain,
        rules: A.filter(liveMain.rules as ReadonlyArray<Rule>, (rule) => rule.type !== "pull_request"),
      };
      yield* expectDrift(noPullRequest, ["ruleTypes", "pullRequest", "allowedMergeMethods"]);
      // An absent extra-approval setting reads as false, which differs from the declared true.
      const absent = editRule(
        "pull_request",
        ({ require_extra_approval_for_unattributed_changes: _, ...rest }) => rest
      );
      yield* expectDrift(absent, ["pullRequest"]);
    })
  );
});
