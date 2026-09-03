/**
 * Privacy and hashing helpers for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, NonEmptyTrimmedStr, SchemaUtils, Sha256Hex } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, Encoding, flow, Order, pipe, SchemaTransformation } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { metricEventName, transcriptLines } from "./internal/transcript-utils.ts";
import { AiMetricsSourceAttribution, AiMetricsSourceRole, AiMetricsTranscriptSource } from "./models.ts";
import type { TranscriptIngestSummary } from "./models.ts";

const $I = $RepoAiMetricsId.create("privacy");
const decodeNonEmptyTrimmedOption = S.decodeUnknownOption(NonEmptyTrimmedStr);
const decodeSha256Hex = S.decodeEffect(Sha256Hex);
const OptionalNonEmptyTrimmed = S.optionalKey(S.Union([S.String, S.Option(NonEmptyTrimmedStr)])).pipe(
  S.decodeTo(
    S.Option(S.String),
    SchemaTransformation.transformOptional<O.Option<string>, string | O.Option<NonEmptyTrimmedStr>>({
      decode: (value): O.Option<O.Option<string>> =>
        O.some(
          pipe(
            value,
            O.flatMap((input) => (O.isOption(input) ? input : O.some(input))),
            O.flatMap(decodeNonEmptyTrimmedOption)
          )
        ),
      encode: O.flatten,
    })
  ),
  SchemaUtils.withNoneDefault
);
const AiMetricsEncodedSha256 = S.toEncoded(Sha256Hex).pipe(
  $I.annoteSchema("AiMetricsEncodedSha256", {
    description: "Canonical lowercase SHA-256 digest stored in AI metrics metadata.",
  })
);

/**
 * Local fallback salt used only for smoke-mode private identifier hashes.
 *
 * **Example** (Smoke salt insecure check)
 *
 * ```ts
 * import { AI_METRICS_LOCAL_INSECURE_HASH_SALT } from "@beep/repo-ai-metrics"
 *
 * const isSmokeSalt = AI_METRICS_LOCAL_INSECURE_HASH_SALT.includes("insecure")
 * console.log(isSmokeSalt)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AI_METRICS_LOCAL_INSECURE_HASH_SALT = "beep-ai-metrics-local-smoke-insecure-salt";

const normalizeHashSalt = (input: unknown): O.Option<string> =>
  O.isOption(input) ? O.filter(input, P.isString) : O.liftPredicate(input, P.isString);

// These global regexes are safe for concurrent use here because matchAll and replace
// start each string operation from index 0 even when the expression has the g flag.
const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Z][A-Z0-9_]*(?:API[_-]?KEY|KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|AUTH|CREDENTIAL)[A-Z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^\s;&|]+)/giu;
const AUTH_HEADER_PATTERN = /\b(authorization|proxy-authorization)\s*:\s*([^\n\r]+)/giu;
const BEARER_PATTERN = /\b(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{8,})/giu;
const OPENAI_KEY_PATTERN = /\b(sk-[A-Za-z0-9_-]{8,})\b/gu;

const countMatches = (pattern: RegExp, content: string): number =>
  pipe(content, Str.matchAll(pattern), A.fromIterable, A.length);

/**
 * Whether private identifier hashes used an operator-provided salt or a local smoke fallback.
 *
 * **Example** (Enum provided status value)
 *
 * ```ts
 * import { AiMetricsHashSaltStatus } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsHashSaltStatus.Enum.provided)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsHashSaltStatus = LiteralKit(["provided", "insecure_default"]).pipe(
  $I.annoteSchema("AiMetricsHashSaltStatus", {
    description: "Salt source status for private AI metrics identifier hashes.",
  })
);

/**
 * Runtime type for {@link AiMetricsHashSaltStatus}.
 *
 * **Example** (Assign provided status type)
 *
 * ```ts
 * import type { AiMetricsHashSaltStatus } from "@beep/repo-ai-metrics"
 * const status: AiMetricsHashSaltStatus = "provided"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsHashSaltStatus = typeof AiMetricsHashSaltStatus.Type;

/**
 * Redaction proof for text that crossed the raw-transcript boundary.
 *
 * **Example** (Make redaction proof result)
 *
 * ```ts
 * import { AiMetricsRedactionResult } from "@beep/repo-ai-metrics"
 *
 * const redaction = AiMetricsRedactionResult.make({
 *   authHeaderCount: 0,
 *   bearerTokenCount: 0,
 *   excludedRawTextFieldCount: 2,
 *   openAiKeyCount: 0,
 *   safeForDerivedUi: true,
 *   secretAssignmentCount: 0
 * })
 * console.log(redaction.safeForDerivedUi)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRedactionResult extends S.Class<AiMetricsRedactionResult>($I`AiMetricsRedactionResult`)(
  {
    authHeaderCount: S.Natural,
    bearerTokenCount: S.Natural,
    excludedRawTextFieldCount: S.Natural,
    openAiKeyCount: S.Natural,
    safeForDerivedUi: S.Boolean,
    secretAssignmentCount: S.Natural,
  },
  $I.annote("AiMetricsRedactionResult", {
    description: "Counts of private material detected or excluded before producing derived AI metrics payloads.",
  })
) {}

/**
 * Hash-only envelope for a raw transcript event line.
 *
 * **Example** (Make raw event envelope)
 *
 * ```ts
 * import { AiMetricsRawEventEnvelope } from "@beep/repo-ai-metrics"
 *
 * const envelope = AiMetricsRawEventEnvelope.make({
 *   eventName: "event_msg",
 *   lineNumber: 1,
 *   rawEventHash: "2222222222222222222222222222222222222222222222222222222222222222",
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111"
 * })
 * console.log(envelope.sourceRole)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRawEventEnvelope extends S.Class<AiMetricsRawEventEnvelope>($I`AiMetricsRawEventEnvelope`)(
  {
    eventName: S.String,
    lineNumber: S.Int,
    rawEventHash: AiMetricsEncodedSha256,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: AiMetricsEncodedSha256,
    sourceRole: AiMetricsSourceRole.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsSourceRole.Enum.primary)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsSourceRole.Enum.primary))
    ),
    timestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AiMetricsRawEventEnvelope", {
    description: "Safe raw-event envelope that retains only hashes, line numbers, event names, and timestamps.",
  })
) {}

/**
 * Redacted transcript summary safe for derived tables, dashboards, and OTLP attributes.
 *
 * **Example** (Make sanitized transcript)
 *
 * ```ts
 * import { AiMetricsSanitizedTranscript } from "@beep/repo-ai-metrics"
 *
 * const sanitized = AiMetricsSanitizedTranscript.make({
 *   acceptedEvents: 1,
 *   eventNames: ["event_msg"],
 *   rawEventEnvelopes: [],
 *   rejectedLines: 0,
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111",
 *   totalLines: 1
 * })
 * console.log(sanitized.eventNames)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSanitizedTranscript extends S.Class<AiMetricsSanitizedTranscript>(
  $I`AiMetricsSanitizedTranscript`
)(
  {
    acceptedEvents: S.Natural,
    agentNicknameHash: S.OptionFromOptionalKey(AiMetricsEncodedSha256).pipe(SchemaUtils.withNoneDefault),
    agentRoleHash: S.OptionFromOptionalKey(AiMetricsEncodedSha256).pipe(SchemaUtils.withNoneDefault),
    eventNames: S.Array(S.String),
    firstTimestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    forkedFromIdHash: S.OptionFromOptionalKey(AiMetricsEncodedSha256).pipe(SchemaUtils.withNoneDefault),
    lastTimestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    parentSessionIdHash: S.OptionFromOptionalKey(AiMetricsEncodedSha256).pipe(SchemaUtils.withNoneDefault),
    parentThreadIdHash: S.OptionFromOptionalKey(AiMetricsEncodedSha256).pipe(SchemaUtils.withNoneDefault),
    rawEventEnvelopes: S.Array(AiMetricsRawEventEnvelope),
    rejectedLines: S.Natural,
    sessionIdHash: S.OptionFromOptionalKey(AiMetricsEncodedSha256).pipe(SchemaUtils.withNoneDefault),
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: AiMetricsEncodedSha256,
    sourceRole: AiMetricsSourceRole.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsSourceRole.Enum.primary)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsSourceRole.Enum.primary))
    ),
    threadSpawn: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    totalLines: S.Natural,
  },
  $I.annote("AiMetricsSanitizedTranscript", {
    description: "Allowlisted transcript projection that excludes prompt, output, message, and payload text.",
  })
) {}

/**
 * Result produced by the P1 privacy proof command.
 *
 * **Example** (Make privacy check result)
 *
 * ```ts
 * import {
 *   AiMetricsPrivacyCheckResult,
 *   AiMetricsRedactionResult,
 *   AiMetricsSanitizedTranscript
 * } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsPrivacyCheckResult.make({
 *   hashSaltStatus: "provided",
 *   inputPathHash: "3333333333333333333333333333333333333333333333333333333333333333",
 *   redaction: AiMetricsRedactionResult.make({
 *     authHeaderCount: 0,
 *     bearerTokenCount: 0,
 *     excludedRawTextFieldCount: 1,
 *     openAiKeyCount: 0,
 *     safeForDerivedUi: true,
 *     secretAssignmentCount: 0
 *   }),
 *   sanitized: AiMetricsSanitizedTranscript.make({
 *     acceptedEvents: 1,
 *     eventNames: ["event_msg"],
 *     rawEventEnvelopes: [],
 *     rejectedLines: 0,
 *     sourceKind: "codex",
 *     sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111",
 *     totalLines: 1
 *   }),
 *   sourceKind: "codex"
 * })
 * console.log(result.redaction.safeForDerivedUi)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsPrivacyCheckResult extends S.Class<AiMetricsPrivacyCheckResult>($I`AiMetricsPrivacyCheckResult`)(
  {
    hashSaltStatus: AiMetricsHashSaltStatus,
    inputPathHash: AiMetricsEncodedSha256,
    redaction: AiMetricsRedactionResult,
    sanitized: AiMetricsSanitizedTranscript,
    sourceKind: AiMetricsTranscriptSource,
  },
  $I.annote("AiMetricsPrivacyCheckResult", {
    description: "Privacy proof output for one transcript source and input path.",
  })
) {}

/**
 * Error raised by AI metrics privacy helpers.
 *
 * **Example** (Make privacy error)
 *
 * ```ts
 * import { AiMetricsPrivacyError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsPrivacyError.make({
 *   cause: "hash failure",
 *   message: "Failed to hash transcript path."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsPrivacyError extends S.TaggedError<AiMetricsPrivacyError>($I`AiMetricsPrivacyError`)(
  "AiMetricsPrivacyError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsPrivacyError>("AiMetricsPrivacyError", {
    description: "Typed failure raised by AI metrics privacy and hashing helpers.",
  })
) {}

class GenericTranscriptLine extends S.Class<GenericTranscriptLine>($I`GenericTranscriptLine`)(
  {
    event: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sessionId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    timestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    type: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("GenericTranscriptLine", {
    description: "Minimal event metadata decoded from arbitrary transcript JSONL lines.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(GenericTranscriptLine));
}

class CodexSubagentSource extends S.Class<CodexSubagentSource>($I`CodexSubagentSource`)(
  {
    agent_nickname: OptionalNonEmptyTrimmed,
    agent_role: OptionalNonEmptyTrimmed,
    forked_from_id: OptionalNonEmptyTrimmed,
    parent_session_id: OptionalNonEmptyTrimmed,
    parent_thread_id: OptionalNonEmptyTrimmed,
    thread_spawn: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CodexSubagentSource", {
    description: "Hash-only source metadata shape decoded from Codex session_meta lines.",
  })
) {}

class CodexSessionSource extends S.Class<CodexSessionSource>($I`CodexSessionSource`)(
  {
    subagent: S.OptionFromOptionalKey(CodexSubagentSource).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CodexSessionSource", {
    description: "Codex session_meta source metadata used for attribution.",
  })
) {}

class CodexSessionPayload extends S.Class<CodexSessionPayload>($I`CodexSessionPayload`)(
  {
    id: OptionalNonEmptyTrimmed,
    parent_session_id: OptionalNonEmptyTrimmed,
    parent_thread_id: OptionalNonEmptyTrimmed,
    source: S.OptionFromOptionalKey(CodexSessionSource).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CodexSessionPayload", {
    description: "Codex session_meta payload fields used for privacy-preserving attribution.",
  })
) {}

class CodexSessionMetaLine extends S.Class<CodexSessionMetaLine>($I`CodexSessionMetaLine`)(
  {
    payload: S.OptionFromOptionalKey(CodexSessionPayload).pipe(SchemaUtils.withNoneDefault),
    type: S.String,
  },
  $I.annote("CodexSessionMetaLine", {
    description: "Codex JSONL session_meta line used to detect delegated subagent transcripts.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(CodexSessionMetaLine));
}

const encodePrivacyCheckJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsPrivacyCheckResult));

/**
 * Resolve the effective private hash salt value.
 *
 * **Example** (Resolve operator salt value)
 *
 * ```ts
 * import { resolveAiMetricsHashSaltValue } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 * console.log(resolveAiMetricsHashSaltValue(O.some("salt")))
 * ```
 *
 * @param hashSalt - Operator-provided salt, or an empty value for local smoke mode.
 * @returns The salt value used before hashing private identifiers.
 * @category utilities
 * @since 0.0.0
 */
export const resolveAiMetricsHashSaltValue = (hashSalt: O.Option<string>): string =>
  pipe(
    normalizeHashSalt(hashSalt),
    O.filter(flow(Str.trim, Str.isNonEmpty)),
    O.getOrElse(() => AI_METRICS_LOCAL_INSECURE_HASH_SALT)
  );

/**
 * Resolve the effective private hash salt status.
 *
 * **Example** (Resolve salt status provided)
 *
 * ```ts
 * import { resolveAiMetricsHashSaltStatus } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 * console.log(resolveAiMetricsHashSaltStatus(O.some("salt")))
 * ```
 *
 * @param hashSalt - Operator-provided salt, or an empty value for local smoke mode.
 * @returns Whether hashing used an operator salt or the local insecure fallback.
 * @category utilities
 * @since 0.0.0
 */
export const resolveAiMetricsHashSaltStatus = (hashSalt: O.Option<string>): AiMetricsHashSaltStatus =>
  O.exists(normalizeHashSalt(hashSalt), flow(Str.trim, Str.isNonEmpty))
    ? AiMetricsHashSaltStatus.Enum.provided
    : AiMetricsHashSaltStatus.Enum.insecure_default;

/**
 * Compute a deterministic public SHA-256 digest for non-private content identity.
 *
 * **Example** (Hash public text digest)
 *
 * ```ts
 * import { hashPublicTextSha256 } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const digest = Effect.runPromise(hashPublicTextSha256("visible benchmark id"))
 * console.log(digest)
 * ```
 *
 * @effects Reads the Web Crypto implementation through `globalThis.crypto.subtle`.
 * @category utilities
 * @since 0.0.0
 */
export const hashPublicTextSha256: (value: string) => Effect.Effect<Sha256Hex, AiMetricsPrivacyError> = Effect.fn(
  "AiMetrics.hashPublicTextSha256"
)(function* (value) {
  const buffer = yield* Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    catch: (cause) =>
      AiMetricsPrivacyError.make({
        cause,
        message: "Failed to compute public SHA-256 digest.",
      }),
  });

  return yield* decodeSha256Hex(Encoding.encodeHex(new Uint8Array(buffer))).pipe(
    Effect.mapError((cause) =>
      AiMetricsPrivacyError.make({
        cause,
        message: "Failed to validate the computed public SHA-256 digest.",
      })
    )
  );
});

/**
 * Compute a salted SHA-256 digest for private identifiers such as local paths and session ids.
 *
 * **Example** (Hash private path identifier)
 *
 * ```ts
 * import { hashPrivateIdentifier } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const pathHash = Effect.runPromise(hashPrivateIdentifier("/home/me/.codex/session.jsonl", O.some("salt")))
 * console.log(pathHash)
 * ```
 *
 * @effects Reads the Web Crypto implementation through `globalThis.crypto.subtle`.
 * @category utilities
 * @since 0.0.0
 */
export const hashPrivateIdentifier: {
  (value: string, hashSalt: O.Option<string>): Effect.Effect<Sha256Hex, AiMetricsPrivacyError>;
  (hashSalt: O.Option<string>): (value: string) => Effect.Effect<Sha256Hex, AiMetricsPrivacyError>;
} = dual(
  2,
  Effect.fn("AiMetrics.hashPrivateIdentifier")(function* (value: string, hashSalt: O.Option<string>) {
    return yield* hashPublicTextSha256(`${resolveAiMetricsHashSaltValue(hashSalt)}\u0000${value}`);
  })
);

const firstNonEmptyString = (...values: ReadonlyArray<O.Option<string>>): O.Option<string> =>
  pipe(values, A.getSomes, A.head);

const optionalHashPrivateIdentifier = Effect.fn("AiMetrics.optionalHashPrivateIdentifier")(function* (
  value: O.Option<string>,
  hashSalt: O.Option<string>
) {
  return yield* O.match(value, {
    onNone: () => Effect.succeedNone,
    onSome: flow(hashPrivateIdentifier(hashSalt), Effect.map(O.some)),
  });
});

const codexSessionMetaLines: (content: string) => ReadonlyArray<CodexSessionMetaLine> = flow(
  transcriptLines,
  A.map((line) => CodexSessionMetaLine.decodeJsonOption(line)),
  A.getSomes,
  A.filter((line) => line.type === "session_meta")
);

const firstCodexSessionPayload: (lines: ReadonlyArray<CodexSessionMetaLine>) => O.Option<CodexSessionPayload> = flow(
  A.map((line) => line.payload),
  A.getSomes,
  A.head
);

const firstCodexSubagentSource: (lines: ReadonlyArray<CodexSessionMetaLine>) => O.Option<CodexSubagentSource> = flow(
  A.map((line) =>
    pipe(
      line.payload,
      O.flatMap((payload) => payload.source),
      O.flatMap((source) => source.subagent)
    )
  ),
  A.getSomes,
  A.head
);

const firstPayloadValue = <A>(
  payload: O.Option<CodexSessionPayload>,
  pick: (payload: CodexSessionPayload) => O.Option<A>
): O.Option<A> => pipe(payload, O.flatMap(pick));

const firstSubagentValue = <A>(
  subagent: O.Option<CodexSubagentSource>,
  pick: (subagent: CodexSubagentSource) => O.Option<A>
): O.Option<A> => pipe(subagent, O.flatMap(pick));

const codexAttributionMetadata = (content: string, sourcePath: string) => {
  const sessionMetaLines = codexSessionMetaLines(content);
  const payload = firstCodexSessionPayload(sessionMetaLines);
  const subagent = firstCodexSubagentSource(sessionMetaLines);

  return {
    agentNickname: firstSubagentValue(subagent, (value) => value.agent_nickname),
    agentRole: firstSubagentValue(subagent, (value) => value.agent_role),
    forkedFromId: firstSubagentValue(subagent, (value) => value.forked_from_id),
    parentSessionId: firstNonEmptyString(
      firstSubagentValue(subagent, (value) => value.parent_session_id),
      firstPayloadValue(payload, (value) => value.parent_session_id)
    ),
    parentThreadId: firstNonEmptyString(
      firstSubagentValue(subagent, (value) => value.parent_thread_id),
      firstPayloadValue(payload, (value) => value.parent_thread_id)
    ),
    sessionId: firstNonEmptyString(
      firstPayloadValue(payload, (value) => value.id),
      O.some(sourcePath)
    ),
    sourceRole: O.isSome(subagent) ? AiMetricsSourceRole.Enum.subagent : AiMetricsSourceRole.Enum.primary,
    threadSpawn: firstSubagentValue(subagent, (value) => value.thread_spawn),
  };
};

const normalizeAttributionPath = flow(
  Str.replace(/\\/gu, "/"),
  Str.replace(/^[A-Za-z]:/u, ""),
  Str.replace(/^\/+/u, "")
);

const basenameAttributionPath = flow(normalizeAttributionPath, Str.replace(/^.*\//u, ""));

const pathRoleFor = (relativePath: string): AiMetricsSourceRole => {
  const normalizedPath = normalizeAttributionPath(relativePath);
  return Str.startsWith("subagents/")(normalizedPath) || Str.includes("/subagents/")(normalizedPath)
    ? AiMetricsSourceRole.Enum.subagent
    : AiMetricsSourceRole.Enum.primary;
};

/**
 * Derive privacy-safe source attribution from local transcript metadata.
 *
 * **Example** (Derive source attribution)
 *
 * ```ts
 * import { makeAiMetricsSourceAttribution } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * const attribution = Effect.runPromise(
 *   makeAiMetricsSourceAttribution({
 *     content: "{\"type\":\"session_meta\",\"payload\":{\"id\":\"session-1\"}}",
 *     hashSalt: O.some("salt"),
 *     relativePath: "sessions/session-1.jsonl",
 *     sourceKind: "codex",
 *     sourcePath: "/repo/.codex/sessions/session-1.jsonl"
 *   })
 * )
 * console.log(attribution)
 * ```
 *
 * @effects Reads `globalThis.crypto.subtle` to hash private source identifiers and thread metadata.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsSourceAttribution = Effect.fn("AiMetrics.makeAiMetricsSourceAttribution")(function* ({
  content,
  hashSalt,
  relativePath,
  sourceKind,
  sourcePath,
}: {
  readonly content: string;
  readonly hashSalt: O.Option<string>;
  readonly relativePath: string;
  readonly sourceKind: AiMetricsTranscriptSource;
  readonly sourcePath: string;
}) {
  const claudeAttribution = Effect.fn("AiMetrics.makeAiMetricsSourceAttribution.claude")(function* () {
    return AiMetricsSourceAttribution.make({
      sessionIdHash: O.some(yield* hashPrivateIdentifier(sourcePath, hashSalt)),
      sourceRole: pathRoleFor(relativePath),
    });
  });
  const codexAttribution = Effect.fn("AiMetrics.makeAiMetricsSourceAttribution.codex")(function* () {
    const metadata = codexAttributionMetadata(content, sourcePath);
    const agentNicknameHash = yield* optionalHashPrivateIdentifier(metadata.agentNickname, hashSalt);
    const agentRoleHash = yield* optionalHashPrivateIdentifier(metadata.agentRole, hashSalt);
    const forkedFromIdHash = yield* optionalHashPrivateIdentifier(metadata.forkedFromId, hashSalt);
    const parentSessionIdHash = yield* optionalHashPrivateIdentifier(metadata.parentSessionId, hashSalt);
    const parentThreadIdHash = yield* optionalHashPrivateIdentifier(metadata.parentThreadId, hashSalt);
    const sessionIdHash = yield* optionalHashPrivateIdentifier(metadata.sessionId, hashSalt);

    return AiMetricsSourceAttribution.make({
      threadSpawn: metadata.threadSpawn,
      agentNicknameHash,
      agentRoleHash,
      forkedFromIdHash,
      parentSessionIdHash,
      parentThreadIdHash,
      sessionIdHash,
      sourceRole: metadata.sourceRole,
    });
  });
  const openClawAttribution = Effect.fn("AiMetrics.makeAiMetricsSourceAttribution.openclaw")(function* () {
    return AiMetricsSourceAttribution.make({
      sessionIdHash: O.some(yield* hashPrivateIdentifier("openclaw-gateway.service", hashSalt)),
      sourceRole: AiMetricsSourceRole.Enum.gateway_metadata,
    });
  });

  return yield* AiMetricsTranscriptSource.$match(sourceKind, {
    claude: claudeAttribution,
    codex: codexAttribution,
    openclaw: openClawAttribution,
  });
});

/**
 * Redact secret-shaped text before any diagnostic rendering.
 *
 * **Example** (Redact API key text)
 *
 * ```ts
 * import { redactAiMetricsSensitiveText } from "@beep/repo-ai-metrics"
 * console.log(redactAiMetricsSensitiveText("OPENAI_API_KEY=sk-testfixture"))
 * ```
 *
 * @param text - Transcript or diagnostic text that may contain secret-shaped values.
 * @returns Text with secret-shaped values replaced by redaction markers.
 * @category utilities
 * @since 0.0.0
 */
export const redactAiMetricsSensitiveText = (text: string): string =>
  Str.replace(
    OPENAI_KEY_PATTERN,
    "[REDACTED_SECRET]"
  )(
    Str.replace(
      BEARER_PATTERN,
      "$1 [REDACTED]"
    )(Str.replace(AUTH_HEADER_PATTERN, "$1: [REDACTED]")(Str.replace(SECRET_ASSIGNMENT_PATTERN, "$1=[REDACTED]")(text)))
  );

const redactionResultFor = (content: string): AiMetricsRedactionResult => {
  const authHeaderCount = countMatches(AUTH_HEADER_PATTERN, content);
  const bearerTokenCount = countMatches(BEARER_PATTERN, content);
  const openAiKeyCount = countMatches(OPENAI_KEY_PATTERN, content);
  const secretAssignmentCount = countMatches(SECRET_ASSIGNMENT_PATTERN, content);

  return AiMetricsRedactionResult.make({
    authHeaderCount,
    bearerTokenCount,
    excludedRawTextFieldCount: countMatches(/"message"|"payload"|"prompt"|"content"|"text"|"result"/gu, content),
    openAiKeyCount,
    safeForDerivedUi: authHeaderCount + bearerTokenCount + openAiKeyCount + secretAssignmentCount === 0,
    secretAssignmentCount,
  });
};

const eventNameFor = (sourceKind: AiMetricsTranscriptSource, decoded: GenericTranscriptLine): string =>
  pipe(
    decoded.type,
    O.orElse(() => decoded.event),
    O.map((value) => metricEventName({ fallback: "event", sourceKind, value: O.some(value) })),
    O.getOrElse(() => "event")
  );

const eventNameList: (envelopes: ReadonlyArray<AiMetricsRawEventEnvelope>) => ReadonlyArray<string> = flow(
  A.map((event) => event.eventName),
  A.dedupe,
  A.sort(Order.String)
);

const rawEventEnvelopes = Effect.fn("AiMetrics.rawEventEnvelopes")(function* ({
  attribution,
  content,
  hashSalt,
  sourceKind,
  sourcePathHash,
}: {
  readonly attribution: AiMetricsSourceAttribution;
  readonly content: string;
  readonly hashSalt: O.Option<string>;
  readonly sourceKind: AiMetricsTranscriptSource;
  readonly sourcePathHash: string;
}) {
  const lines = transcriptLines(content);
  const envelopes = yield* Effect.forEach(
    lines,
    Effect.fnUntraced(function* (line, index) {
      const decoded = GenericTranscriptLine.decodeJsonOption(line);
      if (O.isNone(decoded)) {
        return O.none<AiMetricsRawEventEnvelope>();
      }

      return O.some(
        AiMetricsRawEventEnvelope.make({
          eventName: eventNameFor(sourceKind, decoded.value),
          lineNumber: index + 1,
          rawEventHash: yield* hashPrivateIdentifier(line, hashSalt),
          sourceKind,
          sourcePathHash,
          sourceRole: attribution.sourceRole,
          timestamp: decoded.value.timestamp,
        })
      );
    }),
    { concurrency: 16 }
  );

  return A.getSomes(envelopes);
});

/**
 * Build a sanitized transcript projection from an ingest summary and raw JSONL text.
 *
 * **Example** (Build sanitized transcript)
 *
 * ```ts
 * import { TranscriptIngestSummary, makeSanitizedTranscript } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * const sanitized = Effect.runPromise(
 *   makeSanitizedTranscript({
 *     content: "{\"type\":\"event_msg\"}",
 *     hashSalt: O.some("salt"),
 *     relativePath: O.some("sessions/session-1.jsonl"),
 *     sourcePath: "session.jsonl",
 *     summary: TranscriptIngestSummary.make({
 *       acceptedEvents: 1,
 *       eventNames: ["event_msg"],
 *       rejectedLines: 0,
 *       sourceKind: "codex",
 *       sourcePathHash: "0000000000000000000000000000000000000000000000000000000000000000",
 *       totalLines: 1
 *     })
 *   })
 * )
 * console.log(sanitized)
 * ```
 *
 * @effects Reads `globalThis.crypto.subtle` while hashing transcript source and event-attribution identifiers.
 * @category constructors
 * @since 0.0.0
 */
export const makeSanitizedTranscript = Effect.fn("AiMetrics.makeSanitizedTranscript")(function* ({
  content,
  hashSalt,
  relativePath,
  sourcePath,
  summary,
}: {
  readonly content: string;
  readonly hashSalt: O.Option<string>;
  readonly relativePath?: O.Option<string>;
  readonly sourcePath: string;
  readonly summary: TranscriptIngestSummary;
}) {
  const normalizedRelativePath = O.isOption(relativePath) ? relativePath : O.none<string>();
  const attribution = yield* makeAiMetricsSourceAttribution({
    content,
    hashSalt,
    relativePath: O.getOrElse(normalizedRelativePath, () => basenameAttributionPath(sourcePath)),
    sourceKind: summary.sourceKind,
    sourcePath,
  });
  const envelopes = yield* rawEventEnvelopes({
    attribution,
    content,
    sourceKind: summary.sourceKind,
    sourcePathHash: summary.sourcePathHash,
    hashSalt,
  });

  return AiMetricsSanitizedTranscript.make({
    acceptedEvents: summary.acceptedEvents,
    agentNicknameHash: attribution.agentNicknameHash,
    agentRoleHash: attribution.agentRoleHash,
    eventNames: eventNameList(envelopes),
    forkedFromIdHash: attribution.forkedFromIdHash,
    rawEventEnvelopes: envelopes,
    rejectedLines: summary.rejectedLines,
    parentSessionIdHash: attribution.parentSessionIdHash,
    parentThreadIdHash: attribution.parentThreadIdHash,
    sessionIdHash: attribution.sessionIdHash,
    sourceKind: summary.sourceKind,
    sourcePathHash: summary.sourcePathHash,
    sourceRole: attribution.sourceRole,
    threadSpawn: attribution.threadSpawn,
    totalLines: summary.totalLines,
    firstTimestamp: summary.firstTimestamp,
    lastTimestamp: summary.lastTimestamp,
  });
});

/**
 * Build the P1 privacy proof payload for one transcript.
 *
 * **Example** (Build privacy proof payload)
 *
 * ```ts
 * import { TranscriptIngestSummary, makeAiMetricsPrivacyCheckResult } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * const proof = Effect.runPromise(
 *   makeAiMetricsPrivacyCheckResult({
 *     content: "{\"type\":\"event_msg\",\"message\":\"redacted at boundary\"}",
 *     hashSalt: O.some("salt"),
 *     relativePath: O.some("sessions/session-1.jsonl"),
 *     sourcePath: "session.jsonl",
 *     summary: TranscriptIngestSummary.make({
 *       acceptedEvents: 1,
 *       eventNames: ["event_msg"],
 *       rejectedLines: 0,
 *       sourceKind: "codex",
 *       sourcePathHash: "0000000000000000000000000000000000000000000000000000000000000000",
 *       totalLines: 1
 *     })
 *   })
 * )
 * console.log(proof)
 * ```
 *
 * @effects Reads `globalThis.crypto.subtle` while hashing the transcript path, source attribution, and event metadata.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsPrivacyCheckResult = Effect.fn("AiMetrics.makeAiMetricsPrivacyCheckResult")(function* (
  input: Parameters<typeof makeSanitizedTranscript>[0]
) {
  const { content, hashSalt, sourcePath, summary } = input;

  return AiMetricsPrivacyCheckResult.make({
    hashSaltStatus: resolveAiMetricsHashSaltStatus(hashSalt),
    inputPathHash: yield* hashPrivateIdentifier(sourcePath, hashSalt),
    redaction: redactionResultFor(content),
    sanitized: yield* makeSanitizedTranscript(input),
    sourceKind: summary.sourceKind,
  });
});

/**
 * Render a privacy check result as JSON.
 *
 * **Example** (Encode privacy check JSON)
 *
 * ```ts
 * import {
 *   AiMetricsPrivacyCheckResult,
 *   AiMetricsRedactionResult,
 *   AiMetricsSanitizedTranscript,
 *   privacyCheckToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const json = Effect.runPromise(
 *   privacyCheckToJson(
 *     AiMetricsPrivacyCheckResult.make({
 *       hashSaltStatus: "provided",
 *       inputPathHash: "3333333333333333333333333333333333333333333333333333333333333333",
 *       redaction: AiMetricsRedactionResult.make({
 *         authHeaderCount: 0,
 *         bearerTokenCount: 0,
 *         excludedRawTextFieldCount: 0,
 *         openAiKeyCount: 0,
 *         safeForDerivedUi: true,
 *         secretAssignmentCount: 0
 *       }),
 *       sanitized: AiMetricsSanitizedTranscript.make({
 *         acceptedEvents: 0,
 *         eventNames: [],
 *         rawEventEnvelopes: [],
 *         rejectedLines: 0,
 *         sourceKind: "codex",
 *         sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111",
 *         totalLines: 0
 *       }),
 *       sourceKind: "codex"
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsPrivacyError` if the payload cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const privacyCheckToJson: (result: AiMetricsPrivacyCheckResult) => Effect.Effect<string, AiMetricsPrivacyError> =
  Effect.fn("AiMetrics.privacyCheckToJson")(function* (result) {
    return yield* encodePrivacyCheckJson(result).pipe(
      Effect.mapError((cause) =>
        AiMetricsPrivacyError.make({
          cause,
          message: "Failed to encode AI metrics privacy check as JSON.",
        })
      )
    );
  });
