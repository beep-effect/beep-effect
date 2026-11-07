/**
 * Evidence contracts for the Box route and the VidBee and alphaXiv import methods.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { LibraryBoxFileMetadata, libraryBoxFileId, libraryBoxRevision, libraryBoxSha1 } from "./Library.box.ts";
import type { LibraryArtifact, LibraryCapture, LibrarySource } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.routeEvidence");

/**
 * Hash binding between a VidBee transcript, its FAQ interpretation and the referenced media file.
 *
 * **Example** (Inspect binding fields)
 *
 * ```ts
 * import { LibraryVidbeeBinding } from "@beep/repo-cli/commands/Research"
 *
 * console.log(Object.keys(LibraryVidbeeBinding.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryVidbeeBinding extends S.Opaque<LibraryVidbeeBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceUrl: S.String,
    mediaPath: S.String,
    mediaSha256: S.String,
    mediaBytes: S.Finite,
    transcriptSha256: S.String,
    faqSha256: S.String,
    model: S.String,
    effort: S.String,
    generatedAt: S.String,
  }).pipe(
    $I.annoteSchema("LibraryVidbeeBinding", {
      description: "Media file path and SHA-256 that a VidBee transcript and FAQ were generated from.",
    })
  )
) {}

/**
 * Binding of alphaXiv full text to one arXiv identifier and version.
 *
 * **Example** (Inspect binding fields)
 *
 * ```ts
 * import { LibraryAlphaxivBinding } from "@beep/repo-cli/commands/Research"
 *
 * console.log(Object.keys(LibraryAlphaxivBinding.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryAlphaxivBinding extends S.Opaque<LibraryAlphaxivBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    canonicalUrl: S.String,
    arxivId: S.String,
    version: S.String,
    fullTextSha256: S.String,
    references: S.Finite,
  }).pipe(
    $I.annoteSchema("LibraryAlphaxivBinding", {
      description: "arXiv identifier and version that alphaXiv full text was retrieved for.",
    })
  )
) {}

const readJson = Effect.fnUntraced(function* <A, I>(
  root: string,
  artifacts: ReadonlyArray<LibraryArtifact>,
  role: string,
  schema: S.Codec<A, I>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const artifact = A.findFirst(artifacts, (item) => item.role === role);
  if (O.isNone(artifact)) return O.none<A>();
  return yield* fs
    .readFileString(path.resolve(root, artifact.value.path))
    .pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(schema))), Effect.option);
});

const bound = (artifacts: ReadonlyArray<LibraryArtifact>, role: string, sha256: string) =>
  A.some(artifacts, (artifact) => artifact.role === role && artifact.sha256 === sha256 && artifact.bytes > 0);

/**
 * Whether a source is a Box file and its captured revision names that file.
 *
 * **Example** (Check a Box captured revision)
 *
 * ```ts
 * import { libraryBoxRevisionValid } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(typeof libraryBoxRevisionValid)
 * ```
 *
 * @internal
 * @param source - Source under verification.
 * @param capture - Capture under verification.
 * @returns Some validity for Box sources, none for every other source.
 * @category utilities
 * @since 0.0.0
 */
export const libraryBoxRevisionValid: {
  (capture: LibraryCapture): (source: LibrarySource) => O.Option<boolean>;
  (source: LibrarySource, capture: LibraryCapture): O.Option<boolean>;
} = dual(
  2,
  (source: LibrarySource, capture: LibraryCapture): O.Option<boolean> =>
    O.map(
      libraryBoxFileId(source.canonicalUrl),
      (fileId) => capture.capturedRevision === libraryBoxRevision(fileId, capture.requestedRevision)
    )
);

/**
 * Revalidate a Box capture: metadata, the retained bytes' SHA-256 and SHA-1, and the captured revision.
 *
 * **Example** (Reference the Box validator)
 *
 * ```ts
 * import { validateLibraryBoxEvidence } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(typeof validateLibraryBoxEvidence)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const validateLibraryBoxEvidence = Effect.fn("Library.validateBoxEvidence")(function* (
  root: string,
  source: LibrarySource,
  capture: LibraryCapture
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const metadata = yield* readJson(root, capture.artifacts, "box-file-metadata", LibraryBoxFileMetadata);
  const fileId = libraryBoxFileId(source.canonicalUrl);
  if (O.isNone(metadata) || O.isNone(fileId) || metadata.value.fileId !== fileId.value) return false;
  if (capture.capturedRevision !== libraryBoxRevision(metadata.value.fileId, metadata.value.versionId)) return false;
  const original = A.findFirst(
    capture.artifacts,
    (artifact) => artifact.role === "raw-full-text" && artifact.sha256 === metadata.value.sha256
  );
  if (O.isNone(original)) return false;
  const bytes = yield* fs.readFile(path.resolve(root, original.value.path)).pipe(Effect.option);
  if (O.isNone(bytes)) return false;
  const sha1 = yield* libraryBoxSha1(bytes.value).pipe(Effect.orElseSucceed(() => ""));
  return sha1 === metadata.value.boxSha1 && sha1 === metadata.value.sha1 && bytes.value.byteLength > 0;
});

/**
 * Revalidate a VidBee import: the transcript and FAQ are bound to the recorded media hash.
 *
 * **Example** (Reference the VidBee validator)
 *
 * ```ts
 * import { validateLibraryVidbeeEvidence } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(typeof validateLibraryVidbeeEvidence)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const validateLibraryVidbeeEvidence = Effect.fn("Library.validateVidbeeEvidence")(function* (
  root: string,
  url: string,
  capture: LibraryCapture
) {
  const binding = yield* readJson(root, capture.artifacts, "media-binding", LibraryVidbeeBinding);
  return (
    O.isSome(binding) &&
    binding.value.sourceUrl === url &&
    /^[a-f0-9]{64}$/.test(binding.value.mediaSha256) &&
    bound(capture.artifacts, "raw-full-text", binding.value.transcriptSha256) &&
    bound(capture.artifacts, "ai-interpretation", binding.value.faqSha256)
  );
});

/**
 * Revalidate an alphaXiv import: the full text is bound to the source's arXiv id and captured version.
 *
 * **Example** (Reference the alphaXiv validator)
 *
 * ```ts
 * import { validateLibraryAlphaxivEvidence } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(typeof validateLibraryAlphaxivEvidence)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const validateLibraryAlphaxivEvidence = Effect.fn("Library.validateAlphaxivEvidence")(function* (
  root: string,
  source: LibrarySource,
  capture: LibraryCapture
) {
  const binding = yield* readJson(root, capture.artifacts, "alphaxiv-binding", LibraryAlphaxivBinding);
  return (
    O.isSome(binding) &&
    source.identity === `arxiv:${binding.value.arxivId}` &&
    capture.capturedRevision === binding.value.version &&
    bound(capture.artifacts, "extracted-full-text", binding.value.fullTextSha256)
  );
});

const capturedUrl = (source: LibrarySource, capture: LibraryCapture) =>
  O.getOrElse(
    O.map(
      A.findFirst(source.versions, (version) => version.revision === capture.requestedRevision),
      (version) => version.canonicalUrl
    ),
    () => source.canonicalUrl
  );

/**
 * Revalidate a capture taken by the Box route or a VidBee or alphaXiv import.
 *
 * **Details**
 *
 * Returns none for every other capture so the caller applies its own source-kind contract.
 *
 * **Example** (Reference the route dispatcher)
 *
 * ```ts
 * import { validateLibraryRouteEvidence } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(typeof validateLibraryRouteEvidence)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const validateLibraryRouteEvidence = Effect.fn("Library.validateRouteEvidence")(function* (
  root: string,
  source: LibrarySource,
  capture: LibraryCapture
) {
  if (capture.method === "box") return yield* validateLibraryBoxEvidence(root, source, capture).pipe(Effect.asSome);
  if (capture.method === "vidbee")
    return yield* validateLibraryVidbeeEvidence(root, capturedUrl(source, capture), capture).pipe(Effect.asSome);
  const alphaxiv =
    capture.method === "alphaxiv" && A.some(capture.artifacts, (artifact) => artifact.role === "alphaxiv-binding");
  return alphaxiv
    ? yield* validateLibraryAlphaxivEvidence(root, source, capture).pipe(Effect.asSome)
    : O.none<boolean>();
});
