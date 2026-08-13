/**
 * SyncConflict repository port.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import { DmsProvider, RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils, UnknownRecord } from "@beep/schema";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";

const $I = $DocumentsUseCasesId.create("entities/SyncConflict/SyncConflict.repository");

/**
 * Creation input for one remote-drift record, excluding BaseEntity bookkeeping fields.
 *
 * **Example** (Make remote-edit seed)
 *
 * ```ts
 * import { SyncConflictSeed } from "@beep/documents-use-cases/entities/SyncConflict/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const seed = SyncConflictSeed.make({
 *   conflictKind: "remoteEdit",
 *   provider: "box",
 *   remotePayload: { eventType: "ITEM_MODIFY" },
 *   resolutionStatus: "open",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(seed.conflictKind)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncConflictSeed extends S.Class<SyncConflictSeed>($I`SyncConflictSeed`)(
  {
    conflictKind: DomainSyncConflict.SyncConflictKind.annotateKey({
      description: "Kind of remote drift detected for the mirrored item.",
    }),
    localRelPath: S.Option(VaultRelPath).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Vault-relative path of the affected local item; none when unmapped locally.",
    }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose event stream reported the drift.",
    }),
    remoteEventId: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider event identifier that surfaced the drift; none for synthetic detections.",
    }),
    remoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the drifted remote item; none when the event omits it.",
    }),
    remotePayload: UnknownRecord.annotateKey({
      description: "Remote event snapshot preserved verbatim for review.",
    }),
    resolutionStatus: DomainSyncConflict.SyncConflictResolution.annotateKey({
      description: "Review status of the drift record.",
    }),
    syncItemId: S.Option(Documents.SyncItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Sync-tracking row the drift maps to; none when the remote item is unknown locally.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose mirror observed the remote drift.",
    }),
  },
  $I.annote("SyncConflictSeed", {
    description: "Creation input for one remote-drift record, excluding BaseEntity bookkeeping fields.",
  })
) {}

/**
 * Persistence failure raised when a SyncConflict row is absent.
 *
 * **Example** (Construct not-found error)
 *
 * ```ts
 * import * as Documents from "@beep/shared-domain/identity/Documents"
 * import { SyncConflictRepositoryNotFound } from "@beep/documents-use-cases/entities/SyncConflict/server"
 * import * as S from "effect/Schema"
 *
 * const error = SyncConflictRepositoryNotFound.make({
 *   conflictId: S.decodeUnknownSync(Documents.SyncConflictId)(1)
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncConflictRepositoryNotFound extends S.TaggedError<SyncConflictRepositoryNotFound>(
  $I`SyncConflictRepositoryNotFound`
)(
  "SyncConflictRepositoryNotFound",
  {
    conflictId: Documents.SyncConflictId.annotateKey({
      description: "SyncConflict identity that could not be found.",
    }),
  },
  $I.annote("SyncConflictRepositoryNotFound", {
    title: "SyncConflict repository not found",
    description: "The SyncConflict repository could not find the requested entity.",
  })
) {
  static readonly is = S.is(SyncConflictRepositoryNotFound);
}

/**
 * Persistence failure raised when the SyncConflict repository is unavailable.
 *
 * **Example** (Construct unavailable error)
 *
 * ```ts
 * import { SyncConflictRepositoryUnavailable } from "@beep/documents-use-cases/entities/SyncConflict/server"
 *
 * const error = SyncConflictRepositoryUnavailable.make({ reason: "database connection closed" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncConflictRepositoryUnavailable extends S.TaggedError<SyncConflictRepositoryUnavailable>(
  $I`SyncConflictRepositoryUnavailable`
)(
  "SyncConflictRepositoryUnavailable",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("SyncConflictRepositoryUnavailable", {
    title: "SyncConflict repository unavailable",
    description: "The SyncConflict repository could not serve the request.",
  })
) {
  static readonly is = S.is(SyncConflictRepositoryUnavailable);
}

/**
 * Listing input addressing the open drift records of one workspace mirror.
 *
 * **Example** (Build list-open input)
 *
 * ```ts
 * import { ListOpenSyncConflictsInput } from "@beep/documents-use-cases/entities/SyncConflict/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = ListOpenSyncConflictsInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.provider)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ListOpenSyncConflictsInput extends S.Class<ListOpenSyncConflictsInput>($I`ListOpenSyncConflictsInput`)(
  {
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose drift records are listed.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose drift records are listed.",
    }),
  },
  $I.annote("ListOpenSyncConflictsInput", {
    description: "Listing input addressing the open drift records of one workspace mirror.",
  })
) {}

/**
 * Review input addressing one drift record by identity.
 *
 * **Example** (Build mark-reviewed input)
 *
 * ```ts
 * import * as Documents from "@beep/shared-domain/identity/Documents"
 * import { MarkSyncConflictReviewedInput } from "@beep/documents-use-cases/entities/SyncConflict/server"
 * import * as S from "effect/Schema"
 *
 * const input = MarkSyncConflictReviewedInput.make({
 *   conflictId: S.decodeUnknownSync(Documents.SyncConflictId)(1)
 * })
 * console.log(input.conflictId)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class MarkSyncConflictReviewedInput extends S.Class<MarkSyncConflictReviewedInput>(
  $I`MarkSyncConflictReviewedInput`
)(
  {
    conflictId: Documents.SyncConflictId.annotateKey({
      description: "Drift record to mark as reviewed.",
    }),
  },
  $I.annote("MarkSyncConflictReviewedInput", {
    description: "Review input addressing one drift record by identity.",
  })
) {}

/**
 * SyncConflict repository port consumed by the vault sync engine.
 *
 * **Details**
 *
 * `record` deduplicates by provider event: when the seed's `remoteEventId` is
 * `Some` and a row already exists for the same `provider` and `remoteEventId`,
 * that existing row is returned unchanged instead of inserting a duplicate.
 * `markReviewed` flips the record's `resolutionStatus` to `reviewed`.
 *
 * **Example** (Stub repository shape)
 *
 * ```ts
 * import {
 *   ListOpenSyncConflictsInput,
 *   SyncConflictRepositoryUnavailable,
 *   type SyncConflictRepositoryShape
 * } from "@beep/documents-use-cases/entities/SyncConflict/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const unavailable = () => Effect.fail(SyncConflictRepositoryUnavailable.make({ reason: "stub repository" }))
 * const repository: SyncConflictRepositoryShape = {
 *   listOpen: () => Effect.succeed([]),
 *   markReviewed: unavailable,
 *   record: unavailable
 * }
 * const input = ListOpenSyncConflictsInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 *
 * Effect.runPromise(repository.listOpen(input)).then((conflicts) => console.log(conflicts.length))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface SyncConflictRepositoryShape {
  readonly listOpen: (
    input: ListOpenSyncConflictsInput
  ) => Effect.Effect<ReadonlyArray<DomainSyncConflict.SyncConflict>, SyncConflictRepositoryUnavailable>;
  readonly markReviewed: (
    input: MarkSyncConflictReviewedInput
  ) => Effect.Effect<
    DomainSyncConflict.SyncConflict,
    SyncConflictRepositoryNotFound | SyncConflictRepositoryUnavailable
  >;
  readonly record: (
    seed: SyncConflictSeed
  ) => Effect.Effect<DomainSyncConflict.SyncConflict, SyncConflictRepositoryUnavailable>;
}

/**
 * Context tag for the SyncConflict repository port.
 *
 * **Example** (Provide repository service)
 *
 * ```ts
 * import {
 *   SyncConflictRepository,
 *   SyncConflictRepositoryUnavailable,
 *   type SyncConflictRepositoryShape
 * } from "@beep/documents-use-cases/entities/SyncConflict/server"
 * import { Effect } from "effect"
 *
 * const unavailable = () => Effect.fail(SyncConflictRepositoryUnavailable.make({ reason: "stub repository" }))
 * const repository: SyncConflictRepositoryShape = {
 *   listOpen: () => Effect.succeed([]),
 *   markReviewed: unavailable,
 *   record: unavailable
 * }
 *
 * const program = Effect.gen(function* () {
 *   return (yield* SyncConflictRepository) === repository
 * }).pipe(Effect.provideService(SyncConflictRepository, repository))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncConflictRepository extends Context.Service<SyncConflictRepository, SyncConflictRepositoryShape>()(
  $I`SyncConflictRepository`
) {}
