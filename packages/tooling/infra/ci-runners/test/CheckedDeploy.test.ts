import * as AWS from "@alchemy.run/aws";
import {
  applyIfUnchanged,
  CheckedAction,
  CheckedPlan,
  CheckedPlanJson,
  CheckedResource,
  checkEnginePlan,
  expectationViolations,
  inferredCodeChange,
  newSecretSalt,
  planDifferences,
  planRowLine,
  planRowsDigest,
  readEnginePlan,
  requirePlanDigest,
  toReading,
} from "@beep/infra-ci-runners/CheckedDeploy";
import { program } from "@beep/infra-ci-runners/CiRunners";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Output from "alchemy/Output";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeAppKeyBase64, fakeWebhookSecret, productionCredentialEnv } from "./support/Credentials.ts";
import * as Fakes from "./support/Fakes.ts";
import type { PlanExpectation } from "@beep/infra-ci-runners/CheckedDeploy";
import type { Plan } from "alchemy/Plan";
import type { ResourceLike } from "alchemy/Resource";

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
    resume: "none",
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
    readonly type?: string;
    readonly deleteFirst?: boolean;
  }
) => ({
  resource: { FQN: fqn, LogicalId: fqn, Type: node.type ?? "Test.Resource" },
  action: node.action,
  ...(node.deleteFirst === undefined ? {} : { deleteFirst: node.deleteFirst }),
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

describe("CiRunners plan-rows digest", () => {
  // The stand-in digest is the hex of its input, so equal rows give equal digests and different rows differ.
  const sha256 = Effect.provideService(Digest.Digest, hexDigest);
  const vpc = resource("Vpc");
  const reaper = resource("Reaper", { action: "noop", bindings: ["Reaper/Invoke create"] });

  it("prints one row per resource: the action, then each binding action", () => {
    expect(planRowLine(vpc)).toBe("[Vpc] create");
    expect(planRowLine(reaper)).toBe("[Reaper] noop | binding Reaper/Invoke create");
  });

  it.effect("reads rows only: order, salt, source tree and property digests do not move it", () =>
    Effect.gen(function* () {
      const digest = yield* planRowsDigest(planWith(vpc, reaper));
      expect(digest).toMatch(/^[0-9a-f]+$/);
      const reordered = yield* planRowsDigest(planWith(reaper, vpc));
      const resalted = yield* planRowsDigest(
        CheckedPlan.make({ ...planWith(vpc, reaper), secretSalt: "ff", sourceTree: "tree-2" })
      );
      const otherProps = yield* planRowsDigest(
        planWith(resource("Vpc", { propsDigest: "d2", secretsDigest: "s2" }), reaper)
      );
      expect([reordered, resalted, otherProps]).toStrictEqual([digest, digest, digest]);
    }).pipe(sha256)
  );

  it.effect("moves with an action, a binding action, a resource and a stack action", () =>
    Effect.gen(function* () {
      const digest = yield* planRowsDigest(planWith(vpc, reaper));
      const others = yield* Effect.forEach(
        [
          planWith(resource("Vpc", { action: "replace" }), reaper),
          planWith(vpc, resource("Reaper", { action: "noop", bindings: ["Reaper/Invoke delete"] })),
          planWith(vpc),
          planWith(vpc, reaper, resource("Extra")),
          CheckedPlan.make({
            ...planWith(vpc, reaper),
            actions: [CheckedAction.make({ fqn: "Seed", action: "run" })],
          }),
        ],
        planRowsDigest,
        { concurrency: 1 }
      );
      expect(A.filter(others, (other) => other === digest)).toStrictEqual([]);
      expect(A.dedupe(others).length).toBe(others.length);
    }).pipe(sha256)
  );

  it.effect("holds a deploy to the expected digest and passes when none is named", () =>
    Effect.gen(function* () {
      const plan = planWith(vpc, reaper);
      const digest = yield* planRowsDigest(plan);
      const accepted = yield* Effect.forEach(
        [O.none(), O.some(""), O.some(` sha256:${Str.toUpperCase(digest)}\n`)],
        (expected) => requirePlanDigest(plan, expected),
        { concurrency: 1 }
      );
      expect(accepted).toStrictEqual([digest, digest, digest]);
      const refused = yield* Effect.flip(requirePlanDigest(planWith(vpc), O.some(digest)));
      expect([refused._tag, refused.expected]).toStrictEqual(["PlanDigestMismatch", digest]);
      // A refusal comes before the write: the deploy runs the digest check, then applyIfUnchanged.
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(
        requirePlanDigest(planWith(vpc), O.some(digest)).pipe(Effect.andThen(recordingWrite(written)))
      );
      expect(outcome).toBe("PlanDigestMismatch");
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
    }).pipe(sha256)
  );
});

describe("CiRunners plan-row changed properties", () => {
  const sha256 = Effect.provideService(Digest.Digest, hexDigest);
  const updated = (props: unknown, applied: unknown, node: Partial<Parameters<typeof engineNode>[1]> = {}) =>
    single({ action: "update", props, state: { status: "created", props: applied }, ...node });
  const rowOf = (plan: Plan) =>
    Effect.map(readWith(plan), (checked) =>
      A.map(checked.resources, (row) => [row.changedProperties, planRowLine(row)])
    );
  // A resource the plan has not created yet: its attribute is an Output until apply.
  const queue = { Type: "AWS.SQS.Queue", FQN: "Runners/Queue", LogicalId: "Queue" } as unknown as ResourceLike;
  const webhook = (props: unknown, applied: unknown, bindingAction = "noop") =>
    enginePlan({
      Webhook: engineNode("Runners/Webhook", {
        action: "update",
        type: "AWS.Lambda.Function",
        props,
        bindings: [{ sid: "Webhook", action: bindingAction, data: { policy: 1 } }],
        state: { status: "created", props: applied },
      }),
    });

  it.effect("names the one declared property an update changes, never its value", () =>
    Effect.gen(function* () {
      const rows = yield* rowOf(updated({ retention: 30, name: "flow" }, { retention: 7, name: "flow" }));
      expect(rows).toStrictEqual([[["retention"], "[Vpc] update | changes retention"]]);
      assertFalse(A.some(rows, ([, line]) => Str.includes("30")(String(line))));
    })
  );

  it.effect("sorts several changed properties, a dropped one included", () =>
    Effect.gen(function* () {
      const rows = yield* rowOf(updated({ zeta: 2, same: 1, alpha: 3 }, { zeta: 1, same: 1, alpha: 1, dropped: true }));
      expect(rows).toStrictEqual([
        [["alpha", "dropped", "zeta"], "[Vpc] update | changes alpha | changes dropped | changes zeta"],
      ]);
    })
  );

  it.effect("labels a property whose new value is known only after apply", () =>
    Effect.gen(function* () {
      const rows = yield* rowOf(
        updated({ queueUrl: Output.of(queue), name: "flow" }, { queueUrl: "https://queue", name: "flow" })
      );
      expect(rows).toStrictEqual([[["queueUrl (unresolved)"], "[Vpc] update | changes queueUrl (unresolved)"]]);
    })
  );

  it.effect("infers a code change for a Lambda update that changes no declared property and no binding", () =>
    Effect.gen(function* () {
      const props = { functionName: "beep-fleet-prod-webhook", env: { CONFIG: "{}" }, timeout: Duration.seconds(30) };
      const rows = yield* rowOf(webhook(props, props));
      expect(rows).toStrictEqual([
        [
          [inferredCodeChange],
          "[Runners/Webhook] update | binding Runners/Webhook/Webhook noop | changes code (bundle hash, inferred)",
        ],
      ]);
      assertTrue(Str.includes("inferred")(inferredCodeChange));
      // A binding that changes is the attribution, so no code change is inferred.
      const rebound = yield* rowOf(webhook(props, props, "update"));
      expect(rebound).toStrictEqual([[[], "[Runners/Webhook] update | binding Runners/Webhook/Webhook update"]]);
    })
  );

  it.effect("names a changed Lambda env key and infers no code change", () =>
    Effect.gen(function* () {
      const rows = yield* rowOf(
        webhook({ functionName: "f", env: { CONFIG: '{"b":2}' } }, { functionName: "f", env: { CONFIG: '{"b":1}' } })
      );
      expect(rows).toStrictEqual([
        [["env"], "[Runners/Webhook] update | binding Runners/Webhook/Webhook noop | changes env"],
      ]);
    })
  );

  it.effect("infers nothing for an update of another type that changes no declared property", () =>
    Effect.gen(function* () {
      const rows = yield* rowOf(updated({ name: "flow" }, { name: "flow" }));
      expect(rows).toStrictEqual([[[], "[Vpc] update"]]);
    })
  );

  it.effect("keeps create and noop rows as they print today", () =>
    Effect.gen(function* () {
      const created = yield* rowOf(single({ action: "create", props: { retention: 30 } }));
      const quiet = yield* rowOf(
        single({ action: "noop", props: { retention: 30 }, state: { status: "created", props: { retention: 7 } } })
      );
      const fn = yield* rowOf(
        enginePlan({
          Webhook: engineNode("Runners/Webhook", { action: "create", type: "AWS.Lambda.Function", props: {} }),
        })
      );
      expect([created, quiet, fn]).toStrictEqual([
        [[[], "[Vpc] create"]],
        [[[], "[Vpc] noop"]],
        [[[], "[Runners/Webhook] create"]],
      ]);
    })
  );

  it.effect("moves the digest and the drift signature with the changed-properties list", () =>
    Effect.gen(function* () {
      const changing = (...changedProperties: ReadonlyArray<string>) =>
        planWith(resource("Vpc", { action: "update", changedProperties }));
      const none = changing();
      const retention = changing("retention");
      const timeout = changing("timeout");
      const both = changing("retention", "timeout");
      const digests = yield* Effect.forEach([none, retention, timeout, both], planRowsDigest, { concurrency: 1 });
      expect(A.dedupe(digests).length).toBe(4);
      expect([planDifferences(none, retention).changed, planDifferences(retention, timeout).changed]).toStrictEqual([
        ["Vpc"],
        ["Vpc"],
      ]);
      expect(planDifferences(retention, changing("retention"))).toStrictEqual({ added: [], removed: [], changed: [] });
      // The reading the plan check takes carries the same names.
      expect(A.map(toReading(both).resources, (row) => row.changedProperties)).toStrictEqual([
        ["retention", "timeout"],
      ]);
    }).pipe(sha256)
  );
});

describe("CiRunners resumed bootstrap", () => {
  const mappingType = "AWS.Lambda.EventSourceMapping";
  // The shape of the live rows after the failed step 1a: checkpointed before the source queue existed, so the
  // stored props hold no eventSourceArn, the row is marked incomplete and it records no outputs.
  const liveMappingState = {
    status: "creating",
    propsIncomplete: true,
    props: { batchSize: 10, functionResponseTypes: ["ReportBatchItemFailures"] },
    bindings: [],
  };
  const mappingProps = {
    functionName: "beep-fleet-prod-heavy-scale-up",
    eventSourceArn: "arn:aws:sqs:us-east-1:832907639880:beep-fleet-prod-heavy-build",
    batchSize: 10,
  };
  const mapping = (node: Partial<Parameters<typeof engineNode>[1]> = {}) =>
    enginePlan({
      Source: engineNode("Runners/Poolheavy/ScaleUpSource", {
        action: "replace",
        type: mappingType,
        deleteFirst: false,
        props: mappingProps,
        state: liveMappingState,
        ...node,
      }),
    });
  const read = (plan: Plan, expectation: PlanExpectation) => readWith(plan, { expectation });
  const refusedTags = (plan: CheckedPlan) =>
    Effect.match(checkEnginePlan(plan), {
      onFailure: (refusal) => A.map(refusal.violations, (violation) => violation._tag),
      onSuccess: () => A.empty<string>(),
    });

  it.effect("takes the replace of a mapping generation that never existed, labelled, in step 1a only", () =>
    Effect.gen(function* () {
      const bootstrap = yield* read(mapping(), "bootstrap");
      expect(A.map(bootstrap.resources, (row) => [row.action, row.resume])).toStrictEqual([
        ["replace", "empty-replace"],
      ]);
      expect(A.map(bootstrap.resources, planRowLine)).toStrictEqual([
        "[Runners/Poolheavy/ScaleUpSource] resumed create (replace of an empty generation)",
      ]);
      const bootstrapTags = yield* refusedTags(bootstrap);
      expect(bootstrapTags).toStrictEqual([]);
      // Routine and step 1b read the same row as the replace it is, and refuse it.
      const routine = yield* read(mapping(), "routine");
      const routineTags = yield* refusedTags(routine);
      expect(routineTags).toStrictEqual(["DestructiveAction"]);
      const step1b = yield* read(mapping(), "default-security-group");
      const step1bTags = yield* refusedTags(step1b);
      assertTrue(A.contains(step1bTags, "DestructiveAction"));
    })
  );

  it.effect(
    "refuses every other replace in step 1a: outputs, complete props, delete-first, another type, another state",
    () =>
      Effect.gen(function* () {
        const others = [
          mapping({ state: { ...liveMappingState, attr: { uuid: "0000" } } }),
          mapping({ state: { ...liveMappingState, propsIncomplete: undefined } }),
          mapping({ deleteFirst: true }),
          mapping({ type: "AWS.SQS.Queue" }),
          mapping({ type: "AWS.Lambda.Function" }),
          mapping({ state: { ...liveMappingState, status: "created" } }),
        ];
        const outcomes = yield* Effect.forEach(
          others,
          Effect.fnUntraced(function* (plan) {
            const checked = yield* read(plan, "bootstrap");
            const tags = yield* refusedTags(checked);
            return [A.map(checked.resources, (row) => row.resume), tags] as const;
          }),
          { concurrency: 1 }
        );
        expect(outcomes).toStrictEqual(A.replicate([["none"], ["UnexpectedChange", "DestructiveAction"]] as const, 6));
      })
  );

  it.effect("labels a resumed create and takes its saved bindings as noop or update, never a delete", () =>
    Effect.gen(function* () {
      const fn = (action: string, state: unknown, bindingAction: string) =>
        enginePlan({
          Webhook: engineNode("Runners/Webhook", {
            action,
            type: "AWS.Lambda.Function",
            props: { functionName: "beep-fleet-prod-webhook" },
            bindings: [{ sid: "Webhook", action: bindingAction, data: { policy: 1 } }],
            state,
          }),
        });
      const creating = { status: "creating", props: { functionName: "beep-fleet-prod-webhook" }, bindings: [{}] };
      const verdict = (action: string, state: unknown, bindingAction: string) =>
        read(fn(action, state, bindingAction), "bootstrap").pipe(
          Effect.flatMap((checked) =>
            Effect.map(refusedTags(checked), (tags) => [A.map(checked.resources, planRowLine), tags] as const)
          )
        );
      // Resumed rows: the binding the failed run saved diffs noop or update; a first-time create is still fine.
      const resumed = yield* Effect.forEach(
        ["noop", "update", "create"],
        (bindingAction) => verdict("create", creating, bindingAction),
        { concurrency: 1 }
      );
      expect(resumed).toStrictEqual(
        A.map(["noop", "update", "create"], (bindingAction) => [
          [`[Runners/Webhook] resumed create | binding Runners/Webhook/Webhook ${bindingAction}`],
          [],
        ])
      );
      const [, deleted] = yield* verdict("create", creating, "delete");
      assertTrue(A.contains(deleted, "UnexpectedChange") && A.contains(deleted, "DestructiveBinding"));
      // A row planned for the first time takes only create bindings.
      const fresh = { status: "created" };
      const first = yield* verdict("create", fresh, "create");
      expect(first).toStrictEqual([["[Runners/Webhook] create | binding Runners/Webhook/Webhook create"], []]);
      const tagsOnly = (action: string, bindingAction: string) =>
        Effect.map(verdict(action, fresh, bindingAction), ([, tags]) => tags);
      const firstRefused = yield* Effect.forEach(
        ["noop", "update"],
        (bindingAction) => tagsOnly("create", bindingAction),
        { concurrency: 1 }
      );
      expect(firstRefused).toStrictEqual([["UnexpectedChange"], ["UnexpectedChange"]]);
      // A row the failed run finished stays a noop with noop bindings only.
      const finished = yield* Effect.forEach(
        ["noop", "update", "create"],
        (bindingAction) => tagsOnly("noop", bindingAction),
        { concurrency: 1 }
      );
      expect(finished).toStrictEqual([[], ["UnexpectedChange"], ["UnexpectedChange"]]);
    })
  );

  it.effect("moves the digest and the drift signature with the resume label", () =>
    Effect.gen(function* () {
      const plain = planWith(resource("Reaper"));
      const resumed = planWith(resource("Reaper", { resume: "create" }));
      const digests = yield* Effect.forEach([plain, resumed], planRowsDigest, { concurrency: 1 });
      expect(A.dedupe(digests).length).toBe(2);
      expect(planDifferences(plain, resumed).changed).toStrictEqual(["Reaper"]);
    }).pipe(Effect.provideService(Digest.Digest, hexDigest))
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
      // The full gate under the step-1b expectation passes the adopted row.
      yield* checkEnginePlan(step1b);
      const routine = yield* readWith(plan, { expectation: "routine" });
      expect(tagsOf(routine)).toStrictEqual(["UnexpectedChange"]);
      // The adopted row is drift-compared like any other: the same plan read again matches it.
      const again = yield* readWith(plan, { expectation: "default-security-group" });
      expect(planDifferences(step1b, again)).toStrictEqual({ added: [], removed: [], changed: [] });
    })
  );
});
