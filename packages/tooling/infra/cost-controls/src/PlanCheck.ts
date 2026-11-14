/**
 * The pre-deploy gate of the `CostControls` workflow: read the detailed
 * `alchemy plan` log and the live values of the nine adopted account
 * settings, and refuse the deploy unless every singleton plans as an adopt or
 * no-op with no property change, the live settings already equal the
 * declared ones, and nothing plans a delete or replace.
 *
 * @packageDocumentation
 * @category validation
 * @since 0.0.0
 */

import { $InfraCostControlsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CostAllocationTagKey } from "./Config.ts";
import { PhysicalNames, SingletonIds } from "./CostControls.ts";

const $I = $InfraCostControlsId.create("PlanCheck");

/**
 * Every action `alchemy plan` prints for a resource.
 *
 * **Example** (Read an action)
 *
 * ```ts
 * import { PlanAction } from "@beep/infra-cost-controls/PlanCheck"
 *
 * console.log(PlanAction.Enum.adopted) // "adopted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanAction = LiteralKit(["create", "update", "adopted", "replace", "delete", "orphaned", "noop"]).pipe(
  $I.annoteSchema("PlanAction", { description: "The action alchemy plan prints for one resource." })
);

/**
 * Decoded plan action.
 *
 * @category models
 * @since 0.0.0
 */
export type PlanAction = typeof PlanAction.Type;

/**
 * One resource line of a plan, with the names (never the values) of the
 * declared properties it changes.
 *
 * **Example** (Decode a plan entry)
 *
 * ```ts
 * import { PlanEntry } from "@beep/infra-cost-controls/PlanCheck"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(PlanEntry)({ fqn: "AppTag", action: "adopted", changedProperties: [] })
 * console.log(entry.action) // "adopted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanEntry extends S.Opaque<PlanEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    fqn: S.String,
    action: PlanAction,
    changedProperties: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("PlanEntry", { description: "One resource of an alchemy plan and the property names it changes." })
  )
) {}

const TagStatus = S.Struct({ TagKey: S.String, Status: S.String });
const ComputeOptimizerStatus = S.Struct({ status: S.String, memberAccountsEnrolled: S.optionalKey(S.Boolean) });
const HubItem = S.Struct({ status: S.String });
const MonitorSummary = S.Struct({
  MonitorName: S.String,
  MonitorType: S.String,
  MonitorDimension: S.optionalKey(S.String),
});

/**
 * The live values of the nine adopted settings, as the workflow reads them
 * with the AWS CLI (`list-cost-allocation-tags`, `get-enrollment-status`,
 * `list-enrollment-statuses`, `get-anomaly-monitors`) and joins with `jq`.
 *
 * **Example** (Decode live settings)
 *
 * ```ts
 * import { LiveSettings } from "@beep/infra-cost-controls/PlanCheck"
 * import * as S from "effect/Schema"
 *
 * const live = S.decodeUnknownSync(LiveSettings)({
 *   costAllocationTags: [{ TagKey: "App", Status: "Active" }],
 *   computeOptimizer: { status: "Active", memberAccountsEnrolled: false },
 *   costOptimizationHub: { includeMemberAccounts: false, items: [{ status: "Active" }] },
 *   anomalyMonitors: [{ MonitorName: "beep-account-services", MonitorType: "DIMENSIONAL", MonitorDimension: "SERVICE" }],
 * })
 * console.log(live.costAllocationTags.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiveSettings extends S.Opaque<LiveSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    costAllocationTags: S.Array(TagStatus),
    computeOptimizer: ComputeOptimizerStatus,
    costOptimizationHub: S.Struct({ includeMemberAccounts: S.optionalKey(S.Boolean), items: S.Array(HubItem) }),
    anomalyMonitors: S.Array(MonitorSummary),
  }).pipe(
    $I.annoteSchema("LiveSettings", { description: "Live values of the nine account settings the stack adopts." })
  )
) {}

/**
 * The raw AWS CLI outputs the workflow passes to the gate, unshaped: one
 * document each from `ce list-cost-allocation-tags`,
 * `compute-optimizer get-enrollment-status`,
 * `cost-optimization-hub list-enrollment-statuses` and
 * `ce get-anomaly-monitors`. Unknown fields are ignored; flags AWS omits stay
 * absent.
 *
 * **Example** (Decode raw AWS outputs)
 *
 * ```ts
 * import { AwsSettingsOutputs } from "@beep/infra-cost-controls/PlanCheck"
 * import * as S from "effect/Schema"
 *
 * const raw = S.decodeUnknownSync(AwsSettingsOutputs)({
 *   costAllocationTags: { CostAllocationTags: [{ TagKey: "App", Status: "Active", Type: "UserDefined" }] },
 *   computeOptimizer: { status: "Active" },
 *   costOptimizationHub: { items: [{ accountId: "123456789012", status: "Active" }] },
 *   anomalyMonitors: { AnomalyMonitors: [] },
 * })
 * console.log(raw.computeOptimizer.status) // "Active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AwsSettingsOutputs extends S.Opaque<AwsSettingsOutputs, { readonly brand: unique symbol }>()(
  S.Struct({
    costAllocationTags: S.Struct({ CostAllocationTags: S.Array(TagStatus).pipe(S.optionalKey) }),
    computeOptimizer: ComputeOptimizerStatus,
    costOptimizationHub: S.Struct({
      includeMemberAccounts: S.optionalKey(S.Boolean),
      items: S.Array(HubItem).pipe(S.optionalKey),
    }),
    anomalyMonitors: S.Struct({ AnomalyMonitors: S.Array(MonitorSummary).pipe(S.optionalKey) }),
  }).pipe(
    $I.annoteSchema("AwsSettingsOutputs", {
      description: "Raw AWS CLI outputs for the nine adopted settings, before shaping.",
    })
  )
) {}

/**
 * Shape the raw AWS outputs into {@link LiveSettings}, keeping each
 * member-account flag only when AWS reported it.
 *
 * **Example** (Shape outputs without member-account flags)
 *
 * ```ts
 * import { AwsSettingsOutputs, liveSettingsFromAws } from "@beep/infra-cost-controls/PlanCheck"
 *
 * const live = liveSettingsFromAws(
 *   AwsSettingsOutputs.make({
 *     costAllocationTags: {},
 *     computeOptimizer: { status: "Active" },
 *     costOptimizationHub: {},
 *     anomalyMonitors: {},
 *   })
 * )
 * console.log("memberAccountsEnrolled" in live.computeOptimizer) // false
 * ```
 *
 * @param raw - The decoded raw AWS outputs.
 * @returns The live settings the gate checks.
 * @category validation
 * @since 0.0.0
 */
export const liveSettingsFromAws = (raw: AwsSettingsOutputs): LiveSettings =>
  LiveSettings.make({
    costAllocationTags: A.map(raw.costAllocationTags.CostAllocationTags ?? [], ({ TagKey, Status }) => ({
      TagKey,
      Status,
    })),
    computeOptimizer: {
      status: raw.computeOptimizer.status,
      ...(raw.computeOptimizer.memberAccountsEnrolled === undefined
        ? {}
        : { memberAccountsEnrolled: raw.computeOptimizer.memberAccountsEnrolled }),
    },
    costOptimizationHub: {
      items: A.map(raw.costOptimizationHub.items ?? [], ({ status }) => ({ status })),
      ...(raw.costOptimizationHub.includeMemberAccounts === undefined
        ? {}
        : { includeMemberAccounts: raw.costOptimizationHub.includeMemberAccounts }),
    },
    anomalyMonitors: A.map(raw.anomalyMonitors.AnomalyMonitors ?? [], (monitor) => ({
      MonitorName: monitor.MonitorName,
      MonitorType: monitor.MonitorType,
      ...(monitor.MonitorDimension === undefined ? {} : { MonitorDimension: monitor.MonitorDimension }),
    })),
  });

/**
 * Why the gate refuses a plan.
 *
 * **Example** (Read a reason)
 *
 * ```ts
 * import { ViolationReason } from "@beep/infra-cost-controls/PlanCheck"
 *
 * console.log(ViolationReason.Enum["delete-or-replace"]) // "delete-or-replace"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ViolationReason = LiteralKit([
  "delete-or-replace",
  "singleton-missing",
  "singleton-not-adopt-or-noop",
  "singleton-property-change",
  "live-setting-differs",
  "unexpected-resource",
]).pipe($I.annoteSchema("ViolationReason", { description: "Why the pre-deploy gate refuses a plan." }));

/**
 * Decoded violation reason.
 *
 * @category models
 * @since 0.0.0
 */
export type ViolationReason = typeof ViolationReason.Type;

/**
 * One reason a plan may not deploy. Names resources and settings only,
 * never property values.
 *
 * **Example** (Construct a violation)
 *
 * ```ts
 * import { PlanViolation } from "@beep/infra-cost-controls/PlanCheck"
 *
 * const violation = PlanViolation.make({ subject: "AppTag", reason: "singleton-property-change", detail: "status" })
 * console.log(violation.subject) // "AppTag"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanViolation extends S.Opaque<PlanViolation, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: S.String,
    reason: ViolationReason,
    detail: S.String,
  }).pipe($I.annoteSchema("PlanViolation", { description: "One reason the pre-deploy gate refuses a plan." }))
) {}

/**
 * The gate refused the plan. `escalate` is set when a resource outside the
 * stack's declared set appears: the stack declares nothing that touches EC2,
 * Spot or Lambda concurrency, so such a plan stops the job and the CI goals
 * driver is asked through the orchestrator (runbook "Cost controls").
 *
 * **Example** (Construct the failure)
 *
 * ```ts
 * import { PlanCheckFailed } from "@beep/infra-cost-controls/PlanCheck"
 *
 * const failure = PlanCheckFailed.make({ violations: [], escalate: false })
 * console.log(failure._tag) // "PlanCheckFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PlanCheckFailed extends S.TaggedError<PlanCheckFailed, { readonly brand: unique symbol }>(
  $I`PlanCheckFailed`
)(
  "PlanCheckFailed",
  {
    violations: S.Array(PlanViolation),
    escalate: S.Boolean,
  },
  $I.annoteError<PlanCheckFailed>("PlanCheckFailed", {
    title: "Plan refused",
    description: "The pre-deploy gate refused the plan.",
  })
) {}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences are control characters by definition.
const ansi = /\u001b\[[0-9;]*m/gu;
const logPrefix = /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] [A-Z]+: ?/u;
const resourceLine = /^\[([^\]]+)\] ([a-z]+)\b(?! \[action\])/u;
const changeLine = /^ {2}([+-]) ([^:]+)/u;

const clean = (line: string) => pipe(line, Str.replace(ansi, ""), Str.replace(logPrefix, ""));
const isPlanAction = S.is(PlanAction);

/**
 * Parse a detailed `alchemy plan` log (`--detailed`, pretty or CI log
 * format) into one entry per resource with the names of the properties it
 * changes. Values are dropped on the way in.
 *
 * **Example** (Parse one adopted resource)
 *
 * ```ts
 * import { parsePlanLog } from "@beep/infra-cost-controls/PlanCheck"
 *
 * const entries = parsePlanLog("[AppTag] adopted\n  no declared property changes\n")
 * console.log(entries[0]?.action) // "adopted"
 * ```
 *
 * @param log - The plan output, as written by `alchemy plan --detailed`.
 * @returns One entry per resource line, in log order.
 * @category validation
 * @since 0.0.0
 */
export const parsePlanLog = (log: string): ReadonlyArray<PlanEntry> =>
  A.reduce(pipe(log, Str.split("\n"), A.map(clean)), A.empty<PlanEntry>(), (entries, line) => {
    const resource = resourceLine.exec(line);
    const action = resource?.[2];
    if (resource !== null && action !== undefined && isPlanAction(action)) {
      return A.append(entries, PlanEntry.make({ fqn: resource[1] ?? "", action, changedProperties: [] }));
    }
    const change = changeLine.exec(line);
    const property = Str.trim(change?.[2] ?? "");
    return pipe(
      A.last(entries),
      O.filter(() => Str.isNonEmpty(property)),
      O.match({
        onNone: () => entries,
        onSome: (last) =>
          A.append(
            A.dropRight(entries, 1),
            PlanEntry.make({ ...last, changedProperties: A.dedupe(A.append(last.changedProperties, property)) })
          ),
      })
    );
  });

/**
 * The one resource the gate lets a plan delete: the stack's own anomaly email
 * subscription, so a return from `live` to `silent` (the cutover rollback)
 * can pass the workflow. It is not an account singleton and touches nothing
 * that can affect EC2, Spot or Lambda; every other delete, every replace and
 * every orphan is still refused, and the nine adopted settings still may not
 * change (packet gate ruling, 2026-11-14).
 */
const rollbackDeletable = "AnomalyAlerts";
const allowedResources = HashSet.fromIterable([...SingletonIds, "MonthlyBudget", "AnomalyAlerts"]);
const singletonSet = HashSet.fromIterable(SingletonIds);
const violation = (subject: string, reason: ViolationReason, detail: string) =>
  PlanViolation.make({ subject, reason, detail });

const isDestructive = (action: PlanAction) =>
  PlanAction.is.delete(action) || PlanAction.is.replace(action) || PlanAction.is.orphaned(action);

const isRollbackDelete = (entry: PlanEntry) => PlanAction.is.delete(entry.action) && entry.fqn === rollbackDeletable;

const singletonViolations = (entry: PlanEntry): ReadonlyArray<PlanViolation> => {
  if (!(PlanAction.is.adopted(entry.action) || PlanAction.is.noop(entry.action))) {
    return [violation(entry.fqn, "singleton-not-adopt-or-noop", entry.action)];
  }
  return A.isReadonlyArrayNonEmpty(entry.changedProperties)
    ? [violation(entry.fqn, "singleton-property-change", A.join(entry.changedProperties, ","))]
    : [];
};

const entryViolations = (entry: PlanEntry): ReadonlyArray<PlanViolation> => {
  if (!HashSet.has(allowedResources, entry.fqn)) return [violation(entry.fqn, "unexpected-resource", entry.action)];
  if (isDestructive(entry.action) && !isRollbackDelete(entry)) {
    return [violation(entry.fqn, "delete-or-replace", entry.action)];
  }
  return HashSet.has(singletonSet, entry.fqn) ? singletonViolations(entry) : [];
};

const planViolations = (entries: ReadonlyArray<PlanEntry>): ReadonlyArray<PlanViolation> =>
  A.flatMap(entries, entryViolations);

const missingSingletons = (entries: ReadonlyArray<PlanEntry>): ReadonlyArray<PlanViolation> => {
  const planned = HashSet.fromIterable(A.map(entries, (entry) => entry.fqn));
  return pipe(
    SingletonIds,
    A.filter((id) => !HashSet.has(planned, id)),
    A.map((id) => violation(id, "singleton-missing", "not in plan"))
  );
};

const differs = (subject: string, detail: string) => [violation(subject, "live-setting-differs", detail)];

const tagViolations = (live: LiveSettings): ReadonlyArray<PlanViolation> =>
  A.flatMap(CostAllocationTagKey.literals, (tagKey) =>
    A.some(live.costAllocationTags, (tag) => tag.TagKey === tagKey && tag.Status === "Active")
      ? []
      : differs(`tag ${tagKey}`, "not Active")
  );

const accountOnly = "not Active for this account only";

const computeOptimizerViolations = ({ computeOptimizer }: LiveSettings): ReadonlyArray<PlanViolation> =>
  computeOptimizer.status === "Active" && computeOptimizer.memberAccountsEnrolled !== true
    ? []
    : differs("ComputeOptimizer", accountOnly);

const hubViolations = ({ costOptimizationHub }: LiveSettings): ReadonlyArray<PlanViolation> => {
  const active = A.some(costOptimizationHub.items, (item) => item.status === "Active");
  return active && costOptimizationHub.includeMemberAccounts !== true
    ? []
    : differs("CostOptimizationHub", accountOnly);
};

const isServicesMonitor = (monitor: typeof MonitorSummary.Type) =>
  monitor.MonitorType === "DIMENSIONAL" && monitor.MonitorDimension === "SERVICE";

const monitorViolations = (live: LiveSettings): ReadonlyArray<PlanViolation> => {
  const named = A.filter(live.anomalyMonitors, (monitor) => monitor.MonitorName === PhysicalNames.servicesMonitor);
  return named.length === 1 && A.every(named, isServicesMonitor)
    ? []
    : differs("AccountServicesMonitor", "not exactly one DIMENSIONAL SERVICE monitor");
};

const liveViolations = (live: LiveSettings): ReadonlyArray<PlanViolation> => [
  ...tagViolations(live),
  ...computeOptimizerViolations(live),
  ...hubViolations(live),
  ...monitorViolations(live),
];

// Every reason the plan may not deploy; empty when it may.
const planCheckViolations = (entries: ReadonlyArray<PlanEntry>, live: LiveSettings): ReadonlyArray<PlanViolation> => [
  ...planViolations(entries),
  ...missingSingletons(entries),
  ...liveViolations(live),
];

/**
 * Succeed when the plan may deploy; otherwise fail with
 * {@link PlanCheckFailed}.
 *
 * **Example** (Gate a plan)
 *
 * ```ts
 * import { LiveSettings, checkPlan } from "@beep/infra-cost-controls/PlanCheck"
 * import * as Effect from "effect/Effect"
 *
 * const live = LiveSettings.make({
 *   costAllocationTags: [],
 *   computeOptimizer: { status: "Inactive" },
 *   costOptimizationHub: { items: [] },
 *   anomalyMonitors: [],
 * })
 * const exit = Effect.runSyncExit(checkPlan([], live))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @param entries - The parsed plan.
 * @param live - The live values of the nine adopted settings.
 * @returns The checked entries.
 * @category validation
 * @since 0.0.0
 */
export const checkPlan = Effect.fn("CostControls.checkPlan")(function* (
  entries: ReadonlyArray<PlanEntry>,
  live: LiveSettings
) {
  const violations = planCheckViolations(entries, live);
  if (A.isReadonlyArrayNonEmpty(violations)) {
    return yield* PlanCheckFailed.make({
      violations,
      escalate: A.some(violations, (v) => ViolationReason.is["unexpected-resource"](v.reason)),
    });
  }
  return entries;
});
