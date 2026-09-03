/**
 * Dry-run-first orchestration for Box desired-state reconciliation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { Context, Effect, Equal, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import {
  BoxProvisioningApplier,
  validateBoxProvisioningBlockerContract,
  validateBoxProvisioningPostApplyPlan,
} from "./BoxProvisioningApplier.ts";
import { decodeBoxDesiredState, decodeBoxProvisioningPlan } from "./BoxProvisioningArtifacts.ts";
import { BoxProvisioningDriftError, BoxProvisioningInvariantError } from "./BoxProvisioningErrors.ts";
import { BoxAdoption, BoxDesiredState, BoxLogicalKey, mergeBoxAdoptions } from "./BoxProvisioningIntent.ts";
import { BoxProvisioningInventory } from "./BoxProvisioningInventory.ts";
import { BoxProvisioningPlanner } from "./BoxProvisioningPlanner.ts";
import { BoxReviewedApplyResult } from "./BoxProvisioningReceipt.ts";
import { digestText, hasValidBoxProvisioningPlanDigest } from "./internal/canonical.ts";
import type * as B from "@beep/box";
import type { BoxProvisioningApplyJournal } from "./BoxProvisioningApplier.ts";
import type {
  BoxProvisioningApplyJournalError,
  BoxProvisioningBlockerContractError,
  BoxProvisioningSchemaError,
  BoxProvisioningSubjectMismatchError,
  BoxProvisioningTenantMismatchError,
} from "./BoxProvisioningErrors.ts";
import type { BoxObservedState } from "./BoxProvisioningObserved.ts";
import type { BoxProvisioningPlan } from "./BoxProvisioningPlan.ts";
import type { BoxActionApplied, BoxApplyOutcome } from "./BoxProvisioningReceipt.ts";

const $I = $BoxProvisioningId.create("BoxProvisioning");

type ReadError =
  | B.BoxError
  | BoxProvisioningInvariantError
  | BoxProvisioningSchemaError
  | BoxProvisioningSubjectMismatchError
  | BoxProvisioningTenantMismatchError;

type ApplyError =
  | ReadError
  | BoxProvisioningDriftError
  | BoxProvisioningBlockerContractError
  | BoxProvisioningApplyJournalError;

const isAppliedOutcome = (outcome: BoxApplyOutcome): outcome is BoxActionApplied => P.isTagged(outcome, "Applied");

const postApplyAdoptions = Effect.fn("BoxProvisioning.postApplyAdoptions")(function* (
  desired: BoxDesiredState,
  observed: BoxObservedState,
  receipt: BoxReviewedApplyResult["receipt"]
) {
  const appliedFolders = A.filter(A.filter(receipt.outcomes, isAppliedOutcome), (outcome) =>
    Equal.equals(outcome.resourceKind, "folder")
  );
  return yield* Effect.forEach(
    appliedFolders,
    Effect.fnUntraced(function* (outcome) {
      const desiredFolder = yield* O.match(
        A.findFirst(desired.folders, (folder) => Equal.equals(digestText(folder.logicalKey), outcome.logicalKeyDigest)),
        {
          onNone: () => Effect.fail(BoxProvisioningInvariantError.make({ code: "unresolved-dependency" })),
          onSome: Effect.succeed,
        }
      );
      const observedFolder = yield* O.match(
        A.findFirst(observed.folders, (folder) => Equal.equals(folder.providerId, outcome.providerId)),
        {
          onNone: () => Effect.fail(BoxProvisioningInvariantError.make({ code: "unresolved-dependency" })),
          onSome: Effect.succeed,
        }
      );
      const expectedParentProviderId = yield* O.match(observedFolder.parentProviderId, {
        onNone: () => Effect.fail(BoxProvisioningInvariantError.make({ code: "unresolved-dependency" })),
        onSome: Effect.succeed,
      });
      return BoxAdoption.make({
        expectedParentProviderId,
        expectedProviderId: observedFolder.providerId,
        logicalKey: BoxLogicalKey.make(desiredFolder.logicalKey),
        resourceKind: "folder",
      });
    }),
    { concurrency: 1 }
  );
});

const makeService = (
  inventory: BoxProvisioningInventory["Service"],
  planner: BoxProvisioningPlanner["Service"],
  applier: BoxProvisioningApplier["Service"]
): BoxProvisioningShape => {
  const dryRun = Effect.fn("BoxProvisioning.dryRun")(function* (desiredInput: unknown) {
    const desired = yield* decodeBoxDesiredState(desiredInput);
    const observed = yield* inventory.observe(desired);
    return yield* planner.plan(desired, observed);
  });

  const applyReviewedPlan = Effect.fn("BoxProvisioning.applyReviewedPlan")(function* (
    desiredInput: unknown,
    reviewedPlanJson: unknown
  ) {
    const [desired, reviewedPlan] = yield* Effect.all([
      decodeBoxDesiredState(desiredInput),
      decodeBoxProvisioningPlan(reviewedPlanJson),
    ]);
    if (!hasValidBoxProvisioningPlanDigest(reviewedPlan)) {
      return yield* BoxProvisioningInvariantError.make({ code: "invalid-plan-digest" });
    }
    yield* validateBoxProvisioningBlockerContract(desired, reviewedPlan, "pre-apply");
    const observed = yield* inventory.observe(desired);
    const freshPlan = yield* planner.plan(desired, observed);
    if (!Equal.equals(reviewedPlan, freshPlan)) {
      return yield* BoxProvisioningDriftError.make({
        actualPlanDigest: freshPlan.planDigest,
        expectedPlanDigest: reviewedPlan.planDigest,
      });
    }
    const receipt = yield* applier.apply(desired, reviewedPlan);
    const postObserved = yield* inventory.observe(desired);
    const additionalAdoptions = yield* postApplyAdoptions(desired, postObserved, receipt);
    const adoptions = mergeBoxAdoptions(desired.adoptions, additionalAdoptions);
    const adoptedDesired = BoxDesiredState.make({ ...desired, adoptions });
    const postApplyPlan = yield* planner.planWithAdoptions(adoptedDesired, postObserved, A.empty());
    const verdict = yield* validateBoxProvisioningPostApplyPlan(adoptedDesired, reviewedPlan, postApplyPlan);
    return BoxReviewedApplyResult.make({ adoptions, postApplyPlan, receipt, verdict });
  });

  return { applyReviewedPlan, dryRun, reconcile: dryRun };
};

/**
 * Runtime contract for dry-run-first Box reconciliation.
 *
 * @category services
 * @since 0.0.0
 */
export interface BoxProvisioningShape {
  /** Apply only after decoding and reproducing one operator-reviewed plan digest. */
  readonly applyReviewedPlan: (
    desiredInput: unknown,
    reviewedPlanJson: unknown
  ) => Effect.Effect<BoxReviewedApplyResult, ApplyError>;
  /** Explicit read-only alias for the default reconciliation entry point. */
  readonly dryRun: (desiredInput: unknown) => Effect.Effect<BoxProvisioningPlan, ReadError>;
  /** Default reconciliation entry point; performs inventory and planning only. */
  readonly reconcile: (desiredInput: unknown) => Effect.Effect<BoxProvisioningPlan, ReadError>;
}

/**
 * Coordinates secure intent decoding, read-only discovery, planning, and guarded apply.
 *
 * **Details**
 *
 * `reconcile` and `dryRun` expose no mutation service. `applyReviewedPlan` is a
 * separate explicit call that inventories again and rejects drift before it
 * invokes the applier with that exact reviewed plan.
 *
 * **Example** (Run the default dry-run entry point)
 *
 * ```ts
 * import { BoxProvisioning } from "@beep/box-provisioning/BoxProvisioning"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const provisioning = yield* BoxProvisioning
 *   return provisioning.reconcile
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxProvisioning extends Context.Service<BoxProvisioning, BoxProvisioningShape>()($I`BoxProvisioning`) {
  static readonly layer = Layer.effect(
    BoxProvisioning,
    Effect.all([BoxProvisioningInventory, BoxProvisioningPlanner, BoxProvisioningApplier]).pipe(
      Effect.map(([inventory, planner, applier]) => BoxProvisioning.of(makeService(inventory, planner, applier)))
    )
  );

  /**
   * Orchestration plus live inventory and apply layers, requiring one Box layer.
   *
   * **Example** (Inspect the Box-backed layer)
   *
   * ```ts
   * import { BoxProvisioning } from "@beep/box-provisioning/BoxProvisioning"
   *
   * console.log(BoxProvisioning.liveLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly liveLayer: Layer.Layer<BoxProvisioning, never, B.Box> = BoxProvisioning.layer.pipe(
    Layer.provide(
      Layer.mergeAll(BoxProvisioningInventory.layer, BoxProvisioningPlanner.layer, BoxProvisioningApplier.layer)
    )
  );

  /**
   * Live orchestration layer that requires an explicit durable apply-journal sink.
   *
   * **Example** (Inspect the journal-aware live layer)
   *
   * ```ts
   * import { BoxProvisioning } from "@beep/box-provisioning/BoxProvisioning"
   *
   * console.log(BoxProvisioning.liveLayerWithJournal)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly liveLayerWithJournal: Layer.Layer<BoxProvisioning, never, B.Box | BoxProvisioningApplyJournal> =
    BoxProvisioning.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          BoxProvisioningInventory.layer,
          BoxProvisioningPlanner.layer,
          BoxProvisioningApplier.layerWithJournal
        )
      )
    );
}
