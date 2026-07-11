/**
 * Court-inference value object: the court level and jurisdiction inferred from
 * the reporter series of a parsed citation.
 *
 * These classifications are populated independently of the
 * parenthetical-extracted `court` field, so a citation can carry both a
 * reporter-derived inference and an explicitly parsed court.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/CourtInference/CourtInference.model");

/**
 * Court level classification inferred from a reporter series.
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `CourtLevel.Enum` for typed literal access, `CourtLevel.is` for
 * per-literal guards, and `CourtLevel.Options` for the full literal list.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CourtLevel } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const level = S.decodeUnknownSync(CourtLevel)("supreme")
 * console.log(level) // "supreme"
 * console.log(CourtLevel.Enum.appellate) // "appellate"
 * console.log(CourtLevel.is.trial("trial")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CourtLevel = LiteralKit(["supreme", "appellate", "trial", "unknown"]).pipe(
  $I.annoteSchema("CourtLevel", {
    description: "Court level classification inferred from a reporter series.",
  })
);

/**
 * The decoded literal type for {@link CourtLevel} — a union of every court
 * level classification (`"supreme" | "appellate" | "trial" | "unknown"`).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import type { CourtLevel } from "@beep/law-practice-domain"
 *
 * const level: CourtLevel = "appellate"
 * console.log(level) // "appellate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CourtLevel = typeof CourtLevel.Type;

/**
 * Jurisdiction classification inferred from a reporter series.
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `CourtJurisdiction.Enum` for typed literal access,
 * `CourtJurisdiction.is` for per-literal guards, and `CourtJurisdiction.Options`
 * for the full literal list.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CourtJurisdiction } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const jurisdiction = S.decodeUnknownSync(CourtJurisdiction)("federal")
 * console.log(jurisdiction) // "federal"
 * console.log(CourtJurisdiction.Enum.state) // "state"
 * console.log(CourtJurisdiction.is.unknown("unknown")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CourtJurisdiction = LiteralKit(["federal", "state", "unknown"]).pipe(
  $I.annoteSchema("CourtJurisdiction", {
    description: "Jurisdiction classification inferred from a reporter series.",
  })
);

/**
 * The decoded literal type for {@link CourtJurisdiction} — a union of every
 * jurisdiction classification (`"federal" | "state" | "unknown"`).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import type { CourtJurisdiction } from "@beep/law-practice-domain"
 *
 * const jurisdiction: CourtJurisdiction = "state"
 * console.log(jurisdiction) // "state"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CourtJurisdiction = typeof CourtJurisdiction.Type;

/**
 * Court level and jurisdiction inferred from a reporter series.
 *
 * Populated independently of the parenthetical-extracted `court` field, so a
 * citation may carry both a reporter-derived inference and an explicitly parsed
 * court. The optional `state` code is present only for state-specific reporters.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CourtInference } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const inference = CourtInference.make({
 *   level: "appellate",
 *   jurisdiction: "state",
 *   state: O.some("NY"),
 *   confidence: 0.7,
 * })
 *
 * console.log(inference.level) // "appellate"
 * console.log(O.getOrNull(inference.state)) // "NY"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CourtInference extends S.Class<CourtInference>($I`CourtInference`)(
  {
    level: CourtLevel.annotateKey({
      description: "Court level classification.",
    }),
    jurisdiction: CourtJurisdiction.annotateKey({
      description: "Jurisdiction classification.",
    }),
    state: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "2-letter state code, only for state-specific reporters.",
      })
    ),
    confidence: S.Finite.annotateKey({
      description: "Confidence score 0.0-1.0 (1.0 for unambiguous, 0.7 for regional multi-state).",
    }),
  },
  $I.annote("CourtInference", {
    description: "Court level and jurisdiction inferred from a reporter series.",
  })
) {}

/**
 * Companion namespace for `CourtInference`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CourtInference {
  /**
   * Wire-encoded representation of a decoded {@link CourtInference}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { CourtInference } from "@beep/law-practice-domain"
   *
   * type Wire = CourtInference.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CourtInference.Encoded;
}
