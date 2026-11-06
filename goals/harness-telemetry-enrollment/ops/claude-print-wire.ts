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
import * as S from "effect/Schema";
import * as Str from "effect/String";

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
const init = S.Struct({
  type: S.tag("system"),
  subtype: S.tag("init"),
  session_id: session,
  claude_code_version: S.Literal("2.1.318"),
  cwd: S.String.check(S.isMaxLength(4096)),
  model: S.Literal("claude-opus-5-5"),
  apiKeySource: S.Literal("none"),
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
    role: S.Literal("assistant"),
    model: S.Literal("claude-opus-5-5"),
    content: S.Array(content).check(S.isMinLength(1), S.isMaxLength(4)),
  }),
});
const terminal = S.Struct({
  type: S.tag("result"),
  subtype: S.Literal("success"),
  session_id: session,
  is_error: S.Literal(false),
  result: S.Literal("ENROLLMENT_CANARY_OK"),
  duration_ms: count,
  duration_api_ms: count,
  num_turns: S.Literal(1),
  permission_denials: empty,
  queued_turn_count: S.OptionFromOptionalKey(S.Literal(0)),
  usage: S.OptionFromOptionalKey(nativeUsage),
  modelUsage: S.OptionFromOptionalKey(S.Record(S.String, modelUsage)),
});
const envelope = S.Struct({ type: S.Literals(["system", "assistant", "result"]) });

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
)("ClaudeCanaryWireError", {}, $I.annote("ClaudeCanaryWireError", { description: "Refused fixed native stream." })) {}

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
  const refusal = () => ClaudeCanaryWireError.make({});
  if (Buffer.byteLength(stdout) > 262144) return yield* refusal();
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  if (lines.length < 3 || lines.length > 16) return yield* refusal();
  const decode = <T extends S.Top>(schema: T, raw: string) =>
    S.decodeEffect(S.fromJsonString(schema))(raw).pipe(Effect.mapError(refusal));
  let sourceSession = O.none<string>();
  let matched = false;
  let retries = 0;
  let uiMessages = 0;
  let completed = O.none<typeof terminal.Type>();
  for (const line of lines) {
    if (O.isSome(completed)) return yield* refusal();
    const kind = yield* decode(envelope, line);
    if (kind.type === "system") {
      const system = yield* decode(systemKind, line);
      if (system.subtype === "ui_invalidate") {
        uiMessages += 1;
        if (uiMessages > 4) return yield* refusal();
        continue;
      }
      if (system.subtype === "api_retry") {
        if (O.isNone(sourceSession) || matched || retries >= 8) return yield* refusal();
        const retry = yield* decode(apiRetry, line);
        if (O.isSome(retry.session_id) && retry.session_id.value !== sourceSession.value) return yield* refusal();
        retries += 1;
        continue;
      }
      if (O.isSome(sourceSession) || matched) return yield* refusal();
      const event = yield* decode(init, line);
      if (event.cwd !== workspace) return yield* refusal();
      const plugins = A.sort(
        A.map(event.plugins, (plugin) => plugin.name),
        Str.Order
      );
      const agents = A.sort(event.agents, Str.Order);
      if (
        A.join(plugins, "\n") !== A.join(A.sort(builtinPlugins, Str.Order), "\n") ||
        A.join(agents, "\n") !== A.join(A.sort(builtinAgents, Str.Order), "\n")
      )
        return yield* refusal();
      sourceSession = O.some(event.session_id);
    } else if (kind.type === "assistant") {
      if (O.isNone(sourceSession) || matched) return yield* refusal();
      const event = yield* decode(assistant, line);
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
      if (O.isNone(sourceSession) || !matched) return yield* refusal();
      const event = yield* decode(terminal, line);
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
  if (O.isNone(sourceSession) || O.isNone(completed)) return yield* refusal();
  const final = completed.value;
  const sourceSessionId = yield* hashPrivateIdentifier(sourceSession.value, O.some(Redacted.value(salt)));
  return ClaudeCanarySource.make({
    sourceSessionId,
    observedRetryNotifications: retries,
    durationMillis: final.duration_ms,
    apiDurationMillis: final.duration_api_ms,
    agentTurns: final.num_turns,
    nativeUsage: final.usage,
    modelUsage: O.flatMap(final.modelUsage, (models) => R.get(models, "claude-opus-5-5")),
  });
});
