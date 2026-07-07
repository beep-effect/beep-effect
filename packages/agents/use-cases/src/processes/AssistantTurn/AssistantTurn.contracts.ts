/**
 * SDK data-transfer contracts for the assistant-turn generation kernel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import { $AgentsUseCasesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("processes/AssistantTurn/AssistantTurn.contracts");
const BlockIndex = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`BlockIndexNonNegativeCheck`,
    title: "Block Index Non Negative",
    description: "A generated assistant block index must be zero or greater.",
    message: "Expected a non-negative assistant block index",
  })
).pipe(
  $I.annoteSchema("BlockIndex", {
    description: "Zero-based generated assistant block index.",
  })
);

/**
 * The plain-text prompt projection of a single thread item. The kernel consumes
 * a history of these to generate the next assistant turn.
 *
 * @example
 * ```ts
 * import { UserTurnHistoryItem } from "@beep/agents-use-cases/public"
 *
 * const item = UserTurnHistoryItem.make({ text: "Hello" })
 * console.log(item.role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UserTurnHistoryItem extends S.Class<UserTurnHistoryItem>($I`UserTurnHistoryItem`)(
  {
    role: S.tag("user").annotateKey({ description: "User-authored turn discriminator." }),
    text: S.String.annotateKey({ description: "Plain-text user prompt projection consumed by the turn kernel." }),
  },
  $I.annote("UserTurnHistoryItem", {
    description: "Plain-text prompt projection of a user thread item consumed by the turn kernel.",
  })
) {}

/**
 * The plain-text prompt projection of a single assistant-authored thread item.
 *
 * @example
 * ```ts
 * import { AssistantTurnHistoryItem } from "@beep/agents-use-cases/public"
 *
 * const item = AssistantTurnHistoryItem.make({ text: "Hello" })
 * console.log(item.role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssistantTurnHistoryItem extends S.Class<AssistantTurnHistoryItem>($I`AssistantTurnHistoryItem`)(
  {
    role: S.tag("assistant").annotateKey({ description: "Assistant-authored turn discriminator." }),
    text: S.String.annotateKey({
      description: "Plain-text assistant response projection consumed by the turn kernel.",
    }),
  },
  $I.annote("AssistantTurnHistoryItem", {
    description: "Plain-text prompt projection of an assistant thread item consumed by the turn kernel.",
  })
) {}

/**
 * Plain-text prompt projection of a thread item consumed by the turn kernel.
 *
 * @example
 * ```ts
 * import { TurnHistoryItem } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(TurnHistoryItem)({ role: "user", text: "Hello" })
 * console.log(item.role)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurnHistoryItem = S.Union([UserTurnHistoryItem, AssistantTurnHistoryItem]).pipe(
  S.toTaggedUnion("role"),
  $I.annoteSchema("TurnHistoryItem", {
    description: "Plain-text prompt projection of a thread item consumed by the turn kernel.",
  })
);

/**
 * Runtime type for {@link TurnHistoryItem}.
 *
 * @example
 * ```ts
 * import type { TurnHistoryItem } from "@beep/agents-use-cases/public"
 *
 * const item: TurnHistoryItem = { role: "assistant", text: "Ready." }
 * console.log(item.role) // "assistant"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnHistoryItem = typeof TurnHistoryItem.Type;

/**
 * A single assistant block paired with its position in the generated turn.
 * Blocks may be emitted out of order on the wire, so the index restores the
 * persisted order.
 *
 * @example
 * ```ts
 * import type { IndexedBlock } from "@beep/agents-use-cases/public"
 * import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(AssistantBlock)({
 *   type: "paragraph",
 *   children: [{ type: "text", text: "Hello" }],
 * })
 * const indexed: IndexedBlock = { index: 0, block }
 * console.log(indexed.index)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IndexedBlock extends S.Class<IndexedBlock>($I`IndexedBlock`)(
  {
    block: AssistantBlock.annotateKey({ description: "Generated assistant block payload." }),
    index: BlockIndex.annotateKey({ description: "Zero-based block position in the generated assistant turn." }),
  },
  $I.annote("IndexedBlock", {
    description: "Generated assistant block paired with the block's position in the turn stream.",
  })
) {}
