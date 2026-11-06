import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import {
  decodeGrokCanaryOutput,
  GrokCanarySource,
  observeGrokNativeFailureClass,
  observeGrokReportedNotSignedIn,
} from "./grok-exec-wire.ts";

const salt = Redacted.make("synthetic-namespace-only");
const workspace = "/synthetic/owned-pilot";
const catalog = { type: "available_commands", tools: [], commands: ["synthetic-only"] };
const reply = { type: "text", data: "ENROLLMENT_CANARY_OK" };
const terminal = {
  type: "end",
  stopReason: "end_turn",
  sessionId: "PRIVATE_NATIVE_SESSION",
  requestId: "PRIVATE_NATIVE_REQUEST",
  cwd: workspace,
  num_turns: 1,
  usage: { input_tokens: 9, output_tokens: 3 },
  modelUsage: { "grok-4.7-build": { modelCalls: 3 } },
};
const stream = (rows: ReadonlyArray<unknown>) => rows.map((row) => JSON.stringify(row)).join("\n");

it.effect("observes only the qualified error-message literal and discards every native value", () =>
  Effect.gen(function* () {
    const observation = yield* observeGrokReportedNotSignedIn(
      stream([
        {
          type: "error",
          message: "PRIVATE_PREFIX Not signed in PRIVATE_SUFFIX",
          cwd: "/PRIVATE_WORKSPACE",
          spend: "PRIVATE_SPEND",
          code: "PRIVATE_CODE",
        },
      ]),
      1
    );
    expect(observation).toEqual(O.some(true));
    expect(JSON.stringify(observation)).not.toContain("PRIVATE_");
  })
);

for (const [name, stdout, exitStatus] of [
  ["successful exit", stream([{ type: "error", message: "Not signed in" }]), 0],
  ["different error", stream([{ type: "error", message: "PRIVATE_OTHER_ERROR" }]), 1],
  ["wrong case", stream([{ type: "error", message: "not signed in" }]), 1],
  ["missing event type", stream([{ message: "Not signed in" }]), 1],
  ["text event", stream([{ type: "text", message: "Not signed in" }]), 1],
  ["nested message", stream([{ type: "error", error: { message: "Not signed in" } }]), 1],
  ["nonstring message", stream([{ type: "error", message: { private: "Not signed in" } }]), 1],
  ["malformed JSON", '{"type":"error","message":"Not signed in"', 1],
  ["oversized row", stream([{ type: "error", message: "Not signed in", private: "x".repeat(65536) }]), 1],
  ["too many rows", `${"{}\n".repeat(2048)}${stream([{ type: "error", message: "Not signed in" }])}`, 1],
  ["oversized stream", "x".repeat(1048577), 1],
  ["noninteger exit", stream([{ type: "error", message: "Not signed in" }]), 1.5],
  ["unsupported exit", stream([{ type: "error", message: "Not signed in" }]), 4097],
] as const) {
  it.effect(`unqualified native report remains unknown: ${name}`, () =>
    Effect.gen(function* () {
      expect(yield* observeGrokReportedNotSignedIn(stdout, exitStatus)).toEqual(O.none());
    })
  );
}

for (const [message, expected] of [
  ["Not signed in", "auth"],
  [
    "Not signed in. Run `grok login` to authenticate (or `grok login --device-code` if no browser is available).",
    "auth",
  ],
  ["SuperGrok subscription required", "subscription-or-quota"],
  ["Model not found in config.toml [model.*]", "model-unavailable-or-config"],
  ["Connection to Grok timed out or was interrupted. Please try again. (HTTP 504).", "network"],
  ["quota exceeded", "Unknown"],
  ["HTTP 401", "Unknown"],
  ["UNAUTHENTICATED", "Unknown"],
  ["dns error", "Unknown"],
  ["Not signed in PRIVATE_SUFFIX", "Unknown"],
  ["PRIVATE_PREFIX SuperGrok subscription required", "Unknown"],
  ["model unavailable", "Unknown"],
  ["PRIVATE_OTHER_ERROR", "Unknown"],
] as const) {
  it.effect(`classifies only a qualified native failure report: ${expected} ${message}`, () =>
    Effect.gen(function* () {
      const raw = stream([{ type: "error", message, cwd: "PRIVATE_CWD", code: "PRIVATE_CODE" }]);
      expect(yield* observeGrokNativeFailureClass(raw, 1)).toBe(expected);
      expect(yield* observeGrokNativeFailureClass(raw, 0)).toBe("Unknown");
    })
  );
}

for (const stdout of [
  stream([{ type: "text", message: "Not signed in" }]),
  stream([{ type: "error", error: { message: "Not signed in" } }]),
  stream([
    { type: "error", message: "Not signed in" },
    { type: "error", message: "SuperGrok subscription required" },
  ]),
  stream([
    { type: "error", message: "Not signed in" },
    { type: "error", message: "Not signed in" },
  ]),
  `${stream([{ type: "error", message: "Not signed in" }])}\n{`,
  stream([{ type: "error", message: "Not signed in", private: "x".repeat(65536) }]),
  `${"{}\n".repeat(2048)}${stream([{ type: "error", message: "Not signed in" }])}`,
  "x".repeat(1048577),
]) {
  it.effect("ambiguous or unbounded failure reports remain Unknown", () =>
    Effect.gen(function* () {
      expect(yield* observeGrokNativeFailureClass(stdout, 1)).toBe("Unknown");
    })
  );
}

it.layer(NodeCrypto.layer)((it) => {
  it.effect("retains reported retry counters without equating one source invocation with one HTTP request", () =>
    Effect.gen(function* () {
      const source = yield* decodeGrokCanaryOutput(
        stream([catalog, catalog, { type: "thought", data: "PRIVATE_REASONING" }, reply, terminal]),
        salt,
        workspace
      );
      const encoded = yield* S.encodeEffect(S.fromJsonString(GrokCanarySource))(source);
      expect(source.protocol).toBe("grok-build-1.0.77/streaming-json");
      expect(source.sourceInvocations).toBe(1);
      expect(source.nativeHttpRequests).toBe("Unknown");
      expect(source.requestedTitleModel).toBe("grok-4.7");
      expect(source.titleOperationPolicy).toBe("native-private-session-title-metadata-only");
      expect(O.getOrThrow(source.nativeModelUsage)["grok-4.7-build"]?.modelCalls).toBe(3);
      expect(encoded).not.toContain("PRIVATE_");
      expect(encoded).not.toContain("ENROLLMENT_CANARY_OK");
      expect(encoded).not.toContain(workspace);
      expect(O.getOrThrow(source.nativeUsage).cache_read_input_tokens).toEqual(O.none());
    })
  );
  it.effect("accepts exact installed native successful title/main event ordering with a trailing empty catalog", () =>
    Effect.gen(function* () {
      // Network-isolated 1.0.77 fixture: one synthetic session_title result and one
      // synthetic main response; title metadata does not emit executable tool events.
      const source = yield* decodeGrokCanaryOutput(
        stream([
          catalog,
          catalog,
          reply,
          catalog,
          {
            type: "usage",
            usage: {
              input_tokens: 5,
              output_tokens: 3,
              reasoning_tokens: 0,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          },
          {
            ...terminal,
            modelUsage: {
              "grok-4.7": {
                modelCalls: 1,
                inputTokens: 5,
                outputTokens: 3,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
              },
            },
          },
        ]),
        salt,
        workspace
      );
      expect(source.executableToolCount).toBe(0);
      expect(source.nativeHttpRequests).toBe("Unknown");
      expect(O.getOrThrow(source.nativeModelUsage)["grok-4.7"]?.modelCalls).toBe(1);
    })
  );
  it.effect("retains missing usage as unknown and incomplete usage as explicitly incomplete", () =>
    Effect.gen(function* () {
      const source = yield* decodeGrokCanaryOutput(
        stream([
          catalog,
          reply,
          {
            type: "end",
            stopReason: "end_turn",
            sessionId: "synthetic-session",
            requestId: "synthetic-request",
            cwd: workspace,
            usage_is_incomplete: true,
          },
        ]),
        salt,
        workspace
      );
      expect(source.nativeUsage).toEqual(O.none());
      expect(source.nativeModelUsage).toEqual(O.none());
      expect(source.usageIsIncomplete).toEqual(O.some(true));
    })
  );
  const negatives: ReadonlyArray<readonly [string, ReadonlyArray<unknown>]> = [
    ["nonempty executable catalog", [{ ...catalog, tools: ["read_file"] }, reply, terminal]],
    [
      "executable session_title call",
      [catalog, { type: "tool_call", toolName: "session_title", rawInput: "PRIVATE_INPUT" }, reply, terminal],
    ],
    ["tool result", [catalog, { type: "tool_call_update", rawOutput: "PRIVATE_OUTPUT" }, reply, terminal]],
    ["native error", [catalog, { type: "error", message: "PRIVATE_ERROR" }]],
    ["no catalog", [reply, terminal]],
    ["too many catalogs", [catalog, catalog, catalog, catalog, reply, catalog, terminal]],
    ["wrong reply", [catalog, { ...reply, data: "PRIVATE_WRONG_REPLY" }, terminal]],
    ["wrong native CWD", [catalog, reply, { ...terminal, cwd: "/wrong" }]],
    ["deprecated served model", [catalog, reply, { ...terminal, modelUsage: { "grok-4.6": { modelCalls: 1 } } }]],
    ["second main turn", [catalog, reply, { ...terminal, num_turns: 2 }]],
    ["negative counter", [catalog, reply, { ...terminal, usage: { input_tokens: -1 } }]],
    ["truncated stream", [catalog, reply]],
    ["row after terminal", [catalog, reply, terminal, { type: "thought", data: "PRIVATE_TAIL" }]],
    ["refusal", [catalog, reply, { ...terminal, stopReason: "refusal" }]],
  ];
  for (const [name, rows] of negatives) {
    it.effect(`refuses ${name} with a finite content-free error`, () =>
      Effect.gen(function* () {
        const result = yield* decodeGrokCanaryOutput(stream(rows), salt, workspace).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
        expect(String(result)).not.toContain("PRIVATE_");
      })
    );
  }
});
