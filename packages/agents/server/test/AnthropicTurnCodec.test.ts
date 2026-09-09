/**
 * CI-verifiable test (no real LLM): the Anthropic provider codecs must build at
 * module load (a structural guarantee that the v1 block scope stays
 * provider-expressible), and a valid block JSON string must decode into the
 * matching domain block.
 */
import { assistantBlockOutput, assistantOutput } from "@beep/agents-server/AnthropicTurnCodec";
import * as S from "effect/Schema";
import { describe, expect, test } from "vitest";

const decodeUnknownAssistantBlockOutputCodecJsonSync = S.decodeUnknownSync(
  S.fromJsonString(assistantBlockOutput.codec)
);

describe("AnthropicTurnCodec", () => {
  test("codecs build at module load", () => {
    expect(assistantBlockOutput.codec).toBeDefined();
    expect(assistantBlockOutput.jsonSchema).toBeDefined();
    expect(assistantOutput.codec).toBeDefined();
    expect(assistantOutput.jsonSchema).toBeDefined();
  });

  test("decodes a paragraph block from a JSON string slice", () => {
    const block = decodeUnknownAssistantBlockOutputCodecJsonSync(
      '{"type":"paragraph","children":[{"type":"text","text":"hi"}]}'
    );

    expect(block.type).toBe("paragraph");
    if (block.type === "paragraph") {
      expect(block.children).toEqual([{ type: "text", text: "hi" }]);
    }
  });

  test("decodes valid rich blocks", () => {
    expect(
      decodeUnknownAssistantBlockOutputCodecJsonSync(
        '{"type":"code","language":"mermaid","code":"graph TD\\n  A --> B"}'
      ).type
    ).toBe("code");
    expect(
      decodeUnknownAssistantBlockOutputCodecJsonSync(
        '{"type":"table","headerRow":true,"rows":[{"cells":[{"children":[{"type":"text","text":"Name"}]}]},{"cells":[{"children":[{"type":"text","text":"Language"}]}]}]}'
      ).type
    ).toBe("table");
    expect(decodeUnknownAssistantBlockOutputCodecJsonSync('{"type":"youtube","videoId":"dQw4w9WgXcQ"}').type).toBe(
      "youtube"
    );
  });

  test("rejects malformed rich blocks", () => {
    expect(() =>
      decodeUnknownAssistantBlockOutputCodecJsonSync('{"type":"code","language":"mermaid","code":"notDiagram A --> B"}')
    ).toThrow(/Mermaid code blocks/);
    expect(() =>
      decodeUnknownAssistantBlockOutputCodecJsonSync(
        '{"type":"table","rows":[{"cells":[{"children":[{"type":"text","text":"A"}]}]},{"cells":[{"children":[{"type":"text","text":"B"}]},{"children":[{"type":"text","text":"C"}]}]}]}'
      )
    ).toThrow(/Tables must contain/);
    expect(() =>
      decodeUnknownAssistantBlockOutputCodecJsonSync('{"type":"youtube","videoId":"https://youtu.be/dQw4w9WgXcQ"}')
    ).toThrow(/YouTube blocks/);
  });

  test("keeps non-mermaid code blocks unconstrained", () => {
    const block = decodeUnknownAssistantBlockOutputCodecJsonSync(
      '{"type":"code","language":"typescript","code":"notDiagram A --> B"}'
    );

    expect(block.type).toBe("code");
  });
});
