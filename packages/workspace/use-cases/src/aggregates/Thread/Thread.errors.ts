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

const ThreadStoreNotFoundFields = {
  threadId: WorkspaceIdentity.ThreadId.annotateKey({
    description: "Thread id requested by the failed operation.",
  }),
} satisfies S.Struct.Fields;
const sameThreadStoreNotFoundFields = S.toEquivalence(S.TaggedStruct("ThreadStoreNotFound", ThreadStoreNotFoundFields));
const sameThreadStoreNotFound = (self: ThreadStoreNotFound, that: ThreadStoreNotFound): boolean =>
  sameThreadStoreNotFoundFields(self, that);

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
  ThreadStoreNotFoundFields,
  $I.annoteClass<
    S.declare<ThreadStoreNotFound>,
    readonly [S.TaggedStruct<"ThreadStoreNotFound", typeof ThreadStoreNotFoundFields>]
  >("ThreadStoreNotFound", {
    title: "Thread store not found",
    description: "The ThreadStore could not find the requested thread.",

    toEquivalence: () => sameThreadStoreNotFound,
  })
) {}

const ThreadStoreConflictFields = {
  threadId: WorkspaceIdentity.ThreadId.annotateKey({
    description: "Thread id involved in the conflicting write.",
  }),
  reason: ThreadStoreErrorReason.annotateKey({
    description: "Non-empty explanation of the rejected write.",
  }),
} satisfies S.Struct.Fields;
const sameThreadStoreConflictFields = S.toEquivalence(S.TaggedStruct("ThreadStoreConflict", ThreadStoreConflictFields));
const sameThreadStoreConflict = (self: ThreadStoreConflict, that: ThreadStoreConflict): boolean =>
  sameThreadStoreConflictFields(self, that);

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
  ThreadStoreConflictFields,
  $I.annoteClass<
    S.declare<ThreadStoreConflict>,
    readonly [S.TaggedStruct<"ThreadStoreConflict", typeof ThreadStoreConflictFields>]
  >("ThreadStoreConflict", {
    title: "Thread store conflict",
    description: "The ThreadStore rejected a conflicting write.",

    toEquivalence: () => sameThreadStoreConflict,
  })
) {}

const ThreadStoreUnavailableFields = {
  reason: ThreadStoreErrorReason.annotateKey({
    description: "Non-empty explanation of the unavailable persistence operation.",
  }),
} satisfies S.Struct.Fields;
const sameThreadStoreUnavailableFields = S.toEquivalence(
  S.TaggedStruct("ThreadStoreUnavailable", ThreadStoreUnavailableFields)
);
const sameThreadStoreUnavailable = (self: ThreadStoreUnavailable, that: ThreadStoreUnavailable): boolean =>
  sameThreadStoreUnavailableFields(self, that);

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
  ThreadStoreUnavailableFields,
  $I.annoteClass<
    S.declare<ThreadStoreUnavailable>,
    readonly [S.TaggedStruct<"ThreadStoreUnavailable", typeof ThreadStoreUnavailableFields>]
  >("ThreadStoreUnavailable", {
    title: "Thread store unavailable",
    description: "The ThreadStore could not serve the request.",

    toEquivalence: () => sameThreadStoreUnavailable,
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
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ThreadStoreError", {
    description: "ThreadStore port failure.",
  }),
  SchemaUtils.withCodecStatics
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
