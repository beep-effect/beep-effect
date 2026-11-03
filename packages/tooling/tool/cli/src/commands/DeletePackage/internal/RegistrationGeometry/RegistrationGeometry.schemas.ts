/**
 * Schema-first contracts for package registration geometry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GlobString } from "@beep/glob/GlobString";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $RepoCliId.create("commands/DeletePackage/internal/RegistrationGeometry");

/**
 * Closed set of surface kinds a package registration can occupy, from the
 * owned source tree to preserved historical records.
 *
 * **Details**
 *
 * Each member selects one variant of {@link RegistrationSurface} through
 * `mapMembers`, so adding a kind requires adding its surface schema.
 *
 * **Example** (Check a surface kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistrationSurfaceKind } from "@beep/repo-cli/test/DeletePackage"
 *
 * console.log(S.is(RegistrationSurfaceKind)("owned-tree")) // true
 * console.log(S.is(RegistrationSurfaceKind)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
/**
 * Decoded literal union of the registration surface kinds.
 *
 * @category models
 * @since 0.0.0
 */
export type RegistrationSurfaceKind = typeof RegistrationSurfaceKind.Type;

/**
 * Closed set of writers that own a registration surface, including the
 * `operator-authored` and `preserve-only` policies that no command rewrites.
 *
 * **Example** (Check a writer name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistrationWriter } from "@beep/repo-cli/test/DeletePackage"
 *
 * console.log(S.is(RegistrationWriter)("identity-sync")) // true
 * console.log(S.is(RegistrationWriter)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RegistrationWriter = LiteralKit([
  "create-package",
  "identity-sync",
  "tsconfig-sync",
  "install",
  "fallow-boundaries",
  "jsdoc-inventory",
  "schema-first-inventory",
  "schema-catalog",
  "instrumentation-catalog",
  "coverage-baseline-replacement",
  "test-typecheck-baseline",
  "docs-aggregate-clean",
  "operator-authored",
  "preserve-only",
]).pipe(
  $I.annoteSchema("RegistrationWriter", {
    description: "Named writer or preservation policy that owns a registration surface.",
  })
);
/**
 * Decoded literal union of registration writer and preservation policy names.
 *
 * @category models
 * @since 0.0.0
 */
export type RegistrationWriter = typeof RegistrationWriter.Type;

/**
 * Surface for the package directory itself; deleting the package removes the
 * root and every listed tracked or ignored artifact glob beneath it.
 *
 * **Example** (Find the owned tree)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { OwnedTreeSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(OwnedTreeSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.root))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OwnedTreeSurface extends S.Opaque<OwnedTreeSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("owned-tree"),
    id: S.NonEmptyString,
    root: PosixPath,
    artifacts: S.Array(GlobString),
  }).pipe(
    $I.annoteSchema("OwnedTreeSurface", {
      description: "A target-owned directory whose tracked and ignored contents share its lifecycle.",
    })
  )
) {}

/**
 * Surface for an exact workspace-array entry naming the package path in a
 * root manifest.
 *
 * **Details**
 *
 * Only literal members are removed; a covering glob such as `packages/*`
 * stays in place because it still registers sibling packages.
 *
 * **Example** (List workspace manifest files)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { WorkspaceLiteralSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(WorkspaceLiteralSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.file))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkspaceLiteralSurface extends S.Opaque<WorkspaceLiteralSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("workspace-literal"),
    id: S.NonEmptyString,
    file: PosixPath,
    workspacePath: PosixPath,
  }).pipe(
    $I.annoteSchema("WorkspaceLiteralSurface", {
      description: "An exact workspace-array member removed only when it is not a covering glob.",
    })
  )
) {}

/**
 * Surface for the package's identity registration: the compose argument in the
 * identity registry and the exported `$<Name>Id` composer accessor.
 *
 * **Example** (Read the identity accessor)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { IdentitySegmentSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(IdentitySegmentSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.accessor))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdentitySegmentSurface extends S.Opaque<IdentitySegmentSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("identity-segment"),
    id: S.NonEmptyString,
    registryFile: PosixPath,
    packageName: S.NonEmptyString,
    slug: S.NonEmptyString,
    accessor: S.NonEmptyString,
    generatedGroup: S.OptionFromOptionalKey(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("IdentitySegmentSurface", {
      description: "A package identity compose argument and its exported composer accessor.",
    })
  )
) {}

/**
 * Surface for committed outputs that a named writer regenerates from scratch,
 * so deletion reruns the writer instead of editing the outputs.
 *
 * **Example** (List rebuild writers)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { DerivedRebuildSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(DerivedRebuildSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.writer))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DerivedRebuildSurface extends S.Opaque<DerivedRebuildSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("derived-rebuild"),
    id: S.NonEmptyString,
    writer: RegistrationWriter,
    outputs: S.Array(PosixPath),
  }).pipe(
    $I.annoteSchema("DerivedRebuildSurface", {
      description: "Committed outputs replaced by a named reconstructive writer.",
    })
  )
) {}

/**
 * Surface for a writer-owned inventory that records the package under
 * `membershipKey`, letting doctor probe membership without rerunning the writer.
 *
 * **Example** (List inventory membership keys)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { GeneratedInventorySurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(GeneratedInventorySurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.membershipKey))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeneratedInventorySurface extends S.Opaque<GeneratedInventorySurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("generated-inventory"),
    id: S.NonEmptyString,
    writer: RegistrationWriter,
    outputs: S.Array(PosixPath),
    membershipKey: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("GeneratedInventorySurface", {
      description: "A writer-owned inventory whose target membership is derivable and probeable.",
    })
  )
) {}

/**
 * Surface for hand-written files that mention the package; matches on the
 * needles require a modeled edit or operator review rather than deletion.
 *
 * **Example** (List reference needles)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { AuthoredReferenceSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(AuthoredReferenceSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.needles))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AuthoredReferenceSurface extends S.Opaque<AuthoredReferenceSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("authored-reference"),
    id: S.NonEmptyString,
    files: S.Array(GlobString),
    needles: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("AuthoredReferenceSurface", {
      description: "An explicit target reference requiring a modeled edit or operator review.",
    })
  )
) {}

/**
 * Policy deciding whether deleting a package writes the canonical empty
 * deletion changeset or skips it because the package is private or a lab.
 *
 * **Example** (Check a deletion note policy)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DeletionNotePolicy } from "@beep/repo-cli/test/DeletePackage"
 *
 * console.log(S.is(DeletionNotePolicy)("labs-exempt")) // true
 * console.log(S.is(DeletionNotePolicy)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeletionNotePolicy = LiteralKit(["emit-empty-note", "labs-exempt", "private-exempt"]).pipe(
  $I.annoteSchema("DeletionNotePolicy", {
    description:
      "Whether deleting this package emits the canonical `{}` deletion changeset or is ceremony-exempt by private manifest or labs path.",
  })
);
/**
 * Decoded literal union of deletion changeset policies.
 *
 * @category models
 * @since 0.0.0
 */
export type DeletionNotePolicy = typeof DeletionNotePolicy.Type;

/**
 * Surface for pending changesets that still name the package, plus the
 * retired-name registry and the deletion-note policy applied on removal.
 *
 * **Example** (Read the deletion note policy)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { PendingChangesetSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(PendingChangesetSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.deletionNotePolicy))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PendingChangesetSurface extends S.Opaque<PendingChangesetSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("pending-changeset"),
    id: S.NonEmptyString,
    changesetGlob: GlobString,
    retiredRegistry: PosixPath,
    packageName: S.NonEmptyString,
    deletionNotePolicy: DeletionNotePolicy,
  }).pipe(
    $I.annoteSchema("PendingChangesetSurface", {
      description: "Pending changeset keys and retired-name policy for one package name.",
    })
  )
) {}

/**
 * Surface for ignored or machine-local artifacts (build output, caches) whose
 * globs must match nothing once the package is deleted.
 *
 * **Example** (List runtime artifact globs)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { RuntimeArtifactSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(RuntimeArtifactSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.globs))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeArtifactSurface extends S.Opaque<RuntimeArtifactSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("runtime-artifact"),
    id: S.NonEmptyString,
    globs: S.Array(GlobString),
  }).pipe(
    $I.annoteSchema("RuntimeArtifactSurface", {
      description: "Ignored or local artifacts that must be absent after deletion.",
    })
  )
) {}

/**
 * Surface for destructive state such as a Postgres schema that a lab manifest
 * owns; dropping it needs ownership proof and the named consent flag.
 *
 * **Example** (Read the consent flag)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { DataResourceSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(DataResourceSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.destructiveConsentFlag))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DataResourceSurface extends S.Opaque<DataResourceSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("data-resource"),
    id: S.NonEmptyString,
    owner: S.NonEmptyString,
    resourceName: S.NonEmptyString,
    localOnly: S.Boolean,
    destructiveConsentFlag: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("DataResourceSurface", {
      description: "Manifest-owned destructive state requiring ownership proof and explicit consent.",
    })
  )
) {}

/**
 * Surface for goal packets and research records that mention the package;
 * matches are classified as historical evidence and never pruned.
 *
 * **Example** (List historical record globs)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { HistoricalRecordSurface, RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const surfaces = A.filter(surfacesForTarget(target), S.is(HistoricalRecordSurface))
 *
 * console.log(A.map(surfaces, (surface) => surface.files))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HistoricalRecordSurface extends S.Opaque<HistoricalRecordSurface, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("historical-record"),
    id: S.NonEmptyString,
    files: S.Array(GlobString),
    needles: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("HistoricalRecordSurface", {
      description: "Historical evidence classified and preserved rather than pruned.",
    })
  )
) {}

/**
 * Tagged union over every registration surface variant, discriminated by
 * `kind` and shared by create, delete, and doctor.
 *
 * **Example** (Collect the surface kinds for a target)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 *
 * console.log(A.map(surfacesForTarget(target), (surface) => surface.kind))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
/**
 * Decoded union of every registration surface variant.
 *
 * @category models
 * @since 0.0.0
 */
export type RegistrationSurface = typeof RegistrationSurface.Type;

/**
 * Facts decoded from a lab package's manifest that add data-resource surfaces
 * when the target lives under the labs workspace.
 *
 * **Example** (Describe a local lab)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { LabTargetFacts } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const facts = LabTargetFacts.make({
 *   manifestFile: PosixPath.make("packages/labs/demo/lab.json"),
 *   postgresSchema: O.some("lab_demo"),
 *   localOnly: true
 * })
 *
 * console.log(O.getOrNull(facts.postgresSchema)) // "lab_demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LabTargetFacts extends S.Opaque<LabTargetFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    manifestFile: PosixPath,
    postgresSchema: S.OptionFromOptionalKey(S.NonEmptyString),
    localOnly: S.Boolean,
  }).pipe(
    $I.annoteSchema("LabTargetFacts", {
      description: "Decoded lab-manifest facts (manifest path, optional Postgres schema, locality) for a labs target.",
    })
  )
) {}

/**
 * Resolved workspace package that registration geometry is instantiated for:
 * its name, repository-relative path, privacy, and optional lab facts.
 *
 * **Details**
 *
 * `lab` defaults to `Option.none()` at construction, so non-lab targets omit it.
 *
 * **Example** (Build a target)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 *
 * console.log(target.packagePath) // "packages/demo"
 * console.log(O.isNone(target.lab)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistrationTarget extends S.Opaque<RegistrationTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.NonEmptyString,
    packagePath: PosixPath,
    private: S.Boolean,
    lab: S.OptionFromOptionalKey(LabTargetFacts).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("RegistrationTarget", {
      description: "Resolved workspace identity used to instantiate registration geometry.",
    })
  )
) {}

/**
 * Closed set of operations a registration plan can emit; `require-consent`
 * marks steps that must not run without an explicit operator flag.
 *
 * **Example** (Check an operation kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistrationOperationKind } from "@beep/repo-cli/test/DeletePackage"
 *
 * console.log(S.is(RegistrationOperationKind)("require-consent")) // true
 * console.log(S.is(RegistrationOperationKind)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RegistrationOperationKind = LiteralKit(["write", "remove", "rebuild", "preserve", "require-consent"]).pipe(
  $I.annoteSchema("RegistrationOperationKind", {
    description: "Closed operation kinds emitted by a registration plan.",
  })
);
/**
 * Decoded literal union of registration plan operation kinds.
 *
 * @category models
 * @since 0.0.0
 */
export type RegistrationOperationKind = typeof RegistrationOperationKind.Type;

/**
 * One plan step tied to a surface id, with a human-readable detail describing
 * exactly what the step writes, removes, rebuilds, or preserves.
 *
 * **Example** (Read forward plan operations)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { planForwardForTarget, RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const { operations } = planForwardForTarget(target)
 *
 * console.log(A.map(operations, (step) => `${step.surfaceId}: ${step.operation}`))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistrationOperation extends S.Opaque<RegistrationOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    surfaceId: S.NonEmptyString,
    operation: RegistrationOperationKind,
    detail: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("RegistrationOperation", {
      description: "One deterministic forward or inverse operation derived from a surface.",
    })
  )
) {}

/**
 * Versioned, serializable list of operations for one target, computed before
 * any file is touched so it can be printed, reviewed, or applied.
 *
 * **Example** (Inspect an inverse plan)
 *
 * ```ts
 * import { planInverseForTarget, RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const plan = planInverseForTarget(target)
 *
 * console.log(plan.version) // "registration-plan/v1"
 * console.log(plan.target.packageName) // "@beep/demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistrationPlan extends S.Opaque<RegistrationPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("registration-plan/v1"),
    target: RegistrationTarget,
    operations: S.Array(RegistrationOperation),
  }).pipe(
    $I.annoteSchema("RegistrationPlan", {
      description: "Serializable package registration plan produced before any mutation.",
    })
  )
) {}

/**
 * Closed set of doctor verdicts for a surface, separating `residue` left after
 * deletion from `drift` against the declared geometry.
 *
 * **Example** (Check an observation status)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistrationObservationStatus } from "@beep/repo-cli/test/DeletePackage"
 *
 * console.log(S.is(RegistrationObservationStatus)("residue")) // true
 * console.log(S.is(RegistrationObservationStatus)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
/**
 * Decoded literal union of registration doctor statuses.
 *
 * @category models
 * @since 0.0.0
 */
export type RegistrationObservationStatus = typeof RegistrationObservationStatus.Type;

/**
 * Doctor verdict for one surface, carrying the file paths or matches that
 * justify a non-clean status.
 *
 * **Example** (Record leftover residue)
 *
 * ```ts
 * import { RegistrationObservation } from "@beep/repo-cli/test/DeletePackage"
 *
 * const observation = RegistrationObservation.make({
 *   surfaceId: "workspace-literal",
 *   status: "residue",
 *   evidence: ["package.json"]
 * })
 *
 * console.log(observation.status) // "residue"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistrationObservation extends S.Opaque<RegistrationObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    surfaceId: S.NonEmptyString,
    status: RegistrationObservationStatus,
    evidence: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("RegistrationObservation", {
      description: "Declared-versus-actual result for one registration surface.",
    })
  )
) {}

/**
 * Closed classification of reverse-dependency hits; manifest, import, script,
 * and file-path kinds block deletion while packet, baseline, and historical
 * kinds are informational.
 *
 * **Example** (Check a hit kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DependentHitKind } from "@beep/repo-cli/test/DeletePackage"
 *
 * console.log(S.is(DependentHitKind)("import-prod")) // true
 * console.log(S.is(DependentHitKind)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
/**
 * Decoded literal union of reverse-dependency hit kinds.
 *
 * @category models
 * @since 0.0.0
 */
export type DependentHitKind = typeof DependentHitKind.Type;

/**
 * One location that still depends on or mentions the target, with its owning
 * workspace, optional line number, and whether the edge is direct.
 *
 * **Example** (Record a production import)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { DependentHit } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const hit = DependentHit.make({
 *   kind: "import-prod",
 *   owner: "@beep/consumer",
 *   file: PosixPath.make("packages/consumer/src/index.ts"),
 *   line: O.some(3),
 *   direct: true
 * })
 *
 * console.log(hit.kind) // "import-prod"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependentHit extends S.Opaque<DependentHit, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: DependentHitKind,
    owner: S.NonEmptyString,
    file: PosixPath,
    line: S.OptionFromOptionalKey(S.Int),
    direct: S.Boolean,
  }).pipe(
    $I.annoteSchema("DependentHit", {
      description: "One classified manifest, import, path, packet, baseline, or historical hit.",
    })
  )
) {}

/**
 * Reverse-dependency evidence for a target: direct and transitive workspace
 * dependents plus every classified hit, sorted for stable output.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { DependentsReport, RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const report = DependentsReport.make({
 *   target,
 *   directWorkspaceDependents: [],
 *   transitiveWorkspaceDependents: [],
 *   hits: []
 * })
 *
 * console.log(A.isReadonlyArrayEmpty(report.hits)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependentsReport extends S.Opaque<DependentsReport, { readonly brand: unique symbol }>()(
  S.Struct({
    target: RegistrationTarget,
    directWorkspaceDependents: S.Array(S.NonEmptyString),
    transitiveWorkspaceDependents: S.Array(S.NonEmptyString),
    hits: S.Array(DependentHit),
  }).pipe(
    $I.annoteSchema("DependentsReport", {
      description: "Deterministic reverse-dependency closure plus import and authored-reference evidence.",
    })
  )
) {}
