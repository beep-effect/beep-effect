import {
  BoxActionApplied,
  BoxActionPrecondition,
  BoxAdoptions,
  BoxApplyJournalApplied,
  BoxApplyJournalFailed,
  BoxApplyJournalStarted,
  BoxApplyReceipt,
  BoxDesiredState,
  BoxForeignResource,
  BoxObservedFolder,
  BoxObservedState,
  BoxPostApplyVerdict,
  BoxProviderId,
  BoxProvisioning,
  BoxProvisioningInventory,
  BoxProvisioningPlan,
  BoxProvisioningPlanner,
  encodeBoxProvisioningPlan,
  planBoxProvisioning,
} from "@beep/box-provisioning";
import {
  BoxProvisioningApplier,
  validateBoxProvisioningBlockerContract,
  validateBoxProvisioningPostApplyPlan,
} from "@beep/box-provisioning/BoxProvisioningApplier";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { DateTime, Effect, Layer, pipe, Ref } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { desiredFixture, observedAfterApplyFixture, observedFixture, postApplyAdoptionsFixture } from "./fixtures.ts";
import type { BoxBlockedAction } from "@beep/box-provisioning";

const encodeBoxActionPrecondition = S.encodeEffect(BoxActionPrecondition);
const decodeBoxActionPrecondition = S.decodeEffect(BoxActionPrecondition);
const equivalentBoxActionPrecondition = S.toEquivalence(BoxActionPrecondition);
const encodeBoxForeignResource = S.encodeEffect(BoxForeignResource);
const decodeBoxForeignResource = S.decodeEffect(BoxForeignResource);
const equivalentBoxForeignResource = S.toEquivalence(BoxForeignResource);
const encodeBoxPostApplyVerdict = S.encodeEffect(BoxPostApplyVerdict);
const decodeBoxPostApplyVerdict = S.decodeEffect(BoxPostApplyVerdict);
const equivalentBoxPostApplyVerdict = S.toEquivalence(BoxPostApplyVerdict);
const encodeBoxApplyJournalStarted = S.encodeEffect(BoxApplyJournalStarted);
const decodeBoxApplyJournalStarted = S.decodeEffect(BoxApplyJournalStarted);
const equivalentBoxApplyJournalStarted = S.toEquivalence(BoxApplyJournalStarted);
const encodeBoxApplyJournalApplied = S.encodeEffect(BoxApplyJournalApplied);
const decodeBoxApplyJournalApplied = S.decodeEffect(BoxApplyJournalApplied);
const equivalentBoxApplyJournalApplied = S.toEquivalence(BoxApplyJournalApplied);
const encodeBoxApplyJournalFailed = S.encodeEffect(BoxApplyJournalFailed);
const decodeBoxApplyJournalFailed = S.decodeEffect(BoxApplyJournalFailed);
const equivalentBoxApplyJournalFailed = S.toEquivalence(BoxApplyJournalFailed);

const encodeBoxDesiredState = S.encodeEffect(BoxDesiredState);
const desiredInput = encodeBoxDesiredState(desiredFixture);

const makeDependencies = (plan: BoxProvisioningPlan, postApplyPlan: BoxProvisioningPlan, applyCalls: Ref.Ref<number>) =>
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
        planWithAdoptions: Effect.fn("BoxProvisioningPlanner.planWithAdoptions")(() => Effect.succeed(postApplyPlan)),
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

type ProvisioningDependencies = Layer.Layer<BoxProvisioningApplier | BoxProvisioningInventory | BoxProvisioningPlanner>;

const makeAdoptionDependencies = (
  plan: BoxProvisioningPlan,
  observed: BoxObservedState,
  outcomes: ReadonlyArray<BoxActionApplied>
): ProvisioningDependencies =>
  Layer.mergeAll(
    Layer.succeed(
      BoxProvisioningInventory,
      BoxProvisioningInventory.of({
        observe: Effect.fn("BoxProvisioningInventory.observe")(() => Effect.succeed(observed)),
      })
    ),
    Layer.succeed(
      BoxProvisioningPlanner,
      BoxProvisioningPlanner.of({
        plan: Effect.fn("BoxProvisioningPlanner.plan")(() => Effect.succeed(plan)),
        planWithAdoptions: Effect.fn("BoxProvisioningPlanner.planWithAdoptions")(() => Effect.succeed(plan)),
      })
    ),
    Layer.succeed(
      BoxProvisioningApplier,
      BoxProvisioningApplier.of({
        apply: Effect.fn("BoxProvisioningApplier.apply")((_desired, appliedPlan) =>
          Effect.succeed(
            BoxApplyReceipt.make({
              appliedAt: DateTime.makeUnsafe("2026-08-30T00:00:00.000Z"),
              outcomes,
              planDigest: appliedPlan.planDigest,
            })
          )
        ),
      })
    )
  );

const firstFolderAction = (plan: BoxProvisioningPlan) =>
  Effect.fromOption(A.findFirst(plan.actions, (candidate) => candidate.resourceKind === "folder"));

const runProvisioning = <A, E>(
  dependencies: ProvisioningDependencies,
  use: (service: BoxProvisioning["Service"]) => Effect.Effect<A, E>
) =>
  BoxProvisioning.pipe(
    Effect.flatMap(use),
    provideScopedLayer(BoxProvisioning.layer.pipe(Layer.provide(dependencies)))
  );

it.layer(BunCrypto.layer, { timeout: "10 seconds" })("@beep/box-provisioning orchestration", (it) => {
  it.effect(
    "keeps reconcile dry-run-only and requires explicit apply",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const postApplyPlan = yield* planBoxProvisioning(
        desiredFixture,
        observedAfterApplyFixture,
        postApplyAdoptionsFixture
      );
      const planJson = yield* encodeBoxProvisioningPlan(plan);
      const applyCalls = yield* Ref.make(0);
      const dependencies = makeDependencies(plan, postApplyPlan, applyCalls);

      const encodedDesired = yield* desiredInput;
      const dryRun = yield* runProvisioning(dependencies, (service) => service.reconcile(encodedDesired));
      expect(dryRun.planDigest).toBe(plan.planDigest);
      expect(yield* Ref.get(applyCalls)).toBe(0);

      const result = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(encodedDesired, planJson)
      );
      expect(result.receipt.planDigest).toBe(plan.planDigest);
      expect(result.verdict).toMatchObject({
        allOtherActionsNoop: true,
        entitlementBlockerCount: 2,
        entitlementBlockersPreserved: true,
      });
      expect(yield* Ref.get(applyCalls)).toBe(1);
    })
  );

  it.effect(
    "returns every created folder adoption and replans them as Noop",
    Effect.fnUntraced(function* () {
      const desired = BoxDesiredState.make({
        ...desiredFixture,
        adoptions: BoxAdoptions.make({ entries: [] }),
      });
      const emptyObserved = BoxObservedState.make({
        ...observedFixture,
        collaborations: [],
        folders: [],
        webhooks: [],
      });
      const reviewedPlan = yield* planBoxProvisioning(desired, emptyObserved);
      const reviewedPlanJson = yield* encodeBoxProvisioningPlan(reviewedPlan);
      const desiredJson = yield* encodeBoxDesiredState(desired);
      const crypto = yield* Crypto.Crypto;
      const planWithCrypto = Effect.fnUntraced(function* (
        desiredState: BoxDesiredState,
        observed: BoxObservedState,
        adoptions?: BoxDesiredState["adoptions"]["entries"]
      ) {
        return yield* planBoxProvisioning(desiredState, observed, adoptions).pipe(
          Effect.provideService(Crypto.Crypto, crypto)
        );
      });
      const observeCount = yield* Ref.make(0);
      const dependencies = Layer.mergeAll(
        Layer.succeed(
          BoxProvisioningInventory,
          BoxProvisioningInventory.of({
            observe: Effect.fn("BoxProvisioningInventory.observe")(() =>
              Ref.modify(observeCount, (count) => [count === 0 ? emptyObserved : observedAfterApplyFixture, count + 1])
            ),
          })
        ),
        Layer.succeed(
          BoxProvisioningPlanner,
          BoxProvisioningPlanner.of({ plan: planWithCrypto, planWithAdoptions: planWithCrypto })
        ),
        Layer.succeed(
          BoxProvisioningApplier,
          BoxProvisioningApplier.of({
            apply: Effect.fn("BoxProvisioningApplier.apply")((_appliedDesired, appliedPlan) =>
              Effect.succeed(
                BoxApplyReceipt.make({
                  appliedAt: DateTime.makeUnsafe("2026-08-30T00:00:00.000Z"),
                  outcomes: A.map(
                    A.filter(
                      appliedPlan.actions,
                      (action) => action._tag === "Create" && action.resourceKind === "folder"
                    ),
                    (action, index) =>
                      BoxActionApplied.make({
                        actionKey: action.actionKey,
                        logicalKeyDigest: action.logicalKeyDigest,
                        providerId: BoxProviderId.make(index === 0 ? "100" : "101"),
                        resourceKind: "folder",
                      })
                  ),
                  planDigest: appliedPlan.planDigest,
                })
              )
            ),
          })
        )
      );

      const result = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(desiredJson, reviewedPlanJson)
      );
      const nextDesired = BoxDesiredState.make({ ...desired, adoptions: result.adoptions });
      const nextPlan = yield* planBoxProvisioning(nextDesired, observedAfterApplyFixture);

      expect(result.adoptions.entries).toHaveLength(2);
      expect(A.map(result.adoptions.entries, (adoption) => adoption.logicalKey)).toEqual([
        "folder.child",
        "folder.workspace",
      ]);
      expect(A.map(nextPlan.actions, (action) => action._tag)).toEqual([
        "Noop",
        "Noop",
        "Noop",
        "Noop",
        "Blocked",
        "Blocked",
      ]);
    })
  );

  it.effect(
    "rejects a post-apply folder outcome whose logical-key digest matches no desired folder",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const planJson = yield* encodeBoxProvisioningPlan(plan);
      const encodedDesired = yield* desiredInput;
      const dependencies = makeAdoptionDependencies(plan, observedFixture, [
        BoxActionApplied.make({
          actionKey: (yield* firstFolderAction(plan)).actionKey,
          logicalKeyDigest: Sha256Hex.make("0".repeat(64)),
          providerId: BoxProviderId.make("100"),
          resourceKind: "folder",
        }),
      ]);

      const error = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(encodedDesired, planJson)
      ).pipe(Effect.flip);

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("unresolved-dependency");
      }
    })
  );

  it.effect(
    "rejects a post-apply folder outcome whose provider id is absent from the fresh inventory",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const planJson = yield* encodeBoxProvisioningPlan(plan);
      const encodedDesired = yield* desiredInput;
      const folderAction = yield* firstFolderAction(plan);
      const dependencies = makeAdoptionDependencies(plan, observedFixture, [
        BoxActionApplied.make({
          actionKey: folderAction.actionKey,
          logicalKeyDigest: folderAction.logicalKeyDigest,
          providerId: BoxProviderId.make("does-not-exist"),
          resourceKind: "folder",
        }),
      ]);

      const error = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(encodedDesired, planJson)
      ).pipe(Effect.flip);

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("unresolved-dependency");
      }
    })
  );

  it.effect(
    "rejects a post-apply folder outcome observed without a parent folder",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const planJson = yield* encodeBoxProvisioningPlan(plan);
      const encodedDesired = yield* desiredInput;
      const folderAction = yield* firstFolderAction(plan);
      const parentlessObserved = BoxObservedState.make({
        ...observedFixture,
        folders: A.map(observedFixture.folders, (folder) =>
          BoxObservedFolder.make({ ...folder, parentProviderId: O.none() })
        ),
      });
      const dependencies = makeAdoptionDependencies(plan, parentlessObserved, [
        BoxActionApplied.make({
          actionKey: folderAction.actionKey,
          logicalKeyDigest: folderAction.logicalKeyDigest,
          providerId: BoxProviderId.make("100"),
          resourceKind: "folder",
        }),
      ]);

      const error = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(encodedDesired, planJson)
      ).pipe(Effect.flip);

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("unresolved-dependency");
      }
    })
  );

  it.effect(
    "rejects reviewed-plan content tampering even when the digest field is retained",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const tamperedPlan = BoxProvisioningPlan.make({
        ...plan,
        foreignResources: [],
      });
      const tamperedPlanJson = yield* encodeBoxProvisioningPlan(tamperedPlan);
      const encodedDesired = yield* desiredInput;
      const applyCalls = yield* Ref.make(0);
      const dependencies = makeDependencies(plan, plan, applyCalls);

      const error = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(encodedDesired, tamperedPlanJson)
      ).pipe(Effect.flip);

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("invalid-plan-digest");
      }
      expect(yield* Ref.get(applyCalls)).toBe(0);
    })
  );

  it.effect(
    "compares the complete reviewed plan with the freshly reproduced plan",
    Effect.fnUntraced(function* () {
      const reviewedPlan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const reviewedPlanJson = yield* encodeBoxProvisioningPlan(reviewedPlan);
      const inconsistentFreshPlan = BoxProvisioningPlan.make({
        ...reviewedPlan,
        foreignResources: [],
      });
      const encodedDesired = yield* desiredInput;
      const applyCalls = yield* Ref.make(0);
      const dependencies = makeDependencies(inconsistentFreshPlan, inconsistentFreshPlan, applyCalls);

      const error = yield* runProvisioning(dependencies, (service) =>
        service.applyReviewedPlan(encodedDesired, reviewedPlanJson)
      ).pipe(Effect.flip);

      expect(error._tag).toBe("BoxProvisioningDriftError");
      expect(yield* Ref.get(applyCalls)).toBe(0);
    })
  );

  it.effect(
    "rejects a policy blocker before invoking the mutation service",
    Effect.fnUntraced(function* () {
      const desired = BoxDesiredState.make({ ...desiredFixture, adoptions: BoxAdoptions.make({ entries: [] }) });
      const input = yield* encodeBoxDesiredState(desired);
      const plan = yield* planBoxProvisioning(desired, observedFixture);
      const planJson = yield* encodeBoxProvisioningPlan(plan);
      const applyCalls = yield* Ref.make(0);
      const dependencies = makeDependencies(plan, plan, applyCalls);

      const error = yield* runProvisioning(dependencies, (service) => service.applyReviewedPlan(input, planJson)).pipe(
        Effect.flip
      );

      expect(error._tag).toBe("BoxProvisioningBlockerContractError");
      expect(yield* Ref.get(applyCalls)).toBe(0);
    })
  );

  it.effect(
    "rejects ambiguity and dependency blockers before invoking the mutation service",
    Effect.fnUntraced(function* () {
      const desired = BoxDesiredState.make({ ...desiredFixture, adoptions: BoxAdoptions.make({ entries: [] }) });
      const firstFolder = O.getOrThrow(A.head(observedFixture.folders));
      const observed = BoxObservedState.make({
        ...observedFixture,
        folders: [
          ...observedFixture.folders,
          BoxObservedFolder.make({ ...firstFolder, providerId: BoxProviderId.make("duplicate-folder-id") }),
        ],
      });
      const plan = yield* planBoxProvisioning(desired, observed);
      const blocked = A.filter(plan.actions, (action): action is BoxBlockedAction => P.isTagged(action, "Blocked"));
      const planJson = yield* encodeBoxProvisioningPlan(plan);
      const input = yield* encodeBoxDesiredState(desired);
      const applyCalls = yield* Ref.make(0);
      const dependencies = makeDependencies(plan, plan, applyCalls);

      const error = yield* runProvisioning(dependencies, (service) => service.applyReviewedPlan(input, planJson)).pipe(
        Effect.flip
      );

      pipe(
        A.some(blocked, (action) => action.reason._tag === "BlockedByAmbiguity"),
        assertTrue
      );
      pipe(
        A.some(
          blocked,
          (action) => action.reason._tag === "BlockedByPolicy" && action.reason.policy === "blocked-folder-dependency"
        ),
        assertTrue
      );
      expect(error._tag).toBe("BoxProvisioningBlockerContractError");
      expect(yield* Ref.get(applyCalls)).toBe(0);
    })
  );

  it.effect(
    "rejects too few or extra entitlement blockers",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const blockers = A.filter(plan.actions, (action): action is BoxBlockedAction => P.isTagged(action, "Blocked"));
      const retainedBlocker = O.getOrThrow(A.head(blockers));
      const tooFew = BoxProvisioningPlan.make({
        ...plan,
        actions: A.filter(plan.actions, (action) => action.resourceKind !== "retention"),
      });
      const extra = BoxProvisioningPlan.make({
        ...plan,
        actions: A.append(plan.actions, retainedBlocker),
      });

      const [tooFewError, extraError] = yield* Effect.all(
        [
          validateBoxProvisioningBlockerContract(desiredFixture, tooFew, "pre-apply").pipe(Effect.flip),
          validateBoxProvisioningBlockerContract(desiredFixture, extra, "pre-apply").pipe(Effect.flip),
        ],
        { concurrency: 1 }
      );

      expect(P.isTagged(tooFewError, "BoxProvisioningBlockerContractError") && tooFewError.code).toBe(
        "entitlement-blocker-mismatch"
      );
      expect(P.isTagged(extraError, "BoxProvisioningBlockerContractError") && extraError.code).toBe(
        "entitlement-blocker-mismatch"
      );
    })
  );

  it.effect(
    "rejects a post-apply plan with changed entitlement blockers or residual creates",
    Effect.fnUntraced(function* () {
      const reviewed = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const converged = yield* planBoxProvisioning(
        desiredFixture,
        observedAfterApplyFixture,
        postApplyAdoptionsFixture
      );
      const withoutRetention = BoxProvisioningPlan.make({
        ...converged,
        actions: A.filter(converged.actions, (action) => action.resourceKind !== "retention"),
      });

      const changedBlockers = yield* validateBoxProvisioningPostApplyPlan(
        desiredFixture,
        reviewed,
        withoutRetention
      ).pipe(Effect.flip);
      const residualCreate = yield* validateBoxProvisioningPostApplyPlan(desiredFixture, reviewed, reviewed).pipe(
        Effect.flip
      );

      expect(P.isTagged(changedBlockers, "BoxProvisioningBlockerContractError") && changedBlockers.code).toBe(
        "entitlement-blocker-mismatch"
      );
      expect(P.isTagged(residualCreate, "BoxProvisioningBlockerContractError") && residualCreate.code).toBe(
        "post-apply-non-noop-action"
      );
    })
  );
  it.effect.prop(
    "round-trips schema-derived plan and receipt building blocks",
    { value: Arbitrary.schema(BoxActionPrecondition) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxActionPrecondition(value).pipe(Effect.flatMap(decodeBoxActionPrecondition));
      pipe(equivalentBoxActionPrecondition(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
  it.effect.prop(
    "round-trips schema-derived BoxForeignResource",
    { value: Arbitrary.schema(BoxForeignResource) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxForeignResource(value).pipe(Effect.flatMap(decodeBoxForeignResource));
      pipe(equivalentBoxForeignResource(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
  it.effect.prop(
    "round-trips schema-derived BoxPostApplyVerdict",
    { value: Arbitrary.schema(BoxPostApplyVerdict) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxPostApplyVerdict(value).pipe(Effect.flatMap(decodeBoxPostApplyVerdict));
      pipe(equivalentBoxPostApplyVerdict(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
  it.effect.prop(
    "round-trips schema-derived BoxApplyJournalStarted",
    { value: Arbitrary.schema(BoxApplyJournalStarted) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxApplyJournalStarted(value).pipe(Effect.flatMap(decodeBoxApplyJournalStarted));
      pipe(equivalentBoxApplyJournalStarted(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
  it.effect.prop(
    "round-trips schema-derived BoxApplyJournalApplied",
    { value: Arbitrary.schema(BoxApplyJournalApplied) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxApplyJournalApplied(value).pipe(Effect.flatMap(decodeBoxApplyJournalApplied));
      pipe(equivalentBoxApplyJournalApplied(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
  it.effect.prop(
    "round-trips schema-derived BoxApplyJournalFailed",
    { value: Arbitrary.schema(BoxApplyJournalFailed) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxApplyJournalFailed(value).pipe(Effect.flatMap(decodeBoxApplyJournalFailed));
      pipe(equivalentBoxApplyJournalFailed(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
});
