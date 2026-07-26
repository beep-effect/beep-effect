/**
 * Branded storage identifiers used by the effect-ontology experiment.
 *
 * The schemas in this module distinguish truncated content fingerprints,
 * ontology versions, document and run identifiers, Google Cloud Storage
 * locations, and their construction helpers at both runtime and compile time.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { $ScratchpadId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effect-ontology/Domain/Identity");

const contentHashPattern = /^[0-9a-f]{16}$/;
const gcsBucketNamePattern = /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;
const gcsIpv4AddressPattern =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$/;
const gcsObjectNamePattern = /^(?!\.{1,2}$)(?!\.well-known\/acme-challenge\/)(?!.*[\r\n])[\s\S]+$/u;

const utf8Encoder = new TextEncoder();
const isNotGcsIpv4Address = P.not((value: string) => gcsIpv4AddressPattern.test(value));
const isNotGcsReservedPrefix = P.not(Str.startsWith("goog"));
const isNotGcsReservedSpelling = P.every([P.not(Str.includes("google")), P.not(Str.includes("g00gle"))]);
const isGcsBucketArbitraryCandidate = P.every([
  isNotGcsIpv4Address,
  isNotGcsReservedPrefix,
  isNotGcsReservedSpelling,
]);

const GcsBucketChecks = S.makeFilterGroup(
  [
    S.isPattern(gcsBucketNamePattern, {
      identifier: $I`GcsBucketSyntaxCheck`,
      title: "GCS Bucket Name Syntax",
      description:
        "A 3-63 character GCS bucket name that starts and ends with a lowercase ASCII letter or digit and otherwise contains only lowercase ASCII letters, digits, dashes, underscores, or dots.",
      message:
        "GCS bucket name must be 3-63 characters long, start and end with a lowercase letter or number, and contain only lowercase letters, numbers, dashes, underscores, and periods.",
    }),
    S.makeFilter(isNotGcsIpv4Address, {
      identifier: $I`GcsBucketNotIpv4AddressCheck`,
      title: "GCS Bucket Name Is Not An IPv4 Address",
      description: "A GCS bucket name that is not a dotted-decimal IPv4 address.",
      message: "GCS bucket name must not be an IPv4 address.",
    }),
    S.makeFilter(isNotGcsReservedPrefix, {
      identifier: $I`GcsBucketNotReservedPrefixCheck`,
      title: "GCS Bucket Name Has No Reserved Prefix",
      description: 'A GCS bucket name that does not begin with Google Cloud Storage\'s reserved "goog" prefix.',
      message: 'GCS bucket name must not begin with the reserved "goog" prefix.',
    }),
    S.makeFilter(isNotGcsReservedSpelling, {
      identifier: $I`GcsBucketNotReservedSpellingCheck`,
      title: "GCS Bucket Name Has No Reserved Google Spelling",
      description: 'A GCS bucket name that contains neither "google" nor the documented "g00gle" lookalike.',
      message: 'GCS bucket name must not contain the reserved spellings "google" or "g00gle".',
    }),
  ],
  {
    identifier: $I`GcsBucketChecks`,
    title: "GCS Bucket Name",
    description:
      "Locally decidable Google Cloud Storage bucket-name checks for the portable 3-63 character form.",
  }
);

const GcsObjectName = S.String.check(
  S.makeFilterGroup(
    [
      S.isPattern(gcsObjectNamePattern, {
        identifier: $I`GcsObjectNameSyntaxCheck`,
        title: "GCS Object Name Syntax",
        description:
          "A non-empty GCS object name without carriage returns, line feeds, the reserved ACME challenge prefix, or a dot-only name.",
        message:
          'GCS object name must be non-empty, must not contain CR or LF, must not be "." or "..", and must not use the reserved ACME challenge prefix.',
      }),
      S.makeFilter((value: string) => utf8Encoder.encode(value).byteLength <= 1_024, {
        identifier: $I`GcsObjectNameUtf8LengthCheck`,
        title: "GCS Object Name UTF-8 Length",
        description: "A flat-namespace GCS object name whose UTF-8 representation is no larger than 1,024 bytes.",
        message: "GCS object name must not exceed 1,024 bytes when UTF-8 encoded.",
      }),
    ],
    {
      identifier: $I`GcsObjectNameChecks`,
      title: "GCS Object Name",
      description: "Google Cloud Storage flat-namespace object-name checks.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/),
  })
  .pipe(
    $I.annoteSchema("GcsObjectName", {
      description:
        "Google Cloud Storage flat-namespace object name constrained to the provider's general syntax and 1,024-byte UTF-8 limit.",
    })
  );

/**
 * Branded 16-character lowercase hexadecimal prefix of a SHA-256 digest.
 *
 * @remarks
 * A 16-character prefix carries 64 bits of the original digest. It is suitable
 * for compact cache or version fingerprints where collision handling exists,
 * but it must not replace a full digest for security-sensitive identity or
 * long-lived content addressing.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContentHash } from "./Models.ts"
 *
 * const result = S.decodeUnknownResult(ContentHash)("e3b0c44298fc1c14")
 * console.log(result._tag) // "Success"
 * ```
 *
 * @invariant Exactly 16 lowercase ASCII hexadecimal characters.
 * @category validation
 * @since 0.0.0
 */
export const ContentHash = S.String.check(
  S.isPattern(contentHashPattern, {
    identifier: $I`ContentHashPatternCheck`,
    title: "Content Hash Prefix",
    description: "A 16-character lowercase hexadecimal prefix of a SHA-256 digest.",
    message: "Content hash must contain exactly 16 lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(contentHashPattern),
  })
  .pipe(
    S.brand("ContentHash"),
    $I.annoteSchema("ContentHash", {
      description:
        "Compact content fingerprint containing the first 16 lowercase hexadecimal characters of a SHA-256 digest.",
      documentation:
        "This schema validates the representation of a 64-bit truncated digest; it does not provide the collision resistance of a full SHA-256 digest.",
    })
  );

/**
 * Runtime value type decoded by {@link ContentHash}. {@inheritDoc ContentHash}
 *
 * @example
 * ```ts
 * import { ContentHash, type ContentHash as ContentHashValue } from "./Models.ts"
 *
 * const hash: ContentHashValue = ContentHash.make("e3b0c44298fc1c14")
 * console.log(hash.length) // 16
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type ContentHash = typeof ContentHash.Type;

/**
 * Branded idempotency key represented by a complete lowercase SHA-256 digest.
 *
 * @remarks
 * This schema validates only the canonical 64-character digest representation.
 * The caller remains responsible for hashing a stable, unambiguous encoding of
 * every input that affects the idempotent operation.
 *
 * The schema inherits its property-based generator from {@link Sha256Hex}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { IdempotencyKey } from "./Models.ts"
 *
 * const result = S.decodeUnknownResult(IdempotencyKey)(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(result._tag) // "Success"
 * ```
 *
 * @invariant Exactly 64 lowercase ASCII hexadecimal characters.
 * @category validation
 * @since 0.0.0
 */
export const IdempotencyKey = Sha256Hex.annotate({
  toArbitrary: () => () => S.toArbitrary(Sha256Hex),
}).pipe(
  S.brand("IdempotencyKey"),
  $I.annoteSchema("IdempotencyKey", {
    description:
      "Canonical full-length SHA-256 digest used as an idempotency key after hashing a stable operation description.",
    documentation:
      "The schema validates digest shape only; uniqueness depends on the canonical operation data supplied to the hash.",
  })
);

/**
 * Runtime value type decoded by {@link IdempotencyKey}. {@inheritDoc IdempotencyKey}
 *
 * @example
 * ```ts
 * import { IdempotencyKey, type IdempotencyKey as IdempotencyKeyValue } from "./Models.ts"
 *
 * const key: IdempotencyKeyValue = IdempotencyKey.make(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(key.length) // 64
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type IdempotencyKey = typeof IdempotencyKey.Type;

/**
 * Branded Google Cloud Storage bucket name in the portable 3-63 character form.
 *
 * @remarks
 * The schema enforces locally decidable GCS naming rules: the allowed lowercase
 * character set, alphanumeric endpoints, the 3-63 character range,
 * non-IPv4 form, the reserved `goog` prefix, and the explicitly documented
 * `google` and `g00gle` spellings.
 *
 * Google also rejects additional close misspellings and requires global name
 * availability. Those provider-maintained checks require a GCS API call and
 * are intentionally outside this pure schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GcsBucket } from "./Models.ts"
 *
 * const isGcsBucket = S.is(GcsBucket)
 *
 * console.log(isGcsBucket("beep-ontology-state")) // true
 * console.log(isGcsBucket("192.168.5.4")) // false
 * console.log(isGcsBucket("goog-ontology-state")) // false
 * ```
 *
 * @invariant Contains 3-63 permitted characters, begins and ends with an
 * alphanumeric character, and is not a documented reserved form.
 * @see {@link https://cloud.google.com/storage/docs/buckets#naming | Google Cloud Storage bucket naming requirements}
 * @category validation
 * @since 0.0.0
 */
export const GcsBucket = S.String.check(GcsBucketChecks)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(gcsBucketNamePattern).filter(isGcsBucketArbitraryCandidate),
  })
  .pipe(
    S.brand("GcsBucket"),
    $I.annoteSchema("GcsBucket", {
      description:
        "Portable 3-63 character Google Cloud Storage bucket name excluding IPv4 addresses and explicitly documented Google-reserved forms.",
      documentation:
        "Provider-side availability and Google's broader close-misspelling policy must still be checked when creating the bucket.",
    })
  );

/**
 * Runtime value type decoded by {@link GcsBucket}. {@inheritDoc GcsBucket}
 *
 * @example
 * ```ts
 * import { GcsBucket, type GcsBucket as GcsBucketValue } from "./Models.ts"
 *
 * const bucket: GcsBucketValue = GcsBucket.make("beep-ontology-state")
 * console.log(bucket) // "beep-ontology-state"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type GcsBucket = typeof GcsBucket.Type;

/**
 * Branded `gs://` URI containing a valid {@link GcsBucket} and GCS object name.
 *
 * @remarks
 * The object-name component follows flat-namespace rules: 1-1,024 UTF-8 bytes,
 * no carriage-return or line-feed characters, no dot-only names, and no
 * reserved ACME challenge prefix. Hierarchical-namespace segment limits are
 * bucket configuration constraints and are not represented by this schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GcsUri } from "./Models.ts"
 *
 * const result = S.decodeUnknownResult(GcsUri)(
 *   "gs://beep-ontology-state/snapshots/ontology-v1.ttl"
 * )
 * console.log(result._tag) // "Success"
 * ```
 *
 * @invariant Uses the `gs://<bucket>/<object>` form with a non-empty, valid
 * bucket and flat-namespace object name.
 * @see {@link https://cloud.google.com/storage/docs/objects#naming | Google Cloud Storage object naming requirements}
 * @category validation
 * @since 0.0.0
 */
export const GcsUri = S.TemplateLiteral(["gs://", GcsBucket, "/", GcsObjectName]).pipe(
  S.annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(S.toArbitrary(GcsBucket), S.toArbitrary(GcsObjectName))
        .map(([bucket, objectName]): `gs://${string}/${string}` => `gs://${bucket}/${objectName}`),
  }),
  S.brand("GcsUri"),
  $I.annoteSchema("GcsUri", {
    description:
      "Google Cloud Storage URI composed from a validated bucket name and a non-empty flat-namespace object name.",
    documentation:
      "The schema validates URI components locally; bucket existence, permissions, and hierarchical-namespace configuration require GCS.",
  })
);

/**
 * Runtime value type decoded by {@link GcsUri}. {@inheritDoc GcsUri}
 *
 * @example
 * ```ts
 * import { GcsUri, type GcsUri as GcsUriValue } from "./Models.ts"
 *
 * const uri: GcsUriValue = GcsUri.make(
 *   "gs://beep-ontology-state/snapshots/ontology-v1.ttl"
 * )
 * console.log(uri)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type GcsUri = typeof GcsUri.Type;

const gcsObjectPathPattern = /^[^/](?:[\s\S]*[^/])?$/u;
const gcsObjectArbitraryPattern = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const namespacePattern = /^[a-z][a-z0-9-]*$/;
const ontologyNamePattern = /^[a-z][a-z0-9_-]*$/;
const documentIdPattern = /^doc-[0-9a-f]{12}$/;
const chunkIdPattern = /^doc-[0-9a-f]{12}-chunk-(?:0|[1-9][0-9]*)$/;
const batchIdPattern = /^batch-[0-9a-f]{12}$/;

const GcsObjectChecks = S.makeFilterGroup(
  [
    S.isPattern(gcsObjectPathPattern, {
      identifier: $I`GcsObjectBoundarySlashCheck`,
      title: "GCS Object Path Boundaries",
      description: "A canonical GCS object path that does not begin or end with a forward slash.",
      message: "GCS object path must not begin or end with a forward slash.",
    }),
    S.makeFilter(P.not(Str.includes("//")), {
      identifier: $I`GcsObjectConsecutiveSlashCheck`,
      title: "GCS Object Path Consecutive Slashes",
      description: "A canonical GCS object path without empty path segments created by consecutive slashes.",
      message: "GCS object path must not contain consecutive forward slashes.",
    }),
  ],
  {
    identifier: $I`GcsObjectChecks`,
    title: "Canonical GCS Object Path",
    description: "Application-level canonicalization checks layered on the provider-valid GCS object-name schema.",
  }
);

/**
 * Branded canonical GCS object path without boundary or consecutive slashes.
 *
 * @remarks
 * This schema narrows the provider-valid object-name space used by
 * {@link GcsUri}. It preserves ordinary slash-separated pseudo-directories but
 * rejects leading, trailing, and consecutive slashes so one logical path has
 * one textual representation.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GcsObject } from "./Models.ts"
 *
 * const isGcsObject = S.is(GcsObject)
 * console.log(isGcsObject("snapshots/ontology-v1.ttl")) // true
 * console.log(isGcsObject("/snapshots/ontology-v1.ttl")) // false
 * console.log(isGcsObject("a")) // true
 * ```
 *
 * @invariant Is a provider-valid GCS object name with no leading, trailing, or
 * consecutive forward slash.
 * @category validation
 * @since 0.0.0
 */
export const GcsObject = GcsObjectName.check(GcsObjectChecks)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(gcsObjectArbitraryPattern),
  })
  .pipe(
    S.brand("GcsObject"),
    $I.annoteSchema("GcsObject", {
      description:
        "Canonical slash-separated GCS object path derived from the provider-valid object-name schema.",
      documentation:
        "Leading, trailing, and consecutive slashes are rejected to prevent multiple textual forms of one application path.",
    })
  );

/**
 * Runtime value type decoded by {@link GcsObject}. {@inheritDoc GcsObject}
 *
 * @example
 * ```ts
 * import { GcsObject, type GcsObject as GcsObjectValue } from "./Models.ts"
 *
 * const objectPath: GcsObjectValue = GcsObject.make("snapshots/ontology-v1.ttl")
 * console.log(objectPath)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type GcsObject = typeof GcsObject.Type;

/**
 * Branded lowercase ontology namespace identifier.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Namespace } from "./Models.ts"
 *
 * const isNamespace = S.is(Namespace)
 * console.log(isNamespace("legal-ontology")) // true
 * console.log(isNamespace("LegalOntology")) // false
 * ```
 *
 * @invariant Begins with a lowercase ASCII letter and otherwise contains only
 * lowercase ASCII letters, digits, or hyphens.
 * @category validation
 * @since 0.0.0
 */
export const Namespace = S.String.check(
  S.isPattern(namespacePattern, {
    identifier: $I`NamespacePatternCheck`,
    title: "Ontology Namespace",
    description:
      "A lowercase ontology namespace beginning with a letter and continuing with letters, digits, or hyphens.",
    message:
      "Ontology namespace must begin with a lowercase letter and contain only lowercase letters, digits, or hyphens.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(namespacePattern),
  })
  .pipe(
    S.brand("Namespace"),
    $I.annoteSchema("Namespace", {
      description:
        "Lowercase ontology namespace identifier beginning with a letter and containing letters, digits, or hyphens.",
    })
  );

/**
 * Runtime value type decoded by {@link Namespace}. {@inheritDoc Namespace}
 *
 * @example
 * ```ts
 * import { Namespace, type Namespace as NamespaceValue } from "./Models.ts"
 *
 * const namespace: NamespaceValue = Namespace.make("legal-ontology")
 * console.log(namespace)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type Namespace = typeof Namespace.Type;

/**
 * Branded lowercase ontology name.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { OntologyName } from "./Models.ts"
 *
 * const isOntologyName = S.is(OntologyName)
 * console.log(isOntologyName("patent_claims-v2")) // true
 * console.log(isOntologyName("PatentClaims")) // false
 * ```
 *
 * @invariant Begins with a lowercase ASCII letter and otherwise contains only
 * lowercase ASCII letters, digits, hyphens, or underscores.
 * @category validation
 * @since 0.0.0
 */
export const OntologyName = S.String.check(
  S.isPattern(ontologyNamePattern, {
    identifier: $I`OntologyNamePatternCheck`,
    title: "Ontology Name",
    description:
      "A lowercase ontology name beginning with a letter and continuing with letters, digits, hyphens, or underscores.",
    message:
      "Ontology name must begin with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(ontologyNamePattern),
  })
  .pipe(
    S.brand("OntologyName"),
    $I.annoteSchema("OntologyName", {
      description:
        "Lowercase ontology name beginning with a letter and containing letters, digits, hyphens, or underscores.",
    })
  );

/**
 * Runtime value type decoded by {@link OntologyName}. {@inheritDoc OntologyName}
 *
 * @example
 * ```ts
 * import { OntologyName, type OntologyName as OntologyNameValue } from "./Models.ts"
 *
 * const name: OntologyNameValue = OntologyName.make("patent_claims-v2")
 * console.log(name)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type OntologyName = typeof OntologyName.Type;

/**
 * Branded ontology version in `namespace/name@content-hash` form.
 *
 * @remarks
 * The component schemas remain the source of truth: namespace and ontology
 * naming rules come from {@link Namespace} and {@link OntologyName}, while the
 * version fingerprint uses the 64-bit truncated {@link ContentHash}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { OntologyVersion } from "./Models.ts"
 *
 * const result = S.decodeUnknownResult(OntologyVersion)(
 *   "legal/patent_claims@deadbeefdeadbeef"
 * )
 * console.log(result._tag) // "Success"
 * ```
 *
 * @invariant Contains a valid namespace, ontology name, and 16-character
 * content-hash prefix separated as `namespace/name@hash`.
 * @category validation
 * @since 0.0.0
 */
export const OntologyVersion = S.TemplateLiteral([Namespace, "/", OntologyName, "@", ContentHash]).pipe(
  S.annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(S.toArbitrary(Namespace), S.toArbitrary(OntologyName), S.toArbitrary(ContentHash))
        .map(([namespace, name, hash]): `${string}/${string}@${string}` => `${namespace}/${name}@${hash}`),
  }),
  S.brand("OntologyVersion"),
  $I.annoteSchema("OntologyVersion", {
    description:
      "Ontology version identifier composed from a namespace, ontology name, and truncated SHA-256 content fingerprint.",
    documentation:
      "The 16-character content fingerprint is collision-sensitive and should not replace a full digest where collision resistance is required.",
  })
);

/**
 * Runtime value type decoded by {@link OntologyVersion}. {@inheritDoc OntologyVersion}
 *
 * @example
 * ```ts
 * import { OntologyVersion, type OntologyVersion as OntologyVersionValue } from "./Models.ts"
 *
 * const version: OntologyVersionValue = OntologyVersion.make(
 *   "legal/patent_claims@deadbeefdeadbeef"
 * )
 * console.log(version)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type OntologyVersion = typeof OntologyVersion.Type;

/**
 * Branded deterministic document identifier in `doc-<12-hex>` form.
 *
 * @remarks
 * The 12-character suffix carries 48 bits from a content digest. Collisions
 * therefore require explicit handling when identifiers span large or
 * adversarial document sets.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DocumentId } from "./Models.ts"
 *
 * const isDocumentId = S.is(DocumentId)
 * console.log(isDocumentId("doc-deadbeefcafe")) // true
 * console.log(isDocumentId("doc-DEADBEEFCAFE")) // false
 * ```
 *
 * @invariant Uses the `doc-` prefix followed by exactly 12 lowercase
 * hexadecimal characters.
 * @category validation
 * @since 0.0.0
 */
export const DocumentId = S.String.check(
  S.isPattern(documentIdPattern, {
    identifier: $I`DocumentIdPatternCheck`,
    title: "Document Identifier",
    description: "A deterministic document identifier with a doc- prefix and 12 lowercase hexadecimal characters.",
    message: "Document ID must use the doc- prefix followed by exactly 12 lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(documentIdPattern),
  })
  .pipe(
    S.brand("DocumentId"),
    $I.annoteSchema("DocumentId", {
      description: "Deterministic document identifier derived from the first 12 characters of a content hash.",
      documentation:
        "The 48-bit truncated suffix is compact but collision-sensitive; consumers must define collision handling.",
    })
  );

/**
 * Runtime value type decoded by {@link DocumentId}. {@inheritDoc DocumentId}
 *
 * @example
 * ```ts
 * import { DocumentId, type DocumentId as DocumentIdValue } from "./Models.ts"
 *
 * const id: DocumentIdValue = DocumentId.make("doc-deadbeefcafe")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type DocumentId = typeof DocumentId.Type;

/**
 * Derives a deterministic {@link DocumentId} from a validated content hash.
 *
 * @example
 * ```ts
 * import { ContentHash, documentIdFromHash } from "./Models.ts"
 *
 * const id = documentIdFromHash(ContentHash.make("deadbeefcafe1234"))
 * console.log(id) // "doc-deadbeefcafe"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const documentIdFromHash = (hash: ContentHash): DocumentId =>
  DocumentId.make(`doc-${Str.takeLeft(12)(hash)}`);

/**
 * Branded chunk identifier combining a document identifier and canonical index.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChunkId } from "./Models.ts"
 *
 * const isChunkId = S.is(ChunkId)
 * console.log(isChunkId("doc-deadbeefcafe-chunk-0")) // true
 * console.log(isChunkId("doc-deadbeefcafe-chunk-01")) // false
 * ```
 *
 * @invariant Uses a valid document identifier followed by `-chunk-` and a
 * canonical non-negative decimal integer without redundant leading zeros.
 * @category validation
 * @since 0.0.0
 */
export const ChunkId = S.String.check(
  S.isPattern(chunkIdPattern, {
    identifier: $I`ChunkIdPatternCheck`,
    title: "Chunk Identifier",
    description:
      "A document-derived chunk identifier with a canonical non-negative decimal chunk index.",
    message:
      "Chunk ID must use doc-<12-lowercase-hex>-chunk-<canonical-non-negative-index> form.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(chunkIdPattern),
  })
  .pipe(
    S.brand("ChunkId"),
    $I.annoteSchema("ChunkId", {
      description:
        "Deterministic chunk identifier combining a 12-character document fingerprint and canonical chunk index.",
    })
  );

/**
 * Runtime value type decoded by {@link ChunkId}. {@inheritDoc ChunkId}
 *
 * @example
 * ```ts
 * import { ChunkId, type ChunkId as ChunkIdValue } from "./Models.ts"
 *
 * const id: ChunkIdValue = ChunkId.make("doc-deadbeefcafe-chunk-0")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type ChunkId = typeof ChunkId.Type;

/**
 * Document-identifier schema reused for extraction-run correlation.
 *
 * @remarks
 * This is intentionally an alias at the type level rather than a distinct
 * brand: an extraction run and its source document share the same identifier.
 *
 * @example
 * ```ts
 * import { ExtractionRunId } from "./Models.ts"
 *
 * const runId = ExtractionRunId.make("doc-deadbeefcafe")
 * console.log(runId)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ExtractionRunId = DocumentId.annotate({
  toArbitrary: () => () => S.toArbitrary(DocumentId),
}).pipe(
  $I.annoteSchema("ExtractionRunId", {
    description: "Document identifier reused as the correlation identifier for its extraction run.",
  })
);

/**
 * Runtime value type decoded by {@link ExtractionRunId}. {@inheritDoc ExtractionRunId}
 *
 * @example
 * ```ts
 * import { ExtractionRunId, type ExtractionRunId as ExtractionRunIdValue } from "./Models.ts"
 *
 * const runId: ExtractionRunIdValue = ExtractionRunId.make("doc-deadbeefcafe")
 * console.log(runId)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type ExtractionRunId = typeof ExtractionRunId.Type;

/**
 * Branded deterministic batch identifier in `batch-<12-hex>` form.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BatchId } from "./Models.ts"
 *
 * const isBatchId = S.is(BatchId)
 * console.log(isBatchId("batch-deadbeefcafe")) // true
 * console.log(isBatchId("batch-short")) // false
 * ```
 *
 * @invariant Uses the `batch-` prefix followed by exactly 12 lowercase
 * hexadecimal characters.
 * @category validation
 * @since 0.0.0
 */
export const BatchId = S.String.check(
  S.isPattern(batchIdPattern, {
    identifier: $I`BatchIdPatternCheck`,
    title: "Batch Identifier",
    description: "A deterministic batch identifier with a batch- prefix and 12 lowercase hexadecimal characters.",
    message: "Batch ID must use the batch- prefix followed by exactly 12 lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(batchIdPattern),
  })
  .pipe(
    S.brand("BatchId"),
    $I.annoteSchema("BatchId", {
      description: "Deterministic batch identifier represented by a batch- prefix and 12-character fingerprint.",
      documentation:
        "The 48-bit truncated suffix is compact but collision-sensitive; consumers must define collision handling.",
    })
  );

/**
 * Runtime value type decoded by {@link BatchId}. {@inheritDoc BatchId}
 *
 * @example
 * ```ts
 * import { BatchId, type BatchId as BatchIdValue } from "./Models.ts"
 *
 * const id: BatchIdValue = BatchId.make("batch-deadbeefcafe")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type BatchId = typeof BatchId.Type;

/**
 * Constructs a {@link GcsUri} from validated bucket and canonical object path.
 *
 * @example
 * ```ts
 * import { GcsBucket, GcsObject, toGcsUri } from "./Models.ts"
 *
 * const uri = toGcsUri(
 *   GcsBucket.make("beep-ontology-state"),
 *   GcsObject.make("snapshots/ontology-v1.ttl")
 * )
 * console.log(uri) // "gs://beep-ontology-state/snapshots/ontology-v1.ttl"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const toGcsUri: {
  (objectPath: GcsObject): (bucket: GcsBucket) => GcsUri;
  (bucket: GcsBucket, objectPath: GcsObject): GcsUri;
} = dual(2, (bucket: GcsBucket, objectPath: GcsObject): GcsUri =>
  GcsUri.make(`gs://${bucket}/${objectPath}`)
);

const isGcsUri = S.is(GcsUri);

/**
 * Resolves a validated GCS object path or existing URI to a {@link GcsUri}.
 *
 * @remarks
 * Existing URIs are returned unchanged. Canonical object paths are combined
 * with the supplied bucket. Raw external strings must be decoded with
 * {@link GcsUri} or {@link GcsObject} before calling this helper.
 *
 * @example
 * ```ts
 * import { GcsBucket, GcsObject, GcsUri, resolveToGcsUri } from "./Models.ts"
 *
 * const bucket = GcsBucket.make("beep-ontology-state")
 * const existing = GcsUri.make("gs://other-bucket/snapshots/v1.ttl")
 * const objectPath = GcsObject.make("snapshots/v2.ttl")
 *
 * console.log(resolveToGcsUri(existing, bucket)) // existing URI
 * console.log(resolveToGcsUri(objectPath, bucket)) // URI in beep-ontology-state
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const resolveToGcsUri: {
  (bucket: GcsBucket): (storagePath: GcsUri | GcsObject) => GcsUri;
  (storagePath: GcsUri | GcsObject, bucket: GcsBucket): GcsUri;
} = dual(2, (storagePath: GcsUri | GcsObject, bucket: GcsBucket): GcsUri =>
  isGcsUri(storagePath) ? storagePath : toGcsUri(bucket, storagePath)
);
