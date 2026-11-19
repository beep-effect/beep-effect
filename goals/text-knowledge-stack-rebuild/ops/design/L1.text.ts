/**
 * L1 text: occurrence identity, the selector union, resolution and
 * re-anchoring outcomes, and `Anchored` as a powerless receipt.
 *
 * Target home: `@beep/text` (today `@beep/provenance`, renamed in P2).
 * `TextAnchor`, `VerifiedTextAnchor` and `TextAnchorVerificationReceipt` keep
 * their shapes and are imported, not redefined.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { SourceTextDigest, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { IRI } from "@beep/rdf/Iri";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { PosixPath } from "@beep/schema/PosixPath";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ContentHash, DomainTag, mintContentHash } from "./L0.digest.ts";
import type { JsoncCanonicalizeError } from "@beep/jsonc/JsoncFingerprint";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import type * as Digest from "effect/crypto/Digest";
import type * as Result from "effect/Result";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L1.text");

/** Offset units allowed in identity-bearing positions; grapheme clusters are excluded. */
export const OffsetUnit = LiteralKit(["utf16-code-unit", "unicode-code-point", "utf8-byte"]).pipe(
  $I.annoteSchema("OffsetUnit", {
    description: "Unit of a text position; utf16-code-unit is the canonical stored unit.",
  })
);

/** Decoded type of {@link OffsetUnit}. */
export type OffsetUnit = typeof OffsetUnit.Type;

/** The only occurrence identity in the repository: the hash of the `occurrence/v1` preimage. */
export const OccurrenceId = ContentHash.pipe(
  S.brand("OccurrenceId"),
  $I.annoteSchema("OccurrenceId", {
    description: "Content hash of scope, the whole text capture, unit, range and quote.",
  })
);

/** Decoded type of {@link OccurrenceId}. */
export type OccurrenceId = typeof OccurrenceId.Type;

/** A grouping key over a normalized quote; explicitly not injective over occurrences. */
export const QuoteKey = ContentHash.pipe(
  S.brand("QuoteKey"),
  $I.annoteSchema("QuoteKey", {
    description: "Content hash of a normalized quote, used to group repeated passages, never to identify one.",
  })
);

/** Decoded type of {@link QuoteKey}. */
export type QuoteKey = typeof QuoteKey.Type;

/** A half-open position `[start, end)` in a declared unit; the Position case of {@link Selector}. */
export class Position extends S.Opaque<Position, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Position", {
    unit: OffsetUnit,
    start: S.Natural.annotateKey({ description: "Inclusive start offset." }),
    end: S.Natural.annotateKey({ description: "Exclusive end offset." }),
  })
    .check(
      S.makeFilter(
        (position: { readonly start: number; readonly end: number }) => position.start < position.end,
        $I.annote("PositionOrderCheck", {
          title: "Position Order",
          description: "A position is non-empty: start is less than end.",
          message: "Expected start to be less than end.",
        })
      )
    )
    .pipe($I.annoteSchema("Position", { description: "A non-empty half-open text position in one unit." }))
) {}

/** The Quote case of {@link Selector}: an exact quote with optional context, which locates but never identifies. */
export class QuoteSelector extends S.Opaque<QuoteSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Quote", {
    exact: S.NonEmptyString.annotateKey({ description: "Exact quoted text." }),
    prefix: S.OptionFromOptionalKey(S.String).annotateKey({ description: "Text immediately before the quote." }),
    suffix: S.OptionFromOptionalKey(S.String).annotateKey({ description: "Text immediately after the quote." }),
  }).pipe($I.annoteSchema("QuoteSelector", { description: "An oa:TextQuoteSelector." }))
) {}

/** The Fragment case of {@link Selector}: a fragment identifier conforming to a named specification. */
export class FragmentSelector extends S.Opaque<FragmentSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Fragment", {
    conformsTo: IRI.annotateKey({ description: "Specification the fragment conforms to." }),
    value: S.NonEmptyString.annotateKey({ description: "Fragment identifier value." }),
  }).pipe($I.annoteSchema("FragmentSelector", { description: "An oa:FragmentSelector." }))
) {}

type SelectorType = Position | QuoteSelector | FragmentSelector | RefinedSelector | RangeSelector;

type SelectorEncoded =
  | typeof Position.Encoded
  | typeof QuoteSelector.Encoded
  | typeof FragmentSelector.Encoded
  | {
      readonly _tag: "Refined";
      readonly base: SelectorEncoded;
      readonly by: SelectorEncoded;
    }
  | {
      readonly _tag: "Range";
      readonly from: SelectorEncoded;
      readonly to: SelectorEncoded;
    };

const SelectorRef = S.suspend((): S.Codec<Selector.Type, Selector.Encoded> => Selector);

/** The Refined case of {@link Selector}: `by` is applied inside the segment `base` selects. */
export class RefinedSelector extends S.Opaque<RefinedSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Refined", {
    base: SelectorRef.annotateKey({ description: "Outer selector." }),
    by: SelectorRef.annotateKey({ description: "Selector applied inside the outer selection." }),
  }).pipe($I.annoteSchema("RefinedSelector", { description: "An oa:refinedBy chain." }))
) {}

/** The Range case of {@link Selector}: the span from the start of `from` to the end of `to`. */
export class RangeSelector extends S.Opaque<RangeSelector, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Range", {
    from: SelectorRef.annotateKey({ description: "Selector whose start opens the range." }),
    to: SelectorRef.annotateKey({ description: "Selector whose end closes the range." }),
  }).pipe($I.annoteSchema("RangeSelector", { description: "An oa:RangeSelector." }))
) {}

/** The one selector union beside the canonical `TextAnchor`, recursive through Refined and Range. */
export const Selector = S.Union([Position, QuoteSelector, FragmentSelector, RefinedSelector, RangeSelector]).pipe(
  $I.annoteSchema("Selector", { description: "The Web Annotation selector algebra over one text capture." }),
  S.toTaggedUnion("_tag")
);

/** Decoded and encoded sides of the recursive {@link Selector}. */
export declare namespace Selector {
  /** Decoded selector. */
  export type Type = SelectorType;
  /** Encoded selector. */
  export type Encoded = SelectorEncoded;
}

/** Decoded type of {@link Selector}. */
export type Selector = Selector.Type;

/** Outcome of resolving a selector in one text capture; ambiguity is its own outcome and fails closed. */
export const Resolution = S.TaggedUnion({
  Unique: { position: Position, quote: S.NonEmptyString },
  Ambiguous: { count: S.Int.check(S.isGreaterThanOrEqualTo(2)) },
  NotFound: {},
}).pipe($I.annoteSchema("Resolution", { description: "Unique, Ambiguous or NotFound." }));

/** Decoded type of {@link Resolution}. */
export type Resolution = typeof Resolution.Type;

/** Why an occurrence could not be carried to another capture. */
export const UnmappedReason = LiteralKit(["outside-map", "quote-not-found", "ambiguous", "split-boundary"]).pipe(
  $I.annoteSchema("UnmappedReason", { description: "Reason a re-anchoring left an occurrence unmapped." })
);

/** Decoded type of {@link UnmappedReason}. */
export type UnmappedReason = typeof UnmappedReason.Type;

/** A recorded re-anchoring of one occurrence between two text captures (lax: it may widen or fail). */
export const Reanchoring = S.TaggedUnion({
  Exact: { from: OccurrenceId, to: OccurrenceId },
  Widened: { from: OccurrenceId, to: OccurrenceId },
  Unmapped: { from: OccurrenceId, reason: UnmappedReason },
}).pipe($I.annoteSchema("Reanchoring", { description: "Exact, Widened or Unmapped." }));

/** Decoded type of {@link Reanchoring}. */
export type Reanchoring = typeof Reanchoring.Type;

/**
 * One anchors-table row: the powerless verification receipt only. Range and
 * quote are read from the receipt's anchor, never stored twice (decision
 * items 4, 6 and 9). Decoding one grants no proof.
 */
export class Anchored extends S.Opaque<Anchored, { readonly brand: unique symbol }>()(
  S.Struct({
    receipt: TextAnchorVerificationReceipt,
  }).pipe($I.annoteSchema("Anchored", { description: "An anchor receipt in the annotation anchors table." }))
) {
  /** The canonical UTF-16 range of the receipt's anchor. */
  static readonly range = (anchored: Anchored): Position =>
    Position.make({
      unit: "utf16-code-unit",
      start: anchored.receipt.anchor.startChar,
      end: anchored.receipt.anchor.endChar,
    });

  /** The exact quote of the receipt's anchor. */
  static readonly quote = (anchored: Anchored): string => anchored.receipt.anchor.quote;

  /** The text capture the receipt names. */
  static readonly source = (anchored: Anchored): SourceTextIdentity => anchored.receipt.source;
}

/** Domain tag of the occurrence preimage. */
export const OccurrenceDomainTag = DomainTag.make("occurrence/v1");

/**
 * The occurrence preimage exactly as decision p0-rq4 states it: (occurrence/v1,
 * scopeRef, sourceRef, locator, sourceDigest, textDigest, extractor name,
 * extractor version, normalizationVersion, unit, start, end, quote).
 */
export const OccurrencePreimage = S.Tuple([
  S.tag("occurrence/v1"),
  S.NonEmptyString,
  S.NonEmptyString,
  PosixPath,
  SourceTextDigest,
  SourceTextDigest,
  S.NonEmptyString,
  S.NonEmptyString,
  S.NonEmptyString,
  OffsetUnit,
  S.Natural,
  S.Natural,
  S.NonEmptyString,
]).pipe($I.annoteSchema("OccurrencePreimage", { description: "Frozen ordered occurrence/v1 preimage tuple." }));

/** Decoded type of {@link OccurrencePreimage}. */
export type OccurrencePreimage = typeof OccurrencePreimage.Type;

/** Build the occurrence preimage of an anchors row; the unit is explicit and is the canonical UTF-16 unit. */
export const occurrencePreimage = (anchored: Anchored): OccurrencePreimage => {
  const { anchor, source } = anchored.receipt;
  return [
    "occurrence/v1",
    source.scopeRef,
    source.sourceRef,
    source.locator,
    source.sourceDigest,
    source.textDigest,
    source.extractor.name,
    source.extractor.version,
    source.normalizationVersion,
    "utf16-code-unit",
    anchor.startChar,
    anchor.endChar,
    anchor.quote,
  ];
};

/** Mint the occurrence id of an anchors row; the anchors-table key check compares against this. */
export const mintOccurrenceId = Effect.fn("Occurrence.mint")(function* (
  anchored: Anchored
): Effect.fn.Return<OccurrenceId, JsoncCanonicalizeError, Digest.Digest> {
  const [, ...fields] = occurrencePreimage(anchored);
  const hash = yield* mintContentHash(OccurrenceDomainTag, fields);
  return OccurrenceId.make(hash);
});

/** Domain tag of the quote-key preimage. */
export const QuoteKeyDomainTag = DomainTag.make("quote-key/v1");

/** Mint the grouping key of a quote already normalized under the named normalization version. */
export const mintQuoteKey = Effect.fn("QuoteKey.mint")(function* (
  normalizationVersion: string,
  normalizedQuote: string
): Effect.fn.Return<QuoteKey, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(QuoteKeyDomainTag, [normalizationVersion, normalizedQuote]);
  return QuoteKey.make(hash);
});

/**
 * Domain tag of the citation mention id (decision p0-rq4): the mention is
 * derived over the occurrence, so two engines or two citation kinds at one
 * occurrence stay two mentions that share one OccurrenceId.
 */
export const CitationMentionDomainTag = DomainTag.make("citation-mention/v2");

/** The citation mention digest; law-practice keeps its display prefix over it. */
export const CitationMentionDigest = ContentHash.pipe(
  S.brand("CitationMentionDigest"),
  $I.annoteSchema("CitationMentionDigest", {
    description: "Hash of (citation-mention/v2, engineArtifact, semanticKind, OccurrenceId).",
  })
);

/** Decoded type of {@link CitationMentionDigest}. */
export type CitationMentionDigest = typeof CitationMentionDigest.Type;

/** The detection fields of a citation mention and the occurrence it reads. */
export class CitationMentionInput extends S.Opaque<CitationMentionInput, { readonly brand: unique symbol }>()(
  S.Struct({
    engineArtifact: Sha256Hex.annotateKey({ description: "Digest of the citation engine artifact." }),
    semanticKind: S.NonEmptyString.check(S.isMaxLength(128)).annotateKey({
      description: "Semantic citation kind discriminant.",
    }),
    occurrence: OccurrenceId,
  }).pipe($I.annoteSchema("CitationMentionInput", { description: "Input of the citation-mention/v2 hash." }))
) {}

/**
 * The citation mention preimage after the domain tag. The detection fields
 * stay outside OccurrenceId. Identifiers sliced from the mention id (the
 * case-occurrence authority id, cl and cg) are re-minted under bumped domain
 * tags, and stored v3 citation document receipts convert on read through a
 * declared read-time transform that recomputes the ids (decision
 * p0-chapter-11-amendment-yields-to-the-stored-format-law).
 */
export const citationMentionPreimage = (input: CitationMentionInput): ReadonlyArray<unknown> => [
  input.engineArtifact,
  input.semanticKind,
  input.occurrence,
];

/** Mint a citation mention digest over its occurrence. */
export const mintCitationMentionDigest = Effect.fn("CitationMention.mint")(function* (
  input: CitationMentionInput
): Effect.fn.Return<CitationMentionDigest, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(CitationMentionDomainTag, citationMentionPreimage(input));
  return CitationMentionDigest.make(hash);
});

/** Why a unit conversion refused: a boundary inside a surrogate pair or multi-byte sequence, or past the text. */
export const UnitConversionRefusal = LiteralKit(["split-boundary", "out-of-range"]).pipe(
  $I.annoteSchema("UnitConversionRefusal", { description: "Reason a position could not be converted." })
);

/** Decoded type of {@link UnitConversionRefusal}. */
export type UnitConversionRefusal = typeof UnitConversionRefusal.Type;

/** Typed refusal of a unit conversion (L1-2 fails closed on a split surrogate). */
export class UnitConversionRefused extends S.TaggedError<UnitConversionRefused, { readonly brand: unique symbol }>(
  $I`UnitConversionRefused`
)(
  "UnitConversionRefused",
  { reason: UnitConversionRefusal, position: Position },
  $I.annoteError<UnitConversionRefused>("UnitConversionRefused", {
    description: "A position whose boundary is not a boundary in the target unit.",
  })
) {}

/** A recorded locator map between two captures of one source, as aligned segments in UTF-16 units. */
export class LocatorMap extends S.Opaque<LocatorMap, { readonly brand: unique symbol }>()(
  S.Struct({
    from: SourceTextIdentity.annotateKey({ description: "Capture the map reads from." }),
    to: SourceTextIdentity.annotateKey({ description: "Capture the map writes to." }),
    segments: S.Array(S.Struct({ from: Position, to: Position })).annotateKey({
      description: "Aligned segments, ordered by from.start; a gap is an unmapped region.",
    }),
  }).pipe($I.annoteSchema("LocatorMap", { description: "Segment alignment between two text captures." }))
) {}

/** Resolve a selector in one text capture (L1-5: a repeated passage is Ambiguous, never the first hit). */
export declare const resolve: {
  (selector: Selector): (sourceText: string) => Resolution;
  (sourceText: string, selector: Selector): Resolution;
};

/**
 * Carry an occurrence across a recorded locator map onto a target capture
 * whose text was verified; lax-functorial, exact and natural on `Exact` (L1-3).
 */
export declare const reanchor: {
  (
    map: LocatorMap,
    target: VerifiedSourceText
  ): (anchored: Anchored) => Effect.Effect<Reanchoring, JsoncCanonicalizeError, Digest.Digest>;
  (
    anchored: Anchored,
    map: LocatorMap,
    target: VerifiedSourceText
  ): Effect.Effect<Reanchoring, JsoncCanonicalizeError, Digest.Digest>;
};

/** Convert a position to another unit over the same text; a bijection on valid boundaries (L1-2). */
export declare const convertPosition: {
  (unit: OffsetUnit, sourceText: string): (position: Position) => Result.Result<Position, UnitConversionRefused>;
  (position: Position, unit: OffsetUnit, sourceText: string): Result.Result<Position, UnitConversionRefused>;
};
