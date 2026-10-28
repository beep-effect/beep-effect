/**
 * Citation semantic union and schema-derived full/reference subsets.
 * Legacy extension branches remain provisional pending their donor dispositions.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { AnnotationCitation } from "../AnnotationCitation/index.ts";
import { CanonCitation } from "../CanonCitation/index.ts";
import { ConstitutionalCitation } from "../ConstitutionalCitation/index.ts";
import { DocketCitation } from "../DocketCitation/index.ts";
import { FederalRegisterCitation } from "../FederalRegisterCitation/index.ts";
import { FederalRuleCitation } from "../FederalRuleCitation/index.ts";
import { LegislativeMaterialCitation } from "../LegislativeMaterialCitation/index.ts";
import { LocalOrdinanceCitation } from "../LocalOrdinanceCitation/index.ts";
import { NeutralCitation } from "../NeutralCitation/index.ts";
import { PublicLawCitation } from "../PublicLawCitation/index.ts";
import { RestatementCitation } from "../RestatementCitation/index.ts";
import { SessionLawCitation } from "../SessionLawCitation/index.ts";
import { StateRuleCitation } from "../StateRuleCitation/index.ts";
import { StatutesAtLargeCitation } from "../StatutesAtLargeCitation/index.ts";
import { TreatiseCitation } from "../TreatiseCitation/index.ts";
import { TreatyCitation } from "../TreatyCitation/index.ts";
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
 * Citation meanings; canonical forms contain no occurrence or run state.
 * Remaining extension branches still await schema/disposition migration.
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
  AnnotationCitation,
  CanonCitation,
  ConstitutionalCitation,
  DocketCitation,
  FederalRegisterCitation,
  FederalRuleCitation,
  LegislativeMaterialCitation,
  LocalOrdinanceCitation,
  NeutralCitation,
  PublicLawCitation,
  RestatementCitation,
  SessionLawCitation,
  StateRuleCitation,
  StatutesAtLargeCitation,
  TreatiseCitation,
  TreatyCitation,
  IdCitation,
  SupraCitation,
  ShortFormCaseCitation,
  ReferenceCitation,
  UnknownCitation,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("Citation", {
    description:
      "Citation semantic union; extension branches are provisional until their dispositions and schema separation are complete.",
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
export const FullCitation = S.Union([
  Citation.cases.case,
  Citation.cases.law,
  Citation.cases.journal,
  Citation.cases.annotation,
  Citation.cases.canon,
  Citation.cases.constitutional,
  Citation.cases.docket,
  Citation.cases.federalRegister,
  Citation.cases.federalRule,
  Citation.cases.legislativeMaterial,
  Citation.cases.localOrdinance,
  Citation.cases.neutral,
  Citation.cases.publicLaw,
  Citation.cases.restatement,
  Citation.cases.sessionLaw,
  Citation.cases.stateRule,
  Citation.cases.statutesAtLarge,
  Citation.cases.treatise,
  Citation.cases.treaty,
]).pipe(
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
