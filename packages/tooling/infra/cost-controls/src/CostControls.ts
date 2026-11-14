/**
 * The `CostControls` stack program: the account budget, the anomaly monitor
 * and subscription, the six cost allocation tags and the two optimization
 * enrollments.
 *
 * @packageDocumentation
 * @category stacks
 * @since 0.0.0
 */

import * as AWS from "@alchemy.run/aws";
import * as AwsExtras from "@beep/alchemy-aws-extras";
import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import {
  CostAllocationTagKey,
  NotificationPhase,
  notificationRecipients,
  productionStage,
  resolveStageConfig,
} from "./Config.ts";
import { requireCiForProduction, requireExpectedAccount } from "./Guards.ts";
import type { CostControlsConfig } from "./Config.ts";

/**
 * Pinned physical names. New names for the two named resources (D12): a
 * same-name budget would adopt the Pulumi-owned one silently, so they must
 * differ from `Monthly Budget` and `beep-account-daily-anomalies`. The
 * monitor keeps its live name because it is adopted, not recreated.
 *
 * **Example** (Read the production budget name)
 *
 * ```ts
 * import { PhysicalNames } from "@beep/infra-cost-controls/CostControls"
 *
 * console.log(PhysicalNames.budget) // "beep-account-monthly-cost"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PhysicalNames = {
  budget: "beep-account-monthly-cost",
  anomalySubscription: "beep-account-anomaly-alerts",
  servicesMonitor: "beep-account-services",
} as const;

/**
 * Budget name of a stage: the pinned name in `prod`, the pinned name
 * suffixed with the stage everywhere else.
 *
 * **Example** (Name a personal budget)
 *
 * ```ts
 * import { budgetName } from "@beep/infra-cost-controls/CostControls"
 *
 * console.log(budgetName("dev_alice")) // "beep-account-monthly-cost-dev_alice"
 * ```
 *
 * @param stage - The Alchemy stage.
 * @returns The budget's physical name in that stage.
 * @category constants
 * @since 0.0.0
 */
export const budgetName = (stage: string): string =>
  stage === productionStage ? PhysicalNames.budget : `${PhysicalNames.budget}-${stage}`;

/**
 * Cost types of the Pulumi budget, read from the live budget on 2026-11-13:
 * invoice semantics, credits and refunds not offsetting spend.
 */
const costTypes = {
  includeTax: true,
  includeSubscription: true,
  useBlended: false,
  includeRefund: false,
  includeCredit: false,
  includeUpfront: true,
  includeRecurring: true,
  includeOtherSubscription: true,
  includeSupport: true,
  includeDiscount: true,
  useAmortized: false,
};

const budgetNotifications = (recipients: ReadonlyArray<string>) => {
  const subscribers = A.map(recipients, (address) => ({ subscriptionType: "EMAIL", address }));
  return [
    ...A.map([50, 80, 100], (threshold) => ({
      notificationType: "ACTUAL",
      comparisonOperator: "GREATER_THAN",
      thresholdType: "PERCENTAGE",
      threshold,
      subscribers,
    })),
    {
      notificationType: "FORECASTED",
      comparisonOperator: "GREATER_THAN",
      thresholdType: "PERCENTAGE",
      threshold: 100,
      subscribers,
    },
  ];
};

const tagLogicalId = (tagKey: CostAllocationTagKey) =>
  CostAllocationTagKey.match(tagKey, {
    App: () => "AppTag",
    "beep-ci": () => "BeepCiTag",
    DataClass: () => "DataClassTag",
    "ghr:environment": () => "GhrEnvironmentTag",
    ManagedBy: () => "ManagedByTag",
    Project: () => "ProjectTag",
  });

/**
 * Logical ids of the nine adopted account singletons: the six cost
 * allocation tags, the two enrollments and the services anomaly monitor.
 * The pre-deploy gate requires each to plan as an adopt or no-op with no
 * property change.
 *
 * **Example** (Count the singletons)
 *
 * ```ts
 * import { SingletonIds } from "@beep/infra-cost-controls/CostControls"
 *
 * console.log(SingletonIds.length) // 9
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SingletonIds: ReadonlyArray<string> = [
  ...A.map(CostAllocationTagKey.literals, tagLogicalId),
  "ComputeOptimizer",
  "CostOptimizationHub",
  "AccountServicesMonitor",
];

/**
 * Every resource type the stack may declare. None of them can stop,
 * throttle or deny an EC2 or Spot launch: no budget action, no SCP, no
 * quota change, no anomaly response. The provider layer registers exactly
 * these, and a test fails if the stack declares any other type.
 *
 * **Example** (Read the declared types)
 *
 * ```ts
 * import { DeclaredResourceTypes } from "@beep/infra-cost-controls/CostControls"
 *
 * console.log(DeclaredResourceTypes.length) // 6
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DeclaredResourceTypes: ReadonlyArray<string> = [
  "AWS.Budgets.Budget",
  "AWS.CostExplorer.AnomalyMonitor",
  "AWS.CostExplorer.AnomalySubscription",
  "BeepAWS.CostExplorer.CostAllocationTag",
  "BeepAWS.ComputeOptimizer.Enrollment",
  "BeepAWS.CostOptimizationHub.Enrollment",
];

/**
 * The account singletons: six cost allocation tags and two enrollments.
 * Their `read` reports plain attributes, so each live setting adopts without
 * `--adopt`, and their default removal policy is `retain`, so removing one
 * from the stack, or destroying the stack, leaves the account setting alone.
 */
const accountSingletons = Effect.fn("CostControls.accountSingletons")(function* () {
  const tags = yield* Effect.forEach(CostAllocationTagKey.literals, (tagKey) =>
    AwsExtras.CostAllocationTag.CostAllocationTag(tagLogicalId(tagKey), { tagKey })
  );
  const computeOptimizer = yield* AwsExtras.ComputeOptimizerEnrollment.ComputeOptimizerEnrollment("ComputeOptimizer", {
    status: "Active",
    includeMemberAccounts: false,
  });
  const costOptimizationHub = yield* AwsExtras.CostOptimizationHubEnrollment.CostOptimizationHubEnrollment(
    "CostOptimizationHub",
    { status: "Active", includeMemberAccounts: false }
  );
  return { tags, computeOptimizer, costOptimizationHub };
});

/**
 * The account's AWS services anomaly monitor. AWS allows one `DIMENSIONAL`
 * `SERVICE` monitor per account, so it cannot be recreated beside the
 * Pulumi-owned one: `prod` adopts it by its live name and retains it.
 */
const servicesMonitor = AWS.CostExplorer.AnomalyMonitor("AccountServicesMonitor", {
  monitorName: PhysicalNames.servicesMonitor,
  monitorType: "DIMENSIONAL",
  monitorDimension: "SERVICE",
}).pipe(adopt(true), RemovalPolicy.retain());

/**
 * Declare the stack's resources for one stage.
 *
 * **Details**
 *
 * Every stage declares the budget and the eight account singletons. Only
 * `prod` declares the services anomaly monitor (an account singleton by
 * quota) and, in the `live` phase, the anomaly subscription. In the `silent`
 * phase the budget carries no notifications and the recipient variable is
 * not read. The budget is retained in `prod`, so a stack destroy cannot
 * remove the account budget.
 *
 * **Example** (Declare a personal stage)
 *
 * ```ts
 * import { resolveStageConfig } from "@beep/infra-cost-controls/Config"
 * import { declareCostControls } from "@beep/infra-cost-controls/CostControls"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.flatMap(resolveStageConfig("dev_alice"), (config) => declareCostControls(config, "dev_alice"))
 * console.log(typeof program) // "object"
 * ```
 *
 * @param config - The stage configuration.
 * @param stage - The Alchemy stage.
 * @returns The stack output: names and ARNs, never recipient addresses.
 * @category stacks
 * @since 0.0.0
 */
export const declareCostControls = Effect.fn("CostControls.declare")(function* (
  config: CostControlsConfig,
  stage: string
) {
  const isProduction = stage === productionStage;
  const recipients = NotificationPhase.is.live(config.notifications) ? yield* notificationRecipients : [];

  const budget = yield* AWS.Budgets.Budget("MonthlyBudget", {
    budgetName: budgetName(stage),
    budgetType: "COST",
    timeUnit: "MONTHLY",
    budgetLimit: { amount: `${config.monthlyBudgetUsd}`, unit: "USD" },
    costTypes,
    notifications: A.isReadonlyArrayNonEmpty(recipients) ? budgetNotifications(recipients) : [],
  }).pipe(RemovalPolicy.retain(isProduction));

  const singletons = yield* accountSingletons();

  const monitor = isProduction ? yield* servicesMonitor : undefined;
  const subscription =
    monitor !== undefined && A.isReadonlyArrayNonEmpty(recipients)
      ? yield* AWS.CostExplorer.AnomalySubscription("AnomalyAlerts", {
          subscriptionName: PhysicalNames.anomalySubscription,
          monitorArnList: [monitor.monitorArn],
          subscribers: A.map(recipients, (address) => ({ type: "EMAIL", address })),
          frequency: "DAILY",
          // Key order matches what GetAnomalySubscriptions returns; the
          // provider compares the expression as JSON.
          thresholdExpression: {
            Dimensions: {
              Key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
              Values: [`${config.anomalyImpactUsd}`],
              MatchOptions: ["GREATER_THAN_OR_EQUAL"],
            },
          },
        })
      : undefined;

  return {
    budgetName: budget.budgetName,
    budgetArn: budget.budgetArn,
    notifications: config.notifications,
    anomalyMonitorArn: monitor?.monitorArn,
    anomalySubscriptionArn: subscription?.subscriptionArn,
    costAllocationTags: A.map(singletons.tags, (tag) => tag.tagKey),
    computeOptimizer: singletons.computeOptimizer.status,
    costOptimizationHub: singletons.costOptimizationHub.status,
  };
});

/**
 * The stack program: the `CI` guard on `prod`, the account guard on every
 * stage, then {@link declareCostControls} with the stage's configuration.
 *
 * **Example** (Reference the program)
 *
 * ```ts
 * import { program } from "@beep/infra-cost-controls/CostControls"
 *
 * console.log(typeof program) // "object"
 * ```
 *
 * @category stacks
 * @since 0.0.0
 */
export const program = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  yield* requireCiForProduction(stack.stage);
  const config = yield* resolveStageConfig(stack.stage);
  yield* requireExpectedAccount(config);
  return yield* declareCostControls(config, stack.stage);
});
