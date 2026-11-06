import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { ClaudeCanarySource, decodeClaudeCanaryOutput, inspectClaudeCanaryOutput } from "./claude-print-wire.ts";

const salt = Redacted.make("synthetic-private-salt");
const cwd = "/synthetic/workspace";
const initial = {
  type: "system",
  subtype: "init",
  session_id: "PRIVATE_SESSION",
  claude_code_version: "2.1.318",
  cwd,
  model: "claude-opus-5-5",
  apiKeySource: "none",
  tools: [],
  mcp_servers: [],
  plugins: [{ name: "cc-plugin-agents-md" }, { name: "cc-plugin-privacy" }, { name: "cc-plugin-plugin-authoring" }],
  agents: ["claude", "Explore", "general-purpose", "Plan"],
  skills: [],
  slash_commands: [],
};
const response = {
  type: "assistant",
  session_id: "PRIVATE_SESSION",
  parent_tool_use_id: null,
  message: {
    role: "assistant",
    model: "claude-opus-5-5",
    content: [
      { type: "thinking", thinking: "PRIVATE_REASONING" },
      { type: "text", text: "ENROLLMENT_CANARY_OK" },
    ],
  },
};
const final = {
  type: "result",
  subtype: "success",
  session_id: "PRIVATE_SESSION",
  is_error: false,
  result: "ENROLLMENT_CANARY_OK",
  duration_ms: 30,
  duration_api_ms: 20,
  num_turns: 1,
  permission_denials: [],
  usage: { input_tokens: 7, output_tokens: 4, cache_read_input_tokens: 8, cache_creation_input_tokens: 9 },
  modelUsage: {
    "claude-opus-5-5": {
      inputTokens: 7,
      outputTokens: 4,
      thinkingTokens: 2,
      cacheReadInputTokens: 8,
      cacheCreationInputTokens: 9,
      webSearchRequests: 0,
      canonicalModel: "claude-opus-5-5",
      provider: "firstParty",
      costUSD: 99,
    },
  },
};
const output = (events: ReadonlyArray<unknown> = [initial, response, final]) =>
  events.map((row) => JSON.stringify(row)).join("\n");
const decode = (events: ReadonlyArray<unknown> = [initial, response, final]) =>
  decodeClaudeCanaryOutput(output(events), salt, cwd);

it.layer(NodeCrypto.layer)((it) => {
  it.effect("projects empty native inventory and independent cache categories without text or cost", () =>
    Effect.gen(function* () {
      const source = yield* decode();
      expect(source.startupTools).toBe(0);
      expect(source.sourceSessionId).toMatch(/^[a-f0-9]{64}$/);
      expect(O.getOrThrow(O.getOrThrow(source.nativeUsage).input_tokens)).toBe(7);
      expect(O.getOrThrow(O.getOrThrow(source.nativeUsage).cache_read_input_tokens)).toBe(8);
      expect(O.getOrThrow(O.getOrThrow(source.modelUsage).outputTokens)).toBe(4);
      expect(O.getOrThrow(O.getOrThrow(source.modelUsage).thinkingTokens)).toBe(2);
      const encoded = yield* S.encodeEffect(S.fromJsonString(ClaudeCanarySource))(source);
      expect(encoded).not.toContain("PRIVATE_");
      expect(encoded).not.toContain("ENROLLMENT_CANARY_OK");
      expect(encoded).not.toContain("costUSD");
      expect(encoded).not.toContain(cwd);
    })
  );
  it.effect("keeps missing and null usage unknown without manufacturing zero counters", () =>
    Effect.gen(function* () {
      const missing = yield* decode([initial, response, { ...final, usage: undefined, modelUsage: undefined }]);
      expect(O.isNone(missing.nativeUsage)).toBe(true);
      expect(O.isNone(missing.modelUsage)).toBe(true);
      const partial = yield* decode([
        initial,
        response,
        { ...final, usage: { input_tokens: null }, modelUsage: undefined },
      ]);
      expect(O.getOrThrow(O.getOrThrow(partial.nativeUsage).input_tokens)).toBe(null);
      expect(O.isNone(O.getOrThrow(partial.nativeUsage).output_tokens)).toBe(true);
    })
  );
  for (const altered of [
    { ...initial, tools: ["Read"] },
    { ...initial, mcp_servers: [{ name: "PRIVATE_SERVER", status: "connected" }] },
    { ...initial, plugins: [{ name: "PRIVATE_PLUGIN", path: "PRIVATE_PATH" }] },
    { ...initial, skills: ["PRIVATE_SKILL"] },
    { ...initial, agents: ["PRIVATE_AGENT"] },
    { ...initial, model: "unapproved" },
    { ...initial, claude_code_version: "future" },
    { ...initial, cwd: "/wrong" },
    { ...initial, apiKeySource: "apiKeyHelper" },
  ]) {
    it.effect("refuses native init inventory or identity mismatch", () =>
      Effect.gen(function* () {
        const result = yield* decode([altered, response, final]).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
        expect(String(result)).not.toContain("PRIVATE_");
      })
    );
  }
  for (const bad of [
    { ...final, subtype: "error_during_execution", errors: ["PRIVATE_ERROR"] },
    { ...final, is_error: true },
    { ...final, session_id: "WRONG" },
    { ...final, result: "PRIVATE_WRONG_RESULT" },
    { ...final, permission_denials: [{}] },
    { ...final, queued_turn_count: 1 },
    { ...final, num_turns: 2 },
    { ...final, usage: { input_tokens: -1 } },
    { ...final, usage: { input_tokens: 1.2 } },
    { ...final, usage: { input_tokens: Number.MAX_SAFE_INTEGER + 1 } },
    { ...final, modelUsage: { other: final.modelUsage["claude-opus-5-5"] } },
    { ...final, modelUsage: { "claude-opus-5-5": { webSearchRequests: 1 } } },
  ]) {
    it.effect("refuses failed terminal, invalid counters or foreign model without leaking native errors", () =>
      Effect.gen(function* () {
        const result = yield* decode([initial, response, bad]).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
        expect(String(result)).not.toContain("PRIVATE_");
      })
    );
  }
  for (const events of [
    [response, initial, final],
    [initial, final],
    [initial, response],
    [initial, initial, response, final],
    [initial, response, final, final],
    [initial, { ...response, error: "authentication_failed" }, final],
    [initial, { ...response, aborted: true }, final],
    [initial, { ...response, agent_id: "PRIVATE_SUBAGENT" }, final],
    [initial, response, response, final],
    [
      initial,
      {
        ...response,
        message: { ...response.message, content: [{ type: "tool_use", id: "PRIVATE_TOOL", name: "Read", input: {} }] },
      },
      final,
    ],
    [
      initial,
      { ...response, message: { ...response.message, content: [{ type: "text", text: "PRIVATE_REPLY" }] } },
      final,
    ],
    [initial, { type: "system", subtype: "hook_started", hook_id: "PRIVATE_HOOK" }, response, final],
  ]) {
    it.effect("refuses missing, duplicate, reordered and tool-bearing stream events", () =>
      Effect.gen(function* () {
        const result = yield* decode(events).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
        expect(String(result)).not.toContain("PRIVATE_");
      })
    );
  }
  it.effect("rejects malformed and oversized private streams", () =>
    Effect.gen(function* () {
      const malformed = yield* decodeClaudeCanaryOutput("PRIVATE_NON_JSON", salt, cwd).pipe(Effect.result);
      expect(malformed._tag).toBe("Failure");
      const huge = yield* decodeClaudeCanaryOutput("x".repeat(262145), salt, cwd).pipe(Effect.result);
      expect(huge._tag).toBe("Failure");
    })
  );
});

it.layer(NodeCrypto.layer)((it) => {
  it.effect("counts typed native retry notifications and discards bounded UI/message bodies", () =>
    Effect.gen(function* () {
      const source = yield* decode([
        { type: "system", subtype: "ui_invalidate", body: "PRIVATE_UI" },
        initial,
        {
          type: "system",
          subtype: "api_retry",
          session_id: "PRIVATE_SESSION",
          attempt: 1,
          max_retries: 3,
          retry_delay_ms: 20,
          error: "PRIVATE_NATIVE_ERROR",
        },
        response,
        final,
      ]);
      expect(source.observedRetryNotifications).toBe(1);
      expect(source.actualApiRequestCount).toBe("unknown");
      const text = yield* S.encodeEffect(S.fromJsonString(ClaudeCanarySource))(source);
      expect(text).not.toContain("PRIVATE_");
    })
  );
  for (const events of [
    [initial, { type: "system", subtype: "api_retry", attempt: -1 }, response, final],
    [initial, { type: "system", subtype: "api_retry", session_id: "OTHER" }, response, final],
    [initial, response, { type: "system", subtype: "api_retry" }, final],
    [initial, ...Array.from({ length: 9 }, () => ({ type: "system", subtype: "api_retry" })), response, final],
    [initial, ...Array.from({ length: 5 }, () => ({ type: "system", subtype: "ui_invalidate" })), response, final],
  ])
    it.effect("refuses malformed, excessive or misplaced native retry/UI notifications", () =>
      Effect.gen(function* () {
        const result = yield* decode(events).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
      })
    );
});

it.layer(NodeCrypto.layer)((it) => {
  it.effect("accepts only bounded harmless trailing UI invalidations after one valid terminal", () =>
    Effect.gen(function* () {
      const source = yield* decode([
        initial,
        response,
        final,
        { type: "system", subtype: "ui_invalidate", private: "PRIVATE_UI" },
      ]);
      expect(source.observedRetryNotifications).toBe(0);
    })
  );
  it.effect("projects refusal diagnostics without promoting unsupported native metadata or private text", () =>
    Effect.gen(function* () {
      const raw = output([initial, { type: "rate_limit_event", private: "PRIVATE_METADATA" }, response, final]);
      const refused = yield* decodeClaudeCanaryOutput(raw, salt, cwd).pipe(Effect.result);
      expect(refused._tag).toBe("Failure");
      const meta = yield* inspectClaudeCanaryOutput(raw, cwd);
      expect(meta.rateLimit).toBe(1);
      expect(meta.init).toBe(1);
      expect(meta.result).toBe(1);
      expect(meta.initModelMatches).toEqual(O.some(true));
      expect(JSON.stringify(meta)).not.toContain("PRIVATE_");
      expect(JSON.stringify(meta)).not.toContain("ENROLLMENT_CANARY_OK");
    })
  );
});

const rate = (status = "allowed") => ({
  type: "rate_limit_event",
  session_id: "PRIVATE_SESSION",
  uuid: "PRIVATE_UUID",
  rate_limit_info: { status, resetsAt: 1793917200, utilization: 1.25, arbitrary: "PRIVATE_ACCOUNT" },
  message: "PRIVATE_WARNING",
});

it.layer(NodeCrypto.layer)((it) => {
  for (const status of ["allowed", "allowed_warning", "rejected"]) {
    it.effect(`accepts bounded ${status} notification only with the complete valid turn`, () =>
      Effect.gen(function* () {
        const source = yield* decode([initial, rate(status), response, final]);
        const trailing = yield* decode([initial, response, final, rate(status)]);
        expect(trailing.observedRateLimitNotifications).toEqual(source.observedRateLimitNotifications);
        expect(source.observedRateLimitNotifications).toEqual({
          allowed: status === "allowed" ? 1 : 0,
          allowedWarning: status === "allowed_warning" ? 1 : 0,
          rejected: status === "rejected" ? 1 : 0,
        });
        expect(source.actualApiRequestCount).toBe("unknown");
        const text = yield* S.encodeEffect(S.fromJsonString(ClaudeCanarySource))(source);
        expect(text).not.toContain("PRIVATE_");
        expect(text).not.toContain("1793917200");
        expect(text).not.toContain("1.25");
      })
    );
  }
  it.effect("retains repeated status counts without treating notifications as API calls", () =>
    Effect.gen(function* () {
      const source = yield* decode([initial, rate("rejected"), rate("rejected"), response, rate("allowed"), final]);
      expect(source.observedRateLimitNotifications).toEqual({ allowed: 1, allowedWarning: 0, rejected: 2 });
      expect(source.actualApiRequestCount).toBe("unknown");
    })
  );
  it.effect("accepts the combined finite notification ceilings and omitted optional numeric metadata", () =>
    Effect.gen(function* () {
      const source = yield* decode([
        initial,
        ...Array.from({ length: 8 }, () => ({ type: "system", subtype: "api_retry" })),
        ...Array.from({ length: 8 }, () => ({
          type: "rate_limit_event",
          session_id: "PRIVATE_SESSION",
          rate_limit_info: { status: "allowed" },
        })),
        response,
        final,
        ...Array.from({ length: 4 }, () => ({ type: "system", subtype: "ui_invalidate" })),
      ]);
      expect(source.observedRetryNotifications).toBe(8);
      expect(source.observedRateLimitNotifications.allowed).toBe(8);
    })
  );
  for (const events of [
    [rate(), initial, response, final],
    [initial, { ...rate(), session_id: "OTHER" }, response, final],
    [initial, rate("unknown"), response, final],
    [initial, { ...rate(), rate_limit_info: { status: "allowed", resetsAt: -1 } }, response, final],
    [initial, { ...rate(), rate_limit_info: { status: "allowed", utilization: -0.1 } }, response, final],
    [initial, { ...rate(), rate_limit_info: { status: "allowed", utilization: "PRIVATE_INVALID" } }, response, final],
    [initial, ...Array.from({ length: 9 }, () => rate()), response, final],
    [initial, rate("rejected"), response],
    [initial, rate("rejected"), response, { ...final, subtype: "error_during_execution", is_error: true }],
    [initial, rate("rejected"), response, final, final],
  ]) {
    it.effect("refuses malformed/excessive rate metadata and rejected turns without one valid terminal", () =>
      Effect.gen(function* () {
        const result = yield* decode(events).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
        expect(String(result)).not.toContain("PRIVATE_");
      })
    );
  }
});
