/**
 * Quote keys: a grouping key over a normalized quote, which gathers repeated
 * passages and never identifies one.
 *
 * **Details**
 *
 * A `QuoteKey` is minted under the domain tag `quote-key/v1` over the
 * normalization version and the quote that normalization yields. The key owns
 * its normalization: `mintQuoteKey` normalizes the quote itself, so no key is
 * minted over text the caller normalized some other way. `QuoteNormalization`
 * is a different version from `SourceTextIdentity.normalizationVersion`, which
 * versions the locator normalization of one capture and is part of occurrence
 * identity.
 *
 * The key is not injective: every occurrence of one passage, in any capture,
 * and every spelling that normalizes alike share one key. Identity is the
 * `OccurrenceId`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import { definePreimage } from "@beep/jsonc/Mint";
import { ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { WellFormedText } from "@beep/schema/WellFormedText";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { normalizeText } from "./TextNormalization.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type * as Digest from "effect/crypto/Digest";

const $I = $TextId.create("QuoteKey");

/**
 * The versioned quote normalizations a key can be minted under.
 * `nfkc-dehyphenate/v1` is NFKC, then the removal of in-word hyphen breaks.
 *
 * **Example** (Check a quote normalization)
 *
 * ```ts import.meta.vitest name="Check a quote normalization"
 * import { QuoteNormalization } from "@beep/text/QuoteKey"
 *
 * QuoteNormalization.is["nfkc-dehyphenate/v1"]("nfkc-dehyphenate/v1") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QuoteNormalization = LiteralKit(["nfkc-dehyphenate/v1"]).pipe(
  $I.annoteSchema("QuoteNormalization", {
    description: "Versioned normalization a quote key is minted under; not SourceTextIdentity.normalizationVersion.",
  })
);

/**
 * Type for {@link QuoteNormalization}.
 *
 * **Example** (Annotate a quote normalization)
 *
 * ```ts
 * import type { QuoteNormalization } from "@beep/text/QuoteKey"
 *
 * const normalization: QuoteNormalization = "nfkc-dehyphenate/v1"
 * console.log(normalization)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QuoteNormalization = typeof QuoteNormalization.Type;

/**
 * Grouping key of a normalized quote, encoded `sha256:<64 hex>`. Not
 * injective: it groups repeated passages and never identifies an occurrence.
 *
 * **Example** (Check a quote key)
 *
 * ```ts import.meta.vitest name="Check a quote key"
 * import { QuoteKey } from "@beep/text/QuoteKey"
 * import * as S from "effect/Schema"
 *
 * S.is(QuoteKey)("sha256:4d35c407eaeb249dd409c6f6e33515178a35b09ce1bfc6f088dfdf459c69c7ab") // => true
 * S.is(QuoteKey)("4d35c407eaeb249dd409c6f6e33515178a35b09ce1bfc6f088dfdf459c69c7ab") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const QuoteKey = ContentHash.pipe(
  S.brand("QuoteKey"),
  $I.annoteSchema("QuoteKey", {
    description: "Content hash of a normalized quote, used to group repeated passages, never to identify one.",
  })
);

/**
 * Type for {@link QuoteKey}.
 *
 * **Example** (Annotate a quote key)
 *
 * ```ts
 * import { QuoteKey } from "@beep/text/QuoteKey"
 *
 * const key: QuoteKey = QuoteKey.make("sha256:4d35c407eaeb249dd409c6f6e33515178a35b09ce1bfc6f088dfdf459c69c7ab")
 * console.log(key)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type QuoteKey = typeof QuoteKey.Type;

/**
 * The `quote-key/v1` preimage: the quote normalization and the normalized
 * quote, with its committed golden vector.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the quote-key domain tag"
 * import { QuoteKeyPreimage } from "@beep/text/QuoteKey"
 *
 * QuoteKeyPreimage.domainTag // => "quote-key/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QuoteKeyPreimage = definePreimage({
  domainTag: DomainTag.make("quote-key/v1"),
  schema: S.Tuple([QuoteNormalization, WellFormedText]),
  golden: {
    preimage: ["nfkc-dehyphenate/v1", "1 U.S. 1"],
    hash: ContentHash.make("sha256:4d35c407eaeb249dd409c6f6e33515178a35b09ce1bfc6f088dfdf459c69c7ab"),
  },
});

/**
 * Normalize a quote under a quote normalization, text only.
 * `nfkc-dehyphenate/v1` is `dehyphenate` after `nfkc`.
 *
 * **Example** (Normalize a broken ligature word)
 *
 * ```ts import.meta.vitest name="Normalize a broken ligature word"
 * import { normalizeQuote } from "@beep/text/QuoteKey"
 *
 * normalizeQuote("ﬁ-\nnal", "nfkc-dehyphenate/v1") // => "final"
 * normalizeQuote("nfkc-dehyphenate/v1")("①") // => "1"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeQuote: {
  (normalization: QuoteNormalization): (quote: string) => string;
  (quote: string, normalization: QuoteNormalization): string;
} = dual(2, (quote: string, normalization: QuoteNormalization): string =>
  QuoteNormalization.match(normalization, {
    "nfkc-dehyphenate/v1": () => normalizeText(normalizeText(quote, "nfkc").text, "dehyphenate").text,
  })
);

/**
 * Mint the quote key of a quote: normalize it, then hash the normalization
 * and the normalized quote under `quote-key/v1`.
 *
 * **Details**
 *
 * Requires core's `Digest.Digest` service. A quote with a lone surrogate
 * fails with the schema error of {@link PreimageMintError}.
 *
 * **Example** (Mint the golden quote key)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { mintQuoteKey } from "@beep/text/QuoteKey"
 *
 * const program = mintQuoteKey("1 U.S. 1", "nfkc-dehyphenate/v1").pipe(Effect.provide(Digest.layerWebCrypto))
 *
 * Effect.runPromise(program).then(console.log)
 * // "sha256:4d35c407eaeb249dd409c6f6e33515178a35b09ce1bfc6f088dfdf459c69c7ab"
 * ```
 *
 * @param quote - The quote as it occurs in its text.
 * @param normalization - The quote normalization to mint under.
 * @returns The quote key.
 * @category constructors
 * @since 0.0.0
 */
export const mintQuoteKey = Effect.fn("QuoteKey.mint")(function* (
  quote: string,
  normalization: QuoteNormalization
): Effect.fn.Return<QuoteKey, PreimageMintError, Digest.Digest> {
  const hash = yield* QuoteKeyPreimage.mint([normalization, normalizeQuote(quote, normalization)]);
  return QuoteKey.make(hash);
});
