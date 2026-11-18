/**
 * The checked deploy of the `CiRunners` stack: the deploy applies exactly the
 * change set the plan check approved, or nothing.
 *
 * **Details**
 *
 * The plan step reads the engine plan into a {@link CheckedPlan}: every
 * resource with its action, binding actions and a digest of its declared
 * properties, plus every stack action. It runs {@link checkPlan} on it and
 * saves it. The deploy step plans again under the stage lease, reads that plan
 * the same way and checks it again, then compares it with the saved plan.
 * {@link applyIfUnchanged} refuses with {@link PlanDrift} on any difference
 * before the apply effect runs, so the plan that is applied is the plan that
 * was checked, and it is the very plan object the comparison read.
 *
 * Property digests are SHA-256 over Alchemy's own redacted YAML rendering of
 * the declared properties: a `Redacted` value renders as a fixed marker, so no
 * secret reaches the digest input, and a value known only after apply renders
 * as another fixed marker.
 *
 * @packageDocumentation
 * @category validation
 * @since 0.0.0
 */

import { hmacSha256Hex } from "@beep/alchemy-github-runners/WebCrypto";
import { $InfraCiRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { formatYamlLines } from "alchemy/Cli/PropertyDiff";
import * as Output from "alchemy/Output";
import { describePlan, describeResource } from "alchemy/Plan";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { checkPlan, PlanAction, PlannedResource, PlanReading, PlanViolation } from "./PlanCheck.ts";
import type { CRUD, Plan } from "alchemy/Plan";

const $I = $InfraCiRunnersId.create("CheckedDeploy");

/**
 * One resource of a checked plan.
 *
 * **Example** (A created VPC)
 *
 * ```ts
 * import { CheckedResource } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "00", bindingsDigest: "", secretsDigest: "", pendingReplacement: false })
 * console.log(vpc.action) // "create"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckedResource extends S.Opaque<CheckedResource, { readonly brand: unique symbol }>()(
  S.Struct({
    fqn: S.String,
    type: S.String,
    action: PlanAction,
    bindings: S.Array(S.String),
    propsDigest: S.String,
    bindingsDigest: S.String,
    secretsDigest: S.String,
    pendingReplacement: S.Boolean,
  }).pipe(
    $I.annoteSchema("CheckedResource", {
      description:
        "A planned resource: action, `<fqn>/<sid> <action>` bindings, digests of its declared properties, binding payloads and secrets, and whether it holds a pending replacement.",
    })
  )
) {}

/**
 * One stack action of a checked plan.
 *
 * **Example** (A planned run)
 *
 * ```ts
 * import { CheckedAction } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(CheckedAction.make({ fqn: "Seed", action: "run" }).action) // "run"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckedAction extends S.Opaque<CheckedAction, { readonly brand: unique symbol }>()(
  S.Struct({ fqn: S.String, action: S.Literals(["run", "delete", "noop"]) }).pipe(
    $I.annoteSchema("CheckedAction", { description: "A planned stack action." })
  )
) {}

/**
 * What a deploy may change: `routine` takes any plan the plan check
 * accepts; `bootstrap` (cutover step 1a) takes creates only, with every
 * binding a create and no `DefaultSecurityGroup`; `default-security-group`
 * (step 1b) takes exactly one create, `DefaultSecurityGroup` with no
 * bindings, and every other resource `noop` with no binding change.
 *
 * **Example** (The step 1b expectation)
 *
 * ```ts
 * import { PlanExpectation } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(PlanExpectation.is["default-security-group"]("default-security-group")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanExpectation = LiteralKit(["routine", "bootstrap", "default-security-group"]).pipe(
  $I.annoteSchema("PlanExpectation", { description: "The change set a deploy is expected to apply." })
);

/**
 * Decoded expectation.
 *
 * @category models
 * @since 0.0.0
 */
export type PlanExpectation = typeof PlanExpectation.Type;

/**
 * A whole plan, sorted by FQN, as the gate checked it.
 *
 * **Example** (An empty plan)
 *
 * ```ts
 * import { CheckedPlan } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [], actions: [] }).stage) // "prod"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckedPlan extends S.Opaque<CheckedPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    stage: S.String,
    expectation: PlanExpectation,
    secretSalt: S.String,
    resources: S.Array(CheckedResource),
    actions: S.Array(CheckedAction),
  }).pipe($I.annoteSchema("CheckedPlan", { description: "The change set the plan check approved." }))
) {}

/**
 * The checked plan as JSON text, for the file the plan step writes and the
 * deploy step reads.
 *
 * **Example** (Round-trip a plan)
 *
 * ```ts
 * import { CheckedPlan, CheckedPlanJson } from "@beep/infra-ci-runners/CheckedDeploy"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [], actions: [] })
 * const text = Effect.runSync(S.encodeEffect(CheckedPlanJson)(plan))
 * console.log(Effect.runSync(S.decodeUnknownEffect(CheckedPlanJson)(text)).stage) // "prod"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckedPlanJson = S.fromJsonString(CheckedPlan);

// The FQNs only in the deploy's plan, only in the checked plan, and in both but different.
const PlanDifferences = S.Struct({
  added: S.Array(S.String),
  removed: S.Array(S.String),
  changed: S.Array(S.String),
}).pipe($I.annoteSchema("PlanDifferences", { description: "How a deploy-time plan differs from the checked plan." }));
type PlanDifferences = typeof PlanDifferences.Type;

/**
 * The deploy's own plan differs from the checked plan; nothing was applied.
 *
 * **Example** (Construct the refusal)
 *
 * ```ts
 * import { PlanDrift } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(PlanDrift.make({ added: ["Vpc"], removed: [], changed: [] })._tag) // "PlanDrift"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PlanDrift extends S.TaggedError<PlanDrift, { readonly brand: unique symbol }>($I`PlanDrift`)(
  "PlanDrift",
  PlanDifferences.fields,
  $I.annoteError<PlanDrift>("PlanDrift", {
    title: "Plan drift",
    description: "The deploy-time plan differs from the plan the gate checked.",
  })
) {}

const byFqn = Order.mapInput(Order.String, (entry: { readonly fqn: string }) => entry.fqn);

const declaredProps = (node: unknown): O.Option<unknown> =>
  P.hasProperty(node, "props") ? O.some(node.props) : O.none();

const digestOf = Effect.fn("CiRunners.propsDigest")(function* (props: O.Option<unknown>) {
  const digest = yield* Digest.Digest;
  return yield* O.match(props, {
    onNone: () => Effect.succeed(""),
    onSome: (value) => digest.digestHex(Digest.sha256, new TextEncoder().encode(A.join(formatYamlLines(value), "\n"))),
  });
});

const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

// Every `Redacted` value under a declared value, as `<path>=<value>` in key order. Values known only after
// apply, effects and functions carry no declared secret and are skipped.
const redactedEntries = (value: unknown, path: string): ReadonlyArray<string> => {
  if (Redacted.isRedacted(value)) return [`${path}=${String(Redacted.value(value))}`];
  if (Output.isExpr(value) || Effect.isEffect(value)) return [];
  if (A.isArray(value)) return A.flatMap(value, (item, index) => redactedEntries(item, `${path}[${index}]`));
  return isPlainRecord(value)
    ? A.flatMap(A.sort(R.keys(value), Order.String), (key: string) => redactedEntries(value[key], `${path}.${key}`))
    : [];
};

// A keyed fingerprint of the declared secrets: HMAC-SHA256 under the plan's random salt, never the values.
// The declared values of a node that can hold a secret: its props and each binding's payload.
const secretBearing = (node: CRUD): ReadonlyArray<unknown> => [
  O.getOrUndefined(declaredProps(node)),
  ...A.map(node.bindings, (binding) => binding.data),
];

const entriesOf = (node: CRUD): ReadonlyArray<string> =>
  A.flatMap(secretBearing(node), (value, index) => redactedEntries(value, `${index}`));

// The HMAC covers the plan's whole secret material, then the node's own entries. A resource that holds one
// low-entropy value (the App id parameter) is thus never fingerprinted alone: guessing it offline also needs the
// App key and the webhook secret, which the loader holds to 128 bits.
const secretsDigestOf = Effect.fn("CiRunners.secretsDigest")(function* (
  salt: string,
  planSecrets: string,
  entries: ReadonlyArray<string>
) {
  return A.isReadonlyArrayNonEmpty(entries)
    ? yield* hmacSha256Hex(salt, `${planSecrets}\n--\n${A.join(entries, "\n")}`)
    : "";
});

// An update whose state still holds an unfinished replacement: applying it also deletes the old generation.
const isPendingReplacement = (node: CRUD): boolean => node.action === "update" && node.state.status === "replaced";

/**
 * A fresh random salt for {@link readEnginePlan}'s secrets fingerprint.
 *
 * **Example** (Mint a salt)
 *
 * ```ts
 * import { newSecretSalt } from "@beep/infra-ci-runners/CheckedDeploy"
 * import * as SecureRandom from "effect/crypto/SecureRandom"
 * import * as Effect from "effect/Effect"
 *
 * const salt = await Effect.runPromise(newSecretSalt.pipe(Effect.provide(SecureRandom.layerWebCrypto)))
 * console.log(salt.length) // 64
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const newSecretSalt = Effect.map(
  SecureRandom.SecureRandom.use((random) => random.randomBytes(32)),
  Hex.encode
);

/**
 * Read an engine plan into a {@link CheckedPlan}.
 *
 * **Details**
 *
 * Per resource it records the action, the binding actions, a SHA-256 of the
 * redacted declared properties, a SHA-256 of each binding's payload, an
 * HMAC-SHA256 of every declared `Redacted` value keyed by `salt`, and
 * whether an `update` would also finish a pending replacement. The salt is
 * random per checked plan and saved with it, so a changed secret changes the
 * fingerprint while the plan holds no secret; the App key and the webhook
 * secret are long random values, so the fingerprint cannot be reversed by
 * guessing.
 *
 * **Example** (Read a plan)
 *
 * ```ts
 * import { readEnginePlan } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(typeof readEnginePlan) // "function"
 * ```
 *
 * @param input - The planned stage, the engine plan `Alchemist.plan` returned, the secrets-fingerprint key (`newSecretSalt` for a new plan, the saved one to compare) and the cutover expectation.
 * @returns The plan's resources and stack actions, sorted by FQN.
 * @category validation
 * @since 0.0.0
 */
export const readEnginePlan = Effect.fn("CiRunners.readEnginePlan")(function* (input: {
  readonly stage: string;
  readonly plan: Plan;
  readonly salt: string;
  readonly expectation: PlanExpectation;
}) {
  const { stage, plan, salt, expectation } = input;
  const nodes: ReadonlyArray<CRUD> = A.filter(
    [...R.values(plan.resources), ...R.values(plan.deletions)],
    P.isNotUndefined
  );
  const planSecrets = pipe(nodes, A.flatMap(entriesOf), A.sort(Order.String), A.join("\n"));
  const resources = yield* Effect.forEach(
    nodes,
    Effect.fnUntraced(function* (node) {
      const row = describeResource(node);
      const props = declaredProps(node);
      const payloads = node.bindings;
      const bindingDigests = yield* Effect.forEach(
        payloads,
        (binding) => digestOf(O.some([binding.sid, binding.data])),
        {
          concurrency: 1,
        }
      );
      return CheckedResource.make({
        fqn: row.fqn,
        type: row.resourceType,
        action: row.action,
        bindings: A.map(row.bindings, (binding) => `${row.fqn}/${binding.sid} ${binding.action}`),
        propsDigest: yield* digestOf(props),
        bindingsDigest: A.join(bindingDigests, ","),
        secretsDigest: yield* secretsDigestOf(salt, planSecrets, entriesOf(node)),
        pendingReplacement: isPendingReplacement(node),
      });
    }),
    { concurrency: 1 }
  );
  return CheckedPlan.make({
    stage,
    expectation,
    secretSalt: salt,
    resources: A.sort(resources, byFqn),
    actions: A.sort(
      A.map(describePlan(plan).actions, (row) => CheckedAction.make({ fqn: row.fqn, action: row.action })),
      byFqn
    ),
  });
});

/**
 * The plan-check reading of a checked plan: every resource with its
 * bindings, and an `ActionTask` violation for every stack action that would
 * run or be dropped.
 *
 * **Example** (A no-op plan reads clean)
 *
 * ```ts
 * import { CheckedPlan, toReading } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(toReading(CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [], actions: [] })).violations) // []
 * ```
 *
 * @param plan - The checked plan.
 * @returns The reading {@link checkPlan} takes.
 * @category validation
 * @since 0.0.0
 */
export const toReading = (plan: CheckedPlan): PlanReading =>
  PlanReading.make({
    resources: A.map(plan.resources, (resource) =>
      PlannedResource.make({
        fqn: resource.fqn,
        action: resource.action,
        bindings: resource.bindings,
        changedProperties: [],
      })
    ),
    violations: [
      ...pipe(
        plan.actions,
        A.filter((action) => action.action !== "noop"),
        A.map((action) => PlanViolation.cases.ActionTask.make({ fqn: action.fqn, verb: action.action }))
      ),
      ...pipe(
        plan.resources,
        A.filter((resource) => resource.pendingReplacement),
        A.map((resource) => PlanViolation.cases.PendingReplacement.make({ fqn: resource.fqn }))
      ),
    ],
  });

const defaultSecurityGroup = "DefaultSecurityGroup";

const bindingAction = (binding: string): string => A.lastNonEmpty(Str.split(" ")(binding));

const unexpected = (expectation: PlanExpectation, fqn: string, change: string) =>
  PlanViolation.cases.UnexpectedChange.make({ fqn, change, expectation });

// Bindings whose action is not `allowed`, as violations of `expectation`.
const bindingViolations = (expectation: PlanExpectation, resource: CheckedResource, allowed: string) =>
  A.map(
    A.filter(resource.bindings, (binding) => bindingAction(binding) !== allowed),
    (binding) => unexpected(expectation, resource.fqn, `binding ${binding}`)
  );

const bootstrapViolations = (resource: CheckedResource): ReadonlyArray<PlanViolation> => [
  ...(resource.fqn === defaultSecurityGroup ? [unexpected("bootstrap", resource.fqn, "planned in step 1a")] : []),
  ...(resource.action === "create" ? [] : [unexpected("bootstrap", resource.fqn, resource.action)]),
  ...bindingViolations("bootstrap", resource, "create"),
];

const defaultGroupViolations = (resource: CheckedResource): ReadonlyArray<PlanViolation> =>
  resource.fqn === defaultSecurityGroup
    ? [
        ...(resource.action === "create" ? [] : [unexpected("default-security-group", resource.fqn, resource.action)]),
        ...A.map(resource.bindings, (binding) =>
          unexpected("default-security-group", resource.fqn, `binding ${binding}`)
        ),
      ]
    : [
        ...(resource.action === "noop" ? [] : [unexpected("default-security-group", resource.fqn, resource.action)]),
        ...bindingViolations("default-security-group", resource, "noop"),
      ];

const missingDefaultGroup = (plan: CheckedPlan): ReadonlyArray<PlanViolation> =>
  A.some(plan.resources, (resource) => resource.fqn === defaultSecurityGroup)
    ? []
    : [unexpected("default-security-group", defaultSecurityGroup, "not planned")];

/**
 * Every change a checked plan makes that its {@link PlanExpectation} does not
 * allow; empty for `routine`.
 *
 * **Example** (A routine plan has no expectation violations)
 *
 * ```ts
 * import { CheckedPlan, expectationViolations } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [], actions: [] })
 * console.log(expectationViolations(plan)) // []
 * ```
 *
 * @param plan - The checked plan, carrying its expectation.
 * @returns The violations, as `UnexpectedChange`.
 * @category validation
 * @since 0.0.0
 */
export const expectationViolations = (plan: CheckedPlan): ReadonlyArray<PlanViolation> =>
  PlanExpectation.match(plan.expectation, {
    routine: () => [],
    bootstrap: () => A.flatMap(plan.resources, bootstrapViolations),
    "default-security-group": () => [
      ...missingDefaultGroup(plan),
      ...A.flatMap(plan.resources, defaultGroupViolations),
    ],
  });

/**
 * Run the plan-check rules on a checked plan.
 *
 * **Example** (A create passes)
 *
 * ```ts
 * import { CheckedPlan, CheckedResource, checkEnginePlan } from "@beep/infra-ci-runners/CheckedDeploy"
 * import * as Effect from "effect/Effect"
 *
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "", bindingsDigest: "", secretsDigest: "", pendingReplacement: false })
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [vpc], actions: [] })
 * console.log(Effect.runSync(checkEnginePlan(plan)).length) // 1
 * ```
 *
 * @param plan - The checked plan.
 * @returns The plan's resources, or a `PlanRefused`.
 * @category validation
 * @since 0.0.0
 */
export const checkEnginePlan = (plan: CheckedPlan) =>
  checkPlan(
    PlanReading.make({
      ...toReading(plan),
      violations: [...toReading(plan).violations, ...expectationViolations(plan)],
    })
  );

// One signature per FQN: type, action, bindings and digest for a resource; the action for a stack action.
const keyed = (plan: CheckedPlan) =>
  HashMap.fromIterable([
    ...A.map(
      plan.resources,
      (resource) =>
        [
          resource.fqn,
          A.join(
            [
              resource.type,
              resource.action,
              ...resource.bindings,
              resource.propsDigest,
              resource.bindingsDigest,
              resource.secretsDigest,
              String(resource.pendingReplacement),
            ],
            "|"
          ),
        ] as const
    ),
    ...A.map(plan.actions, (action) => [`action:${action.fqn}`, action.action] as const),
  ]);

const differencesOf = (checked: CheckedPlan, current: CheckedPlan): PlanDifferences => {
  const before = keyed(checked);
  const after = keyed(current);
  const afterKeys = pipe(HashMap.keys(after), A.fromIterable, A.sort(Order.String));
  const beforeKeys = pipe(HashMap.keys(before), A.fromIterable, A.sort(Order.String));
  return {
    added: A.filter(afterKeys, (key) => !HashMap.has(before, key)),
    removed: A.filter(beforeKeys, (key) => !HashMap.has(after, key)),
    changed: [
      ...(checked.stage === current.stage ? [] : ["stage"]),
      ...(checked.expectation === current.expectation ? [] : ["expectation"]),
      ...A.filter(afterKeys, (key) =>
        O.exists(HashMap.get(before, key), (signature) => !O.contains(HashMap.get(after, key), signature))
      ),
    ],
  };
};

/**
 * Every difference between the checked plan and the deploy's plan, by FQN;
 * all three lists are empty when they are the same change set.
 *
 * **Example** (A resource the check never saw)
 *
 * ```ts
 * import { CheckedPlan, CheckedResource, planDifferences } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "", bindingsDigest: "", secretsDigest: "", pendingReplacement: false })
 * const checked = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [], actions: [] })
 * const current = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [vpc], actions: [] })
 * console.log(planDifferences(checked, current).added) // ["Vpc"]
 * ```
 *
 * @param checked - The plan the gate approved.
 * @param current - The plan the deploy computed.
 * @returns The FQNs only in `current`, only in `checked`, and in both but different.
 * @category validation
 * @since 0.0.0
 */
export const planDifferences: {
  (current: CheckedPlan): (checked: CheckedPlan) => PlanDifferences;
  (checked: CheckedPlan, current: CheckedPlan): PlanDifferences;
} = dual(2, differencesOf);

/**
 * Run `write` only when the deploy's plan is the checked plan and still
 * passes the plan check; otherwise fail before `write` starts.
 *
 * **Example** (Drift never writes)
 *
 * ```ts
 * import { applyIfUnchanged, CheckedPlan, CheckedResource } from "@beep/infra-ci-runners/CheckedDeploy"
 * import * as Effect from "effect/Effect"
 *
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "", bindingsDigest: "", secretsDigest: "", pendingReplacement: false })
 * const checked = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [], actions: [] })
 * const current = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", resources: [vpc], actions: [] })
 * const exit = Effect.runSyncExit(applyIfUnchanged(checked, current, Effect.succeed("applied")))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @param checked - The plan the gate approved.
 * @param current - The plan the deploy computed, from the same plan object `write` applies.
 * @param write - The effect that applies the plan; it never starts on a refusal.
 * @returns What `write` returns, or `PlanRefused` / `PlanDrift` with nothing written.
 * @category validation
 * @since 0.0.0
 */
export const applyIfUnchanged = Effect.fn("CiRunners.applyIfUnchanged")(function* <A, E, R>(
  checked: CheckedPlan,
  current: CheckedPlan,
  write: Effect.Effect<A, E, R>
) {
  yield* checkEnginePlan(current);
  const differences = planDifferences(checked, current);
  if (A.isReadonlyArrayNonEmpty([...differences.added, ...differences.removed, ...differences.changed])) {
    return yield* PlanDrift.make(differences);
  }
  return yield* write;
});
