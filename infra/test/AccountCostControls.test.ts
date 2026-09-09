import { AccountCostControls, AccountCostControlsConfig } from "@beep/infra";
import { describe, expect, it } from "@effect/vitest";
import * as pulumi from "@pulumi/pulumi";
import { Effect, MutableHashMap, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const decode = S.decodeUnknownResult(AccountCostControlsConfig);

describe("@beep/infra AccountCostControls", () => {
  it("defaults to the approved soft guardrail and rejects unsafe thresholds", () => {
    const config = Result.getOrThrow(decode({ expectedAccountId: "123456789012" }));
    expect(config.monthlyBudgetUsd).toBe(500);
    expect(config.anomalyImpactUsd).toBe(10);
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "500"]) {
      expect(Result.isFailure(decode({ expectedAccountId: "123456789012", monthlyBudgetUsd: invalid }))).toBe(true);
      expect(Result.isFailure(decode({ expectedAccountId: "123456789012", anomalyImpactUsd: invalid }))).toBe(true);
    }
    expect(Result.isFailure(decode({ expectedAccountId: "wrong-account" }))).toBe(true);
  });

  it.effect(
    "limits resources to account visibility and preserves the existing budget semantics",
    Effect.fnUntraced(function* () {
      const resources = MutableHashMap.empty<string, unknown>();
      const types = MutableHashMap.empty<string, string>();
      yield* Effect.acquireUseRelease(
        Effect.tryPromise(() =>
          pulumi.runtime.setMocks(
            {
              call: () => ({}),
              newResource: (args) => {
                MutableHashMap.set(resources, args.name, args.inputs);
                MutableHashMap.set(types, args.name, args.type);
                return { id: `${args.name}-id`, state: { ...args.inputs, arn: `arn:example:${args.name}` } };
              },
            },
            "beep-effect",
            "test"
          )
        ),
        () =>
          Effect.sync(
            () =>
              new AccountCostControls(
                "cost",
                Result.getOrThrow(decode({ expectedAccountId: "123456789012" })),
                pulumi.secret(["operator@example.com", "operator@example.com"])
              )
          ),
        () => Effect.tryPromise(() => pulumi.runtime.disconnect())
      );

      const resource = (name: string) => O.getOrThrow(MutableHashMap.get(resources, name));
      expect(resource("cost-aws")).toMatchObject({ region: "us-east-1", allowedAccountIds: '["123456789012"]' });
      expect(resource("cost-monthly")).toMatchObject({
        accountId: "123456789012",
        name: "Monthly Budget",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        limitAmount: "500",
        costFilters: [],
        costTypes: {
          includeTax: true,
          includeCredit: false,
          includeRefund: false,
          useBlended: false,
          useAmortized: false,
        },
        notifications: {
          [pulumi.runtime.specialSigKey]: pulumi.runtime.specialSecretSig,
          value: [
            { notificationType: "ACTUAL", threshold: 50, subscriberEmailAddresses: ["operator@example.com"] },
            { notificationType: "ACTUAL", threshold: 80, subscriberEmailAddresses: ["operator@example.com"] },
            { notificationType: "ACTUAL", threshold: 100, subscriberEmailAddresses: ["operator@example.com"] },
            { notificationType: "FORECASTED", threshold: 100, subscriberEmailAddresses: ["operator@example.com"] },
          ],
        },
      });
      expect(resource("cost-compute-optimizer")).toEqual({ status: "Active", includeMemberAccounts: false });
      expect(resource("cost-optimization-hub")).toEqual({ includeMemberAccounts: false });
      expect(resource("cost-daily-anomalies")).toMatchObject({
        frequency: "DAILY",
        subscribers: {
          [pulumi.runtime.specialSigKey]: pulumi.runtime.specialSecretSig,
          value: [{ type: "EMAIL", address: "operator@example.com" }],
        },
        thresholdExpression: {
          dimension: { key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE", matchOptions: ["GREATER_THAN_OR_EQUAL"], values: ["10"] },
        },
      });
      for (const key of ["App", "Project", "ManagedBy", "beep-ci", "ghr:environment", "DataClass"]) {
        expect(resource(`cost-tag-${key}`)).toEqual({ tagKey: key, status: "Active" });
      }
      expect(A.sort(A.fromIterable(MutableHashMap.values(types)), Order.String)).toEqual([
        "aws:budgets/budget:Budget",
        "aws:computeoptimizer/enrollmentStatus:EnrollmentStatus",
        "aws:costexplorer/anomalyMonitor:AnomalyMonitor",
        "aws:costexplorer/anomalySubscription:AnomalySubscription",
        ...A.replicate("aws:costexplorer/costAllocationTag:CostAllocationTag", 6),
        "aws:costoptimizationhub/enrollmentStatus:EnrollmentStatus",
        "beep:infra:AccountCostControls",
        "pulumi:providers:aws",
      ]);
    })
  );
});
