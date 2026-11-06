/**
 * Source-aligned lexical evidence for optional inspection grammar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { ClaimInputCollection, ClaimInputQualification } from "./ClaimElement.input.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimLexicalEvidence");
/**
 * Prepared preserved ledger; qualification is not checking.
 *
 * @category models
 * @since 0.0.0
 */
export class PreparedClaimInspection extends S.Opaque<PreparedClaimInspection, { readonly brand: unique symbol }>()(
  S.Struct({ input: ClaimInputCollection, qualifications: S.Array(ClaimInputQualification) }).pipe(
    $I.annoteSchema("PreparedClaimInspection", {
      description: "Every original record and its normalized qualification, before lexical annotation.",
    })
  )
) {}
/**
 * One exact lexical token; POS and lemma do not assert semantic roles.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimLexicalToken extends S.Opaque<ClaimLexicalToken, { readonly brand: unique symbol }>()(
  S.Struct({ anchor: TextAnchor, pos: S.NonEmptyString, lemma: S.OptionFromNullOr(S.NonEmptyString) }).pipe(
    $I.annoteSchema("ClaimLexicalToken", {
      description: "Provider token retaining exact qualified UTF-16 span, raw POS and optional lemma.",
    })
  )
) {}
const evidenceStatus = LiteralKit(["aligned", "unavailable"]).pipe(
  $I.annoteSchema("ClaimLexicalEvidenceStatus", {
    description: "Lexical annotation is source-aligned or explicitly unavailable.",
  })
);
/**
 * Neutral lexical facts, bound to a normalized source record.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimLexicalEvidence = evidenceStatus
  .toTaggedUnion("status")({
    aligned: {
      sourceKey: S.NonEmptyString,
      sourceOrdinal: PosInt,
      qualifiedText: S.NonEmptyString,
      provider: S.NonEmptyString,
      assetDigest: S.NonEmptyString,
      tokens: S.Array(ClaimLexicalToken),
    },
    unavailable: {
      sourceKey: S.NonEmptyString,
      sourceOrdinal: PosInt,
      qualifiedText: S.NonEmptyString,
      reason: S.Literals(["source-work-limit", "tokenization-failed", "alignment-failed"]),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimLexicalEvidence", {
      description: "No lexical failure invents tokens, drops source records or clears policy uncertainty.",
    })
  );
/**
 * Neutral evidence type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimLexicalEvidence = typeof ClaimLexicalEvidence.Type;

/**
 * Fixed lexical provider/model byte identity supplied by the host.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimLexicalProviderIdentity extends S.Opaque<
  ClaimLexicalProviderIdentity,
  { readonly brand: unique symbol }
>()(
  S.Struct({ provider: S.NonEmptyString, assetDigest: S.NonEmptyString }).pipe(
    $I.annoteSchema("ClaimLexicalProviderIdentity", {
      description: "Pinned provider and complete runtime asset inventory digest; no semantic facts.",
    })
  )
) {}
