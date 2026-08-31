/**
 * Read-only Box inventory service for desired-state reconciliation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as B from "@beep/box";
import { $BoxProvisioningId } from "@beep/identity";
import { HttpsUrl } from "@beep/schema";
import { Context, Effect, Layer, MutableHashSet, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxProvisioningInvariantError } from "./BoxProvisioningErrors.ts";
import {
  BoxDiscoveryAvailable,
  BoxDiscoveryBlocked,
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedState,
  BoxObservedWebhook,
  BoxProviderId,
} from "./BoxProvisioningObserved.ts";
import type { BoxDesiredState } from "./BoxProvisioningIntent.ts";
import type { BoxDiscovery, BoxDiscoveryKind } from "./BoxProvisioningObserved.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningInventory");
const markerPageLimit = 1000;

type MarkerPage<A> = {
  readonly entries?: ReadonlyArray<A>;
  readonly nextMarker?: string | null;
};

const collectMarkerPages = <A, E>(
  load: (marker: O.Option<string>) => Effect.Effect<MarkerPage<A>, E>
): Effect.Effect<ReadonlyArray<A>, E> =>
  Effect.gen(function* () {
    let marker = O.none<string>();
    let entries = A.empty<A>();
    const seen = MutableHashSet.empty<string>();

    while (true) {
      const page = yield* load(marker);
      entries = A.appendAll(entries, O.getOrElse(O.fromNullishOr(page.entries), A.empty<A>));
      const next = O.fromNullishOr(page.nextMarker);
      if (O.isNone(next) || MutableHashSet.has(seen, next.value)) {
        return entries;
      }
      MutableHashSet.add(seen, next.value);
      marker = next;
    }
  });

const markerQuery = (marker: O.Option<string>) =>
  O.match(marker, {
    onNone: () => ({ limit: markerPageLimit }),
    onSome: (value) => ({ limit: markerPageLimit, marker: value }),
  });

const markerFolderQuery = (marker: O.Option<string>) => ({ ...markerQuery(marker), usemarker: true });

const listFolderItems = (box: B.Box["Service"], folderId: string) =>
  collectMarkerPages<B.Item, B.BoxError>((marker) =>
    box.folders.getFolderItems(
      B.FoldersGetFolderItemsPayload.make({
        folderId,
        optionalsInput: { queryParams: markerFolderQuery(marker) },
      })
    )
  );

const toObservedFolder = (
  item: B.FolderMini,
  parentProviderId: BoxProviderId
): Effect.Effect<BoxObservedFolder, BoxProvisioningInvariantError> =>
  O.match(O.fromNullishOr(item.name), {
    onNone: () => Effect.fail(BoxProvisioningInvariantError.make({ code: "unreadable-sdk-response" })),
    onSome: (name) =>
      Effect.succeed(
        BoxObservedFolder.make({
          providerId: BoxProviderId.make(item.id),
          parentProviderId: O.some(parentProviderId),
          name,
          etag: O.fromNullishOr(item.etag),
        })
      ),
  });

const scanFolderTree = (
  box: B.Box["Service"],
  parentProviderId: BoxProviderId
): Effect.Effect<ReadonlyArray<BoxObservedFolder>, B.BoxError | BoxProvisioningInvariantError> =>
  Effect.gen(function* () {
    const items = yield* listFolderItems(box, parentProviderId);
    const children = yield* Effect.forEach(
      A.filter(items, S.is(B.FolderMini)),
      (item) => toObservedFolder(item, parentProviderId),
      { concurrency: 1 }
    );
    const descendants = yield* Effect.forEach(children, (child) => scanFolderTree(box, child.providerId), {
      concurrency: 1,
    });
    return A.appendAll(children, A.flatten(descendants));
  });

const listFolderCollaborations = (box: B.Box["Service"], folderId: BoxProviderId) =>
  collectMarkerPages<B.Collaboration, B.BoxError>((marker) =>
    box.listCollaborations.getFolderCollaborations(
      B.ListCollaborationsGetFolderCollaborationsPayload.make({
        folderId,
        optionalsInput: { queryParams: markerQuery(marker) },
      })
    )
  );

type CollaborationPrincipal = {
  readonly principal: string;
  readonly principalType: "user" | "group";
};

const makeCollaborationPrincipal =
  (principalType: CollaborationPrincipal["principalType"]) =>
  (principal: string): CollaborationPrincipal => ({ principal, principalType });

const collaborationPrincipal = (collaboration: B.Collaboration): O.Option<CollaborationPrincipal> => {
  const pendingInvite = pipe(O.fromNullishOr(collaboration.inviteEmail), O.map(makeCollaborationPrincipal("user")));
  return pipe(
    O.fromNullishOr(collaboration.accessibleBy),
    O.flatMap((accessibleBy): O.Option<CollaborationPrincipal> => {
      if (S.is(B.UserCollaborations)(accessibleBy)) {
        return pipe(
          O.fromNullishOr(accessibleBy.login),
          O.orElse(() => O.fromNullishOr(accessibleBy.id)),
          O.map(makeCollaborationPrincipal("user"))
        );
      }
      return pipe(O.fromNullishOr(accessibleBy.id), O.map(makeCollaborationPrincipal("group")));
    }),
    O.orElse(() => pendingInvite)
  );
};

const toObservedCollaboration = (
  folderProviderId: BoxProviderId,
  collaboration: B.Collaboration
): Effect.Effect<BoxObservedCollaboration, BoxProvisioningInvariantError> =>
  O.match(O.all({ principal: collaborationPrincipal(collaboration), role: O.fromNullishOr(collaboration.role) }), {
    onNone: () => Effect.fail(BoxProvisioningInvariantError.make({ code: "unreadable-sdk-response" })),
    onSome: ({ principal, role }) =>
      Effect.succeed(
        BoxObservedCollaboration.make({
          providerId: BoxProviderId.make(collaboration.id),
          folderProviderId,
          principalType: principal.principalType,
          principal: principal.principal,
          role,
        })
      ),
  });

const observeCollaborations = (box: B.Box["Service"], folders: ReadonlyArray<BoxObservedFolder>) =>
  Effect.forEach(
    folders,
    (folder) =>
      listFolderCollaborations(box, folder.providerId).pipe(
        Effect.flatMap((collaborations) =>
          Effect.forEach(collaborations, (collaboration) => toObservedCollaboration(folder.providerId, collaboration))
        )
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));

const RawWebhook = S.Struct({
  id: S.NonEmptyString,
  target: S.Struct({ id: S.NonEmptyString }),
  address: HttpsUrl,
  triggers: S.Array(S.NonEmptyString),
});

const toObservedWebhook = (webhook: unknown): Effect.Effect<BoxObservedWebhook, BoxProvisioningInvariantError> =>
  S.decodeUnknownEffect(RawWebhook)(webhook).pipe(
    Effect.map((decoded) =>
      BoxObservedWebhook.make({
        providerId: BoxProviderId.make(decoded.id),
        targetProviderId: BoxProviderId.make(decoded.target.id),
        address: decoded.address,
        triggers: decoded.triggers,
      })
    ),
    Effect.mapError(() => BoxProvisioningInvariantError.make({ code: "unreadable-sdk-response" }))
  );

const observeWebhooks = (box: B.Box["Service"]) =>
  collectMarkerPages<B.WebhookMini, B.BoxError>((marker) =>
    box.webhooks.getWebhooks(B.WebhooksGetWebhooksPayload.make({ queryParams: markerQuery(marker) }))
  ).pipe(
    Effect.flatMap((webhooks) =>
      Effect.forEach(
        A.getSomes(A.map(webhooks, (webhook) => O.fromNullishOr(webhook.id))),
        (webhookId) =>
          box.webhooks
            .getWebhookById(B.WebhooksGetWebhookByIdPayload.make({ webhookId }))
            .pipe(Effect.flatMap(toObservedWebhook)),
        { concurrency: 1 }
      )
    )
  );

const entitlementDiscovery = (
  kind: "metadata" | "retention",
  count: Effect.Effect<number, B.BoxError>
): Effect.Effect<BoxDiscovery, B.BoxError> =>
  count.pipe(
    Effect.map((value) => BoxDiscoveryAvailable.make({ count: value, kind })),
    Effect.catchTag("BoxError", (error) =>
      O.contains(error.status, 403)
        ? Effect.succeed(BoxDiscoveryBlocked.make({ kind, status: 403 }))
        : Effect.fail(error)
    )
  );

const countOptionalEntries = (entries: ReadonlyArray<unknown> | null | undefined): number =>
  A.length(O.getOrElse(O.fromNullishOr(entries), A.empty));

const observeMetadata = (box: B.Box["Service"], rootFolderId: BoxProviderId): Effect.Effect<BoxDiscovery, B.BoxError> =>
  entitlementDiscovery(
    "metadata",
    Effect.all(
      [
        box.folderMetadata.getFolderMetadata(B.FolderMetadataGetFolderMetadataPayload.make({ folderId: rootFolderId })),
        box.metadataCascadePolicies.getMetadataCascadePolicies(
          B.MetadataCascadePoliciesGetMetadataCascadePoliciesPayload.make({
            queryParams: { folderId: rootFolderId },
          })
        ),
        box.metadataTemplates.getEnterpriseMetadataTemplates(
          B.MetadataTemplatesGetEnterpriseMetadataTemplatesPayload.make({ queryParams: { limit: markerPageLimit } })
        ),
        box.metadataTemplates.getGlobalMetadataTemplates(
          B.MetadataTemplatesGetGlobalMetadataTemplatesPayload.make({ queryParams: { limit: markerPageLimit } })
        ),
      ],
      { concurrency: 1 }
    ).pipe(
      Effect.map(([folderMetadata, cascadePolicies, enterpriseTemplates, globalTemplates]) =>
        A.reduce(
          [
            countOptionalEntries(folderMetadata.entries),
            countOptionalEntries(cascadePolicies.entries),
            countOptionalEntries(enterpriseTemplates.entries),
            countOptionalEntries(globalTemplates.entries),
          ],
          0,
          (count, itemCount) => count + itemCount
        )
      )
    )
  );

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
    const user = yield* box.users.getUserMe(B.UsersGetUserMePayload.make({}));
    const enterpriseId = yield* enterpriseIdFromUser(user);
    const folders = yield* scanFolderTree(box, rootFolderId);
    const [collaborations, webhooks, metadata, retention, signRequests, signTemplates] = yield* Effect.all(
      [
        observeCollaborations(box, folders),
        observeWebhooks(box),
        observeMetadata(box, rootFolderId),
        observeRetention(box),
        observeSignRequests(box),
        observeSignTemplates(box),
      ],
      { concurrency: 1 }
    );
    return BoxObservedState.make({
      enterpriseId,
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
 * pagination. Metadata and retention 403 responses become typed entitlement
 * discovery results; every other driver error remains in the Effect error
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
