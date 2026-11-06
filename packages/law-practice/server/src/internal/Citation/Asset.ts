/** Shared bounded production asset reads through Effect FileSystem and Stream.
 * Asset-specific schemas and digest authentication remain with their owners.
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

/** Read at most the trusted sealed length plus one byte. Check length before
 * concatenation; extra/truncated input cannot become a successful asset.
 * Callers translate errors without retaining source-bearing filesystem causes.
 * @internal @category operations @since 0.0.0
 */
export const readCitationAssetBytes = Effect.fn("Citation.readAssetBytes")(function* <E, F>(
  path: string,
  byteLength: number,
  unavailable: () => E,
  mismatch: () => F
) {
  const fs = yield* FileSystem.FileSystem;
  const chunks = yield* fs
    .stream(path, { bytesToRead: byteLength + 1, chunkSize: 65536 })
    .pipe(Stream.runCollect, Effect.mapError(unavailable));
  if (A.reduce(chunks, 0, (count, bytes) => count + bytes.byteLength) !== byteLength)
    return yield* Effect.fail(mismatch());
  return Bytes.concat(chunks);
});

const $I = $LawPracticeServerId.create("internal/Citation/Asset");
/** @internal @category models @since 0.0.0 */
export const CitationAssetFailureReason = LiteralKit(["unavailable", "artifact-mismatch", "invalid-data"]).pipe(
  $I.annoteSchema("CitationAssetFailureReason", {
    description: "Closed asset boundary failures without source values.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationAssetFailureReason = typeof CitationAssetFailureReason.Type;
/** Trusted adapter's pinned asset length and digest.
 * @internal @category models @since 0.0.0
 */
export class CitationAssetSeal extends S.Opaque<CitationAssetSeal, { readonly brand: unique symbol }>()(
  S.Struct({ byteLength: S.Natural, sha256: Sha256Hex }).pipe(
    $I.annoteSchema("CitationAssetSeal", { description: "Trusted static identity for a bounded production asset." })
  )
) {}
const Path = S.NonEmptyString.check(S.isMaxLength(4096));
/** Authenticate bounded UTF-8 asset bytes before decoding text.
 * Source-specific schemas and closed errors remain with callers.
 * @internal @category operations @since 0.0.0
 */
export const loadCitationTextAsset = Effect.fn("Citation.loadTextAsset")(function* <E>(
  input: unknown,
  seal: CitationAssetSeal,
  failed: (reason: CitationAssetFailureReason) => E
) {
  const path = yield* S.decodeUnknownEffect(Path)(input).pipe(Effect.mapError(() => failed("unavailable")));
  const bytes = yield* readCitationAssetBytes(
    path,
    seal.byteLength,
    () => failed("unavailable"),
    () => failed("artifact-mismatch")
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes).pipe(
    Effect.mapError(() => failed("artifact-mismatch")),
    Effect.catchDefect(() => Effect.fail(failed("artifact-mismatch")))
  );
  if (hash !== seal.sha256) return yield* Effect.fail(failed("artifact-mismatch"));
  return new TextDecoder().decode(bytes);
});

/** Decode authenticated text through the supplied upstream schema codec.
 * @internal @category operations @since 0.0.0
 */
export const loadCitationJsonAsset = Effect.fn("Citation.loadJsonAsset")(function* <A, E>(
  input: unknown,
  seal: CitationAssetSeal,
  codec: S.Codec<A, string>,
  failed: (reason: CitationAssetFailureReason) => E
) {
  const text = yield* loadCitationTextAsset(input, seal, failed);
  return yield* S.decodeEffect(codec)(text).pipe(Effect.mapError(() => failed("invalid-data")));
});
