/**
 * Deterministic fixture implementation of the assistant-turn generation kernel.
 *
 * This kernel performs no real LLM work: it derives a fixed, scripted block
 * sequence from the last `user` item's text. It is total (never fails) and
 * deterministic, which makes it the CI contract agent for the turn pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import { NonNegativeInt } from "@beep/schema";
import { A } from "@beep/utils";
import { Layer, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AssistantTurnBlockEvent,
  AssistantTurnFinalization,
  IndexedBlock,
  ProviderUsageMetadata,
} from "./AssistantTurn.contracts.ts";
import { AgentTurnKernel } from "./AssistantTurn.kernel.ts";
import type { AssistantTurnEvent, TurnHistoryItem } from "./AssistantTurn.contracts.ts";

const decodeBlock = S.decodeUnknownSync(AssistantBlock);

const lastUserPrompt = (history: ReadonlyArray<TurnHistoryItem>): O.Option<string> =>
  O.map(
    A.findLast(history, (item) => item.role === "user"),
    (item) => item.text
  );

/**
 * Derive the deterministic scripted block sequence the fixture kernel emits for
 * a given history. Exposed as a pure helper so contract tests can assert the
 * exact sequence without consuming a stream.
 *
 * **Details**
 *
 * For a non-empty last-user prompt `p` the script is: an `h2` heading "Echo",
 * a paragraph "You said: &lt;p&gt;", a two-item bullet list, and a `text` code
 * block echoing `p`. For an empty prompt or no user item, a single paragraph
 * "No input." is produced.
 *
 * **Example** (Scripted blocks for history)
 *
 * ```ts
 * import { fixtureBlocksFor } from "@beep/agents-use-cases/proof"
 *
 * const blocks = fixtureBlocksFor([{ role: "user", text: "hi" }])
 * console.log(blocks.length) // 4
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtureBlocksFor = (history: ReadonlyArray<TurnHistoryItem>): ReadonlyArray<AssistantBlock> =>
  O.match(
    O.filter(lastUserPrompt(history), (prompt) => prompt.length > 0),
    {
      onNone: () => [
        decodeBlock({
          type: "paragraph",
          children: [{ type: "text", text: "No input." }],
        }),
      ],
      onSome: (prompt) => [
        decodeBlock({
          type: "heading",
          level: "h2",
          children: [{ type: "text", text: "Echo" }],
        }),
        decodeBlock({
          type: "paragraph",
          children: [{ type: "text", text: `You said: ${prompt}` }],
        }),
        decodeBlock({
          type: "list",
          listType: "bullet",
          items: [
            { children: [{ type: "text", text: "Received your message" }] },
            { children: [{ type: "text", text: "Echoing it back" }] },
          ],
        }),
        decodeBlock({
          type: "code",
          language: "text",
          code: prompt,
        }),
      ],
    }
  );

const toIndexedBlocks = (history: ReadonlyArray<TurnHistoryItem>): ReadonlyArray<IndexedBlock> =>
  A.map(fixtureBlocksFor(history), (block, index) => IndexedBlock.make({ index, block }));

/**
 * Exact provider usage emitted by every deterministic fixture turn.
 *
 * **Example** (Log fixture token counts)
 *
 * ```ts
 * import { fixtureProviderUsage } from "@beep/agents-use-cases/proof"
 *
 * console.log(fixtureProviderUsage.inputTokens) // 12
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtureProviderUsage = ProviderUsageMetadata.make({
  inputTokens: NonNegativeInt.make(12),
  model: "fixture",
  outputTokens: NonNegativeInt.make(8),
  provider: "fixture",
  stopReason: O.some("stop"),
});

/**
 * Build the fixture kernel's completed block events and terminal usage signal.
 *
 * **Example** (Events ending in finalization)
 *
 * ```ts
 * import { fixtureEventsFor } from "@beep/agents-use-cases/proof"
 *
 * console.log(fixtureEventsFor([{ role: "user", text: "hi" }])[4]?.type) // "finalization"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtureEventsFor = (history: ReadonlyArray<TurnHistoryItem>): ReadonlyArray<AssistantTurnEvent> =>
  A.append(
    A.map(toIndexedBlocks(history), (block) => AssistantTurnBlockEvent.make({ block })),
    AssistantTurnFinalization.make({ usage: fixtureProviderUsage })
  );

/**
 * Deterministic, total fixture {@link AgentTurnKernel} Layer with no
 * requirements and no real LLM. Its `streamTurn` emits the
 * {@link fixtureBlocksFor} sequence as indexed block events followed by the
 * deterministic {@link fixtureProviderUsage} finalization signal.
 *
 * **Example** (Provide kernel and collect)
 *
 * ```ts
 * import { AgentTurnKernel } from "@beep/agents-use-cases/public"
 * import { FixtureTurnKernel } from "@beep/agents-use-cases/proof"
 * import { Effect, Stream } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const kernel = yield* AgentTurnKernel
 *   const blocks = yield* Stream.runCollect(
 *     kernel.streamTurn([{ role: "user", text: "hello" }])
 *   )
 *
 *   return blocks.map((event) => event.type)
 * }).pipe(Effect.provide(FixtureTurnKernel))
 *
 * Effect.runPromise(program).then(console.log) // ["block", "block", "block", "block", "finalization"]
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const FixtureTurnKernel: Layer.Layer<AgentTurnKernel> = Layer.succeed(AgentTurnKernel)({
  streamTurn: (history) => Stream.fromIterable(fixtureEventsFor(history)),
});
