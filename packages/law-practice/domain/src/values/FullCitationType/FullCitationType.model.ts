/**
 * Full-citation-type value object: the discriminant literal identifying which
 * kind of legal authority a full (non-short-form) citation refers to.
 *
 * The literal domain (`case`, `statute`, `constitutional`, ...) selects which
 * component-span schema applies to a given full citation and how downstream
 * formatters render it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/FullCitationType/FullCitationType.model");

/**
 * Citation type discriminators for full (non-short-form) citations.
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `FullCitationType.Enum` for typed literal access, `FullCitationType.is`
 * for per-literal guards, and `FullCitationType.Options` for the full literal
 * list.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { FullCitationType } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(FullCitationType)("statute")
 * console.log(kind) // "statute"
 * console.log(FullCitationType.Enum.case) // "case"
 * console.log(FullCitationType.is.constitutional("constitutional")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FullCitationType = LiteralKit([
  "case",
  "docket",
  "statute",
  "regulation",
  "journal",
  "neutral",
  "publicLaw",
  "federalRegister",
  "statutesAtLarge",
  "sessionLaw",
  "treaty",
  "legislativeMaterial",
  "localOrdinance",
  "canon",
  "constitutional",
  "federalRule",
  "stateRule",
  "restatement",
  "treatise",
  "annotation",
]).pipe(
  $I.annoteSchema("FullCitationType", {
    description: "Discriminant identifying the kind of legal authority a full (non-short-form) citation refers to.",
  })
);

/**
 * The decoded literal type for {@link FullCitationType} — a union of every full
 * citation kind (`"case" | "docket" | "statute" | ...`).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import type { FullCitationType } from "@beep/law-practice-domain"
 *
 * const kind: FullCitationType = "constitutional"
 * console.log(kind) // "constitutional"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FullCitationType = typeof FullCitationType.Type;
