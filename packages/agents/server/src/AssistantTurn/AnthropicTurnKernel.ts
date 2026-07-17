/**
 * Anthropic streaming implementation of the {@link AgentTurnKernel} port.
 *
 * Rich md-aligned block scope (paragraph/heading/quote/list/code, mermaid as
 * code, table, and youtube) streams through the forced-tool surface.
 * The model is driven through the idiomatic forced-tool surface: a Toolkit with
 * a single non-strict `respond` tool whose parameters schema is the assistant
 * envelope, forced via `toolChoice`. The Anthropic provider maps
 * `input_json_delta` SSE events to `tool-params-delta` stream parts carrying the
 * raw partial JSON; {@link scanChunk} incrementally extracts each completed
 * element of the top-level `"blocks"` array, which is decoded through the
 * provider-adapted per-block codec and emitted as an {@link IndexedBlock}.
 *
 * Invalid slices are held for a sequential repair tail after the forced-tool
 * envelope completes. Blocks that still cannot be repaired are dropped and
 * logged; failed repair calls become turn-generation failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AssistantContent } from "@beep/agents-domain/values/AssistantContent";
import { AgentTurnKernel, TurnGenerationError } from "@beep/agents-use-cases/public";
import { AnthropicTurnPlan } from "@beep/anthropic";
import { Effect, Layer, Metric, Order, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { LanguageModel, Tool, Toolkit } from "effect/unstable/ai";
import { assistantBlockOutput } from "./AnthropicTurnCodec.ts";
import { IssueReport, repairInvalidBlocks } from "./BlockRepair.ts";
import { initialScanState, scanChunk } from "./ScanState.ts";
import type { IndexedBlock, TurnHistoryItem } from "@beep/agents-use-cases/public";
import type { BlockRepairFailed } from "@beep/agents-use-cases/server";
import type { Config } from "effect";
import type { AiError, Response } from "effect/unstable/ai";

const SYSTEM_PROMPT = [
  "You are a helpful assistant in a rich-text chat application.",
  "Respond with well-structured content: use headings for sections,",
  "lists for enumerations, code blocks for code, and quotes when citing.",
  'Use code blocks with language="mermaid" for diagrams; there is no separate mermaid block type.',
  "Use table blocks for rectangular data and keep every row the same width.",
  "Use youtube blocks only with the bare 11-character video id, never a full URL.",
  "Keep responses focused and conversational.",
].join(" ");

const blocksValidated = Metric.counter("agents_assistant_turn_blocks_total", {
  description: "Streamed assistant-turn blocks by validation result",
  incremental: true,
});

// The forced-tool pattern: claude is structured-output-capable, so the provider
// would default to `strict: true` (grammar compilation, which our block union
// exceeds). `Tool.Strict` false keeps the schema as plain validation guidance;
// every emitted block is still schema-validated on the way through the scanner.
const RespondTool = Tool.make("respond", {
  description: "Deliver the assistant response as rich-text blocks. You MUST respond with a JSON object.",
  parameters: AssistantContent,
}).annotate(Tool.Strict, false);

const RespondToolkit = Toolkit.make(RespondTool);

const decodeSlice = S.decodeUnknownEffect(S.fromJsonString(assistantBlockOutput.codec));

const markValid = Metric.update(Metric.withAttributes(blocksValidated, { result: "valid" }), 1);
const markInvalid = Metric.update(Metric.withAttributes(blocksValidated, { result: "invalid" }), 1);
const indexOf = (indexed: IndexedBlock): number => indexed.index;

const sortedIndexedBlocks = (blocks: ReadonlyArray<IndexedBlock>): ReadonlyArray<IndexedBlock> =>
  A.sortWith(blocks, indexOf, Order.Number);

// Validate-and-route: valid slices stream immediately until an earlier slice
// fails. From that point, later valid slices are buffered so the repair tail can
// flush repaired and already-valid blocks in original envelope order.
const routeBlock =
  (
    failures: Ref.Ref<ReadonlyArray<IssueReport>>,
    buffered: Ref.Ref<ReadonlyArray<IndexedBlock>>,
    holdingAfterFailure: Ref.Ref<boolean>
  ) =>
  ([slice, index]: [string, number]): Effect.Effect<ReadonlyArray<IndexedBlock>> =>
    Effect.matchEffect(decodeSlice(slice), {
      onSuccess: Effect.fn("AnthropicTurnKernel.routeBlock.valid")(function* (block) {
        yield* markValid;
        const indexed = { index, block };
        if (yield* Ref.get(holdingAfterFailure)) {
          yield* Ref.update(buffered, A.append(indexed));
          return A.empty<IndexedBlock>();
        }
        return [indexed];
      }),
      onFailure: Effect.fn("AnthropicTurnKernel.routeBlock.invalid")(function* (error) {
        yield* Ref.set(holdingAfterFailure, true);
        yield* Ref.update(
          failures,
          A.append(
            IssueReport.make({
              index,
              raw: slice,
              report: error.message,
            })
          )
        );
        yield* markInvalid;
        yield* Effect.logInfo("assistant-turn block failed validation, held for repair", {
          index,
          issue: error.message,
        });
        return A.empty<IndexedBlock>();
      }),
    });

type RespondStreamPart = Response.StreamPart<Toolkit.Tools<typeof RespondToolkit>>;

const streamTurn = (history: ReadonlyArray<TurnHistoryItem>): Stream.Stream<IndexedBlock, TurnGenerationError> => {
  // `AnthropicTurnPlan` is self-contained — it `provide`s the language model and
  // resolves the redacted API key from config — so the only failures crossing
  // the boundary are AiError (provider) and ConfigError (missing key), and the
  // requirement channel is `never`. The driver's plan type erases its `provides`
  // generic to `any`, so we pin the post-plan stream type explicitly here.
  const parts = LanguageModel.streamText({
    prompt: [
      { role: "system", content: SYSTEM_PROMPT },
      ...A.map(history, (item) => ({ role: item.role, content: item.text })),
    ],
    toolkit: RespondToolkit,
    toolChoice: { tool: "respond" },
    disableToolCallResolution: true,
  }).pipe(Stream.withExecutionPlan(AnthropicTurnPlan, { preventFallbackOnPartialStream: true })) as Stream.Stream<
    RespondStreamPart,
    AiError.AiError | Config.ConfigError
  >;

  return Stream.unwrap(
    Effect.gen(function* () {
      const failures = yield* Ref.make<ReadonlyArray<IssueReport>>(A.empty<IssueReport>());
      const buffered = yield* Ref.make<ReadonlyArray<IndexedBlock>>(A.empty<IndexedBlock>());
      const holdingAfterFailure = yield* Ref.make(false);
      const validated = parts.pipe(
        Stream.takeUntil((part) => part.type === "tool-params-end"),
        Stream.flatMap((part) => (part.type === "tool-params-delta" ? Stream.succeed(part.delta) : Stream.empty)),
        // mapAccum flattens the returned slices array into stream elements
        Stream.mapAccum(() => initialScanState, scanChunk),
        Stream.zipWithIndex,
        Stream.mapEffect(routeBlock(failures, buffered, holdingAfterFailure)),
        Stream.flatMap(Stream.fromIterable)
      );

      const repairTail = Stream.unwrap(
        Effect.gen(function* () {
          const failed = yield* Ref.getAndSet(failures, A.empty<IssueReport>());
          const validAfterFirstFailure = yield* Ref.getAndSet(buffered, A.empty<IndexedBlock>());
          if (A.isReadonlyArrayEmpty(failed)) {
            return Stream.fromIterable(validAfterFirstFailure);
          }
          const repaired = yield* repairInvalidBlocks(failed);
          return Stream.fromIterable(sortedIndexedBlocks(A.appendAll(repaired, validAfterFirstFailure)));
        })
      );

      return validated.pipe(
        Stream.concat(repairTail),
        Stream.mapError((error: AiError.AiError | Config.ConfigError | BlockRepairFailed) =>
          TurnGenerationError.make({ message: `Anthropic assistant turn failed: ${error.message}` })
        ),
        Stream.withSpan("agents.assistant_turn.stream")
      );
    })
  );
};

/**
 * Live Anthropic-backed {@link AgentTurnKernel} Layer. Self-contained: the
 * {@link AnthropicTurnPlan} provides the language model, so the only run-time
 * requirement is the redacted `AI_ANTHROPIC_API_KEY` config resolved by the
 * plan's provided client layer.
 *
 * @remarks
 * The kernel streams valid blocks as soon as they decode. After the first
 * invalid slice, later valid blocks are buffered until the repair tail can emit
 * repaired and already-valid blocks in original envelope order. Repair-call
 * failures are converted to `TurnGenerationError`; blocks that remain invalid
 * after repair are logged and dropped.
 *
 * @example
 * ```ts
 * import { AgentTurnKernel } from "@beep/agents-use-cases/public"
 * import { AnthropicTurnKernel } from "@beep/agents-server/AnthropicTurnKernel"
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
export const AnthropicTurnKernel: Layer.Layer<AgentTurnKernel> = Layer.succeed(AgentTurnKernel)({ streamTurn });
