/**
 * SyncCursor repository port.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import { DmsProvider } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";
import type * as O from "effect/Option";

const $I = $DocumentsUseCasesId.create("entities/SyncCursor/SyncCursor.repository");

/**
 * Upsert input for one remote-event stream cursor, excluding ProductEntity audit fields.
 *
 * **Example** (Construct cursor seed)
 *
 * ```ts
 * import { SyncCursorSeed } from "@beep/documents-use-cases/entities/SyncCursor/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const seed = SyncCursorSeed.make({
 *   provider: "box",
 *   status: "active",
 *   streamPosition: "now",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(seed.streamPosition)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncCursorSeed extends S.Class<SyncCursorSeed>($I`SyncCursorSeed`)(
  {
    lastError: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Most recent stream-read failure message; none while the cursor is healthy.",
    }),
    lastEventId: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Identifier of the last remote event processed; none before the first event.",
    }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose event stream this cursor tracks.",
    }),
    status: DomainSyncCursor.SyncCursorStatus.annotateKey({
      description: "Health status of the cursor.",
    }),
    streamPosition: S.NonEmptyString.annotateKey({
      description: "Opaque provider stream position to resume reading from.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose mirror this cursor watches for remote drift.",
    }),
  },
  $I.annote("SyncCursorSeed", {
    description: "Upsert input for one remote-event stream cursor, excluding ProductEntity audit fields.",
  })
) {}

/**
 * Persistence failure raised when the SyncCursor repository is unavailable.
 *
 * **Example** (Construct unavailable error)
 *
 * ```ts
 * import { SyncCursorRepositoryUnavailable } from "@beep/documents-use-cases/entities/SyncCursor/server"
 *
 * const error = SyncCursorRepositoryUnavailable.make({ reason: "database connection closed" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncCursorRepositoryUnavailable extends S.TaggedError<SyncCursorRepositoryUnavailable>(
  $I`SyncCursorRepositoryUnavailable`
)(
  "SyncCursorRepositoryUnavailable",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("SyncCursorRepositoryUnavailable", {
    title: "SyncCursor repository unavailable",
    description: "The SyncCursor repository could not serve the request.",
  })
) {
  static readonly is = S.is(SyncCursorRepositoryUnavailable);
}

/**
 * Lookup input addressing the cursor of one workspace mirror.
 *
 * **Example** (Construct find input)
 *
 * ```ts
 * import { FindSyncCursorInput } from "@beep/documents-use-cases/entities/SyncCursor/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = FindSyncCursorInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.provider)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class FindSyncCursorInput extends S.Class<FindSyncCursorInput>($I`FindSyncCursorInput`)(
  {
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose event stream the cursor tracks.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose mirror the cursor watches.",
    }),
  },
  $I.annote("FindSyncCursorInput", {
    description: "Lookup input addressing the cursor of one workspace mirror.",
  })
) {}

/**
 * SyncCursor repository port consumed by the vault sync engine.
 *
 * **Details**
 *
 * At most one cursor row exists per `workspaceId` and `provider` pair: `upsert`
 * inserts the row when absent and replaces its seed fields when present.
 *
 * **Example** (Stub repository port)
 *
 * ```ts
 * import {
 *   FindSyncCursorInput,
 *   type SyncCursorRepositoryShape,
 *   SyncCursorRepositoryUnavailable
 * } from "@beep/documents-use-cases/entities/SyncCursor/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const repository: SyncCursorRepositoryShape = {
 *   find: () => Effect.succeed(O.none()),
 *   upsert: () => Effect.fail(SyncCursorRepositoryUnavailable.make({ reason: "stub repository" }))
 * }
 * const input = FindSyncCursorInput.make({
 *   provider: "box",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 *
 * Effect.runPromise(repository.find(input)).then((cursor) => console.log(O.isNone(cursor)))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface SyncCursorRepositoryShape {
  readonly find: (
    input: FindSyncCursorInput
  ) => Effect.Effect<O.Option<DomainSyncCursor.SyncCursor>, SyncCursorRepositoryUnavailable>;
  readonly upsert: (
    seed: SyncCursorSeed
  ) => Effect.Effect<DomainSyncCursor.SyncCursor, SyncCursorRepositoryUnavailable>;
}

/**
 * Context tag for the SyncCursor repository port.
 *
 * **Example** (Provide repository service)
 *
 * ```ts
 * import {
 *   SyncCursorRepository,
 *   SyncCursorRepositoryUnavailable,
 *   type SyncCursorRepositoryShape
 * } from "@beep/documents-use-cases/entities/SyncCursor/server"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const repository: SyncCursorRepositoryShape = {
 *   find: () => Effect.succeed(O.none()),
 *   upsert: () => Effect.fail(SyncCursorRepositoryUnavailable.make({ reason: "stub repository" }))
 * }
 *
 * const program = Effect.gen(function* () {
 *   return (yield* SyncCursorRepository) === repository
 * }).pipe(Effect.provideService(SyncCursorRepository, repository))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SyncCursorRepository extends Context.Service<SyncCursorRepository, SyncCursorRepositoryShape>()(
  $I`SyncCursorRepository`
) {}
