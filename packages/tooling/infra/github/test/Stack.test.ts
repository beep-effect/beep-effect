import * as GitHub from "@alchemy.run/github";
import * as Test from "@alchemy.run/test/Vitest";
import {
  EnvironmentSpec,
  LabelSpec,
  MainRuleset,
  RequiredCheck,
  requiredChecks,
  StackConfig,
  VariableSpec,
} from "@beep/infra-github/Config";
import { productionConfig } from "@beep/infra-github/Production";
import { decodeLiveRuleset, liveReviewerCheck } from "@beep/infra-github/RulesetGuard";
import { declareStack } from "@beep/infra-github/Stack";
import { expect } from "@effect/vitest";
import { destroy } from "alchemy/RemovalPolicy";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { FakeRepository, fakeProviders } from "./support/FakeGitHub.ts";
import { typed } from "./support/Scratch.ts";
import type { TypedScratch } from "./support/Scratch.ts";

const ownFakeScenario = <E>(
  name: string,
  body: (stack: TypedScratch, fake: FakeRepository) => Effect.Effect<void, E>
) => {
  const fake = FakeRepository.fromCensus();
  const { test } = Test.make({ providers: fakeProviders(fake), stage: "test" });
  test.provider(name, (stack) => body(typed(stack), fake));
};

const decodeLive = decodeLiveRuleset;

const requireReviewerLive = (fake: FakeRepository) => {
  const live = fake.ruleset(10_240_248);
  const rules = live.rules as ReadonlyArray<{ type: string; parameters?: Record<string, unknown> }>;
  MutableHashMap.set(fake.rulesets, 10_240_248, {
    ...live,
    rules: A.map(rules, (rule) =>
      rule.type === "required_status_checks"
        ? {
            ...rule,
            parameters: {
              ...rule.parameters,
              required_status_checks: [
                ...((rule.parameters?.required_status_checks ?? []) as ReadonlyArray<unknown>),
                { context: "beep-reviewer", integration_id: 5_321_138 },
              ],
            },
          }
        : rule
    ),
  });
};

const deployCarrying = Effect.fn("InfraGithubTest.deployCarrying")(function* (
  stack: TypedScratch,
  fake: FakeRepository
) {
  const live = yield* decodeLive(fake.ruleset(10_240_248));
  return yield* stack.deploy(declareStack(productionConfig, liveReviewerCheck(live)));
});

const checkContexts = (ruleset: Record<string, unknown>) => {
  const rules = (ruleset.rules ?? []) as ReadonlyArray<{ type: string; parameters?: Record<string, unknown> }>;
  const rule = A.findFirst(rules, (candidate) => candidate.type === "required_status_checks");
  return O.match(rule, {
    onNone: A.empty<string>,
    onSome: (found) =>
      A.map(
        (found.parameters?.required_status_checks ?? []) as ReadonlyArray<{ context: string; integration_id?: number }>,
        ({ context, integration_id }) => `${context}@${integration_id ?? "any"}`
      ),
  });
};

const actions = (plan: { readonly resources: Record<string, { readonly action: string }> }) =>
  R.fromEntries(
    A.map(R.toEntries(plan.resources), ([fqn, node]) => [
      O.getOrElse(A.last(Str.split(fqn, "/")), () => fqn),
      node.action,
    ])
  );

ownFakeScenario(
  "over the converged main-branch stack, the fleet-watch change plans only its environment and variable",
  (stack, fake) =>
    Effect.gen(function* () {
      MutableHashMap.remove(fake.environments, "fleet-watch");
      MutableHashMap.remove(fake.branchPolicies, "fleet-watch");
      MutableHashMap.remove(fake.variables, "fleet-watch/FLEET_WATCH_APP_CLIENT_ID");
      const mainBranchConfig = StackConfig.make({
        ...productionConfig,
        environments: A.filter(productionConfig.environments, ({ name }) => name !== "fleet-watch"),
      });
      yield* stack.deploy(declareStack(mainBranchConfig, O.none()));
      const plan = yield* stack.plan(declareStack(productionConfig, O.none()));
      const planned = actions(plan);
      expect(R.filter(planned, (action) => action !== "noop")).toEqual({
        "Environment-fleet-watch": "create",
        "EnvironmentVariable-fleet-watch-FLEET_WATCH_APP_CLIENT_ID": "create",
      });
    })
);

ownFakeScenario("a first plan adopts the main ruleset and creates no ruleset", (stack, fake) =>
  Effect.gen(function* () {
    const plan = yield* stack.plan(declareStack(productionConfig, O.none()));
    const planned = actions(plan);
    expect(planned.MainRuleset).toBe("adopted");
    expect(A.filter(R.values(planned), (action) => action === "replace" || action === "delete")).toEqual([]);
    expect(fake.writes(), "a plan is read-only").toEqual([]);
  })
);

ownFakeScenario("the first deploy adopts every live object in place and creates nothing", (stack, fake) =>
  Effect.gen(function* () {
    const output = yield* stack.deploy(declareStack(productionConfig, O.none()));
    expect(output.mainRulesetId).toBe(10_240_248);
    expect(output.repository).toBe("beep-effect/beep-effect");
    const creates = A.filter(fake.writes(), (call) => call.method === "POST");
    expect(creates).toEqual([]);
    expect(A.filter(fake.writes(), (call) => call.method === "DELETE")).toEqual([]);
    expect(
      checkContexts(fake.ruleset(10_240_248)),
      "the adopted ruleset keeps its id and its live checks: the switch is advisory"
    ).toEqual(
      A.map(productionConfig.mainRuleset.checks, ({ context, integrationId }) => `${context}@${integrationId}`)
    );
    expect(
      A.filter(fake.writes(), (call) => Str.endsWith("/rulesets/26917133")(call.path)),
      "the parked lab ruleset is untouched"
    ).toEqual([]);
    expect(MutableHashMap.size(fake.labels)).toBe(productionConfig.labels.length);
    const before = fake.writes().length;
    yield* stack.deploy(declareStack(productionConfig, O.none()));
    expect(
      A.filter(A.drop(fake.writes(), before), (call) => Str.includes("/rulesets")(call.path)),
      "a redeploy with no change writes no ruleset"
    ).toEqual([]);
  })
);

ownFakeScenario("a live beep-reviewer check survives a deploy, present or absent", (stack, fake) =>
  Effect.gen(function* () {
    yield* deployCarrying(stack, fake);
    const absent = checkContexts(fake.ruleset(10_240_248));
    expect(
      A.filter(absent, (context) => Str.startsWith("beep-reviewer")(context)),
      "absent in the census state, the deploy writes no reviewer check"
    ).toEqual([]);
    expect(absent.length).toBe(productionConfig.mainRuleset.checks.length);

    requireReviewerLive(fake);
    yield* deployCarrying(stack, fake);
    const present = checkContexts(fake.ruleset(10_240_248));
    expect(present.at(-1), "required by hand, the reviewer is kept by the next deploy, App binding included").toBe(
      "beep-reviewer@5321138"
    );
    expect(present.length).toBe(productionConfig.mainRuleset.checks.length + 1);

    expect(fake.ruleset(10_240_248).bypass_actors, "bypass actors survive both deploys").toEqual([
      { actor_type: "RepositoryRole", actor_id: 5, bypass_mode: "always" },
      { actor_type: "Integration", actor_id: 5_309_624, bypass_mode: "always" },
    ]);
  })
);

ownFakeScenario("updates converge labels, variables and environment branch policies", (stack, fake) =>
  Effect.gen(function* () {
    const changed = StackConfig.make({
      ...productionConfig,
      labels: A.map(productionConfig.labels, (label) =>
        label.name === "bug" ? LabelSpec.make({ ...label, color: "ff0000", description: O.some("Broken") }) : label
      ),
      variables: A.map(productionConfig.variables, (variable) =>
        variable.name === "KNOWLEDGE_MINT_APP_SLUG"
          ? VariableSpec.make({ ...variable, value: "renamed-slug" })
          : variable
      ),
      environments: A.map(productionConfig.environments, (environment) =>
        environment.name === "storybook-prod"
          ? EnvironmentSpec.make({ ...environment, branches: ["main", "release"] })
          : environment
      ),
    });
    yield* stack.deploy(declareStack(changed, O.none()));
    expect(O.getOrThrow(MutableHashMap.get(fake.labels, "bug"))).toMatchObject({
      color: "ff0000",
      description: "Broken",
    });
    expect(O.getOrThrow(MutableHashMap.get(fake.variables, "KNOWLEDGE_MINT_APP_SLUG"))).toMatchObject({
      value: "renamed-slug",
    });
    const policies = O.getOrThrow(MutableHashMap.get(fake.branchPolicies, "storybook-prod"));
    expect(A.map(policies, (policy) => policy.name)).toEqual(["main", "release"]);
  })
);

ownFakeScenario("a label description going from Some to None is cleared in the PATCH body", (stack, fake) =>
  Effect.gen(function* () {
    const withDescription = (description: O.Option<string>) =>
      StackConfig.make({
        ...productionConfig,
        labels: A.map(productionConfig.labels, (label) =>
          label.name === "bug" ? LabelSpec.make({ ...label, description }) : label
        ),
      });
    yield* stack.deploy(declareStack(withDescription(O.some("Broken")), O.none()));
    expect(O.getOrThrow(MutableHashMap.get(fake.labels, "bug"))).toMatchObject({ description: "Broken" });
    fake.calls.length = 0;
    yield* stack.deploy(declareStack(withDescription(O.none()), O.none()));
    const patches = A.filter(
      fake.writes(),
      (call) => call.method === "PATCH" && Str.endsWith("/labels/bug")(call.path)
    );
    expect(A.map(patches, (call) => call.body.description)).toEqual([""]);
    expect(O.getOrThrow(MutableHashMap.get(fake.labels, "bug"))).toMatchObject({ description: "" });
  })
);

ownFakeScenario("dropping declarations deletes nothing, and a stage destroy is refused", (stack, fake) =>
  Effect.gen(function* () {
    yield* stack.deploy(declareStack(productionConfig, O.none()));
    yield* stack.deploy(
      declareStack(
        StackConfig.make({
          ...productionConfig,
          labels: A.drop(productionConfig.labels, 1),
          environments: A.drop(productionConfig.environments, 1),
        }),
        O.none()
      )
    );
    const destroyed = yield* Effect.exit(stack.destroy());
    expect(destroyed._tag, "the repository and the main ruleset are protected: destroy plans fail").toBe("Failure");
    expect(A.filter(fake.writes(), (call) => call.method === "DELETE")).toEqual([]);
    expect(
      MutableHashMap.has(fake.environments, "beep-effect-web-prod"),
      "a dropped label or environment is retained on GitHub, only forgotten"
    ).toBe(true);
    expect(MutableHashMap.has(fake.rulesets, 10_240_248)).toBe(true);
    expect(MutableHashMap.size(fake.labels)).toBe(productionConfig.labels.length);
  })
);

ownFakeScenario("each resource class creates, reads, updates and deletes when it opts into deletion", (stack, fake) =>
  Effect.gen(function* () {
    const owner = "beep-effect";
    const repository = "beep-effect";
    const declare = Effect.fn("declareScratch")(function* (color: string, value: string) {
      const environment = yield* GitHub.Environment("ScratchEnvironment", {
        owner,
        repository,
        name: "scratch-env",
        deploymentBranchPolicy: { customBranchPolicies: ["main"] },
      });
      yield* GitHub.Variable("ScratchVariable", { owner, repository, name: "SCRATCH", value, environment });
      yield* GitHub.Label("ScratchLabel", { owner, repository, name: "scratch", color });
      const ruleset = yield* GitHub.Ruleset("ScratchRuleset", {
        owner,
        repository,
        name: "scratch",
        conditions: { include: ["refs/heads/scratch"] },
        requiredStatusChecks: { checks: [{ context: value }] },
      });
      return ruleset.rulesetId;
    }, destroy());

    const rulesetId = yield* stack.deploy(declare("aaaaaa", "one"));
    expect(MutableHashMap.has(fake.environments, "scratch-env")).toBe(true);
    expect(O.getOrThrow(MutableHashMap.get(fake.variables, "scratch-env/SCRATCH"))).toMatchObject({ value: "one" });
    expect(O.getOrThrow(MutableHashMap.get(fake.labels, "scratch"))).toMatchObject({ color: "aaaaaa" });
    expect(checkContexts(fake.ruleset(rulesetId))).toEqual(["one@any"]);

    const replanned = yield* stack.plan(declare("aaaaaa", "one"));
    const planned = actions(replanned);
    expect(
      A.filter(R.values(planned), (action) => action !== "noop"),
      "an unchanged redeploy plans no create and no replace"
    ).toEqual([]);

    yield* stack.deploy(declare("bbbbbb", "two"));
    expect(O.getOrThrow(MutableHashMap.get(fake.variables, "scratch-env/SCRATCH"))).toMatchObject({ value: "two" });
    expect(O.getOrThrow(MutableHashMap.get(fake.labels, "scratch"))).toMatchObject({ color: "bbbbbb" });
    expect(checkContexts(fake.ruleset(rulesetId))).toEqual(["two@any"]);

    yield* stack.destroy();
    expect(MutableHashMap.has(fake.environments, "scratch-env")).toBe(false);
    expect(MutableHashMap.has(fake.variables, "scratch-env/SCRATCH")).toBe(false);
    expect(MutableHashMap.has(fake.labels, "scratch")).toBe(false);
    expect(MutableHashMap.has(fake.rulesets, rulesetId)).toBe(false);
    expect(
      MutableHashMap.has(fake.rulesets, 10_240_248),
      "the adopted production ruleset is untouched throughout"
    ).toBe(true);
  })
);

ownFakeScenario("a same-name ruleset is not taken over without adoption", (stack, fake) =>
  Effect.gen(function* () {
    const exit = yield* stack
      .deploy(
        GitHub.Ruleset("Squatter", {
          owner: "beep-effect",
          repository: "beep-effect",
          name: "main",
          conditions: { include: ["~DEFAULT_BRANCH"] },
        })
      )
      .pipe(Effect.exit);
    expect(exit._tag).toBe("Failure");
    expect(checkContexts(fake.ruleset(10_240_248)).length).toBe(productionConfig.mainRuleset.checks.length);
  })
);

ownFakeScenario("required checks list beep-reviewer last and only once", () =>
  Effect.sync(() => {
    const doubled = MainRuleset.make({
      ...productionConfig.mainRuleset,
      checks: [
        ...productionConfig.mainRuleset.checks,
        RequiredCheck.make({ context: "beep-reviewer", integrationId: 1 }),
      ],
    });
    const live = RequiredCheck.makeOption({ context: "beep-reviewer", integrationId: 5_321_138 });
    const contexts = A.map(
      requiredChecks(doubled, live),
      ({ context, integrationId }) => `${context}@${integrationId}`
    );
    expect(A.filter(contexts, (context) => Str.startsWith("beep-reviewer")(context))).toEqual([
      "beep-reviewer@5321138",
    ]);
  })
);
