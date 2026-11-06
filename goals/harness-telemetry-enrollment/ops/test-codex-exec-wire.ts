import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CodexCanarySource, decodeCodexCanaryOutput } from "./codex-exec-wire.ts";

const salt = Redacted.make("synthetic-canary-namespace");
const begin = '{"type":"thread.started","thread_id":"synthetic-private-thread"}\n{"type":"turn.started"}\n';
const response =
  '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"ENROLLMENT_CANARY_OK"}}\n';
const end =
  '{"type":"turn.completed","usage":{"input_tokens":42,"cached_input_tokens":4,"output_tokens":3,"reasoning_output_tokens":1}}\n';
const valid = `${begin}{"type":"item.completed","item":{"id":"reason_0","type":"reasoning","text":"PRIVATE_REASONING_SENTINEL"}}\n${response}${end}`;

it.layer(NodeCrypto.layer)((it) => {
  it.effect("drops response, reasoning and raw session while preserving only typed native counts", () =>
    Effect.gen(function* () {
      const safe = yield* decodeCodexCanaryOutput(valid, salt);
      const json = yield* S.encodeEffect(S.fromJsonString(CodexCanarySource))(safe);
      expect(json).not.toContain("PRIVATE_REASONING_SENTINEL");
      expect(json).not.toContain("ENROLLMENT_CANARY_OK");
      expect(json).not.toContain("synthetic-private-thread");
      expect(safe.nativeUsage.input_tokens).toBe(42);
      expect(safe.nativeUsage.cache_write_input_tokens).toEqual(O.none());
      expect(safe.pinBasis).toBe("launch-enforced");
    })
  );
  it.effect("permits only ordered transient reasoning lifecycle and discards its text", () =>
    Effect.gen(function* () {
      const events =
        '{"type":"item.started","item":{"id":"r","type":"reasoning","text":"PRIVATE_BEGIN"}}\n' +
        '{"type":"item.updated","item":{"id":"r","type":"reasoning","text":"PRIVATE_UPDATE"}}\n' +
        '{"type":"item.completed","item":{"id":"r","type":"reasoning","text":"PRIVATE_END"}}\n';
      const safe = yield* decodeCodexCanaryOutput(`${begin}${events}${response}${end}`, salt);
      expect(yield* S.encodeEffect(S.fromJsonString(CodexCanarySource))(safe)).not.toContain("PRIVATE_");
    })
  );
  for (const [name, input] of [
    [
      "reasoning update before start",
      `${begin}{"type":"item.updated","item":{"id":"r","type":"reasoning","text":"PRIVATE"}}\n${response}${end}`,
    ],
    [
      "unfinished reasoning",
      `${begin}{"type":"item.started","item":{"id":"r","type":"reasoning","text":"PRIVATE"}}\n${response}${end}`,
    ],
    [
      "unknown fields",
      `${begin}${Str.replace('"type":"agent_message"', '"type":"agent_message","unknown":"PRIVATE"')(response)}${end}`,
    ],
    ["wrong constant", `${begin}${Str.replace("ENROLLMENT_CANARY_OK", "WRONG_PRIVATE_REPLY")(response)}${end}`],
    ["duplicate response", `${begin}${response}${response}${end}`],
    ["second turn", `${valid}{"type":"turn.started"}\n`],
    [
      "tool item",
      `${begin}{"type":"item.completed","item":{"id":"tool","type":"command_execution","command":"PRIVATE_COMMAND"}}\n${response}${end}`,
    ],
    ["failed turn", `${begin}{"type":"turn.failed","error":{"message":"PRIVATE_ERROR"}}\n`],
    ["negative usage", `${begin}${response}${Str.replace('"input_tokens":42', '"input_tokens":-1')(end)}`],
    ["truncated", `${begin}${response}`],
    ["extra thread", `${begin}${begin}${response}${end}`],
  ]) {
    it.effect(`refuses ${name} without leaking native content in the error`, () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(decodeCodexCanaryOutput(input ?? "", salt));
        expect(result._tag).toBe("Failure");
        expect(String(result)).not.toContain("PRIVATE_");
      })
    );
  }
});
