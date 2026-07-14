/**
 * Citation-warning value object: a diagnostic emitted while parsing a legal
 * citation, ported from the eyecite `Warning` interface.
 *
 * A warning pairs a severity `level` with a human-readable `message`, the
 * `position` of the offending region in the source text, and optional free-form
 * `context`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/CitationWarning/CitationWarning.models");

/**
 * Severity level of a {@link CitationWarning}.
 *
 * Backed by a {@link LiteralKit}, so callers get `WarningLevel.Enum` for typed
 * literal access and `WarningLevel.is` for per-level guards.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { WarningLevel } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(WarningLevel)("warning")) // "warning"
 * console.log(WarningLevel.Enum.info) // "info"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WarningLevel = LiteralKit(["error", "warning", "info"]).pipe(
  $I.annoteSchema("WarningLevel", {
    description: "Severity level of a citation warning.",
  })
);

/**
 * The decoded literal type for {@link WarningLevel}:
 * `"error" | "warning" | "info"`.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import type { WarningLevel } from "@beep/law-practice-domain"
 *
 * const level: WarningLevel = "error"
 * console.log(level) // "error"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WarningLevel = typeof WarningLevel.Type;

/**
 * Character range within the source text that a {@link CitationWarning} refers
 * to — the `[start, end)` offsets of the problematic region.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { WarningPosition } from "@beep/law-practice-domain"
 *
 * const position = WarningPosition.make({ start: 3, end: 9 })
 * console.log(position.end) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WarningPosition extends S.Class<WarningPosition>($I`WarningPosition`)(
  {
    start: S.Finite.annotateKey({
      description: "Start offset of the problematic region in the source text.",
    }),
    end: S.Finite.annotateKey({
      description: "End offset of the problematic region in the source text.",
    }),
  },
  $I.annote("WarningPosition", {
    description: "Character range of the region a citation warning refers to.",
  })
) {}

/**
 * A diagnostic emitted while parsing a citation.
 *
 * Pairs a severity {@link WarningLevel} with a human-readable `message`, the
 * {@link WarningPosition} of the offending region, and optional free-form
 * `context`.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CitationWarning, WarningPosition } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const warning = CitationWarning.make({
 *   level: "error",
 *   message: "Unbalanced parentheses in citation",
 *   position: WarningPosition.make({ start: 0, end: 12 }),
 * })
 *
 * console.log(warning.level) // "error"
 * console.log(O.isNone(warning.context)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitationWarning extends S.Class<CitationWarning>($I`CitationWarning`)(
  {
    level: WarningLevel.annotateKey({
      description: "Severity level of the warning.",
    }),
    message: S.String.annotateKey({
      description: "Human-readable description of the issue.",
    }),
    position: WarningPosition.annotateKey({
      description: "Position of the problematic region.",
    }),
    context: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Additional free-form context about the warning.",
      })
    ),
  },
  $I.annote("CitationWarning", {
    description: "A diagnostic emitted while parsing a citation.",
  })
) {}

/**
 * Companion namespace for `CitationWarning`.
 *
 * @example
 * ```ts
 * import type { CitationWarning } from "@beep/law-practice-domain"
 *
 * const level: CitationWarning.Encoded["level"] = "warning"
 * console.log(level) // "warning"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CitationWarning {
  /**
   * Wire-encoded representation of a decoded {@link CitationWarning}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { CitationWarning } from "@beep/law-practice-domain"
   *
   * type Wire = CitationWarning.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CitationWarning.Encoded;
}
