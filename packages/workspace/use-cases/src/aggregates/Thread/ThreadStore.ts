/**
 * Cross-concept ThreadStore port.
 *
 * The ThreadStore coordinates the Thread, Turn, and Message concepts behind a
 * single persistence boundary. It is allowed under the std-01 cross-concept
 * escape hatch because a single appended turn must atomically write a Turn and
 * its first Message.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { $WorkspaceUseCasesId } from "@beep/identity/packages";
import { Document } from "@beep/md/Md.model";
import { SchemaUtils } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Message, MessageRole } from "@beep/workspace-domain/entities/Message";
import { Turn } from "@beep/workspace-domain/entities/Turn";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Thread } from "@beep/workspace-domain/entities/Thread";
import type { Effect } from "effect";
import type { ThreadStoreConflict, ThreadStoreNotFound, ThreadStoreUnavailable } from "./Thread.errors.ts";
import type { ThreadTimeline } from "./ThreadTimeline.ts";

const $I = $WorkspaceUseCasesId.create("aggregates/Thread/ThreadStore");

/**
 * Input accepted by {@link ThreadStoreShape.createThread}.
 *
 * **Example** (Make create-thread input)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { CreateThreadInput } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * const input = Effect.runSync(
 *   Effect.gen(function* () {
 *     const workspaceId = yield* S.decodeUnknownEffect(Workspace.WorkspaceId)(7)
 *     return CreateThreadInput.make({ title: "Matter intake", workspaceId })
 *   })
 * )
 * console.log(input.title) // "Matter intake"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class CreateThreadInput extends S.Class<CreateThreadInput>($I`CreateThreadInput`)(
  {
    title: S.NonEmptyString.annotateKey({
      description: "Initial non-empty title for the thread.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace that owns the new thread.",
    }),
  },
  $I.annote("CreateThreadInput", {
    description: "Input accepted by {@link ThreadStoreShape.createThread}.",
  })
) {}

/**
 * Input accepted by {@link ThreadStoreShape.appendTurn}.
 *
 * **Example** (Make append-turn input)
 *
 * ```ts
 * import { Document } from "@beep/md/Md.model"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as O from "effect/Option"
 * import { AppendTurnInput } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * const input = Effect.runSync(
 *   Effect.gen(function* () {
 *     const threadId = yield* S.decodeUnknownEffect(Workspace.ThreadId)(42)
 *     return AppendTurnInput.make({
 *       content: Document.make({ children: [] }),
 *       role: "user",
 *       threadId,
 *     })
 *   })
 * )
 * console.log(O.isNone(input.parentTurnId)) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class AppendTurnInput extends S.Class<AppendTurnInput>($I`AppendTurnInput`)(
  {
    content: Document.annotateKey({
      description: "Message content appended as the turn's first visible message.",
    }),
    parentTurnId: S.Option(WorkspaceIdentity.TurnId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional parent turn when appending a branch/edit.",
    }),
    role: MessageRole.annotateKey({
      description: "Role assigned to the appended message.",
    }),
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread that receives the appended turn.",
    }),
  },
  $I.annote("AppendTurnInput", {
    description: "Input for {@link ThreadStoreShape.appendTurn}.",
  })
) {}

/**
 * Result returned by {@link ThreadStoreShape.appendTurn}.
 *
 * **Example** (List result field keys)
 *
 * ```ts
 * import type { AppendTurnResult } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * type ResultField = keyof AppendTurnResult
 *
 * const persistedFields: ReadonlyArray<ResultField> = ["message", "turn"]
 * console.log(persistedFields.join(",")) // "message,turn"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class AppendTurnResult extends S.Class<AppendTurnResult>($I`AppendTurnResult`)(
  {
    message: Message.annotateKey({
      description: "Persisted message created for the appended turn.",
    }),
    turn: Turn.annotateKey({
      description: "Persisted turn created by the append operation.",
    }),
  },
  $I.annote("AppendTurnResult", {
    description: "Result returned by {@link ThreadStoreShape.appendTurn}.",
  })
) {}

/**
 * Input accepted by {@link ThreadStoreShape.setTitleIfEmpty}.
 *
 * **Example** (Make set-title input)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { SetThreadTitleIfEmptyInput } from "@beep/workspace-use-cases/aggregates/Thread/server"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const threadId = yield* S.decodeUnknownEffect(Workspace.ThreadId)(1)
 *   return SetThreadTitleIfEmptyInput.make({
 *     emptyTitle: "New thread",
 *     threadId,
 *     title: "Matter intake",
 *   })
 * })
 * const input = Effect.runSync(program)
 * console.log(input.title) // "Matter intake"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class SetThreadTitleIfEmptyInput extends S.Class<SetThreadTitleIfEmptyInput>($I`SetThreadTitleIfEmptyInput`)(
  {
    emptyTitle: S.NonEmptyString.annotateKey({
      description: "Expected current title that still represents the empty/new-thread placeholder.",
    }),
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread whose placeholder title may be replaced.",
    }),
    title: S.NonEmptyString.annotateKey({
      description: "Replacement title derived from user-visible content.",
    }),
  },
  $I.annote("SetThreadTitleIfEmptyInput", {
    description: "Compare-and-set title update accepted by the ThreadStore when a thread still has its empty title.",
  })
) {}

/**
 * Cross-concept ThreadStore contract.
 *
 * **Example** (List store write operations)
 *
 * ```ts
 * import type { ThreadStoreShape } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * type ThreadStoreOperation = keyof ThreadStoreShape
 *
 * const writeOperations: ReadonlyArray<ThreadStoreOperation> = [
 *   "appendTurn",
 *   "createThread",
 *   "setTitleIfEmpty",
 * ]
 * console.log(writeOperations.includes("appendTurn")) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface ThreadStoreShape {
  readonly appendTurn: (
    input: AppendTurnInput
  ) => Effect.Effect<AppendTurnResult, ThreadStoreNotFound | ThreadStoreConflict | ThreadStoreUnavailable>;
  readonly createThread: (
    input: CreateThreadInput
  ) => Effect.Effect<Thread, ThreadStoreConflict | ThreadStoreUnavailable>;
  readonly listThreads: (
    workspaceId: WorkspaceIdentity.WorkspaceId
  ) => Effect.Effect<ReadonlyArray<Thread>, ThreadStoreUnavailable>;
  readonly setTitleIfEmpty: (
    input: SetThreadTitleIfEmptyInput
  ) => Effect.Effect<void, ThreadStoreNotFound | ThreadStoreUnavailable>;
  readonly timeline: (
    threadId: WorkspaceIdentity.ThreadId
  ) => Effect.Effect<ThreadTimeline, ThreadStoreNotFound | ThreadStoreUnavailable>;
}

/**
 * Cross-concept ThreadStore service.
 *
 * **Example** (Provide ThreadStore service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ThreadStore } from "@beep/workspace-use-cases/aggregates/Thread/server"
 * import type { ThreadStoreShape } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * const unsupported = () => Effect.die("not implemented")
 * const store: ThreadStoreShape = {
 *   appendTurn: unsupported,
 *   createThread: unsupported,
 *   listThreads: unsupported,
 *   setTitleIfEmpty: unsupported,
 *   timeline: unsupported,
 * }
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* ThreadStore
 *   return service === store
 * }).pipe(Effect.provideService(ThreadStore, store))
 * console.log(Effect.runSync(program)) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ThreadStore extends Context.Service<ThreadStore, ThreadStoreShape>()($I`ThreadStore`) {}
