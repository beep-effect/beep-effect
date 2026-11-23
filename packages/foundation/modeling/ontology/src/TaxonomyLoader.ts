/**
 * Fail-closed asset-pack loader: every admitted row's bytes are checked
 * against the manifest digest before a concept scheme, an alignment or a
 * payload is admitted.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI, IRIReference } from "@beep/identity/Iri";
import { $I as $BeepId, $OntologyId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { BroaderViolation, Concept, ConceptAlignment, ConceptScheme, checkBroader } from "./ConceptScheme.ts";
import { sha256Hex } from "./internal/ContentDigest.ts";
import { MappingPredicate } from "./Mapping.ts";
import { isFilingSegment } from "./SemanticFoundation.models.ts";
import type * as Digest from "effect/crypto/Digest";
import type { ConceptSchemePin } from "./ConceptScheme.ts";

const iriReferenceEquivalence = S.toEquivalence(IRIReference);

const $I = $OntologyId.create("TaxonomyLoader");

/**
 * Relative path to one vendor slice, contained within the vendor root: one
 * or more {@link FilingSegment}-safe components joined by `/`, so `..`
 * traversal, absolute paths, and separator tricks are rejected at decode
 * time and the loader cannot read outside its configured directory.
 *
 * **Example** (Reject path traversal)
 *
 * ```ts import.meta.vitest name="Reject path traversal"
 * import { VendorSlicePath } from "@beep/ontology/TaxonomyLoader"
 * import * as S from "effect/Schema"
 *
 * S.decodeUnknownResult(VendorSlicePath)("../secrets.jsonld")._tag // => "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VendorSlicePath = S.NonEmptyString.check(
  S.makeFilter(
    (path: string) => A.every(Str.split(path, "/"), isFilingSegment),
    $I.annote("VendorSlicePathCheck", {
      title: "Vendor Slice Path",
      description: "A vendor-root-relative path whose every component is a safe filing segment.",
      message: "Vendor slice path must stay inside the vendor root",
    })
  )
).pipe(
  $I.annoteSchema("VendorSlicePath", {
    description: "Vendor-root-relative slice path that cannot escape the configured directory.",
  })
);

/**
 *  Explicit loader-vetting state required in addition to research verification.
 *
 * **Example** (Check VETTED predicate)
 *
 * ```ts import.meta.vitest name="Check VETTED predicate"
 * import { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
 * VendorLoadStatus.is.VETTED("VETTED") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VendorLoadStatus = LiteralKit(["VETTED", "UNVETTED"]).pipe(
  $I.annoteSchema("VendorLoadStatus", { description: "Explicit implementation-loading verdict for a vendor slice." })
);

/**
 *  Runtime type for {@link VendorLoadStatus}.
 *
 * **Example** (Assign UNVETTED status)
 *
 * ```ts
 * import type { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
 * const status: VendorLoadStatus = "UNVETTED"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VendorLoadStatus = typeof VendorLoadStatus.Type;

/**
 * Runtime loading routes admitted by the shared vendor manifest boundary.
 *
 * **Example** (Identify a concept-scheme route)
 *
 * ```ts import.meta.vitest name="Identify a concept-scheme route"
 * import { VendorLoadKind } from "@beep/ontology/TaxonomyLoader"
 * VendorLoadKind.is["concept-scheme"]("concept-scheme") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VendorLoadKind = LiteralKit([
  "concept-scheme",
  "concept-alignment",
  "payload",
  "classification-scheme",
]).pipe(
  $I.annoteSchema("VendorLoadKind", {
    description:
      "Discriminator routing a manifest row to a concept scheme, an alignment, a payload or a classification.",
  })
);

/**
 * Decoded vendor loading route derived from its schema.
 *
 * **Example** (Type a classification loading route)
 *
 * ```ts
 * import type { VendorLoadKind } from "@beep/ontology/TaxonomyLoader"
 * const kind: VendorLoadKind = "classification-scheme"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type VendorLoadKind = typeof VendorLoadKind.Type;

/**
 * What a row's digest covers: one file, one file extracted from an archive,
 * or every file the loader reads under a directory.
 *
 * **Example** (Check the tree unit)
 *
 * ```ts import.meta.vitest name="Check the tree unit"
 * import { VendorDigestUnit } from "@beep/ontology/TaxonomyLoader"
 * VendorDigestUnit.is.tree("tree") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VendorDigestUnit = LiteralKit(["file", "archive-entry", "tree"]).pipe(
  $I.annoteSchema("VendorDigestUnit", {
    description: "The bytes a manifest row's digest covers: a file, an archive entry or a directory tree.",
  })
);

/**
 * Runtime type for {@link VendorDigestUnit}.
 *
 * **Example** (Type a digest unit)
 *
 * ```ts
 * import type { VendorDigestUnit } from "@beep/ontology/TaxonomyLoader"
 * const unit: VendorDigestUnit = "file"
 * console.log(unit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VendorDigestUnit = typeof VendorDigestUnit.Type;

/**
 * Who maintains a concept scheme: the repository, whose schemes must be
 * acyclic, or a vendor, whose cycles are recorded rather than refused.
 *
 * **Example** (Check a vendor origin)
 *
 * ```ts import.meta.vitest name="Check a vendor origin"
 * import { ConceptSchemeOrigin } from "@beep/ontology/TaxonomyLoader"
 * ConceptSchemeOrigin.is.vendor("vendor") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConceptSchemeOrigin = LiteralKit(["repo-owned", "vendor"]).pipe(
  $I.annoteSchema("ConceptSchemeOrigin", {
    description: "Whether a concept scheme is maintained by the repository or imported from a vendor.",
  })
);

/**
 * Runtime type for {@link ConceptSchemeOrigin}.
 *
 * **Example** (Type an origin)
 *
 * ```ts
 * import type { ConceptSchemeOrigin } from "@beep/ontology/TaxonomyLoader"
 * const origin: ConceptSchemeOrigin = "repo-owned"
 * console.log(origin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ConceptSchemeOrigin = typeof ConceptSchemeOrigin.Type;

const ReuseVerdict = LiteralKit(["adopt", "slice", "inspire", "reject"]).pipe(
  $I.annoteSchema("ReuseVerdict", { description: "The research verdict on reusing an external asset." })
);

const HttpsIriReference = IRIReference.check(
  S.makeFilter(
    Str.startsWith("https://"),
    $I.annote("HttpsIriReferenceCheck", {
      title: "HTTPS IRI Reference",
      description: "An absolute IRI reference constrained to the HTTPS scheme.",
      message: "Expected an absolute HTTPS IRI",
    })
  )
);

const RepoConceptIri = HttpsIriReference.check(
  S.makeFilter(
    Str.startsWith($BeepId.iri),
    $I.annote("RepoConceptIriCheck", {
      title: "Repository Concept IRI",
      description: "An absolute concept IRI under the repository identity authority.",
      message: `Expected a repository concept IRI under ${$BeepId.iri}`,
    })
  )
);

const approvalFields = {
  license: S.NonEmptyString,
  licenseEvidenceUrl: S.NonEmptyString,
  maintenanceStatus: S.NonEmptyString,
  reuseVerdict: ReuseVerdict,
  verdictRationale: S.NonEmptyString,
};

/**
 * Manifest row admitting one `ConceptScheme` JSON file.
 *
 * **Example** (Describe a repo-owned scheme row)
 *
 * ```ts
 * import { ConceptSchemeManifestRow } from "@beep/ontology/TaxonomyLoader"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(ConceptSchemeManifestRow)({
 *   id: "intake",
 *   format: "json",
 *   loadKind: "concept-scheme",
 *   origin: "repo-owned",
 *   path: "intake.json",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   verified: true,
 *   loadStatus: "VETTED",
 *   license: "MIT",
 *   licenseEvidenceUrl: "https://example.test/license",
 *   reuseVerdict: "adopt",
 *   verdictRationale: "Repository-authored.",
 *   maintenanceStatus: "active"
 * })
 * console.log(row.origin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConceptSchemeManifestRow extends S.Opaque<ConceptSchemeManifestRow, { readonly brand: unique symbol }>()(
  S.Struct({
    _tag: S.tagDefaultOmit("ConceptSchemeManifestRow"),
    id: S.NonEmptyString,
    format: S.tag("json"),
    loadKind: S.tag("concept-scheme"),
    origin: ConceptSchemeOrigin,
    path: VendorSlicePath,
    sha256: Sha256Hex,
    verified: S.tag(true),
    loadStatus: VendorLoadStatus,
    ...approvalFields,
  }).pipe(
    $I.annoteSchema("ConceptSchemeManifestRow", {
      description: "Asset-pack row admitting one concept scheme file, with its origin, digest and approval.",
    })
  )
) {}

/**
 * Manifest row admitting one file whose verified bytes are returned undecoded.
 *
 * **Example** (Describe a payload row)
 *
 * ```ts
 * import { PayloadManifestRow } from "@beep/ontology/TaxonomyLoader"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(PayloadManifestRow)({
 *   id: "intake-payload",
 *   format: "json",
 *   loadKind: "payload",
 *   mediaType: "application/json",
 *   path: "intake-payload.json",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   verified: true,
 *   loadStatus: "VETTED",
 *   license: "MIT",
 *   licenseEvidenceUrl: "https://example.test/license",
 *   reuseVerdict: "adopt",
 *   verdictRationale: "Repository-authored.",
 *   maintenanceStatus: "active"
 * })
 * console.log(row.mediaType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PayloadManifestRow extends S.Opaque<PayloadManifestRow, { readonly brand: unique symbol }>()(
  S.Struct({
    _tag: S.tagDefaultOmit("PayloadManifestRow"),
    id: S.NonEmptyString,
    format: S.NonEmptyString,
    loadKind: S.tag("payload"),
    mediaType: S.NonEmptyString,
    path: VendorSlicePath,
    sha256: Sha256Hex,
    verified: S.tag(true),
    loadStatus: VendorLoadStatus,
    ...approvalFields,
  }).pipe(
    $I.annoteSchema("PayloadManifestRow", {
      description: "Asset-pack row admitting one digest-checked file that the loader returns as bytes.",
    })
  )
) {}

/**
 * Manifest load directive for one vetted external concept exposed as JSON-LD.
 *
 * **Details**
 *
 * The directive binds an exact external concept IRI to one concept of a
 * concept scheme loaded by the same manifest. The loader verifies the slice
 * digest and its JSON-LD identifier before admitting the mapping, so labels
 * alone can never create concept identity.
 *
 * **Example** (Describe an external alignment slice)
 *
 * ```ts
 * import { $SemanticFoundationId } from "@beep/identity/packages"
 * import { VendorAlignmentManifestEntry } from "@beep/ontology/TaxonomyLoader"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(VendorAlignmentManifestEntry)({
 *   conceptIri: "https://folio.openlegalstandard.org/example",
 *   fetchUrl: "https://folio.openlegalstandard.org/example/jsonld",
 *   format: "jsonld",
 *   id: "folio-example",
 *   loadKind: "concept-alignment",
 *   loadStatus: "VETTED",
 *   localConceptIri: $SemanticFoundationId.create("concept/example").iri,
 *   mappingPredicate: "skos:closeMatch",
 *   namespaceIri: "https://folio.openlegalstandard.org/",
 *   path: "folio-example.jsonld",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   verified: true
 * })
 * console.log(entry.mappingPredicate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VendorAlignmentManifestEntry extends S.Opaque<
  VendorAlignmentManifestEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    _tag: S.tagDefaultOmit("VendorAlignmentManifestEntry"),
    conceptIri: HttpsIriReference,
    fetchUrl: HttpsIriReference,
    format: S.tag("jsonld"),
    id: S.NonEmptyString,
    loadKind: S.tag("concept-alignment"),
    loadStatus: VendorLoadStatus,
    localConceptIri: RepoConceptIri,
    mappingPredicate: MappingPredicate,
    namespaceIri: HttpsIriReference,
    path: VendorSlicePath,
    sha256: Sha256Hex,
    verified: S.tag(true),
  }).pipe(
    S.check(
      S.makeFilter(
        (entry) =>
          Bool.and(
            Str.startsWith(entry.namespaceIri)(entry.conceptIri),
            Str.startsWith(entry.namespaceIri)(entry.fetchUrl)
          ),
        $I.annote("VendorAlignmentAuthorityCheck", {
          title: "Vendor Alignment Authority",
          description: "A vendor alignment whose concept and source IRIs remain under its manifested namespace.",
          message: "Vendor concept and source IRIs must remain under the manifested namespace",
        })
      )
    ),
    $I.annoteSchema("VendorAlignmentManifestEntry", {
      description: "Asset-pack manifest directive for one vetted external concept alignment.",
    })
  )
) {}

/**
 * Boundary shape decoded from an individual external JSON-LD class response.
 *
 * **Example** (Construct an external concept slice)
 *
 * ```ts
 * import { VendorConceptSlice } from "@beep/ontology/TaxonomyLoader"
 * import { IRIReference } from "@beep/identity/Iri"
 *
 * const slice = VendorConceptSlice.make({
 *   "@id": IRIReference.make("https://folio.openlegalstandard.org/example"),
 *   "@type": "owl:Class",
 *   "rdfs:label": "Example concept",
 *   "skos:definition": "A fixture FOLIO concept."
 * })
 * console.log(slice["rdfs:label"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VendorConceptSlice extends S.Opaque<VendorConceptSlice, { readonly brand: unique symbol }>()(
  S.Struct({
    "@id": HttpsIriReference,
    "@type": S.tag("owl:Class"),
    "rdfs:label": S.NonEmptyString,
    "skos:definition": S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("VendorConceptSlice", {
      description: "Minimal external JSON-LD class fields required to verify a manifested alignment.",
    })
  )
) {}

/**
 *  Raised when the manifest cannot be read.
 *
 * **Example** (Make read error)
 *
 * ```ts
 * import { TaxonomyManifestReadError } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyManifestReadError.make({ path: "missing.jsonl" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyManifestReadError extends S.TaggedError<
  TaxonomyManifestReadError,
  { readonly brand: unique symbol }
>($I`TaxonomyManifestReadError`)(
  "TaxonomyManifestReadError",
  { path: S.NonEmptyString },
  $I.annoteError<TaxonomyManifestReadError>("TaxonomyManifestReadError", {
    description: "The vendor manifest is missing or unreadable.",
  })
) {}

/**
 *  Raised when a manifest row cannot be parsed.
 *
 * **Example** (Make parse error)
 *
 * ```ts
 * import { TaxonomyManifestParseError } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyManifestParseError.make({ line: 1, path: "manifest.jsonl" }).line)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyManifestParseError extends S.TaggedError<
  TaxonomyManifestParseError,
  { readonly brand: unique symbol }
>($I`TaxonomyManifestParseError`)(
  "TaxonomyManifestParseError",
  { line: S.Int, path: S.NonEmptyString },
  $I.annoteError<TaxonomyManifestParseError>("TaxonomyManifestParseError", {
    description: "A vendor manifest JSONL row failed schema decoding.",
  })
) {}

/**
 *  Raised when a manifest slice lacks explicit loading approval.
 *
 * **Example** (Make unvetted error)
 *
 * ```ts
 * import { VendorSliceUnvetted } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceUnvetted.make({ id: "folio" }).id)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceUnvetted extends S.TaggedError<VendorSliceUnvetted, { readonly brand: unique symbol }>(
  $I`VendorSliceUnvetted`
)(
  "VendorSliceUnvetted",
  { id: S.NonEmptyString },
  $I.annoteError<VendorSliceUnvetted>("VendorSliceUnvetted", {
    description: "A vendor slice is not explicitly VETTED for loading.",
  })
) {}

/**
 *  Raised when an approved slice cannot be read.
 *
 * **Example** (Make slice read error)
 *
 * ```ts
 * import { VendorSliceReadError } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceReadError.make({ id: "fixture", path: "missing.jsonld" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceReadError extends S.TaggedError<VendorSliceReadError, { readonly brand: unique symbol }>(
  $I`VendorSliceReadError`
)(
  "VendorSliceReadError",
  { id: S.NonEmptyString, path: S.NonEmptyString },
  $I.annoteError<VendorSliceReadError>("VendorSliceReadError", {
    description: "An explicitly vetted vendor slice is unreadable.",
  })
) {}

/**
 *  Raised when an approved slice cannot be schema-decoded.
 *
 * **Example** (Make slice parse error)
 *
 * ```ts
 * import { VendorSliceParseError } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceParseError.make({ id: "fixture", path: "fixture.jsonld" }).id)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceParseError extends S.TaggedError<VendorSliceParseError, { readonly brand: unique symbol }>(
  $I`VendorSliceParseError`
)(
  "VendorSliceParseError",
  { id: S.NonEmptyString, path: S.NonEmptyString },
  $I.annoteError<VendorSliceParseError>("VendorSliceParseError", {
    description: "An explicitly vetted vendor slice is not valid UTF-8 or fails its schema.",
  })
) {}

/**
 * Raised when a vetted vendor slice resolves outside its canonical vendor root.
 *
 * **Example** (Make path escape error)
 *
 * ```ts
 * import { VendorSlicePathEscape } from "@beep/ontology/TaxonomyLoader"
 *
 * const error = VendorSlicePathEscape.make({
 *   id: "fixture",
 *   path: "/outside/fixture.jsonld",
 *   vendorRoot: "/vendor"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSlicePathEscape extends S.TaggedError<VendorSlicePathEscape, { readonly brand: unique symbol }>(
  $I`VendorSlicePathEscape`
)(
  "VendorSlicePathEscape",
  {
    id: S.NonEmptyString,
    path: S.NonEmptyString,
    vendorRoot: S.NonEmptyString,
  },
  $I.annoteError<VendorSlicePathEscape>("VendorSlicePathEscape", {
    description: "A vetted vendor taxonomy slice resolved outside its canonical vendor root.",
  })
) {}

/**
 * Raised when the bytes a row names hash to a digest other than the manifest's.
 *
 * **Example** (Make a digest mismatch)
 *
 * ```ts
 * import { VendorSliceDigestMismatch } from "@beep/ontology/TaxonomyLoader"
 *
 * const error = VendorSliceDigestMismatch.make({ id: "ipc", expected: "00", actual: "11" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceDigestMismatch extends S.TaggedError<
  VendorSliceDigestMismatch,
  { readonly brand: unique symbol }
>($I`VendorSliceDigestMismatch`)(
  "VendorSliceDigestMismatch",
  { id: S.NonEmptyString, expected: S.String, actual: S.String },
  $I.annoteError<VendorSliceDigestMismatch>("VendorSliceDigestMismatch", {
    description: "A manifest row's bytes, hashed in its digest unit, differ from the manifested digest.",
  })
) {}

/**
 * Raised when an `archive-entry` or `tree` row is loaded without its
 * `contentSha256`.
 *
 * **Example** (Make a missing content digest)
 *
 * ```ts
 * import { VendorContentDigestMissing } from "@beep/ontology/TaxonomyLoader"
 *
 * console.log(VendorContentDigestMissing.make({ id: "cpc", unit: "tree" }).unit)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorContentDigestMissing extends S.TaggedError<
  VendorContentDigestMissing,
  { readonly brand: unique symbol }
>($I`VendorContentDigestMissing`)(
  "VendorContentDigestMissing",
  { id: S.NonEmptyString, unit: VendorDigestUnit },
  $I.annoteError<VendorContentDigestMissing>("VendorContentDigestMissing", {
    description: "An archive-entry or tree row has no contentSha256, so its loaded bytes cannot be verified.",
  })
) {}

/**
 * Raised when an external slice identifier differs from its manifested concept IRI.
 *
 * **Example** (Make a concept mismatch error)
 *
 * ```ts
 * import { VendorSliceConceptMismatch } from "@beep/ontology/TaxonomyLoader"
 * import { IRIReference } from "@beep/identity/Iri"
 *
 * const error = VendorSliceConceptMismatch.make({
 *   actualConceptIri: IRIReference.make("https://folio.openlegalstandard.org/actual"),
 *   expectedConceptIri: IRIReference.make("https://folio.openlegalstandard.org/expected"),
 *   id: "folio-example",
 *   path: "folio-example.jsonld"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceConceptMismatch extends S.TaggedError<
  VendorSliceConceptMismatch,
  { readonly brand: unique symbol }
>($I`VendorSliceConceptMismatch`)(
  "VendorSliceConceptMismatch",
  {
    actualConceptIri: IRIReference,
    expectedConceptIri: IRIReference,
    id: S.NonEmptyString,
    path: S.NonEmptyString,
  },
  $I.annoteError<VendorSliceConceptMismatch>("VendorSliceConceptMismatch", {
    description: "An external JSON-LD slice did not carry the exact concept IRI named by its manifest row.",
  })
) {}

/**
 * Raised when a manifested external mapping targets no concept of the
 * manifest's concept schemes.
 *
 * **Example** (Make an alignment-target error)
 *
 * ```ts
 * import { $SemanticFoundationId } from "@beep/identity/packages"
 * import { VendorAlignmentTargetNotFound } from "@beep/ontology/TaxonomyLoader"
 * import { IRIReference } from "@beep/identity/Iri"
 *
 * const error = VendorAlignmentTargetNotFound.make({
 *   id: "folio-example",
 *   localConceptIri: IRIReference.make($SemanticFoundationId.create("concept/missing").iri)
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorAlignmentTargetNotFound extends S.TaggedError<
  VendorAlignmentTargetNotFound,
  { readonly brand: unique symbol }
>($I`VendorAlignmentTargetNotFound`)(
  "VendorAlignmentTargetNotFound",
  {
    id: S.NonEmptyString,
    localConceptIri: IRIReference,
  },
  $I.annoteError<VendorAlignmentTargetNotFound>("VendorAlignmentTargetNotFound", {
    description: "A vetted vendor alignment names a concept absent from the manifest's concept schemes.",
  })
) {}

/**
 * Raised when a repo-owned concept scheme breaks the `skos:broader` profile.
 *
 * **Example** (Make a repo-owned scheme refusal)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { RepoSchemeBroaderViolation } from "@beep/ontology/TaxonomyLoader"
 *
 * const error = RepoSchemeBroaderViolation.make({ scheme: IRI.make("https://example.test/scheme"), violations: [] })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RepoSchemeBroaderViolation extends S.TaggedError<
  RepoSchemeBroaderViolation,
  { readonly brand: unique symbol }
>($I`RepoSchemeBroaderViolation`)(
  "RepoSchemeBroaderViolation",
  { scheme: IRI, violations: S.Array(BroaderViolation) },
  $I.annoteError<RepoSchemeBroaderViolation>("RepoSchemeBroaderViolation", {
    description: "A repo-owned concept scheme has a broader cycle or a broader link outside the scheme.",
  })
) {}

/**
 * Raised when two rows of one manifest load concept schemes with one IRI.
 *
 * **Example** (Make a duplicate scheme refusal)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { DuplicateConceptScheme } from "@beep/ontology/TaxonomyLoader"
 *
 * console.log(DuplicateConceptScheme.make({ scheme: IRI.make("https://example.test/scheme") })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuplicateConceptScheme extends S.TaggedError<DuplicateConceptScheme, { readonly brand: unique symbol }>(
  $I`DuplicateConceptScheme`
)(
  "DuplicateConceptScheme",
  { scheme: IRI },
  $I.annoteError<DuplicateConceptScheme>("DuplicateConceptScheme", {
    description: "Two manifest rows loaded concept schemes with one IRI, so a pack would hold two editions.",
  })
) {}

/**
 * Raised when a pin names a scheme the pack holds in another version.
 *
 * **Example** (Make a version mismatch)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { ConceptSchemeVersionMismatch } from "@beep/ontology/TaxonomyLoader"
 *
 * const error = ConceptSchemeVersionMismatch.make({
 *   scheme: IRI.make("https://example.test/scheme"),
 *   pinned: "2",
 *   loaded: "1"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ConceptSchemeVersionMismatch extends S.TaggedError<
  ConceptSchemeVersionMismatch,
  { readonly brand: unique symbol }
>($I`ConceptSchemeVersionMismatch`)(
  "ConceptSchemeVersionMismatch",
  { scheme: IRI, pinned: S.NonEmptyString, loaded: S.NonEmptyString },
  $I.annoteError<ConceptSchemeVersionMismatch>("ConceptSchemeVersionMismatch", {
    description: "A pinned concept scheme version differs from the version the pack loaded.",
  })
) {}

/**
 * Raised when a pin names a scheme the pack did not load.
 *
 * **Example** (Make a missing scheme refusal)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { ConceptSchemeNotLoaded } from "@beep/ontology/TaxonomyLoader"
 *
 * console.log(ConceptSchemeNotLoaded.make({ scheme: IRI.make("https://example.test/scheme") })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ConceptSchemeNotLoaded extends S.TaggedError<ConceptSchemeNotLoaded, { readonly brand: unique symbol }>(
  $I`ConceptSchemeNotLoaded`
)(
  "ConceptSchemeNotLoaded",
  { scheme: IRI },
  $I.annoteError<ConceptSchemeNotLoaded>("ConceptSchemeNotLoaded", {
    description: "A pinned concept scheme IRI names no scheme the pack loaded.",
  })
) {}

/**
 * Common asset-pack identity, kind, vetting and digest fields shared by both
 * loaders.
 *
 * **Example** (Inspect a classification route)
 *
 * ```ts
 * import { VendorAssetManifestRow } from "@beep/ontology/TaxonomyLoader"
 * import * as S from "effect/Schema"
 * S.decodeUnknownResult(VendorAssetManifestRow)({ format: "xml", id: "ipc", loadKind: "classification-scheme" })._tag
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VendorAssetManifestRow extends S.Opaque<VendorAssetManifestRow, { readonly brand: unique symbol }>()(
  S.Struct({
    format: S.NonEmptyString,
    id: S.NonEmptyString,
    loadKind: S.OptionFromOptionalKey(VendorLoadKind),
    loadStatus: S.OptionFromOptionalKey(VendorLoadStatus),
    sha256: S.OptionFromOptionalKey(Sha256Hex),
    contentSha256: S.OptionFromOptionalKey(Sha256Hex),
    archivePath: S.OptionFromOptionalKey(S.NonEmptyString),
    digestUnit: S.OptionFromOptionalKey(VendorDigestUnit),
  }).pipe(
    $I.annoteSchema("VendorAssetManifestRow", {
      description: "Asset-pack row fields used to route a row and to define what its digest covers.",
    })
  )
) {}

/**
 * The digest unit of a row: its stated `digestUnit`, else `archive-entry`
 * when it names an `archivePath`, else `file`.
 *
 * **Example** (Derive an archive-entry unit)
 *
 * ```ts import.meta.vitest name="Derive an archive-entry unit"
 * import { VendorAssetManifestRow, vendorDigestUnit } from "@beep/ontology/TaxonomyLoader"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(VendorAssetManifestRow)({ id: "ipc", format: "xml", archivePath: "ipc.zip" })
 * vendorDigestUnit(row) // => "archive-entry"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const vendorDigestUnit = (row: Pick<VendorAssetManifestRow, "archivePath" | "digestUnit">): VendorDigestUnit =>
  O.getOrElse(row.digestUnit, () => (O.isSome(row.archivePath) ? "archive-entry" : "file"));

/**
 * Compare the digest of the bytes a row loaded with the row's manifested
 * digest: `sha256` for a `file` row, `contentSha256` otherwise.
 *
 * **Example** (Verify a file digest)
 *
 * ```ts
 * import { verifyRowDigest } from "@beep/ontology/TaxonomyLoader"
 * import * as O from "effect/Option"
 *
 * const program = verifyRowDigest(
 *   { id: "fixture", sha256: "00", contentSha256: O.none() },
 *   "file",
 *   "00"
 * )
 * console.log(program)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyRowDigest = Effect.fn("TaxonomyLoader.verifyRowDigest")(function* (
  row: { readonly id: string; readonly sha256: string; readonly contentSha256: O.Option<string> },
  unit: VendorDigestUnit,
  actual: string
): Effect.fn.Return<void, VendorContentDigestMissing | VendorSliceDigestMismatch> {
  const expected = yield* VendorDigestUnit.is.file(unit)
    ? Effect.succeed(row.sha256)
    : Effect.fromOption(row.contentSha256, () => VendorContentDigestMissing.make({ id: row.id, unit }));
  if (expected !== actual) {
    return yield* VendorSliceDigestMismatch.make({ id: row.id, expected, actual });
  }
});

type VendorLoadManifestEntry = ConceptSchemeManifestRow | PayloadManifestRow | VendorAlignmentManifestEntry;

const decodeAssetManifestRow = S.decodeUnknownEffect(S.fromJsonString(VendorAssetManifestRow));
const decodeConceptSchemeRow = S.decodeUnknownEffect(S.fromJsonString(ConceptSchemeManifestRow));
const decodePayloadRow = S.decodeUnknownEffect(S.fromJsonString(PayloadManifestRow));
const decodeAlignmentManifestEntry = S.decodeUnknownEffect(S.fromJsonString(VendorAlignmentManifestEntry));
const decodeVendorConceptSlice = S.decodeUnknownEffect(S.fromJsonString(VendorConceptSlice));
const decodeConceptScheme = S.decodeUnknownEffect(S.fromJsonString(ConceptScheme));

const manifestParseError = (path: string, line: number) => TaxonomyManifestParseError.make({ line, path });

/**
 * Decode the shared asset-pack boundary and reject every unknown runtime kind.
 *
 * **Example** (Decode a classification route)
 *
 * ```ts
 * import { decodeVendorManifestRow } from "@beep/ontology/TaxonomyLoader"
 * import * as Effect from "effect/Effect"
 * const row = '{"id":"ipc","format":"xml","loadKind":"classification-scheme"}'
 * const parsed = await Effect.runPromise(decodeVendorManifestRow("manifest.jsonl", row, 0))
 * console.log(parsed.id)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeVendorManifestRow = Effect.fn("TaxonomyLoader.decodeVendorManifestRow")(function* (
  path: string,
  line: string,
  index: number
): Effect.fn.Return<VendorAssetManifestRow, TaxonomyManifestParseError> {
  return yield* decodeAssetManifestRow(line).pipe(Effect.mapError(() => manifestParseError(path, index + 1)));
});

/**
 * Decode one asset-pack row into its load directive without reading vendor bytes.
 *
 * **Details**
 *
 * Classification rows and research references, rows with no `loadKind`,
 * return None. Unknown kinds fail closed.
 *
 * **Example** (Skip a classification row)
 *
 * ```ts
 * import { decodeLoadManifestEntry } from "@beep/ontology/TaxonomyLoader"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * const row = '{"id":"ipc","format":"xml","loadKind":"classification-scheme"}'
 * console.log(O.isNone(await Effect.runPromise(decodeLoadManifestEntry("manifest.jsonl", row, 0))))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeLoadManifestEntry = Effect.fn("TaxonomyLoader.decodeLoadManifestEntry")(function* (
  path: string,
  line: string,
  index: number
): Effect.fn.Return<O.Option<VendorLoadManifestEntry>, TaxonomyManifestParseError> {
  const row = yield* decodeVendorManifestRow(path, line, index);
  const decoded: Effect.Effect<O.Option<VendorLoadManifestEntry>, S.SchemaError> = row.loadKind.pipe(
    O.getOrUndefined,
    Match.value,
    Match.when("concept-scheme", () => Effect.asSome(decodeConceptSchemeRow(line))),
    Match.when("payload", () => Effect.asSome(decodePayloadRow(line))),
    Match.when("concept-alignment", () => Effect.asSome(decodeAlignmentManifestEntry(line))),
    Match.orElse(() => Effect.succeedNone)
  );
  return yield* Effect.mapError(decoded, () => manifestParseError(path, index + 1));
});

const parseManifest = Effect.fn("TaxonomyLoader.parseManifest")(function* (path: string, content: string) {
  const lines = A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty);
  const entries = yield* Effect.forEach(lines, (line, index) => decodeLoadManifestEntry(path, line, index), {
    concurrency: 1,
  });
  return A.getSomes(entries);
});

/**
 * Resolve a vendor-relative path under the canonical configured root.
 *
 * **Details**
 * Realpath containment rejects symlink escapes before a read or directory scan.
 *
 * **Example** (Resolve a vetted local path)
 *
 * ```ts
 * import { resolveVendorPath } from "@beep/ontology/TaxonomyLoader"
 * const program = resolveVendorPath("fixture", "fixture.xml", "vendor")
 * console.log(program)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const resolveVendorPath = Effect.fn("TaxonomyLoader.resolveVendorPath")(function* (
  id: string,
  relativePath: string,
  vendorRoot: string
): Effect.fn.Return<string, VendorSlicePathEscape | VendorSliceReadError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const canonicalVendorRoot = yield* fs.realPath(vendorRoot).pipe(
    Effect.mapError(() =>
      VendorSliceReadError.make({
        id,
        path: vendorRoot,
      })
    )
  );
  const candidatePath = A.join([canonicalVendorRoot, relativePath], "/");
  const path = yield* fs.realPath(candidatePath).pipe(
    Effect.mapError(() =>
      VendorSliceReadError.make({
        id,
        path: candidatePath,
      })
    )
  );
  const separator = Bool.match(
    Bool.and(Str.includes("\\")(canonicalVendorRoot), Bool.not(Str.includes("/")(canonicalVendorRoot))),
    {
      onFalse: () => "/",
      onTrue: () => "\\",
    }
  );
  const rootedPrefix = Bool.match(Str.endsWith(separator)(canonicalVendorRoot), {
    onFalse: () => `${canonicalVendorRoot}${separator}`,
    onTrue: () => canonicalVendorRoot,
  });
  const containedPath = yield* Effect.filterOrFail(Effect.succeed(path), Str.startsWith(rootedPrefix), () =>
    VendorSlicePathEscape.make({ id, path, vendorRoot: canonicalVendorRoot })
  );
  return containedPath;
});

/**
 * Read vendor bytes through the shared canonical containment boundary.
 *
 * **Example** (Describe a contained read)
 *
 * ```ts
 * import { readVendorBytes } from "@beep/ontology/TaxonomyLoader"
 * const program = readVendorBytes("fixture", "fixture.xml", "vendor")
 * console.log(program)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const readVendorBytes = Effect.fn("TaxonomyLoader.readVendorBytes")(function* (
  id: string,
  relativePath: string,
  vendorRoot: string
): Effect.fn.Return<Uint8Array, VendorSlicePathEscape | VendorSliceReadError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const containedPath = yield* resolveVendorPath(id, relativePath, vendorRoot);
  return yield* fs.readFile(containedPath).pipe(
    Effect.mapError(() =>
      VendorSliceReadError.make({
        id,
        path: containedPath,
      })
    )
  );
});

/**
 * Decode verified bytes as UTF-8, refusing any ill-formed sequence.
 *
 * **Example** (Decode UTF-8 text)
 *
 * ```ts
 * import { decodeUtf8 } from "@beep/ontology/TaxonomyLoader"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(decodeUtf8("fixture", "fixture.json", new TextEncoder().encode("{}"))))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeUtf8 = Effect.fn("TaxonomyLoader.decodeUtf8")(function* (
  id: string,
  path: string,
  bytes: Uint8Array
): Effect.fn.Return<string, VendorSliceParseError> {
  return yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => VendorSliceParseError.make({ id, path }),
  });
});

const readVerifiedFile = Effect.fn("TaxonomyLoader.readVerifiedFile")(function* (
  entry: VendorLoadManifestEntry,
  vendorRoot: string
) {
  if (!VendorLoadStatus.is.VETTED(entry.loadStatus)) {
    return yield* VendorSliceUnvetted.make({ id: entry.id });
  }
  const bytes = yield* readVendorBytes(entry.id, entry.path, vendorRoot);
  const actual = yield* sha256Hex(bytes);
  yield* verifyRowDigest({ id: entry.id, sha256: entry.sha256, contentSha256: O.none() }, "file", actual);
  return bytes;
});

/**
 * An external alignment the loader applied to one concept of a loaded scheme.
 *
 * **Example** (Record an applied alignment)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { ConceptAlignment } from "@beep/ontology/ConceptScheme"
 * import { AppliedAlignment } from "@beep/ontology/TaxonomyLoader"
 * import * as O from "effect/Option"
 *
 * const applied = AppliedAlignment.make({
 *   id: "folio-email",
 *   scheme: IRI.make("https://example.test/scheme"),
 *   concept: IRI.make("https://example.test/scheme/email"),
 *   alignment: ConceptAlignment.make({
 *     predicate: "skos:closeMatch",
 *     target: IRI.make("https://example.test/vendor/Email"),
 *     source: O.none()
 *   })
 * })
 * console.log(applied.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppliedAlignment extends S.Opaque<AppliedAlignment, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    scheme: IRI,
    concept: IRI,
    alignment: ConceptAlignment,
  }).pipe(
    $I.annoteSchema("AppliedAlignment", {
      description: "A manifested alignment row and the scheme concept it was applied to.",
    })
  )
) {}

const schemeForPin = (
  pack: LoadedPack,
  pin: ConceptSchemePin
): Effect.Effect<ConceptScheme, ConceptSchemeNotLoaded | ConceptSchemeVersionMismatch> =>
  pipe(
    HashMap.get(pack.schemes, pin.scheme),
    Effect.fromOption(() => ConceptSchemeNotLoaded.make({ scheme: pin.scheme })),
    Effect.filterOrFail(
      (scheme) => scheme.version === pin.version,
      (scheme) => ConceptSchemeVersionMismatch.make({ scheme: pin.scheme, pinned: pin.version, loaded: scheme.version })
    )
  );

/**
 * Everything one manifest admitted: concept schemes by IRI, the alignments
 * applied to them, the recorded vendor-scheme exceptions and payload bytes by
 * row id.
 *
 * **Example** (Look up a scheme by pin)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { ConceptSchemePin } from "@beep/ontology/ConceptScheme"
 * import { LoadedPack } from "@beep/ontology/TaxonomyLoader"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 *
 * const pack = LoadedPack.make({ schemes: HashMap.empty(), alignments: [], exceptions: [], payloads: HashMap.empty() })
 * const pin = ConceptSchemePin.make({ scheme: IRI.make("https://example.test/scheme"), version: "1" })
 * console.log(Effect.runSync(Effect.flip(pack.schemeFor(pin)))._tag) // ConceptSchemeNotLoaded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LoadedPack extends S.Class<LoadedPack, { readonly brand: unique symbol }>($I`LoadedPack`)(
  {
    schemes: S.HashMap(IRI, ConceptScheme),
    alignments: S.Array(AppliedAlignment),
    exceptions: S.Array(BroaderViolation),
    payloads: S.HashMap(S.String, S.Uint8Array),
  },
  $I.annote("LoadedPack", {
    description: "The concept schemes, alignments, recorded exceptions and payloads one manifest admitted.",
  })
) {
  /**
   * The loaded scheme a pin names, refused when absent or in another version.
   *
   * **Example** (Resolve a pin)
   *
   * ```ts
   * import { LoadedPack } from "@beep/ontology/TaxonomyLoader"
   * console.log(LoadedPack.prototype.schemeFor)
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  schemeFor(
    pin: ConceptSchemePin
  ): Effect.Effect<ConceptScheme, ConceptSchemeNotLoaded | ConceptSchemeVersionMismatch> {
    return schemeForPin(this, pin);
  }
}

type LoadedRow =
  | { readonly _tag: "Scheme"; readonly row: ConceptSchemeManifestRow; readonly scheme: ConceptScheme }
  | { readonly _tag: "Payload"; readonly row: PayloadManifestRow; readonly bytes: Uint8Array }
  | {
      readonly _tag: "Alignment";
      readonly row: VendorAlignmentManifestEntry;
      readonly alignment: ConceptAlignment;
    };

const readRow = Effect.fn("TaxonomyLoader.readRow")(function* (entry: VendorLoadManifestEntry, vendorRoot: string) {
  const bytes = yield* readVerifiedFile(entry, vendorRoot);
  const parseError = () => VendorSliceParseError.make({ id: entry.id, path: entry.path });
  return yield* Match.valueTags(entry, {
    ConceptSchemeManifestRow: Effect.fnUntraced(function* (row) {
      const text = yield* decodeUtf8(row.id, row.path, bytes);
      const scheme = yield* decodeConceptScheme(text).pipe(Effect.mapError(parseError));
      return { _tag: "Scheme", row, scheme } satisfies LoadedRow;
    }),
    PayloadManifestRow: (row) => Effect.succeed({ _tag: "Payload", row, bytes } satisfies LoadedRow),
    VendorAlignmentManifestEntry: Effect.fnUntraced(function* (row) {
      const text = yield* decodeUtf8(row.id, row.path, bytes);
      const slice = yield* decodeVendorConceptSlice(text).pipe(Effect.mapError(parseError));
      if (!iriReferenceEquivalence(slice["@id"], row.conceptIri)) {
        return yield* VendorSliceConceptMismatch.make({
          actualConceptIri: slice["@id"],
          expectedConceptIri: row.conceptIri,
          id: row.id,
          path: row.path,
        });
      }
      const alignment = ConceptAlignment.make({
        predicate: row.mappingPredicate,
        target: IRI.make(slice["@id"]),
        source: IRI.makeOption(row.fetchUrl),
      });
      return { _tag: "Alignment", row, alignment } satisfies LoadedRow;
    }),
  });
});

const isSchemeRow = (loaded: LoadedRow): loaded is Extract<LoadedRow, { readonly _tag: "Scheme" }> =>
  loaded._tag === "Scheme";

const isPayloadRow = (loaded: LoadedRow): loaded is Extract<LoadedRow, { readonly _tag: "Payload" }> =>
  loaded._tag === "Payload";

const indexSchemes = Effect.fn("TaxonomyLoader.indexSchemes")(function* (rows: ReadonlyArray<LoadedRow>) {
  let schemes = HashMap.empty<IRI, ConceptScheme>();
  let exceptions: ReadonlyArray<BroaderViolation> = [];
  for (const { row, scheme } of A.filter(rows, isSchemeRow)) {
    if (HashMap.has(schemes, scheme.iri)) {
      return yield* DuplicateConceptScheme.make({ scheme: scheme.iri });
    }
    const violations = checkBroader(scheme);
    if (ConceptSchemeOrigin.is["repo-owned"](row.origin) && A.isReadonlyArrayNonEmpty(violations)) {
      return yield* RepoSchemeBroaderViolation.make({ scheme: scheme.iri, violations });
    }
    schemes = HashMap.set(schemes, scheme.iri, scheme);
    exceptions = A.appendAll(exceptions, violations);
  }
  return { schemes, exceptions };
});

const withAlignment = (scheme: ConceptScheme, concept: Concept, alignment: ConceptAlignment): ConceptScheme =>
  ConceptScheme.make({
    ...scheme,
    concepts: pipe(
      scheme.concepts,
      HashSet.remove(concept),
      HashSet.add(Concept.make({ ...concept, alignments: HashSet.add(concept.alignments, alignment) }))
    ),
  });

const applyAlignments = Effect.fn("TaxonomyLoader.applyAlignments")(function* (
  rows: ReadonlyArray<LoadedRow>,
  loadedSchemes: HashMap.HashMap<IRI, ConceptScheme>
) {
  let schemes = loadedSchemes;
  let applied: ReadonlyArray<AppliedAlignment> = [];
  for (const loaded of rows) {
    if (loaded._tag !== "Alignment") {
      continue;
    }
    const local = IRI.make(loaded.row.localConceptIri);
    const target = schemes.pipe(
      HashMap.values,
      A.fromIterable,
      A.sort(Order.mapInput(Order.String, (scheme: ConceptScheme) => scheme.iri)),
      A.findFirst((scheme) =>
        O.map(
          A.findFirst(A.fromIterable(scheme.concepts), (concept) => concept.iri === local),
          (concept) => [scheme, concept] as const
        )
      )
    );
    if (O.isNone(target)) {
      return yield* VendorAlignmentTargetNotFound.make({
        id: loaded.row.id,
        localConceptIri: loaded.row.localConceptIri,
      });
    }
    const [scheme, concept] = target.value;
    schemes = HashMap.set(schemes, scheme.iri, withAlignment(scheme, concept, loaded.alignment));
    applied = A.append(
      applied,
      AppliedAlignment.make({ id: loaded.row.id, scheme: scheme.iri, concept: local, alignment: loaded.alignment })
    );
  }
  return { schemes, applied };
});

const payloadsOf = (rows: ReadonlyArray<LoadedRow>) =>
  pipe(
    A.filter(rows, isPayloadRow),
    A.map((loaded) => [loaded.row.id, loaded.bytes] as const),
    HashMap.fromIterable
  );

type TaxonomyLoadError =
  | TaxonomyManifestReadError
  | TaxonomyManifestParseError
  | VendorAlignmentTargetNotFound
  | VendorContentDigestMissing
  | VendorSliceConceptMismatch
  | VendorSliceDigestMismatch
  | VendorSliceUnvetted
  | VendorSliceReadError
  | VendorSliceParseError
  | VendorSlicePathEscape
  | RepoSchemeBroaderViolation
  | DuplicateConceptScheme;

/**
 *  Service contract for loading one asset-pack manifest into a {@link LoadedPack}.
 *
 * **Example** (Access service key)
 *
 * ```ts
 * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyLoader.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TaxonomyLoader extends Context.Service<
  TaxonomyLoader,
  {
    readonly load: {
      (
        manifestPath: string,
        vendorRoot: string
      ): Effect.Effect<LoadedPack, TaxonomyLoadError, FileSystem.FileSystem | Digest.Digest>;
      (
        vendorRoot: string
      ): (manifestPath: string) => Effect.Effect<LoadedPack, TaxonomyLoadError, FileSystem.FileSystem | Digest.Digest>;
    };
  }
>()($I`TaxonomyLoader`) {
  /**
   *  Live loader implementation requiring the portable FileSystem and Digest services.
   *
   * **Example** (Access live layer)
   *
   * ```ts
   * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
   * console.log(TaxonomyLoader.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.succeed(this, {
    load: dual(
      2,
      Effect.fn("TaxonomyLoader.load")(function* (manifestPath: string, vendorRoot: string) {
        const fs = yield* FileSystem.FileSystem;
        const content = yield* fs
          .readFileString(manifestPath)
          .pipe(Effect.mapError(() => TaxonomyManifestReadError.make({ path: manifestPath })));
        const entries = yield* parseManifest(manifestPath, content);
        const rows = yield* Effect.forEach(entries, (entry) => readRow(entry, vendorRoot), { concurrency: 1 });
        const indexed = yield* indexSchemes(rows);
        const aligned = yield* applyAlignments(rows, indexed.schemes);
        return LoadedPack.make({
          schemes: aligned.schemes,
          alignments: aligned.applied,
          exceptions: indexed.exceptions,
          payloads: payloadsOf(rows),
        });
      })
    ),
  });
}
