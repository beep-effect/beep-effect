/**
 * SDK data-transfer contracts for the assistant-turn generation kernel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import { $AgentsUseCasesId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Tuple } from "effect";
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
 * **Example** (Create user history item)
 *
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
 * **Example** (Create assistant history item)
 *
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
 * **Example** (Decode turn history item)
 *
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
  $I.annoteSchema("TurnHistoryItem", {
    description: "Plain-text prompt projection of a thread item consumed by the turn kernel.",
  }),
  SchemaUtils.withCodecStatics(["decodeSync", "encodeResult"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("role"),
      SchemaUtils.withStatics(() => ({ decodeSync: schema.decodeSync, encodeResult: schema.encodeResult }))
    )
);

/**
 * Runtime type for {@link TurnHistoryItem}.
 *
 * **Example** (Annotate history item type)
 *
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
 * **Example** (Index decoded assistant block)
 *
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
) {
  static readonly encodeResult = S.encodeResult(IndexedBlock);
}

/**
 * Provider-reported token usage attached to a successfully finalized assistant
 * turn. The optional stop reason encodes as JSON `null`, keeping the contract
 * safe across RPC and jsonb boundaries.
 *
 * **Example** (Make provider usage metadata)
 *
 * ```ts
 * import { ProviderUsageMetadata } from "@beep/agents-use-cases/public"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const usage = ProviderUsageMetadata.make({
 *   inputTokens: NonNegativeInt.make(12),
 *   model: "fixture",
 *   outputTokens: NonNegativeInt.make(8),
 *   provider: "fixture",
 *   stopReason: O.some("stop")
 * })
 * console.log(usage.model)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderUsageMetadata extends S.Class<ProviderUsageMetadata>($I`ProviderUsageMetadata`)(
  {
    inputTokens: NonNegativeInt.annotateKey({
      description: "Total provider-reported input tokens, including cached input when the provider counts it.",
    }),
    model: S.NonEmptyString.annotateKey({
      description: "Provider-returned model identifier for the finalized request.",
    }),
    outputTokens: NonNegativeInt.annotateKey({
      description: "Total provider-reported output tokens for the finalized request.",
    }),
    provider: S.NonEmptyString.annotateKey({
      description: "Provider identifier for the finalized request.",
    }),
    stopReason: S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional normalized provider stop reason; encoded absence is JSON null.",
    }),
  },
  $I.annote("ProviderUsageMetadata", {
    description: "Provider-reported model and token usage for a successfully finalized assistant turn.",
  })
) {
  static readonly encodeResult = S.encodeResult(ProviderUsageMetadata);

  static readonly encodeEffect = S.encodeEffect(ProviderUsageMetadata);
}

/**
 * Stream event carrying one completed assistant block.
 *
 * **Example** (Inspect block event make)
 *
 * ```ts
 * import { AssistantTurnBlockEvent, IndexedBlock } from "@beep/agents-use-cases/public"
 *
 * console.log(AssistantTurnBlockEvent.make)
 * console.log(IndexedBlock.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssistantTurnBlockEvent extends S.Class<AssistantTurnBlockEvent>($I`AssistantTurnBlockEvent`)(
  {
    block: IndexedBlock.annotateKey({ description: "Completed indexed assistant block." }),
    type: S.tag("block").annotateKey({ description: "Assistant block event discriminator." }),
  },
  $I.annote("AssistantTurnBlockEvent", {
    description: "Assistant-turn stream event carrying one completed indexed block.",
  })
) {}

/**
 * Terminal stream signal carrying provider usage for a successfully finalized
 * assistant turn.
 *
 * **Example** (Inspect finalization make)
 *
 * ```ts
 * import { AssistantTurnFinalization, ProviderUsageMetadata } from "@beep/agents-use-cases/public"
 *
 * console.log(AssistantTurnFinalization.make)
 * console.log(ProviderUsageMetadata.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssistantTurnFinalization extends S.Class<AssistantTurnFinalization>($I`AssistantTurnFinalization`)(
  {
    type: S.tag("finalization").annotateKey({ description: "Assistant turn finalization discriminator." }),
    usage: ProviderUsageMetadata.annotateKey({
      description: "Provider-reported usage for the successfully finalized turn.",
    }),
  },
  $I.annote("AssistantTurnFinalization", {
    description: "Terminal assistant-turn stream signal carrying provider usage metadata.",
  })
) {}

const AssistantTurnEventTag = LiteralKit(["block", "finalization"]);

/**
 * Tagged assistant-turn kernel stream event.
 *
 * **Example** (Access finalization case)
 *
 * ```ts
 * import { AssistantTurnEvent } from "@beep/agents-use-cases/public"
 *
 * console.log(AssistantTurnEvent.cases.finalization.make)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AssistantTurnEvent = AssistantTurnEventTag.mapMembers(
  Tuple.evolve([() => AssistantTurnBlockEvent, () => AssistantTurnFinalization])
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AssistantTurnEvent", {
    description: "Completed assistant blocks followed by one provider-usage finalization signal.",
  })
);

/**
 * Runtime type for {@link AssistantTurnEvent}.
 *
 * **Example** (Extract event type field)
 *
 * ```ts
 * import type { AssistantTurnEvent } from "@beep/agents-use-cases/public"
 *
 * type AssistantTurnEventType = AssistantTurnEvent["type"]
 * const eventType: AssistantTurnEventType = "finalization"
 * console.log(eventType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AssistantTurnEvent = typeof AssistantTurnEvent.Type;
