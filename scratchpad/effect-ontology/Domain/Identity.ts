/**
 * Branded storage identifiers used by the effect-ontology experiment.
 *
 * **Details**
 *
 * The schemas in this module distinguish truncated content fingerprints,
 * ontology versions, document and run identifiers, Google Cloud Storage
 * locations, and their construction helpers at both runtime and compile time.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import type { NonNegativeInt } from "@beep/schema";
import { SchemaUtils, Sha256Hex } from "@beep/schema";
import { Match } from "effect";
import type * as Brand from "effect/Brand";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effect-ontology/Domain/Identity");

const legacyContentHashPrefixPattern = /^[0-9a-f]{16}$/;
const gcsBucketNamePattern = /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;
const gcsIpv4AddressPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$/;
const gcsObjectNamePattern = /^(?!\.{1,2}$)(?!\.well-known\/acme-challenge\/)(?!.*[\r\n])[\s\S]+$/u;
type BrandedGcsBucket = string & Brand.Brand<"GcsBucket">;
type BrandedGcsObject = string & Brand.Brand<"GcsObject">;
type BrandedGcsUri = `gs://${string}/${string}` & Brand.Brand<"GcsUri">;

const utf8Encoder = new TextEncoder();
const isNotGcsIpv4Address = P.not((value: string) => gcsIpv4AddressPattern.test(value));
const isNotGcsReservedPrefix = P.not(Str.startsWith("goog"));
const isNotGcsReservedSpelling = P.every([P.not(Str.includes("google")), P.not(Str.includes("g00gle"))]);
const isGcsBucketArbitraryCandidate = P.every([isNotGcsIpv4Address, isNotGcsReservedPrefix, isNotGcsReservedSpelling]);

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
    description: "Locally decidable Google Cloud Storage bucket-name checks for the portable 3-63 character form.",
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
    SchemaUtils.withCodecStatics,
    $I.annoteSchema("GcsObjectName", {
      description:
        "Google Cloud Storage flat-namespace object name constrained to the provider's general syntax and 1,024-byte UTF-8 limit.",
    })
  );

/**
 * Legacy 16-character prefix of a SHA-256 digest.
 *
 * **Details**
 *
 * * The upstream module treated this 64-bit prefix as content identity. The v4
 * experiment accepts it only at explicit ingress boundaries and never expands
 * it back into a full digest.
 *
 * **Example** (Use LegacyContentHashPrefix)
 * ```ts
 * import { LegacyContentHashPrefix } from "@effect-ontology/Identity"
 *
 * const prefix = LegacyContentHashPrefix.make("e3b0c44298fc1c14")
 * console.log(prefix.length) // 16
 * ```
 *
 * @invariant Exactly 16 lowercase ASCII hexadecimal characters.
 * @category interop
 * @since 0.0.0
 */
export const LegacyContentHashPrefix = S.String.check(
  S.isPattern(legacyContentHashPrefixPattern, {
    identifier: $I`LegacyContentHashPrefixPatternCheck`,
    title: "Legacy Content Hash Prefix",
    description: "A legacy 16-character lowercase hexadecimal prefix of a SHA-256 digest.",
    message: "Legacy content hash prefix must contain exactly 16 lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(legacyContentHashPrefixPattern),
  })
  .pipe(
    S.brand("LegacyContentHashPrefix"),
    $I.annoteSchema("LegacyContentHashPrefix", {
      description:
        "Ingress-only legacy fingerprint containing the first 16 lowercase hexadecimal characters of a SHA-256 digest.",
      documentation: "This value is collision-sensitive and is not canonical content identity.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value decoded by {@link LegacyContentHashPrefix}.
 *
 * **Example** (Use LegacyContentHashPrefix)
 * ```ts
 * import {
 *   LegacyContentHashPrefix,
 *   type LegacyContentHashPrefix as LegacyPrefix
 * } from "@effect-ontology/Identity"
 *
 * const prefix: LegacyPrefix = LegacyContentHashPrefix.make("e3b0c44298fc1c14")
 * console.log(LegacyContentHashPrefix.is(prefix)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LegacyContentHashPrefix = typeof LegacyContentHashPrefix.Type;

/**
 * Canonical full SHA-256 content identity.
 *
 * **Details**
 *
 * * Content identity is deliberately independent from semantic identifiers and
 * storage locations. Use {@link LegacyContentHashPrefix} only for upstream
 * compatibility.
 *
 * **Example** (Use ContentHash)
 * ```ts
 * import { ContentHash } from "@effect-ontology/Identity"
 *
 * const hash = ContentHash.make(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(ContentHash.prefix(hash)) // "e3b0c44298fc1c14"
 * console.log(ContentHash.idFragment(hash)) // "e3b0c44298fc"
 * ```
 *
 * @invariant Exactly 64 lowercase hexadecimal characters representing a
 * complete SHA-256 digest.
 * @category identifiers
 * @since 0.0.0
 */
export const ContentHash = Sha256Hex.annotate({
  toArbitrary: () => S.toArbitrary(Sha256Hex),
}).pipe(
  S.brand("ContentHash"),
  $I.annoteSchema("ContentHash", {
    description: "Canonical content identity represented by a complete lowercase SHA-256 digest.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    prefix: (hash: typeof schema.Type): LegacyContentHashPrefix => LegacyContentHashPrefix.make(Str.takeLeft(16)(hash)),
    idFragment: (hash: typeof schema.Type): string => Str.takeLeft(12)(hash),
  }))
);

/**
 * Runtime value decoded by {@link ContentHash}.
 *
 * **Example** (Use ContentHash)
 * ```ts
 * import { ContentHash, type ContentHash as ContentHashValue } from "@effect-ontology/Identity"
 *
 * const hash: ContentHashValue = ContentHash.make(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(hash.length) // 64
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContentHash = typeof ContentHash.Type;

/**
 * Branded idempotency key represented by a complete lowercase SHA-256 digest.
 *
 * **Details**
 *
 * * This schema validates only the canonical 64-character digest representation.
 * The caller remains responsible for hashing a stable, unambiguous encoding of
 * every input that affects the idempotent operation.
 *
 * The schema inherits its property-based generator from {@link Sha256Hex}.
 *
 * **Example** (Use IdempotencyKey)
 * ```ts
 * import * as S from "effect/Schema"
 * import { IdempotencyKey } from "@effect-ontology/Identity"
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
  toArbitrary: () => S.toArbitrary(Sha256Hex),
}).pipe(
  S.brand("IdempotencyKey"),
  $I.annoteSchema("IdempotencyKey", {
    description:
      "Canonical full-length SHA-256 digest used as an idempotency key after hashing a stable operation description.",
    documentation:
      "The schema validates digest shape only; uniqueness depends on the canonical operation data supplied to the hash.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value type decoded by {@link IdempotencyKey}. {@inheritDoc IdempotencyKey}
 *
 * **Example** (Use IdempotencyKey)
 * ```ts
 * import { IdempotencyKey, type IdempotencyKey as IdempotencyKeyValue } from "@effect-ontology/Identity"
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
 * **Details**
 *
 * * The schema enforces locally decidable GCS naming rules: the allowed lowercase
 * character set, alphanumeric endpoints, the 3-63 character range,
 * non-IPv4 form, the reserved `goog` prefix, and the explicitly documented
 * `google` and `g00gle` spellings.
 *
 * Google also rejects additional close misspellings and requires global name
 * availability. Those provider-maintained checks require a GCS API call and
 * are intentionally outside this pure schema.
 *
 * **Example** (Use GcsBucketEncoded)
 * ```ts
 * import { GcsBucket } from "@effect-ontology/Identity"
 *
 * console.log(GcsBucket.is("beep-ontology-state")) // true
 * console.log(GcsBucket.is("192.168.5.4")) // false
 * console.log(GcsBucket.is("goog-ontology-state")) // false
 * ```
 *
 * @invariant Contains 3-63 permitted characters, begins and ends with an
 * alphanumeric character, and is not a documented reserved form.
 * @see {@link https://cloud.google.com/storage/docs/buckets#naming | Google Cloud Storage bucket naming requirements}
 * @category validation
 * @since 0.0.0
 */
const GcsBucketEncoded = S.String.check(GcsBucketChecks).pipe(S.brand("GcsBucket"), SchemaUtils.withCodecStatics);

const GcsBucketFromSelf = S.declare((input): input is BrandedGcsBucket => GcsBucketEncoded.is(input)).annotate({
  toArbitrary: () => (fc) =>
    fc.stringMatching(gcsBucketNamePattern).filter(isGcsBucketArbitraryCandidate).map(GcsBucketEncoded.make),
});

/**
 * Portable Google Cloud Storage bucket name.
 *
 * **Details**
 *
 * * Enforces every locally decidable provider rule while leaving global
 * availability and provider-maintained close-spelling checks to the GCS API.
 *
 * **Example** (Use GcsBucket)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GcsBucket } from "@effect-ontology/Identity"
 *
 * const bucket = S.decodeUnknownOption(GcsBucket)("beep-ontology-state")
 * console.log(O.exists(bucket, GcsBucket.is)) // true
 * ```
 *
 * @invariant Uses 3-63 permitted lowercase characters, has alphanumeric
 * boundaries, and is neither an IPv4 address nor a documented reserved form.
 * @category validation
 * @since 0.0.0
 */
export const GcsBucket = GcsBucketEncoded.pipe(
  S.decodeTo(GcsBucketFromSelf),
  $I.annoteSchema("GcsBucket", {
    description:
      "Portable 3-63 character Google Cloud Storage bucket name excluding IPv4 addresses and explicitly documented Google-reserved forms.",
    documentation:
      "Provider-side availability and Google's broader close-misspelling policy must still be checked when creating the bucket.",
  }),
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value type decoded by {@link GcsBucket}. {@inheritDoc GcsBucket}
 *
 * **Example** (Use GcsBucket)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GcsBucket, type GcsBucket as GcsBucketValue } from "@effect-ontology/Identity"
 *
 * const bucket = S.decodeUnknownOption(GcsBucket)("beep-ontology-state")
 * console.log(O.map(bucket, (value: GcsBucketValue) => value)) // Some("beep-ontology-state")
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type GcsBucket = typeof GcsBucket.Type;

/**
 * Branded `gs://` URI containing a valid {@link GcsBucket} and GCS object name.
 *
 * **Details**
 *
 * * The object-name component follows flat-namespace rules: 1-1,024 UTF-8 bytes,
 * no carriage-return or line-feed characters, no dot-only names, and no
 * reserved ACME challenge prefix. Hierarchical-namespace segment limits are
 * bucket configuration constraints and are not represented by this schema.
 *
 * **Example** (Use GcsUriEncoded)
 * ```ts
 * import * as S from "effect/Schema"
 * import { GcsUri } from "@effect-ontology/Identity"
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
const GcsUriEncoded = S.TemplateLiteral(["gs://", GcsBucket, "/", GcsObjectName]).pipe(
  S.brand("GcsUri"),
  SchemaUtils.withCodecStatics
);

const GcsUriFromSelf = S.declare((input): input is BrandedGcsUri => GcsUriEncoded.is(input)).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(S.toArbitrary(GcsBucket)(fc), S.toArbitrary(GcsObjectName)(fc))
      .map(([bucket, objectName]) => GcsUriEncoded.make(`gs://${bucket}/${objectName}`)),
});

/**
 * Validated Google Cloud Storage URI.
 *
 * **Details**
 *
 * * Both the bucket and object components are decoded by their own schemas;
 * existence, permissions, and namespace configuration remain provider checks.
 *
 * **Example** (Use GcsUri)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GcsUri } from "@effect-ontology/Identity"
 *
 * const uri = S.decodeUnknownOption(GcsUri)(
 *   "gs://beep-ontology-state/snapshots/ontology-v1.ttl"
 * )
 * console.log(O.exists(uri, GcsUri.is)) // true
 * ```
 *
 * @invariant Uses `gs://<bucket>/<object>` with validated, non-empty
 * components.
 * @category validation
 * @since 0.0.0
 */
export const GcsUri = GcsUriEncoded.pipe(
  S.decodeTo(GcsUriFromSelf),
  $I.annoteSchema("GcsUri", {
    description:
      "Google Cloud Storage URI composed from a validated bucket name and a non-empty flat-namespace object name.",
    documentation:
      "The schema validates URI components locally; bucket existence, permissions, and hierarchical-namespace configuration require GCS.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withStatics((schema) => {
    const fromParts = dual(2, (bucket: GcsBucket, objectPath: GcsObject) =>
      schema.fromUnknown(`gs://${bucket}/${objectPath}`)
    );
    const resolveStoragePath = Match.type<typeof schema.Type | GcsObject>().pipe(
      Match.when(schema.is, (value) => (_bucket: GcsBucket) => value),
      Match.orElse((objectPath) => (bucket: GcsBucket) => fromParts(bucket, objectPath))
    );
    const resolve = dual(2, (storagePath: typeof schema.Type | GcsObject, bucket: GcsBucket) =>
      resolveStoragePath(storagePath)(bucket)
    );

    return { fromParts, resolve };
  })
);

/**
 * Runtime value type decoded by {@link GcsUri}. {@inheritDoc GcsUri}
 *
 * **Example** (Use GcsUri)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GcsUri, type GcsUri as GcsUriValue } from "@effect-ontology/Identity"
 *
 * const uri = S.decodeUnknownOption(GcsUri)(
 *   "gs://beep-ontology-state/snapshots/ontology-v1.ttl"
 * )
 * console.log(O.map(uri, (value: GcsUriValue) => value))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type GcsUri = typeof GcsUri.Type;

const gcsObjectPathPattern = /^[^/](?:[\s\S]*[^/])?$/u;
const gcsObjectArbitraryPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,31})*$/;
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
 * **Details**
 *
 * * This schema narrows the provider-valid object-name space used by
 * {@link GcsUri}. It preserves ordinary slash-separated pseudo-directories but
 * rejects leading, trailing, and consecutive slashes so one logical path has
 * one textual representation.
 *
 * **Example** (Use GcsObjectEncoded)
 * ```ts
 * import { GcsObject } from "@effect-ontology/Identity"
 *
 * console.log(GcsObject.is("snapshots/ontology-v1.ttl")) // true
 * console.log(GcsObject.is("/snapshots/ontology-v1.ttl")) // false
 * console.log(GcsObject.is("a")) // true
 * ```
 *
 * @invariant Is a provider-valid GCS object name with no leading, trailing, or
 * consecutive forward slash.
 * @category validation
 * @since 0.0.0
 */
const GcsObjectEncoded = GcsObjectName.check(GcsObjectChecks).pipe(S.brand("GcsObject"), SchemaUtils.withCodecStatics);

const GcsObjectFromSelf = S.declare((input): input is BrandedGcsObject => GcsObjectEncoded.is(input)).annotate({
  toArbitrary: () => (fc) => fc.stringMatching(gcsObjectArbitraryPattern).map(GcsObjectEncoded.make),
});

/**
 * Canonical slash-separated GCS object path.
 *
 * **Details**
 *
 * * Retains provider-valid object names while removing leading, trailing, and
 * consecutive slashes so each application path has one textual form.
 *
 * **Example** (Use GcsObject)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GcsObject } from "@effect-ontology/Identity"
 *
 * const object = S.decodeUnknownOption(GcsObject)("snapshots/ontology-v1.ttl")
 * console.log(O.exists(object, GcsObject.is)) // true
 * ```
 *
 * @invariant Is provider-valid and contains no empty slash-delimited segment.
 * @category validation
 * @since 0.0.0
 */
export const GcsObject = GcsObjectEncoded.pipe(
  S.decodeTo(GcsObjectFromSelf),
  $I.annoteSchema("GcsObject", {
    description: "Canonical slash-separated GCS object path derived from the provider-valid object-name schema.",
    documentation:
      "Leading, trailing, and consecutive slashes are rejected to prevent multiple textual forms of one application path.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value type decoded by {@link GcsObject}. {@inheritDoc GcsObject}
 *
 * **Example** (Use GcsObject)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GcsObject, type GcsObject as GcsObjectValue } from "@effect-ontology/Identity"
 *
 * const objectPath = S.decodeUnknownOption(GcsObject)(
 *   "snapshots/ontology-v1.ttl"
 * )
 * console.log(O.map(objectPath, (value: GcsObjectValue) => value))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type GcsObject = typeof GcsObject.Type;

/**
 * Branded lowercase ontology namespace identifier.
 *
 * **Example** (Use Namespace)
 * ```ts
 * import { Namespace } from "@effect-ontology/Identity"
 *
 * console.log(Namespace.is("legal-ontology")) // true
 * console.log(Namespace.is("LegalOntology")) // false
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
    }),
    SchemaUtils.withEffectCodecStatics,
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value type decoded by {@link Namespace}. {@inheritDoc Namespace}
 *
 * **Example** (Use Namespace)
 * ```ts
 * import { Namespace, type Namespace as NamespaceValue } from "@effect-ontology/Identity"
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
 * **Example** (Use OntologyName)
 * ```ts
 * import { OntologyName } from "@effect-ontology/Identity"
 *
 * console.log(OntologyName.is("patent_claims-v2")) // true
 * console.log(OntologyName.is("PatentClaims")) // false
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
    }),
    SchemaUtils.withEffectCodecStatics,
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value type decoded by {@link OntologyName}. {@inheritDoc OntologyName}
 *
 * **Example** (Use OntologyName)
 * ```ts
 * import { OntologyName, type OntologyName as OntologyNameValue } from "@effect-ontology/Identity"
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
 * **Details**
 *
 * * The component schemas remain the source of truth: namespace and ontology
 * naming rules come from {@link Namespace} and {@link OntologyName}, while the
 * version fingerprint uses the complete {@link ContentHash}.
 *
 * **Example** (Use OntologyVersion)
 * ```ts
 * import * as S from "effect/Schema"
 * import { OntologyVersion } from "@effect-ontology/Identity"
 *
 * const result = S.decodeUnknownResult(OntologyVersion)(
 *   "legal/patent_claims@e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(result._tag) // "Success"
 * ```
 *
 * @invariant Contains a valid namespace, ontology name, and complete SHA-256
 * content identity separated as `namespace/name@hash`.
 * @category validation
 * @since 0.0.0
 */
export const OntologyVersion = S.TemplateLiteral([Namespace, "/", OntologyName, "@", ContentHash]).pipe(
  S.annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(S.toArbitrary(Namespace)(fc), S.toArbitrary(OntologyName)(fc), S.toArbitrary(ContentHash)(fc))
        .map(([namespace, name, hash]): `${string}/${string}@${string}` => `${namespace}/${name}@${hash}`),
  }),
  S.brand("OntologyVersion"),
  $I.annoteSchema("OntologyVersion", {
    description:
      "Ontology version identifier composed from a namespace, ontology name, and complete SHA-256 content identity.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromParts: (namespace: Namespace, name: OntologyName, hash: ContentHash): typeof schema.Type =>
      schema.make(`${namespace}/${name}@${hash}`),
  }))
);

/**
 * Runtime value type decoded by {@link OntologyVersion}. {@inheritDoc OntologyVersion}
 *
 * **Example** (Use OntologyVersion)
 * ```ts
 * import { OntologyVersion, type OntologyVersion as OntologyVersionValue } from "@effect-ontology/Identity"
 *
 * const version: OntologyVersionValue = OntologyVersion.make(
 *   "legal/patent_claims@e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
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
 * **Details**
 *
 * * The 12-character suffix carries 48 bits from a content digest. Collisions
 * therefore require explicit handling when identifiers span large or
 * adversarial document sets.
 *
 * **Example** (Use DocumentId)
 * ```ts
 * import { DocumentId } from "@effect-ontology/Identity"
 *
 * console.log(DocumentId.is("doc-deadbeefcafe")) // true
 * console.log(DocumentId.is("doc-DEADBEEFCAFE")) // false
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
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type => schema.make(`doc-${Str.takeLeft(12)(hash)}`),
    }))
  );

/**
 * Runtime value type decoded by {@link DocumentId}. {@inheritDoc DocumentId}
 *
 * **Example** (Use DocumentId)
 * ```ts
 * import { DocumentId, type DocumentId as DocumentIdValue } from "@effect-ontology/Identity"
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
 * Branded chunk identifier combining a document identifier and canonical index.
 *
 * **Example** (Use ChunkId)
 * ```ts
 * import { ChunkId } from "@effect-ontology/Identity"
 *
 * console.log(ChunkId.is("doc-deadbeefcafe-chunk-0")) // true
 * console.log(ChunkId.is("doc-deadbeefcafe-chunk-01")) // false
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
    description: "A document-derived chunk identifier with a canonical non-negative decimal chunk index.",
    message: "Chunk ID must use doc-<12-lowercase-hex>-chunk-<canonical-non-negative-index> form.",
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
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromDocument: dual(2, (documentId: DocumentId, index: NonNegativeInt): typeof schema.Type =>
        schema.make(`${documentId}-chunk-${index}`)
      ),
    }))
  );

/**
 * Runtime value type decoded by {@link ChunkId}. {@inheritDoc ChunkId}
 *
 * **Example** (Use ChunkId)
 * ```ts
 * import { ChunkId, type ChunkId as ChunkIdValue } from "@effect-ontology/Identity"
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
 * **Details**
 *
 * * This is intentionally an alias at the type level rather than a distinct
 * brand: an extraction run and its source document share the same identifier.
 *
 * **Example** (Use ExtractionRunId)
 * ```ts
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 *
 * const runId = ExtractionRunId.make("doc-deadbeefcafe")
 * console.log(runId)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ExtractionRunId = DocumentId.annotate({
  toArbitrary: () => S.toArbitrary(DocumentId),
}).pipe(
  $I.annoteSchema("ExtractionRunId", {
    description: "Document identifier reused as the correlation identifier for its extraction run.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value type decoded by {@link ExtractionRunId}. {@inheritDoc ExtractionRunId}
 *
 * **Example** (Use ExtractionRunId)
 * ```ts
 * import { ExtractionRunId, type ExtractionRunId as ExtractionRunIdValue } from "@effect-ontology/Identity"
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
 * **Example** (Use BatchId)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity"
 *
 * console.log(BatchId.is("batch-deadbeefcafe")) // true
 * console.log(BatchId.is("batch-short")) // false
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
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withEffectCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type => schema.make(`batch-${Str.takeLeft(12)(hash)}`),
    }))
  );

/**
 * Runtime value type decoded by {@link BatchId}. {@inheritDoc BatchId}
 *
 * **Example** (Use BatchId)
 * ```ts
 * import { BatchId, type BatchId as BatchIdValue } from "@effect-ontology/Identity"
 *
 * const id: BatchIdValue = BatchId.make("batch-deadbeefcafe")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type BatchId = typeof BatchId.Type;
