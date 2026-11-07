/**
 * Source-aligned lexical evidence for optional inspection grammar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
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
 * Exact raw-form membership supplied independently of contextual POS.
 * @category models
 * @since 0.0.0
 */
export const ClaimIntrinsicNounWitness = LiteralKit(["unavailable", "known"])
  .toTaggedUnion("status")({
    unavailable: {},
    known: { anchor: TextAnchor, rawForm: S.NonEmptyString, baseNoun: S.Boolean, oov: S.Boolean },
  })
  .pipe(
    $I.annoteSchema("ClaimIntrinsicNounWitness", {
      description: "No sense/countability/role inference; only exact original input may support an intrinsic raw fact.",
    })
  );
/**
 * Intrinsic input witness type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimIntrinsicNounWitness = typeof ClaimIntrinsicNounWitness.Type;
/**
 * The unchanged source allowance, including work already paid by lexical queries.
 * @category models
 * @since 0.0.0
 */
export const ClaimLexicalSourceWork = S.Int.check(S.isBetween({ minimum: 0, maximum: 262_144 })).pipe(
  $I.annoteSchema("ClaimLexicalSourceWork", {
    description: "Neither a new phase allowance nor transferable credit between source records.",
  })
);
/**
 * Source-work value type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimLexicalSourceWork = typeof ClaimLexicalSourceWork.Type;
/**
 * One exact lexical token; POS and lemma do not assert semantic roles.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimLexicalToken extends S.Opaque<ClaimLexicalToken, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: TextAnchor,
    pos: S.NonEmptyString,
    lemma: S.OptionFromNullOr(S.NonEmptyString),
    intrinsicNoun: ClaimIntrinsicNounWitness.pipe(
      S.withDecodingDefaultKey(Effect.succeed(ClaimIntrinsicNounWitness.cases.unavailable.make({}))),
      S.withConstructorDefault(Effect.succeed(ClaimIntrinsicNounWitness.cases.unavailable.make({})))
    ),
  }).pipe(
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
      lexicalWorkConsumed: ClaimLexicalSourceWork.pipe(
        S.withDecodingDefaultKey(Effect.succeed(0)),
        S.withConstructorDefault(Effect.succeed(0))
      ),
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

/**
 * Original aligned source identity, separate from proof ordinals.
 * @category models
 * @since 0.0.0
 */
export class ClaimLexicalSourceIdentity extends S.Opaque<
  ClaimLexicalSourceIdentity,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    sourceKey: S.NonEmptyString,
    sourceOrdinal: PosInt,
    provider: S.NonEmptyString,
    assetDigest: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ClaimLexicalSourceIdentity", {
      description: "A producer identity joins the immutable original input, never a reconstructed certificate table.",
    })
  )
) {}
/**
 * Application-local query request with a before-query work carrier.
 * @category models
 * @since 0.0.0
 */
export class ClaimLexicalMembershipRequest extends S.Opaque<
  ClaimLexicalMembershipRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    rawForm: S.NonEmptyString,
    token: TextAnchor,
    provider: ClaimLexicalProviderIdentity,
    remainingWork: ClaimLexicalSourceWork,
  }).pipe(
    $I.annoteSchema("ClaimLexicalMembershipRequest", {
      description: "Exact raw source form and existing remaining work; no normalization/lemma fallback.",
    })
  )
) {}
/**
 * Application-local paid membership response.
 * @category models
 * @since 0.0.0
 */
export const ClaimLexicalMembershipResult = LiteralKit(["known", "unavailable", "work-limit"])
  .toTaggedUnion("status")({
    known: {
      rawForm: S.NonEmptyString,
      provider: ClaimLexicalProviderIdentity,
      baseNoun: S.Boolean,
      oov: S.Boolean,
      workDebit: ClaimLexicalSourceWork,
      remainingWork: ClaimLexicalSourceWork,
    },
    unavailable: {
      rawForm: S.NonEmptyString,
      provider: ClaimLexicalProviderIdentity,
      reason: S.Literals(["unsupported-owner", "query-failed"]),
      workDebit: ClaimLexicalSourceWork,
      remainingWork: ClaimLexicalSourceWork,
    },
    "work-limit": {
      rawForm: S.NonEmptyString,
      provider: ClaimLexicalProviderIdentity,
      workDebit: S.tag(0),
      remainingWork: ClaimLexicalSourceWork,
    },
  })
  .pipe(
    $I.annoteSchema("ClaimLexicalMembershipResult", {
      description: "Exact identity/form and remaining=prior-debit are checked before a witness is published.",
    })
  );
/**
 * Application-local response type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimLexicalMembershipResult = typeof ClaimLexicalMembershipResult.Type;
