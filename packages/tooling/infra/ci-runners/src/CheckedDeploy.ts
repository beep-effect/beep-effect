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
import { havePropsChanged } from "alchemy/Diff";
import * as Output from "alchemy/Output";
import { describePlan, describeResource } from "alchemy/Plan";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { checkPlan, PlanAction, PlannedResource, PlanReading, PlanViolation } from "./PlanCheck.ts";
import type { CRUD, Plan } from "alchemy/Plan";

const $I = $InfraCiRunnersId.create("CheckedDeploy");

/**
 * How a planned row continues a deploy that stopped part-way.
 *
 * **Details**
 *
 * A failed deploy leaves a state row `creating` for every resource it had
 * started. Alchemy plans such a row again as a `create` and drives the same
 * create handler under the first attempt's instance id: `create` here. One
 * provider differs: an event-source mapping whose source queue did not exist
 * at the first plan was checkpointed without its `eventSourceArn`, so its
 * diff reads the now-known ARN as a change and Alchemy plans a `replace`.
 * `empty-replace` is that row and nothing wider: the type is
 * `AWS.Lambda.EventSourceMapping`, the prior state is `creating` with no
 * recorded outputs and incomplete props, and the replace does not delete
 * first. Nothing exists for such a row to delete: Alchemy drops the empty
 * generation without a provider call.
 *
 * **Example** (A first deploy resumes nothing)
 *
 * ```ts
 * import { ResumeKind } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(ResumeKind.is.none("none")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResumeKind = LiteralKit(["none", "create", "empty-replace"]).pipe(
  $I.annoteSchema("ResumeKind", { description: "How a planned row continues a deploy that stopped part-way." })
);

/**
 * Decoded resume kind.
 *
 * @category models
 * @since 0.0.0
 */
export type ResumeKind = typeof ResumeKind.Type;

/**
 * One resource of a checked plan.
 *
 * **Details**
 *
 * `changedProperties` names, never values, what an `update` or `replace`
 * changes: each top-level declared property whose new value differs from the
 * one last applied, sorted. A property whose new value is known only after
 * apply reads `<name> (unresolved)`. A Lambda function update that changes no
 * declared property and no binding reads `code (bundle hash, inferred)`: the
 * plan does not carry the bundle hash, so that is the one update branch left.
 * It defaults to empty, which every create, noop and resumed row keeps.
 *
 * **Example** (A created VPC)
 *
 * ```ts
 * import { CheckedResource } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "00", bindingsDigest: "", secretsDigest: "", baselineDigest: "", pendingReplacement: false, resume: "none" })
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
    baselineDigest: S.String,
    pendingReplacement: S.Boolean,
    resume: ResumeKind,
    changedProperties: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed([]))),
  }).pipe(
    $I.annoteSchema("CheckedResource", {
      description:
        "A planned resource: action, `<fqn>/<sid> <action>` bindings, digests of its declared properties, binding payloads, secrets and starting state, whether it holds a pending replacement, how it continues a stopped deploy, and the names of the properties it changes.",
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
 * console.log(CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] }).stage) // "prod"
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
    sourceTree: S.String,
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
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] })
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

/**
 * The checkout the plan was made from is not one clean committed tree, so no
 * source identity can bind the Lambda bundles; nothing was planned.
 *
 * **Example** (Construct the refusal)
 *
 * ```ts
 * import { UnboundSource } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(UnboundSource.make({ reason: "uncommitted changes" })._tag) // "UnboundSource"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnboundSource extends S.TaggedError<UnboundSource, { readonly brand: unique symbol }>($I`UnboundSource`)(
  "UnboundSource",
  { reason: S.String },
  $I.annoteError<UnboundSource>("UnboundSource", {
    title: "Unbound source",
    description: "The plan's checkout is not a clean committed tree.",
  })
) {}

const gitOutput = (args: ReadonlyArray<string>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("git", A.copy(args), { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
      const output = yield* handle.all.pipe(Stream.decodeText(), Stream.mkString);
      const exitCode = yield* handle.exitCode;
      return { output: Str.trim(output), exitCode };
    })
  );

/**
 * The git tree id of the clean checkout a plan is made from: the identity of
 * every Lambda bundle's source, since Alchemy keeps the bundle hash out of the
 * plan.
 *
 * **Details**
 *
 * Fails with {@link UnboundSource} when the worktree has uncommitted or
 * untracked changes, or when git cannot answer, so a checked plan always names
 * the exact sources its bundles come from. `plan` and `deploy` each read it;
 * a different tree is drift.
 *
 * **Example** (Reference the reader)
 *
 * ```ts
 * import { readSourceTree } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(typeof readSourceTree) // "object"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const readSourceTree = Effect.gen(function* () {
  const status = yield* gitOutput(["status", "--porcelain", "--untracked-files=all"]);
  if (status.exitCode !== 0) return yield* UnboundSource.make({ reason: "git status failed" });
  if (!Str.isEmpty(status.output)) return yield* UnboundSource.make({ reason: "uncommitted changes" });
  const tree = yield* gitOutput(["rev-parse", "HEAD^{tree}"]);
  if (tree.exitCode !== 0) return yield* UnboundSource.make({ reason: "no committed tree" });
  return tree.output;
}).pipe(Effect.catchTag("PlatformError", () => Effect.fail(UnboundSource.make({ reason: "git did not run" }))));

const byFqn = Order.mapInput(Order.String, (entry: { readonly fqn: string }) => entry.fqn);

const declaredProps = (node: unknown): O.Option<unknown> =>
  P.hasProperty(node, "props") ? O.some(node.props) : O.none();

const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

// Alchemy's display renders an Effect `Duration` as `(opaque)`, so a 60 s and a 90 s timeout would digest alike.
// Before formatting, each Duration becomes its value in milliseconds; redaction is untouched (Redacted passes through).
const withDurations = (value: unknown): unknown =>
  Duration.isDuration(value)
    ? { duration: `${Duration.toMillis(value)}ms` }
    : A.isArray(value)
      ? A.map(value, withDurations)
      : isPlainRecord(value)
        ? R.map(value, withDurations)
        : value;

const formatted = (value: unknown): string => A.join(formatYamlLines(withDurations(value)), "\n");

const digestOf = Effect.fn("CiRunners.propsDigest")(function* (props: O.Option<unknown>) {
  const digest = yield* Digest.Digest;
  return yield* O.match(props, {
    onNone: () => Effect.succeed(""),
    onSome: (value) => digest.digestHex(Digest.sha256, new TextEncoder().encode(formatted(value))),
  });
});

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

const eventSourceMapping = "AWS.Lambda.EventSourceMapping";

// A row the failed deploy had started: Alchemy keeps its state `creating` until the create finishes.
const isCreating = (node: CRUD): boolean => P.isObject(node.state) && node.state.status === "creating";

const recordedOutputs = (node: CRUD): boolean => P.hasProperty(node.state, "attr") && P.isNotUndefined(node.state.attr);

const incompleteProps = (node: CRUD): boolean =>
  P.hasProperty(node.state, "propsIncomplete") && node.state.propsIncomplete === true;

// See ResumeKind: the replace of a mapping generation that never existed, and every other resumed create.
const resumeOf = (node: CRUD, resourceType: string): ResumeKind =>
  !isCreating(node)
    ? "none"
    : node.action === "create"
      ? "create"
      : node.action === "replace" &&
          resourceType === eventSourceMapping &&
          !recordedOutputs(node) &&
          incompleteProps(node) &&
          !node.deleteFirst
        ? "empty-replace"
        : "none";

// The state an update or delete starts from: the props last applied and the attributes last observed. A plan that
// changes retention 7 -> 30 and one that changes it 90 -> 30 declare the same props; only this tells them apart.
// Keyed by the plan's salt like the secrets fingerprint, because state attributes can hold secret values.
const baselineOf = (node: CRUD): O.Option<unknown> =>
  node.action === "create" || !P.isObject(node.state)
    ? O.none()
    : O.some({
        props: P.hasProperty(node.state, "props") ? node.state.props : undefined,
        attr: P.hasProperty(node.state, "attr") ? node.state.attr : undefined,
      });

const baselineDigestOf = Effect.fn("CiRunners.baselineDigest")(function* (salt: string, node: CRUD) {
  return yield* O.match(baselineOf(node), {
    onNone: () => Effect.succeed(""),
    onSome: (baseline) => hmacSha256Hex(salt, formatted(baseline)),
  });
});

const lambdaFunction = "AWS.Lambda.Function";

/**
 * The entry a Lambda function update carries when it changes no declared
 * property and no binding.
 *
 * **Details**
 *
 * The Lambda provider's diff plans a bare `update` when the deployed code
 * hash differs from the new bundle's, and every other update branch compares
 * a declared property. The plan carries neither hash, so the entry is
 * deduced and says so.
 *
 * **Example** (Read the label)
 *
 * ```ts
 * import { inferredCodeChange } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(inferredCodeChange) // "code (bundle hash, inferred)"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const inferredCodeChange = "code (bundle hash, inferred)";

const propsRecord = (props: O.Option<unknown>): Readonly<Record<string, unknown>> =>
  O.getOrElse(O.filter(props, isPlainRecord), () => ({}));

const appliedProps = (node: CRUD): O.Option<unknown> =>
  P.hasProperty(node.state, "props") ? O.some(node.state.props) : O.none();

// Each key is compared on its own with Alchemy's own comparison. That comparison also reports a new value that still
// holds an unresolved Output, so such a key is labelled: the plan cannot yet say whether its value changes.
const changedKeys = (node: CRUD): ReadonlyArray<string> => {
  const olds = propsRecord(appliedProps(node));
  const news = propsRecord(declaredProps(node));
  return pipe(
    A.dedupe([...R.keys(olds), ...R.keys(news)]),
    A.filter((key) => havePropsChanged({ [key]: olds[key] }, { [key]: news[key] })),
    A.sort(Order.String),
    A.map((key) => (Output.hasOutputs(news[key]) ? `${key} (unresolved)` : key))
  );
};

const bindingsUnchanged = (node: CRUD): boolean => A.every(node.bindings, (binding) => binding.action === "noop");

// What an update or replace changes, by name. A resumed row reads as the create it continues, and its checkpointed
// props are incomplete by design, so it lists nothing.
const changedPropertiesOf = (node: CRUD, resourceType: string, resume: ResumeKind): ReadonlyArray<string> => {
  if ((node.action !== "update" && node.action !== "replace") || resume !== "none") return [];
  const changed = changedKeys(node);
  return A.isReadonlyArrayEmpty(changed) &&
    node.action === "update" &&
    resourceType === lambdaFunction &&
    bindingsUnchanged(node)
    ? [inferredCodeChange]
    : changed;
};

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
  readonly sourceTree: string;
}) {
  const { stage, plan, salt, expectation, sourceTree } = input;
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
      const resume = resumeOf(node, row.resourceType);
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
        baselineDigest: yield* baselineDigestOf(salt, node),
        pendingReplacement: isPendingReplacement(node),
        resume,
        changedProperties: changedPropertiesOf(node, row.resourceType, resume),
      });
    }),
    { concurrency: 1 }
  );
  return CheckedPlan.make({
    stage,
    expectation,
    secretSalt: salt,
    sourceTree,
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
 * console.log(toReading(CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] })).violations) // []
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
        // Step 1a reads the replace of a mapping generation that never existed as the create it is. Every other
        // expectation keeps `replace`, which the plan check refuses.
        action: plan.expectation === "bootstrap" && resource.resume === "empty-replace" ? "create" : resource.action,
        bindings: resource.bindings,
        changedProperties: resource.changedProperties,
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

// Bindings whose action is not one of `allowed`, as violations of `expectation`.
const bindingViolations = (
  expectation: PlanExpectation,
  resource: CheckedResource,
  ...allowed: ReadonlyArray<string>
) =>
  A.map(
    A.filter(resource.bindings, (binding) => !A.contains(allowed, bindingAction(binding))),
    (binding) => unexpected(expectation, resource.fqn, `binding ${binding}`)
  );

// The failed deploy saved a started row's bindings with it, so a resumed row's bindings diff `noop` or `update`,
// never `create`. A row planned for the first time takes only `create`; a finished row only `noop`.
const bootstrapBindings = (resource: CheckedResource): ReadonlyArray<string> =>
  resource.action === "noop" ? ["noop"] : resource.resume === "none" ? ["create"] : ["create", "noop", "update"];

// Step 1a creates. A re-run after a partial bootstrap also meets the resources the failed run finished, as noops,
// and the ones it had started, as resumed creates (ResumeKind). Nothing else passes: no update, delete or adoption,
// no replace but the empty one, and a noop resource takes only noop bindings.
const bootstrapViolations = (resource: CheckedResource): ReadonlyArray<PlanViolation> => [
  ...(resource.fqn === defaultSecurityGroup ? [unexpected("bootstrap", resource.fqn, "planned in step 1a")] : []),
  ...(resource.action === "create" ||
  resource.action === "noop" ||
  (resource.action === "replace" && resource.resume === "empty-replace")
    ? []
    : [unexpected("bootstrap", resource.fqn, resource.action)]),
  ...bindingViolations("bootstrap", resource, ...bootstrapBindings(resource)),
];

// Alchemy reads the VPC's AWS-made default group before it has a state row and plans it `adopted`, not `create`.
const isDefaultGroupFirstPlan = (action: PlanAction): boolean => action === "adopted" || action === "create";

const defaultGroupViolations = (resource: CheckedResource): ReadonlyArray<PlanViolation> =>
  resource.fqn === defaultSecurityGroup
    ? [
        ...(isDefaultGroupFirstPlan(resource.action)
          ? []
          : [unexpected("default-security-group", resource.fqn, resource.action)]),
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
 * allow; for `routine`, only an adoption.
 *
 * **Example** (A routine plan has no expectation violations)
 *
 * ```ts
 * import { CheckedPlan, expectationViolations } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] })
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
    // An adoption takes over a resource nobody declared through this stack; only step 1b may adopt, and only the
    // default group.
    routine: () =>
      A.map(
        A.filter(plan.resources, (resource) => resource.action === "adopted"),
        (resource) => unexpected("routine", resource.fqn, "adopted")
      ),
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
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "", bindingsDigest: "", secretsDigest: "", baselineDigest: "", pendingReplacement: false, resume: "none" })
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [vpc], actions: [] })
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

const changesSegment = (name: string): string => `changes ${name}`;

// One signature per FQN: type, action, bindings, digests and changed property names for a resource; the action for
// a stack action.
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
              resource.baselineDigest,
              String(resource.pendingReplacement),
              resource.resume,
              ...A.map(resource.changedProperties, changesSegment),
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
      ...(checked.sourceTree === current.sourceTree ? [] : ["sourceTree"]),
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
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "", bindingsDigest: "", secretsDigest: "", baselineDigest: "", pendingReplacement: false, resume: "none" })
 * const checked = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] })
 * const current = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [vpc], actions: [] })
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
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "", bindingsDigest: "", secretsDigest: "", baselineDigest: "", pendingReplacement: false, resume: "none" })
 * const checked = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] })
 * const current = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [vpc], actions: [] })
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

// A resumed row is labelled, so the gate reads it apart from a first create, and the digest covers the label.
const rowLabel = (resource: CheckedResource): string =>
  ResumeKind.match(resource.resume, {
    none: () => resource.action,
    create: () => "resumed create",
    "empty-replace": () => "resumed create (replace of an empty generation)",
  });

/**
 * The line the plan step prints for one resource: `[fqn] action`, then each
 * binding action, then each changed property name as `changes <name>` (never
 * a value). A row that continues a stopped deploy prints `resumed create` in
 * place of its action ({@link ResumeKind}); a row that changes no property
 * prints no `changes` segment.
 *
 * **Example** (A created VPC)
 *
 * ```ts
 * import { CheckedResource, planRowLine } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * const vpc = CheckedResource.make({ fqn: "Vpc", type: "AWS.EC2.Vpc", action: "create", bindings: [], propsDigest: "", bindingsDigest: "", secretsDigest: "", baselineDigest: "", pendingReplacement: false, resume: "none" })
 * console.log(planRowLine(vpc)) // "[Vpc] create"
 * ```
 *
 * @param resource - One resource of a checked plan.
 * @returns Its plan row.
 * @category validation
 * @since 0.0.0
 */
export const planRowLine = (resource: CheckedResource): string =>
  A.join(
    [
      `[${resource.fqn}] ${rowLabel(resource)}`,
      ...A.map(resource.bindings, (binding) => `binding ${binding}`),
      ...A.map(resource.changedProperties, changesSegment),
    ],
    " | "
  );

/**
 * The plan-rows digest: SHA-256 over the sorted plan rows, one per line, the
 * resources' ({@link planRowLine}) and then the stack actions'.
 *
 * **Details**
 *
 * It reads only FQNs, actions, binding actions and changed property names:
 * no property value, secret or salt. Two plans of one commit over one state therefore print the same
 * digest, so the gate can read a plan-only run's rows and then hold the
 * deploy to them with `--expect-digest`.
 *
 * **Example** (An empty plan)
 *
 * ```ts
 * import { CheckedPlan, planRowsDigest } from "@beep/infra-ci-runners/CheckedDeploy"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] })
 * const digest = await Effect.runPromise(planRowsDigest(plan).pipe(Effect.provide(Digest.layerWebCrypto)))
 * console.log(digest.length) // 64
 * ```
 *
 * @param plan - A checked plan.
 * @returns The digest in lowercase hex.
 * @category validation
 * @since 0.0.0
 */
export const planRowsDigest = Effect.fn("CiRunners.planRowsDigest")(function* (plan: CheckedPlan) {
  const digest = yield* Digest.Digest;
  const rows = [
    ...A.sort(A.map(plan.resources, planRowLine), Order.String),
    ...A.sort(
      A.map(plan.actions, (action) => `[${action.fqn}] action ${action.action}`),
      Order.String
    ),
  ];
  return yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(A.join(rows, "\n")));
});

/**
 * The deploy's plan rows are not the rows the gate read; nothing was applied.
 *
 * **Example** (Construct the refusal)
 *
 * ```ts
 * import { PlanDigestMismatch } from "@beep/infra-ci-runners/CheckedDeploy"
 *
 * console.log(PlanDigestMismatch.make({ expected: "aa", actual: "bb" })._tag) // "PlanDigestMismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PlanDigestMismatch extends S.TaggedError<PlanDigestMismatch, { readonly brand: unique symbol }>(
  $I`PlanDigestMismatch`
)(
  "PlanDigestMismatch",
  { expected: S.String, actual: S.String },
  $I.annoteError<PlanDigestMismatch>("PlanDigestMismatch", {
    title: "Plan digest mismatch",
    description: "The deploy-time plan-rows digest differs from the one the dispatch expected.",
  })
) {}

/**
 * Pass when no digest is expected or the plan's rows digest equals it.
 *
 * **Example** (No expectation passes)
 *
 * ```ts
 * import { CheckedPlan, requirePlanDigest } from "@beep/infra-ci-runners/CheckedDeploy"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const plan = CheckedPlan.make({ stage: "prod", expectation: "routine", secretSalt: "", sourceTree: "", resources: [], actions: [] })
 * await Effect.runPromise(requirePlanDigest(plan, O.none()).pipe(Effect.provide(Digest.layerWebCrypto)))
 * ```
 *
 * @param plan - The plan the deploy computed.
 * @param expected - The digest the dispatch named, if any; surrounding space and a `sha256:` prefix are ignored.
 * @returns The plan's digest, or `PlanDigestMismatch`.
 * @category validation
 * @since 0.0.0
 */
export const requirePlanDigest = Effect.fn("CiRunners.requirePlanDigest")(function* (
  plan: CheckedPlan,
  expected: O.Option<string>
) {
  const actual = yield* planRowsDigest(plan);
  const wanted = O.filter(
    O.map(expected, (text) => Str.replace(/^sha256:/, "")(Str.toLowerCase(Str.trim(text)))),
    Str.isNonEmpty
  );
  if (O.isSome(wanted) && wanted.value !== actual) {
    return yield* PlanDigestMismatch.make({ expected: wanted.value, actual });
  }
  return actual;
});
