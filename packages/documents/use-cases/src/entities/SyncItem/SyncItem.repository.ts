/**
 * SyncItem repository port.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { DmsProvider, RemoteItemId, SyncItemKind, VaultRelPath } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";
import type * as O from "effect/Option";

const $I = $DocumentsUseCasesId.create("entities/SyncItem/SyncItem.repository");

/**
 * Creation input for one sync-tracking row, excluding ProductEntity audit fields.
 *
 * **Example** (Making a SyncItem seed)
 *
 * ```ts
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import { SyncItemSeed } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const seed = SyncItemSeed.make({
 *   itemKind: "file",
 *   localGeneration: S.decodeUnknownSync(NonNegativeInt)(1),
 *   localRelPath: S.decodeUnknownSync(VaultRelPath)("matters/client-default/complaint.pdf"),
 *   provider: "box",
 *   syncState: "pending",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(seed.localRelPath)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncItemSeed extends S.Class<SyncItemSeed>($I`SyncItemSeed`)(
  {
    contentDigest: S.Option(DocumentContentDigest).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Digest of the local bytes last observed for this item; none for folders.",
    }),
    contentSizeBytes: S.Option(NonNegativeInt).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Size in bytes of the local content last observed; none for folders.",
    }),
    itemKind: SyncItemKind.annotateKey({
      description: "Whether the mirrored vault item is a file or a folder.",
    }),
    lastError: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Most recent push failure message; none when the item is healthy.",
    }),
    lastPushedDigest: S.Option(DocumentContentDigest).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Digest of the content most recently pushed to the provider; none before first push.",
    }),
    lastPushedGeneration: S.Option(NonNegativeInt).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Local generation counter captured by the most recent successful push.",
    }),
    localGeneration: NonNegativeInt.annotateKey({
      description: "Monotonic counter incremented per observed local change.",
    }),
    localRelPath: VaultRelPath.annotateKey({
      description: "Vault-root-relative path of the mirrored local item.",
    }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider receiving the one-way mirror for this item.",
    }),
    remoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider item identifier assigned by the DMS; none before first push.",
    }),
    remoteName: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Item name last observed on the provider side; none before first push.",
    }),
    remoteParentId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the remote parent folder; none before first push.",
    }),
    syncState: DomainSyncItem.SyncItemState.annotateKey({
      description: "Reconciliation state of the mirrored item.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault owns the mirrored item.",
    }),
  },
  $I.annote("SyncItemSeed", {
    description: "Creation input for one sync-tracking row, excluding ProductEntity audit fields.",
  })
) {}

const SyncItemRepositoryConflictFields = {
  localRelPath: VaultRelPath.annotateKey({
    description: "Vault-relative path whose tracking row conflicted.",
  }),
  reason: S.NonEmptyString.annotateKey({
    description: "Non-empty repository conflict diagnostic.",
  }),
} satisfies S.Struct.Fields;
const sameSyncItemRepositoryConflictFields = S.toEquivalence(
  S.TaggedStruct("SyncItemRepositoryConflict", SyncItemRepositoryConflictFields)
);
const sameSyncItemRepositoryConflict = (self: SyncItemRepositoryConflict, that: SyncItemRepositoryConflict): boolean =>
  sameSyncItemRepositoryConflictFields(self, that);

/**
 * Persistence failure raised when a SyncItem write conflicts with an existing row.
 *
 * **Example** (Building a conflict error)
 *
 * ```ts
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import { SyncItemRepositoryConflict } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import * as S from "effect/Schema"
 *
 * const error = SyncItemRepositoryConflict.make({
 *   localRelPath: S.decodeUnknownSync(VaultRelPath)("matters/client-default/complaint.pdf"),
 *   reason: "sync item already tracked for path"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncItemRepositoryConflict extends S.TaggedError<SyncItemRepositoryConflict>(
  $I`SyncItemRepositoryConflict`
)(
  "SyncItemRepositoryConflict",
  SyncItemRepositoryConflictFields,
  $I.annoteClass<
    S.declare<SyncItemRepositoryConflict>,
    readonly [S.TaggedStruct<"SyncItemRepositoryConflict", typeof SyncItemRepositoryConflictFields>]
  >("SyncItemRepositoryConflict", {
    title: "SyncItem repository conflict",
    description: "The SyncItem repository rejected a conflicting write.",
    toEquivalence: () => sameSyncItemRepositoryConflict,
  })
) {
  static readonly is = S.is(SyncItemRepositoryConflict);
}

const SyncItemRepositoryNotFoundFields = {
  syncItemId: DocumentsIdentity.SyncItemId.annotateKey({
    description: "SyncItem identity that could not be found.",
  }),
} satisfies S.Struct.Fields;
const sameSyncItemRepositoryNotFoundFields = S.toEquivalence(
  S.TaggedStruct("SyncItemRepositoryNotFound", SyncItemRepositoryNotFoundFields)
);
const sameSyncItemRepositoryNotFound = (self: SyncItemRepositoryNotFound, that: SyncItemRepositoryNotFound): boolean =>
  sameSyncItemRepositoryNotFoundFields(self, that);

/**
 * Persistence failure raised when a SyncItem row is absent.
 *
 * **Example** (Building a not-found error)
 *
 * ```ts
 * import { SyncItemRepositoryNotFound } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const error = SyncItemRepositoryNotFound.make({
 *   syncItemId: S.decodeUnknownSync(DocumentsIdentity.SyncItemId)(1)
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncItemRepositoryNotFound extends S.TaggedError<SyncItemRepositoryNotFound>(
  $I`SyncItemRepositoryNotFound`
)(
  "SyncItemRepositoryNotFound",
  SyncItemRepositoryNotFoundFields,
  $I.annoteClass<
    S.declare<SyncItemRepositoryNotFound>,
    readonly [S.TaggedStruct<"SyncItemRepositoryNotFound", typeof SyncItemRepositoryNotFoundFields>]
  >("SyncItemRepositoryNotFound", {
    title: "SyncItem repository not found",
    description: "The SyncItem repository could not find the requested entity.",
    toEquivalence: () => sameSyncItemRepositoryNotFound,
  })
) {
  static readonly is = S.is(SyncItemRepositoryNotFound);
}

const SyncItemRepositoryUnavailableFields = {
  reason: S.NonEmptyString.annotateKey({
    description: "Non-empty repository availability diagnostic.",
  }),
} satisfies S.Struct.Fields;
const sameSyncItemRepositoryUnavailableFields = S.toEquivalence(
  S.TaggedStruct("SyncItemRepositoryUnavailable", SyncItemRepositoryUnavailableFields)
);
const sameSyncItemRepositoryUnavailable = (
  self: SyncItemRepositoryUnavailable,
  that: SyncItemRepositoryUnavailable
): boolean => sameSyncItemRepositoryUnavailableFields(self, that);

/**
 * Persistence failure raised when the SyncItem repository is unavailable.
 *
 * **Example** (Building an unavailable error)
 *
 * ```ts
 * import { SyncItemRepositoryUnavailable } from "@beep/documents-use-cases/entities/SyncItem/server"
 *
 * const error = SyncItemRepositoryUnavailable.make({ reason: "database connection closed" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncItemRepositoryUnavailable extends S.TaggedError<SyncItemRepositoryUnavailable>(
  $I`SyncItemRepositoryUnavailable`
)(
  "SyncItemRepositoryUnavailable",
  SyncItemRepositoryUnavailableFields,
  $I.annoteClass<
    S.declare<SyncItemRepositoryUnavailable>,
    readonly [S.TaggedStruct<"SyncItemRepositoryUnavailable", typeof SyncItemRepositoryUnavailableFields>]
  >("SyncItemRepositoryUnavailable", {
    title: "SyncItem repository unavailable",
    description: "The SyncItem repository could not serve the request.",
    toEquivalence: () => sameSyncItemRepositoryUnavailable,
  })
) {
  static readonly is = S.is(SyncItemRepositoryUnavailable);
}

/**
 * Lookup input addressing one sync-tracking row by vault-relative path.
 *
 * **Example** (Making path lookup input)
 *
 * ```ts
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import { FindSyncItemByPathInput } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = FindSyncItemByPathInput.make({
 *   localRelPath: S.decodeUnknownSync(VaultRelPath)("matters/client-default/complaint.pdf"),
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.localRelPath)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class FindSyncItemByPathInput extends S.Class<FindSyncItemByPathInput>($I`FindSyncItemByPathInput`)(
  {
    localRelPath: VaultRelPath.annotateKey({
      description: "Vault-root-relative path of the tracked local item.",
    }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose mirror tracks the item.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault owns the tracked item.",
    }),
  },
  $I.annote("FindSyncItemByPathInput", {
    description: "Lookup input addressing one sync-tracking row by vault-relative path.",
  })
) {}

/**
 * Lookup input addressing one sync-tracking row by provider remote id.
 *
 * **Example** (Making remote-id lookup input)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { FindSyncItemByRemoteIdInput } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = FindSyncItemByRemoteIdInput.make({
 *   provider: "box",
 *   remoteId: S.decodeUnknownSync(RemoteItemId)("9001"),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.remoteId)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class FindSyncItemByRemoteIdInput extends S.Class<FindSyncItemByRemoteIdInput>($I`FindSyncItemByRemoteIdInput`)(
  {
    provider: DmsProvider.annotateKey({
      description: "DMS provider that assigned the remote identifier.",
    }),
    remoteId: RemoteItemId.annotateKey({
      description: "Provider item identifier assigned by the DMS.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault owns the tracked item.",
    }),
  },
  $I.annote("FindSyncItemByRemoteIdInput", {
    description: "Lookup input addressing one sync-tracking row by provider remote id.",
  })
) {}

/**
 * Listing input addressing every sync-tracking row of one workspace mirror.
 *
 * **Example** (Making workspace list input)
 *
 * ```ts
 * import { ListSyncItemsByWorkspaceInput } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = ListSyncItemsByWorkspaceInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.provider)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ListSyncItemsByWorkspaceInput extends S.Class<ListSyncItemsByWorkspaceInput>(
  $I`ListSyncItemsByWorkspaceInput`
)(
  {
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose mirror is listed.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault mirror is listed.",
    }),
  },
  $I.annote("ListSyncItemsByWorkspaceInput", {
    description: "Listing input addressing every sync-tracking row of one workspace mirror.",
  })
) {}

/**
 * SyncItem repository port consumed by the vault sync engine.
 *
 * **Details**
 *
 * `create` fails with {@link SyncItemRepositoryConflict} when a row already
 * tracks the seed's workspace, provider, and path; `update` persists a full
 * entity and fails with {@link SyncItemRepositoryNotFound} when the row is
 * absent.
 *
 * **Example** (Defining a stub repository)
 *
 * ```ts
 * import {
 *   ListSyncItemsByWorkspaceInput,
 *   SyncItemRepositoryUnavailable,
 *   type SyncItemRepositoryShape
 * } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const repository: SyncItemRepositoryShape = {
 *   create: () => Effect.fail(SyncItemRepositoryUnavailable.make({ reason: "stub repository" })),
 *   findByPath: () => Effect.succeed(O.none()),
 *   findByRemoteId: () => Effect.succeed(O.none()),
 *   listByWorkspace: () => Effect.succeed([]),
 *   update: (item) => Effect.succeed(item)
 * }
 * const input = ListSyncItemsByWorkspaceInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 *
 * Effect.runPromise(repository.listByWorkspace(input)).then((items) => console.log(items.length))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface SyncItemRepositoryShape {
  readonly create: (
    seed: SyncItemSeed
  ) => Effect.Effect<DomainSyncItem.SyncItem, SyncItemRepositoryConflict | SyncItemRepositoryUnavailable>;
  readonly findByPath: (
    input: FindSyncItemByPathInput
  ) => Effect.Effect<O.Option<DomainSyncItem.SyncItem>, SyncItemRepositoryUnavailable>;
  readonly findByRemoteId: (
    input: FindSyncItemByRemoteIdInput
  ) => Effect.Effect<O.Option<DomainSyncItem.SyncItem>, SyncItemRepositoryUnavailable>;
  readonly listByWorkspace: (
    input: ListSyncItemsByWorkspaceInput
  ) => Effect.Effect<ReadonlyArray<DomainSyncItem.SyncItem>, SyncItemRepositoryUnavailable>;
  readonly update: (
    item: DomainSyncItem.SyncItem
  ) => Effect.Effect<DomainSyncItem.SyncItem, SyncItemRepositoryNotFound | SyncItemRepositoryUnavailable>;
}

/**
 * Context tag for the SyncItem repository port.
 *
 * **Example** (Providing repository context service)
 *
 * ```ts
 * import {
 *   SyncItemRepository,
 *   SyncItemRepositoryUnavailable,
 *   type SyncItemRepositoryShape
 * } from "@beep/documents-use-cases/entities/SyncItem/server"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const repository: SyncItemRepositoryShape = {
 *   create: () => Effect.fail(SyncItemRepositoryUnavailable.make({ reason: "stub repository" })),
 *   findByPath: () => Effect.succeed(O.none()),
 *   findByRemoteId: () => Effect.succeed(O.none()),
 *   listByWorkspace: () => Effect.succeed([]),
 *   update: (item) => Effect.succeed(item)
 * }
 *
 * const program = Effect.gen(function* () {
 *   return (yield* SyncItemRepository) === repository
 * }).pipe(Effect.provideService(SyncItemRepository, repository))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncItemRepository extends Context.Service<SyncItemRepository, SyncItemRepositoryShape>()(
  $I`SyncItemRepository`
) {}
