/**
 * Short-form citation-type value object: the discriminant literal identifying
 * which kind of short-form reference a parsed citation is.
 *
 * Short-form references (`Id.`, `supra`, and short-form case citations) point
 * back to an authority cited in full earlier in the document; this literal
 * domain selects how downstream resolvers link a short form to its antecedent.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/ShortFormCitationType/ShortFormCitationType.model");

/**
 * Citation type discriminators for short-form references (`Id.`, supra,
 * short-form case).
 *
 * **Details**
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `ShortFormCitationType.Enum` for typed literal access,
 * `ShortFormCitationType.is` for per-literal guards, and
 * `ShortFormCitationType.Options` for the full literal list.
 *
 * **Example** (Decode and guard short-form types)
 *
 * ```ts
 * import { ShortFormCitationType } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(ShortFormCitationType)("supra")
 * console.log(kind) // "supra"
 * console.log(ShortFormCitationType.Enum.id) // "id"
 * console.log(ShortFormCitationType.is.shortFormCase("shortFormCase")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShortFormCitationType = LiteralKit(["id", "supra", "shortFormCase"]).pipe(
  $I.annoteSchema("ShortFormCitationType", {
    description: "Discriminant identifying which kind of short-form reference a citation is.",
  })
);

/**
 * The decoded literal type for {@link ShortFormCitationType} — a union of every
 * short-form discriminator (`"id" | "supra" | "shortFormCase"`).
 *
 * **Example** (Assign supra short-form type)
 *
 * ```ts
 * import type { ShortFormCitationType } from "@beep/law-practice-domain"
 *
 * const kind: ShortFormCitationType = "supra"
 * console.log(kind) // "supra"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ShortFormCitationType = typeof ShortFormCitationType.Type;
