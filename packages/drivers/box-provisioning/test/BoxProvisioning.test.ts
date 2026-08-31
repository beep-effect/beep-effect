import {
  BoxApplyReceipt,
  BoxDesiredState,
  BoxProvisioning,
  BoxProvisioningApplier,
  BoxProvisioningInventory,
  BoxProvisioningPlan,
  BoxProvisioningPlanner,
  encodeBoxProvisioningPlan,
  planBoxProvisioning,
} from "@beep/box-provisioning";
import { Sha256Hex } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Ref } from "effect";
import * as S from "effect/Schema";
import { desiredFixture, observedFixture } from "./fixtures.ts";

const desiredInput = S.encodeSync(BoxDesiredState)(desiredFixture);

const makeDependencies = (plan: BoxProvisioningPlan, applyCalls: Ref.Ref<number>) =>
  Layer.mergeAll(
    Layer.succeed(
      BoxProvisioningInventory,
      BoxProvisioningInventory.of({
        observe: Effect.fn("BoxProvisioningInventory.observe")(() => Effect.succeed(observedFixture)),
      })
    ),
    Layer.succeed(
      BoxProvisioningPlanner,
      BoxProvisioningPlanner.of({
        plan: Effect.fn("BoxProvisioningPlanner.plan")(() => Effect.succeed(plan)),
      })
    ),
    Layer.succeed(
      BoxProvisioningApplier,
      BoxProvisioningApplier.of({
        apply: Effect.fn("BoxProvisioningApplier.apply")((_desired, appliedPlan) =>
          Ref.update(applyCalls, (count) => count + 1).pipe(
            Effect.as(
              BoxApplyReceipt.make({
                appliedAt: DateTime.makeUnsafe("2026-08-30T00:00:00.000Z"),
                outcomes: [],
                planDigest: appliedPlan.planDigest,
              })
            )
          )
        ),
      })
    )
  );

const runProvisioning = <A, E>(
  dependencies: ReturnType<typeof makeDependencies>,
  use: (service: BoxProvisioning["Service"]) => Effect.Effect<A, E>
) =>
  BoxProvisioning.pipe(
    Effect.flatMap(use),
    provideScopedLayer(BoxProvisioning.layer.pipe(Layer.provide(dependencies)))
  );

describe("@beep/box-provisioning orchestration", () => {
  it.effect(
    "keeps reconcile dry-run-only and requires explicit apply",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const planJson = yield* encodeBoxProvisioningPlan(plan);
      const applyCalls = yield* Ref.make(0);
      const dependencies = makeDependencies(plan, applyCalls);

      const dryRun = yield* runProvisioning(dependencies, (service) => service.reconcile(desiredInput));
      expect(dryRun.planDigest).toBe(plan.planDigest);
      expect(yield* Ref.get(applyCalls)).toBe(0);

      const receipt = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(desiredInput, planJson)
      );
      expect(receipt.planDigest).toBe(plan.planDigest);
      expect(yield* Ref.get(applyCalls)).toBe(1);
    })
  );

  it.effect(
    "rejects reviewed-plan drift before invoking the applier",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const stalePlan = BoxProvisioningPlan.make({
        ...plan,
        planDigest: Sha256Hex.make("f".repeat(64)),
      });
      const stalePlanJson = yield* encodeBoxProvisioningPlan(stalePlan);
      const applyCalls = yield* Ref.make(0);
      const dependencies = makeDependencies(plan, applyCalls);

      const error = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(desiredInput, stalePlanJson)
      ).pipe(Effect.flip);

      expect(error._tag).toBe("BoxProvisioningDriftError");
      expect(yield* Ref.get(applyCalls)).toBe(0);
    })
  );
});
