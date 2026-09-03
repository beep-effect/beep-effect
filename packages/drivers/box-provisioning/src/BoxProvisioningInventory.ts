/**
 * Read-only Box inventory service for desired-state reconciliation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as B from "@beep/box";
import { $BoxProvisioningId } from "@beep/identity";
import { Context, Effect, Equal, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxProvisioningInvariantError } from "./BoxProvisioningErrors.ts";
import {
  BoxDiscoveryAvailable,
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
import type { BoxDesiredState } from "./BoxProvisioningIntent.ts";
import type { BoxDiscovery, BoxDiscoveryKind, BoxObservedFolder } from "./BoxProvisioningObserved.ts";
import type { MarkerPage } from "./internal/live.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningInventory");

const scanFolderTree = Effect.fn("BoxProvisioningInventory.scanFolderTree")(function* (
  box: B.Box["Service"],
  parentProviderId: BoxProviderId
): Effect.fn.Return<ReadonlyArray<BoxObservedFolder>, B.BoxError | BoxProvisioningInvariantError> {
  const items = yield* listFolderItems(box, parentProviderId);
  const children = yield* Effect.forEach(
    A.filter(items, S.is(B.FolderMini)),
    (item) => toObservedFolderFromMini(item, parentProviderId),
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
      listFolderCollaborations(box, folder.providerId).pipe(
        Effect.flatMap((collaborations) =>
          Effect.forEach(collaborations, (collaboration) => toObservedCollaboration(collaboration, folder.providerId))
        )
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));

const entitlementDiscovery = (
  kind: BoxDiscoveryKind,
  count: Effect.Effect<number, B.BoxError>
): Effect.Effect<BoxDiscovery, B.BoxError> =>
  count.pipe(
    Effect.map((value) => BoxDiscoveryAvailable.make({ count: value, kind })),
    Effect.catchTag("BoxError", (error) => {
      if (O.contains(error.status, 403)) {
        return Effect.succeed(BoxDiscoveryPermissionBlocked.make({ code: error.code, kind, status: 403 }));
      }
      return Effect.fail(error);
    })
  );

const countOptionalEntries = (entries: ReadonlyArray<unknown> | null | undefined): number =>
  A.length(O.getOrElse(O.fromNullishOr(entries), A.empty));

const observeMetadata = (
  box: B.Box["Service"],
  rootFolderId: BoxProviderId
): Effect.Effect<BoxDiscovery, B.BoxError> => {
  const folderMetadataCount = Equal.equals(rootFolderId, BoxProviderId.make("0"))
    ? Effect.succeed(0)
    : box.folderMetadata
        .getFolderMetadata(B.FolderMetadataGetFolderMetadataPayload.make({ folderId: rootFolderId }))
        .pipe(Effect.map((metadata) => countOptionalEntries(metadata.entries)));
  return entitlementDiscovery(
    "metadata",
    Effect.all(
      [
        folderMetadataCount,
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
            folderMetadata,
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
};

const observeRetention = (box: B.Box["Service"]): Effect.Effect<BoxDiscovery, B.BoxError> =>
  entitlementDiscovery(
    "retention",
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
  entitlementDiscovery(kind, collectMarkerPages(load).pipe(Effect.map(A.length)));

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
    const rootFolderId = desired.rootFolderId;
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
        observeMetadata(box, rootFolderId),
        observeRetention(box),
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
 * pagination. List-endpoint success, emptiness, and undocumented 403 responses
 * are not entitlement proof: every 403 is retained as a permission blocker and
 * the planner uses declared entitlements. Inventory does not request folder
 * metadata for root folder `0`, because Box documents that operation as
 * forbidden on the root. Every other driver error remains in the Effect error
 * channel. The service exposes no write verb.
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
 * @see {@link https://developer.box.com/reference/get-folders-id-metadata} for the root-folder restriction.
 * @see {@link https://developer.box.com/reference/get-retention-policies} for documented list response statuses.
 * @see {@link https://developer.box.com/reference/get-metadata-templates-enterprise} for documented list response statuses.
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
