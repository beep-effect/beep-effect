import {
  applyIfUnchanged,
  CheckedAction,
  CheckedPlan,
  CheckedPlanJson,
  CheckedResource,
  checkEnginePlan,
  expectationViolations,
  newSecretSalt,
  planDifferences,
  readEnginePlan,
} from "@beep/infra-ci-runners/CheckedDeploy";
import { program } from "@beep/infra-ci-runners/CiRunners";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Fakes from "./support/Fakes.ts";
import type { PlanExpectation } from "@beep/infra-ci-runners/CheckedDeploy";
import type { Plan } from "alchemy/Plan";

const productionEnvironment = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({
    CI: "true",
    CI_RUNNERS_GITHUB_APP_ID: "12345",
    CI_RUNNERS_GITHUB_APP_KEY_BASE64: "a2V5",
    CI_RUNNERS_GITHUB_WEBHOOK_SECRET: "webhook-secret",
  })
);

const production = program.pipe(productionEnvironment);

// A pure stand-in digest (hex of the input): deterministic, and distinct inputs stay distinct.
const hexDigest = Digest.Digest.of({
  digest: Effect.fnUntraced(function* (_algorithm: Digest.Algorithm, data: Uint8Array) {
    return data;
  }),
  digestHex: Effect.fnUntraced(function* (_algorithm: Digest.Algorithm, data: Uint8Array) {
    return Hex.encode(data);
  }),
});

const salt = Str.repeat(32)("00");

const readWith = (plan: Plan, options: { readonly salt?: string; readonly expectation?: PlanExpectation } = {}) =>
  readEnginePlan({
    stage: "prod",
    plan,
    salt: options.salt ?? salt,
    expectation: options.expectation ?? "routine",
  }).pipe(Effect.provideService(Digest.Digest, hexDigest));

const planOf = (stack: Fakes.TypedStack) => stack.plan(production).pipe(Effect.flatMap((plan) => readWith(plan)));

// The outcome's tag, so a refusal and a success compare alike.
const outcomeOf = <E extends { readonly _tag: string }, R>(effect: Effect.Effect<string, E, R>) =>
  Effect.match(effect, { onFailure: (error) => error._tag, onSuccess: (value) => value });

// The apply stand-in: it records that it ran, so a refusal proves nothing was written.
const recordingWrite = (written: Ref.Ref<boolean>) => Ref.set(written, true).pipe(Effect.as("applied"));

const resource = (fqn: string, overrides: Partial<CheckedResource> = {}) =>
  CheckedResource.make({
    fqn,
    type: "EC2.Vpc",
    action: "create",
    bindings: [],
    propsDigest: "d1",
    bindingsDigest: "",
    secretsDigest: "",
    pendingReplacement: false,
    ...overrides,
  });

const planWith = (...resources: ReadonlyArray<CheckedResource>) =>
  CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: salt, resources, actions: [] });

const expecting = (expectation: PlanExpectation, ...resources: ReadonlyArray<CheckedResource>) =>
  CheckedPlan.make({ ...planWith(...resources), expectation });

const tagsOf = (plan: CheckedPlan) => A.map(expectationViolations(plan), (violation) => violation._tag);

// A minimal engine plan: one node per entry, with the fields readEnginePlan and describePlan read.
const engineNode = (
  fqn: string,
  node: {
    readonly action: string;
    readonly props?: unknown;
    readonly bindings?: ReadonlyArray<{ readonly sid: string; readonly action: string; readonly data: unknown }>;
    readonly state?: unknown;
  }
) => ({
  resource: { FQN: fqn, LogicalId: fqn, Type: "Test.Resource" },
  action: node.action,
  props: node.props,
  bindings: node.bindings ?? [],
  state: node.state ?? { status: "created" },
  mode: undefined,
});

const enginePlan = (
  nodes: Readonly<Record<string, ReturnType<typeof engineNode>>>,
  actions: Readonly<Record<string, unknown>> = {}
) => ({ resources: nodes, deletions: {}, actions, actionDeletions: {} }) as unknown as Plan;

const single = (node: Parameters<typeof engineNode>[1]) => enginePlan({ Vpc: engineNode("Vpc", node) });

describe("CiRunners checked deploy", () => {
  const stable = Fakes.harness({ stage: "prod" });
  stable.provider("reads the same checked plan from two plans of one state, and it passes the check", (stack) =>
    Effect.gen(function* () {
      const first = yield* planOf(stack);
      const second = yield* planOf(stack);
      expect(planDifferences(first, second)).toStrictEqual({ added: [], removed: [], changed: [] });
      const resources = yield* checkEnginePlan(first);
      assertTrue(A.isReadonlyArrayNonEmpty(resources));
      assertTrue(A.every(first.resources, (row) => row.action === "create" && !row.pendingReplacement));
      assertTrue(A.some(first.resources, (row) => row.secretsDigest.length === 64));
      const text = yield* S.encodeEffect(CheckedPlanJson)(first);
      const decoded = yield* S.decodeEffect(CheckedPlanJson)(text);
      expect(decoded).toStrictEqual(first);
    })
  );

  const moved = Fakes.harness({ stage: "prod" });
  moved.provider("refuses before any write when the state moved between the check and the deploy", (stack) =>
    Effect.gen(function* () {
      const checked = yield* planOf(stack);
      yield* stack.deploy(production);
      const current = yield* planOf(stack);
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(applyIfUnchanged(checked, current, recordingWrite(written)));
      expect(outcome).toBe("PlanDrift");
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
    })
  );

  it.effect("applies an unchanged plan and refuses every simulated drift with nothing written", () =>
    Effect.gen(function* () {
      const checked = planWith(resource("Vpc"), resource("Reaper"));
      const written = yield* Ref.make(false);
      const applied = yield* applyIfUnchanged(checked, checked, recordingWrite(written));
      expect(applied).toBe("applied");
      const wrote = yield* Ref.get(written);
      assertTrue(wrote);

      const drifts = [
        planWith(resource("Vpc"), resource("Reaper"), resource("FlowLog")),
        planWith(resource("Vpc")),
        planWith(resource("Vpc", { propsDigest: "d2" }), resource("Reaper")),
        planWith(resource("Vpc", { action: "update" }), resource("Reaper")),
        planWith(resource("Vpc", { bindings: ["Vpc/Grant create"] }), resource("Reaper")),
        planWith(resource("Vpc", { bindingsDigest: "b2" }), resource("Reaper")),
        planWith(resource("Vpc", { secretsDigest: "s2" }), resource("Reaper")),
        CheckedPlan.make({ ...checked, stage: "dev-alice" }),
        CheckedPlan.make({ ...checked, expectation: "bootstrap" }),
      ];
      const differences = A.map(drifts, (current) => planDifferences(current)(checked));
      expect(differences).toStrictEqual([
        { added: ["FlowLog"], removed: [], changed: [] },
        { added: [], removed: ["Reaper"], changed: [] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["stage"] },
        { added: [], removed: [], changed: ["expectation"] },
      ]);
      const untouched = yield* Ref.make(false);
      const tags = yield* Effect.forEach(
        A.take(drifts, 8),
        (current) => outcomeOf(applyIfUnchanged(checked, current, recordingWrite(untouched))),
        { concurrency: 1 }
      );
      expect(tags).toStrictEqual(A.replicate("PlanDrift", 8));
      const touched = yield* Ref.get(untouched);
      assertFalse(touched);
    })
  );

  it.effect("refuses a deploy plan that fails the plan check even when it equals the checked plan", () =>
    Effect.gen(function* () {
      const refused = [
        planWith(resource("Vpc", { action: "replace" })),
        planWith(resource("Reaper", { bindings: ["Reaper/Reaper unbind"] })),
        CheckedPlan.make({ ...planWith(), actions: [CheckedAction.make({ fqn: "Seed", action: "run" })] }),
        planWith(resource("Vpc", { action: "update", pendingReplacement: true })),
        expecting("bootstrap", resource("Vpc", { action: "update" })),
      ];
      const written = yield* Ref.make(false);
      const tags = yield* Effect.forEach(
        refused,
        (plan) => outcomeOf(applyIfUnchanged(plan, plan, recordingWrite(written))),
        { concurrency: 1 }
      );
      expect(tags).toStrictEqual(A.replicate("PlanRefused", refused.length));
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
    })
  );
});

describe("CiRunners checked-plan reading", () => {
  it.effect("reads stack actions and fingerprints binding payloads, not only binding ids", () =>
    Effect.gen(function* () {
      const withActions = yield* readWith(
        enginePlan({}, { Seed: { action: "run", def: { FQN: "Seed", LogicalId: "Seed", Type: "Test.Seed" } } })
      );
      expect(withActions.actions).toStrictEqual([CheckedAction.make({ fqn: "Seed", action: "run" })]);
      const dropped = CheckedPlan.make({
        ...withActions,
        actions: [CheckedAction.make({ fqn: "Seed", action: "delete" })],
      });
      expect(planDifferences(dropped, withActions).changed).toStrictEqual(["action:Seed"]);

      const granted = (condition: string) =>
        single({ action: "update", props: {}, bindings: [{ sid: "Grant", action: "update", data: { condition } }] });
      const a = yield* readWith(granted("aws:SourceArn"));
      const b = yield* readWith(granted("aws:SourceAccount"));
      expect(a.resources[0]?.bindings).toStrictEqual(b.resources[0]?.bindings);
      expect(planDifferences(a, b).changed).toStrictEqual(["Vpc"]);
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(applyIfUnchanged(a, b, recordingWrite(written)));
      expect(outcome).toBe("PlanDrift");
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
    })
  );

  it.effect("fingerprints redacted values under a salt, so a changed secret drifts and no secret is stored", () =>
    Effect.gen(function* () {
      const withSecret = (secret: string) =>
        single({
          action: "create",
          props: { value: Redacted.make(secret), list: [{ key: Redacted.make("k") }], later: Effect.void },
        });
      const a = yield* readWith(withSecret("secret-a"));
      const again = yield* readWith(withSecret("secret-a"));
      const b = yield* readWith(withSecret("secret-b"));
      const resalted = yield* readWith(withSecret("secret-a"), { salt: Str.repeat(32)("11") });
      expect(a.resources[0]?.propsDigest).toBe(b.resources[0]?.propsDigest);
      expect(a.resources[0]?.secretsDigest).toBe(again.resources[0]?.secretsDigest);
      expect(a.resources[0]?.secretsDigest).not.toBe(b.resources[0]?.secretsDigest);
      expect(a.resources[0]?.secretsDigest).not.toBe(resalted.resources[0]?.secretsDigest);
      const text = yield* S.encodeEffect(CheckedPlanJson)(a);
      assertFalse(Str.includes("secret-a")(text));
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(applyIfUnchanged(a, b, recordingWrite(written)));
      expect(outcome).toBe("PlanDrift");
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
      const plain = yield* readWith(single({ action: "create", props: { name: "plain" } }));
      expect(plain.resources[0]?.secretsDigest).toBe("");
    })
  );

  it.effect("flags an update that would also finish a pending replacement", () =>
    Effect.gen(function* () {
      const replaced = yield* readWith(single({ action: "update", props: {}, state: { status: "replaced" } }));
      const updating = yield* readWith(single({ action: "update", props: {}, state: { status: "updating" } }));
      const settled = yield* readWith(single({ action: "update", props: {}, state: { status: "created" } }));
      expect(A.map([replaced, updating, settled], (plan) => plan.resources[0]?.pendingReplacement)).toStrictEqual([
        true,
        false,
        false,
      ]);
      const refusal = yield* checkEnginePlan(replaced).pipe(Effect.flip);
      expect(A.map(refusal.violations, (violation) => violation._tag)).toStrictEqual(["PendingReplacement"]);
    })
  );

  it.effect("mints a 32-byte salt", () =>
    Effect.gen(function* () {
      const minted = yield* newSecretSalt.pipe(
        Effect.provideService(SecureRandom.SecureRandom, SecureRandom.make(SecureRandom.randomBytesUnsafe))
      );
      expect(minted).toMatch(/^[0-9a-f]{64}$/u);
    })
  );
});

describe("CiRunners cutover expectations", () => {
  const group = (overrides: Partial<CheckedResource> = {}) => resource("DefaultSecurityGroup", overrides);

  it.effect("takes any checked plan as routine", () =>
    Effect.sync(() => {
      expect(tagsOf(planWith(resource("Vpc", { action: "update" })))).toStrictEqual([]);
    })
  );

  it.effect("takes only creates without DefaultSecurityGroup for step 1a", () =>
    Effect.sync(() => {
      expect(tagsOf(expecting("bootstrap", resource("Vpc", { bindings: ["Vpc/Grant create"] })))).toStrictEqual([]);
      expect(tagsOf(expecting("bootstrap", resource("Vpc", { action: "update" })))).toStrictEqual(["UnexpectedChange"]);
      expect(tagsOf(expecting("bootstrap", resource("Vpc", { bindings: ["Vpc/Grant update"] })))).toStrictEqual([
        "UnexpectedChange",
      ]);
      expect(tagsOf(expecting("bootstrap", group()))).toStrictEqual(["UnexpectedChange"]);
    })
  );

  it.effect("takes exactly one DefaultSecurityGroup create and noops for step 1b", () =>
    Effect.sync(() => {
      const quiet = resource("Vpc", { action: "noop", bindings: ["Vpc/Grant noop"] });
      expect(tagsOf(expecting("default-security-group", group(), quiet))).toStrictEqual([]);
      expect(tagsOf(expecting("default-security-group", quiet))).toStrictEqual(["UnexpectedChange"]);
      expect(tagsOf(expecting("default-security-group", group({ action: "update" }), quiet))).toStrictEqual([
        "UnexpectedChange",
      ]);
      expect(
        tagsOf(expecting("default-security-group", group({ bindings: ["DefaultSecurityGroup/X create"] })))
      ).toStrictEqual(["UnexpectedChange"]);
      expect(tagsOf(expecting("default-security-group", group(), resource("Vpc", { action: "update" })))).toStrictEqual(
        ["UnexpectedChange"]
      );
      expect(
        tagsOf(
          expecting("default-security-group", group(), resource("Vpc", { action: "noop", bindings: ["Vpc/G create"] }))
        )
      ).toStrictEqual(["UnexpectedChange"]);
    })
  );
});
