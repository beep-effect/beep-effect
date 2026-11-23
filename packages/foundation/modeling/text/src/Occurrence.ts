/**
 * Occurrence identity: the one identifier of a passage at one place in one
 * text capture.
 *
 * **Details**
 *
 * An `OccurrenceId` is minted under the domain tag `occurrence/v1` over the
 * whole capture identity, the canonical UTF-16 range and the exact quote, so
 * the same boilerplate repeated three times in one text is three occurrences.
 * It is minted from `Anchored`, a powerless receipt: the id is a function of
 * the receipt's fields, not a claim of proof, and decoding an `Anchored`
 * grants nothing a `VerifiedTextAnchor` grants.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import { definePreimage } from "@beep/jsonc/Mint";
import { ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { WellFormedText } from "@beep/schema/WellFormedText";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { Position } from "./OffsetUnit.ts";
import { SourceTextDigest, SourceTextLocator } from "./SourceTextIdentity.ts";
import { TextAnchorVerificationReceipt } from "./VerifiedTextAnchor.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type * as Digest from "effect/crypto/Digest";
import type { SourceTextIdentity } from "./SourceTextIdentity.ts";

const $I = $TextId.create("Occurrence");

/**
 * Why minting an occurrence id failed: the anchored value did not encode
 * through the preimage schema (a quote with a lone surrogate), or the encoded
 * preimage is not plain JSON. Re-exported from `@beep/jsonc/Mint`.
 *
 * @category errors
 * @since 0.0.0
 */
export type { PreimageMintError } from "@beep/jsonc/Mint";

/**
 * An anchors-table row: the verification receipt of one anchor, and nothing
 * else. Range and quote are read from the receipt's anchor, never stored
 * twice. Decoding one grants no proof.
 *
 * **Example** (Read the range and quote)
 *
 * ```ts import.meta.vitest name="Read the range and quote"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Anchored } from "@beep/text/Occurrence"
 * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 * import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor"
 *
 * const digest = SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const anchored = Anchored.make({
 *   receipt: TextAnchorVerificationReceipt.make({
 *     anchor: TextAnchor.make({ startChar: 6, endChar: 10, quote: "fact" }),
 *     source: SourceTextIdentity.make({
 *       scopeRef: "memory",
 *       sourceRef: "notes",
 *       locator: PosixPath.make("notes/decisions.md"),
 *       sourceDigest: digest,
 *       textDigest: digest,
 *       extractor: SourceTextExtractor.make({ name: "markdown", version: "1" }),
 *       normalizationVersion: "1",
 *     }),
 *   }),
 * })
 * Anchored.quote(anchored) // => "fact"
 * Anchored.range(anchored).end // => 10
 * Anchored.source(anchored).scopeRef // => "memory"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Anchored extends S.Opaque<Anchored, { readonly brand: unique symbol }>()(
  S.Struct({
    receipt: TextAnchorVerificationReceipt.annotateKey({
      description: "The receipt of the verification that produced the anchor.",
    }),
  }).pipe(
    $I.annoteSchema("Anchored", {
      description: "An anchor receipt as the anchors table stores it; decoding one grants no proof.",
    })
  )
) {
  /**
   * The canonical `utf16-code-unit` range of the receipt's anchor.
   *
   * **Example** (Read the range)
   *
   * ```ts
   * import type { Anchored } from "@beep/text/Occurrence"
   * import { Anchored as AnchoredSchema } from "@beep/text/Occurrence"
   *
   * const rangeOf = (anchored: Anchored) => AnchoredSchema.range(anchored)
   * console.log(typeof rangeOf)
   * ```
   *
   * @param anchored - The anchors-table row.
   * @returns The range as a `Position`.
   */
  static readonly range = (anchored: Anchored): Position =>
    Position.make({
      unit: "utf16-code-unit",
      start: anchored.receipt.anchor.startChar,
      end: anchored.receipt.anchor.endChar,
    });

  /**
   * The exact quote of the receipt's anchor.
   *
   * **Example** (Read the quote)
   *
   * ```ts
   * import type { Anchored } from "@beep/text/Occurrence"
   * import { Anchored as AnchoredSchema } from "@beep/text/Occurrence"
   *
   * const quoteOf = (anchored: Anchored): string => AnchoredSchema.quote(anchored)
   * console.log(typeof quoteOf)
   * ```
   *
   * @param anchored - The anchors-table row.
   * @returns The quoted text.
   */
  static readonly quote = (anchored: Anchored): string => anchored.receipt.anchor.quote;

  /**
   * The text capture the receipt names.
   *
   * **Example** (Read the capture)
   *
   * ```ts
   * import type { Anchored } from "@beep/text/Occurrence"
   * import { Anchored as AnchoredSchema } from "@beep/text/Occurrence"
   *
   * const scopeOf = (anchored: Anchored): string => AnchoredSchema.source(anchored).scopeRef
   * console.log(typeof scopeOf)
   * ```
   *
   * @param anchored - The anchors-table row.
   * @returns The source text identity.
   */
  static readonly source = (anchored: Anchored): SourceTextIdentity => anchored.receipt.source;
}

/**
 * The only occurrence identity: the content hash of the `occurrence/v1`
 * preimage, encoded `sha256:<64 hex>`.
 *
 * **Example** (Check an occurrence id)
 *
 * ```ts import.meta.vitest name="Check an occurrence id"
 * import { OccurrenceId } from "@beep/text/Occurrence"
 * import * as S from "effect/Schema"
 *
 * S.is(OccurrenceId)("sha256:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d") // => true
 * S.is(OccurrenceId)("cm1:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const OccurrenceId = ContentHash.pipe(
  S.brand("OccurrenceId"),
  $I.annoteSchema("OccurrenceId", {
    description: "Content hash of the whole text capture identity, the UTF-16 range and the exact quote.",
  })
);

/**
 * Type for {@link OccurrenceId}.
 *
 * **Example** (Annotate an occurrence id)
 *
 * ```ts
 * import { OccurrenceId } from "@beep/text/Occurrence"
 *
 * const id: OccurrenceId = OccurrenceId.make(
 *   "sha256:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d"
 * )
 * console.log(id)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type OccurrenceId = typeof OccurrenceId.Type;

// decision: occurrence-preimage-elements
const OccurrenceElements = S.Tuple([
  WellFormedText,
  WellFormedText,
  SourceTextLocator,
  SourceTextDigest,
  SourceTextDigest,
  WellFormedText,
  WellFormedText,
  WellFormedText,
  S.Literal("utf16-code-unit"),
  S.Natural,
  S.Natural,
  WellFormedText,
]);

const decodeAnchored = S.decodeUnknownEffect(Anchored);

// decision: occurrence-preimage-elements
const OccurrenceSchema = OccurrenceElements.pipe(
  S.decodeTo(S.toType(Anchored), {
    decode: SchemaGetter.transformEffect(
      ([
        scopeRef,
        sourceRef,
        locator,
        sourceDigest,
        textDigest,
        name,
        version,
        normalizationVersion,
        ,
        start,
        end,
        quote,
      ]) =>
        decodeAnchored({
          receipt: {
            anchor: { startChar: start, endChar: end, quote },
            source: {
              scopeRef,
              sourceRef,
              locator,
              sourceDigest,
              textDigest,
              extractor: { name, version },
              normalizationVersion,
            },
          },
        }).pipe(Effect.mapError((error) => error.issue))
    ),
    encode: SchemaGetter.transform(
      ({ receipt: { anchor, source } }) =>
        [
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
        ] as const
    ),
  })
);

/**
 * The `occurrence/v1` preimage over an {@link Anchored} row, with its
 * committed golden vector: scope, source, locator, source and text digests,
 * extractor name and version, normalization version, the literal unit
 * `utf16-code-unit`, start, end and quote.
 *
 * **Details**
 *
 * `OccurrencePreimage.mintResult(digest)` mints through a caller-supplied
 * synchronous SHA-256, for property generators that build dependent values.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the occurrence domain tag"
 * import { OccurrencePreimage } from "@beep/text/Occurrence"
 *
 * OccurrencePreimage.domainTag // => "occurrence/v1"
 * OccurrencePreimage.golden.preimage.length // => 12
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OccurrencePreimage = definePreimage({
  domainTag: DomainTag.make("occurrence/v1"),
  schema: OccurrenceSchema,
  golden: {
    preimage: [
      "matter:example",
      "source:example",
      "documents/source.txt",
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "sha256:8de1c1a5a8abb0bdb1fc6c7b77a78338e87ab823115cb2dad18003f268e5515f",
      "utf8",
      "1",
      "1",
      "utf16-code-unit",
      3,
      11,
      "1 U.S. 1",
    ],
    hash: ContentHash.make("sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48"),
  },
});

/**
 * Mint the occurrence id of an anchors row.
 *
 * **Details**
 *
 * Requires core's `Digest.Digest` service. The id is a function of the
 * receipt's fields; minting proves nothing about the text. A quote with a
 * lone surrogate, which `TextAnchor` admits, fails with the schema error of
 * {@link PreimageMintError}.
 *
 * **Example** (Mint the id of an anchors row)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import type { Anchored } from "@beep/text/Occurrence"
 * import { mintOccurrenceId } from "@beep/text/Occurrence"
 *
 * const idOf = (anchored: Anchored) => mintOccurrenceId(anchored).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof idOf)
 * ```
 *
 * @param anchored - The anchors-table row.
 * @returns The occurrence id.
 * @category constructors
 * @since 0.0.0
 */
export const mintOccurrenceId = Effect.fn("Occurrence.mint")(function* (
  anchored: Anchored
): Effect.fn.Return<OccurrenceId, PreimageMintError, Digest.Digest> {
  const hash = yield* OccurrencePreimage.mint(anchored);
  return OccurrenceId.make(hash);
});
