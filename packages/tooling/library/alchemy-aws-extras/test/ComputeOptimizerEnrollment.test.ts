import { ComputeOptimizerEnrollment } from "@beep/alchemy-aws-extras/ComputeOptimizerEnrollment";
import { describe, expect } from "@effect/vitest";
import { destroy } from "alchemy/RemovalPolicy";
import * as Effect from "effect/Effect";
import * as FakeAws from "./support/FakeAws.ts";

describe("ComputeOptimizerEnrollment", () => {
  const lifecycle = FakeAws.harness();
  lifecycle.provider("enrolls, updates, reads and retains the account", (stack) =>
    Effect.gen(function* () {
      const { account } = lifecycle;

      const created = yield* stack.deploy(ComputeOptimizerEnrollment("ComputeOptimizer", { status: "Active" }));
      expect(created).toEqual({ status: "Active", memberAccountsEnrolled: false });
      expect(account.computeOptimizer.status).toBe("Active");

      account.calls.length = 0;
      yield* stack.deploy(ComputeOptimizerEnrollment("ComputeOptimizer", { status: "Active" }));
      expect(FakeAws.operations(account)).not.toContain("UpdateEnrollmentStatus");

      const updated = yield* stack.deploy(ComputeOptimizerEnrollment("ComputeOptimizer", { status: "Inactive" }));
      expect(updated.status).toBe("Inactive");
      expect(account.computeOptimizer.status).toBe("Inactive");

      yield* stack.deploy(ComputeOptimizerEnrollment("ComputeOptimizer", { status: "Active" }));
      account.calls.length = 0;
      yield* stack.destroy();
      expect(FakeAws.operations(account)).not.toContain("UpdateEnrollmentStatus");
      expect(account.computeOptimizer.status).toBe("Active");
    })
  );

  const adopt = FakeAws.harness({ computeOptimizer: "Active" });
  adopt.provider("adopts an existing enrollment without updating it", (stack) =>
    Effect.gen(function* () {
      const adopted = yield* stack.deploy(ComputeOptimizerEnrollment("ComputeOptimizer"));
      expect(adopted.status).toBe("Active");
      expect(FakeAws.operations(adopt.account)).toContain("GetEnrollmentStatus");
      expect(FakeAws.operations(adopt.account)).not.toContain("UpdateEnrollmentStatus");
    })
  );

  const explicitDestroy = FakeAws.harness();
  explicitDestroy.provider("opts out on delete under an explicit destroy policy", (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(ComputeOptimizerEnrollment("ComputeOptimizer", { status: "Active" }).pipe(destroy()));
      expect(explicitDestroy.account.computeOptimizer.status).toBe("Active");

      yield* stack.destroy();
      expect(explicitDestroy.account.computeOptimizer.status).toBe("Inactive");
    })
  );
});
