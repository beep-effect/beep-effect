/**
 * Capture identity: the one identifier of a text capture, scope included.
 *
 * **Details**
 *
 * A `CaptureId` is minted under the domain tag `capture/v1` over the whole
 * {@link SourceTextIdentity}: scope, source, locator, source and text digests,
 * extractor name and version, and normalization version, in the order of the
 * first eight elements of `occurrence/v1`. The text digest alone is
 * scope-free, so two matters holding the same bytes share it; their captures
 * have two ids. An extraction activity names the capture it read by this id.
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
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity, SourceTextLocator } from "./SourceTextIdentity.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type * as Digest from "effect/crypto/Digest";

const $I = $TextId.create("Capture");

/**
 * The only capture identity: the content hash of the `capture/v1` preimage,
 * encoded `sha256:<64 hex>`.
 *
 * **Example** (Check a capture id)
 *
 * ```ts import.meta.vitest name="Check a capture id"
 * import { CaptureId } from "@beep/text/Capture"
 * import * as S from "effect/Schema"
 *
 * S.is(CaptureId)("sha256:c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6") // => true
 * S.is(CaptureId)("c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CaptureId = ContentHash.pipe(
  S.brand("CaptureId"),
  $I.annoteSchema("CaptureId", {
    description: "Content hash of the whole text capture identity, its scope included.",
  })
);

/**
 * Type for {@link CaptureId}.
 *
 * **Example** (Annotate a capture id)
 *
 * ```ts
 * import { CaptureId } from "@beep/text/Capture"
 *
 * const id: CaptureId = CaptureId.make(
 *   "sha256:c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6"
 * )
 * console.log(id)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type CaptureId = typeof CaptureId.Type;

// decision: capture-preimage-elements
const CaptureElements = S.Tuple([
  WellFormedText,
  WellFormedText,
  SourceTextLocator,
  SourceTextDigest,
  SourceTextDigest,
  WellFormedText,
  WellFormedText,
  WellFormedText,
]);

// decision: capture-preimage-elements
const CaptureSchema = CaptureElements.pipe(
  S.decodeTo(S.toType(SourceTextIdentity), {
    decode: SchemaGetter.transform(
      ([scopeRef, sourceRef, locator, sourceDigest, textDigest, name, version, normalizationVersion]) =>
        SourceTextIdentity.make({
          scopeRef,
          sourceRef,
          locator,
          sourceDigest,
          textDigest,
          extractor: SourceTextExtractor.make({ name, version }),
          normalizationVersion,
        })
    ),
    encode: SchemaGetter.transform(
      (source) =>
        [
          source.scopeRef,
          source.sourceRef,
          source.locator,
          source.sourceDigest,
          source.textDigest,
          source.extractor.name,
          source.extractor.version,
          source.normalizationVersion,
        ] as const
    ),
  })
);

/**
 * The `capture/v1` preimage over a {@link SourceTextIdentity}, with its
 * committed golden vector: scope, source, locator, source and text digests,
 * extractor name and version, and normalization version.
 *
 * **Details**
 *
 * `CapturePreimage.mintResult(digest)` mints through a caller-supplied
 * synchronous SHA-256, for property generators that build dependent values.
 * The golden is the first eight elements of the `occurrence/v1` golden.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the capture domain tag"
 * import { CapturePreimage } from "@beep/text/Capture"
 *
 * CapturePreimage.domainTag // => "capture/v1"
 * CapturePreimage.golden.preimage.length // => 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CapturePreimage = definePreimage({
  domainTag: DomainTag.make("capture/v1"),
  schema: CaptureSchema,
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
    ],
    hash: ContentHash.make("sha256:c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6"),
  },
});

/**
 * Mint the capture id of a source text identity.
 *
 * **Details**
 *
 * Requires core's `Digest.Digest` service. The id is a function of the
 * identity's fields; minting proves nothing about the text. Equal text bytes
 * under two scopes are two captures with two ids.
 *
 * **Example** (Mint the id of a capture)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { mintCaptureId } from "@beep/text/Capture"
 * import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 *
 * const idOf = (source: SourceTextIdentity) => mintCaptureId(source).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof idOf)
 * ```
 *
 * @param source - The capture's source text identity.
 * @returns The capture id.
 * @category constructors
 * @since 0.0.0
 */
export const mintCaptureId = Effect.fn("Capture.mint")(function* (
  source: SourceTextIdentity
): Effect.fn.Return<CaptureId, PreimageMintError, Digest.Digest> {
  const hash = yield* CapturePreimage.mint(source);
  return CaptureId.make(hash);
});
