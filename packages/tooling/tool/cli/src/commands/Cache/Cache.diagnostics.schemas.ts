/**
 * Bounded installed-dependency drift diagnostics for the hosted producer inspection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.diagnostics.schemas");

/**
 * Fixed, non-sensitive refusal codes a dependency diagnostic may retain.
 *
 * **Details**
 *
 * A refusal never carries paths, messages or payload bytes; only one of these
 * codes reaches the retained report.
 *
 * **Example** (Check a refusal code)
 *
 * ```ts
 * import { CacheDependencyDiagnosticCode } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheDependencyDiagnosticCode.is.deadline("deadline"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CacheDependencyDiagnosticCode = LiteralKit([
  "deadline",
  "subprocess-deadline",
  "archive-read-failed",
  "filesystem-or-process-failed",
  "invalid-value-or-shape",
  "source-not-regular",
  "source-size-bound",
  "source-read-drift",
  "source-version",
  "source-revision",
  "source-revision-mismatch",
  "dependency-format",
  "dependency-digest",
  "dependency-root-not-physical",
  "entry-bound",
  "archive-entry-type",
  "archive-entry-bound",
  "archive-path",
  "archive-path-bound",
  "group-bound",
  "archive-header-bound",
  "file-detail-entry-bound",
  "file-detail-byte-bound",
  "archive-link-bound",
  "archive-stream-bound",
  "archive-command-failed",
  "aggregate-artifact-bound",
]).pipe(
  $I.annoteSchema("CacheDependencyDiagnosticCode", {
    description: "A fixed refusal code retained instead of any exception detail.",
  })
);

/**
 * Runtime type for {@link CacheDependencyDiagnosticCode}.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheDependencyDiagnosticCode = typeof CacheDependencyDiagnosticCode.Type;

/**
 * A diagnostic refusal carrying only its fixed code.
 *
 * **Example** (Refuse with a fixed code)
 *
 * ```ts
 * import { CacheDependencyDiagnosticRefusal } from "@beep/repo-cli/commands/Cache"
 * const refusal = CacheDependencyDiagnosticRefusal.make({ code: "group-bound" })
 * console.assert(refusal.code === "group-bound")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticRefusal extends S.TaggedError<
  CacheDependencyDiagnosticRefusal,
  { readonly brand: unique symbol }
>($I`CacheDependencyDiagnosticRefusal`)(
  "CacheDependencyDiagnosticRefusal",
  { code: CacheDependencyDiagnosticCode },
  $I.annoteError<CacheDependencyDiagnosticRefusal>("CacheDependencyDiagnosticRefusal", {
    description: "A bounded dependency diagnostic refusal identified only by its fixed code.",
  })
) {
  /**
   * Fail with a refusal for the given code.
   *
   * @param code - Fixed refusal code.
   * @returns A failed effect carrying the refusal.
   */
  static readonly fail = (code: CacheDependencyDiagnosticCode) =>
    Effect.fail(CacheDependencyDiagnosticRefusal.make({ code }));
}

/**
 * Resource bounds enforced by one dependency diagnostic.
 *
 * **Example** (Read the default artifact cap)
 *
 * ```ts
 * import { CacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheDependencyDiagnosticLimits.make({}).artifactBytes === 4 * 1024 * 1024)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticLimits extends S.Opaque<
  CacheDependencyDiagnosticLimits,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    artifactBytes: S.Int.pipe(S.withConstructorDefault(Effect.succeed(4 * 1024 * 1024))),
    streamBytes: S.Int.pipe(S.withConstructorDefault(Effect.succeed(6 * 1024 * 1024 * 1024))),
    entries: S.Int.pipe(S.withConstructorDefault(Effect.succeed(600_000))),
    groups: S.Int.pipe(S.withConstructorDefault(Effect.succeed(4096))),
    headerBytes: S.Int.pipe(S.withConstructorDefault(Effect.succeed(64 * 1024))),
    deadlineSeconds: S.Int.pipe(S.withConstructorDefault(Effect.succeed(300))),
    fileDetailEntries: S.Int.pipe(S.withConstructorDefault(Effect.succeed(512))),
    fileDetailBytes: S.Int.pipe(S.withConstructorDefault(Effect.succeed(128 * 1024))),
  }).pipe(
    $I.annoteSchema("CacheDependencyDiagnosticLimits", {
      description:
        "Artifact, archive stream, entry, group, header, deadline and selected file-detail bounds for one diagnostic.",
    })
  )
) {}

/**
 * One package group row: label, entries, files, bytes and four group digests.
 *
 * **Example** (Read the row arity)
 *
 * ```ts
 * import { CacheDependencyDiagnosticGroupRow } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheDependencyDiagnosticGroupRow.elements.length === 8)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CacheDependencyDiagnosticGroupRow = S.Tuple([
  S.String,
  S.Natural,
  S.Natural,
  S.Natural,
  Sha256Hex,
  Sha256Hex,
  Sha256Hex,
  Sha256Hex,
]).pipe(
  $I.annoteSchema("CacheDependencyDiagnosticGroupRow", {
    description: "A redacted package group with entry counts and content, mode, link and header digests.",
  })
);

/**
 * Runtime type for {@link CacheDependencyDiagnosticGroupRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheDependencyDiagnosticGroupRow = typeof CacheDependencyDiagnosticGroupRow.Type;

/**
 * Classification of one selected file by suffix.
 *
 * **Example** (Classify bytecode)
 *
 * ```ts
 * import { CacheDependencyDiagnosticFileKind } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheDependencyDiagnosticFileKind.is["python-bytecode"]("python-bytecode"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CacheDependencyDiagnosticFileKind = LiteralKit(["python-bytecode", "python-source", "other"]).pipe(
  $I.annoteSchema("CacheDependencyDiagnosticFileKind", {
    description: "Suffix class of one selected file in the detailed package group.",
  })
);

/**
 * Runtime type for {@link CacheDependencyDiagnosticFileKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheDependencyDiagnosticFileKind = typeof CacheDependencyDiagnosticFileKind.Type;

/**
 * One selected file row: name digest, kind, byte count and content digest.
 *
 * **Example** (Read the row arity)
 *
 * ```ts
 * import { CacheDependencyDiagnosticFileRow } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheDependencyDiagnosticFileRow.elements.length === 4)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CacheDependencyDiagnosticFileRow = S.Tuple([
  Sha256Hex,
  CacheDependencyDiagnosticFileKind,
  S.Natural,
  Sha256Hex,
]).pipe(
  $I.annoteSchema("CacheDependencyDiagnosticFileRow", {
    description: "A selected file identified by name digest only, with its kind, size and content digest.",
  })
);

/**
 * Runtime type for {@link CacheDependencyDiagnosticFileRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheDependencyDiagnosticFileRow = typeof CacheDependencyDiagnosticFileRow.Type;

/**
 * Per-file hashes for the one package group isolated as the drift source.
 *
 * **Details**
 *
 * These hashes never filter, normalize or replace the canonical tar digest.
 *
 * **Example** (Read the selected group)
 *
 * ```ts
 * import { CacheDependencyDiagnosticFileDetails } from "@beep/repo-cli/commands/Cache"
 * console.assert("rows" in CacheDependencyDiagnosticFileDetails.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticFileDetails extends S.Opaque<
  CacheDependencyDiagnosticFileDetails,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    group: S.tag("node-gyp"),
    columns: S.Tuple([S.tag("nameSha256"), S.tag("kind"), S.tag("bytes"), S.tag("contentSha256")]),
    rows: S.Array(CacheDependencyDiagnosticFileRow),
    entryLimit: S.Natural,
    encodedBytesLimit: S.Natural,
  }).pipe(
    $I.annoteSchema("CacheDependencyDiagnosticFileDetails", {
      description: "Bounded per-file hashes for the selected node-gyp package group.",
    })
  )
) {}

/**
 * One streaming pass over the canonical GNU tar dependency archive.
 *
 * **Example** (Read the pass digest field)
 *
 * ```ts
 * import { CacheDependencyDiagnosticSnapshot } from "@beep/repo-cli/commands/Cache"
 * console.assert("sha256" in CacheDependencyDiagnosticSnapshot.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticSnapshot extends S.Opaque<
  CacheDependencyDiagnosticSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    sha256: Sha256Hex,
    archiveBytes: S.Natural,
    groups: S.Array(CacheDependencyDiagnosticGroupRow),
    fileDetails: S.optionalKey(CacheDependencyDiagnosticFileDetails),
  }).pipe(
    $I.annoteSchema("CacheDependencyDiagnosticSnapshot", {
      description: "The raw archive digest and redacted package groups observed by one archive pass.",
    })
  )
) {}

/**
 * The second pass, reduced to its digest and the groups that differ from the first.
 *
 * **Example** (Read the change count field)
 *
 * ```ts
 * import { CacheDependencyDiagnosticSecondPass } from "@beep/repo-cli/commands/Cache"
 * console.assert("changedCount" in CacheDependencyDiagnosticSecondPass.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticSecondPass extends S.Opaque<
  CacheDependencyDiagnosticSecondPass,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    sha256: Sha256Hex,
    archiveBytes: S.Natural,
    changedGroups: S.Array(S.Tuple([S.String, S.NullOr(CacheDependencyDiagnosticGroupRow)])),
    changedCount: S.Natural,
    omittedChanges: S.Natural,
  }).pipe(
    $I.annoteSchema("CacheDependencyDiagnosticSecondPass", {
      description: "The second archive pass digest plus at most 64 groups that differ from the first pass.",
    })
  )
) {}

/**
 * Bounds recorded alongside a completed diagnostic.
 *
 * **Example** (Read the pass count field)
 *
 * ```ts
 * import { CacheDependencyDiagnosticBounds } from "@beep/repo-cli/commands/Cache"
 * console.assert("passes" in CacheDependencyDiagnosticBounds.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticBounds extends S.Opaque<
  CacheDependencyDiagnosticBounds,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    aggregateArtifactBytes: S.Natural,
    archiveBytesPerPass: S.Natural,
    passes: S.tag(2),
    entriesPerPass: S.Natural,
    groupsPerPass: S.Natural,
    seconds: S.Natural,
    retentionDays: S.tag(1),
  }).pipe(
    $I.annoteSchema("CacheDependencyDiagnosticBounds", {
      description: "The artifact, stream, entry, group and time bounds applied to the diagnostic.",
    })
  )
) {}

/**
 * Outcome of a completed two-pass diagnostic.
 *
 * **Example** (Check the stable outcome)
 *
 * ```ts
 * import { CacheDependencyDiagnosticStatus } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheDependencyDiagnosticStatus.is["stable-match"]("stable-match"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CacheDependencyDiagnosticStatus = LiteralKit(["stable-match", "refused-drift"]).pipe(
  $I.annoteSchema("CacheDependencyDiagnosticStatus", {
    description: "Whether both passes matched each other, the declared digest and the unchanged source report.",
  })
);

/**
 * Runtime type for {@link CacheDependencyDiagnosticStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheDependencyDiagnosticStatus = typeof CacheDependencyDiagnosticStatus.Type;

/**
 * A completed dependency diagnostic. Observation only; never producer approval.
 *
 * **Example** (Read the schema version field)
 *
 * ```ts
 * import { CacheDependencyDiagnosticReport } from "@beep/repo-cli/commands/Cache"
 * console.assert("schemaVersion" in CacheDependencyDiagnosticReport.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticReport extends S.Opaque<
  CacheDependencyDiagnosticReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("cache-dependency-diagnostics/v1"),
    authority: S.tag("Observation only; no producer approval, qualification or digest normalization."),
    revision: GitObjectId,
    sourceReportSha256: Sha256Hex,
    declaredSha256: Sha256Hex,
    status: CacheDependencyDiagnosticStatus,
    sourceUnchanged: S.Boolean,
    declaredDigestMatches: S.Boolean,
    snapshotsEqual: S.Boolean,
    columns: S.Tuple([
      S.tag("package"),
      S.tag("entries"),
      S.tag("files"),
      S.tag("bytes"),
      S.tag("contentSha256"),
      S.tag("modeSha256"),
      S.tag("linksSha256"),
      S.tag("headersSha256"),
    ]),
    first: CacheDependencyDiagnosticSnapshot,
    second: CacheDependencyDiagnosticSecondPass,
    bounds: CacheDependencyDiagnosticBounds,
    elapsedSeconds: S.Finite,
  }).pipe(
    $I.annoteSchema("CacheDependencyDiagnosticReport", {
      description: "Two bounded archive passes compared with each other and with the selected source report.",
    })
  )
) {}

/**
 * A refused diagnostic, retaining only its fixed code.
 *
 * **Example** (Build a refusal report)
 *
 * ```ts
 * import { CacheDependencyDiagnosticRefusalReport } from "@beep/repo-cli/commands/Cache"
 * const report = CacheDependencyDiagnosticRefusalReport.make({ code: "deadline" })
 * console.assert(report.status === "refused")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyDiagnosticRefusalReport extends S.Opaque<
  CacheDependencyDiagnosticRefusalReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("cache-dependency-diagnostics/v1"),
    status: S.tag("refused"),
    code: CacheDependencyDiagnosticCode,
  }).pipe(
    $I.annoteSchema("CacheDependencyDiagnosticRefusalReport", {
      description: "A refused dependency diagnostic carrying only its fixed code.",
    })
  )
) {}

/**
 * Which inspection reports fit the combined publication cap.
 *
 * **Example** (Build a plan)
 *
 * ```ts
 * import { CacheDependencyPublicationPlan } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheDependencyPublicationPlan.make({ source: true, diagnostic: false }).source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyPublicationPlan extends S.Opaque<
  CacheDependencyPublicationPlan,
  { readonly brand: unique symbol }
>()(
  S.Struct({ source: S.Boolean, diagnostic: S.Boolean }).pipe(
    $I.annoteSchema("CacheDependencyPublicationPlan", {
      description: "Readable regular reports selected so their retained bytes fit the aggregate artifact cap.",
    })
  )
) {}
