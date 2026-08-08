/**
 * SyncOperation repository port.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import * as Documents from "@beep/documents-domain/identity/Documents";
import { DmsProvider, VaultRelPath } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";

const $I = $DocumentsUseCasesId.create("entities/SyncOperation/SyncOperation.repository");

/**
 * Creation input for one push-outbox operation, excluding BaseEntity bookkeeping fields.
 *
 * **Example** (Make uploadFile seed)
 *
 * ```ts
 * import * as Documents from "@beep/documents-domain/identity/Documents"
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import { SyncOperationSeed } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const seed = SyncOperationSeed.make({
 *   attemptCount: S.decodeUnknownSync(NonNegativeInt)(0),
 *   idempotencyKey: "sync-item-1:uploadFile:1",
 *   inputGeneration: S.decodeUnknownSync(NonNegativeInt)(1),
 *   operationType: "uploadFile",
 *   provider: "box",
 *   status: "queued",
 *   syncItemId: S.decodeUnknownSync(Documents.SyncItemId)(1),
 *   targetName: "complaint.pdf",
 *   targetRelPath: S.decodeUnknownSync(VaultRelPath)("matters/client-default/complaint.pdf"),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(seed.idempotencyKey)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncOperationSeed extends S.Class<SyncOperationSeed>($I`SyncOperationSeed`)(
  {
    attemptCount: NonNegativeInt.annotateKey({
      description: "Number of push attempts already made for this operation.",
    }),
    idempotencyKey: S.NonEmptyString.annotateKey({
      description: "Unique key deduplicating replays of the same push operation.",
    }),
    inputContentDigest: S.Option(DocumentContentDigest).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Digest of the local content captured when the operation was queued; none for folders.",
    }),
    inputGeneration: NonNegativeInt.annotateKey({
      description: "Local generation counter captured when the operation was queued.",
    }),
    lastError: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Most recent attempt failure message; none while the operation is healthy.",
    }),
    operationType: DomainSyncOperation.SyncOperationType.annotateKey({
      description: "Kind of push performed against the DMS mirror.",
    }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider targeted by the push operation.",
    }),
    status: DomainSyncOperation.SyncOperationStatus.annotateKey({
      description: "Outbox lifecycle status of the operation.",
    }),
    syncItemId: Documents.SyncItemId.annotateKey({
      description: "Sync-tracking row this operation pushes for.",
    }),
    targetName: S.NonEmptyString.annotateKey({
      description: "Remote item name to apply with this operation.",
    }),
    targetParentRelPath: S.Option(VaultRelPath).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Vault-relative path of the intended remote parent folder; none targets the mirror root.",
    }),
    targetRelPath: VaultRelPath.annotateKey({
      description: "Intended vault-relative path of the item after this operation.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault produced the push operation.",
    }),
  },
  $I.annote("SyncOperationSeed", {
    description: "Creation input for one push-outbox operation, excluding BaseEntity bookkeeping fields.",
  })
) {}

/**
 * Persistence failure raised when an enqueue replays an existing idempotency key.
 *
 * **Example** (Construct conflict error)
 *
 * ```ts
 * import { SyncOperationRepositoryConflict } from "@beep/documents-use-cases/entities/SyncOperation/server"
 *
 * const error = SyncOperationRepositoryConflict.make({
 *   idempotencyKey: "sync-item-1:uploadFile:1",
 *   reason: "operation already enqueued for key"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncOperationRepositoryConflict extends TaggedErrorClass<SyncOperationRepositoryConflict>(
  $I`SyncOperationRepositoryConflict`
)(
  "SyncOperationRepositoryConflict",
  {
    idempotencyKey: S.NonEmptyString.annotateKey({
      description: "Idempotency key that already has an enqueued operation.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository conflict diagnostic.",
    }),
  },
  $I.annote("SyncOperationRepositoryConflict", {
    title: "SyncOperation repository conflict",
    description: "The SyncOperation repository rejected a duplicate idempotency key.",
  })
) {
  static readonly is = S.is(SyncOperationRepositoryConflict);
}

/**
 * Persistence failure raised when a SyncOperation row is absent.
 *
 * **Example** (Construct not-found error)
 *
 * ```ts
 * import * as Documents from "@beep/documents-domain/identity/Documents"
 * import { SyncOperationRepositoryNotFound } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import * as S from "effect/Schema"
 *
 * const error = SyncOperationRepositoryNotFound.make({
 *   syncOperationId: S.decodeUnknownSync(Documents.SyncOperationId)(1)
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncOperationRepositoryNotFound extends TaggedErrorClass<SyncOperationRepositoryNotFound>(
  $I`SyncOperationRepositoryNotFound`
)(
  "SyncOperationRepositoryNotFound",
  {
    syncOperationId: Documents.SyncOperationId.annotateKey({
      description: "SyncOperation identity that could not be found.",
    }),
  },
  $I.annote("SyncOperationRepositoryNotFound", {
    title: "SyncOperation repository not found",
    description: "The SyncOperation repository could not find the requested entity.",
  })
) {
  static readonly is = S.is(SyncOperationRepositoryNotFound);
}

/**
 * Persistence failure raised when the SyncOperation repository is unavailable.
 *
 * **Example** (Construct unavailable error)
 *
 * ```ts
 * import { SyncOperationRepositoryUnavailable } from "@beep/documents-use-cases/entities/SyncOperation/server"
 *
 * const error = SyncOperationRepositoryUnavailable.make({ reason: "database connection closed" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncOperationRepositoryUnavailable extends TaggedErrorClass<SyncOperationRepositoryUnavailable>(
  $I`SyncOperationRepositoryUnavailable`
)(
  "SyncOperationRepositoryUnavailable",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("SyncOperationRepositoryUnavailable", {
    title: "SyncOperation repository unavailable",
    description: "The SyncOperation repository could not serve the request.",
  })
) {
  static readonly is = S.is(SyncOperationRepositoryUnavailable);
}

/**
 * Listing input addressing the queued operations of one workspace mirror.
 *
 * **Example** (Build list-queued input)
 *
 * ```ts
 * import { ListQueuedSyncOperationsInput } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = ListQueuedSyncOperationsInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.provider)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ListQueuedSyncOperationsInput extends S.Class<ListQueuedSyncOperationsInput>(
  $I`ListQueuedSyncOperationsInput`
)(
  {
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose outbox is listed.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose outbox is listed.",
    }),
  },
  $I.annote("ListQueuedSyncOperationsInput", {
    description: "Listing input addressing the queued operations of one workspace mirror.",
  })
) {}

/**
 * Listing input addressing the queued operations of one sync-tracking row.
 *
 * **Example** (Build list-for-item input)
 *
 * ```ts
 * import * as Documents from "@beep/documents-domain/identity/Documents"
 * import { ListQueuedSyncOperationsForItemInput } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = ListQueuedSyncOperationsForItemInput.make({
 *   syncItemId: S.decodeUnknownSync(Documents.SyncItemId)(1),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.syncItemId)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ListQueuedSyncOperationsForItemInput extends S.Class<ListQueuedSyncOperationsForItemInput>(
  $I`ListQueuedSyncOperationsForItemInput`
)(
  {
    syncItemId: Documents.SyncItemId.annotateKey({
      description: "Sync-tracking row whose queued operations are listed.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose outbox is listed.",
    }),
  },
  $I.annote("ListQueuedSyncOperationsForItemInput", {
    description: "Listing input addressing the queued operations of one sync-tracking row.",
  })
) {}

/**
 * Recovery input addressing the leased operations of one workspace mirror.
 *
 * **Example** (Build requeue-leased input)
 *
 * ```ts
 * import { RequeueLeasedSyncOperationsInput } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = RequeueLeasedSyncOperationsInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.provider)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class RequeueLeasedSyncOperationsInput extends S.Class<RequeueLeasedSyncOperationsInput>(
  $I`RequeueLeasedSyncOperationsInput`
)(
  {
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose leased operations are requeued.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose leased operations are requeued.",
    }),
  },
  $I.annote("RequeueLeasedSyncOperationsInput", {
    description: "Recovery input addressing the leased operations of one workspace mirror.",
  })
) {}

/**
 * Listing input addressing the operations of one workspace mirror by status.
 *
 * **Example** (Build list-by-status input)
 *
 * ```ts
 * import { ListSyncOperationsByStatusInput } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = ListSyncOperationsByStatusInput.make({
 *   provider: "box",
 *   status: "failed",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.status)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ListSyncOperationsByStatusInput extends S.Class<ListSyncOperationsByStatusInput>(
  $I`ListSyncOperationsByStatusInput`
)(
  {
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose outbox is listed.",
    }),
    status: DomainSyncOperation.SyncOperationStatus.annotateKey({
      description: "Outbox lifecycle status selecting the listed operations.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose outbox is listed.",
    }),
  },
  $I.annote("ListSyncOperationsByStatusInput", {
    description: "Listing input addressing the operations of one workspace mirror by status.",
  })
) {}

/**
 * SyncOperation repository port consumed by the vault sync engine.
 *
 * **Details**
 *
 * `enqueue` fails with {@link SyncOperationRepositoryConflict} when the seed's
 * `idempotencyKey` is already enqueued. `listQueued` and `listQueuedForItem`
 * return queued operations in FIFO order (ascending entity id). `requeueLeased`
 * is boot recovery: it flips every `leased` operation of the workspace mirror
 * back to `queued` and returns the number of operations it requeued.
 *
 * **Example** (Stub repository implementation)
 *
 * ```ts
 * import {
 *   ListQueuedSyncOperationsInput,
 *   SyncOperationRepositoryUnavailable,
 *   type SyncOperationRepositoryShape
 * } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const repository: SyncOperationRepositoryShape = {
 *   enqueue: () => Effect.fail(SyncOperationRepositoryUnavailable.make({ reason: "stub repository" })),
 *   listByStatus: () => Effect.succeed([]),
 *   listQueued: () => Effect.succeed([]),
 *   listQueuedForItem: () => Effect.succeed([]),
 *   requeueLeased: () => Effect.succeed(0),
 *   update: (operation) => Effect.succeed(operation)
 * }
 * const input = ListQueuedSyncOperationsInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 *
 * Effect.runPromise(repository.listQueued(input)).then((operations) => console.log(operations.length))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface SyncOperationRepositoryShape {
  readonly enqueue: (
    seed: SyncOperationSeed
  ) => Effect.Effect<
    DomainSyncOperation.SyncOperation,
    SyncOperationRepositoryConflict | SyncOperationRepositoryUnavailable
  >;
  readonly listByStatus: (
    input: ListSyncOperationsByStatusInput
  ) => Effect.Effect<ReadonlyArray<DomainSyncOperation.SyncOperation>, SyncOperationRepositoryUnavailable>;
  readonly listQueued: (
    input: ListQueuedSyncOperationsInput
  ) => Effect.Effect<ReadonlyArray<DomainSyncOperation.SyncOperation>, SyncOperationRepositoryUnavailable>;
  readonly listQueuedForItem: (
    input: ListQueuedSyncOperationsForItemInput
  ) => Effect.Effect<ReadonlyArray<DomainSyncOperation.SyncOperation>, SyncOperationRepositoryUnavailable>;
  readonly requeueLeased: (
    input: RequeueLeasedSyncOperationsInput
  ) => Effect.Effect<number, SyncOperationRepositoryUnavailable>;
  readonly update: (
    operation: DomainSyncOperation.SyncOperation
  ) => Effect.Effect<
    DomainSyncOperation.SyncOperation,
    SyncOperationRepositoryNotFound | SyncOperationRepositoryUnavailable
  >;
}

/**
 * Context tag for the SyncOperation repository port.
 *
 * **Example** (Provide repository context)
 *
 * ```ts
 * import {
 *   SyncOperationRepository,
 *   SyncOperationRepositoryUnavailable,
 *   type SyncOperationRepositoryShape
 * } from "@beep/documents-use-cases/entities/SyncOperation/server"
 * import { Effect } from "effect"
 *
 * const repository: SyncOperationRepositoryShape = {
 *   enqueue: () => Effect.fail(SyncOperationRepositoryUnavailable.make({ reason: "stub repository" })),
 *   listByStatus: () => Effect.succeed([]),
 *   listQueued: () => Effect.succeed([]),
 *   listQueuedForItem: () => Effect.succeed([]),
 *   requeueLeased: () => Effect.succeed(0),
 *   update: (operation) => Effect.succeed(operation)
 * }
 *
 * const program = Effect.gen(function* () {
 *   return (yield* SyncOperationRepository) === repository
 * }).pipe(Effect.provideService(SyncOperationRepository, repository))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncOperationRepository extends Context.Service<SyncOperationRepository, SyncOperationRepositoryShape>()(
  $I`SyncOperationRepository`
) {}
