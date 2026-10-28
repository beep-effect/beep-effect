/**
 * Citation semantic union and schema-derived full/reference subsets.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import {
  FullCaseCitation,
  IdCitation,
  ReferenceCitation,
  ShortFormCaseCitation,
  SupraCitation,
  UnknownCitation,
} from "./Citation.case.ts";
import { FullJournalCitation } from "./Citation.journal.ts";
import { FullLawCitation } from "./Citation.law.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.models");

/**
 * Canonical citation meanings without occurrence or run state.
 * **Example** (Inspect the law discriminator)
 * ```ts
 * import { Citation } from "@beep/law-practice-domain/values"
 * console.log(Citation.tag) // "type"
 * console.log(Citation.discriminants.includes("law")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const Citation = S.Union([
  FullCaseCitation,
  FullLawCitation,
  FullJournalCitation,
  IdCitation,
  SupraCitation,
  ShortFormCaseCitation,
  ReferenceCitation,
  UnknownCitation,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("Citation", {
    description:
      "Canonical semantic citation union; any future extension requires an evidenced disposition and the same semantic/evidence separation.",
  })
);
/**
 * Schema-derived citation value.
 * @category models
 * @since 0.0.0
 */
export type Citation = typeof Citation.Type;

/**
 * Full authorities selected from the existing citation union's cases.
 * **Example** (Inspect a full law branch)
 * ```ts
 * import { FullCitation } from "@beep/law-practice-domain/values"
 * console.log(FullCitation.discriminants.includes("law")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const FullCitation = S.Union([Citation.cases.case, Citation.cases.law, Citation.cases.journal]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("FullCitation", {
    description: "Full-authority subset derived from Citation cases; no independent type literal list.",
  })
);
/**
 * Schema-derived full citation value.
 * @category models
 * @since 0.0.0
 */
export type FullCitation = typeof FullCitation.Type;

/**
 * Schema-derived full citation input/output types for transformation contracts.
 * **Example** (Type a structured transform input)
 * ```ts
 * import type { FullCitation } from "@beep/law-practice-domain/values"
 * const kindOf = (citation: FullCitation.Type) => citation.type
 * console.log(kindOf !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export declare namespace FullCitation {
  /**
   * Decoded semantic union derived from the FullCitation schema.
   * @category models
   * @since 0.0.0
   */
  export type Type = FullCitation;
  /**
   * Structured encoded form derived from the FullCitation schema.
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof FullCitation.Encoded;
}

/**
 * Short and named references derived from the existing citation union.
 * **Example** (Inspect the named-reference branch)
 * ```ts
 * import { ShortFormCitation } from "@beep/law-practice-domain/values"
 * console.log(ShortFormCitation.discriminants.includes("reference")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const ShortFormCitation = S.Union([
  Citation.cases.id,
  Citation.cases.supra,
  Citation.cases.shortFormCase,
  Citation.cases.reference,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ShortFormCitation", {
    description: "Short/named reference subset from Citation cases; unknown citations remain a distinct branch.",
  })
);
/**
 * Schema-derived short or named reference.
 * @category models
 * @since 0.0.0
 */
export type ShortFormCitation = typeof ShortFormCitation.Type;
