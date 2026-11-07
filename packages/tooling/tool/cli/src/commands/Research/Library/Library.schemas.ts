/**
 * Persisted research library models, separate from the knowledge vault.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

const $I = $RepoCliId.create("commands/Research/Library/Library.schemas");

/**
 * SourceKind vocabulary for the research library.
 * **Example** (Inspect members)
 * ```ts
 * import { LibrarySourceKind } from "@beep/repo-cli/commands/Research"
 * console.log(LibrarySourceKind.literals.length > 0)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LibrarySourceKind = LiteralKit([
  "paper",
  "github-repository",
  "github-code",
  "github-issue",
  "github-pr",
  "github-release",
  "github-discussion",
  "web",
  "docs",
  "registry",
  "youtube",
  "x",
  "endpoint",
  "internal",
  "unresolved",
]).pipe(
  $I.annoteSchema("LibrarySourceKind", { description: "SourceKind vocabulary for persisted research provenance." })
);
/**
 * Runtime type of LibrarySourceKind.
 *
 * @category models
 * @since 0.0.0
 */
export type LibrarySourceKind = typeof LibrarySourceKind.Type;

/**
 * Ownership vocabulary for the research library.
 * **Example** (Inspect members)
 * ```ts
 * import { LibraryOwnership } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryOwnership.literals.length > 0)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LibraryOwnership = LiteralKit(["external", "project", "internal", "unresolved"]).pipe(
  $I.annoteSchema("LibraryOwnership", { description: "Ownership vocabulary for persisted research provenance." })
);
/**
 * Runtime type of LibraryOwnership.
 *
 * @category models
 * @since 0.0.0
 */
export type LibraryOwnership = typeof LibraryOwnership.Type;

/**
 * CaptureStatus vocabulary for the research library.
 * **Example** (Inspect members)
 * ```ts
 * import { LibraryCaptureStatus } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryCaptureStatus.literals.length > 0)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LibraryCaptureStatus = LiteralKit([
  "running",
  "interrupted",
  "readable",
  "blocked",
  "failed",
  "unsupported",
  "unavailable",
  "non-reference",
]).pipe(
  $I.annoteSchema("LibraryCaptureStatus", {
    description: "CaptureStatus vocabulary for persisted research provenance.",
  })
);
/**
 * Runtime type of LibraryCaptureStatus.
 *
 * @category models
 * @since 0.0.0
 */
export type LibraryCaptureStatus = typeof LibraryCaptureStatus.Type;

/**
 * QualificationStatus vocabulary for the research library.
 * **Example** (Inspect members)
 * ```ts
 * import { LibraryQualificationStatus } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryQualificationStatus.literals.length > 0)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LibraryQualificationStatus = LiteralKit(["verified", "failed"]).pipe(
  $I.annoteSchema("LibraryQualificationStatus", {
    description: "QualificationStatus vocabulary for persisted research provenance.",
  })
);
/**
 * Runtime type of LibraryQualificationStatus.
 *
 * @category models
 * @since 0.0.0
 */
export type LibraryQualificationStatus = typeof LibraryQualificationStatus.Type;

/**
 * Visibility partition of a source or artifact.
 *
 * **Example** (Inspect LibraryAccessClass)
 * ```ts
 * import { LibraryAccessClass } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryAccessClass.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryAccessClass = LiteralKit(["public", "private"]).pipe(
  $I.annoteSchema("LibraryAccessClass", { description: "Visibility partition of a source or artifact." })
);
/**
 * Runtime values of LibraryAccessClass.
 * @category models
 * @since 0.0.0
 */
export type LibraryAccessClass = typeof LibraryAccessClass.Type;

const isPublicAccess = (value: LibraryAccessClass): boolean => value === LibraryAccessClass.Enum.public;
const publicAccess: Effect.Effect<LibraryAccessClass> = Effect.succeed(LibraryAccessClass.Enum.public);

/**
 * Access-class field that defaults to `public` and omits the key when encoding `public`.
 *
 * **Details**
 *
 * Records persisted before the partition existed carry no `accessClass` key. Correction
 * receipts bind SHA-256 hashes of those encoded records, so a re-encoded legacy record must
 * stay byte-identical: the default value is never written, while `private` always is.
 *
 * **Example** (Decode a legacy record without an access class)
 * ```ts
 * import { LibraryAccessClassField } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * const Row = S.Struct({ accessClass: LibraryAccessClassField })
 * console.log(S.decodeUnknownSync(Row)({}).accessClass) // "public"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LibraryAccessClassField = LibraryAccessClass.pipe(
  S.toEncoded,
  S.optionalKey,
  S.decodeTo(LibraryAccessClass, {
    decode: SchemaGetter.withDefault(publicAccess),
    encode: SchemaGetter.transformOptional(O.filter(P.not(isPublicAccess))),
  }),
  S.withConstructorDefault(publicAccess)
);

/**
 * Supported persisted catalog contract versions.
 *
 * **Example** (Inspect LibraryCatalogSchemaVersion)
 * ```ts
 * import { LibraryCatalogSchemaVersion } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryCatalogSchemaVersion.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryCatalogSchemaVersion = LiteralKit(["beep.research.library/v1", "beep.research.library/v2"]).pipe(
  $I.annoteSchema("LibraryCatalogSchemaVersion", { description: "Supported persisted catalog contract versions." })
);
/**
 * Runtime values of LibraryCatalogSchemaVersion.
 * @category models
 * @since 0.0.0
 */
export type LibraryCatalogSchemaVersion = typeof LibraryCatalogSchemaVersion.Type;

/**
 * CiTO relation local names attached to a finding.
 *
 * **Example** (Inspect LibraryCitoRelation)
 * ```ts
 * import { LibraryCitoRelation } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryCitoRelation.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryCitoRelation = LiteralKit([
  "citesAsEvidence",
  "citesAsRelated",
  "extends",
  "usesMethodIn",
  "usesDataFrom",
  "critiques",
  "supports",
  "disputes",
  "discusses",
]).pipe($I.annoteSchema("LibraryCitoRelation", { description: "CiTO relation local names attached to a finding." }));
/**
 * Runtime values of LibraryCitoRelation.
 * @category models
 * @since 0.0.0
 */
export type LibraryCitoRelation = typeof LibraryCitoRelation.Type;

const topicFields = {
  topicDerivation: S.String.pipe(
    S.withConstructorDefault(Effect.succeed("")),
    S.withDecodingDefaultKey(Effect.succeed(""))
  ),
  topics: S.Array(S.String).pipe(
    S.withConstructorDefault(Effect.succeed([])),
    S.withDecodingDefaultKey(Effect.succeed([]))
  ),
};

/**
 * Artifact record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryArtifact } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryArtifact)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryArtifact extends S.Opaque<LibraryArtifact, { readonly brand: unique symbol }>()(
  S.Struct({
    accessClass: LibraryAccessClassField,
    path: S.String,
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/)),
    bytes: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    mediaType: S.String,
    role: S.String,
  })
    .pipe($I.annoteSchema("LibraryArtifact", { description: "Artifact record for persisted research provenance." }))
    .annotate($I.class("Artifact", { description: "Artifact record for persisted research provenance." }))
) {}

/**
 * Document record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryDocument } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryDocument)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryDocument extends S.Opaque<LibraryDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    accessClass: LibraryAccessClassField,
    originalPath: S.String,
    snapshotPath: S.String,
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/)),
    bytes: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    title: S.String.pipe($I.key("dcterms:title")),
    ...topicFields,
    reportDate: S.String,
    headingDate: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    filenameDate: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),

    expectedOccurrences: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
  })
    .pipe($I.annoteSchema("LibraryDocument", { description: "Document record for persisted research provenance." }))
    .annotate($I.class("Report", { description: "Document record for persisted research provenance." }))
) {}

/**
 * Reference record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryReference } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryReference)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryReference extends S.Opaque<LibraryReference, { readonly brand: unique symbol }>()(
  S.Struct({
    locator: S.String,
    citationText: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    referenceKey: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    definitionLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    definitionColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    definitionEndLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    definitionEndColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),

    label: S.String,
    form: S.String,
    line: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    column: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
  })
    .pipe($I.annoteSchema("LibraryReference", { description: "Reference record for persisted research provenance." }))
    .annotate($I.class("Reference", { description: "Reference record for persisted research provenance." }))
) {}

/**
 * A cited resource version, separate from stable source identity.
 * **Example** (Inspect version validation)
 * ```ts
 * import { LibrarySourceVersion } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibrarySourceVersion)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibrarySourceVersion extends S.Opaque<LibrarySourceVersion, { readonly brand: unique symbol }>()(
  S.Struct({
    revision: S.String,
    canonicalUrl: S.String,
    locators: S.Array(S.String),
  })
    .pipe($I.annoteSchema("LibrarySourceVersion", { description: "A cited resource version with its exact locators." }))
    .annotate($I.class("SourceVersion", { description: "A cited resource version with its exact locators." }))
) {}

/**
 * Source record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibrarySource } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibrarySource)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibrarySource extends S.Opaque<LibrarySource, { readonly brand: unique symbol }>()(
  S.Struct({
    accessClass: LibraryAccessClassField,
    id: S.String,
    kind: LibrarySourceKind,
    canonicalUrl: S.String,
    identity: S.String,
    revision: S.String,
    repository: S.String,
    ownership: LibraryOwnership,
    aliasIds: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    versions: S.Array(LibrarySourceVersion).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    ...topicFields,
    locators: S.Array(S.String),
  })
    .pipe($I.annoteSchema("LibrarySource", { description: "Source record for persisted research provenance." }))
    .annotate($I.class("Source", { description: "Source record for persisted research provenance." }))
) {}

/**
 * Occurrence record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryOccurrence } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryOccurrence)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryOccurrence extends S.Opaque<LibraryOccurrence, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    documentId: S.String,
    revision: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),
    findingId: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    context: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),

    sourceId: S.String,
    locator: S.String,
    citationText: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    referenceKey: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    definitionLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    definitionColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    definitionEndLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    definitionEndColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),

    line: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    column: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    label: S.String,
    form: S.String,
  })
    .pipe($I.annoteSchema("LibraryOccurrence", { description: "Occurrence record for persisted research provenance." }))
    .annotate($I.class("Occurrence", { description: "Occurrence record for persisted research provenance." }))
) {}

/**
 * Capture record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryCapture } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryCapture)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryCapture extends S.Opaque<LibraryCapture, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    sourceId: S.String,
    status: LibraryCaptureStatus,
    method: S.String,
    recordedAt: S.String.pipe($I.key("dcterms:created")),
    capturedRevision: S.String,
    requestedRevision: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),

    complete: S.Boolean,
    artifacts: S.Array(LibraryArtifact),
    reason: S.String,
  })
    .pipe($I.annoteSchema("LibraryCapture", { description: "Capture record for persisted research provenance." }))
    .annotate($I.class("Capture", { description: "Capture record for persisted research provenance." }))
) {}

/**
 * Qualification record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryQualification } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryQualification)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryQualification extends S.Opaque<LibraryQualification, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    adapter: S.String,
    status: LibraryQualificationStatus,
    required: S.Boolean,
    recordedAt: S.String.pipe($I.key("dcterms:created")),
    evidence: S.Array(LibraryArtifact),
    reason: S.String,
  })
    .pipe(
      $I.annoteSchema("LibraryQualification", {
        description: "Qualification record for persisted research provenance.",
      })
    )
    .annotate($I.class("Qualification", { description: "Qualification record for persisted research provenance." }))
) {}

/**
 * An input file in an immutable dated intake census.
 * **Example** (Inspect file validation)
 * ```ts
 * import { LibraryIntakeFile } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryIntakeFile)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryIntakeFile extends S.Opaque<LibraryIntakeFile, { readonly brand: unique symbol }>()(
  S.Struct({
    originalPath: S.String,
    snapshotPath: S.String,
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/)),
    bytes: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    parseable: S.Boolean,
  })
    .pipe(
      $I.annoteSchema("LibraryIntakeFile", { description: "Input file census entry including nonparseable files." })
    )
    .annotate($I.class("IntakeFile", { description: "Input file census entry including nonparseable files." }))
) {}
/**
 * Repository provenance for one intake root.
 * **Example** (Inspect root validation)
 * ```ts
 * import { LibraryIntakeRoot } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryIntakeRoot)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryIntakeRoot extends S.Opaque<LibraryIntakeRoot, { readonly brand: unique symbol }>()(
  S.Struct({ path: S.String, repoCommit: S.String })
    .pipe(
      $I.annoteSchema("LibraryIntakeRoot", {
        description: "Exact input root and source repository commit if available.",
      })
    )
    .annotate($I.class("IntakeRoot", { description: "Exact input root and source repository commit if available." }))
) {}
/**
 * Immutable dated intake manifest.
 * **Example** (Inspect intake validation)
 * ```ts
 * import { LibraryIntake } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryIntake)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryIntake extends S.Opaque<LibraryIntake, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    date: S.String,
    createdAt: S.String.pipe($I.key("dcterms:created")),
    repoCommit: S.String,
    inputRoots: S.Array(LibraryIntakeRoot),
    manifestPath: S.String,
    files: S.Array(LibraryIntakeFile),
  })
    .pipe(
      $I.annoteSchema("LibraryIntake", {
        description: "Immutable intake provenance with timestamps, repository commits, roots, and file hashes.",
      })
    )
    .annotate(
      $I.class("Intake", {
        description: "Immutable intake provenance with timestamps, repository commits, roots, and file hashes.",
      })
    )
) {}

/**
 * Root metadata for a portable reusable library.
 * **Example** (Inspect manifest validation)
 * ```ts
 * import { LibraryManifest } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryManifest)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryManifest extends S.Opaque<LibraryManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    schema: S.tag("beep.research.library-manifest/v1"),
    createdAt: S.String.pipe($I.key("dcterms:created")),
    catalogPath: S.tag("catalog/library.json"),
    objectRoot: S.tag("objects/sha256"),
    intakeRoot: S.tag("intakes"),
  })
    .pipe($I.annoteSchema("LibraryManifest", { description: "Portable library layout and creation provenance." }))
    .annotate($I.class("Manifest", { description: "Portable library layout and creation provenance." }))
) {}

/**
 * A source-bound finding with citation semantics and model provenance.
 *
 * **Example** (Inspect LibraryFinding)
 * ```ts
 * import { LibraryFinding } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryFinding)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryFinding extends S.Opaque<LibraryFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    sourceId: S.String,
    occurrenceId: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    captureId: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    citoRelation: LibraryCitoRelation,
    span: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),
    summary: S.String,
    topicIds: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    modelRunId: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    recordedAt: S.String.pipe($I.key("dcterms:created")),
  })
    .pipe(
      $I.annoteSchema("LibraryFinding", {
        description: "A source-bound finding with citation semantics and model provenance.",
      })
    )
    .annotate(
      $I.class("Finding", { description: "A source-bound finding with citation semantics and model provenance." })
    )
) {}

/**
 * A derivation edge carrying its non-negative traversal depth.
 *
 * **Example** (Inspect LibraryDerivation)
 * ```ts
 * import { LibraryDerivation } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryDerivation)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryDerivation extends S.Opaque<LibraryDerivation, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    derivedId: S.String,
    sourceId: S.String,
    intakeId: S.String,
    rootId: S.String,
    hopDepth: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    recordedAt: S.String.pipe($I.key("dcterms:created")),
  })
    .pipe(
      $I.annoteSchema("LibraryDerivation", {
        description: "A derivation edge carrying its non-negative traversal depth from a hop-0 intake anchor.",
      })
    )
    .annotate(
      $I.class("Derivation", {
        description: "A derivation edge carrying its non-negative traversal depth from a hop-0 intake anchor.",
      })
    )
) {}

/**
 * Model execution provenance for recorded findings.
 *
 * **Example** (Inspect LibraryModelRun)
 * ```ts
 * import { LibraryModelRun } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryModelRun)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryModelRun extends S.Opaque<LibraryModelRun, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    model: S.String,
    effort: S.String,
    route: S.String,
    startedAt: S.String,
  })
    .pipe($I.annoteSchema("LibraryModelRun", { description: "Model execution provenance for recorded findings." }))
    .annotate($I.class("ModelRun", { description: "Model execution provenance for recorded findings." }))
) {}

/**
 * Catalog record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryCatalog } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryCatalog)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryCatalog extends S.Opaque<LibraryCatalog, { readonly brand: unique symbol }>()(
  S.Struct({
    schema: LibraryCatalogSchemaVersion,
    findings: S.Array(LibraryFinding).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    derivations: S.Array(LibraryDerivation).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    modelRuns: S.Array(LibraryModelRun).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),

    documents: S.Array(LibraryDocument),
    artifacts: S.Array(LibraryArtifact).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    intakes: S.Array(LibraryIntake).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    sources: S.Array(LibrarySource),
    occurrences: S.Array(LibraryOccurrence),
    captures: S.Array(LibraryCapture),
    qualifications: S.Array(LibraryQualification),
  })
    .pipe($I.annoteSchema("LibraryCatalog", { description: "Catalog record for persisted research provenance." }))
    .annotate($I.class("Catalog", { description: "Catalog record for persisted research provenance." }))
) {}

/**
 * InventoryOptions record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryInventoryOptions } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryInventoryOptions)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryInventoryOptions extends S.Opaque<LibraryInventoryOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    libraryRoot: S.String,
    inputRoots: S.Array(S.String),
  })
    .pipe(
      $I.annoteSchema("LibraryInventoryOptions", {
        description: "InventoryOptions record for persisted research provenance.",
      })
    )
    .annotate(
      $I.class("InventoryOptions", {
        description: "InventoryOptions record for persisted research provenance.",
      })
    )
) {}

/**
 * AcquireOptions record for persisted research provenance.
 * **Example** (Inspect model)
 * ```ts
 * import { LibraryAcquireOptions } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryAcquireOptions)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryAcquireOptions extends S.Opaque<LibraryAcquireOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceIds: S.Array(S.String),
    concurrency: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(8)),
    retryFailed: S.Boolean,
  })
    .pipe(
      $I.annoteSchema("LibraryAcquireOptions", {
        description: "AcquireOptions record for persisted research provenance.",
      })
    )
    .annotate(
      $I.class("AcquireOptions", {
        description: "AcquireOptions record for persisted research provenance.",
      })
    )
) {}

/**
 * Version of the research library validation shapes contract.
 *
 * **Example** (Inspect LIBRARY_VALIDATOR_CONTRACT)
 * ```ts
 * import { LIBRARY_VALIDATOR_CONTRACT } from "@beep/repo-cli/commands/Research"
 * console.log(LIBRARY_VALIDATOR_CONTRACT)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LIBRARY_VALIDATOR_CONTRACT = "research-library-shapes/1";

/**
 * Hash-bound receipt for an index-preserving catalog contract migration.
 * **Example** (Inspect receipt fields)
 * ```ts
 * import { LibraryMigrationReceipt } from "@beep/repo-cli/commands/Research/Library/Library.schemas"
 * console.log(LibraryMigrationReceipt.fields.validatorContract)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibraryMigrationReceipt extends S.Opaque<LibraryMigrationReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    validatorContract: S.tag(LIBRARY_VALIDATOR_CONTRACT),
    fromSchema: LibraryCatalogSchemaVersion,
    toSchema: S.tag("beep.research.library/v2"),
    beforeCatalogSha256: LibraryArtifact.fields.sha256,
    afterCatalogSha256: LibraryArtifact.fields.sha256,
    indexMdSha256: LibraryArtifact.fields.sha256,
    intakeIds: S.Array(S.String),
    shaclViolations: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    recordedAt: S.String,
  })
    .pipe(
      $I.annoteSchema("LibraryMigrationReceipt", {
        description: "Index-preserving v2 migration hashes and validator evidence.",
      })
    )
    .annotate($I.class("MigrationReceipt", { description: "Recorded catalog contract transition." }))
) {}
