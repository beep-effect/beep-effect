/**
 * Read-only Box inventory service for desired-state reconciliation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as B from "@beep/box";
import { $BoxProvisioningId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxProvisioningInvariantError } from "./BoxProvisioningErrors.ts";
import {
  BoxDiscoveryAvailable,
  BoxDiscoveryBlocked,
  BoxDiscoveryPermissionBlocked,
  BoxObservedState,
  BoxProviderId,
} from "./BoxProvisioningObserved.ts";
import {
  collectMarkerPages,
  listFolderCollaborations,
  listFolderItems,
  listObservedWebhooks,
  markerQuery,
  toObservedCollaboration,
  toObservedFolderFromMini,
} from "./internal/live.ts";
import type { BoxDesiredState, BoxEntitlementAvailability } from "./BoxProvisioningIntent.ts";
import type { BoxDiscovery, BoxDiscoveryKind, BoxObservedFolder } from "./BoxProvisioningObserved.ts";
import type { MarkerPage } from "./internal/live.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningInventory");

const scanFolderTree = Effect.fn("BoxProvisioningInventory.scanFolderTree")(function* (
  box: B.Box["Service"],
  parentProviderId: BoxProviderId
): Effect.fn.Return<ReadonlyArray<BoxObservedFolder>, B.BoxError | BoxProvisioningInvariantError> {
  const items = yield* listFolderItems({ box, folderId: parentProviderId });
  const children = yield* Effect.forEach(
    A.filter(items, S.is(B.FolderMini)),
    (item) => toObservedFolderFromMini({ item, parentProviderId }),
    { concurrency: 1 }
  );
  const descendants = yield* Effect.forEach(children, (child) => scanFolderTree(box, child.providerId), {
    concurrency: 1,
  });
  return A.appendAll(children, A.flatten(descendants));
});

const observeCollaborations = (box: B.Box["Service"], folders: ReadonlyArray<BoxObservedFolder>) =>
  Effect.forEach(
    folders,
    (folder) =>
      listFolderCollaborations({ box, folderId: folder.providerId }).pipe(
        Effect.flatMap((collaborations) =>
          Effect.forEach(collaborations, (collaboration) =>
            toObservedCollaboration({ collaboration, folderProviderId: folder.providerId })
          )
        )
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));

const PermissionErrorCode = LiteralKit(["access_denied_insufficient_permissions", "insufficient_scope"]);

const forbiddenDiscovery = (
  kind: "metadata" | "retention",
  assertedAvailability: BoxEntitlementAvailability,
  code: O.Option<string>
): BoxDiscovery =>
  O.exists(code, S.is(PermissionErrorCode)) || assertedAvailability === "available"
    ? BoxDiscoveryPermissionBlocked.make({ code, kind, status: 403 })
    : BoxDiscoveryBlocked.make({ kind, status: 403 });

const entitlementDiscovery = (
  kind: "metadata" | "retention",
  assertedAvailability: BoxEntitlementAvailability,
  count: Effect.Effect<number, B.BoxError>
): Effect.Effect<BoxDiscovery, B.BoxError> =>
  count.pipe(
    Effect.map((value) => BoxDiscoveryAvailable.make({ count: value, kind })),
    Effect.catchTag("BoxError", (error) => {
      if (O.contains(error.status, 403)) {
        return Effect.succeed(forbiddenDiscovery(kind, assertedAvailability, error.code));
      }
      return Effect.fail(error);
    })
  );

const countOptionalEntries = (entries: ReadonlyArray<unknown> | null | undefined): number =>
  A.length(O.getOrElse(O.fromNullishOr(entries), A.empty));

const observeMetadata = (
  box: B.Box["Service"],
  rootFolderId: BoxProviderId,
  assertedAvailability: BoxEntitlementAvailability
): Effect.Effect<BoxDiscovery, B.BoxError> =>
  entitlementDiscovery(
    "metadata",
    assertedAvailability,
    Effect.all(
      [
        box.folderMetadata.getFolderMetadata(B.FolderMetadataGetFolderMetadataPayload.make({ folderId: rootFolderId })),
        box.metadataCascadePolicies.getMetadataCascadePolicies(
          B.MetadataCascadePoliciesGetMetadataCascadePoliciesPayload.make({
            queryParams: { folderId: rootFolderId },
          })
        ),
        collectMarkerPages<B.MetadataTemplate, B.BoxError>((marker) =>
          box.metadataTemplates.getEnterpriseMetadataTemplates(
            B.MetadataTemplatesGetEnterpriseMetadataTemplatesPayload.make({ queryParams: markerQuery(marker) })
          )
        ),
        collectMarkerPages<B.MetadataTemplate, B.BoxError>((marker) =>
          box.metadataTemplates.getGlobalMetadataTemplates(
            B.MetadataTemplatesGetGlobalMetadataTemplatesPayload.make({ queryParams: markerQuery(marker) })
          )
        ),
      ],
      { concurrency: 1 }
    ).pipe(
      Effect.map(([folderMetadata, cascadePolicies, enterpriseTemplates, globalTemplates]) =>
        A.reduce(
          [
            countOptionalEntries(folderMetadata.entries),
            countOptionalEntries(cascadePolicies.entries),
            A.length(enterpriseTemplates),
            A.length(globalTemplates),
          ],
          0,
          (count, itemCount) => count + itemCount
        )
      )
    )
  );

const observeRetention = (
  box: B.Box["Service"],
  assertedAvailability: BoxEntitlementAvailability
): Effect.Effect<BoxDiscovery, B.BoxError> =>
  entitlementDiscovery(
    "retention",
    assertedAvailability,
    collectMarkerPages<B.RetentionPolicy, B.BoxError>((marker) =>
      box.retentionPolicies.getRetentionPolicies(
        B.RetentionPoliciesGetRetentionPoliciesPayload.make({ queryParams: markerQuery(marker) })
      )
    ).pipe(
      Effect.flatMap((policies) =>
        Effect.forEach(
          policies,
          (policy) =>
            collectMarkerPages<B.RetentionPolicyAssignment, B.BoxError>((marker) =>
              box.retentionPolicyAssignments.getRetentionPolicyAssignments(
                B.RetentionPolicyAssignmentsGetRetentionPolicyAssignmentsPayload.make({
                  retentionPolicyId: policy.id,
                  optionalsInput: { queryParams: markerQuery(marker) },
                })
              )
            ),
          { concurrency: 1 }
        ).pipe(Effect.map((assignments) => A.length(policies) + A.length(A.flatten(assignments))))
      )
    )
  );

const observeSimpleMarkerCount = <A>(
  kind: Extract<BoxDiscoveryKind, "signRequests" | "signTemplates">,
  load: (marker: O.Option<string>) => Effect.Effect<MarkerPage<A>, B.BoxError>
): Effect.Effect<BoxDiscovery, B.BoxError> =>
  collectMarkerPages(load).pipe(
    Effect.map((entries) => BoxDiscoveryAvailable.make({ count: A.length(entries), kind }))
  );

const observeSignRequests = (box: B.Box["Service"]) =>
  observeSimpleMarkerCount<B.SignRequest>("signRequests", (marker) =>
    box.signRequests.getSignRequests(B.SignRequestsGetSignRequestsPayload.make({ queryParams: markerQuery(marker) }))
  );

const observeSignTemplates = (box: B.Box["Service"]) =>
  observeSimpleMarkerCount<B.SignTemplate>("signTemplates", (marker) =>
    box.signTemplates.getSignTemplates(
      B.SignTemplatesGetSignTemplatesPayload.make({ queryParams: markerQuery(marker) })
    )
  );

const enterpriseIdFromUser = (user: B.UserFull): Effect.Effect<BoxProviderId, BoxProvisioningInvariantError> =>
  pipe(
    O.fromNullishOr(user.enterprise),
    O.flatMap((enterprise) => O.fromNullishOr(enterprise.id)),
    O.match({
      onNone: () => Effect.fail(BoxProvisioningInvariantError.make({ code: "missing-enterprise-id" })),
      onSome: (enterpriseId) => Effect.succeed(BoxProviderId.make(enterpriseId)),
    })
  );

const makeService = (box: B.Box["Service"]): BoxProvisioningInventoryShape => ({
  observe: Effect.fn("BoxProvisioningInventory.observe")(function* (desired) {
    const rootFolderId = BoxProviderId.make(desired.rootFolderId);
    const user = yield* box.users.getUserMe(
      B.UsersGetUserMePayload.make({
        queryParams: B.GetUserMeQueryParams.make({ fields: ["id", "enterprise"] }),
      })
    );
    const enterpriseId = yield* enterpriseIdFromUser(user);
    const folders = yield* scanFolderTree(box, rootFolderId);
    const [collaborations, webhooks, metadata, retention, signRequests, signTemplates] = yield* Effect.all(
      [
        observeCollaborations(box, folders),
        listObservedWebhooks(box),
        observeMetadata(box, rootFolderId, desired.entitlements.metadata),
        observeRetention(box, desired.entitlements.retention),
        observeSignRequests(box),
        observeSignTemplates(box),
      ],
      { concurrency: 1 }
    );
    return BoxObservedState.make({
      enterpriseId,
      subjectId: BoxProviderId.make(user.id),
      rootFolderId,
      folders,
      collaborations,
      webhooks,
      metadata,
      retention,
      signRequests,
      signTemplates,
    });
  }),
});

/**
 * Runtime contract for read-only Box tenant inventory.
 *
 * @category services
 * @since 0.0.0
 */
export interface BoxProvisioningInventoryShape {
  readonly observe: (
    desired: BoxDesiredState
  ) => Effect.Effect<BoxObservedState, B.BoxError | BoxProvisioningInvariantError>;
}

/**
 * Read-only service that normalizes live Box resources for the pure planner.
 *
 * **Details**
 *
 * Folder, collaboration, webhook, retention, and Sign listings follow marker
 * pagination. Metadata and retention 403 responses distinguish missing scopes
 * from asserted subscription blockers; every other driver error remains in
 * the Effect error channel. The service exposes no write verb.
 *
 * **Example** (Build the inventory layer from Box)
 *
 * ```ts
 * import { Box } from "@beep/box"
 * import { BoxProvisioningInventory } from "@beep/box-provisioning/BoxProvisioningInventory"
 *
 * console.log(BoxProvisioningInventory.layer.pipe)
 * console.log(Box)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxProvisioningInventory extends Context.Service<
  BoxProvisioningInventory,
  BoxProvisioningInventoryShape
>()($I`BoxProvisioningInventory`) {
  static readonly layer = Layer.effect(
    BoxProvisioningInventory,
    B.Box.pipe(Effect.map((box) => BoxProvisioningInventory.of(makeService(box))))
  );

  /**
   * Construct an inventory layer from an injected Box service for deterministic tests.
   *
   * **Example** (Inspect the injected-layer constructor)
   *
   * ```ts
   * import { BoxProvisioningInventory } from "@beep/box-provisioning/BoxProvisioningInventory"
   *
   * console.log(BoxProvisioningInventory.makeLayerFromBox)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromBox = (box: B.Box["Service"]): Layer.Layer<BoxProvisioningInventory> =>
    Layer.succeed(BoxProvisioningInventory, BoxProvisioningInventory.of(makeService(box)));
}
