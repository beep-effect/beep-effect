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
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/CourtInference/CourtInference.model");

const CourtLevelBase = LiteralKit(["supreme", "appellate", "trial", "unknown"]);

/**
 * Court level classification inferred from a reporter series.
 *
 * **Details**
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `CourtLevel.Enum` for typed literal access, `CourtLevel.is` for
 * per-literal guards, and `CourtLevel.Options` for the full literal list.
 *
 * **Example** (Decode and use helpers)
 *
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
export const CourtLevel = CourtLevelBase.pipe(
  $I.annoteSchema("CourtLevel", {
    description: "Court level classification inferred from a reporter series.",
  }),
  SchemaUtils.withLiteralKitStatics(CourtLevelBase)
);

/**
 * The decoded literal type for {@link CourtLevel} — a union of every court
 * level classification (`"supreme" | "appellate" | "trial" | "unknown"`).
 *
 * **Example** (Assign court level type)
 *
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

const KnownCourtLevel = LiteralKit(CourtLevelBase.pickOptions(["supreme", "appellate", "trial"]));

const CourtJurisdictionBase = LiteralKit(["federal", "state", "unknown"]);

/**
 * Jurisdiction classification inferred from a reporter series.
 *
 * **Details**
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `CourtJurisdiction.Enum` for typed literal access,
 * `CourtJurisdiction.is` for per-literal guards, and `CourtJurisdiction.Options`
 * for the full literal list.
 *
 * **Example** (Decode and use helpers)
 *
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
export const CourtJurisdiction = CourtJurisdictionBase.pipe(
  $I.annoteSchema("CourtJurisdiction", {
    description: "Jurisdiction classification inferred from a reporter series.",
  }),
  SchemaUtils.withLiteralKitStatics(CourtJurisdictionBase)
);

/**
 * The decoded literal type for {@link CourtJurisdiction} — a union of every
 * jurisdiction classification (`"federal" | "state" | "unknown"`).
 *
 * **Example** (Assign jurisdiction type)
 *
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

const CourtInferenceConfidence = S.Finite.annotateKey({
  description: "Confidence score 0.0-1.0 (1.0 for unambiguous, 0.7 for regional multi-state).",
});

/**
 * Court level and jurisdiction inferred from a reporter series.
 *
 * **Details**
 *
 * Populated independently of the parenthetical-extracted `court` field, so a
 * citation may carry both a reporter-derived inference and an explicitly parsed
 * court. Federal and state systems both have supreme/highest, appellate, and
 * trial levels. The optional `state` code belongs only to the state variant;
 * the unknown jurisdiction pairs with the unknown level.
 *
 * **Example** (Make inference with state)
 *
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
export const CourtInference = CourtJurisdiction.mapMembers(
  Tuple.evolve([
    (literal: S.Literal<"federal">) =>
      S.Struct({
        jurisdiction: S.tag(literal.literal).annotateKey({
          description: "Federal court-system jurisdiction.",
        }),
        level: KnownCourtLevel.annotateKey({
          description: "Supreme, appellate, or trial level within the federal court system.",
        }),
        confidence: CourtInferenceConfidence,
      }),
    (literal: S.Literal<"state">) =>
      S.Struct({
        jurisdiction: S.tag(literal.literal).annotateKey({
          description: "State court-system jurisdiction.",
        }),
        level: KnownCourtLevel.annotateKey({
          description: "Supreme/highest, appellate, or trial level within a state court system.",
        }),
        state: S.String.pipe(
          S.OptionFromOptionalKey,
          SchemaUtils.withNoneDefault,
          S.annotateKey({
            description: "2-letter state code when the reporter identifies one state.",
          })
        ),
        confidence: CourtInferenceConfidence,
      }),
    (literal: S.Literal<"unknown">) =>
      S.Struct({
        jurisdiction: S.tag(literal.literal).annotateKey({
          description: "Unknown court-system jurisdiction.",
        }),
        level: S.tag("unknown").annotateKey({
          description: "Unknown court level.",
        }),
        confidence: CourtInferenceConfidence,
      }),
  ])
).pipe(
  S.toTaggedUnion("jurisdiction"),
  $I.annoteSchema("CourtInference", {
    description: "Court level and jurisdiction inferred from a reporter series.",
  })
);

/**
 * Runtime type for {@link CourtInference}.
 *
 * @see {@link CourtInference} for the jurisdiction-tagged inference schema.
 * @category models
 * @since 0.0.0
 */
export type CourtInference = typeof CourtInference.Type;

/**
 * Companion namespace for `CourtInference`.
 *
 * **Example** (Access Encoded level type)
 *
 * ```ts
 * import type { CourtInference } from "@beep/law-practice-domain"
 *
 * const level: CourtInference.Encoded["level"] = "appellate"
 * console.log(level) // "appellate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CourtInference {
  /**
   * Wire-encoded representation of a decoded {@link CourtInference}.
   *
   * **Example** (Alias Encoded wire type)
   *
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
