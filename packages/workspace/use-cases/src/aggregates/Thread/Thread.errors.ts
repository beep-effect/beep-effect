/**
 * ThreadStore server-only port errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $WorkspaceUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceUseCasesId.create("aggregates/Thread/Thread.errors");

const ThreadStoreErrorReason = S.NonEmptyString.pipe(
  $I.annoteSchema("ThreadStoreErrorReason", {
    description: "Non-empty diagnostic reason attached to ThreadStore persistence failures.",
  })
);

/**
 * Persistence failure raised when a Thread row is absent.
 *
 * **Example** (Construct not-found error)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { ThreadStoreNotFound } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * const error = Effect.runSync(
 *   Effect.gen(function* () {
 *     const threadId = yield* S.decodeUnknownEffect(Workspace.ThreadId)(42)
 *     return new ThreadStoreNotFound({ threadId })
 *   })
 * )
 * console.log(error._tag) // "ThreadStoreNotFound"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ThreadStoreNotFound extends S.TaggedError<ThreadStoreNotFound>($I`ThreadStoreNotFound`)(
  "ThreadStoreNotFound",
  {
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread id requested by the failed operation.",
    }),
  },
  $I.annoteError<ThreadStoreNotFound>("ThreadStoreNotFound", {
    title: "Thread store not found",
    description: "The ThreadStore could not find the requested thread.",
  })
) {}

/**
 * Persistence failure raised when a ThreadStore write conflicts.
 *
 * **Example** (Construct conflict error)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { ThreadStoreConflict } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * const error = Effect.runSync(
 *   Effect.gen(function* () {
 *     const threadId = yield* S.decodeUnknownEffect(Workspace.ThreadId)(42)
 *     return new ThreadStoreConflict({ threadId, reason: "stale title" })
 *   })
 * )
 * console.log(error.reason) // "stale title"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ThreadStoreConflict extends S.TaggedError<ThreadStoreConflict>($I`ThreadStoreConflict`)(
  "ThreadStoreConflict",
  {
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread id involved in the conflicting write.",
    }),
    reason: ThreadStoreErrorReason.annotateKey({
      description: "Non-empty explanation of the rejected write.",
    }),
  },
  $I.annoteError<ThreadStoreConflict>("ThreadStoreConflict", {
    title: "Thread store conflict",
    description: "The ThreadStore rejected a conflicting write.",
  })
) {}

/**
 * Persistence failure raised when the ThreadStore is unavailable.
 *
 * **Example** (Construct unavailable error)
 *
 * ```ts
 * import { ThreadStoreUnavailable } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * const error = new ThreadStoreUnavailable({ reason: "database unavailable" })
 * console.log(error._tag) // "ThreadStoreUnavailable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ThreadStoreUnavailable extends S.TaggedError<ThreadStoreUnavailable>($I`ThreadStoreUnavailable`)(
  "ThreadStoreUnavailable",
  {
    reason: ThreadStoreErrorReason.annotateKey({
      description: "Non-empty explanation of the unavailable persistence operation.",
    }),
  },
  $I.annoteError<ThreadStoreUnavailable>("ThreadStoreUnavailable", {
    title: "Thread store unavailable",
    description: "The ThreadStore could not serve the request.",
  })
) {}

/**
 * ThreadStore port failure.
 *
 * **Example** (Test ThreadStoreError guard)
 *
 * ```ts
 * import { ThreadStoreError, ThreadStoreUnavailable } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * const error = new ThreadStoreUnavailable({ reason: "database unavailable" })
 * console.log(ThreadStoreError.is(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ThreadStoreError = S.Union([ThreadStoreNotFound, ThreadStoreConflict, ThreadStoreUnavailable]).pipe(
  $I.annoteSchema("ThreadStoreError", {
    description: "ThreadStore port failure.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Companion type for {@link ThreadStoreError}
 *
 * **Example** (Enumerate error tag values)
 *
 * ```ts
 * import type { ThreadStoreError } from "@beep/workspace-use-cases/aggregates/Thread/server"
 *
 * type ErrorTag = ThreadStoreError["_tag"]
 *
 * const handledTags: ReadonlyArray<ErrorTag> = [
 *   "ThreadStoreNotFound",
 *   "ThreadStoreConflict",
 *   "ThreadStoreUnavailable",
 * ]
 * console.log(handledTags.includes("ThreadStoreConflict")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type ThreadStoreError = typeof ThreadStoreError.Type;
