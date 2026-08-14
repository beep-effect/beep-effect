# Registration Geometry Design

Date: 2026-08-13

Decision basis: locked SPEC D5-D9 and the ratified census in report 10

## Decision summary

`RegistrationSurface` is a schema-derived tagged union with ten closed surface
kinds. One private repo-CLI service interprets the same declarations in three
directions:

1. forward for create-package and labs registration;
2. inverse for delete-package planning and application;
3. inspect for doctor declared-versus-actual comparison.

The geometry describes ownership, writer identity, inverse policy, and probe
policy. It does not embed arbitrary callbacks. That keeps plans serializable,
reviewable, and usable as synthetic fixtures.

The recommended home is a private repo-CLI internal module, not
`@beep/repo-utils`. Registration policy names repo commands, committed
inventories, changesets, architecture records, and consent rules. Those are
beep CLI concerns rather than general repository utilities. The current
command-topology doctrine also says shared non-command helpers belong below the
repo CLI's internal CLI tree. A future implementation can therefore live under
the following private surface without creating a public package API:

```text
packages/tooling/tool/cli/src/internal/cli/RegistrationGeometry/
  RegistrationGeometry.schemas.ts
  RegistrationGeometry.errors.ts
  RegistrationGeometry.service.ts
  RegistrationGeometry.plan.ts
  RegistrationGeometry.probes.ts
  index.ts
```

CreatePackage, DeletePackage, Labs, and doctor consume the private facade. The
pure reverse-adjacency helper may later move to `@beep/repo-utils` if it earns a
second non-lifecycle consumer; E1/E15 scanning remains in the CLI because it is
repo-policy-specific.

## Effect v4 API validation

Every nontrivial API in the sketches below was checked against this tree:

- `S.Class<Self>(identifier)(fields, annotations)` is the checked-in v4
  signature at `.repos/effect/packages/effect/src/Schema.ts:14307-14335`.
- `S.toTaggedUnion(tag)` accepts a union of schemas whose decoded types carry a
  property-key discriminator and adds cases, guards, matching, and
  discriminants at `Schema.ts:6272-6330`.
- `Context.Service<Self, Shape>()(identifier)` is the v4 class constructor at
  `.repos/effect/packages/effect/src/Context.ts:201-243` and matches live repo
  services such as `TemplateService.ts:114-136`.
- `LiteralKit(...).mapMembers(Tuple.evolve(...)).pipe(S.toTaggedUnion(...))`
  is live repo style in `VersionSync.schemas.ts:297-315` and
  `AssistantTurn.contracts.ts:255-278`.
- `PosixPath` and `Glob` are existing shared schemas at
  `packages/foundation/modeling/schema/src/PosixPath.ts:33-56` and
  `packages/foundation/modeling/schema/src/Glob/Glob.schema.ts`.

The sketches deliberately use no assertions, native Set/Map, hand-rolled
literal union, or implementation callback field.

## Schema shapes

The following is the proposed schema contract. It is intentionally a design
sketch, not P0 implementation.

```ts
import { $RepoCliId } from "@beep/identity/packages"
import { Glob } from "@beep/schema/Glob"
import { LiteralKit } from "@beep/schema"
import { PosixPath } from "@beep/schema/PosixPath"
import { Context, Effect, Tuple } from "effect"
import * as S from "effect/Schema"

const $I = $RepoCliId.create("internal/cli/RegistrationGeometry")

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
)
export type RegistrationSurfaceKind = typeof RegistrationSurfaceKind.Type

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
    description: "Named writer or preservation policy that owns a surface.",
  })
)
export type RegistrationWriter = typeof RegistrationWriter.Type

class OwnedTreeSurface extends S.Class<OwnedTreeSurface>($I`OwnedTreeSurface`)(
  {
    kind: S.tag("owned-tree"),
    id: S.NonEmptyString,
    root: PosixPath,
    artifacts: S.Array(Glob),
  },
  $I.annote("OwnedTreeSurface", {
    description: "A target-owned directory whose files and artifacts share its lifecycle.",
  })
) {}

class WorkspaceLiteralSurface extends S.Class<WorkspaceLiteralSurface>($I`WorkspaceLiteralSurface`)(
  {
    kind: S.tag("workspace-literal"),
    id: S.NonEmptyString,
    file: PosixPath,
    workspacePath: PosixPath,
  },
  $I.annote("WorkspaceLiteralSurface", {
    description: "An exact workspace-array member used only when no covering glob owns the path.",
  })
) {}

class IdentitySegmentSurface extends S.Class<IdentitySegmentSurface>($I`IdentitySegmentSurface`)(
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

class DerivedRebuildSurface extends S.Class<DerivedRebuildSurface>($I`DerivedRebuildSurface`)(
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

class GeneratedInventorySurface extends S.Class<GeneratedInventorySurface>($I`GeneratedInventorySurface`)(
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

class AuthoredReferenceSurface extends S.Class<AuthoredReferenceSurface>($I`AuthoredReferenceSurface`)(
  {
    kind: S.tag("authored-reference"),
    id: S.NonEmptyString,
    files: S.Array(Glob),
    needles: S.Array(S.NonEmptyString),
  },
  $I.annote("AuthoredReferenceSurface", {
    description: "An explicit name or path reference requiring a known mechanical edit or operator review.",
  })
) {}

class PendingChangesetSurface extends S.Class<PendingChangesetSurface>($I`PendingChangesetSurface`)(
  {
    kind: S.tag("pending-changeset"),
    id: S.NonEmptyString,
    changesetGlob: Glob,
    retiredRegistry: PosixPath,
    packageName: S.NonEmptyString,
  },
  $I.annote("PendingChangesetSurface", {
    description: "Pending changeset keys and retired-name policy for one package name.",
  })
) {}

class RuntimeArtifactSurface extends S.Class<RuntimeArtifactSurface>($I`RuntimeArtifactSurface`)(
  {
    kind: S.tag("runtime-artifact"),
    id: S.NonEmptyString,
    globs: S.Array(Glob),
  },
  $I.annote("RuntimeArtifactSurface", {
    description: "Ignored or local artifacts that must be absent after deletion but are not committed truth.",
  })
) {}

class DataResourceSurface extends S.Class<DataResourceSurface>($I`DataResourceSurface`)(
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

class HistoricalRecordSurface extends S.Class<HistoricalRecordSurface>($I`HistoricalRecordSurface`)(
  {
    kind: S.tag("historical-record"),
    id: S.NonEmptyString,
    files: S.Array(Glob),
    needles: S.Array(S.NonEmptyString),
  },
  $I.annote("HistoricalRecordSurface", {
    description: "Historical evidence that is classified and preserved rather than pruned.",
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
)
export type RegistrationSurface = typeof RegistrationSurface.Type
```

`RegistrationWriter` is also closed because free-form command strings would
turn the schema into an unreviewed command runner. Adding a new generator must
therefore amend the schema and its interpreter exhaustively.

## Plan, observation, and service contract

The interpreter returns schema values. It does not mutate while planning, and
doctor never calls a forward or inverse writer.

```ts
export class RegistrationTarget extends S.Class<RegistrationTarget>($I`RegistrationTarget`)(
  {
    packageName: S.NonEmptyString,
    packagePath: PosixPath,
    private: S.Boolean,
  },
  $I.annote("RegistrationTarget", {
    description: "Resolved workspace identity used to instantiate registration geometry.",
  })
) {}

export const RegistrationOperationKind = LiteralKit([
  "write",
  "remove",
  "rebuild",
  "preserve",
  "require-consent",
]).pipe(
  $I.annoteSchema("RegistrationOperationKind", {
    description: "Closed operation kinds emitted by a registration plan.",
  })
)
export type RegistrationOperationKind = typeof RegistrationOperationKind.Type

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
)
export type RegistrationObservationStatus = typeof RegistrationObservationStatus.Type

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

export class RegistrationGeometryError extends S.TaggedError<RegistrationGeometryError>()(
  "RegistrationGeometryError",
  { message: S.NonEmptyString },
  $I.annote("RegistrationGeometryError", {
    description: "Typed failure to resolve, plan, inspect, or apply registration geometry.",
  })
) {}

export type RegistrationGeometryServiceShape = {
  readonly surfacesFor: (
    target: RegistrationTarget
  ) => Effect.Effect<ReadonlyArray<RegistrationSurface>, RegistrationGeometryError>
  readonly planForward: (
    target: RegistrationTarget
  ) => Effect.Effect<RegistrationPlan, RegistrationGeometryError>
  readonly planInverse: (
    target: RegistrationTarget
  ) => Effect.Effect<RegistrationPlan, RegistrationGeometryError>
  readonly inspect: (
    target: RegistrationTarget
  ) => Effect.Effect<ReadonlyArray<RegistrationObservation>, RegistrationGeometryError>
  readonly apply: (
    plan: RegistrationPlan
  ) => Effect.Effect<ReadonlyArray<RegistrationObservation>, RegistrationGeometryError>
  readonly dependentsOf: (
    target: RegistrationTarget
  ) => Effect.Effect<DependentsReport, RegistrationGeometryError>
}

export class RegistrationGeometryService extends Context.Service<
  RegistrationGeometryService,
  RegistrationGeometryServiceShape
>()($I`RegistrationGeometryService`) {}
```

The service contract remains an interface-shaped TypeScript type because it is
a service port, which repo law permits. Every payload and report it exchanges
is schema-first.

## Per-kind interpreter semantics

| Kind | Forward | Inverse | Doctor |
| --- | --- | --- | --- |
| owned-tree | Materialize the package/app plan and target-local files. | Remove tracked and ignored contents through a path-contained operation. | Target live: required files exist. Target deleted: root and artifact globs are absent. |
| workspace-literal | Add only when no workspace glob covers the target. | Remove only an exact literal; never remove a covering glob. | Resolve workspace patterns and report missing or ghost membership. |
| identity-segment | Rebuild/register the target slug in its correct group and export. | Remove the slug, export, manual casing alias, and shape-stability row if present. | Compare live workspace slugs to both composer groups and exports; extras are residue. |
| derived-rebuild | Invoke the named reconstructive writer after the owned tree exists. | Invoke the same writer after membership/tree removal; use replacement mode where declared. | Run writer check mode or compare declared outputs with the writer's plan. |
| generated-inventory | Admit target-owned entries only through the named writer. | Regenerate and require the target key/path to disappear. | Decode outputs and compare target membership; paired outputs must agree. |
| authored-reference | Apply only a specifically modeled mechanical insertion. | Remove a specifically modeled exact name/path; otherwise stop for review. | E15-style scan classifies exact hits by file and policy. |
| pending-changeset | Normal package creation may create no row; lab paths are exempt through the status wrapper. | Delete dedicated pending files; strip multi-package keys; retire only by explicit policy. | Decode all pending frontmatter and retired records; report dead names and live-name collisions. |
| runtime-artifact | No committed forward operation; runtime tools may create artifacts. | Purge target-local ignored state and invalidate named mirrors. | Filesystem glob probe; local index residue is warning-only where declared. |
| data-resource | Provision only from a decoded manifest and ownership derivation. | Refuse without destructive consent; verify target ownership and local connection before drop. | Verify declared ownership and report manual cleanup when consent is absent. |
| historical-record | Never create as package registration. | Preserve. | Classify exact hits as historical so they do not become false-positive residue. |

## Zero-root-churn holdout A: TypeScript root references

### Options

1. **Exclude labs from root solution references.** Change the
   `planRootReferenceSync` expected set so workspaces below the labs glob do not
   enter `tsconfig.packages.json`. Each lab's own `beep:check` remains the
   typecheck authority, and the non-required labs lane runs those package-local
   checks. Survivor package references still come from dependency edges.
2. **Accept generated-only root churn.** Keep every lab in the root solution
   and allow tsconfig-sync to rewrite the committed reference array on each
   create/delete.

### Recommendation

Choose option 1. D5 describes zero shared-config churn as a hard requirement,
not merely “no hand edits.” Root solution membership is not necessary for a
private app with an explicit package-local check and a dedicated CI lane. The
exclusion must be path-based, not name-based, and must apply only to the root
reference plan; dependency-index discovery, package-local reference planning,
identity discovery, syncpack workspace discovery, and the labs lane still see
labs. Doctor proves both sides: no lab root reference exists, and every lab has
a valid local check script and tsconfig.

## Zero-root-churn holdout B: path-aware changeset status

Stock changesets ignores names, so adding every lab to `.changeset/config.json`
would violate D5. The wrapper design is:

1. Resolve the merge-base diff to changed repo-relative files.
2. Resolve those files to workspace owners from the live workspace catalog.
3. Partition changed owners by path. Owners below the labs glob are
   ceremony-exempt; all other owners are passed to changesets unchanged.
4. If every changed workspace is a lab and all non-workspace changed files are
   labs-doctrine or lab-owned generated identity output admitted by the same
   PR, return success without invoking the stock status requirement.
5. Otherwise invoke changesets status for the non-lab change set. Do not hide a
   missing changeset for repo CLI, standards, root config, or production package
   changes merely because the PR also touches a lab.
6. Continue to run changeset-graph over every pending file. Ceremony exemption
   removes the “must add a changeset” requirement; it does not permit dead
   package names or malformed frontmatter.

The wrapper belongs in repo CLI and replaces the two current direct script
call sites: Repo Sanity and the branch-only GitHub-check preflight. The root
script becomes a thin adapter to that same contract. Geometry declares the
pending-changeset surface, but it does not parse git diffs itself.

Acceptance fixtures must cover lab-only, mixed lab/product, root-only,
renamed/deleted lab, and a pending changeset that names a deleted lab.

## Zero-root-churn holdout C: mechanically prunable identity labs segment

The live registry is a single `$I.compose(...)` call followed by a large export
section. Changing lab identity values to an `@beep/labs/*` namespace would
conflict with the actual `@beep/*` package names and with the existing identity-lint
contract. The “labs segment” should therefore be structural in source, not a
different public namespace.

Recommended shape:

```ts
const generatedPackageComposers = $I.compose(
  // existing non-lab slugs
)

// GENERATED from workspace package manifests under apps/labs/*.
const generatedLabComposers = $I.compose(
  "cognee",
  "trustgraph-workbench",
)

const composers = {
  ...generatedPackageComposers,
  ...generatedLabComposers,
  $LangExtractId: generatedPackageComposers.$LangextractId,
}

// GENERATED LAB EXPORTS START
export const $CogneeId: Identity.IdentityComposer<"@beep/cognee"> = composers.$CogneeId
export const $TrustgraphWorkbenchId: Identity.IdentityComposer<"@beep/trustgraph-workbench"> =
  composers.$TrustgraphWorkbenchId
// GENERATED LAB EXPORTS END
```

The identity sync input is the decoded workspace catalog filtered by the labs
path, sorted by package slug. It replaces the entire labs compose argument list
and export block deterministically. Create and delete never splice one lab into
arbitrary authored text. The same sync also supplies identity doctor with two
sets: expected lab slugs and actual lab-group slugs/exports. Missing entries and
extras both fail, closing the current missing-only lint gap.

This is generated shared-source churn, but it is zero hand-authored root-config
churn and mechanically conflict-resolvable. If D5 is interpreted as literally
zero shared-file diffs, the only alternative is a generated sibling module
exported once from packages.ts; that moves rather than eliminates the per-lab
generated diff. The contiguous in-file group is the smaller first change and
preserves the existing public barrel.

## `dependentsOf` design

### Result schemas

```ts
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
)
export type DependentHitKind = typeof DependentHitKind.Type

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
    description: "Deterministic reverse-dependency closure plus E1 and E15 scan evidence.",
  })
) {}
```

### Algorithm

1. Call `buildRepoDependencyIndex`, whose live output is an Effect
   `HashMap<string, WorkspaceDeps>` at `DependencyIndex.ts:56-101`.
2. Fold every workspace's four internal dependency records into a reverse
   adjacency `HashMap<string, HashSet<string>>`: dependency name to owners.
   Preserve the dependency bucket on direct hits so runtime, dev, peer, and
   optional edges classify separately.
3. Call the existing `computeTransitiveClosure` over that inverted adjacency.
   The checked helper accepts Effect HashMap/HashSet adjacency at
   `Graph.ts:309-350`. Sort only when projecting into schema arrays.
4. Run the E1 pass over static import, export-from, require, and dynamic-import
   specifiers below `packages/**`, `apps/**`, `infra/**`, and `scratchpad/**`.
   Exact package name and package subpaths count; comments and prose do not.
5. Run the E15 pass over root scripts, Storybook globs/test roots, Biome file
   references, lefthook, Turbo named tasks, infra strings, other packages'
   docgen configs, accepted-proof path reads, goal manifests, and committed
   baselines.
6. Deduplicate by `(kind, owner, file, line)` through Effect HashSet/HashMap
   values, then project a stable sorted `DependentsReport`.
7. Refusal policy consumes the report but is not hidden inside the scanner:
   product/test/script/file-path hits refuse; baseline hits schedule regen;
   packet and historical hits follow the locked warning/refusal rules.

This preserves the research/05 finding that manifest edges alone are not a
safe deletion proof while keeping pure graph inversion separate from
repo-specific scanners.

## Design invariants for P1

- `RegistrationSurface.match` is the exhaustive branch point for all three
  interpreters.
- A surface cannot name an arbitrary executable command or callback.
- Every destructive operation is present in the printed inverse plan before
  application.
- Doctor operates from the same declarations and never owns a second prune
  checklist.
- Historical evidence is classified, not deleted.
- `--force` never changes the dependents refusal result.
- Data-resource inverse remains consent-gated and local-by-default.
- Generated inventories declare every output they own; partial writes are
  doctor drift.
