/**
 * CI-verifiable test (no real LLM): the Anthropic provider codecs must build at
 * module load (a structural guarantee that the v1 block scope stays
 * provider-expressible), and a valid block JSON string must decode into the
 * matching domain block.
 */
import { assistantBlockOutput, assistantOutput } from "@beep/agents-server/AnthropicTurnCodec";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";

const decodeBlock = S.decodeUnknownEffect(S.fromJsonString(assistantBlockOutput.codec));

describe("AnthropicTurnCodec", () => {
  it("codecs build at module load", () => {
    expect(assistantBlockOutput.codec).toBeDefined();
    expect(assistantBlockOutput.jsonSchema).toBeDefined();
    expect(assistantOutput.codec).toBeDefined();
    expect(assistantOutput.jsonSchema).toBeDefined();
  });

  it.effect(
    "decodes a paragraph block from a JSON string slice",
    Effect.fnUntraced(function* () {
      const block = yield* decodeBlock('{"type":"paragraph","children":[{"type":"text","text":"hi"}]}');

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.children).toEqual([{ type: "text", text: "hi" }]);
      }
    })
  );

  it.effect(
    "decodes valid rich blocks",
    Effect.fnUntraced(function* () {
      expect((yield* decodeBlock('{"type":"code","language":"mermaid","code":"graph TD\\n  A --> B"}')).type).toBe(
        "code"
      );
      expect(
        (yield* decodeBlock(
          '{"type":"table","headerRow":true,"rows":[{"cells":[{"children":[{"type":"text","text":"Name"}]}]},{"cells":[{"children":[{"type":"text","text":"Language"}]}]}]}'
        )).type
      ).toBe("table");
      expect((yield* decodeBlock('{"type":"youtube","videoId":"dQw4w9WgXcQ"}')).type).toBe("youtube");
    })
  );

  it.effect(
    "rejects malformed rich blocks",
    Effect.fnUntraced(function* () {
      const mermaid = yield* Effect.exit(
        decodeBlock('{"type":"code","language":"mermaid","code":"notDiagram A --> B"}')
      );
      expect(Exit.isFailure(mermaid)).toBe(true);
      if (Exit.isFailure(mermaid)) {
        expect(Cause.pretty(mermaid.cause)).toMatch(/Mermaid code blocks/);
      }

      const table = yield* Effect.exit(
        decodeBlock(
          '{"type":"table","rows":[{"cells":[{"children":[{"type":"text","text":"A"}]}]},{"cells":[{"children":[{"type":"text","text":"B"}]},{"children":[{"type":"text","text":"C"}]}]}]}'
        )
      );
      expect(Exit.isFailure(table)).toBe(true);
      if (Exit.isFailure(table)) {
        expect(Cause.pretty(table.cause)).toMatch(/Tables must contain/);
      }

      const youtube = yield* Effect.exit(decodeBlock('{"type":"youtube","videoId":"https://youtu.be/dQw4w9WgXcQ"}'));
      expect(Exit.isFailure(youtube)).toBe(true);
      if (Exit.isFailure(youtube)) {
        expect(Cause.pretty(youtube.cause)).toMatch(/YouTube blocks/);
      }
    })
  );

  it.effect(
    "keeps non-mermaid code blocks unconstrained",
    Effect.fnUntraced(function* () {
      const block = yield* decodeBlock('{"type":"code","language":"typescript","code":"notDiagram A --> B"}');

      expect(block.type).toBe("code");
    })
  );
});
