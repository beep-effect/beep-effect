/**
 * Account cost visibility with protected state ownership and no spending actions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $InfraId } from "@beep/identity/packages";
import { EmailString } from "@beep/schema";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $InfraId.create("AccountCostControls");

const AccountId = S.String.check(
  S.isPattern(/^\d{12}$/u, {
    identifier: $I`AccountIdFormat`,
    title: "AWS Account ID",
    description: "The twelve-digit AWS account that owns the cost controls.",
    message: "Expected a twelve-digit AWS account ID",
  })
).pipe($I.annoteSchema("AccountId", { description: "Expected AWS account for guarded cost operations." }));

const PositiveDollars = S.Finite.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveDollars", { description: "A finite positive cost threshold in US dollars." })
);

/**
 * Validated account identity and informational spending thresholds.
 *
 * **Example** (Decode the initial guardrail)
 *
 * ```ts
 * import { AccountCostControlsConfig } from "@beep/infra"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(AccountCostControlsConfig)({
 *   expectedAccountId: "123456789012",
 * })
 * console.log(result._tag)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class AccountCostControlsConfig extends S.Class<AccountCostControlsConfig>($I`AccountCostControlsConfig`)(
  {
    expectedAccountId: AccountId,
    monthlyBudgetUsd: PositiveDollars.pipe(S.withDecodingDefault(Effect.succeed(500))),
    anomalyImpactUsd: PositiveDollars.pipe(S.withDecodingDefault(Effect.succeed(10))),
  },
  $I.annote("AccountCostControlsConfig", {
    description: "Account-scoped cost controls that never stop or resize workloads.",
  })
) {}

const NotificationEmails = S.NonEmptyArray(EmailString).pipe(
  $I.annoteSchema("NotificationEmails", { description: "Existing budget recipients supplied through secret config." })
);
const decodeNotificationEmails = S.decodeUnknownResult(NotificationEmails);
const decodeAccountCostControlsConfig = S.decodeResult(AccountCostControlsConfig);

/**
 * Load nonsecret operational settings at the Pulumi configuration boundary.
 *
 * **Example** (Reference the configuration loader)
 *
 * ```ts
 * import { loadAccountCostControlsConfig } from "@beep/infra"
 *
 * console.log(typeof loadAccountCostControlsConfig)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const loadAccountCostControlsConfig = (): AccountCostControlsConfig => {
  const config = new pulumi.Config("accountCostControls");
  return Result.getOrThrowWith(
    decodeAccountCostControlsConfig({
      expectedAccountId: config.require("expectedAccountId"),
      monthlyBudgetUsd: config.getNumber("monthlyBudgetUsd"),
      anomalyImpactUsd: config.getNumber("anomalyImpactUsd"),
    }),
    () => new pulumi.RunError("Invalid accountCostControls account or spending threshold configuration")
  );
};

/**
 * Own the existing budget, standard recommendations, billing tags and anomaly alerts.
 *
 * **Details**
 *
 * Import the existing budget into this component before the first update. The
 * dedicated provider rejects the wrong account. Resource protection prevents a
 * future CI stack teardown from silently removing account-wide cost controls.
 * Move their state deliberately before retiring the containing stack.
 *
 * **Example** (Reference the account component)
 *
 * ```ts
 * import { AccountCostControls } from "@beep/infra"
 *
 * console.log(typeof AccountCostControls)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export class AccountCostControls extends pulumi.ComponentResource {
  /**
   * Identifies the managed budget without exposing subscriber information.
   *
   * @category resources
   * @since 0.0.0
   */
  readonly budgetId: pulumi.Output<string>;
  /**
   * Identifies the account's service-dimension anomaly monitor.
   *
   * @category resources
   * @since 0.0.0
   */
  readonly anomalyMonitorArn: pulumi.Output<string>;

  constructor(
    name: string,
    config: AccountCostControlsConfig,
    notificationEmails: pulumi.Output<unknown>,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("beep:infra:AccountCostControls", name, {}, opts);

    const provider = new aws.Provider(
      `${name}-aws`,
      { region: "us-east-1", allowedAccountIds: [config.expectedAccountId] },
      { parent: this, protect: true }
    );
    const resourceOptions = { parent: this, provider, protect: true };
    const emails = pulumi.secret(
      notificationEmails.apply((input) =>
        A.dedupe(
          Result.getOrThrowWith(
            decodeNotificationEmails(input),
            () => new pulumi.RunError("Invalid accountCostControls notification recipients; values are redacted")
          )
        )
      )
    );

    const budget = new aws.budgets.Budget(
      `${name}-monthly`,
      {
        accountId: config.expectedAccountId,
        name: "Monthly Budget",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        limitAmount: `${config.monthlyBudgetUsd}`,
        limitUnit: "USD",
        timePeriodStart: "2020-07-01_00:00",
        timePeriodEnd: "2087-06-15_00:00",
        costFilters: [],
        // Preserve the existing budget's invoice semantics when adopting it.
        costTypes: {
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
        },
        notifications: emails.apply((recipients) => [
          ...A.map([50, 80, 100], (threshold) => ({
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            thresholdType: "PERCENTAGE",
            threshold,
            subscriberEmailAddresses: recipients,
          })),
          {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            thresholdType: "PERCENTAGE",
            threshold: 100,
            subscriberEmailAddresses: recipients,
          },
        ]),
      },
      { ...resourceOptions, additionalSecretOutputs: ["notifications"] }
    );

    // These six keys were present in this account's Cost Explorer allocation-tag
    // inventory on 2026-09-09. Recheck availability before the attended apply;
    // resource tags alone do not prove billing has ingested a key.
    for (const tagKey of ["App", "Project", "ManagedBy", "beep-ci", "ghr:environment", "DataClass"]) {
      new aws.costexplorer.CostAllocationTag(
        `${name}-tag-${tagKey}`,
        { tagKey, status: "Active" },
        { ...resourceOptions, retainOnDelete: true }
      );
    }

    new aws.computeoptimizer.EnrollmentStatus(
      `${name}-compute-optimizer`,
      { status: "Active", includeMemberAccounts: false },
      { ...resourceOptions, retainOnDelete: true }
    );
    new aws.costoptimizationhub.EnrollmentStatus(
      `${name}-optimization-hub`,
      { includeMemberAccounts: false },
      { ...resourceOptions, retainOnDelete: true }
    );

    const monitor = new aws.costexplorer.AnomalyMonitor(
      `${name}-service-monitor`,
      { name: "beep-account-services", monitorType: "DIMENSIONAL", monitorDimension: "SERVICE" },
      resourceOptions
    );
    new aws.costexplorer.AnomalySubscription(
      `${name}-daily-anomalies`,
      {
        name: "beep-account-daily-anomalies",
        frequency: "DAILY",
        monitorArnLists: [monitor.arn],
        subscribers: emails.apply(A.map((address) => ({ type: "EMAIL", address }))),
        thresholdExpression: {
          dimension: {
            key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
            matchOptions: ["GREATER_THAN_OR_EQUAL"],
            values: [`${config.anomalyImpactUsd}`],
          },
        },
      },
      { ...resourceOptions, additionalSecretOutputs: ["subscribers"] }
    );

    this.budgetId = budget.id;
    this.anomalyMonitorArn = monitor.arn;
    this.registerOutputs({ budgetId: this.budgetId, anomalyMonitorArn: this.anomalyMonitorArn });
  }
}
