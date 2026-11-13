import { CostOptimizationHubEnrollment } from "@beep/alchemy-aws-extras/CostOptimizationHubEnrollment";
import { describe, expect } from "@effect/vitest";
import { destroy } from "alchemy/RemovalPolicy";
import * as Effect from "effect/Effect";
import * as FakeAws from "./fixtures/FakeAws.ts";

describe("CostOptimizationHubEnrollment", () => {
  const lifecycle = FakeAws.harness();
  lifecycle.provider("enrolls, updates, reads and retains the account", (stack) =>
    Effect.gen(function* () {
      const { account } = lifecycle;

      const created = yield* stack.deploy(CostOptimizationHubEnrollment("OptimizationHub", { status: "Active" }));
      expect(created).toEqual({ status: "Active", includeMemberAccounts: false });
      expect(account.costOptimizationHub.status).toBe("Active");

      account.calls.length = 0;
      yield* stack.deploy(CostOptimizationHubEnrollment("OptimizationHub", { status: "Active" }));
      expect(FakeAws.operations(account)).not.toContain("UpdateEnrollmentStatus");

      const updated = yield* stack.deploy(CostOptimizationHubEnrollment("OptimizationHub", { status: "Inactive" }));
      expect(updated.status).toBe("Inactive");
      expect(account.costOptimizationHub.status).toBe("Inactive");

      yield* stack.deploy(CostOptimizationHubEnrollment("OptimizationHub", { status: "Active" }));
      account.calls.length = 0;
      yield* stack.destroy();
      expect(FakeAws.operations(account)).not.toContain("UpdateEnrollmentStatus");
      expect(account.costOptimizationHub.status).toBe("Active");
    })
  );

  const adopt = FakeAws.harness({ costOptimizationHub: "Active" });
  adopt.provider("adopts an existing enrollment without updating it", (stack) =>
    Effect.gen(function* () {
      const adopted = yield* stack.deploy(CostOptimizationHubEnrollment("OptimizationHub"));
      expect(adopted.status).toBe("Active");
      expect(FakeAws.operations(adopt.account)).toContain("ListEnrollmentStatuses");
      expect(FakeAws.operations(adopt.account)).not.toContain("UpdateEnrollmentStatus");
    })
  );

  const explicitDestroy = FakeAws.harness();
  explicitDestroy.provider("opts out on delete under an explicit destroy policy", (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(CostOptimizationHubEnrollment("OptimizationHub", { status: "Active" }).pipe(destroy()));
      expect(explicitDestroy.account.costOptimizationHub.status).toBe("Active");

      yield* stack.destroy();
      expect(explicitDestroy.account.costOptimizationHub.status).toBe("Inactive");
    })
  );
});
