import * as GitHub from "@alchemy.run/github";
import * as Test from "@alchemy.run/test/Vitest";
import { CreateAllowList, isCreateAllowed, LabelSpec, StackConfig } from "@beep/infra-github/Config";
import { productionConfig, productionCreateAllowList, productionStage } from "@beep/infra-github/Production";
import { prodGitHubProviders } from "@beep/infra-github/ProdWriteGuard";
import { decodeLiveRuleset } from "@beep/infra-github/RulesetGuard";
import { declareStack } from "@beep/infra-github/Stack";
import { expect } from "@effect/vitest";
import * as ProviderModule from "alchemy/Provider";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { FakeRepository, fakeProviders } from "./support/FakeGitHub.ts";
import { typed } from "./support/Scratch.ts";
import type { DeployError, TypedScratch } from "./support/Scratch.ts";

const MAIN = 10_240_248;

type PlanNode = { readonly action: string; readonly resource: { readonly Type: string } };

/** The plan node for each logical id, with the action it prints. */
const actions = (plan: { readonly resources: Record<string, unknown> }) =>
  R.map(plan.resources, (node) => (node as PlanNode).action);

/** The resource type of each logical id in the plan. */
const resourceTypes = (plan: { readonly resources: Record<string, unknown> }) =>
  R.map(plan.resources, (node) => (node as PlanNode).resource.Type);

/** The kinds whose shipped create path converges an existing object by name. */
const convergeByName = ["GitHub.Repository", "GitHub.Environment", "GitHub.Variable", "GitHub.Label"];

const failureText = <A, E>(exit: Exit.Exit<A, E>) => Exit.match(exit, { onSuccess: () => "", onFailure: Cause.pretty });

/** The writes, keyed by method and path with object names folded, and counted. */
const writeCensus = (fake: FakeRepository) =>
  A.reduce(fake.writes(), R.empty<string, number>(), (census, call) => {
    const key = `${call.method} ${Str.replace(/\/(labels|environments)\/[^/]+$/u, "/$1/:name")(call.path)}`;
    return R.set(census, key, (census[key] ?? 0) + 1);
  });

/** One prod-stage scenario against its own seeded fake, with the capture taken before `between` runs. */
const scenario = (
  name: string,
  body: (stack: TypedScratch, fake: FakeRepository) => Effect.Effect<void, DeployError>,
  between: (fake: FakeRepository) => void = () => undefined
) => {
  const fake = FakeRepository.fromCensus();
  const capture = Effect.runSync(decodeLiveRuleset(fake.ruleset(MAIN)));
  const providers = prodGitHubProviders(productionCreateAllowList, capture).pipe(
    Layer.provideMerge(fakeProviders(fake))
  );
  const { test } = Test.make({ providers, stage: productionStage });
  test.provider(name, (scratch) =>
    Effect.gen(function* () {
      between(fake);
      fake.calls.length = 0;
      yield* body(typed(scratch), fake);
    })
  );
  return capture;
};

const production = declareStack(productionConfig, O.none());

scenario(
  "the first prod plan creates exactly the allow-list, adopts the main ruleset and writes nothing",
  (stack, fake) =>
    Effect.gen(function* () {
      // The plan comes from the committed declarations; the list is compared against it, never copied into it.
      const plan = yield* stack.plan(production);
      const planned = actions(plan);
      const creates = A.sort(R.keys(R.filter(planned, (action) => action === "create")), Order.String);
      expect(creates).toEqual(A.sort(productionCreateAllowList.logicalIds, Order.String));
      // Listing an id cannot admit a kind whose create path makes a second object (a ruleset, say).
      const types = resourceTypes(plan);
      expect(A.filter(creates, (id) => !A.contains(convergeByName, types[id]))).toEqual([]);
      expect(R.filter(planned, (action) => action !== "create")).toEqual({ MainRuleset: "adopted" });
      expect(R.keys(plan.deletions ?? {})).toEqual([]);
      expect(fake.writes()).toEqual([]);
    })
);

scenario("deploying over the live objects converges by name: no POST, no DELETE, no second ruleset", (stack, fake) =>
  Effect.gen(function* () {
    yield* stack.deploy(production);
    expect(writeCensus(fake)).toEqual({
      "PATCH /repos/beep-effect/beep-effect": 1,
      "PUT /repos/beep-effect/beep-effect/topics": 1,
      [`PUT /repos/beep-effect/beep-effect/rulesets/${MAIN}`]: 1,
      "PUT /repos/beep-effect/beep-effect/environments/:name": 4,
      "PATCH /repos/beep-effect/beep-effect/labels/:name": 26,
    });
    expect(fake.rulesets.pipe(MutableHashMap.keys, A.fromIterable, A.sort(Order.Number))).toEqual([MAIN, 26_917_133]);
    expect(MutableHashMap.size(fake.labels)).toBe(26);
  })
);

scenario(
  "a main ruleset the plan cannot find live fails the plan and the deploy, and nothing is written",
  (stack, fake) =>
    Effect.gen(function* () {
      const planned = yield* Effect.exit(stack.plan(production));
      const deployed = yield* Effect.exit(stack.deploy(production));
      for (const text of [failureText(planned), failureText(deployed)]) {
        expect(text).toContain("ProdChangeRefused");
        expect(text).toContain("MainRuleset");
      }
      expect(fake.writes()).toEqual([]);
    }),
  // The name-based read misses: renamed live after the capture (an unreadable listing reads the same way).
  (fake) => MutableHashMap.set(fake.rulesets, MAIN, { ...fake.ruleset(MAIN), name: "main-renamed" })
);

scenario("a declaration off the allow-list is refused at its create path before any request", (stack, fake) =>
  Effect.gen(function* () {
    const extra = StackConfig.make({
      ...productionConfig,
      labels: [LabelSpec.make({ name: "not-on-the-list", color: "ffffff", description: O.none() })],
    });
    expect(isCreateAllowed(productionCreateAllowList, "Label-not-on-the-list")).toBe(false);
    const deployed = yield* Effect.exit(stack.deploy(declareStack(extra, O.none())));
    const text = failureText(deployed);
    expect(text).toContain("ProdChangeRefused");
    expect(text).toContain("Label-not-on-the-list");
    expect(A.filter(fake.calls, (call) => Str.includes("not-on-the-list")(call.path))).toEqual([]);
    expect(A.filter(fake.writes(), (call) => call.method === "POST" || call.method === "DELETE")).toEqual([]);
  })
);

scenario("a repository missing live fails the plan instead of planning a POST", (stack, fake) =>
  Effect.gen(function* () {
    const planned = yield* Effect.exit(
      stack.plan(GitHub.Repository("Repository", { owner: "beep-effect", name: "missing" }))
    );
    const text = failureText(planned);
    expect(text).toContain("ProdChangeRefused");
    expect(text).toContain("no live object to converge on");
    expect(fake.writes()).toEqual([]);
  })
);

scenario("a planned replace fails the plan", (stack, fake) =>
  Effect.gen(function* () {
    const label = (name: string) =>
      GitHub.Label("Label-bug", { owner: "beep-effect", repository: "beep-effect", name, color: "d73a4a" });
    yield* stack.deploy(label("bug"));
    fake.calls.length = 0;
    const planned = yield* Effect.exit(stack.plan(label("bug-renamed")));
    const text = failureText(planned);
    expect(text).toContain("ProdChangeRefused");
    expect(text).toContain("replace");
    expect(fake.writes()).toEqual([]);
  })
);

// precreate and delete are refused outright, whatever the logical id.
{
  const fake = FakeRepository.fromCensus();
  const capture = Effect.runSync(decodeLiveRuleset(fake.ruleset(MAIN)));
  const providers = prodGitHubProviders(productionCreateAllowList, capture).pipe(
    Layer.provideMerge(fakeProviders(fake))
  );
  const { test } = Test.make({ providers, stage: productionStage });
  test.provider("precreate and delete never reach GitHub on prod", () =>
    Effect.gen(function* () {
      const label = yield* ProviderModule.Provider<GitHub.Label>(GitHub.Label.Type);
      const input = { id: "Label-bug", fqn: "Label-bug", instanceId: "i" } as never;
      for (const run of [label.precreate!(input), label.delete(input)]) {
        const failure = yield* Effect.flip(run);
        expect(failure).toMatchObject({ _tag: "ProdChangeRefused", logicalId: "Label-bug" });
      }
      expect(fake.calls).toEqual([]);
      expect(isCreateAllowed("Repository")(CreateAllowList.make({ logicalIds: ["Repository"] }))).toBe(true);
    })
  );
}

scenario("a removed declaration plans orphaned and its deploy sends no mutating request", (stack, fake) =>
  Effect.gen(function* () {
    yield* stack.deploy(production);
    const fewer = declareStack(
      StackConfig.make({
        ...productionConfig,
        labels: A.filter(productionConfig.labels, (label) => label.name !== "bug"),
      }),
      O.none()
    );
    fake.calls.length = 0;
    const plan = yield* stack.plan(fewer);
    expect(R.map(plan.deletions ?? {}, (node) => (node as PlanNode).action)).toEqual({ "Label-bug": "orphaned" });
    yield* stack.deploy(fewer);
    // The live label stays in place, unmanaged: the deploy forgets the state row and writes nothing.
    expect(fake.writes()).toEqual([]);
    expect(MutableHashMap.has(fake.labels, "bug")).toBe(true);
  })
);
