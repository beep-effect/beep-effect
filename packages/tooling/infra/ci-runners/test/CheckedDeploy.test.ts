import * as AWS from "@alchemy.run/aws";
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
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeAppKeyBase64, fakeWebhookSecret, productionCredentialEnv } from "./support/Credentials.ts";
import * as Fakes from "./support/Fakes.ts";
import type { PlanExpectation } from "@beep/infra-ci-runners/CheckedDeploy";
import type { Plan } from "alchemy/Plan";

const productionEnvironment = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({
    CI: "true",
    CI_RUNNERS_GITHUB_APP_ID: "12345",
    CI_RUNNERS_GITHUB_APP_KEY_BASE64: fakeAppKeyBase64,
    CI_RUNNERS_GITHUB_WEBHOOK_SECRET: fakeWebhookSecret,
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

const readWith = (
  plan: Plan,
  options: { readonly salt?: string; readonly expectation?: PlanExpectation; readonly sourceTree?: string } = {}
) =>
  readEnginePlan({
    stage: "prod",
    plan,
    salt: options.salt ?? salt,
    expectation: options.expectation ?? "routine",
    sourceTree: options.sourceTree ?? "tree-1",
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
    baselineDigest: "",
    pendingReplacement: false,
    ...overrides,
  });

const planWith = (...resources: ReadonlyArray<CheckedResource>) =>
  CheckedPlan.make({
    stage: "prod",
    expectation: "routine",
    secretSalt: salt,
    sourceTree: "tree-1",
    resources,
    actions: [],
  });

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

  const secrets = Fakes.harness({ stage: "prod" });
  secrets.provider("fingerprints no planned resource by the App id alone", (stack) =>
    Effect.gen(function* () {
      const withWebhookSecret = (webhookSecret: string) =>
        stack
          .plan(
            program.pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({
                  CI: "true",
                  ...productionCredentialEnv,
                  CI_RUNNERS_GITHUB_WEBHOOK_SECRET: webhookSecret,
                })
              )
            )
          )
          .pipe(Effect.flatMap((plan) => readWith(plan)));
      const first = yield* withWebhookSecret(fakeWebhookSecret);
      const second = yield* withWebhookSecret("fedcba9876543210fedcba9876543210");
      const fingerprinted = A.filter(first.resources, (row) => Str.isNonEmpty(row.secretsDigest));
      // The App id parameter, the App key parameter and the webhook secret parameter at least.
      assertTrue(fingerprinted.length >= 3);
      assertTrue(A.some(fingerprinted, (row) => row.fqn === "Runners/AppId"));
      // Only the webhook secret changed, yet every fingerprint moves: none covers the App id (or any one value) alone.
      const changed = A.filter(fingerprinted, (row) =>
        A.some(second.resources, (other) => other.fqn === row.fqn && other.secretsDigest !== row.secretsDigest)
      );
      expect(A.map(changed, (row) => row.fqn)).toStrictEqual(A.map(fingerprinted, (row) => row.fqn));
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

describe("CiRunners checked-plan properties", () => {
  it.effect.prop(
    "round-trips every checked plan through its JSON codec",
    [Arbitrary.schema(CheckedPlan)],
    ([plan]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(CheckedPlanJson)(plan);
        const decoded = yield* S.decodeEffect(CheckedPlanJson)(text);
        // Arbitrary values carry null prototypes, so compare by the schema's own equivalence.
        const same = S.toEquivalence(CheckedPlan)(decoded, plan);
        assertTrue(same);
      }),
    { arbitrary: { runs: 25 } }
  );

  it.prop(
    "never reports a checked plan as drifting from itself",
    [Arbitrary.schema(CheckedPlan)],
    ([plan]) => {
      expect(planDifferences(plan, plan)).toStrictEqual({ added: [], removed: [], changed: [] });
    },
    { arbitrary: { runs: 25 } }
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

  it.effect("binds an update to its starting state: the same 7 -> 30 passes, 90 -> 30 drifts", () =>
    Effect.gen(function* () {
      const retention = (from: number) =>
        single({
          action: "update",
          props: { retention: 30 },
          state: { status: "created", props: { retention: from }, attr: { retention: from } },
        });
      const checked = yield* readWith(retention(7));
      const same = yield* readWith(retention(7));
      const moved = yield* readWith(retention(90));
      expect(planDifferences(checked, same)).toStrictEqual({ added: [], removed: [], changed: [] });
      expect(planDifferences(checked, moved).changed).toStrictEqual(["Vpc"]);
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(applyIfUnchanged(checked, moved, recordingWrite(written)));
      expect(outcome).toBe("PlanDrift");
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
      const created = yield* readWith(single({ action: "create", props: { retention: 30 } }));
      expect(A.map(created.resources, (row) => row.baselineDigest)).toStrictEqual([""]);
    })
  );

  it.effect("fingerprints a Duration by its value, so 60 s and 90 s timeouts drift", () =>
    Effect.gen(function* () {
      const timeout = (seconds: number) => single({ action: "create", props: { timeout: Duration.seconds(seconds) } });
      const checked = yield* readWith(timeout(60));
      const same = yield* readWith(timeout(60));
      const longer = yield* readWith(timeout(90));
      expect(planDifferences(checked, same)).toStrictEqual({ added: [], removed: [], changed: [] });
      expect(planDifferences(checked, longer).changed).toStrictEqual(["Vpc"]);
    })
  );

  it.effect("binds the plan to its source tree, so a rebuilt bundle from other sources drifts", () =>
    Effect.gen(function* () {
      const reaper = single({ action: "update", props: { main: "reaper.ts" } });
      const checked = yield* readWith(reaper, { sourceTree: "tree-1" });
      const rebuilt = yield* readWith(reaper, { sourceTree: "tree-2" });
      expect(planDifferences(checked, rebuilt).changed).toStrictEqual(["sourceTree"]);
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(applyIfUnchanged(checked, rebuilt, recordingWrite(written)));
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
      const props = (plan: CheckedPlan) => A.map(plan.resources, (row) => row.propsDigest);
      const secrets = (plan: CheckedPlan) => A.map(plan.resources, (row) => row.secretsDigest);
      expect(props(a)).toStrictEqual(props(b));
      expect(secrets(a)).toStrictEqual(secrets(again));
      expect(secrets(a)).not.toStrictEqual(secrets(b));
      expect(secrets(a)).not.toStrictEqual(secrets(resalted));
      const text = yield* S.encodeEffect(CheckedPlanJson)(a);
      assertFalse(Str.includes("secret-a")(text));
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(applyIfUnchanged(a, b, recordingWrite(written)));
      expect(outcome).toBe("PlanDrift");
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
      const plain = yield* readWith(single({ action: "create", props: { name: "plain" } }));
      expect(secrets(plain)).toStrictEqual([""]);
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

  it.effect("takes any checked plan as routine except an adoption", () =>
    Effect.sync(() => {
      expect(tagsOf(planWith(resource("Vpc", { action: "update" })))).toStrictEqual([]);
      expect(tagsOf(planWith(resource("Vpc", { action: "adopted" })))).toStrictEqual(["UnexpectedChange"]);
      expect(tagsOf(planWith(group({ action: "adopted" })))).toStrictEqual(["UnexpectedChange"]);
    })
  );

  it.effect("re-runs a partial step 1a: noops the failed run created pass, nothing else does", () =>
    Effect.sync(() => {
      const created = resource("Subnet", { action: "noop", bindings: ["Subnet/Grant noop"] });
      expect(tagsOf(expecting("bootstrap", created, resource("Vpc")))).toStrictEqual([]);
      expect(
        tagsOf(expecting("bootstrap", resource("Vpc", { action: "noop", bindings: ["Vpc/G create"] })))
      ).toStrictEqual(["UnexpectedChange"]);
      expect(tagsOf(expecting("bootstrap", resource("Vpc", { action: "adopted" })))).toStrictEqual([
        "UnexpectedChange",
      ]);
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
      // Alchemy reads the AWS-made group before it has a state row, so step 1b plans it `adopted`.
      expect(tagsOf(expecting("default-security-group", group({ action: "adopted" }), quiet))).toStrictEqual([]);
      expect(
        tagsOf(
          expecting("default-security-group", group({ action: "adopted", bindings: ["DefaultSecurityGroup/X create"] }))
        )
      ).toStrictEqual(["UnexpectedChange"]);
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

describe("CiRunners step 1b from the post-1a state", () => {
  // Step 1a left the VPC and no DefaultSecurityGroup row; the provider then reads the AWS-made group and Alchemy adopts it.
  const vpcOnly = AWS.EC2.Vpc("Vpc", { cidrBlock: "10.89.0.0/16" });
  const withDefaultGroup = Effect.gen(function* () {
    const vpc = yield* vpcOnly;
    yield* AWS.EC2.DefaultSecurityGroup("DefaultSecurityGroup", { vpcId: vpc.vpcId, ingress: [], egress: [] });
  });
  const postBootstrap = Fakes.harness({ stage: "prod", adoptDefaultGroup: true });
  postBootstrap.provider("plans the default group adopted: step 1b takes it, routine refuses it", (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(vpcOnly);
      const plan = yield* stack.plan(withDefaultGroup);
      const step1b = yield* readWith(plan, { expectation: "default-security-group" });
      const group = A.filter(step1b.resources, (resource) => resource.fqn === "DefaultSecurityGroup");
      expect(A.map(group, (resource) => [resource.action, resource.bindings])).toStrictEqual([["adopted", []]]);
      expect(tagsOf(step1b)).toStrictEqual([]);
      const routine = yield* readWith(plan, { expectation: "routine" });
      expect(tagsOf(routine)).toStrictEqual(["UnexpectedChange"]);
      // The adopted row is drift-compared like any other: the same plan read again matches it.
      const again = yield* readWith(plan, { expectation: "default-security-group" });
      expect(planDifferences(step1b, again)).toStrictEqual({ added: [], removed: [], changed: [] });
    })
  );
});
