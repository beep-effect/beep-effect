/**
 * Persisted research library models, separate from the knowledge vault.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

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
export class LibraryArtifact extends S.Class<LibraryArtifact>($I`LibraryArtifact`)(
  {
    path: S.String,
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/)),
    bytes: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    mediaType: S.String,
    role: S.String,
  },
  $I.annote("LibraryArtifact", { description: "Artifact record for persisted research provenance." })
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
export class LibraryDocument extends S.Class<LibraryDocument>($I`LibraryDocument`)(
  {
    id: S.String,
    originalPath: S.String,
    snapshotPath: S.String,
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/)),
    bytes: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    title: S.String,
    topicDerivation: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    topics: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefault(Effect.succeed([]))
    ),
    reportDate: S.String,
    headingDate: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
    filenameDate: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),

    expectedOccurrences: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("LibraryDocument", { description: "Document record for persisted research provenance." })
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
export class LibraryReference extends S.Class<LibraryReference>($I`LibraryReference`)(
  {
    locator: S.String,
    citationText: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    referenceKey: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    definitionLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    definitionColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    definitionEndLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    definitionEndColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),

    label: S.String,
    form: S.String,
    line: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    column: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
  },
  $I.annote("LibraryReference", { description: "Reference record for persisted research provenance." })
) {}

/**
 * A cited resource version, separate from stable source identity.
 * **Example** (Inspect version validation)
 * ```ts
 * import { LibraryVersion } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryVersion)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryVersion extends S.Class<LibraryVersion>($I`LibraryVersion`)(
  {
    revision: S.String,
    canonicalUrl: S.String,
    locators: S.Array(S.String),
  },
  $I.annote("LibraryVersion", { description: "A cited resource version with its exact locators." })
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
export class LibrarySource extends S.Class<LibrarySource>($I`LibrarySource`)(
  {
    id: S.String,
    kind: LibrarySourceKind,
    canonicalUrl: S.String,
    identity: S.String,
    revision: S.String,
    repository: S.String,
    ownership: LibraryOwnership,
    aliasIds: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefault(Effect.succeed([]))
    ),
    versions: S.Array(LibraryVersion).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefault(Effect.succeed([]))
    ),
    topicDerivation: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    topics: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefault(Effect.succeed([]))
    ),
    locators: S.Array(S.String),
  },
  $I.annote("LibrarySource", { description: "Source record for persisted research provenance." })
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
export class LibraryOccurrence extends S.Class<LibraryOccurrence>($I`LibraryOccurrence`)(
  {
    id: S.String,
    documentId: S.String,
    revision: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
    findingId: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
    context: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),

    sourceId: S.String,
    locator: S.String,
    citationText: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    referenceKey: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    definitionLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    definitionColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    definitionEndLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    definitionEndColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),

    line: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    column: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endLine: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    endColumn: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    label: S.String,
    form: S.String,
  },
  $I.annote("LibraryOccurrence", { description: "Occurrence record for persisted research provenance." })
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
export class LibraryCapture extends S.Class<LibraryCapture>($I`LibraryCapture`)(
  {
    id: S.String,
    sourceId: S.String,
    status: LibraryCaptureStatus,
    method: S.String,
    recordedAt: S.String,
    capturedRevision: S.String,
    requestedRevision: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),

    complete: S.Boolean,
    artifacts: S.Array(LibraryArtifact),
    reason: S.String,
  },
  $I.annote("LibraryCapture", { description: "Capture record for persisted research provenance." })
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
export class LibraryQualification extends S.Class<LibraryQualification>($I`LibraryQualification`)(
  {
    id: S.String,
    adapter: S.String,
    status: LibraryQualificationStatus,
    required: S.Boolean,
    recordedAt: S.String,
    evidence: S.Array(LibraryArtifact),
    reason: S.String,
  },
  $I.annote("LibraryQualification", { description: "Qualification record for persisted research provenance." })
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
export class LibraryIntakeFile extends S.Class<LibraryIntakeFile>($I`LibraryIntakeFile`)(
  {
    originalPath: S.String,
    snapshotPath: S.String,
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/)),
    bytes: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    parseable: S.Boolean,
  },
  $I.annote("LibraryIntakeFile", { description: "Input file census entry including nonparseable files." })
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
export class LibraryIntakeRoot extends S.Class<LibraryIntakeRoot>($I`LibraryIntakeRoot`)(
  { path: S.String, repoCommit: S.String },
  $I.annote("LibraryIntakeRoot", { description: "Exact input root and source repository commit if available." })
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
export class LibraryIntake extends S.Class<LibraryIntake>($I`LibraryIntake`)(
  {
    id: S.String,
    date: S.String,
    createdAt: S.String,
    repoCommit: S.String,
    inputRoots: S.Array(LibraryIntakeRoot),
    manifestPath: S.String,
    files: S.Array(LibraryIntakeFile),
  },
  $I.annote("LibraryIntake", {
    description: "Immutable intake provenance with timestamps, repository commits, roots, and file hashes.",
  })
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
export class LibraryManifest extends S.Class<LibraryManifest>($I`LibraryManifest`)(
  {
    schema: S.Literal("beep.research.library-manifest/v1"),
    createdAt: S.String,
    catalogPath: S.Literal("catalog/library.json"),
    objectRoot: S.Literal("objects/sha256"),
    intakeRoot: S.Literal("intakes"),
  },
  $I.annote("LibraryManifest", { description: "Portable library layout and creation provenance." })
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
export class LibraryCatalog extends S.Class<LibraryCatalog>($I`LibraryCatalog`)(
  {
    schema: S.Literal("beep.research.library/v1"),
    documents: S.Array(LibraryDocument),
    artifacts: S.Array(LibraryArtifact).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefault(Effect.succeed([]))
    ),
    intakes: S.Array(LibraryIntake).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefault(Effect.succeed([]))
    ),
    sources: S.Array(LibrarySource),
    occurrences: S.Array(LibraryOccurrence),
    captures: S.Array(LibraryCapture),
    qualifications: S.Array(LibraryQualification),
  },
  $I.annote("LibraryCatalog", { description: "Catalog record for persisted research provenance." })
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
export class LibraryInventoryOptions extends S.Class<LibraryInventoryOptions>($I`LibraryInventoryOptions`)(
  {
    libraryRoot: S.String,
    inputRoots: S.Array(S.String),
  },
  $I.annote("LibraryInventoryOptions", { description: "InventoryOptions record for persisted research provenance." })
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
export class LibraryAcquireOptions extends S.Class<LibraryAcquireOptions>($I`LibraryAcquireOptions`)(
  {
    sourceIds: S.Array(S.String),
    concurrency: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(8)),
    retryFailed: S.Boolean,
  },
  $I.annote("LibraryAcquireOptions", { description: "AcquireOptions record for persisted research provenance." })
) {}
