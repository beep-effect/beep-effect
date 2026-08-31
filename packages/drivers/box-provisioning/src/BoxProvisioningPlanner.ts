/**
 * Pure deterministic planner for Box desired and observed state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema";
import { Context, Effect, Equal, Layer, MutableHashMap, MutableHashSet, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxProvisioningSubjectMismatchError, BoxProvisioningTenantMismatchError } from "./BoxProvisioningErrors.ts";
import {
  BoxCollaborationIntent,
  BoxDesiredState,
  BoxFolderIntent,
  BoxMetadataIntent,
  BoxRetentionIntent,
  BoxWebhookIntent,
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
import { digestEncoded, digestText } from "./internal/canonical.ts";
import type { BoxLogicalKey } from "./BoxProvisioningIntent.ts";
import type { BoxPlanAction, BoxResourceKind } from "./BoxProvisioningPlan.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningPlanner");
const zeroDigest = Sha256Hex.make("0".repeat(64));

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
  readonly etag: O.Option<string>;
  readonly logicalKey: BoxLogicalKey;
  readonly providerId: O.Option<BoxProviderId>;
  readonly resourceKind: BoxResourceKind;
  readonly state: "absent" | "present" | "unchanged";
};

type DependentActionInput = {
  readonly afterDigest: O.Option<Sha256Hex>;
  readonly folder: FolderResolution;
  readonly logicalKey: BoxLogicalKey;
  readonly matchKind: string;
  readonly resourceKind: "collaboration" | "webhook";
};

const actionKey = (
  actionTag: ActionBaseInput["actionTag"],
  resourceKind: BoxResourceKind,
  logicalKeyDigest: Sha256Hex
): Sha256Hex => digestText(`${actionTag}:${resourceKind}:${logicalKeyDigest}`);

const actionBase = (input: ActionBaseInput) => {
  const logicalKeyDigest = digestText(input.logicalKey);
  return {
    actionKey: actionKey(input.actionTag, input.resourceKind, logicalKeyDigest),
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
};

const encodedDigest = <A, I>(schema: S.Codec<A, I>, value: A): Sha256Hex => digestEncoded(S.encodeSync(schema)(value));

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

const dependentAction = <Candidate>(
  input: DependentActionInput,
  candidates: ReadonlyArray<Candidate>,
  onSingle: (candidate: Candidate) => BoxPlanAction
): BoxPlanAction => {
  const dependencies = [input.folder.actionKey];
  if (input.folder.blocked) {
    return BoxBlockedAction.make({
      ...actionBase({
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
      }),
      reason: BoxBlockedByPolicy.make({ policy: "blocked-folder-dependency" }),
    });
  }
  return A.match(candidates, {
    onEmpty: () =>
      BoxCreateAction.make(
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
        })
      ),
    onNonEmpty: (matches) =>
      A.match(A.drop(matches, 1), {
        onEmpty: () => onSingle(matches[0]),
        onNonEmpty: () =>
          BoxBlockedAction.make({
            ...actionBase({
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
            }),
            reason: BoxBlockedByAmbiguity.make({
              candidateCount: A.length(matches),
              matchKind: input.matchKind,
            }),
          }),
      }),
  });
};

const folderAction = (
  desired: BoxFolderIntent,
  candidates: ReadonlyArray<BoxObservedFolder>,
  dependencies: ReadonlyArray<Sha256Hex>
): BoxPlanAction => {
  const afterDigest = O.some(encodedDigest(BoxFolderIntent, desired));
  return A.match(candidates, {
    onEmpty: () =>
      BoxCreateAction.make(
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
        })
      ),
    onNonEmpty: (matches) =>
      A.match(A.drop(matches, 1), {
        onEmpty: () => {
          const observed = matches[0];
          return BoxNoopAction.make(
            actionBase({
              actionTag: "Noop",
              afterDigest,
              beforeDigest: O.some(encodedDigest(BoxObservedFolder, observed)),
              dependencies,
              destructive: false,
              etag: observed.etag,
              logicalKey: desired.logicalKey,
              providerId: O.some(observed.providerId),
              resourceKind: "folder",
              state: "unchanged",
            })
          );
        },
        onNonEmpty: () =>
          BoxBlockedAction.make({
            ...actionBase({
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
            }),
            reason: BoxBlockedByAmbiguity.make({
              candidateCount: A.length(matches),
              matchKind: "exact-name-sibling",
            }),
          }),
      }),
  });
};

const collaborationAction = (
  desired: BoxCollaborationIntent,
  folder: FolderResolution,
  observed: ReadonlyArray<BoxObservedCollaboration>
): BoxPlanAction => {
  const afterDigest = O.some(encodedDigest(BoxCollaborationIntent, desired));
  const candidates = O.match(folder.providerId, {
    onNone: A.empty<BoxObservedCollaboration>,
    onSome: (folderProviderId) =>
      A.filter(
        observed,
        (candidate) =>
          Equal.equals(candidate.folderProviderId, folderProviderId) &&
          Equal.equals(candidate.principal, desired.principal) &&
          Equal.equals(candidate.principalType, desired.principalType)
      ),
  });
  return dependentAction(
    {
      afterDigest,
      folder,
      logicalKey: desired.logicalKey,
      matchKind: "folder-principal",
      resourceKind: "collaboration",
    },
    candidates,
    (candidate) => {
      const unchanged = Equal.equals(candidate.role, desired.role);
      const base = actionBase({
        actionTag: unchanged ? "Noop" : "Update",
        afterDigest,
        beforeDigest: O.some(encodedDigest(BoxObservedCollaboration, candidate)),
        dependencies: [folder.actionKey],
        destructive: false,
        etag: O.none(),
        logicalKey: desired.logicalKey,
        providerId: O.some(candidate.providerId),
        resourceKind: "collaboration",
        state: unchanged ? "unchanged" : "present",
      });
      return unchanged ? BoxNoopAction.make(base) : BoxUpdateAction.make(base);
    }
  );
};

const webhookAction = (
  desired: BoxWebhookIntent,
  folder: FolderResolution,
  observed: ReadonlyArray<BoxObservedWebhook>
): BoxPlanAction => {
  const afterDigest = O.some(encodedDigest(BoxWebhookIntent, desired));
  const candidates = O.match(folder.providerId, {
    onNone: A.empty<BoxObservedWebhook>,
    onSome: (folderProviderId) =>
      A.filter(
        observed,
        (candidate) =>
          Equal.equals(candidate.targetProviderId, folderProviderId) && Equal.equals(candidate.address, desired.address)
      ),
  });
  return dependentAction(
    {
      afterDigest,
      folder,
      logicalKey: desired.logicalKey,
      matchKind: "target-callback",
      resourceKind: "webhook",
    },
    candidates,
    (candidate) => {
      const unchanged = sameTriggers(candidate.triggers, desired.triggers);
      const base = actionBase({
        actionTag: unchanged ? "Noop" : "Update",
        afterDigest,
        beforeDigest: O.some(encodedDigest(BoxObservedWebhook, candidate)),
        dependencies: [folder.actionKey],
        destructive: false,
        etag: O.none(),
        logicalKey: desired.logicalKey,
        providerId: O.some(candidate.providerId),
        resourceKind: "webhook",
        state: unchanged ? "unchanged" : "present",
      });
      return unchanged ? BoxNoopAction.make(base) : BoxUpdateAction.make(base);
    }
  );
};

const blockedCapabilityAction = <A extends BoxMetadataIntent | BoxRetentionIntent, I>(
  desired: A,
  schema: S.Codec<A, I>,
  resourceKind: "metadata" | "retention",
  planName: string,
  available: boolean,
  folder: FolderResolution
): BoxPlanAction =>
  BoxBlockedAction.make({
    ...actionBase({
      actionTag: "Blocked",
      afterDigest: O.some(encodedDigest(schema, desired)),
      beforeDigest: O.none(),
      dependencies: [folder.actionKey],
      destructive: false,
      etag: O.none(),
      logicalKey: desired.logicalKey,
      providerId: O.none(),
      resourceKind,
      state: "absent",
    }),
    reason: available
      ? BoxBlockedByPolicy.make({ policy: `${resourceKind}-mutation-out-of-scope-v1` })
      : BoxBlockedByEntitlement.make({ entitlement: resourceKind, planName }),
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
  observed: BoxObservedState
) {
  const expectedEnterpriseId = BoxProviderId.make(desired.expectedEnterpriseId);
  if (!Equal.equals(expectedEnterpriseId, observed.enterpriseId)) {
    return yield* BoxProvisioningTenantMismatchError.make({
      expectedEnterpriseId,
      actualEnterpriseId: observed.enterpriseId,
    });
  }
  const expectedSubjectId = BoxProviderId.make(desired.expectedSubjectId);
  if (!Equal.equals(expectedSubjectId, observed.subjectId)) {
    return yield* BoxProvisioningSubjectMismatchError.make({
      expectedSubjectId,
      actualSubjectId: observed.subjectId,
    });
  }

  const orderedFolders = A.sortWith(desired.folders, (folder) => folderDepth(desired.folders, folder), Order.Number);
  const resolutions = MutableHashMap.empty<BoxLogicalKey, FolderResolution>();
  const matchedFolderIds = MutableHashSet.empty<BoxProviderId>();
  const folderActions = A.map(orderedFolders, (folder) => {
    const parent = O.match(folder.parentKey, {
      onNone: () => ({
        actionKey: digestText("root-anchor"),
        blocked: false,
        providerId: O.some(observed.rootFolderId),
      }),
      onSome: (parentKey) =>
        O.getOrElse(MutableHashMap.get(resolutions, parentKey), () => ({
          actionKey: digestText(`unresolved:${parentKey}`),
          blocked: true,
          providerId: O.none(),
        })),
    });
    const candidates = O.match(parent.providerId, {
      onNone: A.empty<BoxObservedFolder>,
      onSome: (parentProviderId) =>
        A.filter(
          observed.folders,
          (candidate) =>
            O.contains(candidate.parentProviderId, parentProviderId) && Equal.equals(candidate.name, folder.name)
        ),
    });
    const dependencies = O.isSome(folder.parentKey) ? [parent.actionKey] : [];
    const action = parent.blocked
      ? BoxBlockedAction.make({
          ...actionBase({
            actionTag: "Blocked",
            afterDigest: O.some(encodedDigest(BoxFolderIntent, folder)),
            beforeDigest: O.none(),
            dependencies,
            destructive: false,
            etag: O.none(),
            logicalKey: folder.logicalKey,
            providerId: O.none(),
            resourceKind: "folder",
            state: "absent",
          }),
          reason: BoxBlockedByPolicy.make({ policy: "blocked-folder-dependency" }),
        })
      : folderAction(folder, candidates, dependencies);
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
  });

  const collaborationActions = A.map(desired.collaborations, (collaboration) =>
    collaborationAction(
      collaboration,
      O.getOrElse(MutableHashMap.get(resolutions, collaboration.folderKey), () => ({
        actionKey: digestText(`unresolved:${collaboration.folderKey}`),
        blocked: true,
        providerId: O.none(),
      })),
      observed.collaborations
    )
  );
  const webhookActions = A.map(desired.webhooks, (webhook) =>
    webhookAction(
      webhook,
      O.getOrElse(MutableHashMap.get(resolutions, webhook.folderKey), () => ({
        actionKey: digestText(`unresolved:${webhook.folderKey}`),
        blocked: true,
        providerId: O.none(),
      })),
      observed.webhooks
    )
  );
  const metadataActions = A.map(desired.metadata, (metadata) =>
    blockedCapabilityAction(
      metadata,
      BoxMetadataIntent,
      "metadata",
      desired.entitlements.planName,
      desired.entitlements.metadata === "available",
      O.getOrElse(MutableHashMap.get(resolutions, metadata.folderKey), () => ({
        actionKey: digestText(`unresolved:${metadata.folderKey}`),
        blocked: true,
        providerId: O.none(),
      }))
    )
  );
  const retentionActions = A.map(desired.retention, (retention) =>
    blockedCapabilityAction(
      retention,
      BoxRetentionIntent,
      "retention",
      desired.entitlements.planName,
      desired.entitlements.retention === "available",
      O.getOrElse(MutableHashMap.get(resolutions, retention.folderKey), () => ({
        actionKey: digestText(`unresolved:${retention.folderKey}`),
        blocked: true,
        providerId: O.none(),
      }))
    )
  );
  const actions = A.appendAll(
    A.appendAll(A.appendAll(folderActions, collaborationActions), webhookActions),
    A.appendAll(metadataActions, retentionActions)
  );
  const foreignResources = A.map(
    A.filter(observed.folders, (folder) => !MutableHashSet.has(matchedFolderIds, folder.providerId)),
    (folder) =>
      BoxForeignResource.make({
        resourceKind: "folder",
        providerId: folder.providerId,
        identityDigest: digestText(folder.name),
      })
  );
  const draft = BoxProvisioningPlan.make({
    sourceRevision: desired.sourceRevision,
    expectedEnterpriseId,
    subjectId: observed.subjectId,
    rootFolderId: observed.rootFolderId,
    desiredStateDigest: encodedDigest(BoxDesiredState, desired),
    liveStateDigest: encodedDigest(BoxObservedState, observed),
    planDigest: zeroDigest,
    actions,
    foreignResources,
    blockerCount: A.length(A.filter(actions, (action) => action._tag === "Blocked")),
    destructiveCount: A.length(A.filter(actions, (action) => action.destructive)),
    externalCollaboratorCount: A.length(
      A.filter(desired.collaborations, (collaboration) => collaboration.billingImpact === "external")
    ),
  });
  return BoxProvisioningPlan.make({
    ...draft,
    planDigest: encodedDigest(BoxProvisioningPlan, draft),
  });
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
  ) => Effect.Effect<BoxProvisioningPlan, BoxProvisioningTenantMismatchError | BoxProvisioningSubjectMismatchError>;
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
  static readonly layer = Layer.succeed(
    BoxProvisioningPlanner,
    BoxProvisioningPlanner.of({ plan: planBoxProvisioning })
  );
}
