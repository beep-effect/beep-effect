/**
 * Pure deterministic planner for Box desired and observed state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { Context, Effect, Equal, Layer, Match, MutableHashMap, MutableHashSet, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import {
  BoxProvisioningSchemaError,
  BoxProvisioningSubjectMismatchError,
  BoxProvisioningTenantMismatchError,
} from "./BoxProvisioningErrors.ts";
import {
  BoxCollaborationIntent,
  BoxDesiredState,
  BoxFolderIntent,
  BoxMetadataIntent,
  BoxRetentionIntent,
  BoxWebhookIntent,
  boxFolderNamesEquivalent,
} from "./BoxProvisioningIntent.ts";
import {
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedState,
  BoxObservedWebhook,
  BoxProviderId,
} from "./BoxProvisioningObserved.ts";
import {
  BoxActionPrecondition,
  BoxBlockedAction,
  BoxBlockedByAmbiguity,
  BoxBlockedByEntitlement,
  BoxBlockedByPolicy,
  BoxCreateAction,
  BoxForeignResource,
  BoxNoopAction,
  BoxProvisioningPlan,
  BoxUpdateAction,
} from "./BoxProvisioningPlan.ts";
import {
  canonicalBoxDesiredState,
  canonicalBoxObservedState,
  canonicalObservedWebhook,
  canonicalWebhookIntent,
  digestText,
  encodedDigest,
  sealBoxProvisioningPlan,
} from "./internal/canonical.ts";
import type * as PlatformError from "effect/PlatformError";
import type * as S from "effect/Schema";
import type { BoxAdoption, BoxEntitlementAvailability, BoxLogicalKey, BoxPlanName } from "./BoxProvisioningIntent.ts";
import type { BoxDiscovery, BoxProviderRevision } from "./BoxProvisioningObserved.ts";
import type { BoxPlanAction, BoxResourceKind } from "./BoxProvisioningPlan.ts";
import type { BoxCanonicalDigestError } from "./internal/canonical.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningPlanner");

type FolderResolution = {
  readonly actionKey: Sha256Hex;
  readonly blocked: boolean;
  readonly providerId: O.Option<BoxProviderId>;
};

type ActionBaseInput = {
  readonly actionTag: "Noop" | "Create" | "Update" | "Replace" | "Delete" | "Blocked";
  readonly afterDigest: O.Option<Sha256Hex>;
  readonly beforeDigest: O.Option<Sha256Hex>;
  readonly dependencies: ReadonlyArray<Sha256Hex>;
  readonly destructive: boolean;
  readonly etag: O.Option<BoxProviderRevision>;
  readonly logicalKey: BoxLogicalKey;
  readonly providerId: O.Option<BoxProviderId>;
  readonly resourceKind: BoxResourceKind;
  readonly state: "absent" | "present" | "unchanged";
};

type DependentActionInput = {
  readonly afterDigest: O.Option<Sha256Hex>;
  readonly folder: FolderResolution;
  readonly logicalKey: BoxLogicalKey;
  readonly matchKind: BoxBlockedByAmbiguity["matchKind"];
  readonly resourceKind: "collaboration" | "webhook";
};

const actionKey = Effect.fnUntraced(function* (
  actionTag: ActionBaseInput["actionTag"],
  resourceKind: BoxResourceKind,
  logicalKeyDigest: Sha256Hex
) {
  return yield* digestText(`${actionTag}:${resourceKind}:${logicalKeyDigest}`);
});

const actionBase = Effect.fnUntraced(function* (input: ActionBaseInput) {
  const logicalKeyDigest = yield* digestText(input.logicalKey);
  return {
    actionKey: yield* actionKey(input.actionTag, input.resourceKind, logicalKeyDigest),
    logicalKeyDigest,
    resourceKind: input.resourceKind,
    dependencies: input.dependencies,
    destructive: input.destructive,
    beforeDigest: input.beforeDigest,
    afterDigest: input.afterDigest,
    precondition: BoxActionPrecondition.make({
      state: input.state,
      providerId: input.providerId,
      etag: input.etag,
    }),
  };
});

const unresolvedFolder = Effect.fnUntraced(function* (parentKey: string) {
  return {
    actionKey: yield* digestText(`unresolved:${parentKey}`),
    blocked: true,
    providerId: O.none<BoxProviderId>(),
  } satisfies FolderResolution;
});

const rootFolder = Effect.fnUntraced(function* (rootFolderId: BoxProviderId) {
  return {
    actionKey: yield* digestText("root-anchor"),
    blocked: false,
    providerId: O.some(rootFolderId),
  } satisfies FolderResolution;
});

type PlanDigestError =
  | BoxProvisioningTenantMismatchError
  | BoxProvisioningSubjectMismatchError
  | BoxProvisioningSchemaError
  | PlatformError.PlatformError;

const mapPlanFailure = (error: PlanDigestError | BoxCanonicalDigestError): PlanDigestError =>
  P.isTagged("BoxProvisioningTenantMismatchError")(error) ||
  P.isTagged("BoxProvisioningSubjectMismatchError")(error) ||
  P.isTagged("PlatformError")(error) ||
  P.isTagged("BoxProvisioningSchemaError")(error)
    ? error
    : BoxProvisioningSchemaError.make({ stage: "plan" });

const folderDepth = (folders: ReadonlyArray<BoxFolderIntent>, folder: BoxFolderIntent): number => {
  let depth = 0;
  let parent = folder.parentKey;
  while (O.isSome(parent)) {
    depth += 1;
    const parentKey = parent.value;
    parent = pipe(
      A.findFirst(folders, (candidate) => Equal.equals(candidate.logicalKey, parentKey)),
      O.flatMap((candidate) => candidate.parentKey)
    );
  }
  return depth;
};

const sameTriggers = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  Equal.equals(A.sort(left, Order.String), A.sort(right, Order.String));

const dependentAction = Effect.fnUntraced(function* <Candidate>(
  input: DependentActionInput,
  candidates: ReadonlyArray<Candidate>,
  onSingle: (candidate: Candidate) => Effect.Effect<BoxPlanAction, BoxCanonicalDigestError, Crypto.Crypto>
) {
  const dependencies = [input.folder.actionKey];
  if (input.folder.blocked) {
    return BoxBlockedAction.make({
      ...(yield* actionBase({
        actionTag: "Blocked",
        afterDigest: input.afterDigest,
        beforeDigest: O.none(),
        dependencies,
        destructive: false,
        etag: O.none(),
        logicalKey: input.logicalKey,
        providerId: O.none(),
        resourceKind: input.resourceKind,
        state: "absent",
      })),
      reason: BoxBlockedByPolicy.make({ policy: "blocked-folder-dependency" }),
    });
  }
  return yield* A.match(candidates, {
    onEmpty: () =>
      Effect.map(
        actionBase({
          actionTag: "Create",
          afterDigest: input.afterDigest,
          beforeDigest: O.none(),
          dependencies,
          destructive: false,
          etag: O.none(),
          logicalKey: input.logicalKey,
          providerId: O.none(),
          resourceKind: input.resourceKind,
          state: "absent",
        }),
        BoxCreateAction.make
      ),
    onNonEmpty: (matches) =>
      A.match(A.drop(matches, 1), {
        onEmpty: () => onSingle(matches[0]),
        onNonEmpty: Effect.fnUntraced(function* () {
          return BoxBlockedAction.make({
            ...(yield* actionBase({
              actionTag: "Blocked",
              afterDigest: input.afterDigest,
              beforeDigest: O.none(),
              dependencies,
              destructive: false,
              etag: O.none(),
              logicalKey: input.logicalKey,
              providerId: O.none(),
              resourceKind: input.resourceKind,
              state: "present",
            })),
            reason: BoxBlockedByAmbiguity.make({
              candidateCount: A.length(matches),
              matchKind: input.matchKind,
            }),
          });
        }),
      }),
  });
});

const folderAction = Effect.fnUntraced(function* (
  desired: BoxFolderIntent,
  candidates: ReadonlyArray<BoxObservedFolder>,
  adoptions: ReadonlyArray<BoxAdoption>,
  dependencies: ReadonlyArray<Sha256Hex>
) {
  const afterDigest = O.some(yield* encodedDigest(BoxFolderIntent, desired));
  return yield* A.match(candidates, {
    onEmpty: () =>
      Effect.map(
        actionBase({
          actionTag: "Create",
          afterDigest,
          beforeDigest: O.none(),
          dependencies,
          destructive: false,
          etag: O.none(),
          logicalKey: desired.logicalKey,
          providerId: O.none(),
          resourceKind: "folder",
          state: "absent",
        }),
        BoxCreateAction.make
      ),
    onNonEmpty: (matches) =>
      A.match(A.drop(matches, 1), {
        onEmpty: Effect.fnUntraced(function* () {
          const observed = matches[0];
          const authorizations = A.filter(
            adoptions,
            (adoption) =>
              Equal.equals(adoption.logicalKey, desired.logicalKey) &&
              Equal.equals(adoption.expectedProviderId, observed.providerId) &&
              O.contains(observed.parentProviderId, adoption.expectedParentProviderId)
          );
          if (A.length(authorizations) !== 1) {
            return BoxBlockedAction.make({
              ...(yield* actionBase({
                actionTag: "Blocked",
                afterDigest,
                beforeDigest: O.none(),
                dependencies,
                destructive: false,
                etag: O.none(),
                logicalKey: desired.logicalKey,
                providerId: O.none(),
                resourceKind: "folder",
                state: "present",
              })),
              reason: BoxBlockedByPolicy.make({ policy: "foreign-name-collision" }),
            });
          }
          return BoxNoopAction.make(
            yield* actionBase({
              actionTag: "Noop",
              afterDigest,
              beforeDigest: O.some(yield* encodedDigest(BoxObservedFolder, observed)),
              dependencies,
              destructive: false,
              etag: observed.etag,
              logicalKey: desired.logicalKey,
              providerId: O.some(observed.providerId),
              resourceKind: "folder",
              state: "unchanged",
            })
          );
        }),
        onNonEmpty: Effect.fnUntraced(function* () {
          return BoxBlockedAction.make({
            ...(yield* actionBase({
              actionTag: "Blocked",
              afterDigest,
              beforeDigest: O.none(),
              dependencies,
              destructive: false,
              etag: O.none(),
              logicalKey: desired.logicalKey,
              providerId: O.none(),
              resourceKind: "folder",
              state: "present",
            })),
            reason: BoxBlockedByAmbiguity.make({
              candidateCount: A.length(matches),
              matchKind: "provider-equivalent-name-sibling",
            }),
          });
        }),
      }),
  });
});

const collaborationAction = Effect.fnUntraced(function* (
  desired: BoxCollaborationIntent,
  folder: FolderResolution,
  observed: ReadonlyArray<BoxObservedCollaboration>
) {
  const afterDigest = O.some(yield* encodedDigest(BoxCollaborationIntent, desired));
  const candidates = O.match(folder.providerId, {
    onNone: A.empty<BoxObservedCollaboration>,
    onSome: (folderProviderId) =>
      A.filter(
        observed,
        (candidate) =>
          Equal.equals(candidate.folderProviderId, folderProviderId) &&
          (Equal.equals(candidate.principal, desired.principal) ||
            O.contains(candidate.principalProviderId, BoxProviderId.make(desired.principal))) &&
          Equal.equals(candidate.principalType, desired.principalType)
      ),
  });
  return yield* dependentAction(
    {
      afterDigest,
      folder,
      logicalKey: desired.logicalKey,
      matchKind: "folder-principal",
      resourceKind: "collaboration",
    },
    candidates,
    Effect.fnUntraced(function* (candidate) {
      const unchanged = Equal.equals(candidate.role, desired.role);
      const base = yield* actionBase({
        actionTag: unchanged ? "Noop" : "Update",
        afterDigest,
        beforeDigest: O.some(yield* encodedDigest(BoxObservedCollaboration, candidate)),
        dependencies: [folder.actionKey],
        destructive: false,
        etag: O.none(),
        logicalKey: desired.logicalKey,
        providerId: O.some(candidate.providerId),
        resourceKind: "collaboration",
        state: unchanged ? "unchanged" : "present",
      });
      return unchanged ? BoxNoopAction.make(base) : BoxUpdateAction.make(base);
    })
  );
});

const webhookAction = Effect.fnUntraced(function* (
  desired: BoxWebhookIntent,
  folder: FolderResolution,
  observed: ReadonlyArray<BoxObservedWebhook>
) {
  const canonicalDesired = canonicalWebhookIntent(desired);
  const afterDigest = O.some(yield* encodedDigest(BoxWebhookIntent, canonicalDesired));
  const candidates = O.match(folder.providerId, {
    onNone: A.empty<BoxObservedWebhook>,
    onSome: (folderProviderId) =>
      A.filter(
        observed,
        (candidate) =>
          Equal.equals(candidate.targetProviderId, folderProviderId) && Equal.equals(candidate.address, desired.address)
      ),
  });
  return yield* dependentAction(
    {
      afterDigest,
      folder,
      logicalKey: desired.logicalKey,
      matchKind: "target-callback",
      resourceKind: "webhook",
    },
    candidates,
    Effect.fnUntraced(function* (candidate) {
      const canonicalCandidate = canonicalObservedWebhook(candidate);
      const unchanged = sameTriggers(canonicalCandidate.triggers, canonicalDesired.triggers);
      const base = yield* actionBase({
        actionTag: unchanged ? "Noop" : "Update",
        afterDigest,
        beforeDigest: O.some(yield* encodedDigest(BoxObservedWebhook, canonicalCandidate)),
        dependencies: [folder.actionKey],
        destructive: false,
        etag: O.none(),
        logicalKey: desired.logicalKey,
        providerId: O.some(candidate.providerId),
        resourceKind: "webhook",
        state: unchanged ? "unchanged" : "present",
      });
      return unchanged ? BoxNoopAction.make(base) : BoxUpdateAction.make(base);
    })
  );
});

const blockedCapabilityAction = Effect.fnUntraced(function* <A extends BoxMetadataIntent | BoxRetentionIntent, I>(
  desired: A,
  schema: S.Codec<A, I>,
  resourceKind: "metadata" | "retention",
  planName: BoxPlanName,
  assertedAvailability: BoxEntitlementAvailability,
  discovery: BoxDiscovery,
  folder: FolderResolution
) {
  const reason = folder.blocked
    ? BoxBlockedByPolicy.make({ policy: "blocked-folder-dependency" })
    : Match.value(discovery).pipe(
        Match.tag("Available", (available) =>
          assertedAvailability === "unavailable"
            ? available.count > 0
              ? BoxBlockedByPolicy.make({
                  policy: `${resourceKind}-entitlement-assertion-conflicts-with-live-discovery`,
                })
              : BoxBlockedByEntitlement.make({ entitlement: resourceKind, planName })
            : BoxBlockedByPolicy.make({ policy: `${resourceKind}-mutation-out-of-scope-v1` })
        ),
        Match.tag("BlockedByEntitlement", () =>
          assertedAvailability === "unavailable"
            ? BoxBlockedByEntitlement.make({ entitlement: resourceKind, planName })
            : BoxBlockedByPolicy.make({
                policy: `${resourceKind}-entitlement-assertion-conflicts-with-live-discovery`,
              })
        ),
        Match.tag("BlockedByPermission", () =>
          assertedAvailability === "unavailable"
            ? BoxBlockedByEntitlement.make({ entitlement: resourceKind, planName })
            : BoxBlockedByPolicy.make({ policy: `${resourceKind}-discovery-permission-denied` })
        ),
        Match.exhaustive
      );
  return BoxBlockedAction.make({
    ...(yield* actionBase({
      actionTag: "Blocked",
      afterDigest: O.some(yield* encodedDigest(schema, desired)),
      beforeDigest: O.none(),
      dependencies: [folder.actionKey],
      destructive: false,
      etag: O.none(),
      logicalKey: desired.logicalKey,
      providerId: O.none(),
      resourceKind,
      state: "absent",
    })),
    reason,
  });
});

const planBoxProvisioningRaw = Effect.fn("BoxProvisioningPlanner.plan")(function* (
  desired: BoxDesiredState,
  observed: BoxObservedState,
  additionalAdoptions: ReadonlyArray<BoxAdoption> = A.empty()
) {
  const expectedEnterpriseId = desired.expectedEnterpriseId;
  if (!Equal.equals(expectedEnterpriseId, observed.enterpriseId)) {
    return yield* BoxProvisioningTenantMismatchError.make({
      expectedEnterpriseId,
      actualEnterpriseId: observed.enterpriseId,
    });
  }
  const expectedSubjectId = desired.expectedSubjectId;
  if (!Equal.equals(expectedSubjectId, observed.subjectId)) {
    return yield* BoxProvisioningSubjectMismatchError.make({
      expectedSubjectId,
      actualSubjectId: observed.subjectId,
    });
  }

  const canonicalDesired = canonicalBoxDesiredState(desired);
  const canonicalObserved = canonicalBoxObservedState(observed);
  const folderOrder = Order.combine(
    Order.mapInput(Order.Number, (folder: BoxFolderIntent) => folderDepth(canonicalDesired.folders, folder)),
    Order.mapInput(Order.String, (folder: BoxFolderIntent) => folder.logicalKey)
  );
  const orderedFolders = A.sort(canonicalDesired.folders, folderOrder);
  const resolutions = MutableHashMap.empty<BoxLogicalKey, FolderResolution>();
  const matchedFolderIds = MutableHashSet.empty<BoxProviderId>();
  const matchedCollaborationIds = MutableHashSet.empty<BoxProviderId>();
  const matchedWebhookIds = MutableHashSet.empty<BoxProviderId>();
  const resolveFolder = (key: BoxLogicalKey) =>
    O.match(MutableHashMap.get(resolutions, key), {
      onNone: () => unresolvedFolder(key),
      onSome: Effect.succeed,
    });
  const folderActions = yield* Effect.forEach(
    orderedFolders,
    Effect.fnUntraced(function* (folder) {
      const parent = yield* O.match(folder.parentKey, {
        onNone: () => rootFolder(canonicalObserved.rootFolderId),
        onSome: resolveFolder,
      });
      const candidates = O.match(parent.providerId, {
        onNone: A.empty<BoxObservedFolder>,
        onSome: (parentProviderId) =>
          A.filter(
            canonicalObserved.folders,
            (candidate) =>
              O.contains(candidate.parentProviderId, parentProviderId) &&
              boxFolderNamesEquivalent(candidate.name, folder.name)
          ),
      });
      const dependencies = O.isSome(folder.parentKey) ? [parent.actionKey] : [];
      const action = parent.blocked
        ? BoxBlockedAction.make({
            ...(yield* actionBase({
              actionTag: "Blocked",
              afterDigest: O.some(yield* encodedDigest(BoxFolderIntent, folder)),
              beforeDigest: O.none(),
              dependencies,
              destructive: false,
              etag: O.none(),
              logicalKey: folder.logicalKey,
              providerId: O.none(),
              resourceKind: "folder",
              state: "absent",
            })),
            reason: BoxBlockedByPolicy.make({ policy: "blocked-folder-dependency" }),
          })
        : yield* folderAction(
            folder,
            candidates,
            A.appendAll(canonicalDesired.adoptions.entries, additionalAdoptions),
            dependencies
          );
      const providerId = action._tag === "Noop" ? action.precondition.providerId : O.none<BoxProviderId>();
      O.match(providerId, {
        onNone: () => undefined,
        onSome: (id) => MutableHashSet.add(matchedFolderIds, id),
      });
      MutableHashMap.set(resolutions, folder.logicalKey, {
        actionKey: action.actionKey,
        blocked: action._tag === "Blocked" || parent.blocked,
        providerId,
      });
      return action;
    }),
    { concurrency: 1 }
  );

  const collaborationActions = yield* Effect.forEach(
    canonicalDesired.collaborations,
    Effect.fnUntraced(function* (collaboration) {
      const action = yield* collaborationAction(
        collaboration,
        yield* resolveFolder(collaboration.folderKey),
        canonicalObserved.collaborations
      );
      if (action._tag === "Noop" || action._tag === "Update") {
        O.match(action.precondition.providerId, {
          onNone: () => undefined,
          onSome: (providerId) => MutableHashSet.add(matchedCollaborationIds, providerId),
        });
      }
      return action;
    }),
    { concurrency: 1 }
  );
  const webhookActions = yield* Effect.forEach(
    canonicalDesired.webhooks,
    Effect.fnUntraced(function* (webhook) {
      const action = yield* webhookAction(webhook, yield* resolveFolder(webhook.folderKey), canonicalObserved.webhooks);
      if (action._tag === "Noop" || action._tag === "Update") {
        O.match(action.precondition.providerId, {
          onNone: () => undefined,
          onSome: (providerId) => MutableHashSet.add(matchedWebhookIds, providerId),
        });
      }
      return action;
    }),
    { concurrency: 1 }
  );
  const metadataActions = yield* Effect.forEach(
    canonicalDesired.metadata,
    Effect.fnUntraced(function* (metadata) {
      return yield* blockedCapabilityAction(
        metadata,
        BoxMetadataIntent,
        "metadata",
        canonicalDesired.entitlements.planName,
        canonicalDesired.entitlements.metadata,
        canonicalObserved.metadata,
        yield* resolveFolder(metadata.folderKey)
      );
    }),
    { concurrency: 1 }
  );
  const retentionActions = yield* Effect.forEach(
    canonicalDesired.retention,
    Effect.fnUntraced(function* (retention) {
      return yield* blockedCapabilityAction(
        retention,
        BoxRetentionIntent,
        "retention",
        canonicalDesired.entitlements.planName,
        canonicalDesired.entitlements.retention,
        canonicalObserved.retention,
        yield* resolveFolder(retention.folderKey)
      );
    }),
    { concurrency: 1 }
  );
  const actions = A.appendAll(
    A.appendAll(A.appendAll(folderActions, collaborationActions), webhookActions),
    A.appendAll(metadataActions, retentionActions)
  );
  const foreignFolders = yield* Effect.forEach(
    A.filter(canonicalObserved.folders, (folder) => !MutableHashSet.has(matchedFolderIds, folder.providerId)),
    Effect.fnUntraced(function* (folder) {
      return BoxForeignResource.make({
        resourceKind: "folder",
        providerId: folder.providerId,
        identityDigest: yield* encodedDigest(BoxObservedFolder, folder),
      });
    }),
    { concurrency: 1 }
  );
  const foreignCollaborations = yield* Effect.forEach(
    A.filter(
      canonicalObserved.collaborations,
      (collaboration) => !MutableHashSet.has(matchedCollaborationIds, collaboration.providerId)
    ),
    Effect.fnUntraced(function* (collaboration) {
      return BoxForeignResource.make({
        resourceKind: "collaboration",
        providerId: collaboration.providerId,
        identityDigest: yield* encodedDigest(BoxObservedCollaboration, collaboration),
      });
    }),
    { concurrency: 1 }
  );
  const foreignWebhooks = yield* Effect.forEach(
    A.filter(canonicalObserved.webhooks, (webhook) => !MutableHashSet.has(matchedWebhookIds, webhook.providerId)),
    Effect.fnUntraced(function* (webhook) {
      return BoxForeignResource.make({
        resourceKind: "webhook",
        providerId: webhook.providerId,
        identityDigest: yield* encodedDigest(BoxObservedWebhook, webhook),
      });
    }),
    { concurrency: 1 }
  );
  const externalCreateFlags = yield* Effect.forEach(
    A.filter(collaborationActions, (action) => action._tag === "Create"),
    Effect.fnUntraced(function* (action) {
      const digests = yield* Effect.forEach(
        A.filter(canonicalDesired.collaborations, (collaboration) => collaboration.billingImpact === "external"),
        (collaboration) => digestText(collaboration.logicalKey),
        { concurrency: 1 }
      );
      return A.some(digests, (digest) => Equal.equals(action.logicalKeyDigest, digest));
    }),
    { concurrency: 1 }
  );
  const draft = BoxProvisioningPlan.make({
    sourceRevision: canonicalDesired.sourceRevision,
    expectedEnterpriseId,
    subjectId: canonicalObserved.subjectId,
    rootFolderId: canonicalObserved.rootFolderId,
    desiredStateDigest: yield* encodedDigest(BoxDesiredState, canonicalDesired),
    liveStateDigest: yield* encodedDigest(BoxObservedState, canonicalObserved),
    planDigest: Sha256Hex.make("0".repeat(64)),
    actions,
    foreignResources: A.flatten([foreignFolders, foreignCollaborations, foreignWebhooks]),
    blockerCount: A.length(A.filter(actions, (action) => action._tag === "Blocked")),
    destructiveCount: A.length(A.filter(actions, (action) => action.destructive)),
    declaredExternalCollaboratorCount: A.length(
      A.filter(canonicalDesired.collaborations, (collaboration) => collaboration.billingImpact === "external")
    ),
    declaredExternalCollaboratorCreateCount: A.length(A.filter(externalCreateFlags, (created) => created)),
  });
  return yield* sealBoxProvisioningPlan(draft);
});

/**
 * Produce a deterministic redacted plan from decoded desired and observed Box state.
 *
 * **Details**
 *
 * Exact-name sibling duplicates and duplicate natural keys become typed blocked
 * actions. Missing resources become creates, differing owned grants/hooks become
 * updates, and metadata/retention remain visibly blocked by entitlement or v1
 * mutation policy. The function performs no provider reads or writes.
 *
 * **Example** (Compose a pure planning effect)
 *
 * ```ts
 * import { planBoxProvisioning } from "@beep/box-provisioning/BoxProvisioningPlanner"
 *
 * console.log(planBoxProvisioning)
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const planBoxProvisioning = Effect.fn("BoxProvisioningPlanner.plan")(function* (
  desired: BoxDesiredState,
  observed: BoxObservedState,
  additionalAdoptions?: ReadonlyArray<BoxAdoption>
) {
  return yield* planBoxProvisioningRaw(desired, observed, additionalAdoptions).pipe(Effect.mapError(mapPlanFailure));
});

/**
 * Service shape for deterministic Box provisioning planning.
 *
 * @category services
 * @since 0.0.0
 */
export interface BoxProvisioningPlannerShape {
  readonly plan: (
    desired: BoxDesiredState,
    observed: BoxObservedState
  ) => Effect.Effect<BoxProvisioningPlan, PlanDigestError>;
  /** Plan with trusted in-memory ownership evidence returned by the same guarded apply. */
  readonly planWithAdoptions: (
    desired: BoxDesiredState,
    observed: BoxObservedState,
    additionalAdoptions: ReadonlyArray<BoxAdoption>
  ) => Effect.Effect<BoxProvisioningPlan, PlanDigestError>;
}

/**
 * Injectable pure planning service used by Box provisioning orchestration.
 *
 * **Example** (Acquire the planner service)
 *
 * ```ts
 * import { BoxProvisioningPlanner } from "@beep/box-provisioning/BoxProvisioningPlanner"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const planner = yield* BoxProvisioningPlanner
 *   return planner.plan
 * }).pipe(Effect.provide(BoxProvisioningPlanner.layer))
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxProvisioningPlanner extends Context.Service<BoxProvisioningPlanner, BoxProvisioningPlannerShape>()(
  $I`BoxProvisioningPlanner`
) {
  static readonly layer = Layer.unwrap(
    Effect.map(Crypto.Crypto, (crypto) =>
      Layer.succeed(
        BoxProvisioningPlanner,
        BoxProvisioningPlanner.of({
          plan: Effect.fn("BoxProvisioningPlanner.plan")(
            function* (desired: BoxDesiredState, observed: BoxObservedState) {
              return yield* planBoxProvisioning(desired, observed);
            },
            (effect) => effect.pipe(Effect.provideService(Crypto.Crypto, crypto))
          ),
          planWithAdoptions: Effect.fn("BoxProvisioningPlanner.planWithAdoptions")(
            function* (desired: BoxDesiredState, observed: BoxObservedState, adoptions: ReadonlyArray<BoxAdoption>) {
              return yield* planBoxProvisioning(desired, observed, adoptions);
            },
            (effect) => effect.pipe(Effect.provideService(Crypto.Crypto, crypto))
          ),
        })
      )
    )
  ).pipe(Layer.provide(NodeCrypto.layer));
}
