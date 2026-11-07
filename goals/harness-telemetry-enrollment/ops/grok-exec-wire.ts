/**
 * Bounded Grok Build1.0.77 native NDJSON for one fixed user turn.
 * The executable tool catalog must be empty. Native private session-title
 * operations and HTTP retries are separate from the single source invocation.
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

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/grok-exec-wire");
const count = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)).pipe(
  $I.annoteSchema("GrokReportedCount", {
    description: "Native reported count; never a normalized usage or billing claim.",
  })
);
const usage = S.Struct({
  input_tokens: S.OptionFromOptionalKey(count),
  cache_read_input_tokens: S.OptionFromOptionalKey(count),
  cache_creation_input_tokens: S.OptionFromOptionalKey(count),
  output_tokens: S.OptionFromOptionalKey(count),
  reasoning_tokens: S.OptionFromOptionalKey(count),
  total_tokens: S.OptionFromOptionalKey(count),
}).pipe(
  $I.annoteSchema("GrokReportedUsage", { description: "Missing counters remain unknown; no totals are invented." })
);
const modelRow = S.Struct({
  inputTokens: S.OptionFromOptionalKey(count),
  outputTokens: S.OptionFromOptionalKey(count),
  cacheReadInputTokens: S.OptionFromOptionalKey(count),
  cacheCreationInputTokens: S.OptionFromOptionalKey(count),
  reasoningTokens: S.OptionFromOptionalKey(count),
  modelCalls: count,
}).pipe(
  $I.annoteSchema("GrokReportedModelRow", {
    description: "Prompt-ledger fields only; separate native title requests may not be represented.",
  })
);
const modelUsage = S.Record(S.String.check(S.isMaxLength(128)), modelRow)
  .check(
    S.makeFilter((value) => R.size(value) <= 2, {
      description: "At most the two approved Grok4.7 native model labels.",
    })
  )
  .pipe(
    $I.annoteSchema("GrokReportedModelUsage", {
      description: "Transient native model rows; cost and unknown fields are discarded.",
    })
  );
const identifier = S.NonEmptyString.check(S.isMaxLength(256));
const reportedError = S.Struct({
  type: S.tag("error"),
  message: S.String.check(S.isMaxLength(65536)),
}).pipe(
  $I.annoteSchema("GrokTransientReportedError", {
    description: "Transient native error envelope; message and every other native field are discarded.",
  })
);

/** Observe only a qualified native error literal after a known nonzero exit.
 * **Details** The 1.0.73 offline missing/empty-auth contract and current 1.0.77 bundled
 * authentication guide qualify the exact case-sensitive literal `Not signed in`.
 * Presence is a native report, never session validity, quota or historical cause.
 * An unmatched or out-of-bounds envelope remains unknown rather than false.
 * **Example** (Inspect the bounded observer)
 * ```ts
 * console.log(typeof observeGrokReportedNotSignedIn)
 * ```
 * @param stdout - Bounded transient native NDJSON, never persisted by this observer.
 * @param exitStatus - Known native exit; success and unsupported statuses remain unknown.
 * @returns Only the positive reported-literal boolean, or unknown.
 * @category decoding
 * @since 0.0.0
 */
export const observeGrokReportedNotSignedIn = Effect.fn("HarnessEnrollment.observeGrokReportedNotSignedIn")(function* (
  stdout: string,
  exitStatus: number
) {
  if (!Number.isInteger(exitStatus) || exitStatus === 0 || Math.abs(exitStatus) > 4096) return O.none<true>();
  if (Buffer.byteLength(stdout) > 1048576) return O.none<true>();
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  if (lines.length === 0 || lines.length > 2048 || A.some(lines, (line) => Buffer.byteLength(line) > 65536))
    return O.none<true>();
  for (const line of lines) {
    const event = yield* S.decodeEffect(S.fromJsonString(reportedError))(line).pipe(Effect.option);
    if (O.isSome(event) && Str.includes("Not signed in")(event.value.message)) return O.some<true>(true);
  }
  return O.none<true>();
});
/** Closed native failure reports; these labels never establish account or provider state.
 * **Example** (Inspect the finite schema)
 * ```ts
 * console.log(typeof GrokNativeFailureClass.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export const GrokNativeFailureClass = S.Literals([
  "Unknown",
  "auth",
  "subscription-or-quota",
  "model-unavailable-or-config",
  "network",
]).pipe(
  $I.annoteSchema("GrokNativeFailureClass", {
    description:
      "Only qualified native error-message literals; absent, conflicting or unsupported reports remain Unknown.",
  })
);

/** Closed reasons that a transient error stream cannot support a diagnosis.
 * **Example** (Inspect the finite reason domain)
 * ```ts
 * console.log(GrokNativeFailureUnknownReason.literals.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export const GrokNativeFailureUnknownReason = S.Literals([
  "unsupported-exit",
  "bounds",
  "no-error",
  "malformed-stream",
  "unsupported-envelope",
  "ambiguous-errors",
  "unmatched-literal",
]).pipe(
  $I.annoteSchema("GrokNativeFailureUnknownReason", {
    description: "Closed structural/qualification reasons only; no message, field names, code or body is retained.",
  })
);
const unknown = (reason: typeof GrokNativeFailureUnknownReason.Type) => ({
  classification: "Unknown" as const,
  unknownReason: O.some(reason),
});
/** Classify bounded transient native error envelopes with a closed, case-sensitive literal allowlist.
 * **Details** Installed 1.0.77 public binary strings qualify `Not signed in`,
 * `SuperGrok subscription required`, `Model not found in config.toml [model.*]`,
 * and `Connection to Grok timed out or was interrupted. Please try again. (HTTP <status>).`.
 * Generic HTTP codes, quota words and OS network tokens also occur in unrelated native subsystems
 * and are deliberately insufficient. No free message, code, stderr or nested value is returned.
 * Multiple error rows, malformed rows and unsupported shapes remain Unknown.
 * **Example** (Inspect the bounded observer)
 * ```ts
 * console.log(typeof observeGrokNativeFailure)
 * ```
 * @param stdout - Transient native NDJSON; never retained.
 * @param exitStatus - Known nonzero native exit.
 * @returns One finite report class; Unknown is never a negative account-state claim.
 * @category decoding
 * @since 0.0.0
 */
export const observeGrokNativeFailure = Effect.fn("HarnessEnrollment.observeGrokNativeFailure")(function* (
  stdout: string,
  exitStatus: number
) {
  if (!Number.isInteger(exitStatus) || exitStatus === 0 || Math.abs(exitStatus) > 4096)
    return unknown("unsupported-exit");
  if (Buffer.byteLength(stdout) > 1048576) return unknown("bounds");
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  if (lines.length === 0) return unknown("no-error");
  if (lines.length > 2048 || A.some(lines, (line) => Buffer.byteLength(line) > 65536)) return unknown("bounds");
  let report: typeof GrokNativeFailureClass.Type = "Unknown";
  let errors = 0;
  for (const line of lines) {
    const envelope = yield* S.decodeEffect(S.fromJsonString(S.Struct({ type: S.String })))(line).pipe(Effect.option);
    if (O.isNone(envelope)) return unknown("malformed-stream");
    if (envelope.value.type !== "error") continue;
    errors++;
    if (errors > 1) return unknown("ambiguous-errors");
    const event = yield* S.decodeEffect(S.fromJsonString(reportedError))(line).pipe(Effect.option);
    if (O.isNone(event)) return unknown("unsupported-envelope");
    const message = event.value.message;
    if (
      message === "Not signed in" ||
      message ===
        "Not signed in. Run `grok login` to authenticate (or `grok login --device-code` if no browser is available)."
    )
      report = "auth";
    else if (message === "SuperGrok subscription required") report = "subscription-or-quota";
    else if (message === "Model not found in config.toml [model.*]") report = "model-unavailable-or-config";
    else if (
      /^Connection to Grok timed out or was interrupted\. Please try again\. \(HTTP [1-5][0-9]{2}\)\.$/.test(message)
    )
      report = "network";
  }
  return report === "Unknown"
    ? unknown(errors === 0 ? "no-error" : "unmatched-literal")
    : { classification: report, unknownReason: O.none<typeof GrokNativeFailureUnknownReason.Type>() };
});
/** Read only the finite class from the bounded structural observer.
 * **Example** (Inspect the class-only compatibility observer)
 * ```ts
 * console.log(typeof observeGrokNativeFailureClass)
 * ```
 * @param stdout - Bounded transient native NDJSON.
 * @param exitStatus - Known native exit.
 * @returns Finite class only; structural reasons remain in the richer observer.
 * @category decoding
 * @since 0.0.0
 */
export const observeGrokNativeFailureClass = (stdout: string, exitStatus: number) =>
  observeGrokNativeFailure(stdout, exitStatus).pipe(Effect.map((value) => value.classification));
const wire = S.Union([
  S.Struct({
    type: S.tag("available_commands"),
    tools: S.Array(S.Unknown).check(S.isMaxLength(0)),
    commands: S.Array(S.Unknown).check(S.isMaxLength(32)),
  }),
  S.Struct({ type: S.tag("text"), data: S.String.check(S.isMaxLength(128)) }),
  S.Struct({ type: S.tag("thought"), data: S.String.check(S.isMaxLength(65536)) }),
  S.Struct({
    type: S.tag("usage"),
    stopReason: S.OptionFromOptionalKey(S.Literals(["end_turn", "stop"])),
    usage: S.OptionFromOptionalKey(usage),
  }),
  S.Struct({
    type: S.tag("end"),
    stopReason: S.tag("end_turn"),
    sessionId: identifier,
    requestId: identifier,
    cwd: S.NonEmptyString.check(S.isMaxLength(4096)),
    usage: S.OptionFromOptionalKey(usage),
    num_turns: S.OptionFromOptionalKey(count.check(S.isLessThanOrEqualTo(1))),
    modelUsage: S.OptionFromOptionalKey(modelUsage),
    usage_is_incomplete: S.OptionFromOptionalKey(S.Boolean),
  }),
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("GrokFixedNativeEvent", {
    description: "Known fixed-turn events only; executable tool calls, plans, failures and unknown tags are refused.",
  })
);

/** Safe fixed protocol refusal, with no native text or identifiers.
 * **Example** (Inspect the refusal)
 * ```ts
 * console.log(typeof GrokCanaryWireError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GrokCanaryWireError extends S.TaggedError<GrokCanaryWireError, { readonly brand: unique symbol }>(
  $I`GrokCanaryWireError`
)(
  "GrokCanaryWireError",
  {},
  $I.annote("GrokCanaryWireError", { description: "Unsupported, ambiguous or content-mismatched fixed native stream." })
) {}

/** Safe source metadata; one source invocation is not one HTTP request.
 * **Example** (Inspect the source metadata)
 * ```ts
 * console.log(typeof GrokCanarySource.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GrokCanarySource extends S.Opaque<GrokCanarySource, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("grok-canary-source/v1"),
    sourceSessionId: Sha256Hex,
    sourceRequestId: Sha256Hex,
    protocol: S.tag("grok-build-1.0.77/streaming-json"),
    response: S.tag("exact-constant-matched"),
    requestedModel: S.tag("grok-4.7"),
    requestedEffort: S.tag("medium"),
    requestedTitleModel: S.tag("grok-4.7"),
    titleOperationPolicy: S.tag("native-private-session-title-metadata-only"),
    sourceInvocations: S.tag(1),
    nativeHttpRequests: S.tag("Unknown"),
    pinBasis: S.tag("launch-enforced"),
    executableToolCount: S.tag(0),
    nativeUsage: S.OptionFromOptionalKey(usage),
    nativeModelUsage: S.OptionFromOptionalKey(modelUsage),
    nativeMainTurns: S.OptionFromOptionalKey(count.check(S.isLessThanOrEqualTo(1))),
    usageIsIncomplete: S.OptionFromOptionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("GrokCanarySource", {
      description:
        "Hashed identities and reported prompt-ledger counters; no title text, reasoning, prompt or HTTP-count inference.",
    })
  )
) {}

/** Validate one bounded fixed native stream; all content remains transient.
 * **Example** (Inspect the decoder)
 * ```ts
 * console.log(typeof decodeGrokCanaryOutput)
 * ```
 * @param stdout - Bounded transient native NDJSON.
 * @param salt - Existing telemetry namespace salt, never provider auth.
 * @param workspace - Exact admitted native CWD, independent of the collector checkout.
 * @returns Safe source metadata with canonical private identifier hashes.
 * @category decoding
 * @since 0.0.0
 */
export const decodeGrokCanaryOutput = Effect.fn("HarnessEnrollment.decodeGrokNative")(function* (
  stdout: string,
  salt: Redacted.Redacted<string>,
  workspace: string
) {
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  if (Buffer.byteLength(stdout) > 1048576 || lines.length === 0 || lines.length > 2048)
    return yield* GrokCanaryWireError.make({});
  let catalogs = 0;
  let text = "";
  let terminal = O.none<Extract<typeof wire.Type, { readonly type: "end" }>>();
  for (const line of lines) {
    if (Buffer.byteLength(line) > 65536 || O.isSome(terminal)) return yield* GrokCanaryWireError.make({});
    // Discard unknown content-bearing fields; only a known event discriminator is admitted.
    const event = yield* S.decodeEffect(S.fromJsonString(wire))(line).pipe(
      Effect.mapError(() => GrokCanaryWireError.make({}))
    );
    if (wire.guards.available_commands(event)) {
      catalogs += 1;
      if (catalogs > 4) return yield* GrokCanaryWireError.make({});
    } else if (wire.guards.text(event)) {
      text = `${text}${event.data}`;
      if (Str.length(text) > 128) return yield* GrokCanaryWireError.make({});
    } else if (wire.guards.end(event)) {
      if (Str.replace(/\/+$/, "")(event.cwd) !== Str.replace(/\/+$/, "")(workspace))
        return yield* GrokCanaryWireError.make({});
      if (
        O.isSome(event.modelUsage) &&
        A.some(R.keys(event.modelUsage.value), (id) => id !== "grok-4.7" && id !== "grok-4.7-build")
      )
        return yield* GrokCanaryWireError.make({});
      terminal = O.some(event);
    }
  }
  if (catalogs === 0 || O.isNone(terminal) || Str.trim(text) !== "ENROLLMENT_CANARY_OK")
    return yield* GrokCanaryWireError.make({});
  const event = terminal.value;
  return GrokCanarySource.make({
    sourceSessionId: yield* hashPrivateIdentifier(event.sessionId, O.some(Redacted.value(salt))),
    sourceRequestId: yield* hashPrivateIdentifier(event.requestId, O.some(Redacted.value(salt))),
    nativeUsage: event.usage,
    nativeModelUsage: event.modelUsage,
    nativeMainTurns: event.num_turns,
    usageIsIncomplete: event.usage_is_incomplete,
  });
});
