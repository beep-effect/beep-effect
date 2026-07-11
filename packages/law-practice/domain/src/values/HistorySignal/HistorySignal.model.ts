/**
 * History-signal value object: the normalized subsequent-history classification
 * that records what a later court did to the cited authority.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/HistorySignal/HistorySignal.model");

/**
 * Normalized subsequent-history signal classification.
 *
 * Maps variant spellings (`aff'd`, `affirmed`) onto a single canonical form so
 * downstream consumers compare one value per disposition. Federal-style
 * subsequent history (`affirmed`, `reversed`, `cert_denied`, ...) sits
 * alongside two jurisdiction-specific families that are kept distinct so
 * consumers can tell them apart: Texas Greenbook writ and petition history
 * (Tex. R. App. P. 47.7 — `writ_refused`, `pet_denied`, `no_pet`, ...) and
 * California review history (`review_denied`, `petition_for_review_granted`,
 * `superseded_by_grant_of_review`, ...). See eyecite-ts issues #229 and #238.
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `HistorySignal.Enum` for typed literal access, `HistorySignal.is`
 * for per-literal guards, and `HistorySignal.Options` for the full literal
 * list.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { HistorySignal } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const signal = S.decodeUnknownSync(HistorySignal)("cert_denied")
 * console.log(signal) // "cert_denied"
 * console.log(HistorySignal.Enum.writ_refused) // "writ_refused"
 * console.log(HistorySignal.is.review_granted("review_granted")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HistorySignal = LiteralKit([
  "affirmed",
  "reversed",
  "cert_denied",
  "cert_granted",
  "overruled",
  "vacated",
  "remanded",
  "modified",
  "abrogated",
  "superseded",
  "disapproved",
  "questioned",
  "distinguished",
  "withdrawn",
  "reinstated",
  "rehearing_denied",
  "rehearing_granted",
  "writ_refused",
  "writ_dismissed",
  "writ_denied",
  "writ_granted",
  "no_writ",
  "pet_refused",
  "pet_denied",
  "pet_dismissed",
  "pet_granted",
  "pet_filed",
  "no_pet",
  "review_denied",
  "review_granted",
  "opinion_vacated",
  "disapproved_other_grounds",
  "not_published",
  "petition_for_review_filed",
  "petition_for_review_granted",
  "petition_for_review_denied",
  "superseded_by_grant_of_review",
  "modified_on_denial_of_rehearing",
]).pipe(
  $I.annoteSchema("HistorySignal", {
    description: "Normalized subsequent-history signal classifying what a later court did to a cited authority.",
  })
);

/**
 * The decoded literal type for {@link HistorySignal} — a union of every
 * normalized subsequent-history disposition (`"affirmed" | "reversed" |
 * "cert_denied" | ...`), spanning federal-style history, Texas Greenbook
 * writ/petition history, and California review history.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import type { HistorySignal } from "@beep/law-practice-domain"
 *
 * const signal: HistorySignal = "no_writ"
 * console.log(signal) // "no_writ"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HistorySignal = typeof HistorySignal.Type;
