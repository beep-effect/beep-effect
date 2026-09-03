/**
 * Guarded Box mutation service for an exact reviewed provisioning plan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import * as B from "@beep/box";
import { $BoxProvisioningId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema";
import { Context, DateTime, Effect, Equal, Layer, Match, MutableHashMap, MutableHashSet, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { BoxProvisioningBlockerContractError, BoxProvisioningInvariantError } from "./BoxProvisioningErrors.ts";
import {
  BoxCollaborationIntent,
  BoxFolderIntent,
  BoxMetadataIntent,
  BoxRetentionIntent,
  BoxWebhookIntent,
  boxFolderNamesEquivalent,
} from "./BoxProvisioningIntent.ts";
import {
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedWebhook,
  BoxProviderId,
} from "./BoxProvisioningObserved.ts";
import {
  BoxActionApplied,
  BoxActionBlocked,
  BoxActionSkipped,
  BoxApplyAttemptId,
  BoxApplyJournalApplied,
  BoxApplyJournalFailed,
  BoxApplyJournalStarted,
  BoxApplyReceipt,
  BoxPostApplyVerdict,
} from "./BoxProvisioningReceipt.ts";
import {
  boxDesiredStateDigest,
  canonicalWebhookIntent,
  digestText,
  encodedDigest,
  hasValidBoxProvisioningPlanDigest,
} from "./internal/canonical.ts";
import {
  listFolderCollaborations,
  listFolderItems,
  listObservedWebhooks,
  toObservedCollaboration,
  toObservedCollaborationFromFull,
  toObservedFolderFromFull,
  toObservedWebhook,
} from "./internal/live.ts";
import type { BoxProvisioningApplyJournalError } from "./BoxProvisioningErrors.ts";
import type { BoxDesiredState, BoxLogicalKey } from "./BoxProvisioningIntent.ts";
import type {
  BoxBlockedAction,
  BoxCreateAction,
  BoxNoopAction,
  BoxPlanAction,
  BoxProvisioningPlan,
  BoxUpdateAction,
} from "./BoxProvisioningPlan.ts";
import type { BoxApplyJournalEntry, BoxApplyOutcome } from "./BoxProvisioningReceipt.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningApplier");

const sha256Equivalence = S.toEquivalence(Sha256Hex);

const RawResourceIdentity = S.Struct({ id: S.NonEmptyString });

type DesiredResource =
  | BoxFolderIntent
  | BoxCollaborationIntent
  | BoxWebhookIntent
  | BoxMetadataIntent
  | BoxRetentionIntent;

const invariant = (code: BoxProvisioningInvariantError["code"]) => BoxProvisioningInvariantError.make({ code });

const findDesired = <T extends DesiredResource>(
  resources: ReadonlyArray<T>,
  logicalKeyDigest: Sha256Hex
): Effect.Effect<T, BoxProvisioningInvariantError> =>
  pipe(
    A.findFirst(resources, (resource) => Equal.equals(digestText(resource.logicalKey), logicalKeyDigest)),
    Effect.fromOption(() => invariant("unresolved-dependency"))
  );

const requiredProviderId = (action: BoxPlanAction): Effect.Effect<BoxProviderId, BoxProvisioningInvariantError> =>
  Effect.fromOption(action.precondition.providerId, () => invariant("missing-provider-id"));

const resolveFolderProviderId = (
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>,
  logicalKey: BoxLogicalKey
): Effect.Effect<BoxProviderId, BoxProvisioningInvariantError> =>
  pipe(
    MutableHashMap.get(folderProviderIds, digestText(logicalKey)),
    Effect.fromOption(() => invariant("unresolved-dependency"))
  );

const collaborationMatches = (
  desired: BoxCollaborationIntent,
  observed: BoxObservedCollaboration,
  folderProviderId: BoxProviderId
): boolean =>
  Equal.equals(observed.folderProviderId, folderProviderId) &&
  Equal.equals(observed.principalType, desired.principalType) &&
  (Equal.equals(observed.principal, desired.principal) ||
    O.contains(observed.principalProviderId, BoxProviderId.make(desired.principal)));

const desiredAfterDigest = (
  desiredState: BoxDesiredState,
  action: BoxPlanAction
): Effect.Effect<Sha256Hex, BoxProvisioningInvariantError> =>
  Match.value(action.resourceKind).pipe(
    Match.when("folder", () =>
      findDesired(desiredState.folders, action.logicalKeyDigest).pipe(
        Effect.map((desired) => encodedDigest(BoxFolderIntent, desired))
      )
    ),
    Match.when("collaboration", () =>
      findDesired(desiredState.collaborations, action.logicalKeyDigest).pipe(
        Effect.map((desired) => encodedDigest(BoxCollaborationIntent, desired))
      )
    ),
    Match.when("webhook", () =>
      findDesired(desiredState.webhooks, action.logicalKeyDigest).pipe(
        Effect.map((desired) => encodedDigest(BoxWebhookIntent, canonicalWebhookIntent(desired)))
      )
    ),
    Match.when("metadata", () =>
      findDesired(desiredState.metadata, action.logicalKeyDigest).pipe(
        Effect.map((desired) => encodedDigest(BoxMetadataIntent, desired))
      )
    ),
    Match.when("retention", () =>
      findDesired(desiredState.retention, action.logicalKeyDigest).pipe(
        Effect.map((desired) => encodedDigest(BoxRetentionIntent, desired))
      )
    ),
    Match.exhaustive
  );

const validateActionDesiredBinding = Effect.fn("BoxProvisioningApplier.validateActionDesiredBinding")(function* (
  desiredState: BoxDesiredState,
  action: BoxPlanAction
) {
  const expected = yield* desiredAfterDigest(desiredState, action);
  if (!O.contains(action.afterDigest, expected)) {
    return yield* invariant("action-after-digest-mismatch");
  }
});

const validateActionShape = (action: BoxPlanAction): Effect.Effect<void, BoxProvisioningInvariantError> =>
  Match.value(action).pipe(
    Match.tags({
      Blocked: () => Effect.void,
      Create: (candidate) =>
        candidate.precondition.state === "absent" &&
        O.isNone(candidate.precondition.providerId) &&
        O.isNone(candidate.precondition.etag) &&
        O.isNone(candidate.beforeDigest)
          ? Effect.void
          : Effect.fail(invariant("action-precondition-mismatch")),
      Noop: (candidate) =>
        candidate.precondition.state === "unchanged" &&
        O.isSome(candidate.precondition.providerId) &&
        O.isSome(candidate.beforeDigest)
          ? Effect.void
          : Effect.fail(invariant("action-precondition-mismatch")),
      Update: (candidate) =>
        candidate.precondition.state === "present" &&
        O.isSome(candidate.precondition.providerId) &&
        O.isSome(candidate.beforeDigest)
          ? Effect.void
          : Effect.fail(invariant("action-precondition-mismatch")),
    }),
    Match.orElse(() => Effect.fail(invariant("unsupported-action")))
  );

const validateBeforeDigest = (
  action: BoxNoopAction | BoxUpdateAction,
  actual: Sha256Hex
): Effect.Effect<void, BoxProvisioningInvariantError> =>
  O.match(action.beforeDigest, {
    onNone: () => Effect.fail(invariant("missing-before-digest")),
    onSome: (expected) =>
      sha256Equivalence(expected, actual) ? Effect.void : Effect.fail(invariant("action-precondition-mismatch")),
  });

const appliedOutcome = (action: BoxPlanAction, providerId: BoxProviderId): BoxApplyOutcome =>
  BoxActionApplied.make({
    actionKey: action.actionKey,
    logicalKeyDigest: action.logicalKeyDigest,
    providerId,
    resourceKind: action.resourceKind,
  });

const collaborationAccessibleBy = (
  desired: BoxCollaborationIntent
): B.CreateCollaborationRequestBodyAccessibleByField =>
  Match.value(desired.principalType).pipe(
    Match.when("user", () =>
      B.CreateCollaborationRequestBodyAccessibleByField.make({ type: "user", login: desired.principal })
    ),
    Match.when("group", () =>
      B.CreateCollaborationRequestBodyAccessibleByField.make({ type: "group", id: desired.principal })
    ),
    Match.exhaustive
  );

const decodeCreatedIdentity = (value: unknown): Effect.Effect<BoxProviderId, BoxProvisioningInvariantError> =>
  S.decodeUnknownEffect(RawResourceIdentity)(value).pipe(
    Effect.map((identity) => BoxProviderId.make(identity.id)),
    Effect.mapError(() => invariant("unreadable-sdk-response"))
  );

const validateFolderAbsent = Effect.fn("BoxProvisioningApplier.validateFolderAbsent")(function* (
  box: B.Box["Service"],
  parentProviderId: BoxProviderId,
  desired: BoxFolderIntent
) {
  const items = yield* listFolderItems(box, parentProviderId);
  const names = yield* Effect.forEach(
    A.filter(items, S.is(B.FolderMini)),
    (item) => Effect.fromOption(O.fromNullishOr(item.name), () => invariant("unreadable-sdk-response")),
    { concurrency: 1 }
  );
  if (A.some(names, (name) => boxFolderNamesEquivalent(name, desired.name))) {
    return yield* invariant("action-precondition-mismatch");
  }
});

const validateCollaborationAbsent = Effect.fn("BoxProvisioningApplier.validateCollaborationAbsent")(function* (
  box: B.Box["Service"],
  folderProviderId: BoxProviderId,
  desired: BoxCollaborationIntent
) {
  const collaborations = yield* listFolderCollaborations(box, folderProviderId).pipe(
    Effect.flatMap((entries) =>
      Effect.forEach(entries, (collaboration) => toObservedCollaboration(collaboration, folderProviderId), {
        concurrency: 1,
      })
    )
  );
  if (A.some(collaborations, (observed) => collaborationMatches(desired, observed, folderProviderId))) {
    return yield* invariant("action-precondition-mismatch");
  }
});

const validateWebhookAbsent = Effect.fn("BoxProvisioningApplier.validateWebhookAbsent")(function* (
  box: B.Box["Service"],
  folderProviderId: BoxProviderId,
  desired: BoxWebhookIntent
) {
  const webhooks = yield* listObservedWebhooks(box);
  if (
    A.some(
      webhooks,
      (observed) =>
        Equal.equals(observed.targetProviderId, folderProviderId) && Equal.equals(observed.address, desired.address)
    )
  ) {
    return yield* invariant("action-precondition-mismatch");
  }
});

const readObservedFolder = Effect.fn("BoxProvisioningApplier.readObservedFolder")(function* (
  box: B.Box["Service"],
  providerId: BoxProviderId
) {
  return yield* box.folders
    .getFolderById(B.FoldersGetFolderByIdPayload.make({ folderId: providerId }))
    .pipe(Effect.flatMap(toObservedFolderFromFull));
});

/**
 * Revalidates only folder identity fields that dependent writes cannot change.
 *
 * **Details**
 *
 * Provider id, parent provider id, and Box-equivalent name remain stable across
 * child and collaboration writes. The folder etag is deliberately excluded:
 * Box's behavior when child membership changes is unverified, so an etag change
 * cannot safely distinguish external drift from the reconciler's own prior
 * dependent mutation. A folder's own action precondition still checks its etag.
 */
const validateFolderDependency = Effect.fn("BoxProvisioningApplier.validateFolderDependency")(function* (
  box: B.Box["Service"],
  logicalKey: BoxLogicalKey,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>,
  folderIdentities: MutableHashMap.MutableHashMap<Sha256Hex, BoxObservedFolder>
) {
  const logicalKeyDigest = digestText(logicalKey);
  const providerId = yield* resolveFolderProviderId(folderProviderIds, logicalKey);
  const reviewedIdentity = yield* MutableHashMap.get(folderIdentities, logicalKeyDigest).pipe(
    Effect.fromOption(() => invariant("unresolved-dependency"))
  );
  const liveIdentity = yield* readObservedFolder(box, providerId);
  if (
    !Equal.equals(reviewedIdentity.providerId, liveIdentity.providerId) ||
    !Equal.equals(reviewedIdentity.parentProviderId, liveIdentity.parentProviderId) ||
    !boxFolderNamesEquivalent(reviewedIdentity.name, liveIdentity.name)
  ) {
    return yield* invariant("action-precondition-mismatch");
  }
});

const validateExistingPrecondition = Effect.fn("BoxProvisioningApplier.validateExistingPrecondition")(function* (
  box: B.Box["Service"],
  action: BoxNoopAction | BoxUpdateAction
) {
  const providerId = yield* requiredProviderId(action);
  const actual = yield* Match.value(action.resourceKind).pipe(
    Match.when("folder", () =>
      readObservedFolder(box, providerId).pipe(
        Effect.map((folder) => ({
          digest: encodedDigest(BoxObservedFolder, folder),
          etag: folder.etag,
          folder: O.some(folder),
        }))
      )
    ),
    Match.when("collaboration", () =>
      box.userCollaborations
        .getCollaborationById(B.UserCollaborationsGetCollaborationByIdPayload.make({ collaborationId: providerId }))
        .pipe(
          Effect.flatMap(toObservedCollaborationFromFull),
          Effect.map((collaboration) => ({
            digest: encodedDigest(BoxObservedCollaboration, collaboration),
            etag: O.none(),
            folder: O.none<BoxObservedFolder>(),
          }))
        )
    ),
    Match.when("webhook", () =>
      box.webhooks.getWebhookById(B.WebhooksGetWebhookByIdPayload.make({ webhookId: providerId })).pipe(
        Effect.flatMap(toObservedWebhook),
        Effect.map((webhook) => ({
          digest: encodedDigest(BoxObservedWebhook, webhook),
          etag: O.none(),
          folder: O.none<BoxObservedFolder>(),
        }))
      )
    ),
    Match.orElse(() => Effect.fail(invariant("unsupported-action")))
  );
  if (!Equal.equals(action.precondition.etag, actual.etag)) {
    return yield* invariant("action-precondition-mismatch");
  }
  yield* validateBeforeDigest(action, actual.digest);
  return actual.folder;
});

const createFolder = Effect.fn("BoxProvisioningApplier.createFolder")(function* (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxCreateAction,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>,
  folderIdentities: MutableHashMap.MutableHashMap<Sha256Hex, BoxObservedFolder>
) {
  const desired = yield* findDesired(desiredState.folders, action.logicalKeyDigest);
  const parentProviderId = yield* O.match(desired.parentKey, {
    onNone: () => Effect.succeed(desiredState.rootFolderId),
    onSome: (parentKey) => resolveFolderProviderId(folderProviderIds, parentKey),
  });
  yield* validateFolderAbsent(box, parentProviderId, desired);
  yield* O.match(desired.parentKey, {
    onNone: () => Effect.void,
    onSome: (parentKey) => validateFolderDependency(box, parentKey, folderProviderIds, folderIdentities),
  });
  const created = yield* box.folders.createFolder(
    B.FoldersCreateFolderPayload.make({
      requestBody: { name: desired.name, parent: { id: parentProviderId } },
    })
  );
  const createdIdentity = yield* toObservedFolderFromFull(created);
  const providerId = createdIdentity.providerId;
  if (
    !O.contains(createdIdentity.parentProviderId, parentProviderId) ||
    !boxFolderNamesEquivalent(createdIdentity.name, desired.name)
  ) {
    return yield* invariant("unreadable-sdk-response");
  }
  MutableHashMap.set(folderProviderIds, action.logicalKeyDigest, providerId);
  MutableHashMap.set(folderIdentities, action.logicalKeyDigest, createdIdentity);
  return appliedOutcome(action, providerId);
});

const createCollaboration = Effect.fn("BoxProvisioningApplier.createCollaboration")(function* (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxCreateAction,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>,
  folderIdentities: MutableHashMap.MutableHashMap<Sha256Hex, BoxObservedFolder>
) {
  const desired = yield* findDesired(desiredState.collaborations, action.logicalKeyDigest);
  const folderProviderId = yield* resolveFolderProviderId(folderProviderIds, desired.folderKey);
  yield* validateCollaborationAbsent(box, folderProviderId, desired);
  yield* validateFolderDependency(box, desired.folderKey, folderProviderIds, folderIdentities);
  const created = yield* box.userCollaborations.createCollaboration(
    B.UserCollaborationsCreateCollaborationPayload.make({
      requestBody: {
        accessibleBy: collaborationAccessibleBy(desired),
        item: { id: folderProviderId, type: "folder" },
        role: desired.role,
      },
    })
  );
  return appliedOutcome(action, BoxProviderId.make(created.id));
});

const createWebhook = Effect.fn("BoxProvisioningApplier.createWebhook")(function* (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxCreateAction,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>,
  folderIdentities: MutableHashMap.MutableHashMap<Sha256Hex, BoxObservedFolder>
) {
  const desired = yield* findDesired(desiredState.webhooks, action.logicalKeyDigest);
  const folderProviderId = yield* resolveFolderProviderId(folderProviderIds, desired.folderKey);
  yield* validateWebhookAbsent(box, folderProviderId, desired);
  yield* validateFolderDependency(box, desired.folderKey, folderProviderIds, folderIdentities);
  const created = yield* box.webhooks.createWebhook(
    B.WebhooksCreateWebhookPayload.make({
      requestBody: {
        address: desired.address,
        target: { id: folderProviderId, type: "folder" },
        triggers: desired.triggers,
      },
    })
  );
  return appliedOutcome(action, yield* decodeCreatedIdentity(created));
});

const applyCreate = (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxCreateAction,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>,
  folderIdentities: MutableHashMap.MutableHashMap<Sha256Hex, BoxObservedFolder>
): Effect.Effect<BoxApplyOutcome, B.BoxError | BoxProvisioningInvariantError> =>
  Match.value(action.resourceKind).pipe(
    Match.when("folder", () => createFolder(box, desiredState, action, folderProviderIds, folderIdentities)),
    Match.when("collaboration", () =>
      createCollaboration(box, desiredState, action, folderProviderIds, folderIdentities)
    ),
    Match.when("webhook", () => createWebhook(box, desiredState, action, folderProviderIds, folderIdentities)),
    Match.orElse(() => Effect.fail(invariant("unsupported-action")))
  );

const updateCollaboration = Effect.fn("BoxProvisioningApplier.updateCollaboration")(function* (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxUpdateAction
) {
  const desired = yield* findDesired(desiredState.collaborations, action.logicalKeyDigest);
  const providerId = yield* requiredProviderId(action);
  yield* box.userCollaborations.updateCollaborationById(
    B.UserCollaborationsUpdateCollaborationByIdPayload.make({
      collaborationId: providerId,
      optionalsInput: { requestBody: { role: desired.role } },
    })
  );
  return appliedOutcome(action, providerId);
});

const updateWebhook = Effect.fn("BoxProvisioningApplier.updateWebhook")(function* (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxUpdateAction
) {
  const desired = yield* findDesired(desiredState.webhooks, action.logicalKeyDigest);
  const providerId = yield* requiredProviderId(action);
  yield* box.webhooks.updateWebhookById(
    B.WebhooksUpdateWebhookByIdPayload.make({
      webhookId: providerId,
      optionalsInput: { requestBody: { triggers: desired.triggers } },
    })
  );
  return appliedOutcome(action, providerId);
});

const applyUpdate = (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxUpdateAction
): Effect.Effect<BoxApplyOutcome, B.BoxError | BoxProvisioningInvariantError> =>
  Match.value(action.resourceKind).pipe(
    Match.when("collaboration", () => updateCollaboration(box, desiredState, action)),
    Match.when("webhook", () => updateWebhook(box, desiredState, action)),
    Match.orElse(() => Effect.fail(invariant("unsupported-action")))
  );

const applyNoop = Effect.fn("BoxProvisioningApplier.applyNoop")(function* (
  action: BoxNoopAction,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>
): Effect.fn.Return<BoxApplyOutcome, BoxProvisioningInvariantError> {
  if (action.resourceKind === "folder") {
    MutableHashMap.set(folderProviderIds, action.logicalKeyDigest, yield* requiredProviderId(action));
  }
  return BoxActionSkipped.make({
    actionKey: action.actionKey,
    logicalKeyDigest: action.logicalKeyDigest,
    reason: "noop",
    resourceKind: action.resourceKind,
  });
});

const applyBlocked = (action: BoxBlockedAction): BoxApplyOutcome =>
  BoxActionBlocked.make({
    actionKey: action.actionKey,
    logicalKeyDigest: action.logicalKeyDigest,
    reason: action.reason._tag,
    resourceKind: action.resourceKind,
  });

const hasUnsupportedDestructiveAction = (actions: ReadonlyArray<BoxPlanAction>): boolean =>
  A.some(actions, (action) => action.destructive || action._tag === "Delete" || action._tag === "Replace");

const isBlockedAction = (action: BoxPlanAction): action is BoxBlockedAction => P.isTagged(action, "Blocked");
const isEntitlementReason = (reason: BoxBlockedAction["reason"]) => P.isTagged(reason, "BlockedByEntitlement");

const blockerContractError = (
  phase: BoxProvisioningBlockerContractError["phase"],
  code: BoxProvisioningBlockerContractError["code"]
) => BoxProvisioningBlockerContractError.make({ code, phase });

const validateEntitlementFamily = Effect.fn("BoxProvisioningApplier.validateEntitlementFamily")(function* <
  Resource extends BoxMetadataIntent | BoxRetentionIntent,
>(
  desiredResources: ReadonlyArray<Resource>,
  resourceKind: "metadata" | "retention",
  planName: string,
  blockedActions: ReadonlyArray<BoxBlockedAction>,
  plan: BoxProvisioningPlan,
  phase: BoxProvisioningBlockerContractError["phase"]
) {
  yield* Effect.forEach(
    desiredResources,
    Effect.fnUntraced(function* (desired) {
      const logicalKeyDigest = digestText(desired.logicalKey);
      const matches = A.filter(
        blockedActions,
        (action) =>
          action.resourceKind === resourceKind &&
          Equal.equals(action.logicalKeyDigest, logicalKeyDigest) &&
          isEntitlementReason(action.reason) &&
          action.reason.entitlement === resourceKind &&
          action.reason.planName === planName
      );
      if (A.length(matches) !== 1) {
        return yield* blockerContractError(phase, "entitlement-blocker-mismatch");
      }
      const blockedAction = yield* Effect.fromOption(A.head(matches), () =>
        blockerContractError(phase, "entitlement-blocker-mismatch")
      );
      const folderLogicalKeyDigest = digestText(desired.folderKey);
      const folderAction = A.findFirst(
        plan.actions,
        (action) => action.resourceKind === "folder" && Equal.equals(action.logicalKeyDigest, folderLogicalKeyDigest)
      );
      if (O.isNone(folderAction) || !Equal.equals(blockedAction.dependencies, [folderAction.value.actionKey])) {
        return yield* blockerContractError(phase, "invalid-entitlement-dependency");
      }
    }),
    { concurrency: 1, discard: true }
  );
});

/**
 * Validates the exact entitlement-blocker set accepted by guarded apply.
 *
 * **Example** (Inspect the blocker validator)
 *
 * ```ts
 * import { validateBoxProvisioningBlockerContract } from "@beep/box-provisioning/BoxProvisioningApplier"
 *
 * console.log(validateBoxProvisioningBlockerContract)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateBoxProvisioningBlockerContract = Effect.fn("BoxProvisioningApplier.validateBlockerContract")(
  function* (
    desiredState: BoxDesiredState,
    plan: BoxProvisioningPlan,
    phase: BoxProvisioningBlockerContractError["phase"]
  ) {
    const blockedActions = A.filter(plan.actions, isBlockedAction);
    if (A.some(blockedActions, (action) => !isEntitlementReason(action.reason))) {
      return yield* blockerContractError(phase, "non-entitlement-blocker");
    }
    const expectedMetadata =
      desiredState.entitlements.metadata === "unavailable" ? desiredState.metadata : A.empty<BoxMetadataIntent>();
    const expectedRetention =
      desiredState.entitlements.retention === "unavailable" ? desiredState.retention : A.empty<BoxRetentionIntent>();
    if (A.length(blockedActions) !== A.length(expectedMetadata) + A.length(expectedRetention)) {
      return yield* blockerContractError(phase, "entitlement-blocker-mismatch");
    }
    yield* validateEntitlementFamily(
      expectedMetadata,
      "metadata",
      desiredState.entitlements.planName,
      blockedActions,
      plan,
      phase
    );
    yield* validateEntitlementFamily(
      expectedRetention,
      "retention",
      desiredState.entitlements.planName,
      blockedActions,
      plan,
      phase
    );
  }
);

/**
 * Proves a post-apply plan preserved entitlement blockers and otherwise converged to Noop.
 *
 * **Example** (Inspect the post-apply validator)
 *
 * ```ts
 * import { validateBoxProvisioningPostApplyPlan } from "@beep/box-provisioning/BoxProvisioningApplier"
 *
 * console.log(validateBoxProvisioningPostApplyPlan)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateBoxProvisioningPostApplyPlan = Effect.fn("BoxProvisioningApplier.validatePostApplyPlan")(
  function* (desiredState: BoxDesiredState, reviewedPlan: BoxProvisioningPlan, postApplyPlan: BoxProvisioningPlan) {
    yield* validateBoxProvisioningBlockerContract(desiredState, postApplyPlan, "post-apply");
    const reviewedBlockers = A.filter(reviewedPlan.actions, isBlockedAction);
    const postApplyBlockers = A.filter(postApplyPlan.actions, isBlockedAction);
    const blockersPreserved =
      A.length(reviewedBlockers) === A.length(postApplyBlockers) &&
      A.every(reviewedBlockers, (reviewed) =>
        A.some(
          postApplyBlockers,
          (postApply) =>
            Equal.equals(reviewed.logicalKeyDigest, postApply.logicalKeyDigest) &&
            reviewed.resourceKind === postApply.resourceKind &&
            Equal.equals(reviewed.reason, postApply.reason)
        )
      );
    if (!blockersPreserved) {
      return yield* blockerContractError("post-apply", "entitlement-blocker-mismatch");
    }
    if (A.some(postApplyPlan.actions, (action) => action._tag !== "Blocked" && action._tag !== "Noop")) {
      return yield* blockerContractError("post-apply", "post-apply-non-noop-action");
    }
    return BoxPostApplyVerdict.make({
      allOtherActionsNoop: true,
      entitlementBlockerCount: A.length(postApplyBlockers),
      entitlementBlockersPreserved: true,
    });
  }
);

/**
 * Runtime contract for append-only sanitized apply-journal persistence.
 *
 * @category services
 * @since 0.0.0
 */
export interface BoxProvisioningApplyJournalShape {
  readonly append: (entry: BoxApplyJournalEntry) => Effect.Effect<void, BoxProvisioningApplyJournalError>;
}

const noopApplyJournal: BoxProvisioningApplyJournalShape = {
  append: Effect.fn("BoxProvisioningApplyJournal.noopAppend")((_entry) => Effect.void),
};

/**
 * Sink for durable Started, Applied, and Failed evidence around each mutation.
 *
 * **Example** (Provide the no-op journal)
 *
 * ```ts
 * import { BoxProvisioningApplyJournal } from "@beep/box-provisioning/BoxProvisioningApplier"
 * import { Effect } from "effect"
 *
 * const program = BoxProvisioningApplyJournal.pipe(
 *   Effect.provide(BoxProvisioningApplyJournal.noopLayer)
 * )
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxProvisioningApplyJournal extends Context.Service<
  BoxProvisioningApplyJournal,
  BoxProvisioningApplyJournalShape
>()($I`BoxProvisioningApplyJournal`) {
  /**
   * Discards journal entries for callers that do not provide a durable sink.
   *
   * **Example** (Inspect the no-op layer)
   *
   * ```ts
   * import { BoxProvisioningApplyJournal } from "@beep/box-provisioning/BoxProvisioningApplier"
   *
   * console.log(BoxProvisioningApplyJournal.noopLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly noopLayer = Layer.succeed(BoxProvisioningApplyJournal, noopApplyJournal);
}

const makeService = (
  box: B.Box["Service"],
  journal: BoxProvisioningApplyJournal["Service"]
): BoxProvisioningApplierShape => ({
  apply: Effect.fn("BoxProvisioningApplier.apply")(function* (desiredState, plan, injectedAttemptId) {
    if (!hasValidBoxProvisioningPlanDigest(plan)) {
      return yield* invariant("invalid-plan-digest");
    }
    if (!sha256Equivalence(boxDesiredStateDigest(desiredState), plan.desiredStateDigest)) {
      return yield* invariant("desired-state-digest-mismatch");
    }
    if (hasUnsupportedDestructiveAction(plan.actions)) {
      return yield* invariant("unsupported-action");
    }
    yield* validateBoxProvisioningBlockerContract(desiredState, plan, "pre-apply");

    const attemptId = O.getOrElse(O.fromUndefinedOr(injectedAttemptId), () => BoxApplyAttemptId.make(randomUUID()));
    const completed = MutableHashSet.empty<Sha256Hex>();
    const folderProviderIds = MutableHashMap.empty<Sha256Hex, BoxProviderId>();
    const folderIdentities = MutableHashMap.empty<Sha256Hex, BoxObservedFolder>();
    let sequence = 0;
    const nextSequence = (): number => {
      const current = sequence;
      sequence += 1;
      return current;
    };
    const journalMutation = Effect.fn("BoxProvisioningApplier.journalMutation")(function* (
      action: BoxCreateAction | BoxUpdateAction,
      mutation: Effect.Effect<BoxApplyOutcome, B.BoxError | BoxProvisioningInvariantError>
    ) {
      yield* journal.append(
        BoxApplyJournalStarted.make({
          actionKey: action.actionKey,
          attemptId,
          logicalKeyDigest: action.logicalKeyDigest,
          planDigest: plan.planDigest,
          providerId: action.precondition.providerId,
          resourceKind: action.resourceKind,
          sequence: nextSequence(),
        })
      );
      return yield* mutation.pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            journal
              .append(
                BoxApplyJournalFailed.make({
                  actionKey: action.actionKey,
                  attemptId,
                  errorTag: error._tag,
                  logicalKeyDigest: action.logicalKeyDigest,
                  planDigest: plan.planDigest,
                  providerId: action.precondition.providerId,
                  resourceKind: action.resourceKind,
                  sequence: nextSequence(),
                })
              )
              .pipe(Effect.andThen(Effect.fail(error))),
          onSuccess: (outcome) => {
            const providerId = Match.value(outcome).pipe(
              Match.tag("Applied", (applied) => O.some(applied.providerId)),
              Match.orElse(() => action.precondition.providerId)
            );
            const parentProviderId =
              action.resourceKind === "folder"
                ? O.flatMap(
                    MutableHashMap.get(folderIdentities, action.logicalKeyDigest),
                    (folder) => folder.parentProviderId
                  )
                : O.none<BoxProviderId>();
            return journal
              .append(
                BoxApplyJournalApplied.make({
                  actionKey: action.actionKey,
                  attemptId,
                  logicalKeyDigest: action.logicalKeyDigest,
                  parentProviderId,
                  planDigest: plan.planDigest,
                  providerId,
                  resourceKind: action.resourceKind,
                  sequence: nextSequence(),
                })
              )
              .pipe(Effect.as(outcome));
          },
        })
      );
    });
    const applyAction = Match.type<BoxPlanAction>().pipe(
      Match.tagsExhaustive({
        Blocked: (action) => Effect.succeed(applyBlocked(action)),
        Create: (action) =>
          journalMutation(action, applyCreate(box, desiredState, action, folderProviderIds, folderIdentities)),
        Delete: () => Effect.fail(invariant("unsupported-action")),
        Noop: (action) => applyNoop(action, folderProviderIds),
        Replace: () => Effect.fail(invariant("unsupported-action")),
        Update: (action) => journalMutation(action, applyUpdate(box, desiredState, action)),
      })
    );
    const applyOne = Effect.fn("BoxProvisioningApplier.applyOne")(function* (action: BoxPlanAction) {
      if (A.some(action.dependencies, (dependency) => !MutableHashSet.has(completed, dependency))) {
        return yield* invariant("unresolved-dependency");
      }
      yield* validateActionDesiredBinding(desiredState, action);
      yield* validateActionShape(action);
      const validatedFolder = yield* Match.value(action).pipe(
        Match.tags({
          Noop: (candidate) => validateExistingPrecondition(box, candidate),
          Update: (candidate) => validateExistingPrecondition(box, candidate),
        }),
        Match.orElse(() => Effect.succeed(O.none<BoxObservedFolder>()))
      );
      const outcome = yield* applyAction(action);
      if (action.resourceKind === "folder") {
        O.match(validatedFolder, {
          onNone: () => undefined,
          onSome: (folder) => MutableHashMap.set(folderIdentities, action.logicalKeyDigest, folder),
        });
      }
      MutableHashSet.add(completed, action.actionKey);
      return outcome;
    });
    const outcomes = yield* Effect.forEach(plan.actions, applyOne, { concurrency: 1 });
    return BoxApplyReceipt.make({
      appliedAt: yield* DateTime.now,
      outcomes,
      planDigest: plan.planDigest,
    });
  }),
});

/**
 * Runtime contract for the explicitly invoked Box mutation boundary.
 *
 * @category services
 * @since 0.0.0
 */
export interface BoxProvisioningApplierShape {
  /** Apply a reviewed plan with an injected attempt id or a fresh UUID default. */
  readonly apply: (
    desiredState: BoxDesiredState,
    plan: BoxProvisioningPlan,
    attemptId?: BoxApplyAttemptId
  ) => Effect.Effect<
    BoxApplyReceipt,
    B.BoxError | BoxProvisioningInvariantError | BoxProvisioningBlockerContractError | BoxProvisioningApplyJournalError
  >;
}

/**
 * Applies one freshly revalidated, operator-reviewed Box provisioning plan.
 *
 * **Details**
 *
 * The service rejects every destructive action before the first provider call,
 * applies actions sequentially, and checks each dependency. Its public method is
 * deliberately named `apply`; the default orchestration entry point is dry-run.
 *
 * **Example** (Inspect the explicit apply service)
 *
 * ```ts
 * import { BoxProvisioningApplier } from "@beep/box-provisioning/BoxProvisioningApplier"
 *
 * console.log(BoxProvisioningApplier.apply)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxProvisioningApplier extends Context.Service<BoxProvisioningApplier, BoxProvisioningApplierShape>()(
  $I`BoxProvisioningApplier`
) {
  static readonly layerWithJournal = Layer.effect(
    BoxProvisioningApplier,
    Effect.all([B.Box, BoxProvisioningApplyJournal]).pipe(
      Effect.map(([box, journal]) => BoxProvisioningApplier.of(makeService(box, journal)))
    )
  );

  static readonly layer = BoxProvisioningApplier.layerWithJournal.pipe(
    Layer.provide(BoxProvisioningApplyJournal.noopLayer)
  );

  /**
   * Construct an applier layer from an injected Box service.
   *
   * **Example** (Inspect the test-layer constructor)
   *
   * ```ts
   * import { BoxProvisioningApplier } from "@beep/box-provisioning/BoxProvisioningApplier"
   *
   * console.log(BoxProvisioningApplier.makeLayerFromBox)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromBox = (box: B.Box["Service"]): Layer.Layer<BoxProvisioningApplier> =>
    Layer.succeed(BoxProvisioningApplier, BoxProvisioningApplier.of(makeService(box, noopApplyJournal)));

  /** Construct an applier layer with an explicit durable journal sink. */
  static readonly makeLayerFromBoxAndJournal = (
    box: B.Box["Service"],
    journal: BoxProvisioningApplyJournal["Service"]
  ): Layer.Layer<BoxProvisioningApplier> =>
    Layer.succeed(BoxProvisioningApplier, BoxProvisioningApplier.of(makeService(box, journal)));
}
