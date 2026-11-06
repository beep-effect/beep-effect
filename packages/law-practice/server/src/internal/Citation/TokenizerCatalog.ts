/** Canonical eyecite 2.7.6 metadata preparation (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationExtractorOrderingBinding } from "./ExtractorOrdering.ts";
import { CitationExtractorRecipe } from "./ExtractorRecipes.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTokenizerConfiguration, CitationTokenizerEdition, CitationTokenizerExtractor } from "./Tokenizer.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenizerCatalog");
const expected = "8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c";
const Payload = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16));
const Source = S.fromJsonString(
  S.Array(
    S.Struct({
      pythonType: S.tag("eyecite.models.TokenExtractor"),
      fields: S.Struct({
        regex: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.patternUtf16)),
        flags: CitationExtractorOrderingBinding.fields.flags,
        strings: S.Array(S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.patternUtf16))).check(
          S.isMaxLength(CitationEngineAbsoluteMaxima.patterns)
        ),
      }),
    })
  ).check(S.isBetweenLength(6805, 6805))
).pipe(
  $I.annoteSchema("Source", {
    description:
      "Exact default extractor artifact fields; bound classes and edition occurrences come from independent source metadata.",
  })
);
/** Trusted source facts, including explicit runtime edition hash parameters.
 * Artifact authentication of these facts belongs to the installing server owner;
 * these decoded values never constitute raw-request execution authority.
 * @internal @category models @since 0.0.0
 */
export class CitationCanonicalTokenizerMetadata extends S.Opaque<
  CitationCanonicalTokenizerMetadata,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    recipes: S.Array(CitationExtractorRecipe).check(S.isBetweenLength(6805, 6805)),
    hashes: S.Array(S.Tuple([S.BigInt, S.Natural])).check(S.isBetweenLength(6805, 6805)),
    descriptors: S.Array(CitationRegexPatternDescriptor).check(S.isMaxLength(6805)),
    editions: S.Array(CitationTokenizerEdition).check(S.isBetweenLength(2533, 2533)),
  }).pipe(
    $I.annoteSchema("CitationCanonicalTokenizerMetadata", {
      description: "Independent default class/order/compiler metadata and parameterized source edition hashes.",
    })
  )
) {}
const Metadata = S.toType(CitationCanonicalTokenizerMetadata);
const Reason = LiteralKit(["invalid-input", "artifact-mismatch", "metadata-mismatch"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed canonical installation failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationTokenizerCatalogFailure extends S.TaggedError<
  CitationTokenizerCatalogFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenizerCatalogFailure`)(
  "CitationTokenizerCatalogFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenizerCatalogFailure>("CitationTokenizerCatalogFailure", {
    description: "Catalog preparation failed without raw source, regexes or causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationTokenizerCatalogFailure.make({ reason });
const preserve = (error: unknown) => (S.is(CitationSafetyLimitExceeded)(error) ? error : fail("metadata-mismatch"));
const key = (sha: string, flags: number) => `${flags}:${sha}`;

/** Prepare the complete default catalog from its authenticated source artifact.
 * Every regex is re-encoded as canonical native words and fingerprinted before
 * its captured descriptor can be attached. This supplies metadata, not family
 * qualification, fresh-process hash production or an executable worker grant.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCanonicalTokenizerCatalog = Effect.fn("Citation.makeCanonicalTokenizerCatalog")(function* (
  policy: unknown,
  payloadInput: unknown,
  metadataInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-input"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const digest = yield* Digest.Digest;
  const prepare = Effect.gen(function* () {
    const payload = yield* S.decodeUnknownEffect(Payload)(payloadInput).pipe(
      Effect.mapError(() => fail("invalid-input"))
    );
    const hash = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(payload));
    if (hash !== expected) return yield* fail("artifact-mismatch");
    const source = yield* S.decodeEffect(Source)(payload).pipe(Effect.mapError(() => fail("artifact-mismatch")));
    const metadata = yield* S.decodeUnknownEffect(Metadata)(metadataInput).pipe(
      Effect.mapError(() => fail("metadata-mismatch"))
    );
    if (source.length > limits.patterns)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patterns" });
    const descriptors = HashMap.fromIterable(
      A.map(metadata.descriptors, (row) => Tuple.make(key(row.patternSha256, row.flags), row))
    );
    if (HashMap.size(descriptors) !== metadata.descriptors.length) return yield* fail("metadata-mismatch");
    const unicode = yield* makeCitationPythonUnicode(limits);
    const patterns = yield* makeCitationRegexInput(limits, "pattern");
    const extractors = yield* Effect.forEach(
      source,
      Effect.fn("Citation.prepareCanonicalExtractor")(function* (row, index) {
        // Source and decoded metadata arrays each contain exactly 6805 entries.
        const recipe = A.getUnsafe(metadata.recipes, index);
        const [hash, equalityClass] = A.getUnsafe(metadata.hashes, index);
        if (recipe.id !== index || recipe.flags !== row.fields.flags) return yield* fail("metadata-mismatch");
        const prepared = yield* patterns
          .prepareText(row.fields.regex, () => Effect.void)
          .pipe(Effect.mapError(preserve));
        const pattern = prepared.value.storage;
        const fingerprint = yield* digest.digestHex(
          Digest.sha256,
          Bytes.concat([new Uint8Array([pattern.width]), pattern.bytes])
        );
        if (fingerprint !== recipe.patternSha256) return yield* fail("metadata-mismatch");
        const descriptor = yield* Effect.fromOption(HashMap.get(descriptors, key(fingerprint, row.fields.flags))).pipe(
          Effect.mapError(() => fail("metadata-mismatch"))
        );
        const strings = yield* Effect.forEach(
          row.fields.strings,
          (text) =>
            unicode.fromText(text).pipe(Effect.mapBoth({ onSuccess: (value) => value.storage, onFailure: preserve })),
          { concurrency: 1 }
        );
        return CitationTokenizerExtractor.make({
          pattern,
          recipe,
          descriptor,
          ordering: CitationExtractorOrderingBinding.make({
            id: index,
            flags: row.fields.flags,
            strings,
            hash,
            equalityClass,
          }),
        });
      }),
      { concurrency: 1 }
    );
    return CitationTokenizerConfiguration.make({ extractors, editions: metadata.editions });
  });
  return yield* timing.timed(prepare);
});
