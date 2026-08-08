/**
 * Safe, bounded redaction for raw errors and Effect causes destined for logs,
 * telemetry, and client-visible channels.
 *
 * **Details**
 *
 * Diagnostic helpers in {@link CauseDiagnostics} preserve the raw primary
 * message and a full `Cause.pretty` rendering, both of which can leak secrets,
 * tokens, and home-directory paths, and the latter of which exposes internal
 * stack and defect detail. This module wraps those diagnostics with a
 * deterministic sanitizer so callers can emit a stable error tag, a bounded
 * sanitized message, and an optional bounded sanitized detail without leaking
 * sensitive material across a boundary.
 *
 * Two channels are supported: `"diagnostic"` keeps a bounded, sanitized detail
 * for internal logs and traces, while `"client"` drops all internal detail and
 * keeps only the stable tag, fingerprint, and a sanitized one-line message.
 *
 * **Example** (Redact cause for safe logs)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { redactCause } from "@beep/observability"
 *
 * const cause = Cause.fail(new Error("connect ECONNREFUSED token=sk-EXAMPLEKEY00"))
 * const safe = redactCause(cause)
 *
 * console.log(safe.tag) // "failure"
 * console.log(safe.message) // "connect ECONNREFUSED token=[REDACTED]"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Cause, Effect, flow, Match, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CauseClassification, summarizeCause } from "./CauseDiagnostics.ts";
import type { CauseSummary } from "./CauseDiagnostics.ts";

const $I = $ObservabilityId.create("CauseRedaction");

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);
const decodeNonNegativeInt = (input: number): NonNegativeInt =>
  Result.getOrThrowWith(S.decodeUnknownResult(NonNegativeInt)(input), schemaIssueToError);

/**
 * Placeholder substituted for any redacted secret-shaped token or home path.
 *
 * **Example** (Check redaction placeholder presence)
 *
 * ```typescript
 * import { REDACTION_PLACEHOLDER, sanitizeSensitiveText } from "@beep/observability"
 *
 * const sanitized = sanitizeSensitiveText("Authorization: Bearer sk-EXAMPLEKEY00")
 * console.log(sanitized.includes(REDACTION_PLACEHOLDER)) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REDACTION_PLACEHOLDER = "[REDACTED]" as const;

/**
 * Default maximum length for a sanitized message before truncation.
 *
 * **Example** (Use default message limit)
 *
 * ```typescript
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { DEFAULT_MESSAGE_LIMIT, RedactCauseOptions } from "@beep/observability"
 *
 * const options = RedactCauseOptions.make({
 *   messageLimit: S.decodeUnknownSync(NonNegativeInt)(DEFAULT_MESSAGE_LIMIT)
 * })
 * console.log(options.messageLimit) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_MESSAGE_LIMIT = 256 as const;

/**
 * Default maximum length for a sanitized diagnostic detail before truncation.
 *
 * **Example** (Use default detail limit)
 *
 * ```typescript
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { DEFAULT_DETAIL_LIMIT, RedactCauseOptions } from "@beep/observability"
 *
 * const options = RedactCauseOptions.make({
 *   detailLimit: S.decodeUnknownSync(NonNegativeInt)(DEFAULT_DETAIL_LIMIT)
 * })
 * console.log(options.detailLimit) // 2048
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_DETAIL_LIMIT = 2048 as const;

/**
 * Target channel for a redaction. `"client"` strips all internal detail and
 * keeps only the stable tag, fingerprint, and a sanitized one-line message;
 * `"diagnostic"` additionally keeps a bounded, sanitized detail.
 *
 * **Example** (List redaction channel values)
 *
 * ```typescript
 * import { RedactionChannel } from "@beep/observability"
 *
 * console.log(RedactionChannel.Enum.client) // "client"
 * console.log(RedactionChannel.Enum.diagnostic) // "diagnostic"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RedactionChannel = LiteralKit(["client", "diagnostic"]).pipe(
  $I.annoteSchema("RedactionChannel", {
    description: "Target channel for a redaction; client strips internal detail, diagnostic keeps bounded detail.",
  })
);

/**
 * Runtime type for {@link RedactionChannel}.
 *
 * **Example** (Assign redaction channel type)
 *
 * ```typescript
 * import type { RedactionChannel } from "@beep/observability"
 *
 * const channel: RedactionChannel = "client"
 * console.log(channel)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RedactionChannel = typeof RedactionChannel.Type;

// These global regexes are reused across calls. `replaceAll` restarts each
// string operation from index 0 even with the `g` flag, so the shared lastIndex
// is never observed and the helpers remain safe for concurrent use. Each
// pattern uses a lookbehind so only the sensitive value is matched and replaced
// with the placeholder, leaving the surrounding key, scheme, or path root intact.
const SECRET_ASSIGNMENT_PATTERN =
  /(?<=\b[A-Za-z0-9_-]*(?:api[_-]?key|key|token|secret|password|passwd|pwd|auth|credential|session)[A-Za-z0-9_-]*\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s;,&|]+)/giu;
const AUTH_HEADER_PATTERN = /(?<=\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*:\s*)[^\s\n\r][^\n\r]*/giu;
const BEARER_PATTERN = /(?<=\b(?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]{8,}/giu;
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/gu;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu;
const POSIX_HOME_PATTERN = /(?<=\/(?:home|Users)\/)[^/\s:]+/gu;
const WINDOWS_HOME_PATTERN = /(?<=[A-Za-z]:\\Users\\)[^\\\s:]+/gu;

const redactionSteps: ReadonlyArray<(input: string) => string> = A.make(
  Str.replaceAll(SECRET_ASSIGNMENT_PATTERN, REDACTION_PLACEHOLDER),
  Str.replaceAll(AUTH_HEADER_PATTERN, REDACTION_PLACEHOLDER),
  Str.replaceAll(BEARER_PATTERN, REDACTION_PLACEHOLDER),
  Str.replaceAll(OPENAI_KEY_PATTERN, REDACTION_PLACEHOLDER),
  Str.replaceAll(JWT_PATTERN, REDACTION_PLACEHOLDER),
  Str.replaceAll(POSIX_HOME_PATTERN, REDACTION_PLACEHOLDER),
  Str.replaceAll(WINDOWS_HOME_PATTERN, REDACTION_PLACEHOLDER)
);

const applyRedactionSteps = (input: string): string => A.reduce(redactionSteps, input, (acc, step) => step(acc));

/**
 * Strip secret-shaped tokens and home-directory paths from a single string.
 *
 * **Details**
 *
 * Redacts secret/token assignments, `Authorization`/`Cookie` headers, bearer
 * and basic credentials, OpenAI-style keys, JWTs, and POSIX/Windows home paths,
 * collapses runs of horizontal whitespace, and trims the result. Length is not
 * bounded here; use {@link redactString} for a bounded variant.
 *
 * **Example** (Redact tokens and home paths)
 *
 * ```typescript
 * import { sanitizeSensitiveText } from "@beep/observability"
 *
 * console.log(sanitizeSensitiveText("Bearer sk-EXAMPLEKEY00"))
 * // "Bearer [REDACTED]"
 * console.log(sanitizeSensitiveText("at /home/ada/app/index.ts:10"))
 * // "at /home/[REDACTED]/app/index.ts:10"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeSensitiveText: (input: string) => string = flow(
  applyRedactionSteps,
  Str.replaceAll(/[ \t]+/g, " "),
  Str.trim
);

/**
 * Sanitize a string and cap it to `maxLength` characters with an ellipsis.
 *
 * **Details**
 *
 * Supports data-first and data-last call forms.
 *
 * **Example** (Sanitize and truncate string)
 *
 * ```typescript
 * import { redactString } from "@beep/observability"
 *
 * console.log(redactString("token=sk-EXAMPLEKEY00 and more", 16))
 * // "token=[REDACTED]..."
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const redactString: {
  (input: string, maxLength: number): string;
  (maxLength: number): (input: string) => string;
} = dual(2, (input: string, maxLength: number): string => Str.truncate(sanitizeSensitiveText(input), maxLength));

/**
 * Transport-safe redaction of a cause: a stable tag and fingerprint plus a
 * bounded, sanitized message and optional bounded, sanitized detail.
 *
 * **Details**
 *
 * The `tag` mirrors {@link CauseClassification} so diagnostics stay stable
 * across redaction. `detail` is present only for the `"diagnostic"` channel and
 * never contains raw stack or defect text beyond the bounded sanitized pretty
 * rendering.
 *
 * **Example** (Inspect redacted cause fields)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { redactCause } from "@beep/observability"
 *
 * const redacted = redactCause(Cause.fail(new Error("token=sk-EXAMPLEKEY00")))
 * console.log(redacted.tag) // "failure"
 * console.log(redacted.message) // "token=[REDACTED]"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RedactedCause extends S.Class<RedactedCause>($I`RedactedCause`)(
  {
    tag: CauseClassification.annotateKey({
      description: "Stable cause classification preserved for diagnostics across redaction.",
    }),
    fingerprint: S.String.annotateKey({
      description: "Deterministic cause fingerprint safe to log and group on.",
    }),
    message: S.String.annotateKey({
      description: "Bounded, sanitized one-line summary of the primary failure.",
    }),
    detail: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "Bounded, sanitized multi-line detail; present only on the diagnostic channel.",
    }),
    truncated: S.Boolean.annotateKey({
      description: "Whether the sanitized message or detail was truncated to its length bound.",
    }),
  },
  $I.annote("RedactedCause", {
    description: "Transport-safe, sanitized, bounded representation of a cause for logs, telemetry, and clients.",
  })
) {}

/**
 * Options controlling how a cause is redacted.
 *
 * **Example** (Make client channel options)
 *
 * ```typescript
 * import { RedactCauseOptions } from "@beep/observability"
 *
 * const options = RedactCauseOptions.make({ channel: "client" })
 * console.log(options.channel) // "client"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RedactCauseOptions extends S.Class<RedactCauseOptions>($I`RedactCauseOptions`)(
  {
    channel: RedactionChannel.pipe(
      S.withConstructorDefault(Effect.succeed(RedactionChannel.Enum.diagnostic))
    ).annotateKey({
      description: "Target channel; client strips internal detail, diagnostic keeps bounded detail.",
    }),
    messageLimit: NonNegativeInt.pipe(
      S.withConstructorDefault(Effect.succeed(decodeNonNegativeInt(DEFAULT_MESSAGE_LIMIT)))
    ).annotateKey({
      description: "Maximum length of the sanitized message before truncation.",
    }),
    detailLimit: NonNegativeInt.pipe(
      S.withConstructorDefault(Effect.succeed(decodeNonNegativeInt(DEFAULT_DETAIL_LIMIT)))
    ).annotateKey({
      description: "Maximum length of the sanitized diagnostic detail before truncation.",
    }),
  },
  $I.annote("RedactCauseOptions", {
    description: "Options controlling channel and length bounds when redacting a cause.",
  })
) {
  static readonly is = S.is(RedactCauseOptions);
}

const defaultOptions = RedactCauseOptions.make({});
const isRedactionDataFirst = (args: IArguments): boolean => args.length >= 2 || !RedactCauseOptions.is(args[0]);

const wasTruncated = (input: string, maxLength: number): boolean =>
  Str.length(sanitizeSensitiveText(input)) > maxLength;

const detailForChannel = (summary: CauseSummary, options: RedactCauseOptions): O.Option<string> =>
  RedactionChannel.$match({
    client: O.none<string>,
    diagnostic: () => O.some(redactString(summary.pretty, options.detailLimit)),
  })(options.channel);

/**
 * Redact a normalized {@link CauseSummary} into a transport-safe
 * {@link RedactedCause}.
 *
 * **Example** (Redact summarized cause)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { redactCauseSummary, summarizeCause } from "@beep/observability"
 *
 * const summary = summarizeCause(Cause.fail(new Error("boom")))
 * const safe = redactCauseSummary(summary)
 * console.log(safe.tag) // "failure"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const redactCauseSummaryImpl = (summary: CauseSummary, options: RedactCauseOptions = defaultOptions): RedactedCause => {
  const messageTruncated = wasTruncated(summary.primaryMessage, options.messageLimit);
  const detail = detailForChannel(summary, options);
  const detailTruncated = O.match(detail, {
    onNone: () => false,
    onSome: () => wasTruncated(summary.pretty, options.detailLimit),
  });

  return RedactedCause.make({
    tag: summary.classification,
    // The fingerprint is message-derived (see CauseDiagnostics.fingerprintValue),
    // so it can carry the same secrets/tokens/home paths as the raw message.
    // Sanitize it with the unbounded message redactor: secret-shaped values
    // collapse to the placeholder while the structural fingerprint stays stable
    // for correlation (same structural error → same redacted fingerprint).
    fingerprint: sanitizeSensitiveText(summary.fingerprint.value),
    message: redactString(summary.primaryMessage, options.messageLimit),
    detail,
    truncated: messageTruncated || detailTruncated,
  });
};

/**
 * Redact a cause summary's message, detail, and fingerprint for safe logging.
 *
 * **Example** (Redact cause summary safely)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { redactCauseSummary, summarizeCause } from "@beep/observability"
 *
 * const summary = summarizeCause(Cause.fail(new Error("boom")))
 * const safe = redactCauseSummary(summary)
 * console.log(safe.tag) // "failure"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const redactCauseSummary: {
  (summary: CauseSummary, options?: RedactCauseOptions): RedactedCause;
  (options: RedactCauseOptions): (summary: CauseSummary) => RedactedCause;
} = dual(isRedactionDataFirst, redactCauseSummaryImpl);

const toCause = (input: unknown): Cause.Cause<unknown> => (Cause.isCause(input) ? input : Cause.fail(input));

/**
 * Redact an unknown error or {@link Cause} into a transport-safe
 * {@link RedactedCause}.
 *
 * **Details**
 *
 * Anything that is not already a `Cause` is normalized via `Cause.fail`. The
 * result strips secrets, tokens, and home-directory paths, caps message and
 * detail length, and drops all internal detail on the `"client"` channel while
 * preserving a stable tag and fingerprint for diagnostics.
 *
 * **Example** (Redact cause for channels)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { RedactCauseOptions, redactCause } from "@beep/observability"
 *
 * const cause = Cause.fail(new Error("auth failed for /home/ada with token sk-EXAMPLEKEY00"))
 *
 * const internal = redactCause(cause)
 * console.log(internal.message) // "auth failed for /home/[REDACTED] with token [REDACTED]"
 *
 * const external = redactCause(cause, RedactCauseOptions.make({ channel: "client" }))
 * console.log(external.detail) // Option.none()
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const redactCause: {
  // Data-last first: the catch-all `(input: unknown, ...)` overload would
  // otherwise absorb a lone options argument and hide the curried form.
  (options: RedactCauseOptions): (input: unknown) => RedactedCause;
  (input: unknown, options?: RedactCauseOptions): RedactedCause;
} = dual(
  isRedactionDataFirst,
  (input: unknown, options: RedactCauseOptions = defaultOptions): RedactedCause =>
    redactCauseSummary(summarizeCause(toCause(input)), options)
);

/**
 * Redact an unknown error or {@link Cause} for a client-facing channel,
 * dropping all internal detail and keeping only the stable tag, fingerprint,
 * and a sanitized one-line message.
 *
 * **Example** (Redact cause for clients)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { redactCauseForClient } from "@beep/observability"
 *
 * const safe = redactCauseForClient(Cause.die("internal invariant /home/ada broke"))
 * console.log(safe.tag) // "defect"
 * console.log(safe.detail) // Option.none()
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const redactCauseForClient = (input: unknown): RedactedCause =>
  redactCause(input, RedactCauseOptions.make({ channel: RedactionChannel.Enum.client }));

/**
 * Failure raised when a redacted cause is rendered for a boundary.
 *
 * **Details**
 *
 * Carries only the already-sanitized {@link RedactedCause}, so the error itself
 * is safe to log, serialize, and surface across a boundary.
 *
 * **Example** (Make redacted cause error)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { RedactedCauseError, redactCause } from "@beep/observability"
 *
 * const error = RedactedCauseError.make({ redacted: redactCause(Cause.fail("boom")) })
 * console.log(error._tag) // "RedactedCauseError"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class RedactedCauseError extends TaggedErrorClass<RedactedCauseError>($I`RedactedCauseError`)(
  "RedactedCauseError",
  {
    redacted: RedactedCause,
  },
  $I.annote("RedactedCauseError", {
    description: "Boundary failure carrying only a sanitized, bounded representation of the originating cause.",
  })
) {}

/**
 * Effect-friendly, traced redaction of an unknown error or {@link Cause}.
 *
 * **Details**
 *
 * Annotates the active span with the stable tag and fingerprint (never the raw
 * message) and returns the transport-safe {@link RedactedCause}. Use this inside
 * Effect pipelines that log or report failures so the redaction itself appears
 * in traces.
 *
 * **Example** (Redact cause inside Effect)
 *
 * ```typescript
 * import { Cause, Effect } from "effect"
 * import { redactCauseEffect } from "@beep/observability"
 *
 * const safe = Effect.runSync(redactCauseEffect(Cause.fail(new Error("boom"))))
 *
 * console.log(safe.tag) // "failure"
 * ```
 *
 * @effects Annotates the active span with the sanitized cause tag and fingerprint while keeping raw messages out of telemetry.
 * @category utilities
 * @since 0.0.0
 */
export const redactCauseEffect: {
  (input: unknown, options?: RedactCauseOptions): Effect.Effect<RedactedCause>;
  (options: RedactCauseOptions): (input: unknown) => Effect.Effect<RedactedCause>;
} = dual(
  isRedactionDataFirst,
  Effect.fn("observability.redact_cause")(function* (input: unknown, options: RedactCauseOptions = defaultOptions) {
    const redacted = redactCause(input, options);
    yield* Effect.annotateCurrentSpan({
      cause_tag: redacted.tag,
      cause_fingerprint: redacted.fingerprint,
    });
    return redacted;
  })
);

/**
 * Runtime-controlled levels supported by redacted boundary logging.
 *
 * **Example** (Read log level enum value)
 *
 * ```typescript
 * import { RedactedCauseLogLevel } from "@beep/observability"
 *
 * console.log(RedactedCauseLogLevel.Enum.Warn) // "Warn"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RedactedCauseLogLevel = LiteralKit(["Info", "Warn", "Error"]).pipe(
  $I.annoteSchema("RedactedCauseLogLevel", {
    description: "Runtime-controlled levels supported by redacted boundary logging.",
  })
);

/**
 * Runtime type for {@link RedactedCauseLogLevel}.
 *
 * **Example** (Assign log level type)
 *
 * ```typescript
 * import type { RedactedCauseLogLevel } from "@beep/observability"
 *
 * const level: RedactedCauseLogLevel = "Error"
 * console.log(level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RedactedCauseLogLevel = typeof RedactedCauseLogLevel.Type;

/**
 * Options for logging one redacted Cause at an Effect runtime-controlled level.
 *
 * **Example** (Make log options defaults)
 *
 * ```typescript
 * import { LogRedactedCauseOptions } from "@beep/observability"
 *
 * const options = LogRedactedCauseOptions.make({ message: "request failed" })
 * console.log(options.level) // "Error"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LogRedactedCauseOptions extends S.Class<LogRedactedCauseOptions>($I`LogRedactedCauseOptions`)(
  {
    message: S.NonEmptyString,
    level: RedactedCauseLogLevel.pipe(S.withConstructorDefault(Effect.succeed(RedactedCauseLogLevel.Enum.Error))),
    attributes: S.Record(S.String, S.String).pipe(S.optionalKey),
  },
  $I.annote("LogRedactedCauseOptions", {
    description: "Options for logging one sanitized and bounded Cause.",
  })
) {}

const logAtRedactedCauseLevel = (level: RedactedCauseLogLevel, message: string): Effect.Effect<void> =>
  Match.value(level).pipe(
    Match.when("Info", () => Effect.logInfo(message)),
    Match.when("Warn", () => Effect.logWarning(message)),
    Match.when("Error", () => Effect.logError(message)),
    Match.exhaustive
  );

/**
 * Log a Cause with bounded, sanitized diagnostic attributes.
 *
 * **Details**
 *
 * The active span receives only the stable Cause tag and sanitized fingerprint.
 * The log receives the sanitized message and optional bounded detail. Runtime
 * minimum log level filtering remains authoritative.
 *
 * **Example** (Log sanitized cause attributes)
 *
 * ```typescript
 * import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability"
 * import { Cause } from "effect"
 *
 * const program = logRedactedCause(
 *   Cause.fail(new Error("token=secret")),
 *   LogRedactedCauseOptions.make({ message: "request failed" })
 * )
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const logRedactedCause: {
  (input: unknown, options: LogRedactedCauseOptions): Effect.Effect<void>;
  (options: LogRedactedCauseOptions): (input: unknown) => Effect.Effect<void>;
} = dual(
  2,
  Effect.fn("observability.log_redacted_cause")(function* (input: unknown, options: LogRedactedCauseOptions) {
    const redacted = yield* redactCauseEffect(input);
    const baseAttributes = {
      ...(options.attributes ?? {}),
      cause_classification: redacted.tag,
      cause_fingerprint: redacted.fingerprint,
      cause_message: redacted.message,
      cause_truncated: `${redacted.truncated}`,
    };
    const attributes = O.match(redacted.detail, {
      onNone: () => baseAttributes,
      onSome: (causeDetail) => ({ ...baseAttributes, cause_detail: causeDetail }),
    });

    return yield* logAtRedactedCauseLevel(options.level, options.message).pipe(Effect.annotateLogs(attributes));
  })
);

/**
 * Observe every failing exit of an Effect with sanitized Cause logging while
 * preserving the original Cause unchanged.
 *
 * **Example** (Tap failures with redacted logs)
 *
 * ```typescript
 * import { LogRedactedCauseOptions, tapRedactedCause } from "@beep/observability"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail("boom").pipe(
 *   tapRedactedCause(LogRedactedCauseOptions.make({ message: "operation failed" }))
 * )
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const tapRedactedCause: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, options: LogRedactedCauseOptions): Effect.Effect<A, E, R>;
  (options: LogRedactedCauseOptions): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
} = dual(2, <A, E, R>(effect: Effect.Effect<A, E, R>, options: LogRedactedCauseOptions) =>
  effect.pipe(Effect.tapCause(logRedactedCause(options)))
);
