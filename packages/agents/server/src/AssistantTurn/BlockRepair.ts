/**
 * Batched repair for assistant blocks that failed streamed validation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import { IndexedBlock } from "@beep/agents-use-cases/AssistantTurn.contracts";
import { BlockRepairFailed } from "@beep/agents-use-cases/AssistantTurn.repair-errors";
import { generateAnthropicToolJson } from "@beep/anthropic";
import { $AgentsServerId } from "@beep/identity/packages";
import { redactString } from "@beep/observability";
import { isNonNegative } from "@beep/schema/Number";
import { Effect, JsonPatch, Metric } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AnthropicStructuredOutput, Tool, Toolkit } from "effect/unstable/ai";
import { assistantBlockOutput } from "./AnthropicTurnCodec.ts";
import type { AnthropicToolJsonResponse, RepairError } from "@beep/anthropic";

const $I = $AgentsServerId.create("AssistantTurn/BlockRepair");

const REPAIR_ATTEMPTS = 2;
const PATCH_PATH_LIMIT = 128;

const BlockIndex = S.Int.check(isNonNegative).pipe(
  $I.annoteSchema("BlockIndex", {
    description: "Non-negative integer index of an assistant block inside a turn envelope.",
  })
);

const PatchOperationCount = S.Int.check(isNonNegative).pipe(
  $I.annoteSchema("PatchOperationCount", {
    description: "Non-negative integer count of structural JSON Patch operations.",
  })
);

const RepairTokenCount = S.Int.check(isNonNegative).pipe(
  $I.annoteSchema("RepairTokenCount", {
    description: "Non-negative provider token count accumulated across assistant-block repair calls.",
  })
);

const redactedJsonPointerPathPattern = /^(?:$|\/)/u;

const RedactedJsonPointerPath = S.String.check(
  S.isPattern(redactedJsonPointerPathPattern, {
    identifier: $I`RedactedJsonPointerPathPattern`,
    title: "Redacted JSON Pointer Path",
    description: "Accepts the empty JSON Pointer root or a slash-prefixed JSON Pointer path after redaction.",
    message: "Expected a JSON Pointer root or slash-prefixed path.",
  }),
  S.isMaxLength(PATCH_PATH_LIMIT + 3, {
    identifier: $I`RedactedJsonPointerPathMaxLength`,
    title: "Redacted JSON Pointer Path Max Length",
    description: "Keeps redacted JSON Pointer paths within the configured truncation limit plus ellipsis.",
    message: `Expected a redacted JSON Pointer path of ${PATCH_PATH_LIMIT + 3} characters or fewer.`,
  })
).pipe(
  $I.annoteSchema("RedactedJsonPointerPath", {
    description: "Redacted and length-bounded JSON Pointer path safe for repair observability.",
  })
);

const REPAIR_SYSTEM = A.join(
  [
    "You repair invalid rich-text blocks from a structured-output pipeline.",
    "For each numbered failure you receive the original block JSON and the validation issue.",
    "Call the repair tool with a corrected block for every listed index, echoing each index unchanged.",
    "Preserve the author's intent and change only what the issue requires.",
  ],
  " "
);

const blocksRepaired = Metric.counter("agents_assistant_turn_blocks_repaired_total", {
  description: "Assistant-turn block repair outcomes",
  incremental: true,
});

/**
 * Validation issue report for one streamed assistant-block slice.
 *
 * **Example** (Use IssueReport)
 *
 * ```ts
 * import { IssueReport } from "@beep/agents-server/BlockRepair"
 *
 * const report = IssueReport.make({
 *   index: 0,
 *   raw: "{\"type\":\"paragraph\"}",
 *   report: "children is missing",
 * })
 * console.log(report.index)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IssueReport extends S.Class<IssueReport>($I`IssueReport`)(
  {
    index: BlockIndex.annotateKey({ description: "Original block index in the assistant turn envelope." }),
    raw: S.String.annotateKey({ description: "The raw JSON slice that failed validation." }),
    report: S.String.annotateKey({ description: "Validation issue that caused the slice to be held for repair." }),
  },
  $I.annote("IssueReport", {
    description: "Validation issue report for one streamed assistant-block slice.",
  })
) {}

class RepairItem extends S.Class<RepairItem>($I`RepairItem`)(
  {
    index: BlockIndex.annotateKey({ description: "Original failure index echoed unchanged." }),
    block: AssistantBlock.annotateKey({ description: "Corrected assistant block returned for the failure index." }),
  },
  $I.annote("RepairItem", {
    description: "One corrected assistant block returned by the repair tool.",
  })
) {}

class RepairEnvelope extends S.Class<RepairEnvelope>($I`RepairEnvelope`)(
  {
    repairs: S.Array(RepairItem).annotateKey({ description: "Corrected blocks for listed failure indices." }),
  },
  $I.annote("RepairEnvelope", {
    description: "Repair tool response envelope.",
  })
) {}

class RepairAttemptState extends S.Class<RepairAttemptState>($I`RepairAttemptState`)(
  {
    inputTokens: RepairTokenCount.annotateKey({
      description: "Provider input tokens accumulated across completed repair attempts.",
    }),
    outputTokens: RepairTokenCount.annotateKey({
      description: "Provider output tokens accumulated across completed repair attempts.",
    }),
    pending: S.Array(IssueReport).annotateKey({
      description: "Failure reports still pending after the current repair attempt.",
    }),
    repaired: S.Array(IndexedBlock).annotateKey({
      description: "Accepted repaired blocks accumulated across repair attempts.",
    }),
  },
  $I.annote("RepairAttemptState", {
    description: "Accumulator for unrepaired failures and accepted repaired blocks across repair attempts.",
  })
) {}

class RepairUsage extends S.Class<RepairUsage>($I`RepairUsage`)(
  {
    inputTokens: RepairTokenCount.annotateKey({ description: "Provider input tokens for one repair call." }),
    outputTokens: RepairTokenCount.annotateKey({ description: "Provider output tokens for one repair call." }),
  },
  $I.annote("RepairUsage", {
    description: "Validated provider token usage for one assistant-block repair call.",
  })
) {}

class RepairInvalidBlocksResult extends S.Class<RepairInvalidBlocksResult>($I`RepairInvalidBlocksResult`)(
  {
    blocks: S.Array(IndexedBlock).annotateKey({ description: "Accepted repaired blocks." }),
    inputTokens: RepairTokenCount.annotateKey({
      description: "Provider input tokens accumulated across all repair calls.",
    }),
    outputTokens: RepairTokenCount.annotateKey({
      description: "Provider output tokens accumulated across all repair calls.",
    }),
  },
  $I.annote("RepairInvalidBlocksResult", {
    description: "Accepted repaired blocks and aggregate provider usage for the repair tail.",
  })
) {}

/**
 * Provider call used by {@link makeRepairInvalidBlocks} to obtain repair tool
 * parameters for a batch of invalid block slices.
 *
 * **Details**
 *
 * `attempt` is one-based and never exceeds the adapter retry limit. The call
 * returns the raw repair-tool parameters JSON together with terminal provider
 * usage; envelope validation, per-block decoding, unexpected indices, and
 * dropped repairs remain the adapter's responsibility.
 *
 * **Example** (Use BlockRepairCall)
 *
 * ```ts
 * import { IssueReport } from "@beep/agents-server/BlockRepair"
 * import type { BlockRepairCall } from "@beep/agents-server/BlockRepair"
 * import { AnthropicToolJsonResponse } from "@beep/anthropic"
 * import { Effect } from "effect"
 * import { Response } from "effect/unstable/ai"
 *
 * const issue = IssueReport.make({
 *   index: 0,
 *   raw: '{"type":"paragraph","children":[{"type":"text","text":1}]}',
 *   report: "/children/0/text Expected string",
 * })
 * const callRepair: BlockRepairCall = (pending, attempt) =>
 *   Effect.succeed(AnthropicToolJsonResponse.make({
 *     paramsJson: `{"repairs":[{"index":${pending[0]?.index ?? 0},"block":{"type":"paragraph","children":[{"type":"text","text":"Fixed on attempt ${attempt}"}]}}]}`,
 *     usage: Response.Usage.make({
 *       inputTokens: { total: 4 },
 *       outputTokens: { total: 2 },
 *     }),
 *   }))
 *
 * Effect.runPromise(callRepair([issue], 1)).then((response) =>
 *   console.log(response.paramsJson.includes("Fixed")) // true
 * )
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export type BlockRepairCall = (
  pending: ReadonlyArray<IssueReport>,
  attempt: number
) => Effect.Effect<AnthropicToolJsonResponse, RepairError>;

/**
 * Repair function shape used by the Anthropic turn kernel after streamed block
 * validation has collected one or more failures.
 *
 * **Details**
 *
 * The returned effect succeeds with repaired indexed blocks and aggregate
 * repair-call token usage. Missing, duplicated, unexpected, or still-invalid
 * tool results are handled by the adapter and do not escape as successful
 * blocks; repair-call failures are represented by `BlockRepairFailed`.
 *
 * **Example** (Use RepairInvalidBlocks)
 *
 * ```ts
 * import { IssueReport, makeRepairInvalidBlocks } from "@beep/agents-server/BlockRepair"
 * import { AnthropicToolJsonResponse } from "@beep/anthropic"
 * import type { RepairInvalidBlocks } from "@beep/agents-server/BlockRepair"
 * import { Effect } from "effect"
 * import { Response } from "effect/unstable/ai"
 *
 * const repair: RepairInvalidBlocks = makeRepairInvalidBlocks(() =>
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
 * Effect.runPromise(repair([issue])).then((result) => console.log(result.blocks[0]?.block.type)) // "paragraph"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export type RepairInvalidBlocks = (
  failures: ReadonlyArray<IssueReport>
) => Effect.Effect<RepairInvalidBlocksResult, BlockRepairFailed>;

const repairOutput = AnthropicStructuredOutput.toCodecAnthropic(RepairEnvelope);

const RepairTool = Tool.make("repair", {
  description: "Deliver corrected blocks for the listed failure indices. You MUST respond with a JSON object.",
  parameters: RepairEnvelope,
}).annotate(Tool.Strict, false);

const RepairToolkit = Toolkit.make(RepairTool);

const decodeEnvelopeJson = S.decodeUnknownEffect(S.fromJsonString(repairOutput.codec));
const decodeJsonString = S.decodeUnknownEffect(S.fromJsonString(S.Json));
const decodeJsonValue = S.decodeUnknownEffect(S.Json);
const decodeRepairedBlock = S.decodeUnknownEffect(assistantBlockOutput.codec);
const decodeRepairUsage = S.decodeUnknownEffect(RepairUsage);
const encodeBlock = S.encodeUnknownEffect(AssistantBlock);

const failureSection = (failure: IssueReport): string =>
  A.join(
    [`### Failure index ${failure.index}`, "Original block JSON:", failure.raw, "Validation issue:", failure.report],
    "\n"
  );

const defaultRepairCall: BlockRepairCall = (pending, attempt) =>
  generateAnthropicToolJson({
    prompt: [
      { role: "system", content: REPAIR_SYSTEM },
      {
        role: "user",
        content: A.join(
          [`Repair attempt ${attempt} of ${REPAIR_ATTEMPTS}.`, A.join(A.map(pending, failureSection), "\n\n")],
          "\n\n"
        ),
      },
    ],
    toolkit: RepairToolkit,
    toolChoice: { tool: "repair" },
  });

const toBlockRepairFailed = (message: string): BlockRepairFailed => BlockRepairFailed.make({ message });

/**
 * Base schema fields shared by every summarized JSON Patch operation, carrying the redacted JSON Pointer path.
 *
 * **Example** (Use PatchOpSummaryBase)
 *
 * ```ts
 * import { PatchOpSummaryBase } from "@beep/agents-server/BlockRepair"
 *
 * const base = PatchOpSummaryBase.make({ path: "/content" })
 * console.log(base.path)
 * // "/content"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PatchOpSummaryBase extends S.Class<PatchOpSummaryBase>($I`PatchOpSummaryBase`)(
  {
    path: RedactedJsonPointerPath.annotateKey({
      description: "Redacted and truncated JSON Pointer path for the summarized patch operation.",
    }),
  },
  $I.annote("PatchOpSummaryBase", {
    description: "A single JSON Patch operation.",
  })
) {}

/**
 * Summary of a JSON Patch add operation, tagged with the `add` op discriminant.
 *
 * **Example** (Use AddPatchOpSummary)
 *
 * ```ts
 * import { AddPatchOpSummary } from "@beep/agents-server/BlockRepair"
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownSync(AddPatchOpSummary)({ op: "add", path: "/content" })
 * console.log(summary.op)
 * // "add"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AddPatchOpSummary extends PatchOpSummaryBase.extend<AddPatchOpSummary>($I`AddPatchOpSummary`)(
  {
    op: S.tag("add"),
  },
  $I.annote("AddPatchOpSummary", {
    description: "A single JSON Patch add operation.",
  })
) {}

/**
 * Summary of a JSON Patch remove operation, tagged with the `remove` op discriminant.
 *
 * **Example** (Use RemovePatchOpSummary)
 *
 * ```ts
 * import { RemovePatchOpSummary } from "@beep/agents-server/BlockRepair"
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownSync(RemovePatchOpSummary)({ op: "remove", path: "/content" })
 * console.log(summary.op)
 * // "remove"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RemovePatchOpSummary extends PatchOpSummaryBase.extend<RemovePatchOpSummary>($I`RemovePatchOpSummary`)(
  {
    op: S.tag("remove"),
  },
  $I.annote("RemovePatchOpSummary", {
    description: "A single JSON Patch remove operation.",
  })
) {}

/**
 * Summary of a JSON Patch replace operation, tagged with the `replace` op discriminant.
 *
 * **Example** (Use ReplacePatchOpSummary)
 *
 * ```ts
 * import { ReplacePatchOpSummary } from "@beep/agents-server/BlockRepair"
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownSync(ReplacePatchOpSummary)({ op: "replace", path: "/content" })
 * console.log(summary.op)
 * // "replace"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplacePatchOpSummary extends PatchOpSummaryBase.extend<ReplacePatchOpSummary>($I`ReplacePatchOpSummary`)(
  {
    op: S.tag("replace"),
  },
  $I.annote("ReplacePatchOpSummary", {
    description: "A single JSON Patch replace operation.",
  })
) {}

/**
 * Tagged union of summarized JSON Patch operations discriminated on the `op` field.
 *
 * **Example** (Use PatchOpSummary)
 *
 * ```ts
 * import { PatchOpSummary } from "@beep/agents-server/BlockRepair"
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownSync(PatchOpSummary)({ op: "add", path: "/content" })
 * console.log(summary.op)
 * // "add"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PatchOpSummary = S.Union([AddPatchOpSummary, RemovePatchOpSummary, ReplacePatchOpSummary]).pipe(
  S.toTaggedUnion("op"),
  $I.annoteSchema("PatchOpSummary", {
    description: "A single JSON Patch operation.",
  })
);

/**
 * Runtime type of the {@link PatchOpSummary} tagged union of JSON Patch operation summaries.
 *
 * **Example** (Use PatchOpSummary)
 *
 * ```ts
 * import { PatchOpSummary } from "@beep/agents-server/BlockRepair"
 * import * as S from "effect/Schema"
 *
 * const summary: PatchOpSummary = S.decodeUnknownSync(PatchOpSummary)({ op: "remove", path: "/content" })
 * console.log(summary.op)
 * // "remove"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PatchOpSummary = typeof PatchOpSummary.Type;

class PatchSummarization extends S.Class<PatchSummarization>($I`PatchSummarization`)(
  {
    operations: PatchOperationCount.annotateKey({
      description: "Number of structural JSON Patch operations summarized.",
    }),
    ops: S.Array(PatchOpSummary).annotateKey({
      description: "Redacted per-operation patch summaries safe for logs.",
    }),
  },
  $I.annote("PatchSummarization", {
    description:
      "Summarize a JSON patch into non-sensitive structural metadata: the operation count and, per operation, the op kind plus a redacted/truncated JSON Pointer. The `value` field of add/replace operations carries repaired assistant content and is intentionally never logged.",
  })
) {}

// Summarize a JSON patch into non-sensitive structural metadata: the operation
// count and, per operation, the op kind plus a redacted/truncated JSON Pointer.
// The `value` field of add/replace operations carries repaired assistant content
// and is intentionally never logged.
const summarizePatch = (patch: JsonPatch.JsonPatch): PatchSummarization =>
  S.decodeSync(PatchSummarization)({
    operations: A.length(patch),
    ops: A.map(patch, (operation) => ({ op: operation.op, path: redactString(operation.path, PATCH_PATH_LIMIT) })),
  });

const trackRepairOutcome = (outcome: "call_failed" | "dropped" | "repaired", count: number): Effect.Effect<void> =>
  count === 0 ? Effect.void : Metric.update(Metric.withAttributes(blocksRepaired, { outcome }), count);

const requestRepairEnvelope = (
  callRepair: BlockRepairCall,
  pending: ReadonlyArray<IssueReport>,
  attempt: number
): Effect.Effect<readonly [RepairEnvelope, RepairUsage], BlockRepairFailed> =>
  callRepair(pending, attempt).pipe(
    Effect.tapError((error) =>
      Effect.logWarning("assistant-turn block repair call failed", {
        attempt,
        detail: error,
      })
    ),
    Effect.mapError((error) => toBlockRepairFailed(`Block repair call failed: ${error.message}`)),
    Effect.flatMap((response) =>
      Effect.all([
        decodeEnvelopeJson(response.paramsJson).pipe(
          Effect.mapError((error) => toBlockRepairFailed(`Block repair envelope failed validation: ${error.message}`))
        ),
        decodeRepairUsage({
          inputTokens: response.usage.inputTokens.total,
          outputTokens: response.usage.outputTokens.total,
        }).pipe(
          Effect.mapError((error) =>
            toBlockRepairFailed(`Block repair call returned invalid usage metadata: ${error.message}`)
          )
        ),
      ])
    )
  );

const repairItemToIndexed = Effect.fn("repairItemToIndexed")(function* (
  pending: ReadonlyArray<IssueReport>,
  item: RepairItem
): Effect.fn.Return<O.Option<IndexedBlock>> {
  const failure = A.findFirst(pending, (candidate) => candidate.index === item.index);
  if (O.isNone(failure)) {
    yield* Effect.logWarning("assistant-turn block repair ignored unexpected index", { index: item.index });
    return O.none<IndexedBlock>();
  }

  const encodedUnknown = yield* encodeBlock(item.block).pipe(
    Effect.asSome,
    Effect.catch((error) =>
      Effect.logWarning("assistant-turn block repair failed to encode returned block", {
        index: item.index,
        detail: error.message,
      }).pipe(Effect.as(O.none<typeof AssistantBlock.Encoded>()))
    )
  );
  if (O.isNone(encodedUnknown)) {
    return O.none<IndexedBlock>();
  }

  const encodedJson = yield* decodeJsonValue(encodedUnknown.value).pipe(
    Effect.asSome,
    Effect.catch((error) =>
      Effect.logWarning("assistant-turn block repair returned non-json block", {
        index: item.index,
        detail: error.message,
      }).pipe(Effect.as(O.none<S.Json>()))
    )
  );
  if (O.isNone(encodedJson)) {
    return O.none<IndexedBlock>();
  }

  const checked = yield* decodeRepairedBlock(encodedJson.value).pipe(
    Effect.asSome,
    Effect.catch((error) =>
      Effect.logWarning("assistant-turn block repair returned codec-invalid block", {
        index: item.index,
        detail: error.message,
      }).pipe(Effect.as(O.none<AssistantBlock>()))
    )
  );
  if (O.isNone(checked)) {
    return O.none<IndexedBlock>();
  }

  yield* decodeJsonString(failure.value.raw).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.logWarning("assistant-turn block repaired without original patch", {
          index: item.index,
          detail: error.message,
        }),
      onSuccess: (originalJson) => {
        const patch = JsonPatch.get(originalJson, encodedJson.value);
        return A.isReadonlyArrayEmpty(patch)
          ? Effect.logInfo("assistant-turn block repaired without structural patch", { index: item.index })
          : Effect.logInfo("assistant-turn block repaired", { index: item.index, ...summarizePatch(patch) });
      },
    })
  );
  return O.some<IndexedBlock>({ block: checked.value, index: item.index });
});

const containsIndexedBlock = (blocks: ReadonlyArray<IndexedBlock>, index: number): boolean =>
  A.some(blocks, (block) => block.index === index);

const deduplicateIndexedBlocks = (blocks: ReadonlyArray<IndexedBlock>): ReadonlyArray<IndexedBlock> =>
  A.reduce(blocks, A.empty<IndexedBlock>(), (deduplicated, block) =>
    containsIndexedBlock(deduplicated, block.index) ? deduplicated : A.append(deduplicated, block)
  );

const attemptRepairs = (
  callRepair: BlockRepairCall,
  pending: ReadonlyArray<IssueReport>,
  attempt: number
): Effect.Effect<readonly [ReadonlyArray<IndexedBlock>, RepairUsage], BlockRepairFailed> =>
  requestRepairEnvelope(callRepair, pending, attempt).pipe(
    Effect.flatMap(([envelope, usage]) =>
      Effect.forEach(envelope.repairs, (item) => repairItemToIndexed(pending, item), { concurrency: 1 }).pipe(
        Effect.map(A.getSomes),
        Effect.map(deduplicateIndexedBlocks),
        Effect.map((blocks): readonly [ReadonlyArray<IndexedBlock>, RepairUsage] => [blocks, usage])
      )
    )
  );

const runRepairAttempts = Effect.fn("runRepairAttempts")(function* (
  callRepair: BlockRepairCall,
  pending: ReadonlyArray<IssueReport>,
  repaired: ReadonlyArray<IndexedBlock>,
  inputTokens: number,
  outputTokens: number,
  attempt: number
): Effect.fn.Return<RepairAttemptState, BlockRepairFailed> {
  if (attempt > REPAIR_ATTEMPTS || A.isReadonlyArrayEmpty(pending)) {
    return RepairAttemptState.make({ inputTokens, outputTokens, pending, repaired });
  }

  const [fixed, usage] = yield* attemptRepairs(callRepair, pending, attempt).pipe(
    Effect.tapError(() =>
      Effect.all(
        [trackRepairOutcome("repaired", A.length(repaired)), trackRepairOutcome("call_failed", A.length(pending))],
        { discard: true }
      )
    )
  );
  const fixedIndices = A.map(fixed, (item) => item.index);
  const remaining = A.filter(pending, (failure) => !A.contains(fixedIndices, failure.index));
  return yield* runRepairAttempts(
    callRepair,
    remaining,
    A.appendAll(repaired, fixed),
    inputTokens + usage.inputTokens,
    outputTokens + usage.outputTokens,
    attempt + 1
  );
});

/**
 * Build a retrying invalid-block repair function from a provider call.
 *
 * **Details**
 *
 * The returned repair function makes at most two sequential repair attempts.
 * It keeps the first accepted repair per index, ignores unexpected indices,
 * logs codec-invalid tool results, records repair metrics, and drops failures
 * that remain pending after the retry budget. A failed provider call or
 * malformed repair envelope fails the effect with `BlockRepairFailed`.
 *
 * **Example** (Use makeRepairInvalidBlocks)
 *
 * ```ts
 * import { IssueReport, makeRepairInvalidBlocks } from "@beep/agents-server/BlockRepair"
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
export const makeRepairInvalidBlocks = (callRepair: BlockRepairCall = defaultRepairCall): RepairInvalidBlocks =>
  Effect.fn("agents.assistant_turn.block_repair")(function* (failures) {
    if (A.isReadonlyArrayEmpty(failures)) {
      return RepairInvalidBlocksResult.make({ blocks: A.empty<IndexedBlock>(), inputTokens: 0, outputTokens: 0 });
    }

    const result = yield* runRepairAttempts(callRepair, failures, A.empty<IndexedBlock>(), 0, 0, 1);

    yield* trackRepairOutcome("repaired", A.length(result.repaired));
    if (!A.isReadonlyArrayEmpty(result.pending)) {
      yield* trackRepairOutcome("dropped", A.length(result.pending));
      yield* Effect.logWarning("assistant-turn dropping unrepairable blocks", {
        indices: A.map(result.pending, (failure) => failure.index),
      });
    }

    return RepairInvalidBlocksResult.make({
      blocks: result.repaired,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  });

/**
 * Default Anthropic-backed invalid-block repair function.
 *
 * **Details**
 *
 * Non-empty failure batches call the Anthropic repair tool with redacted,
 * structured failure reports. Empty batches return immediately without a
 * provider call, which is useful for branch-free repair tails.
 *
 * **Example** (Use repairInvalidBlocks)
 *
 * ```ts
 * import { repairInvalidBlocks } from "@beep/agents-server/BlockRepair"
 * import { Effect } from "effect"
 *
 * Effect.runPromise(repairInvalidBlocks([])).then((result) => console.log(result.blocks.length)) // 0
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const repairInvalidBlocks = makeRepairInvalidBlocks();
