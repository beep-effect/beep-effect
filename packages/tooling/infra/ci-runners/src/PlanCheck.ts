/**
 * The pre-deploy gate of the `CiRunners` stack: read an `alchemy plan` log
 * line by line and refuse the deploy on any replace, delete or orphan, on a
 * resource outside the stack, and on any line it cannot classify.
 *
 * @packageDocumentation
 * @category validation
 * @since 0.0.0
 */

import { $InfraCiRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $InfraCiRunnersId.create("PlanCheck");

/**
 * Every resource action Alchemy's plan printer emits, in alphabetical order.
 *
 * **Example** (A replace is one of them)
 *
 * ```ts
 * import { PlanAction } from "@beep/infra-ci-runners/PlanCheck"
 *
 * console.log(PlanAction.is.replace("replace")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanAction = LiteralKit(["adopted", "create", "delete", "noop", "orphaned", "replace", "update"]).pipe(
  $I.annoteSchema("PlanAction", { description: "A resource action of an alchemy plan." })
);

/**
 * Decoded plan action.
 *
 * @category models
 * @since 0.0.0
 */
export type PlanAction = typeof PlanAction.Type;

/**
 * One planned resource: its FQN, action, binding lines and the names (never
 * the values) of the properties it changes.
 *
 * **Example** (A no-op)
 *
 * ```ts
 * import { PlannedResource } from "@beep/infra-ci-runners/PlanCheck"
 *
 * const vpc = PlannedResource.make({ fqn: "Vpc", action: "noop", bindings: [], changedProperties: [] })
 * console.log(vpc.fqn) // "Vpc"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlannedResource extends S.Opaque<PlannedResource, { readonly brand: unique symbol }>()(
  S.Struct({
    fqn: S.String,
    action: PlanAction,
    bindings: S.Array(S.String),
    changedProperties: S.Array(S.String),
  }).pipe($I.annoteSchema("PlannedResource", { description: "One resource of a plan, as the gate read it." }))
) {}

/**
 * Each way a plan can fail the gate.
 *
 * **Details**
 *
 * `DestructiveAction`: a replace, delete or orphan. `DestructiveBinding`: a
 * binding that is replaced, unbound or deleted, which drops a live grant or
 * event source. `ForeignResource`: a
 * root logical id the stack does not declare. `UnreadableLine`: a line after
 * the plan header that is no resource, binding, task or property line.
 * `MissingPlan`: zero or several `Plan:` headers. `ActionTask`: a planned
 * Alchemy action (`run` or `drop`), which this stack never declares.
 * `IncompletePlan`: a `Plan:` summary count (`N to <action>`, `N binding
 * changes`) that the rows after it do not account for, such as a truncated
 * log. `PendingReplacement`: an `update` of a resource whose state still holds an
 * unfinished replacement, which the apply would also finish by deleting the
 * old generation. `UnexpectedChange`: a change the requested cutover
 * expectation does not allow (`src/CheckedDeploy.ts`).
 *
 * **Example** (Construct a violation)
 *
 * ```ts
 * import { PlanViolation } from "@beep/infra-ci-runners/PlanCheck"
 *
 * const violation = PlanViolation.cases.DestructiveAction.make({ fqn: "Vpc", action: "replace" })
 * console.log(violation._tag) // "DestructiveAction"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanViolation = S.TaggedUnion({
  DestructiveAction: { fqn: S.String, action: PlanAction },
  DestructiveBinding: { binding: S.String },
  ForeignResource: { fqn: S.String, action: PlanAction },
  UnreadableLine: { line: S.String },
  MissingPlan: { headers: S.Int },
  ActionTask: { fqn: S.String, verb: S.String },
  PendingReplacement: { fqn: S.String },
  IncompletePlan: { change: S.String, summary: S.Int, read: S.Int },
  UnexpectedChange: { fqn: S.String, change: S.String, expectation: S.String },
}).pipe($I.annoteSchema("PlanViolation", { description: "One reason the pre-deploy gate refuses a plan." }));

/**
 * Decoded violation.
 *
 * @category models
 * @since 0.0.0
 */
export type PlanViolation = typeof PlanViolation.Type;

/**
 * A plan log read into resources plus the violations found while reading.
 *
 * **Example** (An empty reading)
 *
 * ```ts
 * import { PlanReading } from "@beep/infra-ci-runners/PlanCheck"
 *
 * console.log(PlanReading.make({ resources: [], violations: [] }).resources) // []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanReading extends S.Opaque<PlanReading, { readonly brand: unique symbol }>()(
  S.Struct({
    resources: S.Array(PlannedResource),
    violations: S.Array(PlanViolation),
  }).pipe($I.annoteSchema("PlanReading", { description: "The resources of a plan and what failed to read." }))
) {}

/**
 * The gate refused the plan.
 *
 * **Example** (Construct the refusal)
 *
 * ```ts
 * import { PlanRefused } from "@beep/infra-ci-runners/PlanCheck"
 *
 * console.log(PlanRefused.make({ violations: [] })._tag) // "PlanRefused"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PlanRefused extends S.TaggedError<PlanRefused, { readonly brand: unique symbol }>($I`PlanRefused`)(
  "PlanRefused",
  { violations: S.Array(PlanViolation) },
  $I.annoteError<PlanRefused>("PlanRefused", {
    title: "Plan refused",
    description: "The CiRunners pre-deploy gate refused the plan.",
  })
) {}

/**
 * Whether a refusal must stop for the CI goals driver: every violation
 * except a planned action task, which only needs the task removed.
 *
 * **Example** (An unreadable line escalates)
 *
 * ```ts
 * import { mustEscalate, PlanViolation } from "@beep/infra-ci-runners/PlanCheck"
 *
 * console.log(mustEscalate([PlanViolation.cases.UnreadableLine.make({ line: "?" })])) // true
 * ```
 *
 * @param violations - The refusal's violations.
 * @returns `true` when the job must stop and ask.
 * @category validation
 * @since 0.0.0
 */
export const mustEscalate = (violations: ReadonlyArray<PlanViolation>): boolean =>
  A.some(violations, (violation) => !PlanViolation.guards.ActionTask(violation));

/**
 * Root logical ids the stack declares. The fleet composite's resources all
 * sit under `Runners/`; subnets are `PublicSubnet<n>` and
 * `PublicSubnet<n>Route`.
 *
 * **Example** (The composite root)
 *
 * ```ts
 * import { StackRoots } from "@beep/infra-ci-runners/PlanCheck"
 *
 * console.log(StackRoots.includes("Runners")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const StackRoots: ReadonlyArray<string> = [
  "Vpc",
  "DefaultSecurityGroup",
  "InternetGateway",
  "PublicRouteTable",
  "PublicDefaultRoute",
  "RunnerSecurityGroup",
  "FlowLogGroup",
  "FlowLogsRole",
  "FlowLog",
  "ImdsDisablePolicy",
  "RunnerBoundaryPolicy",
  "Reaper",
  "ReaperSchedule",
  "ReaperInvoke",
  "Runners",
];

const subnetRoot = /^PublicSubnet\d+(?:Route)?$/u;
const roots = HashSet.fromIterable(StackRoots);

/**
 * Whether a resource FQN belongs to the stack.
 *
 * **Example** (A pool resource)
 *
 * ```ts
 * import { isStackResource } from "@beep/infra-ci-runners/PlanCheck"
 *
 * console.log(isStackResource("Runners/Poolheavy/ScaleUp")) // true
 * console.log(isStackResource("Budget")) // false
 * ```
 *
 * @param fqn - The resource FQN from the plan.
 * @returns `true` when its root is a declared id.
 * @category validation
 * @since 0.0.0
 */
export const isStackResource = (fqn: string): boolean => {
  const root = pipe(fqn, Str.split("/"), A.headNonEmpty);
  return HashSet.has(roots, root) || subnetRoot.test(root);
};

const escapeSequence = /\u001b\[[0-9;]*m/gu;
const timestampPrefix = /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] [A-Z]+(?: \(#\d+\))?(?: [^:]+)?: ?/u;
const headerPattern = /^Plan: /u;
const resourcePattern = /^\[([^\]]+)\] ([a-z]+)(?: \([^)]*\))*$/u;
const bindingPattern = /^\[([^\]]+)\] (create|update|adopted|replace|unbind|delete|noop)$/u;
const taskPattern = /^\[([^\]]+)\] (run|drop) \[action\]$/u;
const indentedPattern = /^ {2,}\S/u;
const propertyNamePattern = /^ {2}[+~-]? ?([A-Za-z_$][\w$.-]*):/u;

const stripDecoration: (line: string) => string = flow(
  Str.replace(escapeSequence, ""),
  Str.replace(timestampPrefix, ""),
  Str.trimEnd
);

const isPlanAction = S.is(PlanAction);

// Replaces the reading's last resource; callers only pass a reading that has one.
const withLast = (reading: PlanReading, last: PlannedResource): PlanReading =>
  PlanReading.make({ ...reading, resources: A.append(A.dropRight(reading.resources, 1), last) });

const flag = (reading: PlanReading, violation: PlanViolation): PlanReading =>
  PlanReading.make({ ...reading, violations: A.append(reading.violations, violation) });

// A binding line names its resource's FQN plus `/<sid>`, right after that resource.
const readBinding = (reading: PlanReading, line: string): O.Option<PlanReading> =>
  pipe(
    O.fromNullishOr(bindingPattern.exec(line)),
    O.flatMap((match) =>
      pipe(
        A.last(reading.resources),
        O.filter((last) => Str.startsWith(`${last.fqn}/`)(String(match[1]))),
        O.map((last) =>
          withLast(
            reading,
            PlannedResource.make({ ...last, bindings: A.append(last.bindings, `${match[1]} ${match[2]}`) })
          )
        )
      )
    )
  );

const readResource = (reading: PlanReading, line: string): O.Option<PlanReading> =>
  pipe(
    O.fromNullishOr(resourcePattern.exec(line)),
    O.flatMap(([, fqn, action]) =>
      isPlanAction(action)
        ? O.some(PlannedResource.make({ fqn: String(fqn), action, bindings: [], changedProperties: [] }))
        : O.none()
    ),
    O.map((resource) => PlanReading.make({ ...reading, resources: A.append(reading.resources, resource) }))
  );

const readTask = (reading: PlanReading, line: string): O.Option<PlanReading> =>
  pipe(
    O.fromNullishOr(taskPattern.exec(line)),
    O.map((match) =>
      flag(reading, PlanViolation.cases.ActionTask.make({ fqn: String(match[1]), verb: String(match[2]) }))
    )
  );

// An indented line belongs to the resource above it; before any resource it is unreadable.
const noPropertyChanges = /^ {2}no declared property changes$/u;
const continuationPattern = /^ {4,}\S/u;

// A property line names a property; a continuation (4+ spaces) is readable only inside a property block.
const readProperty = (reading: PlanReading, line: string): O.Option<PlanReading> =>
  pipe(
    A.last(reading.resources),
    O.filter(() => indentedPattern.test(line)),
    O.flatMap((last) =>
      O.match(O.fromNullishOr(propertyNamePattern.exec(line)?.[1]), {
        onNone: () =>
          noPropertyChanges.test(line) ||
          (continuationPattern.test(line) && A.isReadonlyArrayNonEmpty(last.changedProperties))
            ? O.some(reading)
            : O.none(),
        onSome: (name) =>
          O.some(
            withLast(
              reading,
              PlannedResource.make({ ...last, changedProperties: A.dedupe(A.append(last.changedProperties, name)) })
            )
          ),
      })
    )
  );

const summaryCountPattern = /(\d+) (?:to (create|update|adopted|replace|delete|orphaned)|(binding) changes)/gu;

// The summary's counts against the rows read: `N to <action>` per resource action and `N binding changes`.
const countViolations = (header: string, reading: PlanReading): ReadonlyArray<PlanViolation> => {
  const read = (change: string): number =>
    change === "binding"
      ? A.filter(
          A.flatMap(reading.resources, (resource) => resource.bindings),
          (binding) => !Str.endsWith(" noop")(binding)
        ).length
      : A.filter(reading.resources, (resource) => resource.action === change).length;
  return A.filterMap(A.fromIterable(Str.matchAll(summaryCountPattern)(header)), (match) => {
    const change = String(match[2] ?? match[3]);
    const summary = Number(match[1]);
    return summary === read(change)
      ? Result.failVoid
      : Result.succeed(PlanViolation.cases.IncompletePlan.make({ change, summary, read: read(change) }));
  });
};

const lineReaders = [readBinding, readResource, readTask, readProperty];

const readLine = (reading: PlanReading, line: string): PlanReading =>
  Str.isEmpty(line)
    ? reading
    : pipe(
        A.findFirst(lineReaders, (reader) => reader(reading, line)),
        O.getOrElse(() => flag(reading, PlanViolation.cases.UnreadableLine.make({ line })))
      );

/**
 * Read a plan log: progress lines before the `Plan:` header are skipped;
 * every non-empty line after it must be a resource, binding, task or
 * indented property line, and any other line is an `UnreadableLine`. A log
 * without exactly one header is a `MissingPlan`.
 *
 * **Example** (Read a one-resource plan)
 *
 * ```ts
 * import { readPlanLog } from "@beep/infra-ci-runners/PlanCheck"
 *
 * const reading = readPlanLog("Planning\nPlan: 1 to create\n[Vpc] create\n")
 * console.log(reading.resources.length) // 1
 * ```
 *
 * @param log - The full plan output.
 * @returns The resources and the violations found while reading.
 * @category validation
 * @since 0.0.0
 */
export const readPlanLog = (log: string): PlanReading => {
  const lines = pipe(log, Str.split("\n"), A.map(stripDecoration));
  const headerLines = A.filter(lines, (line) => headerPattern.test(line));
  const headers = headerLines.length;
  const empty = PlanReading.make({ resources: [], violations: [] });
  if (headers !== 1) return flag(empty, PlanViolation.cases.MissingPlan.make({ headers }));
  const fromHeader = A.dropWhile(lines, (line) => !headerPattern.test(line));
  const reading = A.reduce(A.drop(fromHeader, 1), empty, readLine);
  return PlanReading.make({
    ...reading,
    violations: [...reading.violations, ...countViolations(A.join(headerLines, ""), reading)],
  });
};

const isDestructive = (action: PlanAction): boolean =>
  PlanAction.is.replace(action) || PlanAction.is.delete(action) || PlanAction.is.orphaned(action);

// A binding reads `<fqn>/<sid> <action>`; replace, unbind and delete drop what it grants.
const destructiveBindingActions = HashSet.make("replace", "unbind", "delete");
const isDestructiveBinding = (binding: string): boolean =>
  O.exists(A.last(Str.split(" ")(binding)), (action) => HashSet.has(destructiveBindingActions, action));

const resourceViolations = (resource: PlannedResource): ReadonlyArray<PlanViolation> => [
  ...A.map(A.filter(resource.bindings, isDestructiveBinding), (binding) =>
    PlanViolation.cases.DestructiveBinding.make({ binding })
  ),
  ...(isStackResource(resource.fqn)
    ? []
    : [PlanViolation.cases.ForeignResource.make({ fqn: resource.fqn, action: resource.action })]),
  ...(isDestructive(resource.action)
    ? [PlanViolation.cases.DestructiveAction.make({ fqn: resource.fqn, action: resource.action })]
    : []),
];

/**
 * Every reason a reading may not deploy; empty when it may.
 *
 * **Example** (A replace is refused)
 *
 * ```ts
 * import { planViolations, readPlanLog } from "@beep/infra-ci-runners/PlanCheck"
 *
 * console.log(planViolations(readPlanLog("Plan: 1 to replace\n[Vpc] replace\n"))[0]?._tag) // "DestructiveAction"
 * ```
 *
 * @param reading - The resources and reading violations of one plan log.
 * @returns Reading, foreign-resource and destructive-action violations together.
 * @category validation
 * @since 0.0.0
 */
export const planViolations = (reading: PlanReading): ReadonlyArray<PlanViolation> => [
  ...reading.violations,
  ...A.flatMap(reading.resources, resourceViolations),
];

/**
 * Pass a plan that only creates, updates, adopts or leaves resources alone,
 * and only creates, updates or keeps bindings;
 * fail with {@link PlanRefused} otherwise.
 *
 * **Details**
 *
 * No delete, replace or orphan passes: the network objects and pools carry
 * live runners, and the webhook's function URL is the App's delivery
 * target. A change that needs one is deployed by an operator-reviewed run,
 * never by the push workflow. {@link mustEscalate} decides whether the job
 * stops for the CI goals driver.
 *
 * **Example** (Check a reading)
 *
 * ```ts
 * import { checkPlan, readPlanLog } from "@beep/infra-ci-runners/PlanCheck"
 * import * as Effect from "effect/Effect"
 *
 * const resources = Effect.runSync(checkPlan(readPlanLog("Plan: 1 to create\n[Vpc] create\n")))
 * console.log(resources.length) // 1
 * ```
 *
 * @param reading - The read plan.
 * @returns The resources, or a `PlanRefused`.
 * @category validation
 * @since 0.0.0
 */
export const checkPlan = Effect.fn("CiRunners.checkPlan")(function* (reading: PlanReading) {
  const violations = planViolations(reading);
  if (A.isReadonlyArrayNonEmpty(violations)) {
    return yield* PlanRefused.make({ violations });
  }
  return reading.resources;
});
