/**
 * Citation-type value object: the discriminant literal identifying which kind
 * of legal authority a parsed citation refers to.
 *
 * The literal domain (`case`, `statute`, `constitutional`, ...) selects which
 * component-span schema applies to a given citation and how downstream
 * formatters render it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/CitationType/CitationType.model");

/**
 * The kind of legal authority a citation refers to.
 *
 * **Details**
 *
 * Backed by a {@link LiteralKit} so callers get the schema plus derived
 * helpers: `CitationType.Enum` for typed literal access, `CitationType.is` for
 * per-literal guards, and `CitationType.Options` for the full literal list.
 *
 * **Example** (Decode and use helpers)
 *
 * ```ts
 * import { CitationType } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(CitationType)("statute")
 * console.log(kind) // "statute"
 * console.log(CitationType.Enum.case) // "case"
 * console.log(CitationType.is.constitutional("constitutional")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationType = LiteralKit([
  "case",
  "docket",
  "statute",
  "regulation",
  "stateRule",
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
  "restatement",
  "treatise",
  "annotation",
  "id",
  "supra",
  "shortFormCase",
]).pipe(
  $I.annoteSchema("CitationType", {
    description: "Discriminant identifying the kind of legal authority a citation refers to.",
  })
);

/**
 * The decoded literal type for {@link CitationType} — a union of every citation
 * kind (`"case" | "docket" | "statute" | ...`).
 *
 * **Example** (Assign decoded literal type)
 *
 * ```ts
 * import type { CitationType } from "@beep/law-practice-domain"
 *
 * const kind: CitationType = "constitutional"
 * console.log(kind) // "constitutional"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CitationType = typeof CitationType.Type;
