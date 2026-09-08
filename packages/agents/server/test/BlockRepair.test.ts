import { IssueReport, makeRepairInvalidBlocks } from "@beep/agents-server/BlockRepair";
import { BlockRepairFailed } from "@beep/agents-use-cases/server";
import { AnthropicToolJsonResponse, RepairError } from "@beep/anthropic";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Response } from "effect/unstable/ai";

const invalidParagraph = IssueReport.make({
  index: 0,
  raw: '{"type":"paragraph","children":[{"type":"text","text":1}]}',
  report: "/children/0/text Expected string",
});

const validParagraphReportedInvalid = IssueReport.make({
  index: 0,
  raw: '{"type":"paragraph","children":[{"type":"text","text":"Already valid"}]}',
  report: "synthetic upstream validation issue",
});

const repairCallResult = (paramsJson: string, inputTokens = 3, outputTokens = 2) =>
  AnthropicToolJsonResponse.make({
    paramsJson,
    usage: Response.Usage.make({
      inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: inputTokens, uncached: inputTokens },
      outputTokens: { reasoning: undefined, text: outputTokens, total: outputTokens },
    }),
  });

describe("BlockRepair", () => {
  it.effect(
    "emits repaired blocks returned by a valid repair envelope",
    Effect.fnUntraced(function* () {
      const repair = makeRepairInvalidBlocks(() =>
        Effect.succeed(
          repairCallResult(
            '{"repairs":[{"index":0,"block":{"type":"paragraph","children":[{"type":"text","text":"Fixed"}]}}]}'
          )
        )
      );

      const repaired = yield* repair([invalidParagraph]);
      expect(A.length(repaired.blocks)).toBe(1);
      expect(repaired.inputTokens).toBe(3);
      expect(repaired.outputTokens).toBe(2);

      const first = A.head(repaired.blocks);
      expect(O.isSome(first)).toBe(true);
      if (O.isSome(first)) {
        expect(first.value.index).toBe(0);
        expect(first.value.block.type).toBe("paragraph");
      }
    })
  );

  it.effect(
    "drops blocks missing from the repair envelope",
    Effect.fnUntraced(function* () {
      const repair = makeRepairInvalidBlocks(() => Effect.succeed(repairCallResult('{"repairs":[]}')));
      const repaired = yield* repair([invalidParagraph]);

      expect(A.isReadonlyArrayEmpty(repaired.blocks)).toBe(true);
      expect(repaired.inputTokens).toBe(6);
      expect(repaired.outputTokens).toBe(4);
    })
  );

  it.effect(
    "keeps codec-valid repaired blocks even when the patch is empty",
    Effect.fnUntraced(function* () {
      const repair = makeRepairInvalidBlocks(() =>
        Effect.succeed(
          repairCallResult(
            '{"repairs":[{"index":0,"block":{"type":"paragraph","children":[{"type":"text","text":"Already valid"}]}}]}'
          )
        )
      );

      const repaired = yield* repair([validParagraphReportedInvalid]);

      expect(A.length(repaired.blocks)).toBe(1);
      expect(repaired.blocks[0]?.block.type).toBe("paragraph");
    })
  );

  it.effect(
    "deduplicates repeated repaired indices",
    Effect.fnUntraced(function* () {
      const repair = makeRepairInvalidBlocks(() =>
        Effect.succeed(
          repairCallResult(
            '{"repairs":[{"index":0,"block":{"type":"paragraph","children":[{"type":"text","text":"First"}]}},{"index":0,"block":{"type":"paragraph","children":[{"type":"text","text":"Second"}]}}]}'
          )
        )
      );

      const repaired = yield* repair([invalidParagraph]);

      expect(A.length(repaired.blocks)).toBe(1);
      const first = A.head(repaired.blocks);
      expect(O.isSome(first)).toBe(true);
      if (O.isSome(first)) {
        expect(first.value.index).toBe(0);
        expect(first.value.block.type).toBe("paragraph");
        expect(first.value.block.type === "paragraph" ? first.value.block.children[0]?.text : undefined).toBe("First");
      }
    })
  );

  it.effect(
    "maps a failed repair call to BlockRepairFailed",
    Effect.fnUntraced(function* () {
      const repair = makeRepairInvalidBlocks(() =>
        Effect.fail(RepairError.make({ message: "model unavailable", operation: "generate_tool_json" }))
      );
      const exit = yield* Effect.exit(repair([invalidParagraph]));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause);
        expect(O.isSome(error)).toBe(true);
        if (O.isSome(error)) {
          expect(BlockRepairFailed.is(error.value)).toBe(true);
        }
      }
    })
  );
});
