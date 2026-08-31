/**
 * Guarded Box mutation service for an exact reviewed provisioning plan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as B from "@beep/box";
import { $BoxProvisioningId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema";
import { Context, DateTime, Effect, Equal, Layer, Match, MutableHashMap, MutableHashSet, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxProvisioningInvariantError } from "./BoxProvisioningErrors.ts";
import {
  BoxCollaborationIntent,
  BoxFolderIntent,
  BoxMetadataIntent,
  BoxRetentionIntent,
  BoxWebhookIntent,
} from "./BoxProvisioningIntent.ts";
import {
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedWebhook,
  BoxProviderId,
} from "./BoxProvisioningObserved.ts";
import { BoxActionApplied, BoxActionBlocked, BoxActionSkipped, BoxApplyReceipt } from "./BoxProvisioningReceipt.ts";
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
import type { BoxDesiredState, BoxLogicalKey } from "./BoxProvisioningIntent.ts";
import type {
  BoxBlockedAction,
  BoxCreateAction,
  BoxNoopAction,
  BoxPlanAction,
  BoxProvisioningPlan,
  BoxUpdateAction,
} from "./BoxProvisioningPlan.ts";
import type { BoxApplyOutcome } from "./BoxProvisioningReceipt.ts";

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
    O.match({
      onNone: () => Effect.fail(invariant("unresolved-dependency")),
      onSome: Effect.succeed,
    })
  );

const requiredProviderId = (action: BoxPlanAction): Effect.Effect<BoxProviderId, BoxProvisioningInvariantError> =>
  O.match(action.precondition.providerId, {
    onNone: () => Effect.fail(invariant("missing-provider-id")),
    onSome: Effect.succeed,
  });

const resolveFolderProviderId = (
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>,
  logicalKey: BoxLogicalKey
): Effect.Effect<BoxProviderId, BoxProvisioningInvariantError> =>
  pipe(
    MutableHashMap.get(folderProviderIds, digestText(logicalKey)),
    O.match({
      onNone: () => Effect.fail(invariant("unresolved-dependency")),
      onSome: Effect.succeed,
    })
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
  const items = yield* listFolderItems({ box, folderId: parentProviderId });
  const names = yield* Effect.forEach(
    A.filter(items, S.is(B.FolderMini)),
    (item) =>
      O.match(O.fromNullishOr(item.name), {
        onNone: () => Effect.fail(invariant("unreadable-sdk-response")),
        onSome: Effect.succeed,
      }),
    { concurrency: 1 }
  );
  if (A.some(names, (name) => Equal.equals(name, desired.name))) {
    return yield* invariant("action-precondition-mismatch");
  }
});

const validateCollaborationAbsent = Effect.fn("BoxProvisioningApplier.validateCollaborationAbsent")(function* (
  box: B.Box["Service"],
  folderProviderId: BoxProviderId,
  desired: BoxCollaborationIntent
) {
  const collaborations = yield* listFolderCollaborations({ box, folderId: folderProviderId }).pipe(
    Effect.flatMap((entries) =>
      Effect.forEach(entries, (collaboration) => toObservedCollaboration({ collaboration, folderProviderId }), {
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

const validateExistingPrecondition = Effect.fn("BoxProvisioningApplier.validateExistingPrecondition")(function* (
  box: B.Box["Service"],
  action: BoxNoopAction | BoxUpdateAction
) {
  const providerId = yield* requiredProviderId(action);
  const actual = yield* Match.value(action.resourceKind).pipe(
    Match.when("folder", () =>
      box.folders.getFolderById(B.FoldersGetFolderByIdPayload.make({ folderId: providerId })).pipe(
        Effect.flatMap(toObservedFolderFromFull),
        Effect.map((folder) => ({ digest: encodedDigest(BoxObservedFolder, folder), etag: folder.etag }))
      )
    ),
    Match.when("collaboration", () =>
      box.userCollaborations
        .getCollaborationById(B.UserCollaborationsGetCollaborationByIdPayload.make({ collaborationId: providerId }))
        .pipe(
          Effect.flatMap(toObservedCollaborationFromFull),
          Effect.map((collaboration) => ({
            digest: encodedDigest(BoxObservedCollaboration, collaboration),
            etag: O.none<string>(),
          }))
        )
    ),
    Match.when("webhook", () =>
      box.webhooks.getWebhookById(B.WebhooksGetWebhookByIdPayload.make({ webhookId: providerId })).pipe(
        Effect.flatMap(toObservedWebhook),
        Effect.map((webhook) => ({ digest: encodedDigest(BoxObservedWebhook, webhook), etag: O.none<string>() }))
      )
    ),
    Match.orElse(() => Effect.fail(invariant("unsupported-action")))
  );
  if (!Equal.equals(action.precondition.etag, actual.etag)) {
    return yield* invariant("action-precondition-mismatch");
  }
  yield* validateBeforeDigest(action, actual.digest);
});

const createFolder = Effect.fn("BoxProvisioningApplier.createFolder")(function* (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxCreateAction,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>
) {
  const desired = yield* findDesired(desiredState.folders, action.logicalKeyDigest);
  const parentProviderId = yield* O.match(desired.parentKey, {
    onNone: () => Effect.succeed(BoxProviderId.make(desiredState.rootFolderId)),
    onSome: (parentKey) => resolveFolderProviderId(folderProviderIds, parentKey),
  });
  yield* validateFolderAbsent(box, parentProviderId, desired);
  const created = yield* box.folders.createFolder(
    B.FoldersCreateFolderPayload.make({
      requestBody: { name: desired.name, parent: { id: parentProviderId } },
    })
  );
  const providerId = BoxProviderId.make(created.id);
  MutableHashMap.set(folderProviderIds, action.logicalKeyDigest, providerId);
  return appliedOutcome(action, providerId);
});

const createCollaboration = Effect.fn("BoxProvisioningApplier.createCollaboration")(function* (
  box: B.Box["Service"],
  desiredState: BoxDesiredState,
  action: BoxCreateAction,
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>
) {
  const desired = yield* findDesired(desiredState.collaborations, action.logicalKeyDigest);
  const folderProviderId = yield* resolveFolderProviderId(folderProviderIds, desired.folderKey);
  yield* validateCollaborationAbsent(box, folderProviderId, desired);
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
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>
) {
  const desired = yield* findDesired(desiredState.webhooks, action.logicalKeyDigest);
  const folderProviderId = yield* resolveFolderProviderId(folderProviderIds, desired.folderKey);
  yield* validateWebhookAbsent(box, folderProviderId, desired);
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
  folderProviderIds: MutableHashMap.MutableHashMap<Sha256Hex, BoxProviderId>
): Effect.Effect<BoxApplyOutcome, B.BoxError | BoxProvisioningInvariantError> =>
  Match.value(action.resourceKind).pipe(
    Match.when("folder", () => createFolder(box, desiredState, action, folderProviderIds)),
    Match.when("collaboration", () => createCollaboration(box, desiredState, action, folderProviderIds)),
    Match.when("webhook", () => createWebhook(box, desiredState, action, folderProviderIds)),
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

const makeService = (box: B.Box["Service"]): BoxProvisioningApplierShape => ({
  apply: Effect.fn("BoxProvisioningApplier.apply")(function* (desiredState, plan) {
    if (!hasValidBoxProvisioningPlanDigest(plan)) {
      return yield* invariant("invalid-plan-digest");
    }
    if (!sha256Equivalence(boxDesiredStateDigest(desiredState), plan.desiredStateDigest)) {
      return yield* invariant("desired-state-digest-mismatch");
    }
    if (hasUnsupportedDestructiveAction(plan.actions)) {
      return yield* invariant("unsupported-action");
    }

    const completed = MutableHashSet.empty<Sha256Hex>();
    const folderProviderIds = MutableHashMap.empty<Sha256Hex, BoxProviderId>();
    const applyAction = Match.type<BoxPlanAction>().pipe(
      Match.tagsExhaustive({
        Blocked: (action) => Effect.succeed(applyBlocked(action)),
        Create: (action) => applyCreate(box, desiredState, action, folderProviderIds),
        Delete: () => Effect.fail(invariant("unsupported-action")),
        Noop: (action) => applyNoop(action, folderProviderIds),
        Replace: () => Effect.fail(invariant("unsupported-action")),
        Update: (action) => applyUpdate(box, desiredState, action),
      })
    );
    const applyOne = Effect.fn("BoxProvisioningApplier.applyOne")(function* (action: BoxPlanAction) {
      if (A.some(action.dependencies, (dependency) => !MutableHashSet.has(completed, dependency))) {
        return yield* invariant("unresolved-dependency");
      }
      yield* validateActionDesiredBinding(desiredState, action);
      yield* validateActionShape(action);
      yield* Match.value(action).pipe(
        Match.tags({
          Noop: (candidate) => validateExistingPrecondition(box, candidate),
          Update: (candidate) => validateExistingPrecondition(box, candidate),
        }),
        Match.orElse(() => Effect.void)
      );
      const outcome = yield* applyAction(action);
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
  readonly apply: (
    desiredState: BoxDesiredState,
    plan: BoxProvisioningPlan
  ) => Effect.Effect<BoxApplyReceipt, B.BoxError | BoxProvisioningInvariantError>;
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
  static readonly layer = Layer.effect(
    BoxProvisioningApplier,
    B.Box.pipe(Effect.map((box) => BoxProvisioningApplier.of(makeService(box))))
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
    Layer.succeed(BoxProvisioningApplier, BoxProvisioningApplier.of(makeService(box)));
}
