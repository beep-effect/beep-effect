/**
 * Portable identity for one exact extracted source-text manifestation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ProvenanceId } from "@beep/identity/packages";
import { PosixPath, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ProvenanceId.create("SourceTextIdentity");

/**
 * Canonical SHA-256 digest encoded as `sha256:<lowercase hex>`.
 *
 * **Example** (Make empty SHA-256 digest)
 *
 * ```ts import.meta.vitest name="Make empty SHA-256 digest"
 * import { SourceTextDigest } from "@beep/provenance/SourceTextIdentity"
 *
 * const digest = SourceTextDigest.make(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * digest // => "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceTextDigest = S.TemplateLiteral(["sha256:", Sha256Hex]).pipe(
  S.annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^[0-9a-f]{64}$/).map((hex): `sha256:${string}` => `sha256:${hex}`),
  }),
  S.brand("SourceTextDigest"),
  $I.annoteSchema("SourceTextDigest", {
    description: "A canonical SHA-256 digest using the sha256:<lowercase hex> representation.",
  })
);

/**
 * Type for {@link SourceTextDigest}.
 *
 * **Example** (Type annotate SourceTextDigest value)
 *
 * ```ts import.meta.vitest name="Type annotate SourceTextDigest value"
 * import { SourceTextDigest } from "@beep/provenance/SourceTextIdentity"
 *
 * const digest: SourceTextDigest = SourceTextDigest.make(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * digest // => "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SourceTextDigest = typeof SourceTextDigest.Type;

/**
 * Pinned extractor implementation that produced the source text.
 *
 * **Example** (Create SourceTextExtractor instance)
 *
 * ```ts import.meta.vitest name="Create SourceTextExtractor instance"
 * import { SourceTextExtractor } from "@beep/provenance/SourceTextIdentity"
 *
 * const extractor = SourceTextExtractor.make({ name: "doc-text", version: "1" })
 * extractor.name // => "doc-text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceTextExtractor extends S.Class<SourceTextExtractor>($I`SourceTextExtractor`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Stable extractor implementation name.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Pinned extractor implementation version.",
    }),
  },
  $I.annote("SourceTextExtractor", {
    description: "The named and versioned extractor that produced an exact source-text manifestation.",
  })
) {}

/**
 * Matter-scoped identity for one exact extracted source-text manifestation.
 *
 * **Details**
 *
 * `locator` is interpreted relative to the scope's configured source root.
 * Containment checks, filesystem access, extraction, and digest computation
 * remain responsibilities of the resolving capability.
 *
 * **Example** (Build complete SourceTextIdentity)
 *
 * ```ts import.meta.vitest name="Build complete SourceTextIdentity"
 * import {
 *   SourceTextDigest,
 *   SourceTextExtractor,
 *   SourceTextIdentity,
 * } from "@beep/provenance/SourceTextIdentity"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const emptyDigest = SourceTextDigest.make(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * const identity = SourceTextIdentity.make({
 *   scopeRef: "matter:example",
 *   sourceRef: "source:example",
 *   locator: PosixPath.make("documents/source.pdf"),
 *   sourceDigest: emptyDigest,
 *   textDigest: emptyDigest,
 *   extractor: SourceTextExtractor.make({ name: "doc-text", version: "1" }),
 *   normalizationVersion: "1",
 * })
 * identity.scopeRef // => "matter:example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceTextIdentity extends S.Class<SourceTextIdentity>($I`SourceTextIdentity`)(
  {
    scopeRef: S.NonEmptyString.annotateKey({
      description: "Opaque matter or tenant scope reference used by the local resolver.",
    }),
    sourceRef: S.NonEmptyString.annotateKey({
      description: "Opaque stable reference for the logical source.",
    }),
    locator: PosixPath.annotateKey({
      description: "POSIX locator interpreted relative to the configured root for scopeRef.",
    }),
    sourceDigest: SourceTextDigest.annotateKey({
      description: "Digest of the exact source artifact bytes.",
    }),
    textDigest: SourceTextDigest.annotateKey({
      description: "Digest of the exact extracted raw source text.",
    }),
    extractor: SourceTextExtractor,
    normalizationVersion: S.NonEmptyString.annotateKey({
      description: "Version of the locator-only normalization contract.",
    }),
  },
  $I.annote("SourceTextIdentity", {
    description:
      "Matter-scoped identity for an exact source artifact and extracted raw-text manifestation, including pinned extractor and normalization versions.",
  })
) {}
