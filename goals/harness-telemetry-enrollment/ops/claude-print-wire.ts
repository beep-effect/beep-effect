/**
 * Fixed Claude Code 2.1.318 stream-json projection. All source text is transient.
 * Contract: https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  NativeProtocolDiagnostics as ClaudeCanaryWireDiagnostics,
  NativeProtocolFailure,
} from "./native-attempt-diagnostic.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/claude-print-wire");
const count = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const optionalCount = S.OptionFromOptionalKey(S.NullOr(count));
const nativeUsage = S.Struct({
  input_tokens: optionalCount,
  output_tokens: optionalCount,
  cache_creation_input_tokens: optionalCount,
  cache_read_input_tokens: optionalCount,
});
const modelUsage = S.Struct({
  inputTokens: optionalCount,
  outputTokens: optionalCount,
  cacheReadInputTokens: optionalCount,
  cacheCreationInputTokens: optionalCount,
  thinkingTokens: optionalCount,
  webSearchRequests: optionalCount,
  canonicalModel: S.OptionFromOptionalKey(S.NonEmptyString.check(S.isMaxLength(128))),
  provider: S.OptionFromOptionalKey(S.Literals(["firstParty"])),
});
const empty = S.Array(S.Unknown).check(S.isMaxLength(0));
const session = S.NonEmptyString.check(S.isMaxLength(128));
const builtinPlugins = ["cc-plugin-agents-md", "cc-plugin-privacy", "cc-plugin-plugin-authoring"];
const builtinAgents = ["claude", "Explore", "general-purpose", "Plan"];
const pluginNames = S.Array(S.Struct({ name: S.NonEmptyString.check(S.isMaxLength(128)) })).check(S.isMaxLength(3));
const agentNames = S.Array(S.NonEmptyString.check(S.isMaxLength(128))).check(S.isMaxLength(4));
const systemKind = S.Struct({ type: S.tag("system"), subtype: S.Literals(["init", "ui_invalidate", "api_retry"]) });
const apiRetry = S.Struct({
  type: S.tag("system"),
  subtype: S.tag("api_retry"),
  session_id: S.OptionFromOptionalKey(session),
  attempt: S.OptionFromOptionalKey(count.check(S.isLessThanOrEqualTo(32))),
  max_retries: S.OptionFromOptionalKey(count.check(S.isLessThanOrEqualTo(32))),
  retry_delay_ms: S.OptionFromOptionalKey(count.check(S.isLessThanOrEqualTo(60000))),
});
// SDK 0.3.318 public SDKRateLimitEvent/SDKRateLimitInfo. Unknown fields
// (including arbitrary warning text, UUID and account details) never survive decoding.
const rateStatus = S.Literals(["allowed", "allowed_warning", "rejected"]);
const rateLimitInfo = S.Struct({
  status: rateStatus,
  resetsAt: S.OptionFromOptionalKey(count),
  utilization: S.OptionFromOptionalKey(
    S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))
  ),
});
const rateLimit = S.Struct({
  type: S.tag("rate_limit_event"),
  session_id: session,
  rate_limit_info: rateLimitInfo,
});
const rateCounts = S.Struct({
  allowed: count.check(S.isLessThanOrEqualTo(8)),
  allowedWarning: count.check(S.isLessThanOrEqualTo(8)),
  rejected: count.check(S.isLessThanOrEqualTo(8)),
});
const init = S.Struct({
  type: S.tag("system"),
  subtype: S.tag("init"),
  session_id: session,
  claude_code_version: S.tag("2.1.318"),
  cwd: S.String.check(S.isMaxLength(4096)),
  model: S.tag("claude-opus-5-5"),
  apiKeySource: S.tag("none"),
  tools: empty,
  mcp_servers: empty,
  plugins: pluginNames,
  skills: empty,
  slash_commands: empty,
  agents: agentNames,
  plugin_errors: S.OptionFromOptionalKey(empty),
});
const content = S.Union([
  S.Struct({ type: S.tag("text"), text: S.String.check(S.isMaxLength(1024)) }),
  S.Struct({ type: S.tag("thinking"), thinking: S.String.check(S.isMaxLength(65536)) }),
]);
const assistant = S.Struct({
  type: S.tag("assistant"),
  session_id: session,
  parent_tool_use_id: S.Null,
  error: S.optionalKey(S.Never),
  aborted: S.optionalKey(S.Never),
  agent_id: S.optionalKey(S.Never),
  message: S.Struct({
    role: S.tag("assistant"),
    model: S.tag("claude-opus-5-5"),
    content: S.Array(content).check(S.isMinLength(1), S.isMaxLength(4)),
  }),
});
const terminal = S.Struct({
  type: S.tag("result"),
  subtype: S.tag("success"),
  session_id: session,
  is_error: S.tag(false),
  result: S.tag("ENROLLMENT_CANARY_OK"),
  duration_ms: count,
  duration_api_ms: count,
  num_turns: S.tag(1),
  permission_denials: empty,
  queued_turn_count: S.OptionFromOptionalKey(S.Literal(0)),
  usage: S.OptionFromOptionalKey(nativeUsage),
  modelUsage: S.OptionFromOptionalKey(S.Record(S.String, modelUsage)),
});
const envelope = S.Struct({ type: S.Literals(["system", "assistant", "result", "rate_limit_event"]) });

/**
 * Fixed content-free protocol refusal.
 * **Example** (Inspect the error constructor)
 * ```ts
 * console.log(typeof ClaudeCanaryWireError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ClaudeCanaryWireError extends S.TaggedError<ClaudeCanaryWireError, { readonly brand: unique symbol }>(
  $I`ClaudeCanaryWireError`
)(
  "ClaudeCanaryWireError",
  { reason: NativeProtocolFailure },
  $I.annote("ClaudeCanaryWireError", { description: "Refused fixed native stream." })
) {}

/**
 * Native aggregate usage with absent/null counters retained as unknown.
 * **Details**
 * Input, cache-read, cache-write and output are distinct. Thinking is included in output.
 * Agent turns are not API request counts. No sum or cost estimate becomes a billing claim.
 * **Example** (Inspect the safe source schema)
 * ```ts
 * console.log(typeof ClaudeCanarySource.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaudeCanarySource extends S.Opaque<ClaudeCanarySource, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("claude-canary-source/v1"),
    protocol: S.tag("claude-code-2.1.318/print-stream-json"),
    sourceSessionId: Sha256Hex,
    response: S.tag("exact-constant-matched"),
    requestedModel: S.tag("claude-opus-5-5"),
    requestedEffort: S.tag("medium"),
    pinBasis: S.tag("argv-env-plus-native-init-model"),
    startupTools: S.tag(0),
    startupMcpServers: S.tag(0),
    builtinInventory: S.tag("claude-2.1.318/offline-qualified-builtins-v1"),
    observedRetryNotifications: count.check(S.isLessThanOrEqualTo(8)),
    observedRateLimitNotifications: rateCounts,
    actualApiRequestCount: S.tag("unknown"),
    durationMillis: count,
    apiDurationMillis: count,
    agentTurns: count,
    nativeUsage: S.OptionFromOptionalKey(nativeUsage),
    modelUsage: S.OptionFromOptionalKey(modelUsage),
  }).pipe($I.annoteSchema("ClaudeCanarySource", { description: "Finite native metadata only, never raw source." }))
) {}

/**
 * Validate a single initialization, fixed assistant response and successful terminal result.
 * **Example** (Inspect the decoder)
 * ```ts
 * console.log(typeof decodeClaudeCanaryOutput)
 * ```
 * @param stdout - Bounded transient JSONL, never logged or persisted.
 * @param salt - Existing private namespace salt, never auth material.
 * @param workspace - Exact admitted working directory for native init binding.
 * @returns Content-free evidence after full terminal and inventory validation.
 * @category decoding
 * @since 0.0.0
 */
export const decodeClaudeCanaryOutput = Effect.fn("HarnessEnrollment.decodeClaudePrint")(function* (
  stdout: string,
  salt: Redacted.Redacted<string>,
  workspace: string
) {
  const refusal = (reason: ClaudeCanaryWireError["reason"] = "order") => ClaudeCanaryWireError.make({ reason });
  if (Buffer.byteLength(stdout) > 262144) return yield* refusal("bounds");
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  if (lines.length < 3 || lines.length > 24) return yield* refusal("bounds");
  const decode = <T extends S.Top>(schema: T, raw: string, reason: ClaudeCanaryWireError["reason"]) =>
    S.decodeEffect(S.fromJsonString(schema))(raw).pipe(Effect.mapError(() => refusal(reason)));
  let sourceSession = O.none<string>();
  let matched = false;
  let retries = 0;
  let uiMessages = 0;
  const rateNotifications = { allowed: 0, allowedWarning: 0, rejected: 0 };
  let rateMessages = 0;
  let completed = O.none<typeof terminal.Type>();
  for (const line of lines) {
    const kind = yield* decode(envelope, line, "envelope");
    if (kind.type === "rate_limit_event") {
      if (O.isNone(sourceSession) || rateMessages >= 8) return yield* refusal("order");
      const event = yield* decode(rateLimit, line, "event-kind");
      if (event.session_id !== sourceSession.value) return yield* refusal("order");
      rateMessages += 1;
      if (event.rate_limit_info.status === "allowed") rateNotifications.allowed += 1;
      else if (event.rate_limit_info.status === "allowed_warning") rateNotifications.allowedWarning += 1;
      else rateNotifications.rejected += 1;
      continue;
    }
    if (kind.type === "system") {
      const system = yield* decode(systemKind, line, "event-kind");
      if (system.subtype === "ui_invalidate") {
        uiMessages += 1;
        if (uiMessages > 4) return yield* refusal();
        continue;
      }
      if (O.isSome(completed)) return yield* refusal("order");
      if (system.subtype === "api_retry") {
        if (O.isNone(sourceSession) || matched || retries >= 8) return yield* refusal();
        const retry = yield* decode(apiRetry, line, "retry");
        if (O.isSome(retry.session_id) && retry.session_id.value !== sourceSession.value) return yield* refusal();
        retries += 1;
        continue;
      }
      if (O.isSome(sourceSession) || matched) return yield* refusal();
      const event = yield* decode(init, line, "init");
      if (event.cwd !== workspace) return yield* refusal("init-cwd");
      const plugins = A.sort(
        A.map(event.plugins, (plugin) => plugin.name),
        Str.Order
      );
      const agents = A.sort(event.agents, Str.Order);
      if (
        A.join(plugins, "\n") !== A.join(A.sort(builtinPlugins, Str.Order), "\n") ||
        A.join(agents, "\n") !== A.join(A.sort(builtinAgents, Str.Order), "\n")
      )
        return yield* refusal("init-inventory");
      sourceSession = O.some(event.session_id);
    } else if (kind.type === "assistant") {
      if (O.isSome(completed)) return yield* refusal("order");
      if (O.isNone(sourceSession) || matched) return yield* refusal();
      const event = yield* decode(assistant, line, "assistant");
      if (event.session_id !== sourceSession.value) return yield* refusal();
      let texts = 0;
      for (const block of event.message.content) {
        if (block.type === "text") {
          if (block.text !== "ENROLLMENT_CANARY_OK") return yield* refusal();
          texts += 1;
        }
      }
      if (texts !== 1) return yield* refusal();
      matched = true;
    } else {
      if (O.isSome(completed)) return yield* refusal("order");
      if (O.isNone(sourceSession) || !matched) return yield* refusal();
      const event = yield* decode(terminal, line, "terminal");
      if (event.session_id !== sourceSession.value) return yield* refusal();
      if (O.isSome(event.modelUsage)) {
        const keys = R.keys(event.modelUsage.value);
        if (keys.length !== 1 || keys[0] !== "claude-opus-5-5") return yield* refusal();
        const model = event.modelUsage.value["claude-opus-5-5"];
        if (model === undefined) return yield* refusal();
        if (O.isSome(model.canonicalModel) && model.canonicalModel.value !== "claude-opus-5-5") return yield* refusal();
        if (
          O.isSome(model.webSearchRequests) &&
          model.webSearchRequests.value !== null &&
          model.webSearchRequests.value !== 0
        )
          return yield* refusal();
      }
      completed = O.some(event);
    }
  }
  if (O.isNone(sourceSession) || O.isNone(completed)) return yield* refusal("missing-terminal");
  const final = completed.value;
  const sourceSessionId = yield* hashPrivateIdentifier(sourceSession.value, O.some(Redacted.value(salt)));
  return ClaudeCanarySource.make({
    sourceSessionId,
    observedRetryNotifications: retries,
    observedRateLimitNotifications: rateNotifications,
    durationMillis: final.duration_ms,
    apiDurationMillis: final.duration_api_ms,
    agentTurns: final.num_turns,
    nativeUsage: final.usage,
    modelUsage: O.flatMap(final.modelUsage, (models) => R.get(models, "claude-opus-5-5")),
  });
});

export { NativeProtocolDiagnostics as ClaudeCanaryWireDiagnostics } from "./native-attempt-diagnostic.ts";

/**
 * Inspect bounded transient output, including unsupported native metadata kinds, without accepting it.
 * **Example** (Inspect the diagnostic projector)
 * ```ts
 * console.log(typeof inspectClaudeCanaryOutput)
 * ```
 * @param stdout - Bounded transient native output; never returned or stored.
 * @param workspace - Admitted working directory, compared only as a boolean.
 * @returns Counts and finite booleans; this is not protocol success or a source receipt.
 * @category decoding
 * @since 0.0.0
 */
export const inspectClaudeCanaryOutput = Effect.fn("HarnessEnrollment.inspectClaudePrint")(function* (
  stdout: string,
  workspace: string
) {
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  const selected = A.take(lines, 256);
  const counts = {
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
  let version = O.none<boolean>();
  let model = O.none<boolean>();
  let cwd = O.none<boolean>();
  let auth = O.none<boolean>();
  let inventory = O.none<boolean>();
  let constant = O.none<boolean>();
  for (const line of selected) {
    const parsed = yield* S.decodeEffect(S.fromJsonString(S.Record(S.String, S.Unknown)))(line).pipe(Effect.result);
    if (Result.isFailure(parsed)) {
      counts.malformed += 1;
      continue;
    }
    const value = parsed.success;
    if (value.type === "system") {
      if (value.subtype === "init") {
        counts.init += 1;
        version = O.some(S.is(init.fields.claude_code_version)(value.claude_code_version));
        model = O.some(S.is(init.fields.model)(value.model));
        cwd = O.some(value.cwd === workspace);
        auth = O.some(S.is(init.fields.apiKeySource)(value.apiKeySource));
        const plugins = yield* S.decodeUnknownEffect(pluginNames)(value.plugins).pipe(Effect.result);
        const agents = yield* S.decodeUnknownEffect(agentNames)(value.agents).pipe(Effect.result);
        inventory = O.some(
          S.is(empty)(value.tools) &&
            S.is(empty)(value.mcp_servers) &&
            S.is(empty)(value.skills) &&
            S.is(empty)(value.slash_commands) &&
            Result.isSuccess(plugins) &&
            Result.isSuccess(agents) &&
            A.join(
              A.sort(
                A.map(plugins.success, (plugin) => plugin.name),
                Str.Order
              ),
              "\n"
            ) === A.join(A.sort(builtinPlugins, Str.Order), "\n") &&
            A.join(A.sort(agents.success, Str.Order), "\n") === A.join(A.sort(builtinAgents, Str.Order), "\n")
        );
      } else if (value.subtype === "ui_invalidate") {
        counts.uiInvalidate += 1;
        if (counts.result > 0) counts.trailingUiInvalidate += 1;
      } else if (value.subtype === "api_retry") counts.apiRetry += 1;
      else counts.unknownSystem += 1;
    } else if (value.type === "assistant") {
      counts.assistant += 1;
      if (R.has(value, "error") || R.has(value, "aborted")) counts.assistantError += 1;
    } else if (value.type === "result") {
      counts.result += 1;
      if (value.subtype !== "success" || value.is_error !== false) counts.terminalError += 1;
      constant = O.some(value.result === "ENROLLMENT_CANARY_OK");
    } else if (value.type === "rate_limit_event") counts.rateLimit += 1;
    else counts.unknownRoot += 1;
  }
  return ClaudeCanaryWireDiagnostics.make({
    ...counts,
    bytes: Buffer.byteLength(stdout),
    lines: lines.length,
    inspectedLines: selected.length,
    truncated: selected.length !== lines.length,
    initVersionMatches: version,
    initModelMatches: model,
    initCwdMatches: cwd,
    initAuthMatches: auth,
    initInventoryMatches: inventory,
    terminalConstantMatches: constant,
  });
});
