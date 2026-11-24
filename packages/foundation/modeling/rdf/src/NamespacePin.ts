/**
 * Pins of the external namespaces the identity registry declares: where each
 * vocabulary artifact was acquired, at which revision, under which license,
 * and the digests that prove the bytes and the curated term list.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { SafePnPrefix } from "@beep/identity/PnLocal";
import { $RdfId } from "@beep/identity/packages";
import { NamespaceIri } from "@beep/identity/Term";
import { SpecificationRevision } from "@beep/schema/Conformance";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { SpdxExpression } from "@beep/spdx/SpdxExpression";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { NamespacePinRows } from "./Vocab/generated/NamespacePins.data.ts";
import type * as Result from "effect/Result";

const $I = $RdfId.create("NamespacePin");

/**
 * Where a pinned vocabulary artifact was acquired and at which upstream revision.
 *
 * **Details**
 *
 * `revision` reuses the typed revision kinds of `@beep/schema/Conformance`: a
 * git commit, a release, a dated snapshot, a registry version, a retrieved
 * snapshot or a package revision.
 *
 * **Example** (Decode a pinned source)
 *
 * ```ts import.meta.vitest name="Decode a pinned source"
 * import * as S from "effect/Schema"
 * import { PinnedSource } from "@beep/rdf/NamespacePin"
 *
 * const source = S.decodeUnknownSync(PinnedSource)({
 *   location: "https://www.w3.org/ns/oa.ttl",
 *   revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-19" }
 * })
 * source.revision.kind // => "retrievedSnapshot"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PinnedSource extends S.Opaque<PinnedSource, { readonly brand: unique symbol }>()(
  S.Struct({
    location: IRI.annotateKey({ description: "Retrieval IRI of the vocabulary artifact." }),
    revision: SpecificationRevision.annotateKey({ description: "Upstream revision the pin names." }),
  }).pipe(
    $I.annoteSchema("PinnedSource", {
      description: "Retrieval location and upstream revision of a pinned vocabulary artifact.",
    })
  )
) {}

/**
 * **Details**
 *
 * `digest` is the SHA-256 of the artifact bytes. `termsDigest` is the SHA-256
 * of the namespace's curated term locals, sorted and joined by a line feed;
 * it equals the digest of the registry shard's `terms` for the same prefix.
 * Neither digest is computed here: the `pinned-vocabularies` acquisition
 * target records them, and the committed pin rows carry them.
 *
 * **Example** (Read a committed pin)
 *
 * ```ts import.meta.vitest name="Read a committed pin"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { namespacePins } from "@beep/rdf/NamespacePin"
 *
 * const pins = Result.getOrThrow(namespacePins())
 * const prov = O.getOrThrow(A.findFirst(pins, (pin) => pin.prefix === "prov"))
 * prov.namespace // => "http://www.w3.org/ns/prov#"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NamespacePin extends S.Opaque<NamespacePin, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: SafePnPrefix.annotateKey({ description: "Registry prefix of the pinned namespace." }),
    namespace: NamespaceIri.annotateKey({ description: "Registry namespace IRI the curated terms are minted under." }),
    source: PinnedSource.annotateKey({ description: "Where and at which revision the artifact was acquired." }),
    license: SpdxExpression.FromString.annotateKey({ description: "SPDX license expression of the artifact." }),
    attribution: S.NonEmptyString.annotateKey({ description: "Attribution notice carried with the projection." }),
    version: S.NonEmptyString.annotateKey({ description: "Vocabulary version as published upstream." }),
    digest: Sha256PrefixedDigest.annotateKey({ description: "SHA-256 of the pinned artifact bytes." }),
    termsDigest: Sha256PrefixedDigest.annotateKey({
      description: "SHA-256 of the sorted curated term locals, joined by a line feed.",
    }),
  }).pipe(
    $I.annoteSchema("NamespacePin", {
      description: "Source, license, version and digests of one external registry namespace.",
    })
  )
) {}

const isStrictlyAscendingByPrefix = (pins: ReadonlyArray<NamespacePin>): boolean =>
  A.every(pins, (pin, index) =>
    O.match(A.get(pins, index - 1), {
      onNone: () => true,
      onSome: (previous) => previous.prefix < pin.prefix,
    })
  );

/**
 * The namespace pins, strictly ascending by prefix, so each prefix has at most one pin.
 *
 * **Example** (Refuse a duplicate prefix)
 *
 * ```ts import.meta.vitest name="Refuse a duplicate prefix"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { NamespacePins } from "@beep/rdf/NamespacePin"
 * import { NamespacePinRows } from "@beep/rdf/Vocab/generated/NamespacePins.data"
 *
 * const [first] = NamespacePinRows
 * Result.isFailure(S.decodeUnknownResult(NamespacePins)([first, first])) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NamespacePins = S.Array(NamespacePin)
  .check(
    S.makeFilter(
      isStrictlyAscendingByPrefix,
      $I.annote("NamespacePinsStrictlyAscending", {
        title: "Namespace Pins Strictly Ascending",
        description: "Pins are strictly ascending by prefix, so they are sorted and each prefix is pinned once.",
        message: "Expected namespace pins strictly ascending by prefix, with no duplicate prefix.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("NamespacePins", {
      description: "The external namespace pins, strictly ascending by registry prefix.",
    })
  );

/**
 * @category models
 * @since 0.0.0
 */
export type NamespacePins = typeof NamespacePins.Type;

const decodeNamespacePins = S.decodeUnknownResult(NamespacePins);

/**
 * Decode the committed namespace pins written by the `pinned-vocabularies` target.
 *
 * **When to use**
 *
 * Use when a caller needs the license, source or digests of a pinned external
 * namespace, such as a generator writing an attribution header.
 *
 * **Example** (List the pinned prefixes)
 *
 * ```ts import.meta.vitest name="List the pinned prefixes"
 * import * as A from "effect/Array"
 * import * as Result from "effect/Result"
 * import { namespacePins } from "@beep/rdf/NamespacePin"
 *
 * const prefixes = A.map(Result.getOrThrow(namespacePins()), (pin) => pin.prefix)
 * A.contains(prefixes, "oa") // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const namespacePins = (): Result.Result<NamespacePins, S.SchemaError> => decodeNamespacePins(NamespacePinRows);
