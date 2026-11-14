import { decodeCostControlsConfig, productionConfig } from "@beep/infra-cost-controls/Config";
import {
  budgetName,
  DeclaredResourceTypes,
  declareCostControls,
  PhysicalNames,
  program,
  SingletonIds,
} from "@beep/infra-cost-controls/CostControls";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as FakeAws from "./support/FakeAws.ts";

const environmentOf = (values: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));
const recipientsVariable = {
  COST_CONTROLS_NOTIFICATION_EMAILS: "ops@example.com, Billing@Example.com,ops@example.com",
};
const singletonMutations = ["UpdateCostAllocationTagsStatus", "UpdateEnrollmentStatus"];
const tagStatus = (account: FakeAws.FakeAccount, tagKey: string) =>
  O.getOrUndefined(MutableHashMap.get(account.costAllocationTags, tagKey));
const allTagsActive = (account: FakeAws.FakeAccount) =>
  A.every(A.fromIterable(account.costAllocationTags), ([, status]) => status === "Active");

describe("CostControls personal stage", () => {
  const personal = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "dev_test" });
  personal.provider("creates only a silent stage-suffixed budget and never touches an account setting", (stack) =>
    Effect.gen(function* () {
      const { account } = personal;
      const output = yield* stack.deploy(program.pipe(environmentOf({})));

      expect(output.budgetName).toBe("beep-account-monthly-cost-dev_test");
      expect(output.notifications).toBe("silent");
      expect(output.anomalyMonitorArn).toBeUndefined();
      expect(output.anomalySubscriptionArn).toBeUndefined();
      expect(output.costAllocationTags).toEqual([]);
      expect(output.computeOptimizer).toBeUndefined();
      expect(output.costOptimizationHub).toBeUndefined();

      expect(personal.budget(budgetName("dev_test"))?.notifications).toEqual([]);
      expect(personal.budget("Monthly Budget")?.budget.BudgetName).toBe("Monthly Budget");
      expect(FakeAws.mutations(account)).toEqual(["CreateBudget"]);
      for (const operation of [
        "GetAnomalyMonitors",
        "ListCostAllocationTags",
        "GetEnrollmentStatus",
        "ListEnrollmentStatuses",
      ]) {
        expect(FakeAws.operations(account)).not.toContain(operation);
      }

      account.calls.length = 0;
      yield* stack.destroy();
      expect(personal.budget(budgetName("dev_test"))).toBeUndefined();
      expect(FakeAws.mutations(account)).toEqual(["DeleteBudget"]);
      expect(allTagsActive(account)).toBe(true);
      expect(account.computeOptimizer.status).toBe("Active");
      expect(account.costOptimizationHub.status).toBe("Active");
    })
  );
});

describe("CostControls prod stage", () => {
  const silent = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "prod" });
  silent.provider("adopts the services monitor, keeps the budget silent and retains both", (stack) =>
    Effect.gen(function* () {
      const { account } = silent;
      const live = silent.monitor(PhysicalNames.servicesMonitor);
      const output = yield* stack.deploy(program.pipe(environmentOf({ CI: "true" })));

      expect(output.budgetName).toBe(PhysicalNames.budget);
      expect(output.anomalyMonitorArn).toBe(live?.arn);
      expect(output.anomalySubscriptionArn).toBeUndefined();
      expect(MutableHashMap.size(account.monitors)).toBe(1);
      expect(FakeAws.operations(account)).not.toContain("CreateAnomalyMonitor");
      expect(silent.monitor(PhysicalNames.servicesMonitor)?.tags["alchemy::id"]).toBe("AccountServicesMonitor");
      expect(silent.budget(PhysicalNames.budget)?.notifications).toEqual([]);
      expect(MutableHashMap.size(account.subscriptions)).toBe(0);

      account.calls.length = 0;
      yield* stack.destroy();
      expect(FakeAws.mutations(account)).toEqual([]);
      expect(silent.budget(PhysicalNames.budget)).toBeDefined();
      expect(silent.monitor(PhysicalNames.servicesMonitor)).toBeDefined();
      expect(allTagsActive(account)).toBe(true);
    })
  );

  const live = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "prod" });
  live.provider("in the live phase mails each recipient once from the budget and the subscription", (stack) =>
    Effect.gen(function* () {
      const { account } = live;
      const config = yield* decodeCostControlsConfig({ ...productionConfig, notifications: "live" });
      const output = yield* stack.deploy(declareCostControls(config, "prod").pipe(environmentOf(recipientsVariable)));

      const notifications = live.budget(PhysicalNames.budget)?.notifications ?? [];
      expect(A.map(notifications, (entry) => entry.notification.Threshold)).toEqual([50, 80, 100, 100]);
      expect(A.map(notifications, (entry) => entry.notification.NotificationType)).toEqual([
        "ACTUAL",
        "ACTUAL",
        "ACTUAL",
        "FORECASTED",
      ]);
      for (const entry of notifications) {
        expect(A.map(entry.subscribers, (subscriber) => subscriber.Address)).toEqual([
          "ops@example.com",
          "billing@example.com",
        ]);
      }

      const subscription = live.subscription(PhysicalNames.anomalySubscription);
      expect(output.anomalySubscriptionArn).toBe(subscription?.arn);
      expect(subscription?.body.MonitorArnList).toEqual([output.anomalyMonitorArn]);
      expect(subscription?.body.Frequency).toBe("DAILY");
      expect(subscription?.body.ThresholdExpression).toEqual({
        Dimensions: {
          Key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
          Values: ["10"],
          MatchOptions: ["GREATER_THAN_OR_EQUAL"],
        },
      });

      account.calls.length = 0;
      yield* stack.deploy(declareCostControls(config, "prod").pipe(environmentOf(recipientsVariable)));
      expect(FakeAws.operations(account)).not.toContain("UpdateAnomalySubscription");
      expect(FakeAws.operations(account)).not.toContain("CreateNotification");
    })
  );

  const removal = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "prod" });
  removal.provider("removing the singletons from the stack deletes nothing", (stack) =>
    Effect.gen(function* () {
      const { account } = removal;
      const config = yield* decodeCostControlsConfig(productionConfig);
      yield* stack.deploy(declareCostControls(config, "prod").pipe(environmentOf({})));

      account.calls.length = 0;
      yield* stack.deploy(Effect.succeed({ removed: true }));
      for (const operation of singletonMutations) {
        expect(FakeAws.operations(account)).not.toContain(operation);
      }
      expect(FakeAws.mutations(account)).toEqual([]);
      expect(tagStatus(account, "ghr:environment")).toBe("Active");
      expect(allTagsActive(account)).toBe(true);
      expect(account.computeOptimizer.status).toBe("Active");
      expect(account.costOptimizationHub.status).toBe("Active");
      expect(removal.monitor(PhysicalNames.servicesMonitor)).toBeDefined();
      expect(removal.budget(PhysicalNames.budget)).toBeDefined();
    })
  );
});

describe("CostControls guards", () => {
  const ci = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "prod" });
  ci.provider("refuses a prod deploy outside CI before any AWS call", (stack) =>
    Effect.gen(function* () {
      const error = yield* FakeAws.deployFailure(stack)(program.pipe(environmentOf({})));
      expect(FakeAws.failureTags(error)).toContain("ConfigError");
      expect(ci.account.calls).toEqual([]);
    })
  );

  const otherAccount = FakeAws.harness({
    seed: { ...FakeAws.liveAccount, accountId: "111111111111" },
    stage: "dev_test",
  });
  otherAccount.provider("refuses an account other than the expected one before any AWS call", (stack) =>
    Effect.gen(function* () {
      const error = yield* FakeAws.deployFailure(stack)(program.pipe(environmentOf({})));
      expect(FakeAws.failureTags(error)).toContain("ConfigError");
      expect(String(error)).toContain("832907639880");
      expect(otherAccount.account.calls).toEqual([]);
    })
  );

  const otherRegion = FakeAws.harness({ seed: { ...FakeAws.liveAccount, region: "us-west-2" }, stage: "dev_test" });
  otherRegion.provider("refuses a region other than us-east-1", (stack) =>
    Effect.gen(function* () {
      const error = yield* FakeAws.deployFailure(stack)(program.pipe(environmentOf({})));
      expect(FakeAws.failureTags(error)).toContain("ConfigError");
      expect(otherRegion.account.calls).toEqual([]);
    })
  );

  const noRecipients = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "prod" });
  noRecipients.provider("refuses the live phase without a recipient list", (stack) =>
    Effect.gen(function* () {
      const config = yield* decodeCostControlsConfig({ ...productionConfig, notifications: "live" });
      const error = yield* FakeAws.deployFailure(stack)(declareCostControls(config, "prod").pipe(environmentOf({})));
      expect(FakeAws.failureTags(error)).toContain("ConfigError");
      expect(noRecipients.account.calls).toEqual([]);
    })
  );
});

describe("CostControls personal-stage graph", () => {
  // Account-wide settings are adopted and written only by prod from CI,
  // behind the pre-deploy gate; a workstation stage plans its budget alone.
  const graph = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "dev_test" });
  graph.provider("plans no account singleton type, only the stage budget", (stack) =>
    Effect.gen(function* () {
      const plan = yield* stack.plan(program.pipe(environmentOf({})));
      const planned = A.filter(R.values(plan.resources), (item) => item !== undefined);
      const singletonTypes = [
        "AWS.CostExplorer.AnomalyMonitor",
        "BeepAWS.CostExplorer.CostAllocationTag",
        "BeepAWS.ComputeOptimizer.Enrollment",
        "BeepAWS.CostOptimizationHub.Enrollment",
      ];

      expect(A.map(planned, (item) => item?.resource.Type)).toEqual(["AWS.Budgets.Budget"]);
      for (const item of planned) expect(singletonTypes).not.toContain(item?.resource.Type);
      for (const id of SingletonIds) expect(R.keys(plan.resources)).not.toContain(id);
    })
  );
});

describe("CostControls never enforces", () => {
  // A budget action, an SCP, a quota change or an anomaly response could stop,
  // throttle or deny EC2 or Spot launches for the runner pools. The stack
  // declares none; adding one needs a new ruling from the CI window owner.
  const launchControls = ["BudgetAction", "Organizations", "ServiceQuotas", "EC2", "AutoScaling", "Lambda", "IAM"];
  const enforcement = FakeAws.harness({ seed: FakeAws.liveAccount, stage: "prod" });
  enforcement.provider("declares only the six cost types, and the budget carries no action", (stack) =>
    Effect.gen(function* () {
      const config = yield* decodeCostControlsConfig({ ...productionConfig, notifications: "live" });
      const plan = yield* stack.plan(declareCostControls(config, "prod").pipe(environmentOf(recipientsVariable)));
      const planned = A.filter(R.values(plan.resources), (item) => item !== undefined);
      const types = A.map(planned, (item) => item?.resource.Type ?? "");

      expect(A.length(types)).toBe(11);
      for (const type of types) {
        expect(DeclaredResourceTypes).toContain(type);
        for (const control of launchControls) expect(type).not.toContain(control);
      }
      const budgetProps = plan.resources.MonthlyBudget?.props;
      const budgetKeys = budgetProps !== null && typeof budgetProps === "object" ? R.keys(budgetProps) : [];
      expect(budgetKeys.length).toBeGreaterThan(0);
      for (const key of budgetKeys) expect(Str.toLowerCase(key)).not.toContain("action");
    })
  );
});
