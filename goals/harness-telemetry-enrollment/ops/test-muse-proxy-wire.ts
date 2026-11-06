import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { decodeMuseProxyCanaryOutput, inspectMuseProxyCanaryOutput, MuseProxyCanarySource } from "./muse-proxy-wire.ts";
import { NativeProtocolDiagnostics } from "./native-attempt-diagnostic.ts";

const salt = Redacted.make("synthetic-private-salt");
const cwd = "/synthetic/workspace";
const initial = {
  type: "system",
  subtype: "init",
  session_id: "PRIVATE_SESSION",
  claude_code_version: "2.1.318",
  cwd,
  model: "muse-wonder-1.0(medium)",
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
    model: "muse-wonder-1.0(medium)",
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
    "muse-wonder-1.0(medium)": {
      inputTokens: 7,
      outputTokens: 4,
      thinkingTokens: 2,
      cacheReadInputTokens: 8,
      cacheCreationInputTokens: 9,
      webSearchRequests: 0,
      canonicalModel: "muse-wonder-1.0(medium)",
      provider: "firstParty",
      costUSD: 99,
    },
  },
};
const output = (events: ReadonlyArray<unknown> = [initial, response, final]) =>
  events.map((row) => JSON.stringify(row)).join("\n");
const decode = (events: ReadonlyArray<unknown> = [initial, response, final]) =>
  decodeMuseProxyCanaryOutput(output(events), salt, cwd);

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
      const encoded = yield* S.encodeEffect(S.fromJsonString(MuseProxyCanarySource))(source);
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
    { ...final, modelUsage: { other: final.modelUsage["muse-wonder-1.0(medium)"] } },
    { ...final, modelUsage: { "muse-wonder-1.0(medium)": { webSearchRequests: 1 } } },
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
      const malformed = yield* decodeMuseProxyCanaryOutput("PRIVATE_NON_JSON", salt, cwd).pipe(Effect.result);
      expect(malformed._tag).toBe("Failure");
      const huge = yield* decodeMuseProxyCanaryOutput("x".repeat(262145), salt, cwd).pipe(Effect.result);
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
      const text = yield* S.encodeEffect(S.fromJsonString(MuseProxyCanarySource))(source);
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

it.effect("diagnostic projection retains only finite model/inventory mismatch booleans and counts", () =>
  Effect.gen(function* () {
    const value = yield* inspectMuseProxyCanaryOutput(
      output([{ ...initial, model: "PRIVATE_OTHER_MODEL" }, response, final]),
      cwd
    );
    expect(value.initModelMatches).toEqual(O.some(false));
    expect(value.initInventoryMatches).toEqual(O.some(true));
    const text = yield* S.encodeEffect(S.fromJsonString(NativeProtocolDiagnostics))(value);
    expect(text).not.toContain("PRIVATE_");
    expect(text).not.toContain("ENROLLMENT_CANARY_OK");
    expect(text).not.toContain(cwd);
  })
);

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
        const text = yield* S.encodeEffect(S.fromJsonString(MuseProxyCanarySource))(source);
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

const sdkAssistantErrorKinds = [
  "authentication_failed",
  "oauth_org_not_allowed",
  "account_on_hold",
  "verification_required",
  "billing_error",
  "rate_limit",
  "overloaded",
  "invalid_request",
  "model_not_found",
  "server_error",
  "unknown",
  "max_output_tokens",
  "cloud_credential_error",
];
const sdkTerminalErrorSubtypes = [
  "error_during_execution",
  "error_max_turns",
  "error_max_budget_usd",
  "error_max_structured_output_retries",
];
const assistantFailure = (error: unknown) => ({ ...response, error, uuid: "PRIVATE_UUID" });
const terminalFailure = (subtype: unknown) => ({
  ...final,
  subtype,
  is_error: true,
  result: "PRIVATE_RESULT",
  errors: ["PRIVATE_ERROR_MESSAGE"],
});
for (const kind of sdkAssistantErrorKinds) {
  it.effect(`retains only the reported SDK assistant ${kind} count`, () =>
    Effect.gen(function* () {
      const diagnostic = yield* inspectMuseProxyCanaryOutput(output([initial, assistantFailure(kind)]), cwd);
      const reported = O.getOrThrow(diagnostic.reportedSdkErrors);
      expect(Object.entries(reported.assistant).filter(([, n]) => n !== 0)).toEqual([[kind, 1]]);
      expect(reported.assistantUnclassified).toBe(0);
      const encoded = yield* S.encodeEffect(S.fromJsonString(NativeProtocolDiagnostics))(diagnostic);
      expect(encoded).not.toContain("PRIVATE_");
      expect(encoded).not.toContain(cwd);
    })
  );
}
for (const subtype of sdkTerminalErrorSubtypes) {
  it.effect(`retains only the reported terminal ${subtype} count`, () =>
    Effect.gen(function* () {
      const diagnostic = yield* inspectMuseProxyCanaryOutput(output([initial, terminalFailure(subtype)]), cwd);
      const reported = O.getOrThrow(diagnostic.reportedSdkErrors);
      expect(Object.entries(reported.terminal).filter(([, n]) => n !== 0)).toEqual([[subtype, 1]]);
      const encoded = yield* S.encodeEffect(S.fromJsonString(NativeProtocolDiagnostics))(diagnostic);
      expect(encoded).not.toContain("PRIVATE_");
    })
  );
}
it.effect("drops unknown kind strings and malformed values into finite unclassified counts", () =>
  Effect.gen(function* () {
    for (const unknown of ["PRIVATE_UNKNOWN_ERROR", { body: "PRIVATE_SECRET" }, null, 7]) {
      const diagnostic = yield* inspectMuseProxyCanaryOutput(
        output([initial, assistantFailure(unknown), terminalFailure(unknown)]),
        cwd
      );
      const reported = O.getOrThrow(diagnostic.reportedSdkErrors);
      expect(reported.assistantUnclassified).toBe(1);
      expect(reported.terminalUnclassified).toBe(1);
      expect(Object.values(reported.assistant).every((n) => n === 0)).toBe(true);
      expect(Object.values(reported.terminal).every((n) => n === 0)).toBe(true);
      expect(yield* S.encodeEffect(S.fromJsonString(NativeProtocolDiagnostics))(diagnostic)).not.toContain("PRIVATE_");
    }
  })
);
it.effect("projects no SDK kind from foreign, subagent, aborted or out-of-order error frames", () =>
  Effect.gen(function* () {
    const failure = assistantFailure("rate_limit");
    const end = terminalFailure("error_during_execution");
    for (const events of [
      [failure, initial],
      [initial, { ...failure, session_id: "PRIVATE_FOREIGN" }, { ...end, session_id: "PRIVATE_FOREIGN" }],
      [initial, { ...failure, parent_tool_use_id: "PRIVATE_TOOL" }, { ...end, parent_tool_use_id: "PRIVATE_TOOL" }],
      [initial, { ...failure, agent_id: "PRIVATE_AGENT" }, { ...end, agent_id: "PRIVATE_AGENT" }],
      [initial, { ...failure, aborted: true }],
      [{ ...initial, tools: ["Read"] }, failure, end],
      [{ ...initial, model: "PRIVATE_WRONG_MODEL" }, failure, end],
      [initial, { ...initial, session_id: "PRIVATE_SECOND" }, failure, end],
      [initial, final, failure, end],
    ]) {
      const diagnostic = yield* inspectMuseProxyCanaryOutput(output(events), cwd);
      const reported = O.getOrThrow(diagnostic.reportedSdkErrors);
      expect(
        [
          ...Object.values(reported.assistant),
          ...Object.values(reported.terminal),
          reported.assistantUnclassified,
          reported.terminalUnclassified,
        ].every((n) => n === 0)
      ).toBe(true);
    }
  })
);
it.effect("bounds SDK kind projection to the existing24line and1MiB native protocol limits", () =>
  Effect.gen(function* () {
    for (const events of [
      [initial, ...Array.from({ length: 24 }, () => assistantFailure("rate_limit"))],
      [initial, { ...assistantFailure("rate_limit"), privateBody: "x".repeat(1048576) }],
    ]) {
      const diagnostic = yield* inspectMuseProxyCanaryOutput(output(events), cwd);
      const reported = O.getOrThrow(diagnostic.reportedSdkErrors);
      expect(reported.assistant.rate_limit).toBe(0);
      expect(reported.assistantUnclassified).toBe(0);
    }
  })
);

it.effect("leaves the prior diagnostic encoding unchanged when the optional SDK projection is absent", () =>
  Effect.gen(function* () {
    const old = {
      version: "native-print-protocol-diagnostics/v1",
      bytes: 0,
      lines: 0,
      inspectedLines: 0,
      truncated: false,
      malformed: 0,
      init: 0,
      assistant: 0,
      result: 0,
      uiInvalidate: 0,
      trailingUiInvalidate: 0,
      apiRetry: 0,
      rateLimit: 0,
      unknownRoot: 0,
      unknownSystem: 0,
      assistantError: 0,
      terminalError: 0,
    };
    const decoded = yield* S.decodeUnknownEffect(NativeProtocolDiagnostics)(old);
    expect(O.isNone(decoded.reportedSdkErrors)).toBe(true);
    expect(yield* S.encodeEffect(S.fromJsonString(NativeProtocolDiagnostics))(decoded)).toBe(JSON.stringify(old));
  })
);

it.effect("a successful turn never manufactures an unclassified error from missing error fields", () =>
  Effect.gen(function* () {
    const diagnostic = yield* inspectMuseProxyCanaryOutput(output(), cwd);
    const reported = O.getOrThrow(diagnostic.reportedSdkErrors);
    expect(
      [
        ...Object.values(reported.assistant),
        ...Object.values(reported.terminal),
        reported.assistantUnclassified,
        reported.terminalUnclassified,
      ].every((n) => n === 0)
    ).toBe(true);
  })
);
