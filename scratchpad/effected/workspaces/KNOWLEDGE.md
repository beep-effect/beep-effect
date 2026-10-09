# workspaces — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/workspaces/CLAUDE.md -->
# @effected/workspaces

Monorepo workspace tooling as Effect services: workspace root discovery, package enumeration, the dependency graph, package-manager detection, pnpm catalog resolution, lockfile IO, peer and duplicate checks, and git-based snapshots and change detection. **Integrated tier** — the `@pnpm/catalogs.*` quartet is why.

Durable knowledge about this package lives in the OKF bundle, not here. Start at `okf/modules/workspaces.md`, then load the concept a task needs:

- Module (tier and dependency posture, the two inverted contracts `CatalogResolver`/`WorkspaceResolver` and `LocalExec`, module layout, composites, the `WorkspacesSync` escape hatch, lazy init, hardening, testing, build) → `okf/modules/workspaces.md` — Load when: changing the error model, a composite layer, a dependency edge, or any service contract.
- Discovery (root finding and its `stopAt`/`maxDepth` bounds, the `packages:` enumerator, the shared traversal, `WorkspacePackage`, per-root `listPackagesIn`/`infoIn`, `PackageManagerDetector`, the doubles) → `okf/interfaces/workspaces-discovery.md` — Load when: touching enumeration, traversal, the root ascent, `WorkspacePackage` or the detector.
- Dependency graph (`DependencyGraph`, cycle payload, `levels`, Mermaid, where core's `Graph` is and is not used) → `okf/interfaces/workspaces-graph.md` — Load when: touching `DependencyGraph`, cycle detection, `levels` or the rendering.
- Catalogs and hook replay (PM-aware assembly, the release-age gate, `ConfigDependencySpec`, `ConfigDependencyHooks`, the declared-version ladder, `layerSubprocess`, `peerDependencyRules` seeding) → `okf/interfaces/workspaces-catalogs.md` — Load when: touching catalog assembly, `ConfigDependencySpec` or its shared splitter, `ConfigDependencyHooks` or `peerDependencyRules`.
- Peer checking (`PeerCheck`, the three surfaced limits, the four `unverified` reasons, the three suppression axes, the committed oracle) → `okf/interfaces/workspaces-peer-check.md`, `okf/limitations/workspaces-peer-check-yarn-and-suppression-axes.md` — Load when: touching `PeerCheck`, the `unverified` reasons, the suppression axes or the peer fixtures. Every clause there is a defect someone already paid for; read it **before** touching any of it.
- Duplicate checking (`DuplicateCheck`, the two-version rule, the shared `internal/roots.ts` join) → `okf/interfaces/workspaces-duplicate-check.md` — Load when: touching `DuplicateCheck` or `internal/roots.ts`.
- Snapshots and change detection (`WorkspaceSnapshots.at(ref)`/`worktree()`, hook replay at a ref, `WorkspaceStateSnapshot`, seeded catalogs, importer versions, `ChangeDetector`) → `okf/interfaces/workspaces-snapshots.md`, `okf/limitations/workspaces-snapshot-hook-catalog-bump-between-refs.md` — Load when: touching at-ref reads, `WorkspaceStateSnapshot` or `ChangeDetector`.
- Release surface (`PublishabilityDetector`, `VersioningStrategy`, `ReleaseTag`, `TrackingTag`, `classifyTag`) → `okf/interfaces/workspaces-release.md`, `okf/gotchas/publishability-detector-diagnoses-late.md`, `okf/gotchas/releasetag-strict-semver-default.md` — Load when: working on publishability, versioning strategy or tag derivation.
- Why the sync facade and the `./node-sync` entry exist → `okf/decisions/workspaces-sync-facade-escape-hatch.md`, `okf/decisions/second-published-entrypoint.md` — Load when: adding or reshaping any `*Sync` function or a second entry point.
- The `./testing` subpath (`SourceBoundary` and its lexer's misses, `WorkspaceLayering` and `LayerPolicy`, `PackedInstall` and its per-manager traps) → `okf/interfaces/workspaces-repo-shape-checks.md`, `okf/decisions/packed-install-pack-source.md`, `okf/decisions/kit-layering-checks-runtime-edges.md`, `okf/decisions/carrier-only-declares-bins.md` — Load when: touching any module under `./testing`, `lib/configs/layers.json`, or a boundary, layering or packed-install test; the last when touching `BinConflict`, `allowSharedBins` or `runCarrierBin`.
- The `LocalExec` direction and the contract-inversion rule → `okf/decisions/contract-inversion-default.md` — Load when: tempted to import this package from `commands`, `npm`, `lockfiles` or `package-json`.

## Operating rules

- `src/index.ts`, `src/node-sync.ts` and `src/testing.ts` are the only re-exporting modules, and `src/index.ts` **must never re-export** `./node-sync` or `./testing` (`__test__/entrypoints.test.ts` pins it); `src/internal/catalogs.ts` is the only module that may import `@pnpm/catalogs.*`; nothing new may build a local subprocess seam (git goes through `@effected/git`, anything else through core's `ChildProcessSpawner` via `@effected/commands`' `Run`); `minimatch` must not become a dependency.
- The `./testing` modules read no `process`, import no `node:` or `@effect/platform*` module and write to no console: every environment value arrives as a parameter from the consumer's test file. `__test__/integration/SourceBoundarySelf.int.test.ts` pins it with the scanner the subpath ships.
- `PackedInstall` owns no subprocess seam beyond `@effected/commands`' `Run` over core's `ChildProcess`; its pure decisions live in `src/internal/packedInstallPlan.ts`.
- `RunBinOptions.stdin` omitted (or `""`) is `"ignore"`, the null device, never an open pipe; only `command`/`carrierCommand` leave stdin open. `PackedInstall.preflight` plans with the run's own `planClosure` and checks `<pkg>/<packFrom.directory>/package.json`; `PackedInstall.gate` is pure over an `env` parameter (skip off CI, fail under CI). Neither may import `vitest`: the recipe lives in the skill, not a wrapper.
- Never `Effect.cached` for a lazy init — the memo is `Effect.cachedInvalidateWithTTL` plus invalidate-on-non-success (Module, "Lazy init").
- `PeerCheck` and `DuplicateCheck` join importers to instances through ONE implementation, `src/internal/roots.ts`, so they cannot disagree about which importers are answerable; do not fork the join.
- Bind parameterized layer factories to a `const` (layers memoize by reference). `Workspaces.resolverLayer` is the deliberate exception.

## Testing and building

Tests run on core's `Path.layer` + `@effected/memfs` (a devDependency), no platform package; `__test__/fixtures.ts` seeds a volume from a `Tree` record and injects misbehaviour as faults.

- A suite-boundary `layer(...)` cannot vary per test, so **each distinct tree gets its own `layer(...)` block**.
- Three integration suites run against **this repository** through `@effect/platform-node` (a devDependency): `self.int.test.ts` discovers it, `SourceBoundarySelf.int.test.ts` scans this package's own `src/`, and `layering.int.test.ts` checks the kit's package graph against `lib/configs/layers.json`.
- Unit and integration tests never drive a live package manager. The `pnpm peers check` oracle under `__test__/fixtures/peers/*/peers-check.json` is committed pnpm output (provenance in that directory's `README.md`), and `PackedInstall`'s unit tests script every spawn through `ScriptedSpawner`.
- Only `__test__/e2e/` may run real package managers, and only against a fixture workspace it generates, with every spawn under the scrubbed dead-proxy offline env (`HTTP(S)_PROXY` at a closed port, `COREPACK_ENABLE_NETWORK=0`) so nothing reaches a registry. `e2e/PackedInstall.e2e.test.ts` is that exception. Its dead-proxy control assumes the user's `~/.npmrc` sets no `proxy`/`https-proxy` (HOME is inherited by design); on a machine where it does, that one control can fail with a proxy error rather than `ECONNREFUSED`, while the installs stay hermetic because the fixture has no external dependencies.
- `savvy.build.ts` carries the **narrow** `_base` suppression for synthesized class-factory bases. Never widen it — the narrow pattern once caught a genuine `ae-forgotten-export`.
- Never run `node savvy.build.ts --target prod` directly — build through `pnpm build --filter @effected/workspaces`.


---
<!-- okf/modules/workspaces.md -->
---
type: Module
title: "@effected/workspaces: monorepo tooling"
description: The integrated-tier package that finds a workspace root, enumerates its packages, walks the dependency graph, detects the package manager, assembles pnpm catalogs, checks peer dependencies, and reads git-scoped snapshots.
status: stable
kind: package
resource: ../../packages/workspaces
tags:
  - architecture
  - bundle
sources:
  - id: package-json
    resource: ../../packages/workspaces/package.json
  - id: index-ts
    resource: ../../packages/workspaces/src/index.ts
  - id: internal-catalogs-ts
    resource: ../../packages/workspaces/src/internal/catalogs.ts
  - id: node-sync-ts
    resource: ../../packages/workspaces/src/node-sync.ts
  - id: workspaces-sync-ts
    resource: ../../packages/workspaces/src/WorkspacesSync.ts
  - id: savvy-build-ts
    resource: ../../packages/workspaces/savvy.build.ts
  - id: workspaces-ts
    resource: ../../packages/workspaces/src/Workspaces.ts
  - id: testing-ts
    resource: ../../packages/workspaces/src/testing.ts
generated:
  by: "okfit/claude-code"
  at: 2026-10-05T17:55:16Z
  body_sha256: cb09e590b56e0e0e6a1a94ee7a0bf1f3659fabcabacb4db849d4b60749f36672
---

# @effected/workspaces: monorepo tooling

`@effected/workspaces` is the part of monorepo tooling that only makes sense
with a filesystem and a package manager under it: root discovery, the
`packages:` enumerator, the dependency graph, package-manager detection,
pnpm catalog assembly, peer-dependency checking, and git-scoped snapshots. It
composes the pure parsers around it — [lockfiles](../interfaces/workspaces-discovery.md),
`@effected/glob`, `@effected/git` — over one workspace model, and it fills
two service contracts that boundary-tier packages declare but cannot
implement themselves.

## Tier and dependency posture

The package is **integrated tier**, and the `@pnpm/catalogs.*` quartet
(`@pnpm/catalogs.config`, `@pnpm/catalogs.protocol-parser`,
`@pnpm/catalogs.resolver`, `@pnpm/catalogs.types`) is what makes it so: those
packages *are* pnpm's catalog semantics, versioned to pnpm majors, and
reimplementing them would mean owning a moving external spec with no
oracle.[^package-json] The blast radius of that tier-3 dependency is confined
to a single file — `src/internal/catalogs.ts` is the only module in the
package that imports `@pnpm/catalogs.*`.[^internal-catalogs-ts]

The other dependency worth naming is git: `ChangeDetector` and the snapshot
service run entirely on `@effected/git`'s typed service over core's
`ChildProcessSpawner` contract, which is the one boundary edge the package
takes on. There is no `minimatch` dependency and no `node:child_process`
import anywhere in the main module graph — dependency-pattern matching and
the `packages:` enumerator both run on `@effected/glob`'s vendored matching
engine, and subprocess spawning lives entirely behind core's spawner
contract.[^package-json]

Kit dependencies are `workspace:^`: `@effected/commands`, `@effected/git`,
`@effected/glob`, `@effected/lockfiles`, `@effected/npm`,
`@effected/package-json`, `@effected/semver`, `@effected/walker`, and
`@effected/yaml` for `pnpm-workspace.yaml`; `effect` is a
peer.[^package-json]

## Implementing @effected/npm's resolver contracts

`@effected/npm` defines two shape-only service contracts —
`CatalogResolver` and `WorkspaceResolver` — that `@effected/package-json`
needs but cannot implement itself, shipping only no-op layers. This package
implements them, because catalog resolution needs the workspace config plus
the lockfile and workspace-version resolution needs the discovered package
list, both of which live here. The contracts' convention holds exactly: an
*unmatched* name answers `None`, and the error channel is reserved for a
failure of the resolution mechanism. A version-less workspace member is
neither — `WorkspaceResolver.versionOf` fails typed for a matched member
that declares no `version`, because answering `None` for a version-less
member would read downstream as "not a workspace package" for something the
workspace plainly contains (see
[the discovery interface](../interfaces/workspaces-discovery.md)).

`CatalogAssemblyError` is raised here but owned by `@effected/npm`, imported
back rather than redeclared, and deliberately not re-exported from this
package's entry point — an unreadable or malformed catalog source passes
through typed as that error, and only an unfindable workspace root wraps
into this package's own `DependencyResolutionError`.

Two conveniences sit on top: `Workspaces.resolverLayer(options?)` pre-wires
both resolvers over the config-dependency path, and is deliberately a
parameterized layer function whose fresh, unmemoized layer per call is the
feature — layers memoize by reference, so each call re-runs root discovery
(including a per-call ambient-cwd read when none is given); a consumer that
wants sharing binds one call's result to a `const`.
`Workspaces.resolveManifest` is the one-shot path over a fresh resolver
layer per call, and consumers processing many manifests should check
`@effected/npm`'s pure `needsResolution` predicate first to skip catalog
assembly entirely when nothing needs resolving.[^workspaces-ts]

## Implementing @effected/commands' LocalExec contract

The second inverted contract this package fills is `@effected/commands`'
`LocalExec`, on the same reasoning: `@effected/commands` needs
package-manager detection and workspace-root resolution for its tool
discovery, and both live here, but a direct `commands` → `workspaces` edge
would make `commands` — a boundary-tier package — integrated, and through
the `npm` → `commands` edge would drag `npm`, `lockfiles` (pure) and
`package-json` up a tier with it. See
[the contract-inversion decision](../decisions/contract-inversion-default.md)
for the program-wide rule this follows.

`localExecLayer` reserves `None` for an ordinary absence and a typed error
for a broken manifest only: no workspace root above the cwd answers `None`
("no project-local way to run tools here" is an ordinary fact); detection
finding no evidence answers `None` (the detector refused to guess, which is
the same honest absence); and a manifest that exists but cannot be read or
parsed is a typed error, because that is not absence but damage. All three
rows are mutation-pinned in both directions in the package's own test suite.
The resulting context's directory is the resolved **workspace root**, never
the caller's cwd, and every argv prefix comes from `@effected/commands`'
own table — this layer never hard-codes an exec, dlx, or script-runner
prefix. A consumer with no monorepo never needs this layer and therefore
never installs this package, which is the entire payoff of the inversion.

## Module layout

Module-per-concept; the placements that are decisions rather than
mechanics:

- `src/internal/catalogs.ts` is the only module that imports
  `@pnpm/catalogs.*`.[^internal-catalogs-ts]
- `src/ReleaseTag.ts` is a leaf importing nothing else in the package, which
  is what keeps the release-tag vocabulary pure.
- `src/node-sync.ts` is a second package entry point, not a module of the
  first, and `src/testing.ts` is a third. Only `src/index.ts`,
  `src/node-sync.ts` and `src/testing.ts` re-export.
- `CatalogAssemblyError` is not this package's module; it lives in
  `@effected/npm` beside the contract that names it.
- Lockfile framing is not this package's job. `@effected/lockfiles` owns
  pnpm's multi-document `pnpm-lock.yaml`, and `LockfileReader` only calls
  `Lockfile.parse` and resolves pnpm importer paths to names; no
  richest-document-wins or other framing workaround belongs here. The one
  fact it supplies is one the pure parser cannot see: it passes `configOnly`
  for a pnpm lockfile only when the root has no `package.json` (a failing
  `exists` probe counts as present), because an env preamble followed by an
  empty main document is also what an interrupted first install leaves.
- Sorting and file-to-package lookup are not services: sorting is methods on
  the `DependencyGraph` value class (see
  [the graph interface](../interfaces/workspaces-graph.md)), and file
  resolution folds into discovery.

## Public surface

`src/index.ts` is the only re-exporting entry point.[^index-ts] The seven
subsystems each ship their own contract, covered as their own Interface
concepts: [discovery and detection](../interfaces/workspaces-discovery.md),
[the dependency graph](../interfaces/workspaces-graph.md),
[catalogs and the config-dependency seam](../interfaces/workspaces-catalogs.md),
[peer-dependency checking](../interfaces/workspaces-peer-check.md),
[duplicate-copy checking](../interfaces/workspaces-duplicate-check.md),
[git integration and snapshots](../interfaces/workspaces-snapshots.md), and
[the release surface](../interfaces/workspaces-release.md).

`Workspaces.ts` exposes the composites (`layer`, `layerWithConfigDependencies`,
`layerWithConfigDependenciesSubprocess`, `layerWithGit`,
`layerWithGitAndConfigDependencies`,
`layerWithGitAndConfigDependenciesSubprocess`, and `layerWithGitAndHooks` over a caller-supplied hooks layer), the one-call manifest path
(`resolverLayer`, `resolveManifest`), and `localExecLayer`. The git
composites take `WorkspacesGitOptions` — `WorkspacesOptions` plus
`WorkspaceSnapshotsOptions` — which is how a layer-level `seedCatalogs`
reaches `at(ref)` without hand-composing the graph.[^workspaces-ts]
`Workspaces` is a
static class with a private constructor rather than an `as const` namespace
object, because an `as const` object's member types are inferred in the
built `.d.ts` and lose their TSDoc, while `static readonly` members keep it
with unaffected call syntax.

## The `./testing` subpath

`@effected/workspaces/testing` is the third entry point, beside `.` and
`./node-sync`. It holds three repo-shape checks consumer repositories used to
hand-roll, each a static class with a private
constructor:[^testing-ts]

- `SourceBoundary` (with `Offence`, `OffenceRule`, `SourceScan`,
  `BoundaryRule`, `BoundaryFixture`, `ReferenceOptions` and `ScanOptions`): a
  lexer-backed scanner that flags a `process` read, a forbidden import, a
  `stdout.write`, any console reference (`console`) or one that can reach
  stdout (`console-stdout`), with pure `check` and `referencesProcess`, a
  `scan` over `FileSystem` with whole-file `allow` and per-rule `allowRules`
  exemptions, and shipped positive controls behind `verifyFixtures`.
- `WorkspaceLayering` (with `LayerPolicy`, `LayerPolicyError`, `LayerEdge`,
  `LayeringGraph` and `LayeringReport`): a pure check of a per-field edge
  graph against a committed layer policy, plus `checkWorkspace` over
  discovery.
- `PackedInstall` (with `PackedInstallError`, `PackedInstallResult`,
  `InstalledConsumer`, `PackSource`, `PackedInstallOptions`,
  `PackedInstallClosureOptions`, `PackedInstallBudget`, `BinCommandOptions`,
  `RunBinOptions` (which takes `stdin`; omitted means an immediately ended
  input) and `BinProvenance`): packs a carrier, its closure and any `overrides`,
  then installs it into a scratch consumer under every available package
  manager; `closure` names what a run will pack without packing it,
  `timeoutBudgetFor` budgets a run from its own options, and `preflight` /
  `gate` (with `PackedInstallPreflight`, `PackedInstallPreflightOptions` and
  `PackedInstallGate`) decide run, skip or fail when the prod build is
  missing.

The contracts are
[the repo-shape checks interface](../interfaces/workspaces-repo-shape-checks.md).
Why they live here is
[D5](../decisions/repo-shape-checks-live-in-workspaces-testing.md); why the
default pack source is the prod npm directory is
[the pack-source decision](../decisions/packed-install-pack-source.md); and
why this repository's own layering check reads runtime fields only is
[the runtime-edge decision](../decisions/kit-layering-checks-runtime-edges.md).

`src/index.ts` never re-exports `./testing`, and the reachability test in
`__test__/entrypoints.test.ts` pins that. No new dependency came with it: the
subpath uses `@effected/glob`, `@effected/npm`, `@effected/commands`,
`@effected/yaml` and core `effect` only. None of its modules reads `process`, imports `node:` or writes
to the console; every `process` value arrives as a parameter from the
consumer's test file, and the package's self-scan enforces it with the
scanner it ships.

The built modules' raw byte sizes, measured on 2026-09-24 with `wc -c` over
`dist/prod/npm/pkg` after a clean `pnpm build --filter @effected/workspaces`
(unminified ESM, TSDoc comments kept); the two `PackedInstall` rows were
re-measured the same way on 2026-09-25, after overrides, `closure` and
`command` landed:

| Module | Bytes |
| --- | --- |
| `testing.js` | 1,151 |
| `SourceBoundary.js` | 18,272 |
| `LayerPolicy.js` | 5,576 |
| `WorkspaceLayering.js` | 7,855 |
| `PackedInstall.js` | 30,796 |
| `internal/sourceText.js` | 10,369 |
| `internal/packedInstallPlan.js` | 9,621 |
| `internal/dependencyFields.js` | 496 |

`PackedInstall.js` imports `@effected/commands`, `@effected/yaml`, `effect`,
`effect/process` and three local modules. The external imports,
`WorkspaceDiscovery.js` and `PackageManagerName.js` are already loaded by `.`;
`internal/packedInstallPlan.js` is `./testing`-only, and
`__test__/entrypoints.test.ts` asserts `.` never reaches it. So D5's "a
consumer that only needs the pure check must not pay to load `PackedInstall`"
is honoured at the `.`/`./testing` boundary rather than inside `./testing`.

### Spec amendments (phase 3)

The front-end kit's design was amended during phase 3. The amendments
continue phase 2's A1–A10:

- **B1**: `WorkspaceLayering.check` takes a `LayeringGraph` of names and
  per-field edges instead of a node list, because `DependencyGraph` merges
  the four fields (`DependencyGraph.ts:114-120`).
- **B2**: `LayerPolicy` gains `decode` and `load` and a `LayerPolicyError`
  (`read`, `json`, `decode`), because `SchemaError` never escapes a decode
  boundary (this concept's "Error handling"). Decoding is strict (reversed
  from the original B2 leniency in the final review): an unknown key fails
  `decode` naming it, `$schema` is always accepted, and a file's own keys
  (systems' `harness`) pass through `allowKeys`.
- **B3**: `LayeringReport.offenders` carries `{ edge, reason }` over five
  reasons, and edges are drawn by dependency name, not protocol
  (`WorkspaceLayering.ts`).
- **B4**: `SourceBoundary.scan` returns a `SourceScan` of `files`, `allowed`,
  `offences` and `waived` (the offences an `allowRules` glob waived), so an
  empty or mistyped root, or a stale waiver, cannot read as clean, and
  gains `check`, `fixtures` and `verifyFixtures` (`SourceBoundary.ts`).
- **B5**: `referencesProcess` never counts strings, template text, regex
  bodies, comments or other objects' members, always counts `globalThis`,
  spread and computed access, exempts `process.env.__PACKAGE_VERSION__`, and
  documents its misses (`SourceBoundary.ts`).
- **B6**: `PackedInstall` reuses neither `PackagePublish.pack`, which writes
  into the package directory (`PackagePublish.ts:317`), nor
  `PackageTarball`, which fetches a published version
  (`PackageTarball.ts:75`).
- **B7**: `run` returns `PackedInstallResult { consumers, unavailable,
  tarballs }` with `require`, `consumerDependencies` and `installTimeout`,
  because a bare consumer array cannot show an all-skipped run
  (`PackedInstall.ts`).
- **B8**: `PackedInstall` is POSIX-only and fails `UnsupportedPlatform`
  otherwise, because `.bin` entries are shell shims and the manifest read
  shells out to `tar`.
- **B9**: the design's forbidden edges are runtime edges, so test-only
  devDependencies may point up
  ([the runtime-edge decision](../decisions/kit-layering-checks-runtime-edges.md)).
- **B10**: D5's cost clause is honoured at the `.`/`./testing` boundary, as
  the byte record and import list above show (`__test__/entrypoints.test.ts`).
- **B11**: `packFrom` defaults to probe P3's outcome, `{ directory:
  "dist/prod/npm/pkg" }`
  ([the pack-source decision](../decisions/packed-install-pack-source.md)).

## WorkspacesSync — the escape hatch

Two synchronous functions in `src/WorkspacesSync.ts`
(`findWorkspaceRootSync`, `getWorkspacePackagesSync`), positional-path-first
with an options bag second, and the cwd is required — the module reads no
ambient cwd, because Vitest's config-time project discovery cannot
await.[^workspaces-sync-ts] Both entry points drive the same worklist-based
traversal state machine (`src/internal/traverse.ts`) that the Effect
enumerator uses, so a globstar means the same thing in both worlds; the one
deliberate divergence is at a bound, where the Effect path fails typed and
the sync path truncates.

`getWorkspacePackagesSync` is total — it has no error channel to fail a bad
manifest through — so a member it cannot use is instead reported through an
optional `onSkip` callback as a `WorkspaceDiscoverySkip`, naming the path and
the same `kind` vocabulary a typed `WorkspaceDiscoveryError` would use. A
caller that omits `onSkip` gets the old behavior back exactly: the skip is
dropped, nothing is logged in its place. Before this existed, a fixture with
one unusable manifest enumerated as a plausible empty array, indistinguishable
from "no workspaces configured" — the failure mode issue #605 named.

The design rule binding every sync escape hatch in the kit is that the
package never imports `node:*` on its main path and never assumes POSIX — a
sync surface takes its platform from its caller. The options bag carries
minimal structural filesystem and path interfaces that Node's built-ins
satisfy verbatim, so Windows correctness is the consumer's responsibility:
passing a win32-appropriate path implementation. A volume from
`@effected/memfs` satisfies `SyncFileSystem` structurally, with neither
package importing the other, which is the sanctioned way to test code
sitting on these two functions with no tmpdir and no disk.

`readDirectoryWithTypes` is one optional port member, a pure cost
optimization collapsing a readdir-then-stat-per-entry shape into a single
`readdirSync(path, { withFileTypes: true })`; omitting it falls back to the
four required operations with identical results.[^workspaces-sync-ts] The
fast path re-resolves symbolic links through the port's `isDirectory`
rather than trusting the `Dirent`, because a `Dirent` describes the entry
itself and a link pointing at a directory would otherwise report
`isDirectory: false`, silently dropping every symlinked package directory —
enumeration follows links since a symlinked package is still a package,
while other walkers in the kit must not, because in a pnpm workspace
`node_modules` is a farm of links into the content-addressed store.

The `./node-sync` subpath is the package's second entry point, published
only there and never re-exported from `.` — re-exporting would drag
`node:fs` and `node:path` into every consumer, including the ones supplying
their own ops precisely to avoid them.[^node-sync-ts] See
[the second-entrypoint decision](../decisions/second-published-entrypoint.md)
for the general rule this package's split follows, and
[the escape-hatch decision](../decisions/workspaces-sync-facade-escape-hatch.md)
for why the whole `*Sync` family is named and shaped this way.

## Error handling

The package's own `Schema.TaggedError` types carry structured fields, with
every discriminant a `Schema.Literals` and every cause a `Schema.Defect()`.
Errors from dependency packages arrive and surface alongside this package's
own rather than being re-wrapped: git's typed errors under change detection,
lockfiles' parse error under the reader, and npm's resolution and assembly
errors under the resolver layers. Per-method error unions stay narrow and
are exported as type aliases; `SchemaError` never escapes a decode boundary
— it is always normalized into the domain error with the parse detail
preserved on the cause.

## Lazy init

Layer construction is O(1); the heavy first-call IO (root find, manager
detect, read, parse) is memoized, with init errors surfacing from each
method's own error channel, so a test reporter that builds the layer per
call site pays nothing. The memo is not bare `Effect.cached`, because
`cached` memoizes the first `Exit` including an interrupt — an init
interrupted by an unrelated timeout or a racing sibling would permanently
poison the layer with a cause outside its declared error channel. The init
memo is success-only, via an infinite-TTL cache with an exit hook that
invalidates on any non-success: success is computed once across sequential
and concurrent observers, and a failure or interrupt retries on the next
call.

## Observability

Named `Effect.fn` spans sit on public fallible boundaries only, uniformly,
with a dedicated log-annotation namespace and Debug-level-only default
silence. There are no metrics.

## Hardening

The package reads a filesystem, not a hostile string, but a filesystem is
still an untrusted, potentially cyclic input, and the package parses text:

- The enumerator is a worklist, not a recursion, bounded by an
  integer-guarded depth cap, a visited-directory budget, and the prune
  list; a symlink cycle terminates at the depth cap.
- Cycle detection is iterative — an explicit stack, no stack-overflow
  surface — using core's `stronglyConnectedComponents`, which is stack-safe
  by its own construction (Kosaraju over explicit stacks).
- YAML and JSON parsing fail typed: every `JSON.parse` is wrapped at the
  point it can throw.
- Malformed input fails typed, never a defect.
- Developer wiring errors (an uncompilable pattern literal, a fractional
  depth cap) stay defects.

## Testing

Suites use suite-boundary `layer(...)` blocks, never a per-test
`Effect.provide`; a suite-boundary layer cannot vary per test, so each
distinct fixture tree gets its own `layer(...)` block. The whole package
tests without a platform package: core's path layer and a real in-memory
volume from `@effected/memfs` (a devDependency) drive discovery,
enumeration, and detection — the fixture helper seeds a volume from a
`Tree` record and injects its misbehaviours as faults — and git-dependent
tests use `@effected/git`'s own shipped double, so nothing needs a
repository on disk. Fixtures are chosen to discriminate: the per-root
discovery tests stand up two workspaces that disagree on membership and
versions, because roots that agree cannot tell a re-read from a re-root,
and the `pnpm peers check` oracle is committed output, never a live
subprocess (see [peer-dependency checking](../interfaces/workspaces-peer-check.md#the-differential-oracle)). One integration test discovers this repository
for real, which is the proof the stack composes against a real pnpm
workspace and is what originally surfaced the config-dependencies
lockfile-framing shape now owned by `@effected/lockfiles`.

Three `./testing` suites run against real things by design:

- `__test__/integration/SourceBoundarySelf.int.test.ts` scans this package's
  own `src/` with `SourceBoundary`, holding the `./testing` modules to the
  no-`process`, no-`node:`, no-console rule while finding the real reads
  elsewhere in the package.
- `__test__/integration/layering.int.test.ts` checks this repository's
  package graph against `lib/configs/layers.json`, with a positive control
  for every design-forbidden edge and an all-field acyclicity assertion.
- `__test__/e2e/PackedInstall.e2e.test.ts` drives the real npm, pnpm and bun
  (and yarn where present) against a fixture workspace it generates, with
  every spawn behind a dead proxy and corepack's network off. It is the only
  suite allowed to run a live package manager.

An unstubbed service-double member dies as a defect rather than being
absorbed by `Effect.catch` or any typed-error handler — code under test with
a best-effort catch around discovery or snapshot reads would otherwise make
a mandatory stub look optional, taking the catch branch and passing
green with an incomplete stub. The filesystem double delegates by default
instead, because the filesystem is not the thing under test, and a
deny-by-default volume would break the fixture every time the code under
test grew a new call.

## Build

`savvy.build.ts` carries a suppression scoped narrowly to the
`ae-forgotten-export` diagnostic on symbols matching `_base`, for the
synthesized bases api-extractor generates for class factories.[^savvy-build-ts]
That narrow scope has proven itself: a `@public` signature once named a
module-private interface, and the build correctly reported it as a genuine
forgotten export the narrow pattern did not mask, because that was real
surface a consumer needed to construct, so it was made public rather than
suppressed.

## See also

- [Workspaces discovery](../interfaces/workspaces-discovery.md)
- [The dependency graph](../interfaces/workspaces-graph.md)
- [Catalogs and the config-dependency seam](../interfaces/workspaces-catalogs.md)
- [Peer-dependency checking](../interfaces/workspaces-peer-check.md)
- [Duplicate-copy checking](../interfaces/workspaces-duplicate-check.md)
- [Git integration and snapshots](../interfaces/workspaces-snapshots.md)
- [The release surface](../interfaces/workspaces-release.md)
- [The sync-facade escape-hatch decision](../decisions/workspaces-sync-facade-escape-hatch.md)
- [The contract-inversion decision](../decisions/contract-inversion-default.md)
- [The second-published-entrypoint decision](../decisions/second-published-entrypoint.md)
- [The repo-shape checks](../interfaces/workspaces-repo-shape-checks.md)
- [D5: the repo-shape checks live in `@effected/workspaces/testing`](../decisions/repo-shape-checks-live-in-workspaces-testing.md)
- [The pack-source decision](../decisions/packed-install-pack-source.md)
- [The runtime-edge layering decision](../decisions/kit-layering-checks-runtime-edges.md)
- [Gotcha: ReleaseTag's strict-SemVer default](../gotchas/releasetag-strict-semver-default.md)
- [Gotcha: the publishability detector diagnoses late](../gotchas/publishability-detector-diagnoses-late.md)
- [Limitation: PeerCheck cannot answer yarn](../limitations/workspaces-peer-check-yarn-and-suppression-axes.md)
- [Limitation: under the no-op hooks layer, a hook-injected catalog bump between refs is invisible to a snapshot diff](../limitations/workspaces-snapshot-hook-catalog-bump-between-refs.md)

[^package-json]: `packages/workspaces/package.json` — the `dependencies`,
    `peerDependencies`, and `exports` blocks.
[^internal-catalogs-ts]: `packages/workspaces/src/internal/catalogs.ts:1-12` —
    the header comment and the four `@pnpm/catalogs.*` imports.
[^index-ts]: `packages/workspaces/src/index.ts` — the package's only
    re-exporting module.
[^node-sync-ts]: `packages/workspaces/src/node-sync.ts:1-25` — the
    `@packageDocumentation` block stating why the subpath exists.
[^workspaces-sync-ts]: `packages/workspaces/src/WorkspacesSync.ts` —
    `SyncFileSystem`, `SyncDirectoryEntry`, and the sync facade functions.
[^savvy-build-ts]: `packages/workspaces/savvy.build.ts:7` — the
    `suppressWarnings` entry naming `ae-forgotten-export` and the `_base`
    pattern.
[^workspaces-ts]: `packages/workspaces/src/Workspaces.ts` —
    `WorkspacesGitOptions`, and `resolverLayer` and `resolveManifest`
    (`static readonly` members near the end of the file).
[^testing-ts]: `packages/workspaces/src/testing.ts` — the third entry point
    and its re-exports.


---
<!-- okf/interfaces/workspaces-discovery.md -->
---
type: Interface
title: "@effected/workspaces discovery and detection"
description: "Root finding, the packages: enumerator, the WorkspacePackage located-member model, and package-manager detection."
status: stable
kind: api
resource: ../../packages/workspaces/src/WorkspaceDiscovery.ts
tags:
  - architecture
sources:
  - id: workspace-discovery-ts
    resource: ../../packages/workspaces/src/WorkspaceDiscovery.ts
  - id: workspace-package-ts
    resource: ../../packages/workspaces/src/WorkspacePackage.ts
  - id: workspace-root-ts
    resource: ../../packages/workspaces/src/WorkspaceRoot.ts
  - id: package-manager-name-ts
    resource: ../../packages/workspaces/src/PackageManagerName.ts
  - id: enumerate-ts
    resource: ../../packages/workspaces/src/internal/enumerate.ts
  - id: traverse-ts
    resource: ../../packages/workspaces/src/internal/traverse.ts
  - id: workspaces-ts
    resource: ../../packages/workspaces/src/Workspaces.ts
  - id: layer-root-ts
    resource: ../../packages/workspaces/src/internal/layerRoot.ts
  - id: workspaces-sync-ts
    resource: ../../packages/workspaces/src/WorkspacesSync.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T21:58:29Z
  body_sha256: 35047509871c75e88a7db5e3c7d92fb06db9faf90957065dfac99af882e625f5
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:49.503Z
---

# @effected/workspaces discovery and detection

Discovery is the half of [`@effected/workspaces`](../modules/workspaces.md)
that answers where the workspace is, what is in it, and which package
manager runs it. The services live in `WorkspaceRoot`,[^workspace-root-ts]
`WorkspaceDiscovery`,[^workspace-discovery-ts] and `PackageManagerName`,
each with its layer in the same module; the
located-member model is `WorkspacePackage`.

## The packages: enumerator

`internal/enumerate.ts` compiles the `packages:` list once, with no options
surface to diverge on, and enumerates the workspace.[^enumerate-ts] Literal
entries fast-path to an exact manifest existence check. Wildcards read from
the compiled enumeration prefix: a single-level read when the pattern cannot
cross segments, and a bounded iterative descent from that prefix when it
can, testing each visited directory's root-relative POSIX path against the
pattern. Excludes drop candidates after positive matching, and a directory
counts as a workspace package only if it holds a manifest.

The descent is a worklist, not a recursion, so it cannot overflow the stack.
It is bounded three ways: an integer-guarded depth cap (so `NaN` and
fractional caps fail as a defect rather than silently enumerating nothing),
a visited-directory budget, and unconditional pruning of `node_modules` and
`.git`. A wildcard whose prefix names a nonexistent directory fails typed.
This exists to fix a real degradation: a trailing globstar could silently
collapse to a single-level wildcard, leaving a nested package undiscovered
with no diagnostic.

### One traversal, two entry points

`internal/traverse.ts` owns the worklist, the dequeue discipline (a head
index, never `Array.shift()`, since `shift()` re-indexes the array on every
dequeue and makes draining a near-budget worklist quadratic), the depth
rule, the visit budget, and the prune list.[^traverse-ts] Both the Effect
enumerator and the [sync escape
hatch](../modules/workspaces.md#workspacessync-the-escape-hatch) drive this
one state machine, and neither re-decides any of it. The depth cap bounds
what is enumerated, not merely what is descended into. The one deliberate
divergence between the two entry points is what happens at a bound: the
Effect path fails typed, and the sync path truncates because it has no
error channel.

## WorkspacePackage

A `Schema.Class` carrying a located workspace member.[^workspace-package-ts]
It keeps a tolerant manifest projection rather than embedding
`@effected/package-json`'s strict `Package` model, because that model
requires a valid name and a parseable semver version — one member with a
non-semver version would otherwise fail discovery for the whole repository.
The as-read manifest record is captured at discovery, so a consumer needing
a field outside the typed slice reads it without a second file read or a
strict decode that can fail on odd manifests; a re-reading manifest method
stays available separately, because its point-in-time refresh semantics
depend on re-reading a captured record cannot provide.

`version` is optional, carried exactly as the manifest has it. A private
monorepo root without a `version` field is the ordinary pnpm shape, and pnpm
itself accepts a version-less private member anywhere in the tree, so the
former `missingVersion` discriminant is gone: `WorkspaceDiscoveryError.kind`
carries only `read`, `invalidJson`, `invalidShape`, `invalidYaml`, and
`missingName`. Absence stays absence (no `"0.0.0"` placeholder, no
present-but-`undefined` key), a string rides through verbatim, and a
`version` that is present but not a string — or present but empty — is
`invalidShape`, because an empty string was never a legitimate pnpm shape
and would otherwise reach a `workspace:` resolution as a bare `^`. A
root-only exemption was rejected because the class type cannot narrow per
member: the public type would have become optional anyway while the
runtime stayed needlessly strict.

`WorkspaceResolver.versionOf` answers the two questions discovery keeps
apart: `Option.none()` for a name that is not a workspace member at all, and
a typed `DependencyResolutionError` with `reason: "no-version"` and no
`cause` for a member that is one but declares no `version` — because the `workspace:` contract reserves `none` for "not a
member", and answering it for a version-less member would read downstream
as exactly that.

`workspaceRoot` is a required carried field, not a derived getter.
Discovery resolved the root before enumerating and the sync facade is
handed it, so dropping it was pure information loss that consumers
repaired by counting `relativePath` segments and re-ascending. The
asymmetry with `manifestRecord`, which defaults to `{}`, is deliberate:
`{}` is an honest "no record", but there is no honest default root, and a
placeholder would hand back a wrong absolute path that a consumer then
resolves configuration against. A `WorkspacePackage` serialized before the
field existed therefore fails decode, which is the conservative direction
because re-running discovery is cheap.[^workspace-package-ts]

`getWorkspacePackagesSync`, the sync facade, has no error channel; its
totality pairs with an `onSkip` diagnostic (`WorkspaceDiscoverySkip`, whose
`kind` is the `WorkspaceDiscoveryError` vocabulary minus `invalidYaml`,
which describes the `pnpm-workspace.yaml` read rather than a manifest) so a
skip is never silent.

## Root finding and discovery

Root finding runs over `@effected/walker`'s upward ascent, inheriting
per-probe error absorption. Markers are checked in priority order: the pnpm
workspace file, then a manifest with a `workspaces` field.

The ascent is bounded on request: `find(cwd, { stopAt, maxDepth })` passes
both straight through to `Walker.ascend`, which already owned the two
concepts. `stopAt` is inclusive — the ceiling itself is probed — and is
resolved to an absolute path before the walk, because the walker compares
it to each ancestor by string equality and an unresolved ceiling would
never match, silently degrading to the unbounded ascent the option exists
to prevent. An unmarked ceiling fails typed with `stopAt` recorded on
`WorkspaceRootNotFoundError`, which is what distinguishes "no root anywhere
above me" from "none below my ceiling".[^workspace-root-ts] The sync facade's
`findWorkspaceRootSync` takes the same `stopAt` (inclusive, resolved through
the consumer's `SyncPath.resolve` at lookup time, a non-ancestor never
matching); being total, it answers `null` where the Effect surface fails
typed.[^workspaces-sync-ts] It takes no `maxDepth`: its ascent is bounded
only by the `dirname` fixpoint and an internal cap.

Every service that resolves a root from its layer options takes the same
ceiling as `stopAt`: `WorkspaceDiscovery`, `LockfileReader`,
`WorkspaceCatalogs` and `WorkspaceSnapshots`. All four resolve through ONE
lookup, so they cannot disagree about which root a layer's options
name.[^layer-root-ts] Pass `stopAt: cwd` and a checkout nested under someone
else's workspace fails `WorkspaceRootNotFoundError` instead of adopting that
workspace, while a checkout that is itself a root still resolves. Discovery's
per-call `infoIn` / `listPackagesIn` / `refreshIn` stay unbounded, because
one layer-level ceiling does not fit an arbitrary caller-named
directory.[^workspace-discovery-ts]

`WorkspacesOptions` extends the per-service option shapes and every
`Workspaces.*` composite hands one options object to every service it builds,
so a composite given `stopAt` fails every root-resolving read consistently.
A hand-built graph that bounds discovery but not the lockfile, catalog or
snapshot service gets a split result instead: discovery refuses the enclosing
workspace while the others adopt it. Give every service the same value, or
use a composite. `Workspaces.localExecLayer` takes `stopAt` too, and a refused
root reads as its ordinary `None`. The default is no ceiling
anywhere.[^workspaces-ts]

The not-found message words the manifest marker as `package.json with a
"workspaces" field`, since a bare `package.json` reads as missing a file a
single-package repository plainly has; the `markers` field and
`WORKSPACE_MARKERS` keep the raw filenames.[^workspace-root-ts]

Discovery reads
the packages list from whichever source the workspace uses, enumerates it,
reads each manifest, and absorbs the longest-prefix file-to-package lookup.

Discovery is bound to one root, and `listPackagesIn` / `infoIn` are the
escape from that binding, not a convenience — a long-lived host such as an
MCP server or a language server resolves its root once at startup and then
serves calls scoped to a git worktree of the same repository, a nested
repository, or another project entirely. These two take a directory,
resolve its root by the same upward walk, and re-read everything beneath
it. The re-read is the point: re-rooting the layer's existing package list
by rewriting each `path` onto the caller's directory would produce
correct-looking paths over the original root's manifests, so a worktree
whose branch adds, removes, or renames a package would silently report the
other branch's membership.

Memoization is per resolved root, kept in a map deliberately separate from
the layer-bound memo, so many directories inside one workspace can share one
discovery without every layer-bound call re-running the root ascent.
`refresh()` clears every per-root memo plus the layer-bound one;
`refreshIn(directory)` drops exactly one, invalidating the cell before
dropping the map reference so a fiber already holding that memo keeps its
own reference rather than replaying a discarded discovery. There is no
eviction policy, because the consuming host's roots are unbounded in
principle but single-digit in practice.

Root resolution takes an optional cwd, read lazily at first use inside a
suspend, so a directory change between provide and first call is honoured;
no service method reaches for the ambient cwd on its own.

## Package-manager detection

Lockfile evidence is the primary signal, because it is what says which
manager actually ran. The workspace tier checks the pnpm workspace file,
then a bun lockfile plus a manifest field naming bun, then a yarn lockfile
plus a manifest field naming yarn, then a `workspaces` field for npm — the
manifest conjunction on bun and yarn disambiguates a stray lockfile in an
npm repo.[^package-manager-name-ts]

Two further tiers close the single-package case, running only after every
workspace marker has missed, which makes the widening strictly additive: a
standalone tier, where a pnpm or npm lockfile stands alone because each is
written by exactly one manager (bun and yarn keep the manifest conjunction,
mirroring the workspace tier exactly), and a declaration tier, where no
lockfile exists at all but a manifest field names one of the four managers
— weaker evidence, consulted last, for a fresh clone before its first
install.

The detector refuses to guess: nothing matching is a typed error, never a
fabricated default, because choosing a default is policy, not detection,
and a library that makes that choice silently guarantees some caller is
wrong. A consumer wanting a default writes the fallback where a reader can
see it.

Within the workspace tier the npm `workspaces` field is still consulted
before any standalone lockfile, so a repository with both reports npm; this
known asymmetry is deliberately unchanged, because reordering would be a
behavior change to an already-shipped path.

The two manifest fields that can declare a manager — the top-level field and
`devEngines.packageManager` — are not interchangeable: the dev-engines name
is authoritative for the name where both are present and disagree, and the
top-level field is authoritative for the exact version because it carries
the integrity hash. A version is reported only when the field it came from
names the manager actually detected. A malformed manifest hint is ignored,
never fatal, but a root manifest that is present yet unreadable or
unparseable fails typed, because that is a real problem rather than a
missing hint.

## Test doubles

All three services ship `makeTest` / `layerTest` doubles, so the whole
discovery path stands up with no filesystem at all. The `WorkspaceRoot`
double honours `stopAt` — a hand-rolled `find` that ignores the ceiling
makes a bounded call pass under test and fail live, the very failure the
option exists to catch — and deliberately does not model `maxDepth`,
because it never walks, so there is no depth to cap and pretending
otherwise would encode a fiction; `WorkspaceRootShape` is exported so a
consumer can type a bespoke double against the contract.[^workspace-root-ts]
Both per-root methods
die unstubbed on the double, because deriving `listPackagesIn` from
`listPackages` would model a world in which every root holds the same
members — precisely the confusion the method exists to remove. Workspace
info and detection also die as defects rather than returning a fabricated
default: a double that answered a detection question with a manager would
contradict the defining property of the live detector, which is that it
refuses to guess, and failing typed would be the subtler mistake, because a
detection error reads as a legitimate "no manager here" answer a consumer
branches on and proceeds past.

[^workspace-discovery-ts]: `packages/workspaces/src/WorkspaceDiscovery.ts` —
    the `WorkspaceDiscovery` service, `WorkspaceInfo`, and its error union.
[^workspace-package-ts]: `packages/workspaces/src/WorkspacePackage.ts` —
    `WorkspacePackage`, `PublishConfig`, `DependencyDiff`,
    `WorkspaceManifestError`.
[^workspace-root-ts]: `packages/workspaces/src/WorkspaceRoot.ts` — the
    `WorkspaceRoot` service, `WORKSPACE_MARKERS`, `FindWorkspaceRootOptions`
    (`stopAt` / `maxDepth`), and the `makeTest` / `layerTest` double.
[^package-manager-name-ts]: `packages/workspaces/src/PackageManagerName.ts` —
    `PackageManagerName`, `DetectedPackageManager`, `PackageManagerDetector`.
[^enumerate-ts]: `packages/workspaces/src/internal/enumerate.ts` — the
    compiled-pattern enumerator.
[^workspaces-ts]: `packages/workspaces/src/Workspaces.ts` — `WorkspacesOptions`,
    the composites' one-options-object forwarding, and `localExecLayer`.
[^layer-root-ts]: `packages/workspaces/src/internal/layerRoot.ts` — the one
    layer-bound root lookup the four root-resolving services share.
[^traverse-ts]: `packages/workspaces/src/internal/traverse.ts` — the shared
    worklist traversal.
[^workspaces-sync-ts]: `packages/workspaces/src/WorkspacesSync.ts` —
    `findWorkspaceRootSync` and its `FindWorkspaceRootSyncOptions.stopAt`.


---
<!-- okf/interfaces/workspaces-graph.md -->
---
type: Interface
title: "@effected/workspaces dependency graph"
description: The pure DependencyGraph value class over the discovered package list — the edge index, cycle detection, topological levels, and Mermaid rendering.
status: stable
kind: api
resource: ../../packages/workspaces/src/DependencyGraph.ts
tags:
  - architecture
sources:
  - id: dependency-graph-ts
    resource: ../../packages/workspaces/src/DependencyGraph.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: a675cd9d0ab8017ed30251661b95a771ad50d6525e2be375a0ceb03a44bf2fb8
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:46.601Z
---

# @effected/workspaces dependency graph

`DependencyGraph` is a pure value class over
[the discovered package list](workspaces-discovery.md): the edge index,
cycle detection, topological levels, and Mermaid rendering.[^dependency-graph-ts]
It is not a service — sorting is methods on this class rather than a
separate service, and there is no request-resolver cache, because there is
no batching win on a single-key resolver and nothing the memoized discovery
init has not already deduplicated.

It has lazily-built private edge indexes exposed through total sync
accessors, and fallible boundaries only for the queries that can fail.
Cycle detection is iterative, using an explicit stack rather than a
recursive DFS, so there is no stack-overflow surface on a deep chain.
Kahn's algorithm gives deterministic, lexicographically-sorted level output,
made linear by the reverse-edge index the class already builds.

## Core's Graph is adopted at two call sites, not as the substrate

Core (`effect`) ships a root-level `Graph` module, and this class uses it —
for two derived answers only, over transient graphs built on demand: the
strongly-connected-components computation behind cycle detection, and
`toMermaid`. The edge index, `hasCycle`, Kahn's algorithm, the `levels` /
`sort` / `sortSubset` machinery, the public name-keyed API, and the Schema
contract are all unchanged and hand-rolled. There is no new dependency —
`Graph` comes from `effect` itself, which this package already depends on
as a peer.

Replacing the substrate entirely was evaluated and rejected: it would
replace the trivially-correct part (building two maps out of manifests)
while keeping every part that is actually hard, add a permanent
name-to-`NodeIndex` translation layer beneath an API that consumers address
by package name, and widen this package's dependence on an exact-pinned
prerelease surface for no stability gain. Transient construction at the two
call sites confines that exposure to code that is already failing or
already rendering.

`levels` stays hand-rolled: core's `topo` traversal cannot produce the
parallel-wave boundaries `levels` exists to give, because its walker exposes
no level data and `TopoConfig.initials` only prioritizes zero-in-degree
nodes rather than fencing a wave. Two further gaps rule out wider adoption:
core's traversals throw a `GraphError` rather than failing typed, so a
cycle would arrive as a defect carrying a message instead of the
`CyclicDependencyError` payload this class's callers expect, and
`affectedBy`'s reverse reachability has no core equivalent at all, so the
reverse-edge index stays regardless. The throw is precisely why the two
adopted call sites are the ones they are — `stronglyConnectedComponents`
and `toMermaid` do not throw on any graph this class can hold.

Both transient graphs materialize through one shared helper that adds nodes
in sorted-name order and each node's edges in sorted-target order, so
`NodeIndex` *i* is always the *i*th sorted name and everything derived is
deterministic regardless of manifest key order.

## The cycle payload names the cycle, not the stall

`CyclicDependencyError.cycle` is the sorted union of every strongly
connected component with more than one member, taken from core's
`Graph.stronglyConnectedComponents` — never Kahn's stalled set, which is a
different thing. The stall holds every node that never cleared, including
packages merely downstream of a cycle, so a payload built from it would name
blameless packages and point a consumer reading it as "break one of these
edges" at edges that break nothing. A non-empty stall still signals that a
cycle exists; it is just not the answer to which one. Both failure paths,
`levels` and `sortSubset`, carry the same payload, and self-edges are
dropped at index time, so a one-member component is never cyclic here.

## toMermaid

A total method rendering the graph as a Mermaid `flowchart TD` through
core's `Graph.toMermaid`. Node IDs are the numeric indexes, and package
names appear only inside quoted labels, so a scoped package name never
breaks Mermaid syntax.

[^dependency-graph-ts]: `packages/workspaces/src/DependencyGraph.ts` —
    `DependencyGraph` and `CyclicDependencyError`.


---
<!-- okf/interfaces/workspaces-catalogs.md -->
---
type: Interface
title: "@effected/workspaces catalogs and the config-dependency seam"
description: WorkspaceCatalogs and CatalogSet assembly, the release-age gate, the ConfigDependencySpec value model, and the ConfigDependencyHooks opt-in replay seam over pnpm config dependencies.
status: stable
kind: api
resource: ../../packages/workspaces/src/WorkspaceCatalogs.ts
tags:
  - architecture
  - compat
sources:
  - id: workspace-catalogs-ts
    resource: ../../packages/workspaces/src/WorkspaceCatalogs.ts
  - id: config-dependency-hooks-ts
    resource: ../../packages/workspaces/src/ConfigDependencyHooks.ts
  - id: internal-catalogs-ts
    resource: ../../packages/workspaces/src/internal/catalogs.ts
  - id: config-dependency-resolution-ts
    resource: ../../packages/workspaces/src/internal/configDependencyResolution.ts
  - id: config-dependency-fetch-ts
    resource: ../../packages/workspaces/src/internal/configDependencyFetch.ts
  - id: config-dependency-spec-ts
    resource: ../../packages/workspaces/src/ConfigDependencySpec.ts
  - id: config-dependency-spec-grammar-ts
    resource: ../../packages/workspaces/src/internal/configDependencySpecGrammar.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T07:39:04Z
  body_sha256: 6448337dd46b05bfe8ef28a056528d838dca14189442241ff9c962a8ad0dac8a
---

# @effected/workspaces catalogs and the config-dependency seam

Catalog assembly is where [`@effected/workspaces`](../modules/workspaces.md)
turns a workspace's several declaration sources into one resolvable set, and
where pnpm's config-dependency hooks are replayed to get the parts no file
records. Three outputs come off one memoized pass: the catalogs themselves,
the release-age gate, and the peer-dependency rules
[`PeerCheck`](workspaces-peer-check.md) needs.

## WorkspaceCatalogs and CatalogSet

`CatalogSet` is the immutable, fully-normalized catalog collection with one
resolution semantic, carrying statics for its three sources.[^workspace-catalogs-ts]
`WorkspaceCatalogs` assembles it with pnpm's precedence and memoizes. The
reader is package-manager-aware: file presence picks the reader, with the
pnpm workspace file taking the pnpm path and its absence falling to the root
manifest's bun-style catalog fields; lockfile catalogs are
package-manager-aware too, since pnpm and bun both carry them.

The catalog readers hard-fail by design, because their output is
load-bearing for diffing — a silently-empty read is the "every dependency
looks added" bug. A present-but-malformed shape fails typed, while an
absent or explicitly-null field yields empty, and a default catalog
declared twice is rejected, checked structurally so an explicitly-declared
empty catalog still counts as a declaration. This is a deliberate contrast
with [package-manager detection](workspaces-discovery.md#package-manager-detection),
which degrades gracefully on malformed hints because it is a heuristic with
a fallback chain, while the catalog readers' output is load-bearing. The
two live inline readers share one validator, so they fail typed on exactly
the same conditions rather than one hard-failing and the other normalizing
to `{}`; the at-ref readers a snapshot uses are deliberately tolerant of
the same shapes. The presence probe that picks the reader also
distinguishes genuine absence from a probe failure: a non-`NotFound`
`PlatformError` from the existence check fails typed rather than collapsing
to "absent" and selecting the wrong reader.[^workspace-catalogs-ts]

The workspace's effective pnpm release-age gate folds the inline config
keys and the hook contributions strictest-wins through `@effected/npm`'s
combining vocabulary, reusing the single memoized assembly pass so config-dependency
code runs exactly once. Present-but-malformed inline values hard-fail, the
same posture as a malformed inline catalog block. There is deliberately no
top-level convenience wrapper for it — the service method is the surface.

`WorkspaceCatalogs.peerDependencyRules()` returns the merged
peer-suppression rule set — the `pnpm-workspace.yaml` block seeded through
the hook replay — which is the input
[`PeerCheck`](workspaces-peer-check.md) needs to reproduce pnpm's
suppression. It is a sibling method rather than a second assembly pass,
which is what keeps config-dependency code running exactly once; an absent
block yields `NoPeerDependencyRules`, an assertion rather than a gap. That
call-site read is pinned by an integration test rather than a seam unit
test, because computing the rules inside the replay and then dropping them
at the call site would compile, pass every seam test, and return an empty
set indistinguishable from "this workspace declares none" — the
discard-by-projection defect the seam itself once had. Every
`WorkspaceCatalogs.layer*` static delegates to one builder,
`layerWithHooks(hooks, options)`, which is also how a test reaches
`layerFrom` through the real graph.

`src/internal/catalogs.ts` is the only module in the package that imports
`@pnpm/catalogs.*`.[^internal-catalogs-ts]

## ConfigDependencySpec — one configDependencies value

`ConfigDependencySpec` models one `configDependencies` value from
`pnpm-workspace.yaml`: an exact `version` (`@effected/semver`'s `SemVer`,
prereleases allowed, build metadata refused) and an optional SRI
`integrity`.[^config-dependency-spec-ts] It reads the bare form pnpm 11 and
12 write (`0.11.1`, the integrity living in the lockfile) and the deprecated
inline form (`0.11.1+sha512-<base64>`) that workspaces in the wild still
carry. The integrity field's schema IS `@effected/npm`'s `SriIntegrityHash`,
asserted by object identity in the suite.

- `parseResult(spec)` is the sync primitive under `parse`, failing with
  `InvalidConfigDependencySpecError`. Its `reason` is `"version"` for a
  range, dist-tag, partial, `v`-prefixed or padded version, and
  `"integrity"` for a tail that is not an SRI hash, a corepack
  `sha512.<hex>` tail and an empty `0.11.1+` tail included.
- `bare` renders `<version>`, the form to write when normalizing the field.
- `toString()` renders the form that was parsed, so a spec a tool only
  reads round-trips byte for byte. `FromString` is the matching string
  codec, encoding through `toString()`.

Only the **first** `+` separates version from integrity, because an SRI's
base64 alphabet contains `+` itself. That split lives in one internal
module, and the strict model and hook replay both call it rather than
re-deriving it.[^config-dependency-spec-grammar-ts]

## ConfigDependencyHooks — the opt-in replay seam

A contract service with four layers: an in-process layer that dynamically
imports each config dependency's pnpmfile and replays its config hooks over
the inline-catalog seed, a subprocess twin for bundled consumers, a
no-execution stand-in, and a hermetic `layerFrom` that replays
caller-supplied files with no resolution at all.[^config-dependency-hooks-ts]

The default composites wire the no-op layer — they never execute
config-dependency code, on the worktree side or the ref side; opting in is
an explicit composite choice. Opting in must not cost the git tier: a git
composite that hard-wired the no-op catalogs layer would force a consumer
wanting snapshots plus change detection plus hook replay to rebuild the
whole service graph by hand, so the git composites and their subprocess
twins are built over one internal helper that takes the hooks layer
explicitly and hands the same reference to both `WorkspaceCatalogs` and
`WorkspaceSnapshots` — one memoized layer, one policy for both sides of a
diff, and never a member of the public `WorkspacesServices` output. On the
git composites the subprocess variant is free, because its extra
requirement — core's `ChildProcessSpawner` — is already required for `Git`.

### The replaying layers resolve the declared version

Every replaying layer loads the pnpmfile of the version a
`configDependencies` entry declares — the text before the first `+` of its
`<version>+<integrity>` value, or the whole bare `<version>` — never
whatever `node_modules/.pnpm-config` happens to hold now. Replay takes that
text through the shared splitter but deliberately validates neither half,
unlike `ConfigDependencySpec`: it only matches the text against installed
manifests, store directory names and caller-supplied map keys, so an
unparseable version finds nothing and fails closed with the ladder's own
remediation. Adopting the strict model's rejections would newly fail
replay on specs it resolves today — a malformed integrity it never reads,
or a map key that is not strict SemVer. That entry is a
symlink into the pnpm store's `links/` tree, and the store keeps every
version ever installed on the machine, so a past ref's pnpmfile is
usually recoverable with no checkout, no fetch and no registry.[^config-dependency-resolution-ts]
The ladder runs in the parent for both replaying layers: the installed
copy when its manifest carries exactly the declared version; otherwise the
store's `links/<name>/<version>/*/node_modules/<name>` with the inner
manifest verified rather than the path trusted, the store located from
`.modules.yaml`, then the realpath of any `.pnpm-config` entry, then the
conventional environment and platform locations; otherwise, under the
subprocess layer alone, a verified fetch into the store (below); otherwise
a typed, fail-closed `hooks` assembly error with `reason: "notInstalled"`,
naming the package, the declared version and the ref that declared it,
what is installed, the stores searched and the remediation
(`pnpm add --config <name>@<version>` in a throwaway workspace). Two
honest store copies of one version in one store fail closed too, as
ambiguous: the hash directory is not derivable from the declared integrity
and the store records none, so the ladder names the store and both copies
rather than guessing which code to execute — while discovered stores are
deduplicated by realpath and the decision is scoped to the first store that
holds the version, so an aliased spelling or a second store never reads as
a second copy; the environment rung lists store formats newest first,
numerically, so `v11` outranks a `v10` a pnpm upgrade left behind. In the
resolved directory the first of `pnpmfile.mjs`, `pnpmfile.cjs`,
`pnpmfile.js` present in one directory listing is loaded; a listed but
unreadable file fails typed at import time, never as "ships no hook", and
a dependency shipping none contributes nothing. The ladder reads the real disk through `node:fs`
rather than the effect `FileSystem`, because the store is real even when a
caller's filesystem is virtual; `layerFrom` is the seam for that case,
keyed `"<name>@<version>"` to an absolute path and consulting nothing else.

### The fetch rung (subprocess layer only)

The store holds only what this machine installed, so the base side of a
diff across a config-dependency bump declares a version a fresh checkout
never installed (effected#842). The subprocess layer fetches it rather than
failing: pnpm runs `install --frozen-lockfile` in a scratch workspace,
removed afterwards, whose `pnpm-lock.yaml` env preamble pins the expected
integrity, with `--store-dir` set to the first store the ladder searched
(its parent, since pnpm appends the `v11` segment itself). The replay then
loads the copy the scratch `.pnpm-config` entry links to, and records
`source: "fetched"`; the next replay finds it on the store rung.[^config-dependency-fetch-ts]

The integrity is settled before anything is spawned, fail-closed. Its
sources are the inline `<version>+<integrity>` spec and the declaring
side's lockfile preamble, read through `@effected/lockfiles`'
`PnpmEnvLockfile.configDependencies`. Replay callers pass that side's
lockfile as `HookReplayContext`: the working tree's from
`WorkspaceCatalogs`, the ref's own from `WorkspaceSnapshots.at(ref)`. Two
sources that disagree fail `integrityMismatch`. No source, a non-SRI inline
integrity, or an unreadable lockfile fails `integrityUnavailable`. Nothing
is fetched in any of those cases. Pinning the scratch lockfile, rather than
hashing the result afterwards, is deliberate: the store records no
integrity beside a `links/` entry, so nothing after the fact could check
it, while pnpm checks the tarball against the pinned lockfile and refuses a
mismatch even from a warm store. That was probed on pnpm 11.27.1 and
12.6.0. Two guards cover a pnpm that did not honour the pin: the scratch
lockfile must be byte-identical afterwards, and the linked copy must be a
store entry for exactly that version. Any fetch failure, pnpm's own
integrity refusal included, fails `fetchFailed` with the not-installed
remediation. The in-process layer never fetches, because it has no
subprocess seam.

The scratch fetches through the declaring workspace's registry config, since a
scratch under the OS temp dir would otherwise see only user-level config and a
config dependency behind a scoped registry, a mirror or repo-level auth would
fail `fetchFailed` against the public registry. `<root>/.npmrc` is copied in
as-is, never read or logged, with `${VAR}` references left for pnpm to expand,
and it is removed with the scratch. The root `pnpm-workspace.yaml`'s `registry`
and `registries` keys are carried into the scratch's own; those are the only
registry keys pnpm 11.27.1 and 12.6.0 read from the workspace yaml, since a
flat `@scope:registry` key there is ignored and `npmrcAuthFile` is refused at
project level. `root` is the current checkout for both sides of a diff: a base
ref's `.npmrc` is not read through git, because registry config says where
this machine fetches from, not what a ref declared. Relative paths inside the
`.npmrc`, a `cafile=./ca.pem` for instance, resolve against the scratch and
not the root.[^config-dependency-fetch-ts]

Assembly precedence is lockfile, then inline, then hook-injected, merged
per-dependency within a catalog, with the hooks seeded by the inline
catalogs — matching pnpm's own behavior. Failure is typed, never silent: a
config dependency that fails to load or replay fails with a hooks-sourced
assembly error. The security guard rejects a dependency name containing a
`..` path segment before building the import target, so a malicious entry
cannot escape the intended directory.

The replay returns a structured injection, `HookInjection`, carrying four
slices: `catalogs`, `releaseAge`, `peerDependencyRules`, and `replays` —
the version and resolution rung (`HookReplaySource`) each declared
dependency was replayed from, recorded even for one that ships no pnpmfile
and exposed by `WorkspaceCatalogs.hookReplays()` off the same memo, empty
where config dependencies do not exist. The rung is live, machine-local
provenance; a snapshot keeps only the version. A sibling
method computing any one slice separately would re-execute
config-dependency code — the whole point of the seam is that one replay
over one mutable config object yields every output, exactly as pnpm replays
hooks. Release-age keys thread last-hook-wins, read off the one final
threaded config object, matching pnpm's single-mutable-config-object
behavior; a malformed release-age value is tolerantly dropped, keeping the
prior threaded value, because the assembly error stays reserved for a load
or replay mechanism failure, not a hook's returned data. Peer-dependency
rules are seeded, not merged: the workspace file's block goes in as the
threaded config's initial value, and whatever the hooks return comes back
out — a hook that overwrites overwrites for pnpm too, and this must never
be "fixed" into a kit-owned merger, which would be a second, divergent
implementation of a rule pnpm already owns. See
[peer-dependency rules](workspaces-peer-check.md#peer-dependency-rules-pnpms-suppression-policy-seeded-not-merged)
for the full rationale. Each rules axis threads independently, so a hook
that rewrites `allowedVersions` and leaves `ignoreMissing` alone — or
returns one axis malformed — cannot blank the others.[^config-dependency-hooks-ts]

### layerSubprocess

In-process replay is unreachable in a bundled consumer, because the
in-process layer computes its import target at runtime and a bundler
compiles a computed dynamic import into a context module that resolves
against a build-time directory listing, throwing a module-not-found error
at runtime. This layer is the same replay with every computed load moved
out of the bundle graph.

The replay program is a static string constant, passed via argv: static is
the whole mechanism, since a bundler rewrites the program text it can see,
so the text carries no interpolated runtime value — the root, the seed, and
the parent-resolved name-to-path pairs travel as arguments, never spliced
into the script, and the spawn uses no shell so argv is argv. Typed-semantics
parity with the in-process layer is the contract, pinned by integration
tests rather than by intent: the same declared-version ladder run in the
parent, the same pnpmfile candidate order, the same hook-locator shapes, the
same synchronous hook call, and the same tolerant threading; the child
performs no lookup of its own, so any import failure it reports is a real
load failure.

Per-dependency error attribution crosses the process boundary: the child
prints one final JSON line naming the offending dependency and exits through
the write callback so the payload flushes even if a hook left the event
loop occupied. The parent decodes that envelope through a strict union with
`@effected/commands`' JSON-line runner, which owns the last-line framing and
its noise tolerance, so a hook's own logging is not fatal. The `..`-segment
guard runs before any spawn, strictly earlier than the in-process guard,
never later, and empty config dependencies spawn nothing. Folding and
normalization stay in the parent — the child returns only the raw threaded
config slice, because the script cannot import kit code and duplicating
catalog semantics into a string literal is exactly the drift this package
refuses elsewhere. Transport failure is typed, never silent: a missing
runtime, an exit with no usable payload, or unparseable output are all
assembly errors.

[^workspace-catalogs-ts]: `packages/workspaces/src/WorkspaceCatalogs.ts` —
    `CatalogSet`, `WorkspaceCatalogs`, `ImporterVersions`,
    `CatalogAssemblyFailure`.
[^config-dependency-hooks-ts]: `packages/workspaces/src/ConfigDependencyHooks.ts` —
    the contract, `HookInjection`, `PeerDependencyRules` /
    `NoPeerDependencyRules`, `layerNoop` / `layerLive` / `layerSubprocess` /
    `layerFrom`.
[^config-dependency-resolution-ts]: `packages/workspaces/src/internal/configDependencyResolution.ts` —
    `resolvePnpmfiles`, `lookupPnpmfiles`, the store-discovery rungs and
    the fail-closed message.
[^config-dependency-fetch-ts]: `packages/workspaces/src/internal/configDependencyFetch.ts` —
    the fetch rung, `expectedIntegrity`, the scratch workspace and its guards.
[^config-dependency-spec-ts]: `packages/workspaces/src/ConfigDependencySpec.ts` —
    `ConfigDependencySpec`, `InvalidConfigDependencySpecError`.
[^config-dependency-spec-grammar-ts]: `packages/workspaces/src/internal/configDependencySpecGrammar.ts` —
    `splitConfigDependencySpec` and the header comment on the two policies
    over it.
[^internal-catalogs-ts]: `packages/workspaces/src/internal/catalogs.ts:1-12` —
    the header comment and the four `@pnpm/catalogs.*` imports.


---
<!-- okf/interfaces/workspaces-peer-check.md -->
---
type: Interface
title: "@effected/workspaces peer-dependency checking"
description: PeerCheck — a lockfile-only reproduction of pnpm peers check, returning a report rather than an array and failing closed on what it cannot verify.
status: stable
kind: api
resource: ../../packages/workspaces/src/PeerCheck.ts
tags:
  - architecture
  - testing
sources:
  - id: peer-check-ts
    resource: ../../packages/workspaces/src/PeerCheck.ts
  - id: peer-fixtures
    resource: ../../packages/workspaces/__test__/fixtures/peers/README.md
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T21:38:36Z
  body_sha256: 5e3f480d91f2191709cf47d71363fae26e6ad7529fca9fa5bfc96e81ac513b2c
---

# @effected/workspaces peer-dependency checking

`PeerCheck` computes a workspace's unsatisfied peer dependencies from a
parsed `@effected/lockfiles` `Lockfile`. It is a pure value class — no
service, no layer, nothing in `R`, no error channel — alongside
`DependencyGraph`, `VersioningStrategy`, and `ReleaseTag`.[^peer-check-ts]

It reads the resolved graph rather than shelling out to each package
manager's own peer command, because that approach does not survive contact
with bun: bun has no peer command at all, and its only signal is a stderr
line emitted by the install that changes the tree, so a check step running
after install sees nothing to parse. npm additionally hard-fails a peer
conflict before it can be inspected. Every format, meanwhile, records the
declarations, and the lockfile's instance model records what resolved, so
one format-free algorithm serves all of them — no per-format branch exists
in this module, and none may be added.

The walk starts at each importer's resolved dependencies and follows
`resolved` edges, so a peer declared by a transitive dependency is
attributed to the importer that pulls it in, with the chain carried in
`parents`, mirroring how pnpm attributes them.

## The surface is a report, not an array

`PeerCheck.run(lockfile, options?)` is a total static returning the value
class itself. Its options are three keys, each supplied from what the caller
already has: `peerDependencyRules` (from
`WorkspaceCatalogs.peerDependencyRules()`), `workspacePackages` (from
`WorkspaceDiscovery`) and `catalogs` (from `WorkspaceCatalogs.set()`). The
report carries `supported`, `unsatisfied`, `unresolvedImporters`,
and `unverified`, plus a `required` getter narrowing `unsatisfied` to the
non-optional rows. An `UnsatisfiedPeer` row names the importer, the peer,
what was wanted, what was found (`null` when nothing resolved at all),
whether it is optional, and the `parents` chain from the importer to the
declaring package.

A row is one per `(importer, peer, declaring instance)`, never one per
parent chain — pnpm's own collapse rather than a convenience: when a single
importer reaches one package through two different parents, `pnpm peers
check --json` emits that instance's unsatisfied peer once, carrying the
chain it reached first and saying nothing about the other. So `parents` is
*a* route to the declaring package, not the set of routes, and a consumer
must not read it as exhaustive.

The report shape exists because a bare array would make every limitation
below indistinguishable from a clean workspace, so each limit occupies a
field of its own and a consumer has to walk past it deliberately.

## Limits are surfaced in the value, never swallowed

An empty result is the most dangerous success shape in this domain — it is
indistinguishable from "this could not be checked" — so the return is a
report, not an array:

- **yarn cannot be answered.** It resolves peers virtually, giving a
  peer-bearing package one `@virtual:` locator per consumer, and the
  lockfile does not record which instance satisfied which peer.
  `supported: false` says so.
- **The npm and bun root importer cannot be joined to instances.** Neither
  records a resolved version per importer dependency, and neither emits a
  package row for the root. Those importers are named in
  `unresolvedImporters` rather than passing silently. pnpm records the
  version and is unaffected.
- **pnpm records no peer declarations for workspace projects themselves**,
  so a pnpm workspace package's own unsatisfied peers are not in the
  lockfile at all, and `pnpm peers check` does not report them either. npm
  and bun do record them, so under those managers `PeerCheck` answers a
  question pnpm structurally cannot.

An absent optional peer is satisfied, since that is what optional means,
while an optional peer resolved at the wrong version is still reported with
the flag set.

## Joining an importer to an instance: compose, then verify

The root importer has no package row under any format, so it is joined by
composing the identity its entry describes — `name@version` plus the
recorded `peerSuffix` — and verifying that against the real id set.
Compose-then-verify, never compose-and-hope: a composed identity matching
nothing skips the dependency, and there is deliberately no
name-and-version fallback, because two peer variants of one `name@version`
cannot be told apart without the suffix, and guessing would attribute one
variant's peers to an importer that resolved the other.

## Peer-dependency rules: pnpm's suppression policy, seeded not merged

`PeerCheck` reads the lockfile, but pnpm's verdict is not a pure function of
the lockfile. pnpm computes the same peer violations and then suppresses
the ones `peerDependencyRules.allowedVersions` permits. A checker without
them reports findings pnpm calls clean, which is a false positive of
exactly the class this checker exists to remove.

The root cause is an asymmetry in what pnpm persists: pnpm records
resolution-affecting config into the lockfile and discards
reporting-affecting config. `overrides` contributed by a pnpmfile are
written into the lockfile; `peerDependencyRules` appears in it zero times,
under any spelling — overrides change which tree gets installed and must
therefore be part of the tree's identity, while suppression rules change
only what pnpm *says* about a tree it would have built identically. So a
lockfile-only peer check cannot be correct without external input, by
construction, and the [config-dependency
seam](workspaces-catalogs.md#configdependencyhooks-the-opt-in-replay-seam)
exists to supply that input rather than to guess at it.

The rules have two sources: the `pnpm-workspace.yaml` block and
config-dependency pnpmfiles, which never touch a file, carried as a third
`HookInjection` slice beside `catalogs` and `releaseAge` rather than a new
subsystem. The workspace-file rules are seeded into the threaded config,
not merged afterward, because pnpm hands its own config in and takes back
what the hooks return — "seeded value survives unless a hook replaces it"
*is* pnpm's semantic, and the seam already enforces it. A kit-owned merge
function would be a second, divergent implementation of a rule already
owned elsewhere.

All three axes of the rules are applied — `allowedVersions`,
`ignoreMissing` and `allowAny` — each with semantics measured against pnpm
rather than recalled, because an unmeasured suppression is precisely what
produced the bug this checker exists to remove. `allowedVersions` was
measured against pnpm 11 (below); the two list axes against pnpm 12.5.1,
with every oracle run committed under `__test__/fixtures/peers/allowany/`
and `ignoremissing/`.[^peer-fixtures] Supplied rules therefore never
produce `peerRulesNotApplied`, which is reserved for the case where no rules
were supplied at all; a report can still be unverified through
`unresolvedEdge`, `peerRangeUnresolved` or `peerVersionUnresolved`, which rules do not touch.

### How pnpm matches an allowedVersions key

The key spelling is `parent>peer`, and both halves behave in ways pnpm's
documentation does not state, measured against pnpm 11 on crafted
lockfiles:

- The version qualifier on the parent is ignored — matching is by parent
  name only, so a rule keyed to one version of the parent suppresses every
  version's instance.
- The parent is the declaring package, not an ancestor — a rule keyed on a
  package higher in the chain does not suppress a peer declared further
  down.
- A key with no `>` names no parent and applies to every parent declaring
  that peer.

There are three key spellings, not two: a parent with a version (how
`pnpm:export` materializes the workspace-file block), a parent without one
(how a config-dependency plugin injects it), and no parent at all (pnpm
applies it to every parent declaring that peer). Suppression stays
range-driven under every spelling. A key carrying a `>` with an empty
parent is malformed and suppresses nothing — it must never degrade into the
bare, no-parent case, which would silently widen suppression past what
pnpm does.

A peer satisfied by a workspace package is accepted without a version
check, because pnpm records no version for an importer, so a workspace row
carries the placeholder `"0.0.0"` and any comparison would be against a
placeholder rather than the real version.

### How pnpm matches ignoreMissing and allowAny, and why the axes never cross

The two list axes share one grammar and it is not the `allowedVersions`
key grammar: an entry is a pattern over the **peer name**, with no parent
in it at all. `react-dom>react` is a literal name nothing declares, so it
matches nothing on either axis, versioned or not — the parent-version quirk
above has nothing to attach to. The patterns are `@pnpm/matcher`'s
(restated in `src/internal/peerPatterns.ts` so the `@pnpm/*` edge stays
confined to the catalogs module, with `@effected/npm`'s
`ReleaseAgeGate.matchesExclude` — the same `@pnpm/matcher` grammar, already
owned there for `minimumReleaseAgeExclude` — as the single-pattern
primitive): a lone `*` matches everything; otherwise
`*` is a wildcard within the name and a pattern without one is plain
equality; a leading `!` negates. Composition over a list is order-sensitive
when includes and negations mix — `["*", "!redux"]` is everything but
redux, while `["!redux", "*"]` is everything — and a list holding only
negations matches everything not excluded, so `["!redux"]` alone clears
every other name.

The axes partition the rows on `found` and never cross:

- `ignoreMissing` hides a row where **nothing resolved** for a required
  peer (`found: null`), whether the declarer is direct or transitive. It
  never touches a peer that resolved at the wrong version.
- `allowAny` hides a row where **something resolved outside the wanted
  range**, required and optional alike. It never rescues a missing peer.
- `allowedVersions` hides the same wrong-version rows `allowAny` can, by
  range rather than by name, and cannot rescue a missing peer either.

Both halves of the no-cross rule are pinned by cross-axis oracle runs:
`allowAny: ["react"]` leaves every missing `react` in place, and
`ignoreMissing: ["react", "redux"]` leaves both wrong-version rows in
place.

## Failing closed: the four unverified reasons

The union is closed at exactly four by measurement. With all three rule
axes applied, no supplied configuration leaves a suppression unreplicated;
with `workspacePackages` supplied, a covered `link:` target is a judged
parent rather than a structural unknown; and the one thing a joined manifest
can still withhold is a range the check cannot name, which is what the third
member says; the fourth is the same gap on the provider side, a version the
lockfile does not carry. Each reason follows the same presence-is-the-assertion rule:
omitting an option key says nobody looked, and the report says so.

- **`peerRulesNotApplied`** — no suppression policy was supplied, so
  pnpm's suppression could not be replicated and some rows may be ones
  pnpm hides. Presence of the option key is the assertion, not its
  contents: supplying `NoPeerDependencyRules` asserts the workspace has
  none, while omitting the key says nobody looked. Collapsing those two
  would tell a gate that an unchecked workspace is clean. Supplied rules
  never produce it, whatever their contents — all three axes are applied.
- **`unresolvedEdge`** — two triggers. Some instance records an edge the
  model could not name, so a peer that edge satisfies cannot be verified.
  Such a peer is declined rather than reported: reporting it would be a
  false positive, declining it silently would be a false negative, and
  only doing both halves is honest. Second, an importer dependency
  resolved through `link:` whose target was not judged for that importer:
  a linked parent's manifest peers are never in the lockfile, so they are
  declined rather than fabricated. That covers a target outside the
  supplied `workspacePackages`, every target when the key is omitted, and
  a covered target the walk never read — one the lockfile records no
  workspace row for (a `link:` outside the workspace globs), or one the
  importer's walk did not reach. Covering a path is not judging it; the
  marker clears only for an edge whose target's peers were actually read
  for the importer that recorded it.
- **`peerRangeUnresolved`** — a peer declared by a joined `link:` manifest
  carries a range that is still a protocol specifier, while something
  resolved for that peer, so the comparison was never performed. The
  triggers are a `catalog:` specifier with `catalogs` omitted, a
  `catalog:` specifier the supplied set names nothing for, and any other
  protocol (`workspace:*` and its kin). A peer with *nothing* resolved
  never produces it: "no provider" needs no range, so that row is reported
  as usual.
- **`peerVersionUnresolved`** — a peer resolved to a non-workspace provider
  whose version is a protocol specifier rather than a version: a `file:`
  directory or tarball, directly or through a `file:` override, and a git
  or remote-tarball provider, which pnpm keys by its URL
  (`https://codeload.github.com/…`, `git+https://…`) so the URL stands
  where a version belongs. The lockfile records
  no version for a `file:` directory, and the model carries the specifier
  (`file:vendor/react`) in its place. `pnpm peers check` reports such a peer
  as a `bad` row with the specifier as its found version, even when the
  directory's manifest satisfies the range; for a joined `link:` parent it
  reads the real version off disk instead. Neither is recoverable from the
  lockfile, so the peer is declined without a row and the report carries
  the marker, on the lockfile-row and joined-manifest paths alike. A
  workspace-row provider stays accepted without a version check, and a
  plain unparseable version is still skipped. The `filedep*` oracles pin
  it; a `file:` tarball is where pnpm itself moved, reporting the specifier
  under 12.6.0 and the tarball's real version under 12.7.0, over the same
  lockfile. pnpm 11 writes the same lockfiles and reports every `file:`
  directory provider clean, whatever its version, so the two supported
  majors disagree over identical input and the marker is the one answer
  consistent with both.

All four mean **fail closed**: a gate treats an unverified report as "not
proven clean", never as a pass.

`PeerCheck` reads `resolved` from `@effected/lockfiles`, which omits any
edge whose identity it cannot compose and verify — a rule that keeps this
package from ever being handed a wrong edge, but that means an absent key
carries two different meanings, "nothing resolved" and "something resolved
that could not be named", and this package treats the first as a positive
finding.

## Joining a `link:`-resolved parent

Under pnpm every `workspace:` dependency is recorded `link:`, and pnpm
records no peer declarations for workspace projects, so a linked parent
joins at best to a workspace row whose peers are empty by design — and, for
the root importer, to nothing at all. `pnpm peers check` nonetheless reports
that parent's peers, because it reads the linked manifest on disk.
`PeerCheck` answers the same question without reading the disk, so the
check stays a pure value over its inputs:

- **The manifest comes from the caller.** `workspacePackages` takes the
  discovery output the caller already has, matched to the `link:` target
  by `relativePath` — the POSIX workspace-relative directory the lockfile's
  importer paths are spelled in — or by the package's publish directory.
  pnpm links a workspace dependency INTO `publishConfig.directory` unless
  `publishConfig.linkDirectory` is `false`, which it defaults to true, so
  the lockfile then records `link:../a/dist`. A covered target contributes
  its manifest's declared peers to the walk, named from the manifest
  (`probe-a@1.0.0`, not the row's `packages/a@0.0.0`) in `parents`.
- **A publish-directory link reads the source manifest.** pnpm reads the
  peers from the manifest AT the link target — the built one — while
  `PeerCheck` reads the supplied source manifest and resolves its `catalog:`
  ranges through `catalogs`. The two agree when the build emits the peer
  ranges the source's specifiers resolve to, which is the contract a
  publish-directory build keeps.
- **Providers come from the importer's own dependency set**, which is where
  pnpm resolves them from — never a sibling importer's, and never a
  workspace-wide lookup by name. The consumer's own `react@18.3.1`
  satisfies the linked parent's `^18.0.0` peer; the same version installed
  only by a sibling does not; the consumer's own `react@17.0.2` is a row
  carrying the wrong version as `found`.
- **Attribution stops at a workspace package.** A linked package's manifest
  peers are judged only for the importer that links it DIRECTLY, and a
  linked package's own dependencies — registry or linked — are judged by
  that package's own importer. pnpm never surfaces either on a consumer one
  link further out, so the walk does not continue past a workspace package
  it reached from the importer. Each `link:` edge is therefore cleared by
  the walk of the importer that records it, or keeps `unresolvedEdge`.
- **The root importer's linked targets are walked too.** The root has no
  workspace row under pnpm to reach them through, so the walk seeds its
  covered targets directly and judges them against the root's own
  dependencies as provider context, exactly as for any other importer.
- **A `catalog:` peer range is resolved through `catalogs`**, and the
  resolved range is what is judged and reported as `wanted` — the value
  `pnpm peers check` reports as `wantedRange`. `WorkspaceCatalogs.set()`
  already folds in catalogs a config-dependency hook injects, so the
  caller passes it as-is.

## The differential oracle

See [the yarn limitation](../limitations/workspaces-peer-check-yarn-and-suppression-axes.md)
for the gap this report surfaces rather than swallows.

`pnpm peers check --json` is the reference for peer semantics, and the test
suite checks agreement with it, but the oracle is committed, not executed:
its output is captured at fixture-generation time and stored beside the
lockfile it describes, because this package forbids new local subprocess
seams and a test requiring a live pnpm on `PATH` is neither hermetic nor
reproducible in CI. Agreement is bounded by how the fixtures are made —
every one is generated over a purpose-built workspace with no
config-dependency hooks, so oracle agreement validates the computation only
on workspaces without them.

The `link:` join is pinned by twelve fixtures, and the provider-version
reason by four more (`filedep*`). Six are over one probe workspace
(`linkWorkspacePackages: deep`, `probe-a` declaring a `react: ^18.0.0`
peer), each moving one variable:[^peer-fixtures]

- **`linkdeep/`** — `packages/b` depends on `probe-a` and nothing provides
  react: a missing row for `packages/b`, parents `probe-a@1.0.0`, which
  `PeerCheck` reproduces once the manifests are supplied and declines with
  `unresolvedEdge` when they are not.
- **`linkdeep-provided/`** — `packages/b` also depends on `react@18.3.1`:
  clean.
- **`linkdeep-sibling/`** — only a sibling importer has `react@18.3.1`: still
  missing, which is what rules out a workspace-wide provider lookup.
- **`linkdeep-bad/`** — `packages/b` depends on `react@17.0.2`: a wrong-version
  row.
- **`linkdeep-root/`** and **`linkdeep-root-bad/`** — the root importer links
  `probe-a` (`version: link:packages/a`), with no provider and with its own
  `react@17.0.2` respectively: a missing row and a wrong-version row for `.`.

Two move the link target: **`linkdeep-directory/`** (`publishConfig.directory`
alone, recorded as `link:../a/dist`) and **`linkdeep-directory-false/`**
(`linkDirectory: false`, recorded as `link:../a`), with the same missing row.
Four are chains: **`linkchain-parent-provides/`**,
**`linkchain-importer-provides/`** and **`linkchain-none/`** (`b` links `a`,
`a` links `c`, `c` peers on react) put the row on `packages/a` or nowhere,
never on `packages/b`; **`linkchain-registry/`** (`b` links `c`, `c` depends
on `react-dom` without react) reports the missing react on `packages/c` only.

The first four were measured with pnpm 12.5.1 and re-taken with 12.6.0,
identically; the root, directory and chain fixtures were recorded with
pnpm 12.6.0. A
`catalog:` variant of the probe workspace produces a lockfile and verdict
byte-identical to `linkdeep/` — nothing in that pair can record that a range
was catalog-sourced — so the catalog dimension is pinned on the manifest
side, through the `WorkspacePackage` a test supplies, rather than by another
oracle directory.

[^peer-check-ts]: `packages/workspaces/src/PeerCheck.ts` — `PeerCheck`,
    `UnsatisfiedPeer`, `PeerParent`, `PeerCheckOptions`, `UnverifiedReason`.
[^peer-fixtures]: `packages/workspaces/__test__/fixtures/peers/README.md` —
    provenance of every oracle run, including the `allowany/` and
    `ignoremissing/` measurement pass and the eight `linkdeep*` directories
    (`linkdeep`, `-bad`, `-directory`, `-directory-false`, `-provided`,
    `-root`, `-root-bad`, `-sibling`).


---
<!-- okf/limitations/workspaces-peer-check-yarn-and-suppression-axes.md -->
---
type: Limitation
title: PeerCheck cannot answer yarn
description: PeerCheck reports supported false for yarn's virtual-locator peers, because the yarn lockfile records no join between a peer declaration and the instance that satisfied it.
status: stable
bounds: ../interfaces/workspaces-peer-check.md
tags:
  - architecture
  - testing
sources:
  - id: peer-check-ts
    resource: ../../packages/workspaces/src/PeerCheck.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-20T05:03:32Z
  body_sha256: 4ca5bf92c71eccf0ed6a74f2ae4e4895434bbadec6ab25c657b075c11fb65a7b
---

# PeerCheck cannot answer yarn

## Condition

`PeerCheck.run` reads a parsed `@effected/lockfiles` `Lockfile` and reports
unsatisfied peer dependencies through `instanceId`, `resolved`, and
`peerDependencies` alone, with no per-format branch.[^peer-check-ts] One
fact about the lockfile it reads limits what the report can say: yarn
resolves peers virtually, giving a peer-bearing package one `@virtual:`
locator per consumer with no record of which instance satisfied which
peer.

## Symptom

A caller running `PeerCheck.run` against a yarn lockfile gets back
`supported: false` rather than a populated `unsatisfied` list — there is no
row-level detail to inspect, because the lockfile carries no join key
between a peer declaration and the instance that satisfied it.

## Why this is acceptable

Yarn's plug-and-play resolution genuinely does not record what a checker
would need: the lockfile-only design this checker commits to (reading the
resolved graph rather than shelling out to a package manager's own peer
command, which does not exist for bun and hard-fails before inspection for
npm) cannot manufacture a join yarn itself does not persist. `supported:
false` states that limit rather than returning an empty, falsely-clean
result — a bare array would make "yarn cannot be checked" indistinguishable
from "yarn has no violations", which is the more dangerous failure.

The suppression policy is no longer part of this limitation: all three
`peerDependencyRules` axes (`allowedVersions`, `ignoreMissing`, `allowAny`)
are applied, each established by measurement against `pnpm peers check`
with a firing control — see [the peer-check
interface](../interfaces/workspaces-peer-check.md) for the matching rules
and the fixtures that pin them.

## What the fix would take

Yarn support has no fix within this checker's architecture: it would
require a different, format-specific data source than the lockfile, which
is exactly the per-format branch this module's design forbids.

[^peer-check-ts]: `packages/workspaces/src/PeerCheck.ts` — `PeerCheck.run`,
    `UnverifiedReason`.


---
<!-- okf/interfaces/workspaces-duplicate-check.md -->
---
type: Interface
title: "@effected/workspaces duplicate-copy checking"
description: DuplicateCheck — a lockfile-only report of every package resolving at two or more versions and who pulls each copy, with the kit predicate that names the Layer-mismatch trap.
status: stable
kind: api
resource: ../../packages/workspaces/src/DuplicateCheck.ts
tags:
  - architecture
  - dx
sources:
  - id: duplicate-check-ts
    resource: ../../packages/workspaces/src/DuplicateCheck.ts
  - id: roots-ts
    resource: ../../packages/workspaces/src/internal/roots.ts
  - id: issue-298
    resource: https://github.com/spencerbeggs/effected/issues/298
  - id: issue-603
    resource: https://github.com/spencerbeggs/effected/issues/603
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T16:45:41Z
  body_sha256: dc9d9bdd2a38278b149304bcbb89d56a00707bf0df41aaf3fe79ddec60b1b1a0
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:50.663Z
---

# @effected/workspaces duplicate-copy checking

`DuplicateCheck` answers one question over a parsed `@effected/lockfiles`
`Lockfile`: *which packages resolve at more than one version, and who pulls
each copy?* It is a pure value class on exactly
[`PeerCheck`](workspaces-peer-check.md)'s posture — no service, no layer,
nothing in `R`, no error channel, format-free, `instanceId` opaque — and
the two share one importer-to-instance join in `internal/roots.ts` so they
cannot disagree about which importers are answerable.[^duplicate-check-ts][^roots-ts]

## Why it exists

A duplicated `@effected/*` or `effect` copy never fails as itself. It
surfaces as a structural `Layer` mismatch at a consumer's entry point — a
`LocalExec` that is visibly provided yet "unsatisfied", because the
requirement came from one copy of `@effected/commands` and the provision
from another — or as a `TypeError` deep inside one `effect` copy formatting
an issue the other produced. Neither names a package or a version skew, and
the answer (`pnpm why`, looped over every kit package by hand) went unrun
for months at a stretch. Three consumers hit it six times before this
module existed.[^issue-298][^issue-603]

## The contract

- `DuplicateCheck.run(lockfile, { names? })` → `{ duplicates, unresolvedImporters, isClean }`.
  `duplicates` is a list of `DuplicatedPackage { name, versions }`, each
  version a `DuplicatedVersion { version, instances }`, each instance a
  `DuplicateInstance { instanceId, dependents }`, and each dependent either
  `{ _tag: "importer", path }` or `{ _tag: "package", name, version }`.
- **A duplicate is a name reached at two or more distinct versions.**
  Peer-suffix instances of one version are listed under that version but
  never make it a duplicate on their own: they are the same code, and only
  a version skew produces the trap above. Mutation-pinned.
- **Reachability is one global walk** from every importer's roots along
  `resolved` edges. A stale row the lockfile still carries but nothing
  reaches is not a duplicate; every reached edge is a dependent.
- **`names` narrows the report, never the walk.** The filtered-out package
  is exactly the culprit that must still appear as a dependent —
  `@effected/npm` pinning an old `@effected/commands` is the #298 case.
- **`DuplicateCheck.kit`** is `effect` plus `@effected/*` — not `@effect/*`,
  not `effect-*` — because that is the question every consumer of this kit
  actually asks.
- **Dependents are in lockfile order**, importers first, built from the
  lockfile rather than from the walk, so the order never depends on which
  importer happened to reach an instance first. An edge leaving a workspace
  row is attributed to the importer by path, never as a `package` named
  after a directory with a `"0.0.0"` placeholder.
- **`isClean` answers for the names asked about** and says nothing about
  `unresolvedImporters`; a gate wanting a proven-clean answer checks both.
  `unresolvedImporters` is the same npm/bun root-importer limitation
  `PeerCheck` documents, measured by the same code.

## Where it sits

The kit ships the value, not a command. A CLI's `deps check-duplicates`
belongs to a consumer (the `systems` silk CLI is the natural home); the
report renders to the one-call sketch in #603 directly. The IO half is
`LockfileReader.read()` — the same pairing `PeerCheck` uses.

[^duplicate-check-ts]: `packages/workspaces/src/DuplicateCheck.ts`
[^roots-ts]: `packages/workspaces/src/internal/roots.ts`
[^issue-298]: #298 — the Layer-mismatch and SchemaIssue-`TypeError` symptom classes.
[^issue-603]: #603 — the three silk-update-action sightings and the aggregation ask.


---
<!-- okf/interfaces/workspaces-snapshots.md -->
---
type: Interface
title: "@effected/workspaces snapshots"
description: WorkspaceSnapshots and WorkspaceStateSnapshot — point-in-time workspace reads at a git ref or in the worktree, with config-dependency hooks replayed at the ref's declared versions.
status: stable
kind: api
resource: ../../packages/workspaces/src/WorkspaceSnapshots.ts
tags:
  - architecture
sources:
  - id: workspace-snapshots-ts
    resource: ../../packages/workspaces/src/WorkspaceSnapshots.ts
  - id: workspace-state-snapshot-ts
    resource: ../../packages/workspaces/src/WorkspaceStateSnapshot.ts
  - id: change-detector-ts
    resource: ../../packages/workspaces/src/ChangeDetector.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T21:58:29Z
  body_sha256: a7e78afb2c024f71276234e6843cd63005ae82397bc105cf5dc4fc146bc6d0fe
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:06.249Z
---

# @effected/workspaces snapshots

`WorkspaceSnapshots` answers "what did this workspace look like at that
moment", at a git ref or in the worktree. `ChangeDetector` answers "what
changed between two points". Both run on `@effected/git`'s service over
core's spawner contract in `R`; requiring a core-declared service in `R`
costs a consumer nothing, which is why this package owns no subprocess seam
of its own.[^workspace-snapshots-ts][^change-detector-ts]

## WorkspaceSnapshots

`at(ref)` reads workspace state at a git ref with no checkout: package
directories come from `git ls-tree` matched against the compiled
`@effected/glob` set, and manifests are read through `git show`.[^workspace-snapshots-ts]
Every workspace-relative path handed to that read is `./`-prefixed so git
resolves it relative to the resolved workspace root rather than the git
repository's top level — a bare path would resolve at the repo top level,
so a workspace root nested inside a larger repository would read the outer
manifest and drop or misread its members.

Reading at a ref requires no checkout, and four properties are
load-bearing: workspace globs fall back to the root manifest's field when
the pnpm workspace file is absent at that ref, because without it a bun or
npm workspace collapses to the root package alone and a diff reads every
dependency as newly added with no error; package directories come from the
compiled glob set matched against tree entries, never a live directory
descent; a path absent at the ref is skipped, never an error; and the root
manifest's inline bun catalogs are read unconditionally, not gated on a bun
lockfile's presence, since gating them would reintroduce the same
"everything looks added" bug for a bun repository with inline catalogs but
a not-yet-committed lockfile.

Results cache per `(resolved root, ref)`, invalidated on any non-success
exit rather than memoized unconditionally. The composite cache key is
NUL-separated, since a NUL can appear in neither a path nor a ref, and it
is written as the escape sequence rather than a literal NUL byte, because a
literal one makes `file` classify the module as binary and grep silently
skip it. `worktree()` reads the live tree over the one shared
`WorkspaceDiscovery` plus `WorkspaceCatalogs` path — there is no second
manifest or lockfile read for the worktree.

## Hook replay at a ref

Reading at a ref replays the ref's own `configDependencies` — read from
that ref's `pnpm-workspace.yaml`, seeded by that ref's inline catalogs and
peer-dependency rules — through whichever `ConfigDependencyHooks` layer is
in scope, and merges the injection above the ref's lockfile and inline
sources exactly as the live assembler does.[^workspace-snapshots-ts] The
service therefore requires that layer, and the composites hand one
reference to it and to `WorkspaceCatalogs` so the two sides of a diff run
one policy. Under the no-op layer nothing executes and the ref side sees
no hook-injected catalog; under a replaying layer each ref's hook runs at
the version that ref declares — resolved through the installed copy or the
pnpm store by the live and subprocess layers (the subprocess layer also
fetching a missing version, verified against the ref's own lockfile),
failing closed otherwise, or
taken from a caller-supplied `"<name>@<version>"` map under
`ConfigDependencyHooks.layerFrom` via `Workspaces.layerWithGitAndHooks` (see
[the config-dependency seam](workspaces-catalogs.md#the-replaying-layers-resolve-the-declared-version)),
which still requires no checkout. Every snapshot records which version
each config dependency was replayed from in `hookReplays`, a `name →
version` record set on every fresh read (empty under the no-op layer or
where config dependencies do not exist) and absent only on values
serialized before the field existed; the resolution rung is machine-local
provenance that stays on the live injection, and the worktree read takes
the record off the same memoized assembly as the catalog set.

The importer-version fallback remains for the no-op case: when the catalog
set cannot answer a `catalog:` specifier, resolution falls back to the
version that ref's own lockfile importer entry recorded. Warning and
emitting no row was rejected, since it leaves the resulting changeset
missing.

### The seeded-catalog seam

The importer-version fallback answers with a concrete version, which is
enough to make a specifier resolve but not enough to see a range move: two
refs that installed the same version report the same string, so a real
bump of a hook-injected catalog's declared range produces no diff row.
`WorkspaceStateSnapshot`[^workspace-state-snapshot-ts] therefore carries `seededCatalogs`, a set supplied
by the caller and consulted strictly below the snapshot's own catalogs, so
the resolution chain reads: this moment's own catalogs, then the seed (a
range), then the importer-version fallback (a version). Nothing is
replayed and nothing is fetched — the consumer already holds a live set,
paid for by choosing a config-dependency layer, and simply hands it to the
ref side.

The seed is its own field, never merged into `catalogs`, because `catalogs`
means "the set assembled at this moment" and a snapshot is a serializable
value consumers store and diff; blending an external set into it would
silently redefine the field with nothing downstream able to tell the
halves apart. The seed's lower precedence is what makes seeding safe to do
unconditionally, since a seed can only ever add an answer where there was
none.

`WorkspaceStateSnapshot.crossSeed(before, after)` gives each side the
other's catalogs. `withSeededCatalogs` replaces an existing seed rather
than accumulating it, because an accumulating seed would make precedence
depend on call order — but the layer-level `seedCatalogs` option puts a
seed on every snapshot the service returns, so a `crossSeed` built on a
bare replace would silently discard that seed on both sides at once,
reopening the hook-catalog gap. `crossSeed` therefore composes the two
explicitly: the other ref's committed catalogs win, and the carried seed
answers only what neither ref declared. Under a replaying hooks layer a
range change made purely by bumping the config dependency between two
refs is detected — each ref's own catalogs carry its replayed range, so the
seed never gets a say; under the no-op layer that case stays suppressed,
because neither committed source declares the catalog, and the only
committed evidence is `configDependencies` in `pnpm-workspace.yaml`, which
a consumer diffs directly (see
[the cross-ref bump limitation](../limitations/workspaces-snapshot-hook-catalog-bump-between-refs.md)).
Both cases are pinned by tests.

## WorkspaceStateSnapshot

The snapshot is a serializable value — `packages`, `catalogs`,
`importerVersions`, `hookReplays`, and the seed — with lazily built private
indexes behind `versions`, `package(name)`, `resolve`, and `resolveIn`. A
specifier is classified through `@effected/npm`'s `DependencySpecifier`,
never prefix-sniffed. The value also exposes snapshot-scoped
`catalogResolver`, `workspaceResolver`, and `resolvers` layers answering
`@effected/npm`'s contracts as of that moment, so a consumer can resolve a
manifest against a past ref with the same code it uses against the
worktree.[^workspace-state-snapshot-ts] `PackageStateSnapshot` is the
narrower per-member slice. Its `version` is optional: a version-less member
omits the key on both the ref and worktree reads, because a diff's two sides
must agree on the shape, and the model never holds `""` — `make` rejects it,
and a value serialized when `""` was the no-version sentinel decodes to the
absent key. Such a member is absent from `versions`, still answers
`package(name)`, resolves `workspace:` to `Option.none()`, and fails the
snapshot-bound `versionOf` with `reason: "no-version"`.

The two failure unions are `WorkspaceSnapshotAtFailure` — git's typed
errors, `CatalogAssemblyError` from the inline source, and
`WorkspaceRootNotFoundError` — and `WorkspaceSnapshotWorktreeFailure`,
which never touches git. A malformed lockfile at the ref is a broken
record rather than a broken source of truth and degrades to no catalogs;
only the inline source hard-fails.[^workspace-snapshots-ts]

## Importer versions

The join is by dependency name across every field, because pnpm writes a
peer into the importer block only when it is also installed, so a peer's
concrete version can sit on a different row than expected. Recorded
versions must be normalized, because `@effected/lockfiles` stores the
importer version verbatim including pnpm's peer suffix, which unstripped
renders the whole parenthesized chain as a version. `link:` and `file:`
entries are skipped — a filesystem edge is not a version.

Workspace-wide resolution answers only when every importer recording that
dependency agrees — divergence is `Option.none()`, never a guess. The
importer-scoped form is the precise variant for callers holding a package's
relative path.

## Change detection

`ChangeDetector` computes a committed range and optionally folds in
working-tree changes, unioned and sorted, with a non-repository surfacing
as git's own typed error alongside this package's own error union. Every
query runs in git's relative mode, so paths come back relative to the
workspace root rather than the repository top level — correct when the
workspace is nested inside a larger repository, the same nesting the
`./`-prefixed snapshot reads guard against.[^change-detector-ts] A test provides
`@effected/git`'s own shipped double, whose unstubbed members die named,
and needs no repository on disk.

[^workspace-snapshots-ts]: `packages/workspaces/src/WorkspaceSnapshots.ts` —
    `WorkspaceSnapshots`, `at(ref)` / `worktree()`, and its two failure
    unions.
[^workspace-state-snapshot-ts]: `packages/workspaces/src/WorkspaceStateSnapshot.ts` —
    `WorkspaceStateSnapshot`, `PackageStateSnapshot`.
[^change-detector-ts]: `packages/workspaces/src/ChangeDetector.ts` —
    `ChangeDetector`, `ChangeDetectionOptions`, `ChangeDetectionError`,
    `ChangeDetectionFailure`.


---
<!-- okf/limitations/workspaces-snapshot-hook-catalog-bump-between-refs.md -->
---
type: Limitation
title: Under the no-op hooks layer, a hook-injected catalog's range bump between two refs is invisible to a snapshot diff
description: Under ConfigDependencyHooks.layerNoop (the default composites), WorkspaceStateSnapshot.crossSeed cannot surface a range change made purely by bumping a config dependency between two refs, because neither ref's committed sources declare the catalog; a replaying layer detects it.
status: stable
bounds: ../interfaces/workspaces-snapshots.md
tags:
  - architecture
sources:
  - id: workspace-state-snapshot-ts
    resource: ../../packages/workspaces/src/WorkspaceStateSnapshot.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T06:20:52Z
  body_sha256: 21e1be218e5ce5d647b4b1376786d89244cfe9dd17c09d97c50d0af711ce8aa0
---

# Under the no-op hooks layer, a hook-injected catalog's range bump between two refs is invisible to a snapshot diff

## Condition

The snapshots were read under `ConfigDependencyHooks.layerNoop` — what
`Workspaces.layer` and `Workspaces.layerWithGit` wire — so
`WorkspaceSnapshots.at(ref)` executed no config-dependency code at either
ref, and `WorkspaceStateSnapshot.crossSeed(before, after)` is what lets a
`catalog:` specifier against a hook-injected catalog (one that exists only
because a pnpm config-dependency pnpmfile injects it, never recorded in
`pnpm-workspace.yaml` or the lockfile's `catalogs:` block) resolve at all
on the ref side.[^workspace-state-snapshot-ts] Each side's answer then
comes from the other side's seed, or from the importer-version fallback,
which answers with a version rather than a declared range.

## Symptom

When the config dependency was bumped between the two refs and its newer
pnpmfile declares a different range for a hook-injected catalog entry —
with no other change to either ref's committed sources — the diff reports
no row for that catalog specifier. The dependency table looks unchanged
even though the effective policy genuinely moved.

## Why this is acceptable

The no-op layer is the default precisely so the default composites execute
no config-dependency code, and a read that executes nothing cannot see a
catalog that exists only through execution. The case has a narrow,
identifiable blast radius: the catalog is not declared anywhere git can
already see.

## What the fix would take

Opting in. Under a replaying layer (`Workspaces.layerWithGitAndConfigDependencies`,
its subprocess twin, or `Workspaces.layerWithGitAndHooks` over
`ConfigDependencyHooks.layerFrom` for a hermetic test) `at(ref)` replays each
ref's `configDependencies` at the version that ref declares — resolved through
`node_modules/.pnpm-config` when it holds that version and through the pnpm
store otherwise, fetched verified into the store under the subprocess
layer, failing closed when none of those answers; or read from the supplied
map — so each side's own catalogs carry its range and
the bump is a visible row. The store keeps every version installed on the
machine, which is what makes a past ref's pnpmfile reachable with no
checkout, and the subprocess layer's fetch covers a version this machine
never installed. A consumer that must stay on the no-op layer diffs
the `configDependencies` block in `pnpm-workspace.yaml` directly, the only
committed signal that a hook-injected catalog's policy might have moved.

[^workspace-state-snapshot-ts]: `packages/workspaces/src/WorkspaceStateSnapshot.ts` —
    `crossSeed`, `withSeededCatalogs`, `seededCatalogs`.


---
<!-- okf/interfaces/workspaces-release.md -->
---
type: Interface
title: "@effected/workspaces release surface"
description: PublishabilityDetector, VersioningStrategy, and ReleaseTag — the release-shaped questions the workspace model already holds the facts for.
status: stable
kind: api
resource: ../../packages/workspaces/src/Publishability.ts
tags:
  - architecture
  - release
sources:
  - id: publishability-ts
    resource: ../../packages/workspaces/src/Publishability.ts
  - id: versioning-strategy-ts
    resource: ../../packages/workspaces/src/VersioningStrategy.ts
  - id: release-tag-ts
    resource: ../../packages/workspaces/src/ReleaseTag.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 60ef126d7f84c6a06c5c56d58fad461629a46665f613f4b07a77916270a9e7a5
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:03.300Z
---

# @effected/workspaces release surface

Three modules answer the release-shaped questions the workspace model
already holds the facts for: does this package publish, and to where;
how does this workspace version; and what is the git tag called.
`Publishability.ts`, `VersioningStrategy.ts`, and `ReleaseTag.ts` reach into
the rest of `@effected/workspaces` only through
[discovery](workspaces-discovery.md) and the located-member model. They
ship inside this package rather than as their own package because they are
meaningless without a discovered workspace, and the swappable half is one
small service.

## PublishabilityDetector

A `Context.Service` deciding whether a package publishes and to where. Its
shape is an exported interface, for symmetry with the discovery service's,
so a consumer overriding it can name the type it is implementing without
reaching into the class.[^publishability-ts]

No composite provides or requires a detector. `Workspaces.layer()` and its
variants neither supply one nor widen their own requirements, because
nothing inside a composite consumes a detector — the requirement surfaces
only where a program actually asks a publishability question
(`VersioningStrategy.detect`'s `R`), and is enforced wherever `R` must be
closed. With no default to shadow, a caller's own detector merged over the
composite in either order behaves the same way, which matters because the
earlier shape — a composite that baked in npm semantics as a default — made
an override silently order-dependent in the dangerous direction: merging a
custom detector before the composite resolved, with no type error and no
warning, back to "publishes to the public registry with public access",
the worst available failure mode for a service that decides where a
package publishes.

`Layer.provide(detector)` feeds the detector into the composite's
requirements, and since the composite requires nothing, the provide
satisfies nothing and the detector is discarded, taking the service back
out of the resulting layer's output; the correct form is
`Layer.mergeAll(Workspaces.layer(), detectorLayer)`. This is a live defect
class, not a style preference.

The shipped policies — npm semantics and a publishes-nothing policy — are
reachable as values, with layers built over them; there is no bare `layer`
static, since a static called `layer` would read as "the" layer once no
composite provides one. The npm policy implements npm's semantics
specifically: private with no publish-config access publishes nowhere, an
explicit publish-config access overrides private, and anything else
publishes to the public registry.

`detect`'s error channel is deliberately `never`, because every caller —
most of all the release planner iterating a whole workspace — treats "does
this publish?" as a total question. An overriding layer whose lookup can
fail has exactly two honest moves: fold the recoverable failure into a safe
answer, usually the empty target list, or die into the defect channel; it
may not widen the channel the contract declares. `detect` returns a target
list rather than a richer classification, because every consumer surveyed
asks exactly one question of it — whether the list is non-empty.

## VersioningStrategy

Neither this nor `ReleaseTag` is a service: a service shape carries only
effectful members, and both halves here are total pure functions, so
wrapping classification and formatting in `Effect` with `never` error
channels purely to fit a service shape would be exactly the anti-pattern
that rule prevents.[^versioning-strategy-ts]

`classify` is total, answering single, fixed-group, or independent. Names
are de-duplicated before counting, or a duplicated name misclassifies a
one-package repo as independent and cuts per-package tags for it. Lockstep
requires one single group to cover the publishable set — two groups
covering it between them mean the packages move separately, so a naive
"are there any fixed groups?" test is wrong. A group naming non-publishable
or nonexistent packages still counts, because groups describe the whole
repository rather than the publishable slice. Fixed groups are a plain
argument, never read from a file, because they are a release tool's concept
and a workspace-model package that read that tool's config file would be
adopting one tool's schema and one tool's release policy.

`detect` is the one effectful member, over discovery and publishability:
enumerate, keep what publishes somewhere, classify. Asking publishability
through the service is the point — a consumer honouring a release tool's
ignore list swaps the layer rather than filtering afterward.

## ReleaseTag

A leaf module importing nothing else in the package.[^release-tag-ts] The
version prefix defaults to empty, uniformly, with strict SemVer — see
[the strict-default gotcha](../gotchas/releasetag-strict-semver-default.md)
for the divergence this creates from a common scoped/unscoped `v`-prefix
convention. Git tag history is not an API: pre-1.0 breaking-change freedom
covers this package's own code, not a consumer's existing tags, so a
consumer that wants a `v`-prefixed convention passes the prefix explicitly.
Only a leading `@` makes a name scoped. Formatting is total: the only prior
failure cause was an empty version, which a non-empty-string schema now
catches during construction, so a bad version reaching these statics is
developer wiring rather than untrusted input and dies as a defect.

### TrackingTag — the floating alias family

Release tags are strict SemVer and immutable. Tracking tags are the
deliberately-not-SemVer alias family — a truncated major or major-minor,
re-pointed at whatever release is newest in that line, which is the GitHub
Actions distribution convention. A tracking tag is its own concept, not a
third tag style, because it is derived *from* a version rather than being a
way of formatting one.

Three properties are load-bearing: a prerelease derives nothing, and the
override is off by default, because anyone depending on a major alias is
asking for the newest stable release in that line; build metadata is not a
prerelease, since build metadata carries no precedence meaning in SemVer,
and stripping it before testing for a prerelease marker is what makes
derivation correct; and derivation is total and never throws, because this
is a query about a version rather than a validation of one, and the
workspace model's version field is deliberately tolerant. 0.x versions do
derive aliases — floating a `v0` alias across 0.x minors is a genuine
hazard, but which aliases to publish is policy decided where tags are
moved, not something a derivation should quietly withhold. Moving a git tag
is not this module's business; the module derives, formats, and parses,
and re-pointing is a consumer concern over `@effected/git`.

### Classification

The recognition half answers, for any tag string, whether it is a release
tag, a tracking alias, or neither. The families are told apart by segment
count, not by the `v` prefix — three numeric segments is a version, with or
without the prefix; one or two is a truncated alias, and the `v` is
required on an alias because a bare number is neither valid SemVer nor the
convention. Unrecognized is a real answer rather than a failure, because a
repository's tags include release channels, branch names, and whatever else
humans wrote. Round-tripping is a tested property in both directions: every
tag the formatters produce classifies back to its own family with fields
intact.

`@effected/semver` was consciously declined here: the tracking-tag grammar
is not SemVer, and the derivation needs only the three numeric segments
plus the presence of a prerelease — a handful of lines, for which a
dependency edge is disproportionate. It earns itself the day something here
needs real semver comparison, which no caller asks for today, because
choosing what a tracking tag should point at is the consumer's decision,
made where the tag is moved.

## Folding them together

`VersioningStrategy`'s tag derivation folds classification and formatting
into one call, collapsing a consumer's hand-rolled strategy-determination
code to two lines. Under the lockstep strategies it returns exactly one tag
carrying the first release's version; a lockstep batch shares a version by
construction, so the choice is visible only on a batch that should not
exist, which is why a fixed-versioning flag is deliberately not provided —
it stays the caller's one-line check.

[^publishability-ts]: `packages/workspaces/src/Publishability.ts` —
    `PublishabilityDetector`, `PublishTarget`.
[^versioning-strategy-ts]: `packages/workspaces/src/VersioningStrategy.ts` —
    `VersioningStrategy`, `VersioningStrategyType`, `ClassifyOptions`,
    `VersioningDetectOptions`, `PackageRelease`.
[^release-tag-ts]: `packages/workspaces/src/ReleaseTag.ts` — `ReleaseTag`,
    `TagStyle`, `TagFormatOptions`, `TrackingTag`, `TrackingTagOptions`,
    `classifyTag`, `TagClassification`.


---
<!-- okf/gotchas/publishability-detector-diagnoses-late.md -->
---
type: Gotcha
title: A missing PublishabilityDetector fails far from where it was wired
description: Workspaces composites neither provide nor require a PublishabilityDetector, so a missing one surfaces as an unclosed R at whatever downstream operation asks the publishability question, not at the layer-composition call site — and Layer.provide silently discards a detector instead of wiring it.
status: stable
resource: ../../packages/workspaces/src/Publishability.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - dx
  - release
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 6db5be5d6f184a2b4b63d717d63c34abe54b0bd3d76b046b36a4888bf4d8e170
---

# A missing PublishabilityDetector fails far from where it was wired

## What a reader sees

A consumer composes `Workspaces.layer()` with a custom
`PublishabilityDetector`, using `Layer.provide(detector)` to attach it,
and the composition itself typechecks and builds without complaint. Later,
a call to `VersioningStrategy.detect` (or another operation that asks a
publishability question) fails to close its `R` channel, or a merge order
change silently reverts a custom detector to kit defaults with no error at
all.

## What they would wrongly conclude

That the layer composition succeeded because it compiled, and that the
detector is correctly wired into the workspace pipeline as a result — or,
in the merge-order case, that the custom detector is in effect simply
because it appears in the composition.

## What is actually true

No composite in `@effected/workspaces` provides or requires a
`PublishabilityDetector` — the requirement surfaces only where a program
actually asks a publishability question, in the `R` of operations like
`VersioningStrategy.detect`, which may be far from wherever the layers
were composed. `Layer.provide(detector)` feeds the detector **into** the
composite's requirements; since the composite does not require one, the
provide satisfies nothing and the detector is discarded entirely, taking
the service back out of the resulting layer's output — the program then
fails to close `R` at the distant downstream call, for a reason the
wiring line gives no hint of. Separately, because there is no ambient
default detector for a custom one to shadow, `Layer.mergeAll` is the only
form that composes correctly; an earlier form once resolved to kit
defaults regardless of argument order, and a published changelog shipped
the wrong composition form which a consumer then copied.

## The check

Wire a custom `PublishabilityDetector` with `Layer.mergeAll(detector,
Workspaces.layer())`, never `Layer.provide`.[^publishability] When an
unclosed `R` names a publishability-detector requirement, look for the
composition form first rather than assuming the detector was never built
correctly — the failure's location (a downstream release operation) is
expected to be distant from the actual composition mistake.

[^publishability]: `packages/workspaces/src/Publishability.ts:27-50` —
    documents that no composite provides or requires a detector, that
    `Layer.provide` discards it, and that `Layer.mergeAll` is the correct
    form, citing a published changelog that shipped the wrong one.


---
<!-- okf/gotchas/releasetag-strict-semver-default.md -->
---
type: Gotcha
title: ReleaseTag defaults to strict SemVer with no version prefix
description: A repository whose git tag history uses a v-prefixed convention gets bare-SemVer tags from ReleaseTag by default, silently diverging from its own existing history unless versionPrefix is passed explicitly.
status: stable
resource: ../../packages/workspaces/src/ReleaseTag.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - release
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 8bcc893847e97d52efb89566584f29bf0815125bfc64de44e8d8c54dba42fcb5
---

# ReleaseTag defaults to strict SemVer with no version prefix

## What a reader sees

A repository whose existing git history uses `v`-prefixed release tags
(`v1.2.3`) adopts `@effected/workspaces` for tagging, calls
`ReleaseTag.single` or `ReleaseTag.scoped` with no options, and gets a tag
back that looks like ordinary SemVer.

## What they would wrongly conclude

That the produced tag follows the repository's existing convention,
because nothing about calling the constructor without options signals
that a prefix decision was made on the caller's behalf.

## What is actually true

`ReleaseTag`'s version prefix defaults to empty, uniformly, producing
strict SemVer tags with no leading `v`. This is a deliberate choice rather
than an oversight: a `v`-prefix convention is not a universal default to
inherit, and two prior implementations disagreed about it — one even
contradicting its own doc comment — so once the kit had to pick one
default, strict SemVer is the one it kept. Git tag history is not treated
as an API the kit must match: pre-1.0 freedom to make breaking choices
covers the kit's own code, not a consumer's pre-existing tag history. A
repository with `v`-prefixed tags that adopts the default silently starts
producing a second, incompatible tag family alongside its existing
history.

## The check

Pass `versionPrefix: "v"` explicitly to `ReleaseTag.single` or
`ReleaseTag.scoped` when the target repository's existing tag history
uses that convention, or keeps it going forward.[^release-tag] Verify by
comparing a freshly produced tag against the repository's most recent
existing release tag before the first real release through the new
tooling.

[^release-tag]: `packages/workspaces/src/ReleaseTag.ts:8-13,54,346,364` —
    the module comment states the default is `""` uniformly with strict
    SemVer, and `TagFormatOptions.versionPrefix` is the escape hatch both
    `single` and `scoped` read.


---
<!-- okf/decisions/workspaces-sync-facade-escape-hatch.md -->
---
type: Decision
title: "WorkspacesSync is a `*Sync` escape hatch, not a `*Result` pure form"
description: "The synchronous WorkspacesSync facade exists for a caller that cannot await, and it is named `*Sync` rather than `*Result` because it is a total port over consumer-supplied IO, not a pure computation with a sync twin."
status: draft
tags:
  - architecture
  - dx
sources:
  - id: workspaces-sync-ts
    resource: ../../packages/workspaces/src/WorkspacesSync.ts
  - id: node-sync-ts
    resource: ../../packages/workspaces/src/node-sync.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 0a64a974e9c86d1518f1145a45dfce6db0d0b8657ece9f2eedba973abae964fb
---

# WorkspacesSync is a `*Sync` escape hatch, not a `*Result` pure form

## Context

`src/WorkspacesSync.ts` ships two synchronous functions,
`findWorkspaceRootSync` and `getWorkspacePackagesSync`, positional-path-first
with an options bag second, with the cwd required rather than read from an
ambient default.[^workspaces-sync-ts] They exist because Vitest's
config-time project discovery cannot await: a test runner picking up
project configuration runs before any Effect runtime exists to drive an
asynchronous discovery call, so the gate consumer needs a synchronous
answer or it cannot participate at all.

Both functions drive the same worklist-based traversal state machine
(`internal/traverse.ts`) that the Effect enumerator uses, so a globstar
means the same thing in both worlds — the sync surface keeps no third
pattern semantic. The one deliberate divergence is at a bound: the Effect
path fails typed, and the sync path truncates, because `getWorkspacePackagesSync`
has no error channel to fail a bad manifest through.

## Decision

Name the family `*Sync`, not `*Result`, and shape it as a total port over
consumer-supplied IO rather than a pure computation with two forms.

The `*Result`/`Effect` pairing elsewhere in the kit names two forms of the
*same pure computation* — a synchronous `Result`-returning function and an
`Effect`-wrapped async twin over the identical logic, with the sync form
holding no privileged claim to a platform. `WorkspacesSync` is a different
shape entirely: it is total (`getWorkspacePackagesSync` has no error
channel at all, reporting failure only through an optional `onSkip`
callback), it takes its platform from the caller rather than being
platform-free, and it exists specifically *because* the async Effect form
cannot run in the calling context — not as an interchangeable alternative
to it.

The kit's naming convention keeps `*Result` reserved for a synchronous pure
primitive that has an `Effect` sibling over the same computation, and uses
`*Sync` for a facade whose entire reason to exist is bridging into a
synchronous host: the two names encode different contracts, and using
`*Result` here would claim a pure-computation symmetry `WorkspacesSync`
does not have.

The design rule that binds every sync escape hatch in the kit, not only
this one: the kit never imports `node:*` on its main path and never assumes
POSIX, so a sync surface takes the platform from its caller. The options
bag carries minimal structural filesystem and path interfaces that Node's
built-ins satisfy verbatim; Windows correctness is therefore the consumer's
responsibility, passing a win32-appropriate path implementation, not
anything this module does on its own.

The `./node-sync` subpath (`src/node-sync.ts`) supplies ready-made
`node:fs` / `node:path` bindings so the common Node case is one import,
while staying unreachable from the main entry point — hand-wiring the
built-in one-liners at every adoption site would be a tax the platform-free
rule imposes on the common case, and a tax paid per consumer is a tax paid
wrong.[^node-sync-ts]

## Alternatives rejected

- **Name the family `*Result`, matching the kit's sync-primitive
  convention.** Rejected because `*Result` names a pure computation's
  synchronous form with an `Effect` twin over identical logic; this facade
  is total port-taking IO with no error channel, existing because the
  async form cannot run here at all, not as an equally-valid alternative
  form of the same computation.
- **Give the sync surface an ambient `process.cwd()` default, matching the
  Effect-side layers.** Rejected because the sync module's reason to exist
  is a caller — Vitest's config-time discovery — that cannot rely on any
  ambient timing; requiring the cwd keeps the contract explicit about what
  it does not read.

## Consequences

A reader who sees `*Sync` in this kit should expect a total,
consumer-supplied-IO facade bridging into a synchronous host, not a pure
computation's synchronous twin — that expectation is reserved for
`*Result`. See [the sync-primitive naming decision](sync-form-named-result.md)
for the `*Result` side of this distinction.

[^workspaces-sync-ts]: `packages/workspaces/src/WorkspacesSync.ts` —
    `findWorkspaceRootSync`, `getWorkspacePackagesSync`, `SyncFileSystem`,
    `SyncPath`.
[^node-sync-ts]: `packages/workspaces/src/node-sync.ts` — the Node-bound
    ops preset published only under `./node-sync`.


---
<!-- okf/decisions/second-published-entrypoint.md -->
---
type: Decision
title: A second published entrypoint is a measured cost, not a convenience
description: A package adds a subpath export only when a structural test proves an unbundled consumer would otherwise pay to load a part of the graph it never touches.
status: draft
tags:
  - bundle
  - dx
sources:
  - id: schema-org-package-json
    resource: ../../packages/schema-org/package.json
  - id: workspaces-package-json
    resource: ../../packages/workspaces/package.json
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 71d7706757a9d4d1ac10e2c8106ac1b0ad77b4948ac9147ce6d3676ec7956dcd
---

# A second published entrypoint is a measured cost, not a convenience

## Context

Most packages ship a single `.` entrypoint. Two do not:
`@effected/workspaces` adds `./node-sync`, and `@effected/schema-org` adds
`./validate`.[^schema-org-package-json][^workspaces-package-json] `"sideEffects": false` sounds like
it already solves the tree-shaking problem a subpath would solve, and
believing that is the trap this decision exists to name.

`sideEffects: false` and a subpath entrypoint answer two different
questions:

- For a **bundled** consumer, a re-export barrel tree-shakes correctly.
  Named exports stay individually reachable, so importing one class from
  `src/index.ts` retains only that class's graph. This is the case
  `sideEffects: false` describes, and it is why entrypoints are permitted
  to re-export at all.
- For an **unbundled Node consumer** — a CLI, a test run, a server,
  anything running the published files directly — there is no
  tree-shaker. Importing one named export from `index.ts` evaluates the
  whole module graph the file re-exports, whether or not that binding
  reads from it.

## Decision

A subpath entrypoint is the only mechanism that makes a heavy, optional
part of a package cost zero for the consumers that do not use it, and it
is justified by measurement rather than preference. `schema-org` split
`./validate` because the vocabulary table behind it is raw bytes an
graph-only consumer would otherwise load on every import — the raw
figure is the one that matters, not the gzip figure, because parse cost
is what an unbundled consumer pays.

The wiring is three parts:

1. One extra `exports` key, for example `"./validate": "./src/conformance-entry.ts"`.
2. One entry file beside `src/index.ts`, re-exports only, carrying a
   `@packageDocumentation` block stating why the split exists.
3. Nothing else — turbo, the bundler and the api-extractor model path are
   per-package, not per-entrypoint.

A type named by the second entrypoint's signatures must be exported
**from that entrypoint**, not merely from `.`. Type-only re-exports
(`export type { … }`) are erased at runtime and cost the split nothing,
but where API Extractor needs the class value and not just its type — a
class used as a parameter type of an exported function — the value
re-export is required and is the honest cost of the split. Record which
one it is and why, at the re-export site.

The corollary is a test obligation: review cannot enforce a reachability
boundary, so a package with a split ships a structural test asserting it,
with a positive control — assert that the light entrypoint's transitive
module graph excludes the heavy module, and that the heavy entrypoint's
graph includes it, so a test that has quietly stopped resolving anything
fails instead of passing vacuously.

See [the case-collision rule](../gotchas/subpath-case-collision.md) for
the naming trap a subpath walks into on a case-insensitive filesystem.

## Alternatives rejected

- **Ship everything from `.` and rely on `sideEffects: false`.** Rejected
  because it only helps a bundled consumer; an unbundled Node consumer
  still pays for the whole graph on any import.
- **Split every package defensively.** Rejected as unmeasured cost: a
  subpath is justified only when a measured, heavy, optional part of the
  graph exists — most packages have no such part.

## Consequences

A package considering a split must first measure the raw byte cost of
the candidate module and write the reachability test before adding the
`exports` key, not after.

[^schema-org-package-json]: `packages/schema-org/package.json` — `exports` carries
    `"./validate": "./src/conformance-entry.ts"` alongside `.`.
[^workspaces-package-json]: `packages/workspaces/package.json` — `exports` carries
    `"./node-sync": "./src/node-sync.ts"` alongside `.`.


---
<!-- okf/interfaces/workspaces-repo-shape-checks.md -->
---
type: Interface
title: "@effected/workspaces/testing: the repo-shape checks"
description: SourceBoundary, WorkspaceLayering and PackedInstall, the three checks a monorepo runs in its own test suite to keep source boundaries, the package graph and the packed install honest.
status: draft
kind: api
resource: ../../packages/workspaces/src/testing.ts
tags:
  - architecture
sources:
  - id: testing-ts
    resource: ../../packages/workspaces/src/testing.ts
  - id: source-boundary-ts
    resource: ../../packages/workspaces/src/SourceBoundary.ts
  - id: source-text-ts
    resource: ../../packages/workspaces/src/internal/sourceText.ts
  - id: workspace-layering-ts
    resource: ../../packages/workspaces/src/WorkspaceLayering.ts
  - id: layer-policy-ts
    resource: ../../packages/workspaces/src/LayerPolicy.ts
  - id: dependency-graph-ts
    resource: ../../packages/workspaces/src/DependencyGraph.ts
  - id: packed-install-ts
    resource: ../../packages/workspaces/src/PackedInstall.ts
  - id: packed-install-plan-ts
    resource: ../../packages/workspaces/src/internal/packedInstallPlan.ts
  - id: package-publish-ts
    resource: ../../packages/npm/src/PackagePublish.ts
  - id: package-tarball-ts
    resource: ../../packages/npm/src/PackageTarball.ts
  - id: cli-logger-ts
    resource: ../../packages/cli/src/CliLogger.ts
  - id: node-console
    resource: https://nodejs.org/api/console.html
  - id: layers-json
    resource: ../../lib/configs/layers.json
  - id: vitest-agent-packed-install
    resource: https://github.com/spencerbeggs/vitest-agent/blob/main/packages/plugin/__test__/bins-packed-install.e2e.test.ts
  - id: systems-packed-install
    resource: https://github.com/savvy-web/systems/blob/main/e2e/silk/__test__/e2e/packed-install.e2e.test.ts
  - id: systems-helpers
    resource: https://github.com/savvy-web/systems/blob/main/e2e/silk/__test__/e2e/helpers.ts
  - id: packed-install-e2e
    resource: ../../packages/workspaces/__test__/e2e/PackedInstall.e2e.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-10-05T18:02:33Z
  body_sha256: d7d3ef6879e7384ee9c286aed2a603ea8dc9e8579e2d92943d1edd52e515ff58
---

# @effected/workspaces/testing: the repo-shape checks

`@effected/workspaces/testing` is the package's third entry point. It holds
three checks a monorepo runs against itself, inside its own test suite:
`SourceBoundary` keeps `process`, `node:` imports and console writes out of
modules meant to be free of them; `WorkspaceLayering` holds the package graph
to a committed `LayerPolicy`; and `PackedInstall` proves a carrier's bins
install from packed tarballs under every available package
manager.[^testing-ts] `src/index.ts` never re-exports it. Why these live here
rather than in a package of their own is
[D5](../decisions/repo-shape-checks-live-in-workspaces-testing.md).

Every check refuses to pass vacuously. A scan reports the files it read, a
layering report counts the edges it checked, and a packed install reports
which managers it skipped. The assertion a consumer writes pairs "nothing
wrong" with "something was checked".

## SourceBoundary

### The lexer's three views

Every rule runs over one lexer pass that splits a file three
ways:[^source-text-ts]

- `withoutComments`: comments blanked to spaces, everything else kept;
- `code`: comments, strings, template text and regex bodies blanked, so only
  code is left;
- `literals`: every string, and every template with no substitution, with its
  offset.

Both text views keep the input's exact length and line breaks, so an offset
in either one is an offset in the file. The `process`, `stdout-write`,
`console` and `console-stdout` rules read `code`. The import rules read `literals`, but only
the ones in specifier position: after `from` or `import`, or the whole first
argument of `import(` or `require(`. A commented-out import is never a
specifier.

A `/` after an operand divides. An operand is an identifier, `)`, `]`, a
postfix `++` or `--`, or a non-null `!`. A `/` after an operator, after a
keyword, or after the `)` of an `if`, `while`, `for` or `with` condition opens
a regex. Getting this wrong in either direction hides code: a regex holding a
quote, or a division read as a regex, would swallow the rest of the line.

### The `process` rule

`"process"` forbids a read of the global `process`.[^source-boundary-ts]

| Never counted | Always counted |
| --- | --- |
| a string, template text, a regex body or a comment | `globalThis.process`, `global.process`, `window.process` and `self.process` |
| a member of another object: `child.process` | a spread: `...process` |
| a longer identifier: `ChildProcess` | `typeof process` |
| a private field: `#process` | computed access: `process["env"]` |
| an object-literal key or type member: `{ process: 1 }` | a template substitution: `${process.cwd()}` |

The exact token `process.env.__PACKAGE_VERSION__` is exempt, because the
bundler substitutes it at build time. `ignoreTokens` adds more exact tokens,
each starting at the reference. An exemption never applies through a member
access, so `globalThis.process.env.__PACKAGE_VERSION__` is still flagged.

### Confining a token: `forbidTokens`

The exemption holds everywhere, but a carrier's house rule is usually "the
version define appears only in `version.ts`". `{ forbidTokens }` forbids
each entry's exact text in code; paired with an `allowRules` waiver under the
`"forbidTokens"` key, it confines the token to the named files:

```ts
SourceBoundary.scan({
  root,
  rules: ["process", { forbidTokens: ["process.env.__PACKAGE_VERSION__"] }],
  allowRules: { forbidTokens: ["version.ts"] },
});
```

A use anywhere else is an offence. Each use inside `version.ts` is reported
in `waived`, so asserting `waived` names `version.ts` proves the confinement
is live rather than vacuous. The glob matches the root-relative path, as
every `allow` and `allowRules` glob does, so `version.ts` names only the
file at the root and `**/version.ts` names one at any depth. We chose the
generic forbid-plus-waiver shape over a dedicated `{ token, onlyIn }` rule
because the waiver already reports what it exempts; a separate `onlyIn` list
would need its own non-vacuity handle. The cost is that one `"forbidTokens"`
key covers every `{ forbidTokens }` rule in a scan: two tokens with different
homes need two scans.[^source-boundary-ts]

A token matches as whole text in the `code` view. A token that starts with
an identifier character does not match inside a longer identifier, and one
that ends with one does not run into the next. Whitespace must match byte
for byte, and a token containing a string literal never matches, since
strings are blanked. A member access still matches:
`globalThis.process.env.__PACKAGE_VERSION__` contains the token.

The known misses:

- `globalThis["process"]`, because the key is a string, and
  `const { process: p } = globalThis`.
- A regex literal directly after a block-closing `}`. It reads as a division,
  so a quote or `/*` inside it can hide the code after it.
- A variable named `yield` or `await` in a sloppy-mode script, which reads as
  the keyword, so a `/` after it opens a regex. Module and strict code reserve
  both words.
- JSX text, which reads as code. `.tsx` and `.jsx` are not among the default
  extensions for this reason.
- A bare built-in under `forbidImports: ["node:*"]`: the entry matches only
  the `node:` spelling, so `import { readFile } from "fs"` passes. A test
  that means "no Node built-ins" spreads Node's own list,
  `["node:*", ...builtinModules]` from `node:module`, which also forbids npm
  packages named like a built-in (`events`, `buffer`). The subpath ships no
  built-in list of its own, because one would drift with Node releases.

### The console rules

`"console"` flags every reference to the global `console`.
`"console-stdout"` flags the same references except a member access to one
of the methods Node's console writes to stderr: `error`, `warn`, `trace` and
`assert`.[^source-boundary-ts] It suits a stdio server that keeps stdout for
its protocol but may log to stderr. A bare or aliased reference
(`const c = console`, `f(console)`, `console[m]`) is still flagged, because it
can reach `log`. So is `console["error"]`, since the lexer blanks the string
key. Neither rule flags core's `Console` service: `Console.Console` is a
different identifier.

The stderr list comes from Node's console documentation, which has `error`
and `trace` print to stderr, `warn` as an alias of `error`, and `log` and
`info` print to stdout. It names no stream for `assert`.[^node-console] A
probe on Node 26 settled the rest: a
`Console` built over two capturing streams sent `error`, `warn`, `trace` and a
failing `assert` to stderr. It sent `log`, `info`, `debug`, `dir`, `dirxml`,
`table`, `count`, `group`, `groupCollapsed` and `time` to stdout.

### No scope analysis

The scanner cannot tell a local binding from the global. `cli`'s logger binds
a local `console` to core's `Console` service
(`CliLogger.ts:104`),[^cli-logger-ts] and `console` flags it. The fix is an
`allowRules` waiver of `console` for that one file. `cli`'s own boundary test
proves the waiver is both needed and the only one: its scan reports no
violations, and `waived` names `CliLogger.ts` under `console` and nothing
else. The file is still held to every other rule. The same holds for every local binding
named `process`: a parameter (`(process: Handle) => process.kill()`), a
variable, a label, and an unannotated class field
(`class A { process = 1 }`) are all flagged. An annotated class field
(`process: string`) reads as a type member and is not. Code that handles
child-process objects commonly names a parameter `process`. Renaming it is
the better remedy; failing that, waive the one rule with `allowRules` rather
than exempting the file from every rule with `allow`.

### `scan` and its non-vacuity handles

`scan` walks the root with an explicit stack and visits each real directory
once, through `FileSystem.realPath`. A symlink loop therefore terminates, and
a linked directory is not read twice. `node_modules` is never entered, and
declaration files are skipped. Every path comes back relative to the root and
`/`-separated, whatever the platform's separator, and `allow` globs match
against that same form. A missing root fails the scan; it never scans
nothing.[^source-boundary-ts]

Two kinds of exemption exist. An `allow` glob exempts a file from every rule.
An `allowRules` glob, keyed by an `OffenceRule`, exempts a file from that one
rule and leaves it checked against every other; the `"forbidImports"` key
covers every `{ forbidImports }` rule. Both compile through the same
`GlobSet` and match the same relative path, and an uncompilable glob of
either kind fails the scan with `GlobPatternError`. A file `allow` matches is
never checked, so nothing in it is waived.[^source-boundary-ts]

A `SourceScan` carries `files` (every file read), `allowed` (the files an
`allow` glob exempted), `offences`, and `waived` (every offence an
`allowRules` glob waived, sorted like `offences`). A waived offence is
reported, never dropped. `violations` is `[]` when clean. The handles exist
so a mistyped root, or a stale or over-broad exemption, cannot read as clean:

- assert `files` names a real file, or at least is non-empty;
- assert `allowed` is exactly the files you meant to exempt;
- assert `waived` is exactly what you meant to waive. A waiver that no
  longer waives anything, or waives more than intended, shows up here.

### `verifyFixtures`: the consumer's positive control

`SourceBoundary.fixtures` ships positive and negative controls for every rule
kind, including every lexer ambiguity that once hid a real read.
`verifyFixtures()` returns the names of the ones the scanner now gets wrong.
Assert it is `[]` beside your own scan: it proves the scanner you are trusting
still flags what it must and spares what it must.

```ts
import { SourceBoundary } from "@effected/workspaces/testing";

const offences = SourceBoundary.check("src/a.ts", "const { env } = process;", ["process"]);
console.log(offences.map((offence) => offence.label), SourceBoundary.verifyFixtures());
// => [ 'src/a.ts:1:17 process process' ] []
```

## WorkspaceLayering

### Offence reasons

`layers` is top-down: an edge may point only from a layer to one below it, or
into `tooling`.[^layer-policy-ts] Each offending edge carries one of five
reasons:[^workspace-layering-ts]

| Reason | The edge |
| --- | --- |
| `upward` | points into a higher layer |
| `sameLayer` | stays inside one layer |
| `toolingReachesLayer` | leaves a `tooling` package for a layer |
| `intoUnconstrained` | points into a package an `unconstrained` glob matches |
| `intoUnclassified` | points into a package the policy does not classify |

An edge *from* an unconstrained or unclassified package is skipped, because
that package has no place to check it against. It is never dropped silently,
though: an unclassified package is still reported in `unclassified`, and an
edge *into* either kind is an offender. A policy cannot fence a package off
from its dependents by leaving it out.

`LayeringReport.violations` also reports duplicates, a cycle, a declared name
the workspace lacks, a missing `requiredEdges` entry, and an `edgeCount` of 0
as a vacuous check.

### Strict decoding

`LayerPolicy.decode` and `load` reject every key the policy does not model,
and the `decode` error's message names each one.[^layer-policy-ts] A typo on
an optional key would otherwise be dropped in silence: `requiredEdge`
(singular) would remove the non-vacuity guard and leave the report green,
and `feilds` would widen the check to all four fields. `$schema` is always
accepted. A policy file that carries keys of its own, such as systems'
`harness`, names them in `allowKeys`
(`LayerPolicy.load(path, { allowKeys: ["harness"] })`), and those keys are
dropped before decoding.

### What a policy cannot express

Layers forbid only upward and same-layer edges. A policy cannot forbid one
particular downward edge. In this repository `cli` sits above `engine`, so a
manifest edge `cli -> engine` passes layering even though the front-end
design keeps `cli` off `engine`.[^layers-json] Only `cli`'s own source scan
guards that edge, through its `forbidImports`, and only for an import under
`src/`. A `forbiddenEdges` key would close the gap and does not exist yet.

### Edges by name, one per field

`DependencyGraph` merges all four dependency fields into one adjacency
(`DependencyGraph.ts:114-120`),[^dependency-graph-ts] so it cannot answer
"which field declared this edge". `WorkspaceLayering.edgesOf` recomputes one
`LayerEdge` per declaring field, and `check` reads only the policy's `fields`.
That is why `check` takes a `LayeringGraph` of names and edges rather than a
list of packages.

An edge exists wherever a dependency's **name** is a workspace package,
whatever its specifier. Counting only `workspace:` specifiers, as the systems
repo did, misses npm and yarn ranges and pnpm's `linkWorkspacePackages`.

### A devDependency-only cycle and the `fields` choice

A cycle closed only by a devDependency is reported when `devDependencies` is
among the policy's `fields`, and is invisible when it is not. Pick `fields`
for what the layers mean. This repository checks runtime fields only,
because test-only devDependencies may point up
([the runtime-edge decision](../decisions/kit-layering-checks-runtime-edges.md)),
and it pins acyclicity across all four fields with a separate
`DependencyGraph.hasCycle` assertion.

### The root package must be classified

`WorkspaceDiscovery` always returns the root package, with `relativePath`
`"."`. A policy that forgets it reports it in `unclassified`. Classify it,
usually with an `unconstrained` glob.

Every policy entry matches a package's `name`, never its
`relativePath`.[^workspace-layering-ts] `layers` and `tooling` list exact names,
and `unconstrained` globs match names. A private root named `okfit` at
`relativePath` `"."` is classified by `"okfit"`, and an entry of `"."` or
`"packages/*"` classifies nothing. `__test__/WorkspaceLayering.test.ts` pins
both halves.

### The worked example

This repository's own policy is `lib/configs/layers.json`.[^layers-json] It
has five layers, `@effected/pnpm-plugin-effect` as tooling, and the root, the
docs site, the scratchpad and the two plugin tracking packages as
unconstrained. It checks `dependencies`, `peerDependencies` and
`optionalDependencies`, and it requires four edges that must stay present,
such as `@effected/mcp -> @effected/engine`. `cli`, `mcp` and `workspaces`
share one layer, so any runtime edge between them is a `sameLayer` offence.
`__test__/integration/layering.int.test.ts` checks the real workspace against
it.

The pure `check` needs no filesystem, so positive controls are plain values:

```ts
import { LayerEdge, LayerPolicy, WorkspaceLayering } from "@effected/workspaces/testing";

const policy = LayerPolicy.make({ layers: [["app"], ["lib"]], tooling: [], unconstrained: ["root"] });
const report = WorkspaceLayering.check(
  {
    names: ["root", "app", "lib"],
    edges: [
      LayerEdge.make({ from: "app", to: "lib", field: "dependencies" }),
      LayerEdge.make({ from: "lib", to: "app", field: "peerDependencies" }),
    ],
  },
  policy,
);
console.log(report.violations);
// => [ 'upward: lib -> app (peerDependencies)', 'dependency cycle among: app, lib' ]
```

## PackedInstall

### The per-manager traps

`PackedInstall.run` packs the carrier and its closure into a scoped,
realpath'd scratch directory, then installs it into a fresh consumer per
available manager. Each row below is a trap a consumer repository hit by
hand-rolling this check; the pure half lives in
`internal/packedInstallPlan.ts`.[^packed-install-plan-ts]

| Trap | What `PackedInstall` does | Found in |
| --- | --- | --- |
| The parent run's `npm_*`, `CI` and `INIT_CWD` leak into the child manager | `scrubEnv` strips them, plus `pnpm_config_*`, `PNPM_SCRIPT_SRC_DIR`, `PNPM_PACKAGE_NAME` and `YARN_*` | vitest-agent[^vitest-agent-packed-install] (lines 139-147) |
| `NODE_V8_COVERAGE` makes a spawned manager race vitest's coverage files | `scrubEnv` strips it | systems[^systems-helpers] (lines 8-15) |
| pnpm 10+ reads overrides only from `pnpm-workspace.yaml`, and pnpm 11 ignores `package.json#pnpm` | pnpm consumers get a settings-only `pnpm-workspace.yaml` | vitest-agent (lines 221-234), systems[^systems-packed-install] (lines 123-152) |
| Yarn Berry defaults to Plug'n'Play and never writes `node_modules/.bin` | Berry consumers get a `.yarnrc.yml` with `nodeLinker: node-modules` and scripts off | vitest-agent (lines 237-256) |
| macOS `/var` is a symlink to `/private/var`, so `file:` specs and the install cwd disagree | the scratch directory is realpath'd | systems (lines 70-73) |
| Outside the repo, corepack falls back to whatever it cached last | `packageManager` is pinned to the probed `<pm>@<version>` | systems (lines 139-142) |
| pnpm 12 fails an install that ignored a dependency build script | pnpm installs with `--config.ignore-scripts=true` | systems (lines 56-68) |
| A repo's `packageManager` pin makes corepack refuse any other manager inside it | each manager is probed with `--version` from the scratch directory | vitest-agent (lines 119-128) |
| pnpm 12 only **warns** on a mismatched `packageManager` pin; it neither refuses nor switches | `PackedInstall` does not check this. To prove no switch happened, assert in your own test that `<pm> --version` run inside the consumer equals `consumer.managerVersion` | this package's e2e, which makes that assertion[^packed-install-e2e] |
| npm fails `EOVERRIDE` when a direct dependency's spec differs from its override | a `consumerDependencies` entry naming a packed package is written as the same `file:` spec the override uses | this package's final review (npm 11.19.1), pinned by the e2e's S1 case under every manager |
| Yarn Berry's `npmMinimalAgeGate` quarantines any version under a day old, so a consumer of a just-released package fails `YN0016`; the caller cannot lower it, since `scrubEnv` drops `YARN_*` | Berry 4.10+ consumers get `npmMinimalAgeGate: 0`. Berry 2.x-4.9 do not, because an unknown `.yarnrc.yml` key fails every command and 4.9.4 does not know it | systems, the yarn-age-gate dogfood loop (Yarn 4.18.1) |
| pnpm 11 and 12 gate fresh versions by default but non-strictly: the install passes, appends `minimumReleaseAgeExclude:` to the consumer's `pnpm-workspace.yaml`, and may resolve a range to an older, mature match | pnpm consumers' `pnpm-workspace.yaml` starts with `minimumReleaseAge: 0` | same loop, probed on pnpm 11.28.2 and 12.6.0 |

User-level configuration is inherited by design. `HOME` stays, so each
manager still reads the user's registry, auth and proxy settings, as a real
install on that machine would.

### Closure, pack source and requirements

`closure: "auto"` is the carrier's transitive **runtime** workspace
dependencies: `dependencies`, `optionalDependencies` and `peerDependencies`,
never `devDependencies`.[^packed-install-plan-ts]

`packFrom` defaults to `{ directory: "dist/prod/npm/pkg" }`, which `npm pack`s
the effected bundler's prod output: the same file list a release
publishes. `"source"` runs `pnpm pack` in the package directory instead. That
packs whatever `publishConfig.directory` names, which under the effected
bundler is the **dev** build, and it needs a workspace that has been
`pnpm install`ed, or the pack fails `PackFailed` naming the missing
install.[^packed-install-ts] A packed manifest whose runtime maps still carry a
`workspace:`, `catalog:`, `link:` or relative `file:` specifier fails
`UnresolvedProtocol` before any install, naming each one; no consumer
outside the workspace could resolve them.[^packed-install-plan-ts] Why the default is the prod directory is
[the pack-source decision](../decisions/packed-install-pack-source.md).

A requested manager that does not answer `--version` lands in `unavailable`.
Under `require: "any"`, the default, one available manager is enough; under
`require: "all"`, any unavailable one fails `ManagerUnavailable`. No manager
at all fails `NoManagerAvailable`, never an empty success. Assert
`consumers.length > 0` in any case.

Declare every package the consumer's own code imports through
`consumerDependencies`. pnpm's isolated layout links only a project's
declared dependencies at its top level, so a peer reached only through the
carrier resolves inside the carrier but fails `ERR_MODULE_NOT_FOUND` from the
consumer root, while npm and bun hoist it and pass.

An entry naming a packed package, the carrier or a closure member, is
written as that package's `file:` tarball whatever spec the caller passes,
so any range will do. The tarball always wins, for two reasons. npm fails an
install whose direct spec differs from its override with `EOVERRIDE`, and
accepts an identical one. And a caller's range must never silently replace
the tarball the run exists to prove.[^packed-install-plan-ts]

An install that outlives `installTimeout` (four minutes by default) fails
`InstallFailed` with a message naming the manager and the ceiling, distinct
from a manager that could not spawn at all. The installs run one after
another, so a test's outer `Effect.timeout` must cover the number of
managers times `installTimeout`, plus the pack and whatever the test runs
afterwards. A tighter guard fires first, as a `TimeoutError` that names no
manager. `PackedInstall.timeoutBudget({ managers, installTimeout, packages,
perConsumer })` returns that sum as a `Duration`. It adds each manager's probe
(30 seconds), install and `perConsumer` (one minute by default: one `runBin`
at its default ceiling; `"0 seconds"` for a test that only installs), each
package's pack (`packTimeout`,
two minutes by default; a pack past it fails `PackFailed` naming the package
and the ceiling) and manifest read (30 seconds), 30 seconds for the untimed
steps, and one minute for cleanup: removing the scratch root when the scope
closes, and killing a child after its ceiling interrupts it. It reads the
same constants the run does, so the two cannot drift. `packages` is a count
or the names `PackedInstall.closure(carrier, options?)` returns: the packages
the run will pack, in order, computed without packing by the same planner the
run calls, so they equal `Object.keys(result.tarballs)`. It takes the run's
own options object, and fails as the run would before packing.
`PackedInstall.timeoutBudgetFor(runOptions, { perConsumer? })` plans with
`closure` and budgets with `managers`, `installTimeout` and `packTimeout` from
the same object, in one Effect. A vitest test's timeout is fixed when it is
declared, so a consumer awaits either at module evaluation, gated on its
prod build existing.[^packed-install-ts]

### Preflight: a missing prod build is a decision, not an error

`PackedInstall.run` packs `dist/prod/npm/pkg` by default, and a test job that
only ran `build:dev` has none of it: the run fails `PackSourceMissing`.
`PackedInstall.preflight({ carrier, closure?, overrides?, workspaceOverrides?,
packFrom? })` answers first, from the run's own planner, with
`{ ready, missing }`: `missing` is the absolute `package.json` paths under
`packFrom` that do not exist, in pack order (closure members only: an override
is validated by the planner itself). `packFrom: "source"` checks nothing
(`pnpm pack` builds none of its own), so it is always ready. It needs
`WorkspaceDiscovery | FileSystem | Path` and fails as `closure` does, plus `Io`.

`PackedInstall.gate(preflight)` is the decision over that answer, an
`Effect<PackedInstallGate>`: ready is `"run"`; missing is `"skip"` off CI and
`"fail"` under CI, with a `message` naming every missing path and the prod
build to run. `CI` is read through `Config` (so the ambient `ConfigProvider`
decides, and a test stubs it) and counts as set when present and not `""`,
`"0"` or `"false"` (case-insensitive); an unreadable `CI` counts as unset.
Nothing reads `process`. The suite wires the decision with `describe.runIf`: one block for
`"run"`, one whose single test `assert.fail(gate.message)`s for `"fail"`. There
is deliberately **no vitest-facing wrapper** in the package: a `packedDescribe`
would make `vitest` a dependency of a subpath that today needs none, for two
lines of consumer code, and the recipe in `design-patterns`'
`carrier-verification.md` carries them. The reason the gate exists: a plain
skip gate silently skips in a PR job that never ran the prod build, which is
how okfit's first version would have gone green having proven nothing.

### Overrides: packages from outside the workspace

A closure member can depend on a package version the registry does not have
yet, typically a sibling checkout's unreleased build that the workspace itself
links through a dogfood `pnpm-workspace.yaml` override. The scratch consumers
would resolve it from the registry and miss the new surface. `overrides` maps
a package name to a publish-ready package directory, which is `npm pack`ed,
or to a `.tgz`, which is used as it is; a relative path resolves against the
workspace root. `workspaceOverrides: true` also takes every bare-name
`"<name>": "file:<path>"` entry of the root `pnpm-workspace.yaml`'s
`overrides:`, and an explicit `overrides` entry wins over one read there.
Each supplied package joins `result.tarballs` after the closure, sorted by
name, and every consumer steers it to its tarball through the same override
field as the closure, so the closure's transitive references install it
whatever range they ask for. An override naming the carrier or a closure
member (the workspace copy is what the run proves), a path that is neither a
package directory nor a `.tgz`, a tarball whose manifest carries another name,
or an unreadable or non-YAML `pnpm-workspace.yaml` fails `InvalidOverride`.
The e2e proves it under every available manager against a package no
registry has, with a control that fails the same install without the
override.[^packed-install-e2e]

### POSIX only

`.bin` entries are shell shims or symlinks, and the tarball's manifest is
read with `tar -xzOf`. A `Path` whose separator is not `/` fails
`UnsupportedPlatform` before anything spawns.

### Why neither `PackagePublish.pack` nor `PackageTarball`

`PackagePublish.pack` writes its tarball into the package directory
(`PackagePublish.ts:317`) with no `--pack-destination`, so it would drop a
`.tgz` into `dist/prod/npm/pkg` that a later pack ships inside itself. It
also needs `Crypto` and `LocalExec` in `R` for a SHA-256 this check does not
use.[^package-publish-ts] `PackageTarball.extract` fetches a *published*
version over `HttpClient`, not a local tarball.[^package-tarball-ts]
`PackedInstall` runs `npm pack` or `pnpm pack` through `Run` into an empty
per-package destination and takes the one `.tgz` it finds, which also
sidesteps npm 12's keyed-by-name `--json` shape.

### Composing `McpProbe`

`PackedInstall` asserts that each bin exists and is executable, not what it
does. Run each bin from the test, inside the same scope.
`InstalledConsumer.runBin(name, args, options?)` spawns it from the consumer
directory and returns `{ stdout, stderr, exitCode }`; a
non-zero exit is a result. A spawn failure, an expired ceiling (one minute by
default) or flooded output fails `BinFailed`. The environment is the one the
install ran under, which the consumer carries as a redacted `env` field so
printing it never prints a token. `options.env` is layered over it after the
scrub, with an `undefined` value removing a variable, so a caller's explicit
entry wins: `CI: "true"` runs a bin as if under CI. A
consumer's test therefore needs no direct `@effected/commands` dependency to
run a bin.[^packed-install-ts]

`RunBinOptions.stdin` (shared by `runBin` and `runCarrierBin`) is what the bin
reads: a string (UTF-8), bytes or a `Stream<Uint8Array, PlatformError>`, written
and then closed, matching core's `ChildProcess` `stdin` and `CliTest.run`'s
text option. **Omitted or `""` the bin's stdin is the null device**
(`"ignore"`): it reads end of input at once, never an open pipe, so a bin that
reads stdin exits rather than hanging until the ceiling. That is the
behaviour `runBin` already had; the option only adds input. Empty bytes or an
empty stream are sent as given. A conversation that must interleave with the
bin's output (an LSP session, `McpProbe`) is driven through `command` /
`carrierCommand`, which leave stdin open. The e2e
(`__test__/e2e/RunBinStdin.e2e.test.ts`) spawns a real echoing bin to pin all
of it. A transport probe for an LSP is not part of this package: a separate
`@effected/lsp` ships it.

`PackedInstallResult.scratch` is the realpath'd scratch root, so per-run
state such as `XDG_DATA_HOME` can live inside it and be removed with it
rather than in a second temporary directory.

For an MCP bin, `McpProbe.initialize` from `@effected/mcp/testing` is the
proof. `InstalledConsumer.command(name, args?, options?)` returns the
`ChildProcess` command `runBin` builds, with the same environment layering and
scrub, and leaves stdin as the spawner's default pipe so the probe can write
to it; `runBin` spawns that command with `options.stdin`, or the null device
when omitted. There is no runtime
edge between `workspaces` and `mcp`: the consumer's test passes one to the
other. The scratch directory is removed when the scope closes.

By default only the carrier may declare its bins; carrier-only bins are
recommended and shared bins a supported alternative
([the carrier-only bins decision](../decisions/carrier-only-declares-bins.md)).
Under a flat npm, Yarn or bun layout, a hoisted bin of the same name from
another package can take the carrier's `.bin` slot, and running it cannot tell
which one ran. npm 11 and bun 1.4 were observed to link the package whose name
sorts first; the e2e pins that with a `cli` front end beating a `plugin`
carrier, and the same pair named the other way round let the carrier win.
Yarn 1.22 and 4.18 (the `node-modules` linker) kept the carrier's bin, the
consumer's direct dependency, and the e2e asserts that wherever yarn is on
`PATH`.[^packed-install-e2e]
The run therefore fails `BinConflict`, before any install, when
a packed package other than the carrier (a closure member or an override)
declares one of the carrier's bin names, read from the packed manifests it
already inspects: a `bin` object's keys, or for a `bin` string the unscoped
package name. It compares packed packages only: `directories.bin` is not
read, and a dependency installed from the registry that declares the same
bin name goes undetected. `allowSharedBins: true` skips the check for a
carrier whose front ends share its bin names on purpose, because they are
also installed on their own; its cost is provenance under flat layouts. The
expected bins are still verified present and executable, but `runBin` may run
a front end's. `InstalledConsumer.runCarrierBin(name, args?, options?)` runs
the carrier's own bin regardless: it reads `node_modules/<carrier>/package.json`
(the consumer's `carrier` field, which `run` sets), takes `name` from its
`bin` map, and runs that file with `node` under `runBin`'s environment,
with `options.stdin` (the null device when omitted). Through `node` it assumes a Node script, drops any flags in
the shim's shebang, and bypasses the executable bit, so it proves the
carrier's shim runs, not that it is executable. `carrierCommand` returns the same command with stdin open for
`McpProbe`. A consumer with no carrier, a carrier not installed or not
declaring the bin, or a declared file that is missing fails `MissingBin`;
an unreadable or non-JSON manifest fails `Io`.[^packed-install-ts]

`InstalledConsumer.binProvenance(name)` answers that for the
managers that write `.bin` entries as symlinks: npm, bun, and Yarn under the
`node-modules` linker the run configures. It reads the link, realpaths the
target, and walks up to the nearest `package.json` with a string `name`,
staying inside the consumer directory; a nameless nested manifest such as a
`dist/package.json` carrying only `type` is passed over. It returns
`{ package, target }`.[^packed-install-ts]

pnpm writes `.bin` entries as shell shims, and `binProvenance` returns
`undefined` for them rather than parsing a script. We declined shim parsing:
pnpm's isolated layout links only the consumer's direct dependencies at the
top level, so the shadowing it would detect needs a direct dependency there.
`undefined` means only that: the entry exists and is not a symlink. Node
reports "not a link" from `readLink` as `EINVAL`, which its platform layer tags
`Unknown` with the errno on the cause, and `@effected/memfs` raises the same
shape. Only that means a shim; any other `readLink` failure, such as
`EACCES`, `BadResource` or an `Unknown` with another errno, fails `Io`. An entry that does not exist, or a link whose target
does not, fails `MissingBin`, consistent with the run's own bin check. A
link into no named package inside the consumer fails `UnownedBin` naming the
target, and the walk's bound is the consumer directory realpath'd first, so a
`/var` alias of `/private/var` or a trailing slash cannot move it. A manifest
that is valid JSON but not an object is passed over like a nameless one. The e2e asserts the carrier
under npm and bun, and `undefined` under pnpm, against real installs.[^packed-install-e2e]

[^testing-ts]: `packages/workspaces/src/testing.ts` — the entry point and its
    `@packageDocumentation` block.
[^source-boundary-ts]: `packages/workspaces/src/SourceBoundary.ts` — the
    rules, the exemption, the documented misses and `scan`.
[^source-text-ts]: `packages/workspaces/src/internal/sourceText.ts` —
    `LexedSource` and `lex`.
[^cli-logger-ts]: `packages/cli/src/CliLogger.ts:104` — the local `console`
    binding.
[^node-console]: <https://nodejs.org/api/console.html> — the global
    console's methods and the streams they write to.
[^layer-policy-ts]: `packages/workspaces/src/LayerPolicy.ts` — the policy
    schema and its field semantics.
[^workspace-layering-ts]: `packages/workspaces/src/WorkspaceLayering.ts` —
    the offence rule, `edgesOf` and `check`.
[^dependency-graph-ts]: `packages/workspaces/src/DependencyGraph.ts:114-120`
    — the merged adjacency.
[^layers-json]: `lib/configs/layers.json` — this repository's layer policy.
[^packed-install-plan-ts]: `packages/workspaces/src/internal/packedInstallPlan.ts`
    — `scrubEnv`, `closureOf`, `consumerFiles`, `installArgs`,
    `readPackedManifest`, `binConflict` and `fileOverridesOf`.
[^packed-install-ts]: `packages/workspaces/src/PackedInstall.ts` — `PackSource`,
    `run`, `closure` and the shared planner behind both.
[^package-publish-ts]: `packages/npm/src/PackagePublish.ts:317,453-457` — the
    pack destination and the service requirements.
[^package-tarball-ts]: `packages/npm/src/PackageTarball.ts:75,117` — the
    registry fetch.
[^vitest-agent-packed-install]: vitest-agent,
    `packages/plugin/__test__/bins-packed-install.e2e.test.ts`.
[^systems-packed-install]: systems,
    `e2e/silk/__test__/e2e/packed-install.e2e.test.ts`.
[^systems-helpers]: systems, `e2e/silk/__test__/e2e/helpers.ts`.
[^packed-install-e2e]: `packages/workspaces/__test__/e2e/PackedInstall.e2e.test.ts`
    — the pnpm pin mutation: a pin of 12.6.0 under a running 12.5.1 installed
    without switching.


---
<!-- okf/decisions/packed-install-pack-source.md -->
---
type: Decision
title: PackedInstall packs the prod npm directory by default
description: "Probe P3 compared pnpm-packing a package's source against npm-packing its dist/prod/npm/pkg build, and PackedInstall's default packFrom became { directory: \"dist/prod/npm/pkg\" }."
status: stable
tags:
  - architecture
sources:
  - id: packed-install-ts
    resource: ../../packages/workspaces/src/PackedInstall.ts
  - id: p3-probe
    resource: probe P3, run 2026-09-23 in the gitignored scratchpad workspace (not committed)
  - id: packed-install-e2e
    resource: ../../packages/workspaces/__test__/e2e/PackedInstall.e2e.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-24T01:41:28Z
  body_sha256: 6c56e28c0ca5287c0424caac8399e07e6262c6b97c65d4a046aaa097657dc595
verified:
  - by: human:spencer
    at: 2026-09-24T06:10:09Z
---

# PackedInstall packs the prod npm directory by default

## Context

`PackedInstall` needs a tarball per closure package, and a package can be
packed from two places. Candidate A runs `pnpm pack` in the package's source
directory, where pnpm honours `publishConfig.directory` and rewrites
`workspace:` and `catalog:` specifiers. Candidate B runs `npm pack` in
`dist/prod/npm/pkg`, the effected bundler's prod npm output, whose manifest
the build has already made publish-ready.

Probe P3 packed five packages (`engine`, `mcp`, `cli`, `schemastore`,
`schemastore-cli`) both ways under npm 11.19.1, pnpm 12.5.1 and bun 1.4.2,
with yarn absent from the machine.[^p3-probe] Its eight criteria and what it
recorded:

| Criterion | Result |
| --- | --- |
| C1: the pack exits 0 with exactly one `.tgz` | both candidates, all five packages |
| C2: no `workspace:` or `catalog:` specifier survives in the packed manifest | both candidates, all five packages |
| C3: every `exports` and `bin` target is in the tarball | both candidates, all five packages |
| C4: the tarball's file list equals `dist/prod/npm/pkg` | B: empty difference for all five. A: every `*.js.map` and `*.d.ts.map` only in the tarball, `tsdoc-metadata.json` only in the prod build, for every package |
| C5: `private` is `false` in the packed manifest | both candidates, all five packages |
| C6: scenario installs (S1: `mcp` with its `engine` peer; S2: the `schemastore-cli` bin) | exit 0 for both candidates under npm, pnpm and bun |
| C7: the installed code runs from the consumer root | S2 passes everywhere. S1 passes under npm and bun, and fails `ERR_MODULE_NOT_FOUND` on `@effected/engine` under pnpm, identically for both candidates |
| C8: `pnpm pack` rewrites `workspace:^` in a never-installed workspace | no: it fails `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`, exit 1 |

C4 is the discriminator. Under the effected bundler `publishConfig.directory`
names `dist/dev/pkg`, so candidate A packs the **dev** build: source maps
present, `tsdoc-metadata.json` absent. Candidate B is the file list a release
actually publishes.

The literal outcome rule read "F", because neither candidate cleared C7 under
pnpm for S1. That failure is not a pack-source property: the S1 consumer
imported `@effected/engine` without declaring it, and pnpm's isolated layout
links only declared dependencies at a project's top level. The override
resolved the peer correctly inside `mcp` for both candidates; npm and bun
hoist, and passed.

## Decision

The default `packFrom` is `{ directory: "dist/prod/npm/pkg" }` (outcome D),
packed with `npm pack --ignore-scripts`.[^packed-install-ts] It is the
artifact a release publishes. `"source"` stays available as an explicit
choice.

The S1 finding became an option rather than a verdict: `consumerDependencies`
declares every package the consumer's own code imports, and its TSDoc names
pnpm's isolated layout as the reason.

## Alternatives rejected

**`"source"` as the default (candidate A).** It proves the dev build, not the
published one: a file the prod build drops, or a map the prod build omits,
would pass here and differ in the release. It also fails outright in a
workspace that has never been `pnpm install`ed (C8), which is exactly the
state of a fresh CI checkout that skipped install, or a generated fixture.

**No default (outcome F taken literally).** It would make every consumer
choose a pack source to work around a fixture defect that affected both
candidates equally.

## Consequences

- A consumer must build before running `PackedInstall`. A missing
  `dist/prod/npm/pkg/package.json` fails `PackSourceMissing`, naming the
  package to build.
- A repository not on the effected bundler passes its own `{ directory }`.
- Source mode needs the workspace installed first. `PackedInstall` detects
  pnpm's error code and says so in the `PackFailed` message.
- The e2e proves both modes against a generated fixture: the default mode
  without a `packFrom`, and source mode after an offline
  `pnpm install`.[^packed-install-e2e]

[^p3-probe]: Probe P3's results and findings, recorded here because the
    scratchpad is not committed.
[^packed-install-ts]: `packages/workspaces/src/PackedInstall.ts` —
    `DEFAULT_PACK_FROM` and the `PackSource` TSDoc.
[^packed-install-e2e]: `packages/workspaces/__test__/e2e/PackedInstall.e2e.test.ts`
    — the prod-default and source-mode tests.


---
<!-- okf/decisions/kit-layering-checks-runtime-edges.md -->
---
type: Decision
title: The kit's layering check forbids runtime edges only
description: The front-end kit's forbidden package edges are runtime edges, so this repository's layers.json checks dependencies, peerDependencies and optionalDependencies, and test-only devDependencies may point up.
status: stable
tags:
  - architecture
sources:
  - id: layers-json
    resource: ../../lib/configs/layers.json
  - id: layering-int-test
    resource: ../../packages/workspaces/__test__/integration/layering.int.test.ts
  - id: engine-package-json
    resource: ../../packages/engine/package.json
generated:
  by: "okfit/claude-code"
  at: 2026-09-24T01:41:28Z
  body_sha256: ef87325e7e10c928a1f7b1e441585c70d41832b2f31ed8cae55e052d24cee096
verified:
  - by: human:spencer
    at: 2026-09-24T06:10:09Z
---

# The kit's layering check forbids runtime edges only

## Context

The front-end kit design forbids five package edges: `cli` to `mcp`, `mcp` to
`cli`, `mcp` to `workspaces`, `workspaces` to `mcp`, and `engine` to anything
else in the kit. Phase 3 then shipped `SourceBoundary` in
`@effected/workspaces/testing`, and `engine`, `mcp` and `cli` each adopted it
for their own boundary tests. Each takes `@effected/workspaces` as a
`workspace:*` **devDependency**.[^engine-package-json] Read over all four
dependency fields, those are `upward` edges, and `engine`'s is exactly the
edge the design forbids.

A devDependency is never installed for a package's consumers. No install
graph gains an edge, and `mcp`'s peers and dependencies still never name
`workspaces`. What the forbidden edges protect is what a consumer installs
and loads.

## Decision

The forbidden edges are **runtime** edges. This repository's
`lib/configs/layers.json` sets `fields` to `dependencies`,
`peerDependencies` and `optionalDependencies`.[^layers-json] It places `cli`,
`mcp` and `workspaces` in one layer, so a runtime edge between any two of
them is a `sameLayer` offence, and it places `engine` in the bottom layer.
Test-only devDependencies may point up.

## Alternatives rejected

**Check all four fields.** It would forbid `engine` from testing itself with
the kit's own scanner, and force a copy of `SourceBoundary` into `engine`'s
test tree, which is the hand-rolled scanner phase 3 replaced.

**A dedicated fixtures or test-support package** at the bottom layer, so the
devDependency points down. Unneeded: `SourceBoundary` ships its own positive
controls (`fixtures` and `verifyFixtures`), so nothing a boundary test needs
lives anywhere but `@effected/workspaces/testing`, and a new package would
add a release unit for no runtime benefit.

## Consequences

- Acyclicity across **all four** fields is pinned separately. The layering
  integration test asserts `DependencyGraph.hasCycle` is false over the whole
  discovered graph, so a devDependency still cannot close a
  cycle.[^layering-int-test]
- The same test proves the devDependency edges exist and would be caught if
  the policy checked them: it asserts
  `@effected/engine -> @effected/workspaces (devDependencies)` is an edge,
  and that an all-field policy reports it as `upward`.
- Each design-forbidden edge has a positive control in that test: planting
  it as a peer edge yields exactly the expected offence.

[^layers-json]: `lib/configs/layers.json` — `fields` and the layer placing
    `cli`, `mcp` and `workspaces` together.
[^layering-int-test]: `packages/workspaces/__test__/integration/layering.int.test.ts`
    — the policy check, the forbidden-edge controls, the devDependency test
    and the all-field acyclicity assertion.
[^engine-package-json]: `packages/engine/package.json` — the `workspace:*`
    devDependency on `@effected/workspaces`.


---
<!-- okf/decisions/carrier-only-declares-bins.md -->
---
type: Decision
title: Carrier-only bins are recommended; shared bins are a supported choice
description: "In the carrier pattern, front ends should declare no bin of the carrier's names, required only when provenance must hold under flat installs; sharing the names is a supported choice with allowSharedBins, and PackedInstall's BinConflict default makes it explicit."
status: stable
tags:
  - architecture
  - dx
sources:
  - id: owner-ruling
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-09-25T00:00:00Z
  - id: vitest-agent-findings
    resource: ../../.claude/dogfood/vitest-agent/2026-09-25-findings-front-end-kit.md
  - id: vitest-agent-loader-status
    resource: ../../.claude/dogfood/vitest-agent/2026-09-25-status-item15-loader.md
  - id: packed-install-ts
    resource: ../../packages/workspaces/src/PackedInstall.ts
  - id: carrier-entry-contract
    resource: ../../plugin/skills/design-patterns/references/carrier-entry-contract.md
  - id: okfit-consumer
    resource: ../consumers/okfit.md
  - id: systems-consumer
    resource: ../consumers/systems.md
  - id: vitest-agent-optout-status
    resource: ../../.claude/dogfood/vitest-agent/2026-09-25-status-item15-optout.md
  - id: vitest-agent-round2-findings
    resource: ../../.claude/dogfood/vitest-agent/2026-09-25-findings-round2-front-end-kit.md
  - id: reframe-ruling
    resource: conversation with the repository owner, ruling on vitest-agent's round-2 friction items 18 to 20
    author: human:spencer
    last_modified: 2026-09-25T00:00:00Z
  - id: packed-install-e2e
    resource: ../../packages/workspaces/__test__/e2e/PackedInstall.e2e.test.ts
generated:
  by: "claude-code/opus-5.5"
  at: 2026-10-03T04:19:44Z
  body_sha256: d3e754274b901505b2bf6871f6108c4a3810c06c21e6a6834f8c72ec159446e9
verified:
  - by: human:spencer
    at: 2026-09-25T20:39:50Z
  - by: human:spencer
    at: 2026-09-25T20:47:50Z
  - by: human:spencer
    at: 2026-09-25T21:18:59Z
  - by: human:spencer
    at: 2026-09-25T21:26:12Z
---

# Carrier-only bins are recommended; shared bins are a supported choice

## Context

The carrier pattern ships one bin shim per front end in the carrier, each
calling the front end's `main()` with the carrier's distribution identity.
Front ends may also declare the same bin names themselves ("mirror" or
shared bins). vitest-agent's packed-install e2e asserted which package each
`.bin` entry belonged to, and found npm and bun linking the front end's bin
over the carrier's shim, so `--version` lost its `via @vitest-agent/plugin`
suffix; only pnpm's isolated layout kept the carrier's shim.[^vitest-agent-findings]
The kit's own e2e narrowed the cause: npm 11 and bun 1.4 link the package
whose name sorts first, so a `cli` front end beats a `plugin` carrier, and
the same pair named the other way round let the carrier win; Yarn 1.22 and
4.18 kept the carrier's bin, the consumer's direct dependency.[^packed-install-e2e]
The tool runs either way; what depends on the package manager is the carrier
identity.

The first ruling made carrier-only bins the rule.[^owner-ruling] vitest-agent
then kept its front-end bins deliberately. Its front ends are useful on
their own; shadowing under npm and bun changes nothing but provenance,
because every bin calls the same `main()`; and dropping the bins would break
direct use of `@vitest-agent/cli` and `@vitest-agent/mcp`, force a major on
both, and make the loader's `npx` fallback download the whole carrier.[^vitest-agent-optout-status]

## Decision

Carrier-only bins are **recommended**: front ends declare no bin with a name
the carrier declares, keeping `src/bin.ts` as a workspace-local development
entry. They are **required** only when provenance (the `--version` suffix,
the distribution identity) must hold under flat installs.[^reframe-ruling]
The design-patterns skill teaches both shapes.[^carrier-entry-contract]

Shared bins are a **supported, permanent alternative** for a carrier whose
front ends also stand alone. Its cost, stated plainly: under npm and bun
(and possibly Yarn, though Yarn 1 and 4 were observed keeping the carrier's)
a front end's bin can win the `.bin` slot, and then provenance is lost;
behaviour is otherwise the same when every bin calls the same `main()`.

`PackedInstall.run` makes the choice explicit. Its `BinConflict` check stays
on by default: a packed package other than the carrier (a closure member or
an override) that declares one of the carrier's bin names fails before any
install.[^packed-install-ts] It reads manifests the run already extracts, and
compares packed packages' `bin` fields only: `directories.bin` is not read,
and a registry dependency declaring the same name goes undetected.
`allowSharedBins: true` is how a carrier that shares its bin names says so.
The run still verifies the expected bins are present, and
`InstalledConsumer.runCarrierBin` proves the carrier's own shim through its
installed `bin` map whichever package took the slot, recovering the
coverage a shared name would otherwise leave to pnpm alone.[^vitest-agent-round2-findings]

## Alternatives rejected

- **Carrier-only bins as a hard rule.** Rejected on vitest-agent's reasons:
  it would force a major on every standalone front end for a gain in
  provenance only, which a carrier may reasonably not need.
- **Keep mirror bins silently.** Rejected: which package runs would still
  depend on the package manager, unseen. The default-on `BinConflict` plus
  an explicit `allowSharedBins` keeps the trade-off visible in every test
  that makes it.
- **Make the check opt-in.** Rejected: an opt-in check protects nobody who
  does not know about the hazard.

## Consequences

For carriers that drop their front-end bins, a plugin loader's `npx`
fallback can no longer name a front end, because `npx <package>` runs that
package's own bin. It names the carrier instead,
`npx --yes -p @scope/plugin@<MAJOR> <tool>-mcp`, which also carries the
distribution identity on the fallback path.[^vitest-agent-loader-status]
Dropping a front end's `bin` breaks anyone who installed that front end, or
ran it through `npx`, for its bin, so that move is a major bump of every
front end that loses a bin, with the loader moving to the carrier form in
the same release. A carrier that keeps shared bins keeps its front-end
fallback.

Optional migrations, not pending ones: okfit, whose `@okfit/cli`,
`@okfit/lsp` and `@okfit/mcp` share `@okfit/plugin`'s `okfit`, `okfit-lsp`
and `okfit-mcp`, with loaders (and their `loader.bats`/`lsp-loader.bats`
pins) falling back to `npx --yes @okfit/mcp` and `@okfit/lsp`;[^okfit-consumer]
and systems, whose `@savvy-web/cli` and `@savvy-web/mcp` share
`@savvy-web/silk`'s `savvy` and `savvy-mcp`, with its loader falling back to
`npx --yes @savvy-web/mcp`.[^systems-consumer] Either may keep shared bins
with `allowSharedBins`, or migrate if its identity must hold under flat
installs. vitest-agent keeps shared bins.

[^owner-ruling]: conversation with the repository owner, 2026-09-25.
[^vitest-agent-findings]: `.claude/dogfood/vitest-agent/2026-09-25-findings-front-end-kit.md`,
    Friction item 5.
[^vitest-agent-loader-status]: `.claude/dogfood/vitest-agent/2026-09-25-status-item15-loader.md`.
[^packed-install-ts]: `packages/workspaces/src/PackedInstall.ts` — the
    `BinConflict` check in `run`, `allowSharedBins`, and
    `InstalledConsumer.runCarrierBin`.
[^carrier-entry-contract]: `plugin/skills/design-patterns/references/carrier-entry-contract.md`
    — "Who declares a bin".
[^okfit-consumer]: [okfit consumer](../consumers/okfit.md) — surveyed
    2026-09-25 from its `packages/*/package.json` and
    `plugins/claude-code/bin/start-{mcp,lsp}.sh`.
[^systems-consumer]: [systems consumer](../consumers/systems.md) — surveyed
    2026-09-25 from its `packages/*/package.json` and
    `plugins/silk/bin/start-mcp.sh`.
[^vitest-agent-optout-status]: `.claude/dogfood/vitest-agent/2026-09-25-status-item15-optout.md`
    — its owner's reasons for keeping the front-end bins.
[^vitest-agent-round2-findings]: `.claude/dogfood/vitest-agent/2026-09-25-findings-round2-front-end-kit.md`,
    Friction items 2 and 3.
[^reframe-ruling]: conversation with the repository owner, 2026-09-25,
    ruling on vitest-agent's round-2 friction items 18 to 20.
[^packed-install-e2e]: `packages/workspaces/__test__/e2e/PackedInstall.e2e.test.ts`
    — the shared-bin case, and the name-order observation behind it.


---
<!-- okf/decisions/contract-inversion-default.md -->
---
type: Decision
title: Contract inversion is the default answer to a tier-dragging edge
description: When package A needs behaviour only package B can implement, A declares the narrow contract and B ships the layer implementing it, rather than A taking a direct dependency edge on B — the pattern now runs three times across the kit.
status: draft
tags:
  - architecture
sources:
  - id: npm-index
    resource: ../../packages/npm/src/index.ts
  - id: commands-local-exec
    resource: ../../packages/commands/src/LocalExec.ts
  - id: sbom-identity-token
    resource: ../../packages/sbom/src/IdentityToken.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 4a5c0ef34e155a7b54dfa9687645912d059b5754a5614ef3baae8356a423247d
---

# Contract inversion is the default answer to a tier-dragging edge

## Context

A package sometimes needs behaviour that only a heavier, later-tiered
package can actually provide — dependency resolution against a real
workspace, a locally installed tool runner, a live OIDC token issuer. The
naive fix is a direct dependency edge from the package that needs the
behaviour to the package that can supply it. That edge tags along the
dependency policy's tier-propagation rule: any package depending on an
integrated-tier package becomes integrated itself, and every dependent of
*that* package inherits the same widening.

## Decision

The kit's standing default is **contract inversion**: the package that
needs the behaviour (`A`) declares a narrow contract describing exactly
what it needs, and the package that can actually implement it (`B`)
ships the layer satisfying that contract. `A` never takes a dependency
edge on `B`; `B` depends on `A` instead, to implement `A`'s interface.
This pattern now runs three times across the kit:

- `@effected/npm` declares the `CatalogResolver` and `WorkspaceResolver`
  contracts;[^npm-index] `@effected/workspaces` ships the layers
  implementing them, because catalog resolution needs
  `pnpm-workspace.yaml` plus the lockfile, and workspace-version
  resolution needs the discovered package list — both things only
  `workspaces` actually has.
- `@effected/commands` declares the `LocalExec` contract;[^commands-local-exec]
  `@effected/workspaces` ships that layer too, for the same reason: only
  `workspaces` knows how to resolve a locally installed tool inside a
  discovered monorepo.
- `@effected/sbom` declares the `IdentityToken` contract;[^sbom-identity-token]
  `@effected/github-actions` ships the layer that implements it against a
  live OIDC token issuer, because only the Actions runtime has a runner
  to ask.

## Alternatives rejected

- **A direct dependency edge from the needing package to the
  implementing package** (`npm` → `workspaces`, `commands` → `workspaces`,
  `sbom` → `github-actions`). Rejected in each case because it would
  propagate the implementing package's tier under the dependency policy's
  R2 rule — `workspaces` is integrated, so a direct edge from `commands`
  would have made `commands` integrated too, and would have dragged a
  pure package (`lockfiles`) and a boundary package (`package-json`)
  integrated behind it through their own edges into `commands`.
- **Merging the contract and the implementation into one package.**
  Rejected because the contract's natural home is beside the package that
  needs it and whose API surface it belongs to — a consumer wanting only
  `npm`'s dependency-resolution vocabulary should not have to take
  `workspaces`' entire discovery-and-graph engine to get it.

## Consequences

Contract inversion keeps the low-tier package's dependency surface
narrow — a pure or boundary package presents a clean interface without
importing the integrated package that eventually satisfies it — at the
cost of an extra indirection a reader has to trace: finding out that
`LocalExec` is actually implemented by `workspaces` means reading
`commands`' own documentation or module layout, not just its
`package.json`. Any future tier-dragging edge in the kit is expected to
resolve the same way: declare the contract at the lower tier, implement
it at the higher one, never invert that.

[^npm-index]: `packages/npm/src/index.ts:17-18,21,106` — `CatalogResolver`
    and `WorkspaceResolver` exported as contracts from `@effected/npm`,
    implemented elsewhere.
[^commands-local-exec]: `packages/commands/src/LocalExec.ts:13` — "the
    `@effected/workspaces` contributes, through `LocalExec`" — the
    contract `commands` declares and `workspaces` implements.
[^sbom-identity-token]: `packages/sbom/src/IdentityToken.ts:13-14` — "…
    implements it (`ActionsIdentityToken.layer`, over its
    `OidcTokenIssuer`), and a consumer already holding a token uses
    `IdentityToken.layerStatic`" — the contract `sbom` declares and
    `github-actions` implements.
