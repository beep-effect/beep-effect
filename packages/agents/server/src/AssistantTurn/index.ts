/**
 * Assistant-turn streaming primitives for the agents server slice.
 *
 * @packageDocumentation
 * @category parsing
 * @since 0.0.0
 */

/**
 * Anthropic provider-adaptation codecs for the assistant-turn output.
 *
 * **Example** (Decode assistant block output)
 *
 * ```ts
 * import { assistantBlockOutput } from "@beep/agents-server/AssistantTurn"
 * import * as S from "effect/Schema"
 *
 * const decodeBlock = S.decodeUnknownSync(S.fromJsonString(assistantBlockOutput.codec))
 * const block = decodeBlock('{"type":"paragraph","children":[{"type":"text","text":"Hi"}]}')
 * console.log(block.type) // "paragraph"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export * from "./AnthropicTurnCodec.ts";
/**
 * Anthropic streaming kernel Layer satisfying the `AgentTurnKernel` port.
 *
 * **Example** (Provide Anthropic turn kernel)
 *
 * ```ts
 * import { AgentTurnKernel } from "@beep/agents-use-cases/public"
 * import { AnthropicTurnKernel } from "@beep/agents-server/AssistantTurn"
 * import { Effect, Stream } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const kernel = yield* AgentTurnKernel
 *   return yield* kernel.streamTurn([{ role: "user", text: "Summarize this" }]).pipe(
 *     Stream.take(0),
 *     Stream.runCollect
 *   )
 * }).pipe(Effect.provide(AnthropicTurnKernel))
 *
 * Effect.runPromise(program).then((blocks) => console.log(blocks.length)) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./AnthropicTurnKernel.ts";
/**
 * Assistant-turn invalid-block repair adapter.
 *
 * **Example** (Repair invalid assistant blocks)
 *
 * ```ts
 * import { IssueReport, makeRepairInvalidBlocks } from "@beep/agents-server/AssistantTurn"
 * import { AnthropicToolJsonResponse } from "@beep/anthropic"
 * import { Effect } from "effect"
 * import { Response } from "effect/unstable/ai"
 *
 * const repair = makeRepairInvalidBlocks(() =>
 *   Effect.succeed(AnthropicToolJsonResponse.make({
 *     paramsJson: '{"repairs":[{"index":0,"block":{"type":"paragraph","children":[{"type":"text","text":"Fixed"}]}}]}',
 *     usage: Response.Usage.make({ inputTokens: { total: 4 }, outputTokens: { total: 2 } }),
 *   }))
 * )
 * const issue = IssueReport.make({
 *   index: 0,
 *   raw: '{"type":"paragraph","children":[{"type":"text","text":1}]}',
 *   report: "/children/0/text Expected string",
 * })
 *
 * Effect.runPromise(repair([issue])).then((result) => console.log(result.blocks.length)) // 1
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export * from "./BlockRepair.ts";
/**
 * Incremental completed-block extractor and its carry state.
 *
 * **Example** (Scan chunk for completed blocks)
 *
 * ```ts
 * import { initialScanState, scanChunk } from "@beep/agents-server/AssistantTurn"
 *
 * const [, completed] = scanChunk(initialScanState, '{"blocks":[{"type":"paragraph"}]}')
 * console.log(completed.length) // 1
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export * from "./ScanState.ts";
