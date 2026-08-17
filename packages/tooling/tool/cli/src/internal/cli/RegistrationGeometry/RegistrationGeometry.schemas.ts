/**
 * Schema-first contracts for package registration geometry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Glob } from "@beep/schema/Glob";
import { PosixPath } from "@beep/schema/PosixPath";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/RegistrationGeometry");

export const RegistrationSurfaceKind = LiteralKit([
  "owned-tree",
  "workspace-literal",
  "identity-segment",
  "derived-rebuild",
  "generated-inventory",
  "authored-reference",
  "pending-changeset",
  "runtime-artifact",
  "data-resource",
  "historical-record",
]).pipe(
  $I.annoteSchema("RegistrationSurfaceKind", {
    description: "Closed kinds of package-lifecycle registration surfaces.",
  })
);
export type RegistrationSurfaceKind = typeof RegistrationSurfaceKind.Type;

export const RegistrationWriter = LiteralKit([
  "create-package",
  "identity-sync",
  "tsconfig-sync",
  "install",
  "fallow-boundaries",
  "jsdoc-inventory",
  "schema-first-inventory",
  "schema-catalog",
  "coverage-baseline-replacement",
  "test-typecheck-baseline",
  "knip-baseline",
  "docs-aggregate-clean",
  "operator-authored",
  "preserve-only",
]).pipe(
  $I.annoteSchema("RegistrationWriter", {
    description: "Named writer or preservation policy that owns a registration surface.",
  })
);
export type RegistrationWriter = typeof RegistrationWriter.Type;

export class OwnedTreeSurface extends S.Class<OwnedTreeSurface>($I`OwnedTreeSurface`)(
  {
    kind: S.tag("owned-tree"),
    id: S.NonEmptyString,
    root: PosixPath,
    artifacts: S.Array(Glob),
  },
  $I.annote("OwnedTreeSurface", {
    description: "A target-owned directory whose tracked and ignored contents share its lifecycle.",
  })
) {}

export class WorkspaceLiteralSurface extends S.Class<WorkspaceLiteralSurface>($I`WorkspaceLiteralSurface`)(
  {
    kind: S.tag("workspace-literal"),
    id: S.NonEmptyString,
    file: PosixPath,
    workspacePath: PosixPath,
  },
  $I.annote("WorkspaceLiteralSurface", {
    description: "An exact workspace-array member removed only when it is not a covering glob.",
  })
) {}

export class IdentitySegmentSurface extends S.Class<IdentitySegmentSurface>($I`IdentitySegmentSurface`)(
  {
    kind: S.tag("identity-segment"),
    id: S.NonEmptyString,
    registryFile: PosixPath,
    packageName: S.NonEmptyString,
    slug: S.NonEmptyString,
    accessor: S.NonEmptyString,
    generatedGroup: S.OptionFromOptionalKey(S.NonEmptyString),
  },
  $I.annote("IdentitySegmentSurface", {
    description: "A package identity compose argument and its exported composer accessor.",
  })
) {}

export class DerivedRebuildSurface extends S.Class<DerivedRebuildSurface>($I`DerivedRebuildSurface`)(
  {
    kind: S.tag("derived-rebuild"),
    id: S.NonEmptyString,
    writer: RegistrationWriter,
    outputs: S.Array(PosixPath),
  },
  $I.annote("DerivedRebuildSurface", {
    description: "Committed outputs replaced by a named reconstructive writer.",
  })
) {}

export class GeneratedInventorySurface extends S.Class<GeneratedInventorySurface>($I`GeneratedInventorySurface`)(
  {
    kind: S.tag("generated-inventory"),
    id: S.NonEmptyString,
    writer: RegistrationWriter,
    outputs: S.Array(PosixPath),
    membershipKey: S.NonEmptyString,
  },
  $I.annote("GeneratedInventorySurface", {
    description: "A writer-owned inventory whose target membership is derivable and probeable.",
  })
) {}

export class AuthoredReferenceSurface extends S.Class<AuthoredReferenceSurface>($I`AuthoredReferenceSurface`)(
  {
    kind: S.tag("authored-reference"),
    id: S.NonEmptyString,
    files: S.Array(Glob),
    needles: S.Array(S.NonEmptyString),
  },
  $I.annote("AuthoredReferenceSurface", {
    description: "An explicit target reference requiring a modeled edit or operator review.",
  })
) {}

export const DeletionNotePolicy = LiteralKit(["emit-empty-note", "labs-exempt"]).pipe(
  $I.annoteSchema("DeletionNotePolicy", {
    description:
      "Whether deleting this package emits the canonical `{}` deletion changeset or is ceremony-exempt by labs path.",
  })
);
export type DeletionNotePolicy = typeof DeletionNotePolicy.Type;

export class PendingChangesetSurface extends S.Class<PendingChangesetSurface>($I`PendingChangesetSurface`)(
  {
    kind: S.tag("pending-changeset"),
    id: S.NonEmptyString,
    changesetGlob: Glob,
    retiredRegistry: PosixPath,
    packageName: S.NonEmptyString,
    deletionNotePolicy: DeletionNotePolicy,
  },
  $I.annote("PendingChangesetSurface", {
    description: "Pending changeset keys and retired-name policy for one package name.",
  })
) {}

export class RuntimeArtifactSurface extends S.Class<RuntimeArtifactSurface>($I`RuntimeArtifactSurface`)(
  {
    kind: S.tag("runtime-artifact"),
    id: S.NonEmptyString,
    globs: S.Array(Glob),
  },
  $I.annote("RuntimeArtifactSurface", {
    description: "Ignored or local artifacts that must be absent after deletion.",
  })
) {}

export class DataResourceSurface extends S.Class<DataResourceSurface>($I`DataResourceSurface`)(
  {
    kind: S.tag("data-resource"),
    id: S.NonEmptyString,
    owner: S.NonEmptyString,
    resourceName: S.NonEmptyString,
    localOnly: S.Boolean,
    destructiveConsentFlag: S.NonEmptyString,
  },
  $I.annote("DataResourceSurface", {
    description: "Manifest-owned destructive state requiring ownership proof and explicit consent.",
  })
) {}

export class HistoricalRecordSurface extends S.Class<HistoricalRecordSurface>($I`HistoricalRecordSurface`)(
  {
    kind: S.tag("historical-record"),
    id: S.NonEmptyString,
    files: S.Array(Glob),
    needles: S.Array(S.NonEmptyString),
  },
  $I.annote("HistoricalRecordSurface", {
    description: "Historical evidence classified and preserved rather than pruned.",
  })
) {}

export const RegistrationSurface = RegistrationSurfaceKind.mapMembers(
  Tuple.evolve([
    () => OwnedTreeSurface,
    () => WorkspaceLiteralSurface,
    () => IdentitySegmentSurface,
    () => DerivedRebuildSurface,
    () => GeneratedInventorySurface,
    () => AuthoredReferenceSurface,
    () => PendingChangesetSurface,
    () => RuntimeArtifactSurface,
    () => DataResourceSurface,
    () => HistoricalRecordSurface,
  ])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("RegistrationSurface", {
    description: "One declared registration surface interpreted by create, delete, and doctor.",
  })
);
export type RegistrationSurface = typeof RegistrationSurface.Type;

export class LabTargetFacts extends S.Class<LabTargetFacts>($I`LabTargetFacts`)(
  {
    manifestFile: PosixPath,
    postgresSchema: S.OptionFromOptionalKey(S.NonEmptyString),
    localOnly: S.Boolean,
  },
  $I.annote("LabTargetFacts", {
    description: "Decoded lab-manifest facts (manifest path, optional Postgres schema, locality) for a labs target.",
  })
) {}

export class RegistrationTarget extends S.Class<RegistrationTarget>($I`RegistrationTarget`)(
  {
    packageName: S.NonEmptyString,
    packagePath: PosixPath,
    private: S.Boolean,
    lab: S.OptionFromOptionalKey(LabTargetFacts).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("RegistrationTarget", {
    description: "Resolved workspace identity used to instantiate registration geometry.",
  })
) {}

export const RegistrationOperationKind = LiteralKit(["write", "remove", "rebuild", "preserve", "require-consent"]).pipe(
  $I.annoteSchema("RegistrationOperationKind", {
    description: "Closed operation kinds emitted by a registration plan.",
  })
);
export type RegistrationOperationKind = typeof RegistrationOperationKind.Type;

export class RegistrationOperation extends S.Class<RegistrationOperation>($I`RegistrationOperation`)(
  {
    surfaceId: S.NonEmptyString,
    operation: RegistrationOperationKind,
    detail: S.NonEmptyString,
  },
  $I.annote("RegistrationOperation", {
    description: "One deterministic forward or inverse operation derived from a surface.",
  })
) {}

export class RegistrationPlan extends S.Class<RegistrationPlan>($I`RegistrationPlan`)(
  {
    version: S.Literal("registration-plan/v1"),
    target: RegistrationTarget,
    operations: S.Array(RegistrationOperation),
  },
  $I.annote("RegistrationPlan", {
    description: "Serializable package registration plan produced before any mutation.",
  })
) {}

export const RegistrationObservationStatus = LiteralKit([
  "clean",
  "missing",
  "residue",
  "drift",
  "historical",
  "consent-required",
]).pipe(
  $I.annoteSchema("RegistrationObservationStatus", {
    description: "Doctor status for one declared surface.",
  })
);
export type RegistrationObservationStatus = typeof RegistrationObservationStatus.Type;

export class RegistrationObservation extends S.Class<RegistrationObservation>($I`RegistrationObservation`)(
  {
    surfaceId: S.NonEmptyString,
    status: RegistrationObservationStatus,
    evidence: S.Array(S.NonEmptyString),
  },
  $I.annote("RegistrationObservation", {
    description: "Declared-versus-actual result for one registration surface.",
  })
) {}

export const DependentHitKind = LiteralKit([
  "manifest-prod",
  "manifest-dev",
  "manifest-peer",
  "manifest-optional",
  "import-prod",
  "import-test",
  "script",
  "file-path",
  "packet",
  "baseline",
  "historical-doc",
]).pipe(
  $I.annoteSchema("DependentHitKind", {
    description: "Classification of one reverse-dependency or residue hit.",
  })
);
export type DependentHitKind = typeof DependentHitKind.Type;

export class DependentHit extends S.Class<DependentHit>($I`DependentHit`)(
  {
    kind: DependentHitKind,
    owner: S.NonEmptyString,
    file: PosixPath,
    line: S.OptionFromOptionalKey(S.Int),
    direct: S.Boolean,
  },
  $I.annote("DependentHit", {
    description: "One classified manifest, import, path, packet, baseline, or historical hit.",
  })
) {}

export class DependentsReport extends S.Class<DependentsReport>($I`DependentsReport`)(
  {
    target: RegistrationTarget,
    directWorkspaceDependents: S.Array(S.NonEmptyString),
    transitiveWorkspaceDependents: S.Array(S.NonEmptyString),
    hits: S.Array(DependentHit),
  },
  $I.annote("DependentsReport", {
    description: "Deterministic reverse-dependency closure plus import and authored-reference evidence.",
  })
) {}
