/**
 * ThreadStore repository construction schemas.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { $WorkspaceServerId } from "@beep/identity";
import { Document } from "@beep/md/Md.model";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Message, MessageRole } from "@beep/workspace-domain/entities/Message";
import { Thread } from "@beep/workspace-domain/entities/Thread";
import { Turn } from "@beep/workspace-domain/entities/Turn";
import { Effect, HashMap } from "effect";
import * as S from "effect/Schema";

const $I = $WorkspaceServerId.create("aggregates/Thread/ThreadStore.repo.internal");

/**
 * Local input for creating a Thread entity inside the repository.
 *
 * **Example** (Create Thread entity input)
 *
 * ```ts
 * import { ThreadStoreRepoTestSchemas } from "@beep/workspace-server/test"
 * import { PosInt } from "@beep/schema/Int"
 *
 * const { ThreadEntityInput } = ThreadStoreRepoTestSchemas
 * const input = ThreadEntityInput.make({
 *   id: PosInt.make(1),
 *   title: "Matter intake",
 *   workspaceId: PosInt.make(2),
 * })
 * console.log(input.title)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ThreadEntityInput extends S.Class<ThreadEntityInput>($I`ThreadEntityInput`)(
  {
    id: PosInt.annotateKey({
      description: "Positive generated Thread entity id.",
    }),
    title: S.NonEmptyString.annotateKey({
      description: "Non-empty title for the created Thread entity.",
    }),
    workspaceId: PosInt.annotateKey({
      description: "Positive workspace id owning the Thread entity.",
    }),
  },
  $I.annote("ThreadEntityInput", {
    description: "Input for creating a Thread entity.",
  })
) {}

/**
 * Local input for creating a Turn entity inside the repository.
 *
 * **Example** (Create Turn entity input)
 *
 * ```ts
 * import { ThreadStoreRepoTestSchemas } from "@beep/workspace-server/test"
 * import { NonNegativeInt, PosInt } from "@beep/schema/Int"
 *
 * const { TurnEntityInput } = ThreadStoreRepoTestSchemas
 * const input = TurnEntityInput.make({
 *   id: PosInt.make(1),
 *   messageId: PosInt.make(2),
 *   parentTurnId: null,
 *   threadId: PosInt.make(1),
 *   turnIndex: NonNegativeInt.make(0),
 * })
 * console.log(input.turnIndex)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class TurnEntityInput extends S.Class<TurnEntityInput>($I`TurnEntityInput`)(
  {
    id: PosInt.annotateKey({
      description: "Positive generated Turn entity id.",
    }),
    messageId: PosInt.annotateKey({
      description: "Positive generated Message id referenced by the Turn item.",
    }),
    parentTurnId: S.NullOr(PosInt).annotateKey({
      description: "Optional positive parent Turn id encoded as null at the row boundary.",
    }),
    threadId: PosInt.annotateKey({
      description: "Positive Thread id that owns this Turn.",
    }),
    turnIndex: NonNegativeInt.annotateKey({
      description: "Zero-based non-negative order of this Turn within its Thread.",
    }),
  },
  $I.annote("TurnEntityInput", {
    description: "Input for creating a Turn entity.",
  })
) {}

/**
 * Local input for creating a Message entity inside the repository.
 *
 * **Example** (Create Message entity input)
 *
 * ```ts
 * import { Document } from "@beep/md/Md.model"
 * import { ThreadStoreRepoTestSchemas } from "@beep/workspace-server/test"
 * import { PosInt } from "@beep/schema/Int"
 *
 * const { MessageEntityInput } = ThreadStoreRepoTestSchemas
 * const input = MessageEntityInput.make({
 *   content: Document.make({ children: [] }),
 *   id: PosInt.make(2),
 *   role: "assistant",
 *   threadId: PosInt.make(1),
 *   turnId: PosInt.make(1),
 * })
 * console.log(input.role)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class MessageEntityInput extends S.Class<MessageEntityInput>($I`MessageEntityInput`)(
  {
    content: Document.annotateKey({
      description: "Md document content persisted as the Message body.",
    }),
    id: PosInt.annotateKey({
      description: "Positive generated Message entity id.",
    }),
    role: MessageRole.annotateKey({
      description: "Author role assigned to the Message.",
    }),
    threadId: PosInt.annotateKey({
      description: "Positive Thread id that owns this Message.",
    }),
    turnId: PosInt.annotateKey({
      description: "Positive Turn id linked to this Message.",
    }),
  },
  $I.annote("MessageEntityInput", {
    description: "Input for creating a Message entity.",
  })
) {}

/**
 * In-memory repository state with schema-owned empty defaults.
 *
 * **Example** (Create empty repository state)
 *
 * ```ts
 * import { ThreadStoreRepoTestSchemas } from "@beep/workspace-server/test"
 *
 * const { InMemoryState } = ThreadStoreRepoTestSchemas
 * const state = InMemoryState.make({})
 * console.log(state.nextId)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class InMemoryState extends S.Class<InMemoryState>($I`InMemoryState`)(
  {
    messages: S.HashMap(PosInt, Message)
      .pipe(S.withConstructorDefault(Effect.succeed(HashMap.empty<PosInt, Message>())))
      .annotateKey({
        description: "Messages currently held by positive Message id.",
      }),
    nextId: PosInt.pipe(S.withConstructorDefault(Effect.succeed(PosInt.make(1)))).annotateKey({
      description: "Next positive id allocated by the in-memory repository.",
    }),
    threads: S.HashMap(PosInt, Thread)
      .pipe(S.withConstructorDefault(Effect.succeed(HashMap.empty<PosInt, Thread>())))
      .annotateKey({
        description: "Threads currently held by positive Thread id.",
      }),
    turns: S.HashMap(PosInt, Turn)
      .pipe(S.withConstructorDefault(Effect.succeed(HashMap.empty<PosInt, Turn>())))
      .annotateKey({
        description: "Turns currently held by positive Turn id.",
      }),
  },
  $I.annote("InMemoryState", {
    description: "In-memory state for the thread store.",
  })
) {}
