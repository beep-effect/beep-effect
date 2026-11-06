/** Authenticated production installation data from pinned eyecite 2.7.6.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { CitationFrozenEditionBundle, makeCitationFrozenEditions } from "./FrozenEditions.ts";
import { CitationCanonicalTokenizerMetadata, makeCitationCanonicalTokenizerCatalog } from "./TokenizerCatalog.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ParserCatalog");
const expectedBytes = 10337697;
const expectedSha256 = "9d6b0866a5f9857b5e64277c12e123f2b0047e6d34dc52ea89e1160c486f6cd6";
const Reason = LiteralKit(["unavailable", "artifact-mismatch", "invalid-data"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed production catalog I/O, seal and schema failures without payloads or paths.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationParserCatalogFailure extends S.TaggedError<
  CitationParserCatalogFailure,
  { readonly brand: unique symbol }
>($I`CitationParserCatalogFailure`)(
  "CitationParserCatalogFailure",
  { reason: Reason },
  $I.annoteError<CitationParserCatalogFailure>("CitationParserCatalogFailure", {
    description: "Catalog installation failed without regex data, filesystem paths or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationParserCatalogFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationParserCatalogAsset extends S.Opaque<
  CitationParserCatalogAsset,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-parser-catalog/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    hashSeed: S.tag("0"),
    hashProfile: S.tag("captured-source-runtime"),
    producerSha256: Sha256Hex,
    inputs: S.Record(S.String, Sha256Hex),
    payload: S.String.check(S.isMaxLength(8 * 1024 * 1024)),
    metadata: CitationCanonicalTokenizerMetadata,
    frozen: CitationFrozenEditionBundle,
  }).pipe(
    $I.annoteSchema("CitationParserCatalogAsset", {
      description:
        "Complete source-sealed canonical catalog and frozen publications, retaining the captured hash profile explicitly.",
    })
  )
) {}
const Json = CitationParserCatalogAsset.pipe(S.toCodecJson, S.fromJsonString);
const Path = S.NonEmptyString.check(S.isMaxLength(4096));
/** Read at most the sealed size plus one byte through Effect FileSystem.stream.
 * Size/hash checks precede JSON decoding. Trailing bytes, truncation and changed
 * content refuse; no partial/truncated catalog can become installation data.
 * @internal @category operations @since 0.0.0
 */
export const loadCitationParserCatalog = Effect.fn("Citation.loadParserCatalog")(function* (input: unknown) {
  const path = yield* S.decodeUnknownEffect(Path)(input).pipe(Effect.mapError(() => fail("unavailable")));
  const fs = yield* FileSystem.FileSystem;
  const chunks = yield* fs.stream(path, { bytesToRead: expectedBytes + 1, chunkSize: 65536 }).pipe(
    Stream.runCollect,
    Effect.mapError(() => fail("unavailable"))
  );
  const bytes = Bytes.concat(A.fromIterable(chunks));
  if (bytes.length !== expectedBytes) return yield* fail("artifact-mismatch");
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes).pipe(
    Effect.mapError(() => fail("artifact-mismatch")),
    Effect.catchDefect(() => Effect.fail(fail("artifact-mismatch")))
  );
  if (hash !== expectedSha256) return yield* fail("artifact-mismatch");
  return yield* S.decodeEffect(Json)(new TextDecoder().decode(bytes)).pipe(Effect.mapError(() => fail("invalid-data")));
});
/** Install complete frozen publications and the default 6,805-extractor catalog
 * through their existing authenticating owners. This supplies source facts;
 * regex execution grants, runtime hash profiles beyond the capture, helper
 * metadata and the final engine artifact remain separate Layer duties.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationParserCatalog = Effect.fn("Citation.makeParserCatalog")(function* (
  policy: unknown,
  path: unknown
) {
  const asset = yield* loadCitationParserCatalog(path);
  const editions = yield* makeCitationFrozenEditions(asset.frozen);
  const tokenizer = yield* makeCitationCanonicalTokenizerCatalog(policy, asset.payload, asset.metadata);
  return { editions, tokenizer, artifact: Sha256Hex.make(expectedSha256) };
});
