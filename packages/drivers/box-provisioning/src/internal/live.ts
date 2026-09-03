import * as B from "@beep/box";
import { HttpsUrl } from "@beep/schema";
import { Effect, MutableHashSet, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxProvisioningInvariantError } from "../BoxProvisioningErrors.ts";
import {
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedWebhook,
  BoxProviderId,
  BoxProviderRevision,
} from "../BoxProvisioningObserved.ts";
import { canonicalObservedWebhook } from "./canonical.ts";

const markerPageLimit = 1000;

export type MarkerPage<A> = {
  readonly entries?: ReadonlyArray<A>;
  readonly nextMarker?: string | null;
};

const invariant = () => BoxProvisioningInvariantError.make({ code: "unreadable-sdk-response" });

export const collectMarkerPages = Effect.fn("BoxProvisioningLive.collectMarkerPages")(function* <A, E>(
  load: (marker: O.Option<string>) => Effect.Effect<MarkerPage<A>, E>
): Effect.fn.Return<ReadonlyArray<A>, E> {
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

export const markerQuery = (marker: O.Option<string>) =>
  O.match(marker, {
    onNone: () => ({ limit: markerPageLimit }),
    onSome: (value) => ({ limit: markerPageLimit, marker: value }),
  });

const markerFolderQuery = (marker: O.Option<string>) => ({ ...markerQuery(marker), usemarker: true });

export const listFolderItems: {
  (folderId: string): (box: B.Box["Service"]) => Effect.Effect<ReadonlyArray<B.Item>, B.BoxError>;
  (box: B.Box["Service"], folderId: string): Effect.Effect<ReadonlyArray<B.Item>, B.BoxError>;
} = dual(2, (box: B.Box["Service"], folderId: string) =>
  collectMarkerPages<B.Item, B.BoxError>((marker) =>
    box.folders.getFolderItems(
      B.FoldersGetFolderItemsPayload.make({
        folderId,
        optionalsInput: { queryParams: markerFolderQuery(marker) },
      })
    )
  )
);

export const listFolderCollaborations: {
  (folderId: BoxProviderId): (box: B.Box["Service"]) => Effect.Effect<ReadonlyArray<B.Collaboration>, B.BoxError>;
  (box: B.Box["Service"], folderId: BoxProviderId): Effect.Effect<ReadonlyArray<B.Collaboration>, B.BoxError>;
} = dual(2, (box: B.Box["Service"], folderId: BoxProviderId) =>
  collectMarkerPages<B.Collaboration, B.BoxError>((marker) =>
    box.listCollaborations.getFolderCollaborations(
      B.ListCollaborationsGetFolderCollaborationsPayload.make({
        folderId,
        optionalsInput: { queryParams: markerQuery(marker) },
      })
    )
  )
);

type CollaborationPrincipal = {
  readonly principal: string;
  readonly principalProviderId: O.Option<BoxProviderId>;
  readonly principalType: "user" | "group";
};

const makeCollaborationPrincipal =
  (principalType: CollaborationPrincipal["principalType"], principalProviderId: O.Option<BoxProviderId>) =>
  (principal: string): CollaborationPrincipal => ({ principal, principalProviderId, principalType });

const collaborationPrincipal = (collaboration: B.Collaboration): O.Option<CollaborationPrincipal> => {
  const pendingInvite = pipe(
    O.fromNullishOr(collaboration.inviteEmail),
    O.map(makeCollaborationPrincipal("user", O.none()))
  );
  return pipe(
    O.fromNullishOr(collaboration.accessibleBy),
    O.flatMap((accessibleBy): O.Option<CollaborationPrincipal> => {
      const principalProviderId = pipe(O.fromNullishOr(accessibleBy.id), O.map(BoxProviderId.make));
      if (S.is(B.UserCollaborations)(accessibleBy)) {
        return pipe(
          O.fromNullishOr(accessibleBy.login),
          O.orElse(() => O.fromNullishOr(accessibleBy.id)),
          O.map(makeCollaborationPrincipal("user", principalProviderId))
        );
      }
      return pipe(O.fromNullishOr(accessibleBy.id), O.map(makeCollaborationPrincipal("group", principalProviderId)));
    }),
    O.orElse(() => pendingInvite)
  );
};

export const toObservedFolderFromMini: {
  (
    parentProviderId: BoxProviderId
  ): (item: B.FolderMini) => Effect.Effect<BoxObservedFolder, BoxProvisioningInvariantError>;
  (
    item: B.FolderMini,
    parentProviderId: BoxProviderId
  ): Effect.Effect<BoxObservedFolder, BoxProvisioningInvariantError>;
} = dual(2, (item: B.FolderMini, parentProviderId: BoxProviderId) =>
  O.match(O.fromNullishOr(item.name), {
    onNone: () => Effect.fail(invariant()),
    onSome: (name) =>
      Effect.succeed(
        BoxObservedFolder.make({
          etag: pipe(O.fromNullishOr(item.etag), O.map(BoxProviderRevision.make)),
          name,
          parentProviderId: O.some(parentProviderId),
          providerId: BoxProviderId.make(item.id),
        })
      ),
  })
);

export const toObservedFolderFromFull = (
  folder: B.FolderFull
): Effect.Effect<BoxObservedFolder, BoxProvisioningInvariantError> =>
  O.match(
    O.all({
      name: O.fromNullishOr(folder.name),
      parentProviderId: pipe(
        O.fromNullishOr(folder.parent),
        O.flatMap((parent) => O.fromNullishOr(parent.id))
      ),
    }),
    {
      onNone: () => Effect.fail(invariant()),
      onSome: ({ name, parentProviderId }) =>
        Effect.succeed(
          BoxObservedFolder.make({
            etag: pipe(O.fromNullishOr(folder.etag), O.map(BoxProviderRevision.make)),
            name,
            parentProviderId: O.some(BoxProviderId.make(parentProviderId)),
            providerId: BoxProviderId.make(folder.id),
          })
        ),
    }
  );

export const toObservedCollaboration: {
  (
    folderProviderId: BoxProviderId
  ): (collaboration: B.Collaboration) => Effect.Effect<BoxObservedCollaboration, BoxProvisioningInvariantError>;
  (
    collaboration: B.Collaboration,
    folderProviderId: BoxProviderId
  ): Effect.Effect<BoxObservedCollaboration, BoxProvisioningInvariantError>;
} = dual(2, (collaboration: B.Collaboration, folderProviderId: BoxProviderId) =>
  O.match(O.all({ principal: collaborationPrincipal(collaboration), role: O.fromNullishOr(collaboration.role) }), {
    onNone: () => Effect.fail(invariant()),
    onSome: ({ principal, role }) =>
      Effect.succeed(
        BoxObservedCollaboration.make({
          folderProviderId,
          principal: principal.principal,
          principalProviderId: principal.principalProviderId,
          principalType: principal.principalType,
          providerId: BoxProviderId.make(collaboration.id),
          role,
        })
      ),
  })
);

export const toObservedCollaborationFromFull = (
  collaboration: B.Collaboration
): Effect.Effect<BoxObservedCollaboration, BoxProvisioningInvariantError> =>
  pipe(
    O.fromNullishOr(collaboration.item),
    O.flatMap((item) => O.fromNullishOr(item.id)),
    O.match({
      onNone: () => Effect.fail(invariant()),
      onSome: (folderProviderId) => toObservedCollaboration(collaboration, BoxProviderId.make(folderProviderId)),
    })
  );

const RawWebhook = S.Struct({
  id: S.NonEmptyString,
  target: S.Struct({ id: S.NonEmptyString }),
  address: HttpsUrl,
  triggers: S.Array(S.NonEmptyString),
});

export const toObservedWebhook = (webhook: unknown): Effect.Effect<BoxObservedWebhook, BoxProvisioningInvariantError> =>
  S.decodeUnknownEffect(RawWebhook)(webhook).pipe(
    Effect.map((decoded) =>
      canonicalObservedWebhook(
        BoxObservedWebhook.make({
          address: decoded.address,
          providerId: BoxProviderId.make(decoded.id),
          targetProviderId: BoxProviderId.make(decoded.target.id),
          triggers: decoded.triggers,
        })
      )
    ),
    Effect.mapError(invariant)
  );

export const listObservedWebhooks = (box: B.Box["Service"]) =>
  collectMarkerPages<B.WebhookMini, B.BoxError>((marker) =>
    box.webhooks.getWebhooks(B.WebhooksGetWebhooksPayload.make({ queryParams: markerQuery(marker) }))
  ).pipe(
    Effect.flatMap((webhooks) =>
      Effect.forEach(
        webhooks,
        (webhook) =>
          O.match(O.fromNullishOr(webhook.id), {
            onNone: () => Effect.fail(invariant()),
            onSome: (webhookId) =>
              box.webhooks
                .getWebhookById(B.WebhooksGetWebhookByIdPayload.make({ webhookId }))
                .pipe(Effect.flatMap(toObservedWebhook)),
          }),
        { concurrency: 1 }
      )
    )
  );
