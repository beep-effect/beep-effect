/**
 * Narrow rust-v0.166.0 Codex exec JSONL projection for one fixed canary.
 * Source: codex-rs/exec/src/exec_events.rs, SHA256 dafa872d7e86a099e56e28a329dcb9c03db90ed768c3b88cca8c91d46dc1d0e5.
 * Prompt/response/reasoning/error bodies never leave this decoding boundary.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/codex-exec-wire");
const count = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)).pipe(
  $I.annoteSchema("ReportedCodexTokenCount", {
    description: "Native reported count only; not normalized or summed into controller usage.",
  })
);
const usage = S.Struct({
  input_tokens: count,
  cached_input_tokens: count,
  output_tokens: count,
  reasoning_output_tokens: count,
  cache_write_input_tokens: S.OptionFromOptionalKey(count),
}).pipe(
  $I.annoteSchema("CodexExecUsage0166", {
    description: "Version-pinned native fields with missing cache-write retained as unknown.",
  })
);
const reasoningItem = S.Struct({
  id: S.NonEmptyString.check(S.isMaxLength(128)),
  type: S.tag("reasoning"),
  text: S.String.check(S.isMaxLength(65536)),
});
const item = S.Union([
  S.Struct({
    id: S.NonEmptyString.check(S.isMaxLength(128)),
    type: S.tag("agent_message"),
    text: S.String.check(S.isMaxLength(1024)),
  }),
  reasoningItem,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("CodexCanaryItem", {
    description: "Only one response and discard-only reasoning are permitted; tool items are refused.",
  })
);
const wire = S.Union([
  S.Struct({ type: S.tag("thread.started"), thread_id: S.NonEmptyString.check(S.isMaxLength(128)) }),
  S.Struct({ type: S.tag("turn.started") }),
  S.Struct({ type: S.tag("turn.completed"), usage }),
  S.Struct({ type: S.tag("item.started"), item: reasoningItem }),
  S.Struct({ type: S.tag("item.updated"), item: reasoningItem }),
  S.Struct({ type: S.tag("item.completed"), item }),
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("CodexCanaryExecEvent", {
    description: "Pinned one-turn native protocol; failures, tool calls and unknown kinds fail closed.",
  })
);

/**
 * Fixed protocol refusal with no native content or identifiers.
 * **Example** (Inspect the failure constructor)
 * ```ts
 * console.log(typeof CodexCanaryWireError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CodexCanaryWireError extends S.TaggedError<CodexCanaryWireError, { readonly brand: unique symbol }>(
  $I`CodexCanaryWireError`
)(
  "CodexCanaryWireError",
  {},
  $I.annote("CodexCanaryWireError", { description: "Unsupported, failed, ambiguous or mismatched one-shot protocol." })
) {}

/**
 * Safe source metadata after terminal validation; all counts remain native reported fields.
 * **Example** (Inspect the safe source schema)
 * ```ts
 * console.log(typeof CodexCanarySource.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CodexCanarySource extends S.Opaque<CodexCanarySource, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("codex-canary-source/v1"),
    sourceSessionId: Sha256Hex,
    protocol: S.tag("rust-v0.166.0/exec-jsonl"),
    response: S.tag("exact-constant-matched"),
    nativeUsage: usage,
    requestedModel: S.tag("gpt-6.1-sol"),
    requestedEffort: S.tag("medium"),
    pinBasis: S.tag("launch-enforced"),
  }).pipe(
    $I.annoteSchema("CodexCanarySource", {
      description: "Hashed native thread identity and reported counters; no provider or runtime-model inference.",
    })
  )
) {}

/**
 * Validate one native thread, one completed turn and one exact harmless response.
 *
 * **Example** (Inspect the decoder)
 * ```ts
 * console.log(typeof decodeCodexCanaryOutput)
 * ```
 * @param stdout - Bounded transient native JSONL; never logged or persisted.
 * @param salt - Existing private namespace salt, never native auth material.
 * @returns Safe hashed source evidence; response and reasoning text are discarded.
 * @category decoding
 * @since 0.0.0
 */
export const decodeCodexCanaryOutput = Effect.fn("HarnessEnrollment.decodeCodexExec")(function* (
  stdout: string,
  salt: Redacted.Redacted<string>
) {
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  if (lines.length === 0 || lines.length > 128 || Str.length(stdout) > 262144)
    return yield* CodexCanaryWireError.make({});
  let session = O.none<string>();
  let active = false;
  let matched = false;
  let reported = O.none<typeof usage.Type>();
  let completed = HashSet.empty<string>();
  let reasoning = HashSet.empty<string>();
  for (const line of lines) {
    const event = yield* S.decodeEffect(S.fromJsonString(wire), { onExcessProperty: "error" })(line).pipe(
      Effect.mapError(() => CodexCanaryWireError.make({}))
    );
    if (wire.guards["thread.started"](event)) {
      if (O.isSome(session) || active || matched || O.isSome(reported)) return yield* CodexCanaryWireError.make({});
      session = O.some(event.thread_id);
    } else if (wire.guards["turn.started"](event)) {
      if (O.isNone(session) || active || matched || O.isSome(reported)) return yield* CodexCanaryWireError.make({});
      active = true;
    } else if (wire.guards["turn.completed"](event)) {
      if (!active || !matched || O.isSome(reported) || HashSet.size(reasoning) !== 0)
        return yield* CodexCanaryWireError.make({});
      reported = O.some(event.usage);
      active = false;
    } else if (wire.guards["item.started"](event) || wire.guards["item.updated"](event)) {
      if (!active || matched || O.isSome(reported) || HashSet.has(completed, event.item.id))
        return yield* CodexCanaryWireError.make({});
      if (wire.guards["item.started"](event)) {
        if (HashSet.has(reasoning, event.item.id)) return yield* CodexCanaryWireError.make({});
        reasoning = HashSet.add(reasoning, event.item.id);
      } else if (!HashSet.has(reasoning, event.item.id)) return yield* CodexCanaryWireError.make({});
    } else {
      if (!active || O.isSome(reported)) return yield* CodexCanaryWireError.make({});
      if (HashSet.has(completed, event.item.id)) return yield* CodexCanaryWireError.make({});
      completed = HashSet.add(completed, event.item.id);
      if (item.guards.agent_message(event.item)) {
        if (matched || event.item.text !== "ENROLLMENT_CANARY_OK") return yield* CodexCanaryWireError.make({});
        if (HashSet.size(reasoning) !== 0) return yield* CodexCanaryWireError.make({});
        matched = true;
      } else {
        if (matched) return yield* CodexCanaryWireError.make({});
        reasoning = HashSet.remove(reasoning, event.item.id);
      }
    }
  }
  if (active || !matched || O.isNone(session) || O.isNone(reported)) return yield* CodexCanaryWireError.make({});
  return CodexCanarySource.make({
    sourceSessionId: yield* hashPrivateIdentifier(session.value, O.some(Redacted.value(salt))),
    nativeUsage: reported.value,
  });
});
