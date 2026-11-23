// The engine's raw carrier vocabulary. The internal parser throws these; ONLY
// the public modules (src/MarkdownDiagnostic.ts, src/Markdown.ts,
// src/MarkdownDocument.ts) catch them and materialize a MarkdownDiagnostic or
// a tagged error. This module imports nothing public — the dependency edge
// runs public modules -> engine only (toml src/internal/diagnostics.ts and
// src/internal/limits.ts precedent, collapsed into one file).

import { $MarkdownId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $MarkdownId.create("internal/carriers");

/**
 * Defines the raw parse-condition vocabulary shared by the engine and public diagnostics.
 *
 * **Example** (Recognize the nesting guard code)
 *
 * ```ts
 * import { MarkdownParseErrorCodeRaw } from "@beep/markdown/internal/carriers"
 *
 * MarkdownParseErrorCodeRaw.is.NestingDepthExceeded("NestingDepthExceeded") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownParseErrorCodeRaw = LiteralKit(["NestingDepthExceeded"]).pipe(
  $I.annoteSchema("MarkdownParseErrorCodeRaw", {
    description: "Raw parse-condition codes emitted by the markdown engine.",
  })
);

/**
 * The engine's error-code vocabulary identifies parse conditions reported by the engine.
 *
 * **Details**
 *
 * Currently exactly one code represents the hardening-guard trip. The vocabulary
 * widens as new parse-error kinds are added.
 *
 * **Example** (Inspect the hardening error code)
 *
 * ```ts
 * import { MARKDOWN_PARSE_ERROR_CODES } from "@beep/markdown/internal/carriers"
 *
 * console.log(MARKDOWN_PARSE_ERROR_CODES.join(", ")) // NestingDepthExceeded
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MARKDOWN_PARSE_ERROR_CODES = MarkdownParseErrorCodeRaw.literals;

/**
 * The union of all raw parse-error code string literals the engine emits.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownParseErrorCodeRaw = typeof MarkdownParseErrorCodeRaw.Type;

/**
 * The engine's diagnostic record preserves a parse condition and its source span.
 *
 * **Details**
 *
 * Public modules derive `line`/`character` from `offset`.
 *
 * **Example** (Build an engine diagnostic record)
 *
 * ```ts
 * import { RawDiagnostic } from "@beep/markdown/internal/carriers"
 *
 * const diagnostic = RawDiagnostic.make({ code: "NestingDepthExceeded", message: "too deep", offset: 7, length: 2 })
 * console.log(diagnostic.offset) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawDiagnostic extends S.Opaque<RawDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    code: MarkdownParseErrorCodeRaw.pipe(
      $I.annoteKey("RawDiagnostic.code", { description: "Parse condition reported by the engine." })
    ),
    message: S.String.pipe(
      $I.annoteKey("RawDiagnostic.message", { description: "Human-readable explanation of the parse condition." })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("RawDiagnostic.offset", { description: "Zero-based UTF-16 source offset of the parse condition." })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("RawDiagnostic.length", { description: "Extent of the source span in UTF-16 code units." })
    ),
  }).pipe(
    $I.annoteSchema("RawDiagnostic", {
      description: "An engine diagnostic record before public source coordinates are materialized.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RawDiagnostic {
  /**
   * The plain diagnostic record: a constructed {@link RawDiagnostic} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RawDiagnostic.Encoded;
}

/**
 * The engine's carrier for a recoverable-turned-fatal parse condition.
 *
 * **Example** (Carry a fatal diagnostic)
 *
 * ```ts
 * import { RawMarkdownError } from "@beep/markdown/internal/carriers"
 *
 * const error = RawMarkdownError.make({
 *   code: "NestingDepthExceeded",
 *   message: "Markdown nesting exceeds the limit",
 *   offset: 12,
 *   length: 1
 * })
 * console.log(error.message) // Markdown nesting exceeds the limit
 * console.log(error.diagnostic.offset) // 12
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RawMarkdownError extends S.TaggedError<RawMarkdownError, { readonly brand: unique symbol }>(
  $I`RawMarkdownError`
)(
  "RawMarkdownError",
  RawDiagnostic.fields,
  $I.annoteError<RawMarkdownError>("RawMarkdownError", {
    description: "The engine's diagnostic throw carrier, caught by the public facade.",
  })
) {
  /**
   * Preserves the standard error name on the raw parse-condition carrier.
   *
   * **Example** (Inspect the raw parse error name)
   *
   * ```ts
   * import { RawMarkdownError } from "@beep/markdown/internal/carriers"
   *
   * const error = RawMarkdownError.make({
   *   code: "NestingDepthExceeded",
   *   message: "Nesting limit exceeded",
   *   offset: 0,
   *   length: 1
   * })
   * console.log(error.name) // Error
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override readonly name = "Error";

  /**
   * Exposes the carried code, message and source span as a raw diagnostic record.
   *
   * **Example** (Read the carried diagnostic offset)
   *
   * ```ts
   * import { RawMarkdownError } from "@beep/markdown/internal/carriers"
   *
   * const error = RawMarkdownError.make({
   *   code: "NestingDepthExceeded",
   *   message: "Nesting limit exceeded",
   *   offset: 3,
   *   length: 1
   * })
   * console.log(error.diagnostic.offset) // 3
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  readonly diagnostic: RawDiagnostic = RawDiagnostic.make({
    code: this.code,
    message: this.message,
    offset: this.offset,
    length: this.length,
  });
}

/**
 * Recognizes the raw parse-condition carrier; never a bare `instanceof` at a call site.
 *
 * **Example** (Recognize a raw parse error)
 *
 * ```ts
 * import { RawMarkdownError, isRawMarkdownError } from "@beep/markdown/internal/carriers"
 *
 * const error: unknown = RawMarkdownError.make({
 *   code: "NestingDepthExceeded",
 *   message: "Nesting limit exceeded",
 *   offset: 0,
 *   length: 1
 * })
 * console.log(isRawMarkdownError(error)) // true
 * console.log(isRawMarkdownError("Nesting limit exceeded")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isRawMarkdownError = S.is(RawMarkdownError);

/**
 * The reasons a guard can trip; mirrors {@link MarkdownParseErrorCodeRaw}'s guard members.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GuardReason = MarkdownParseErrorCodeRaw;

/** The guard-trip message: the reason, the configured limit and the observed depth. */
const guardMessage = (reason: GuardReason, limit: number, actual: number): string =>
  `${reason}: limit ${limit}, actual ${actual}`;

/**
 * Signals that the engine exceeded a hardening cap.
 *
 * **Details**
 *
 * The engine throws this raw guard-trip signal when a hardening cap
 * (`MAX_NESTING_DEPTH`) is exceeded. Build it with {@link GuardExceeded.new},
 * which derives the message from the reason, limit and observed depth.
 *
 * **Gotchas**
 *
 * It must never escape a public entry point as a defect — the facade catches it
 * and materializes a typed `MarkdownParseError` carrying a `NestingDepthExceeded`
 * diagnostic.
 *
 * **Example** (Inspect a nesting guard trip)
 *
 * ```ts
 * import { GuardExceeded } from "@beep/markdown/internal/carriers"
 *
 * const error = GuardExceeded.new("NestingDepthExceeded", 128, 129, 12)
 * console.log(error.message) // NestingDepthExceeded: limit 128, actual 129
 * console.log(error.offset) // 12
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GuardExceeded extends S.TaggedError<GuardExceeded, { readonly brand: unique symbol }>($I`GuardExceeded`)(
  "GuardExceeded",
  {
    reason: MarkdownParseErrorCodeRaw.pipe(
      $I.annoteKey("GuardExceeded.reason", { description: "The engine guard that exceeded its limit." })
    ),
    offset: RawDiagnostic.fields.offset.pipe(
      $I.annoteKey("GuardExceeded.offset", { description: "Source offset where the guard tripped." })
    ),
    limit: S.Finite.pipe($I.annoteKey("GuardExceeded.limit", { description: "The configured nesting limit." })),
    actual: S.Finite.pipe($I.annoteKey("GuardExceeded.actual", { description: "The observed nesting depth." })),
    message: RawDiagnostic.fields.message.pipe(
      $I.annoteKey("GuardExceeded.message", { description: "The reason, configured limit and observed depth." })
    ),
  },
  $I.annoteError<GuardExceeded>("GuardExceeded", {
    description: "A raw nesting guard trip materialized into a diagnostic by the facade.",
  })
) {
  /**
   * Builds a guard-trip signal whose message names the reason, limit and observed depth.
   *
   * **Example** (Retain the offending offset)
   *
   * ```ts
   * import { GuardExceeded } from "@beep/markdown/internal/carriers"
   *
   * const error = GuardExceeded.new("NestingDepthExceeded", 256, 257, 12)
   * console.log(error.offset) // 12
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static new(reason: GuardReason, limit: number, actual: number, offset: number): GuardExceeded {
    return GuardExceeded.make({ reason, offset, limit, actual, message: guardMessage(reason, limit, actual) });
  }

  /**
   * Preserves the standard error name on the raw guard-trip signal.
   *
   * **Example** (Inspect the guard error name)
   *
   * ```ts
   * import { GuardExceeded } from "@beep/markdown/internal/carriers"
   *
   * const error = GuardExceeded.new("NestingDepthExceeded", 128, 129, 12)
   * console.log(error.name) // Error
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override readonly name = "Error";
}

/**
 * Recognizes a guard-trip signal; never a bare `instanceof` at a call site.
 *
 * **Example** (Recognize a guard signal)
 *
 * ```ts
 * import { GuardExceeded, isGuardExceeded } from "@beep/markdown/internal/carriers"
 *
 * const error: unknown = GuardExceeded.new("NestingDepthExceeded", 128, 129, 12)
 * console.log(isGuardExceeded(error)) // true
 * console.log(isGuardExceeded("NestingDepthExceeded")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isGuardExceeded = S.is(GuardExceeded);
