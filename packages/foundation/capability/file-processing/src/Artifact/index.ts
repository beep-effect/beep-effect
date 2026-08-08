/**
 * Artifact schemas for runtime-neutral file processing operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { FileExtension } from "@beep/schema/FileExtension";
import { FileName } from "@beep/schema/FileName";
import { MimeType } from "@beep/schema/MimeType";
import { PosixPath } from "@beep/schema/PosixPath";
import { A } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type * as Crypto from "effect/Crypto";

const $I = $FileProcessingId.create("Artifact");
const artifactExtensionPattern = /^[^./\\\u0000][^/\\\u0000]*$/u;
const artifactNamePattern = /^[^/\\\u0000]+$/u;
const artifactExtensionArbitraryPattern = /^[a-z0-9][a-z0-9-]{0,15}$/;
const artifactNameArbitraryPattern = /^[a-z0-9][a-z0-9-]{0,23}\.[a-z0-9][a-z0-9-]{0,15}$/;

const ArtifactExtension = S.Union([
  FileExtension,
  S.NonEmptyString.check(
    S.makeFilter((value: string) => artifactExtensionPattern.test(value), {
      identifier: $I`ArtifactExtensionBareExtensionCheck`,
      title: "Artifact Extension",
      description:
        "A bare source extension. File processing accepts known MIME extensions plus local-corpus extensions such as pst.",
      message: "Expected a bare file extension without path separators, a leading dot, or NUL bytes.",
    })
  ),
]).pipe(
  S.annotate({
    toArbitrary: () => (fc) => fc.stringMatching(artifactExtensionArbitraryPattern),
  }),
  $I.annoteSchema("ArtifactExtension", {
    description:
      "Bare source extension accepted by the file-processing boundary. Reuses FileExtension when possible while allowing local-corpus extensions absent from the shared MIME table.",
  })
);

const ArtifactName = S.Union([
  FileName,
  S.NonEmptyString.check(
    S.makeFilter((value: string) => artifactNamePattern.test(value), {
      identifier: $I`ArtifactNameNoPathSeparatorCheck`,
      title: "Artifact Name",
      description: "A source artifact name without path separators or embedded NUL bytes.",
      message: "Expected a file name without path separators or embedded NUL bytes.",
    })
  ),
]).pipe(
  S.annotate({
    toArbitrary: () => (fc) => fc.stringMatching(artifactNameArbitraryPattern),
  }),
  $I.annoteSchema("ArtifactName", {
    description:
      "Portable source artifact name. Reuses FileName when the suffix is known while allowing extensionless or local-corpus file names.",
  })
);

/**
 * Stable artifact identifier derived from a content digest.
 *
 * **Example** (Decode ArtifactId from string)
 *
 * ```ts
 * import { ArtifactId } from "@beep/file-processing/Artifact"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(ArtifactId)(
 *   "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(id.startsWith("artifact:")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArtifactId = S.TemplateLiteral(["artifact:", Sha256Hex]).pipe(
  S.annotate({
    toArbitrary: () => (fc) =>
      fc.stringMatching(/^[0-9a-f]{64}$/).map((digest): `artifact:${string}` => `artifact:${digest}`),
  }),
  S.brand("FileProcessingArtifactId"),
  $I.annoteSchema("ArtifactId", {
    description: "A stable file-processing artifact identifier derived from a SHA-256 content digest.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ArtifactId}.
 *
 * **Example** (Annotate decoded ArtifactId type)
 *
 * ```ts
 * import { ArtifactId } from "@beep/file-processing/Artifact"
 * import * as S from "effect/Schema"
 *
 * const id: ArtifactId = S.decodeUnknownSync(ArtifactId)(
 *   "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(id.startsWith("artifact:")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArtifactId = typeof ArtifactId.Type;

/**
 * Stable operation identifier derived from source, operation kind, and strategy.
 *
 * **Example** (Decode OperationId from string)
 *
 * ```ts
 * import { OperationId } from "@beep/file-processing/Artifact"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(OperationId)(
 *   "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(id.startsWith("operation:")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OperationId = S.TemplateLiteral(["operation:", Sha256Hex]).pipe(
  S.annotate({
    toArbitrary: () => (fc) =>
      fc.stringMatching(/^[0-9a-f]{64}$/).map((digest): `operation:${string}` => `operation:${digest}`),
  }),
  S.brand("FileProcessingOperationId"),
  $I.annoteSchema("OperationId", {
    description: "A stable file-processing operation identifier derived from operation inputs.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link OperationId}.
 *
 * **Example** (Annotate decoded OperationId type)
 *
 * ```ts
 * import { OperationId } from "@beep/file-processing/Artifact"
 * import * as S from "effect/Schema"
 *
 * const id: OperationId = S.decodeUnknownSync(OperationId)(
 *   "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(id.startsWith("operation:")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OperationId = typeof OperationId.Type;

/**
 * SHA-256 content digest recorded with the source or emitted artifact.
 *
 * **Example** (Decode ContentDigest from string)
 *
 * ```ts
 * import { ContentDigest } from "@beep/file-processing/Artifact"
 * import * as S from "effect/Schema"
 *
 * const digest = S.decodeUnknownSync(ContentDigest)(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(digest.slice(0, 7)) // "sha256:"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentDigest = S.TemplateLiteral(["sha256:", Sha256Hex]).pipe(
  S.annotate({
    toArbitrary: () => (fc) =>
      fc.stringMatching(/^[0-9a-f]{64}$/).map((digest): `sha256:${string}` => `sha256:${digest}`),
  }),
  S.brand("FileProcessingContentDigest"),
  $I.annoteSchema("ContentDigest", {
    description: "A SHA-256 content digest using the sha256:<hex> representation.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ContentDigest}.
 *
 * **Example** (Annotate decoded ContentDigest type)
 *
 * ```ts
 * import { ContentDigest } from "@beep/file-processing/Artifact"
 * import * as S from "effect/Schema"
 *
 * const digest: ContentDigest = S.decodeUnknownSync(ContentDigest)(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(digest.slice(0, 7)) // "sha256:"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContentDigest = typeof ContentDigest.Type;

const deriveArtifactIdDigest = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeDerivedArtifactId = S.decodeUnknownEffect(ArtifactId);
const artifactIdTextEncoder = new TextEncoder();

/**
 * Derive a stable artifact identifier from deterministic artifact parts.
 *
 * **Example** (Derive id from artifact parts)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { deriveArtifactId } from "@beep/file-processing/Artifact"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* deriveArtifactId(["artifact:parent", "children/message.txt"])
 *   return id.startsWith("artifact:")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunCrypto.layer))).then((valid) => console.log(valid)) // true
 * ```
 *
 * @effects Requires `Crypto.Crypto` to hash the joined artifact parts and may fail with `SchemaError` when the derived identifier cannot be decoded.
 * @category constructors
 * @since 0.0.0
 */
export const deriveArtifactId = Effect.fn("Artifact.deriveArtifactId")(function* (
  parts: ReadonlyArray<string>
): Effect.fn.Return<ArtifactId, S.SchemaError, Crypto.Crypto> {
  const digest = yield* deriveArtifactIdDigest(artifactIdTextEncoder.encode(A.join("\x1f")(parts)));
  return yield* decodeDerivedArtifactId(`artifact:${digest}`);
});

/**
 * Origin kind for a source artifact locator.
 *
 * **Example** (Check locator kind options)
 *
 * ```ts
 * import { ArtifactLocatorKind } from "@beep/file-processing/Artifact"
 *
 * console.log(ArtifactLocatorKind.Options.includes("memory")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArtifactLocatorKind = LiteralKit(["file", "synthetic", "memory"]).pipe(
  $I.annoteSchema("ArtifactLocatorKind", {
    description: "Runtime-neutral locator kinds accepted by file-processing operation inputs.",
  })
);

/**
 * Type for {@link ArtifactLocatorKind}.
 *
 * **Example** (Narrow memory locator kind)
 *
 * ```ts
 * import { ArtifactLocatorKind } from "@beep/file-processing/Artifact"
 *
 * const kind: ArtifactLocatorKind = "memory"
 * console.log(ArtifactLocatorKind.is.memory(kind)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArtifactLocatorKind = typeof ArtifactLocatorKind.Type;

/**
 * Runtime-neutral artifact locator.
 *
 * **Example** (Create synthetic artifact locator)
 *
 * ```ts
 * import { ArtifactLocator } from "@beep/file-processing/Artifact"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const value = yield* S.decodeUnknownEffect(PosixPath)("fixtures/readme.md")
 *   return ArtifactLocator.make({ kind: "synthetic", value }).kind
 * })
 *
 * Effect.runPromise(program).then(console.log) // "synthetic"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactLocator extends S.Class<ArtifactLocator>($I`ArtifactLocator`)(
  {
    kind: ArtifactLocatorKind,
    value: PosixPath,
  },
  $I.annote("ArtifactLocator", {
    description: "Runtime-neutral locator for a source artifact.",
  })
) {}

/**
 * Source artifact supplied to a file-processing operation.
 *
 * **Example** (Construct SourceArtifact instance)
 *
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, SourceArtifact } from "@beep/file-processing/Artifact"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("README.md")
 *
 *   return SourceArtifact.make({
 *     digest,
 *     extension: "md",
 *     id: artifactId,
 *     locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
 *     name: "README.md",
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(11),
 *     text: "hello"
 *   }).extension
 * })
 *
 * Effect.runPromise(program).then(console.log) // "md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceArtifact extends S.Class<SourceArtifact>($I`SourceArtifact`)(
  {
    bytes: S.optionalKey(S.Uint8Array),
    digest: ContentDigest,
    extension: S.optionalKey(ArtifactExtension),
    id: ArtifactId,
    locator: ArtifactLocator,
    mediaType: S.optionalKey(MimeType),
    name: ArtifactName,
    relativePath: PosixPath,
    sizeBytes: NonNegativeInt,
    text: S.optionalKey(S.String),
  },
  $I.annote("SourceArtifact", {
    description: "Runtime-neutral source artifact metadata and optional in-memory bytes or text.",
  })
) {}

/**
 * Lightweight reference to a materialized artifact.
 *
 * **Example** (Construct ArtifactReference instance)
 *
 * ```ts
 * import { ArtifactId, ArtifactReference } from "@beep/file-processing/Artifact"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("text/README.txt")
 *
 *   return ArtifactReference.make({
 *     id: artifactId,
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(5)
 *   }).relativePath
 * })
 *
 * Effect.runPromise(program).then(console.log) // "text/README.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactReference extends S.Class<ArtifactReference>($I`ArtifactReference`)(
  {
    digest: S.optionalKey(ContentDigest),
    id: ArtifactId,
    mediaType: S.optionalKey(MimeType),
    relativePath: PosixPath,
    sizeBytes: S.optionalKey(NonNegativeInt),
  },
  $I.annote("ArtifactReference", {
    description: "Reference to an artifact materialized by an operation.",
  })
) {}
