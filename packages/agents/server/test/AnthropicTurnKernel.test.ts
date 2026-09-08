import { AnthropicTurnKernel } from "@beep/agents-server/AnthropicTurnKernel";
import { AgentTurnKernel, TurnGenerationError } from "@beep/agents-use-cases/public";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { AiError } from "effect/unstable/ai";
import { beforeEach, vi } from "vitest";
import type { Response } from "effect/unstable/ai";

const providerState = vi.hoisted(
  (): {
    parts: ReadonlyArray<Response.StreamPartEncoded>;
    providerError: AiError.AiError | undefined;
    repairError: string | undefined;
    repairInputTokens: number;
    repairJson: string;
    repairOutputTokens: number;
  } => ({
    parts: [],
    providerError: undefined,
    repairError: undefined,
    repairInputTokens: 3,
    repairJson: '{"repairs":[]}',
    repairOutputTokens: 2,
  })
);

vi.mock("@beep/anthropic", (importOriginal) =>
  import("effect").then((effect) =>
    effect.Effect.runPromise(
      effect.Effect.gen(function* () {
        const actual = yield* effect.Effect.tryPromise(() => importOriginal<typeof import("@beep/anthropic")>());
        const languageModel = yield* effect.Effect.tryPromise(() => import("effect/unstable/ai/LanguageModel"));
        const response = yield* effect.Effect.tryPromise(() => import("effect/unstable/ai/Response"));
        const TestLanguageModel = effect.Layer.effect(
          languageModel.LanguageModel,
          languageModel.make({
            generateText: () => effect.Effect.die("unexpected non-streaming provider call"),
            streamText: () =>
              providerState.providerError === undefined
                ? effect.Stream.fromIterable(providerState.parts)
                : effect.Stream.fail(providerState.providerError),
          })
        );

        return {
          ...actual,
          AnthropicTurnPlan: effect.ExecutionPlan.make({ provide: TestLanguageModel }),
          generateAnthropicToolJson: () =>
            providerState.repairError === undefined
              ? effect.Effect.succeed(
                  actual.AnthropicToolJsonResponse.make({
                    paramsJson: providerState.repairJson,
                    usage: response.Usage.make({
                      inputTokens: {
                        cacheRead: undefined,
                        cacheWrite: undefined,
                        total: providerState.repairInputTokens,
                        uncached: providerState.repairInputTokens,
                      },
                      outputTokens: {
                        reasoning: undefined,
                        text: providerState.repairOutputTokens,
                        total: providerState.repairOutputTokens,
                      },
                    }),
                  })
                )
              : effect.Effect.fail(
                  actual.RepairError.make({
                    message: providerState.repairError,
                    operation: "generate_tool_json",
                  })
                ),
        };
      })
    )
  )
);

const usage = (inputTokens = 12, outputTokens = 8): typeof Response.Usage.Encoded => ({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: inputTokens, uncached: inputTokens },
  outputTokens: { reasoning: undefined, text: outputTokens, total: outputTokens },
});

const metadataPart = (modelId: string): Response.ResponseMetadataPartEncoded => ({
  modelId,
  type: "response-metadata",
});
const finishPart = (inputTokens = 12, outputTokens = 8): Response.FinishPartEncoded => ({
  reason: "tool-calls",
  type: "finish",
  usage: usage(inputTokens, outputTokens),
});
const deltaPart = (delta: string): Response.ToolParamsDeltaPartEncoded => ({
  delta,
  id: "respond",
  type: "tool-params-delta",
});
const endPart: Response.ToolParamsEndPartEncoded = { id: "respond", type: "tool-params-end" };

const validParagraph = (text: string) => `{"type":"paragraph","children":[{"type":"text","text":"${text}"}]}`;
const envelope = (...blocks: ReadonlyArray<string>) => `{"blocks":[${A.join(blocks, ",")}]}`;

const runTurn = Effect.gen(function* () {
  const kernel = yield* AgentTurnKernel;
  return yield* Stream.runCollect(kernel.streamTurn([]));
});

beforeEach(() => {
  providerState.parts = [];
  providerState.providerError = undefined;
  providerState.repairError = undefined;
  providerState.repairInputTokens = 3;
  providerState.repairJson = '{"repairs":[]}';
  providerState.repairOutputTokens = 2;
});

describe("AnthropicTurnKernel", () => {
  it.layer(AnthropicTurnKernel)("with a deterministic provider stream", (it) => {
    it.effect(
      "captures finish usage and response metadata, then finalizes after every block",
      Effect.fnUntraced(function* () {
        providerState.parts = [
          metadataPart("claude-test"),
          deltaPart(envelope(validParagraph("first"), validParagraph("second"))),
          endPart,
          finishPart(21, 13),
        ];

        const events = A.fromIterable(yield* runTurn);

        expect(A.map(events, (event) => event.type)).toEqual(["block", "block", "finalization"]);
        expect(events[0]).toMatchObject({
          block: { block: { children: [{ text: "first", type: "text" }], type: "paragraph" }, index: 0 },
          type: "block",
        });
        expect(events[1]).toMatchObject({
          block: { block: { children: [{ text: "second", type: "text" }], type: "paragraph" }, index: 1 },
          type: "block",
        });
        expect(events[2]).toMatchObject({
          type: "finalization",
          usage: {
            inputTokens: 21,
            model: "claude-test",
            outputTokens: 13,
            provider: "anthropic",
          },
        });
        expect(events[2]?.type === "finalization" ? events[2].usage.stopReason : O.none()).toEqual(
          O.some("tool-calls")
        );
      })
    );

    it.effect(
      "fails after emitted blocks when provider usage and metadata parts are absent",
      Effect.fnUntraced(function* () {
        providerState.parts = [deltaPart(envelope(validParagraph("delivered"))), endPart];
        const observed = yield* Ref.make<ReadonlyArray<string>>([]);

        const error = yield* AgentTurnKernel.pipe(
          Effect.flatMap((kernel) =>
            kernel.streamTurn([]).pipe(
              Stream.tap((event) => Ref.update(observed, A.append(event.type))),
              Stream.runDrain
            )
          ),
          Effect.flip
        );

        expect(yield* Ref.get(observed)).toEqual(["block"]);
        expect(error).toBeInstanceOf(TurnGenerationError);
        expect(error.message).toBe("Anthropic assistant turn completed without provider model or token usage metadata");
      })
    );

    it.effect(
      "repairs an invalid block and adds repair-call usage to finalization",
      Effect.fnUntraced(function* () {
        const invalid = '{"type":"paragraph","children":[{"type":"text","text":1}]}';
        providerState.parts = [
          metadataPart("claude-repair"),
          deltaPart(envelope(invalid, validParagraph("already valid"))),
          endPart,
          finishPart(),
        ];
        providerState.repairJson =
          '{"repairs":[{"index":0,"block":{"type":"paragraph","children":[{"type":"text","text":"repaired"}]}}]}';
        providerState.repairInputTokens = 5;
        providerState.repairOutputTokens = 3;

        const events = A.fromIterable(yield* runTurn);

        expect(A.map(events, (event) => event.type)).toEqual(["block", "block", "finalization"]);
        expect(events[0]).toMatchObject({
          block: { block: { children: [{ text: "repaired" }] }, index: 0 },
        });
        expect(events[1]).toMatchObject({
          block: { block: { children: [{ text: "already valid" }] }, index: 1 },
        });
        expect(events[2]).toMatchObject({
          type: "finalization",
          usage: { inputTokens: 17, outputTokens: 11 },
        });
      })
    );

    it.effect(
      "translates repair failures at the kernel boundary",
      Effect.fnUntraced(function* () {
        const invalid = '{"type":"paragraph","children":[{"type":"text","text":1}]}';
        providerState.parts = [metadataPart("claude-repair"), deltaPart(envelope(invalid)), endPart, finishPart()];
        providerState.repairError = "repair provider unavailable";

        const error = yield* runTurn.pipe(Effect.flip);

        expect(error).toBeInstanceOf(TurnGenerationError);
        expect(error.message).toContain("Anthropic assistant turn failed: Block repair call failed");
        expect(error.message).toContain("repair provider unavailable");
      })
    );

    it.effect(
      "translates provider stream failures at the kernel boundary",
      Effect.fnUntraced(function* () {
        providerState.providerError = AiError.make({
          method: "streamText",
          module: "Anthropic",
          reason: AiError.UnknownError.make({ description: "provider stream failed" }),
        });

        const error = yield* runTurn.pipe(Effect.flip);

        expect(error).toBeInstanceOf(TurnGenerationError);
        expect(error.message).toBe("Anthropic assistant turn failed: Anthropic.streamText: provider stream failed");
      })
    );

    it.effect(
      "translates schema-invalid provider usage",
      Effect.fnUntraced(function* () {
        providerState.parts = [metadataPart("claude-test"), endPart, finishPart(-1, 8)];

        const error = yield* runTurn.pipe(Effect.flip);

        expect(error).toBeInstanceOf(TurnGenerationError);
        expect(error.message).toContain("Anthropic assistant turn returned invalid usage metadata");
        expect(error.message).toContain("inputTokens");
      })
    );
  });
});
