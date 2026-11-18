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

import { $InfraCiRunnersId } from "@beep/identity/packages";
import { formatYamlLines } from "alchemy/Cli/PropertyDiff";
import { describePlan } from "alchemy/Plan";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { checkPlan, PlanAction, PlannedResource, PlanReading, PlanViolation } from "./PlanCheck.ts";
import type { Plan } from "alchemy/Plan";

const $I = $InfraCiRunnersId.create("CheckedDeploy");

/**
 * One resource of a checked plan.
 *
 * **Example** (A created VPC)
 *
 * ```ts
 * import { CheckedResource } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "00" })
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
  }).pipe(
    $I.annoteSchema("CheckedResource", {
      description: "A planned resource: action, `<fqn>/<sid> <action>` bindings and declared-property digest.",
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
 * A whole plan, sorted by FQN, as the gate checked it.
 *
 * **Example** (An empty plan)
 *
 * ```ts
 * import { CheckedPlan } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(CheckedPlan.make({ stage: "prod", resources: [], actions: [] }).stage) // "prod"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckedPlan extends S.Opaque<CheckedPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    stage: S.String,
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
 * const plan = CheckedPlan.make({ stage: "prod", resources: [], actions: [] })
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

/**
 * Read an engine plan into a {@link CheckedPlan}.
 *
 * **Example** (Read a plan)
 *
 * ```ts
 * import { readEnginePlan } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(typeof readEnginePlan) // "function"
 * ```
 *
 * @param stage - The planned stage.
 * @param plan - The engine plan `Alchemist.plan` returned.
 * @returns The plan's resources and stack actions, sorted by FQN.
 * @category validation
 * @since 0.0.0
 */
export const readEnginePlan = Effect.fn("CiRunners.readEnginePlan")(function* (stage: string, plan: Plan) {
  const described = describePlan(plan);
  const props = HashMap.fromIterable(
    A.map(R.values(plan.resources), (node) => [node.resource.FQN, declaredProps(node)] as const)
  );
  const resources = yield* Effect.forEach(
    described.resources,
    Effect.fnUntraced(function* (row) {
      return CheckedResource.make({
        fqn: row.fqn,
        type: row.resourceType,
        action: row.action,
        bindings: A.map(row.bindings, (binding) => `${row.fqn}/${binding.sid} ${binding.action}`),
        propsDigest: yield* digestOf(HashMap.get(props, row.fqn).pipe(O.flatten)),
      });
    }),
    { concurrency: 1 }
  );
  return CheckedPlan.make({
    stage,
    resources: A.sort(resources, byFqn),
    actions: A.sort(
      A.map(described.actions, (row) => CheckedAction.make({ fqn: row.fqn, action: row.action })),
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
 * console.log(toReading(CheckedPlan.make({ stage: "prod", resources: [], actions: [] })).violations) // []
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
    violations: pipe(
      plan.actions,
      A.filter((action) => action.action !== "noop"),
      A.map((action) => PlanViolation.cases.ActionTask.make({ fqn: action.fqn, verb: action.action }))
    ),
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
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "" })
 * const plan = CheckedPlan.make({ stage: "prod", resources: [vpc], actions: [] })
 * console.log(Effect.runSync(checkEnginePlan(plan)).length) // 1
 * ```
 *
 * @param plan - The checked plan.
 * @returns The plan's resources, or a `PlanRefused`.
 * @category validation
 * @since 0.0.0
 */
export const checkEnginePlan = (plan: CheckedPlan) => checkPlan(toReading(plan));

// One signature per FQN: type, action, bindings and digest for a resource; the action for a stack action.
const keyed = (plan: CheckedPlan) =>
  HashMap.fromIterable([
    ...A.map(
      plan.resources,
      (resource) =>
        [
          resource.fqn,
          A.join([resource.type, resource.action, ...resource.bindings, resource.propsDigest], "|"),
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
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "" })
 * const checked = CheckedPlan.make({ stage: "prod", resources: [], actions: [] })
 * const current = CheckedPlan.make({ stage: "prod", resources: [vpc], actions: [] })
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
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "" })
 * const checked = CheckedPlan.make({ stage: "prod", resources: [], actions: [] })
 * const current = CheckedPlan.make({ stage: "prod", resources: [vpc], actions: [] })
 * const exit = Effect.runSyncExit(applyIfUnchanged(checked, current, Effect.succeed("applied")))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @param checked - The plan the gate approved.
 * @param current - The plan the deploy computed, from the same plan object `write` applies.
 * @param write - The apply.
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
