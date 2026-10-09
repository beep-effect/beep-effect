# lockfiles — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/lockfiles/CLAUDE.md -->
# @effected/lockfiles

Pure lockfile parsing for the four package-manager formats — bun (`bun.lock` JSONC), npm (`package-lock.json`), pnpm (`pnpm-lock.yaml`) and yarn Berry (`yarn.lock`) — normalized into one unified `Lockfile` model, plus pure integrity checking of that model against workspace manifests. The `LockfileReader` service (root find, PM detect, file IO, dispatch) lives in the consumer, `@effected/workspaces`, never here.

## Knowledge bundle

Durable knowledge about this package lives in `okf/`, not here. Load the concept a task needs:

- Purpose, tier and peers, the supported input domain (pnpm `lockfileVersion` 9+, npm 3+; the gate is on the *format* version and runs before the shape decode), the model, per-format identity and resolution, importers, hardening, observability, testing and fixture conventions, consumer contract → `okf/modules/lockfiles.md` — Load when: changing the model, the parse pipeline, either seam repair, or adding a fixture.
- Instances and resolution — `instanceId`, `resolved`, `unresolvedEdges`, peer declarations, the pnpm `link:` / publish-directory / `npm:` alias readings → the "Per-format identity and resolution" section of `okf/modules/lockfiles.md`, plus `okf/invariants/lockfiles-npm-bun-never-populate-unresolved-edges.md`, `okf/invariants/lockfiles-positional-walk-is-deepest-first.md`, `okf/limitations/lockfiles-yarn-carries-no-peer-edges.md`, `okf/gotchas/yarn-berry-lockfile-has-no-devdependencies-section.md` — Load when: touching any per-format resolution walk or the fields a consumer's peer check reads.
- Document framing (a pnpm lockfile is a YAML *stream*; the lockfile is the **last** document; `LockfileFramingError`) → `okf/decisions/lockfile-is-a-yaml-stream.md` — Load when: touching `src/internal/documents.ts` or anything that selects a document.
- The env preamble (`PnpmEnvLockfile.packageManager` reads the **first** of two documents into `PackageManagerLock`; `none` for nothing recorded, a typed failure for a recorded version the preamble cannot back) → the "The env preamble: the pinned package manager" section of `okf/modules/lockfiles.md` — Load when: touching `src/PnpmEnvLockfile.ts`, `src/PackageManagerLock.ts` or `src/internal/pnpmEnv.ts`.
- Contract edges (bun tuple shape, importer-name map carries names only, pnpm root importer is not a package row) → `okf/limitations/lockfiles-*.md` — Load when: a consumer asks for something the model does not carry.

## Operating instructions

- `src/index.ts` is the only re-exporting module; read it for the public surface rather than any prose listing. Internals under `src/internal/` import only the leaf model modules, never `Lockfile.ts` (`noImportCycles`), and fail with a raw `ParseFailure = { stage, cause }` that `materializeFailure` (in `Lockfile.ts`) turns into `LockfileParseError` or `LockfileFramingError` — the one mapping both `Lockfile.parse` and `PnpmEnvLockfile.packageManager` use; never map a `ParseFailure` a second way.
- `LockfileParseError.cause` stays `Schema.Defect`; narrow the version-gate case with `isUnsupportedLockfileVersion`, never by parsing prose.
- Malformed input **always** exits typed (`stage: "syntax"` or `"validation"`) — never a defect. Key-bearing intermediates are `Map`/`Set`, records are built with `Object.fromEntries`.
- Fixtures: a directory named `unsupported-*` is input the parser must reject, and the version-gate guard enumerates the fixtures directory to skip exactly those — never re-hard-code the list. A pnpm fixture's `packages.length` is an *instance* count; expect it to move when peer variants are added.

## Testing and building

Tests live in `__test__/`, use `@effect/vitest`, and assert with `assert.*` — never `expect`.

```bash
pnpm vitest run packages/lockfiles          # from the repo root
pnpm build --filter @effected/lockfiles     # from the repo root
```

Never run `node savvy.build.ts --target prod` directly — it skips `build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` shaped exactly like a clean gate. A clean `dist/prod/issues.json` carries **13** `_base` `suppressed` entries; `suppressed: 0` in the *prod* gate means the build did not run. A `suppressed: 13` in the log does not prove it ran either — a turbo cache hit replays the previous output verbatim; check that `dist/prod/issues.json`'s `generatedAt` postdates your last source edit (`okf/gotchas/turbo-cache-hit-replays-clean-log.md`).


---
<!-- okf/modules/lockfiles.md -->
---
type: Module
title: lockfiles
description: Pure lockfile parsing for bun, npm, pnpm and yarn Berry, normalized into one unified model, plus pure integrity checking.
status: stable
kind: package
resource: ../../packages/lockfiles
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T22:15:57Z
  body_sha256: b3ad5d92ef7b2873b5dc71725bdabaa8d8691fd3ee6a9c879d7511514cb61579
---

# lockfiles

## Purpose

`@effected/lockfiles` is lockfile parsing as pure string→model decoding. It holds the four package-manager lockfile parsers — bun's JSONC, npm's JSON, pnpm's YAML and yarn Berry's YAML — the unified `Lockfile` model they all normalize into, and pure integrity checking of that model against workspace manifests. Its consumer is `workspaces`, whose `LockfileReader` service does the root find, package-manager detection and file read, then calls into this package; the `LockfileReader` service itself lives in the consumer, never here.

## Tier and dependency posture

[Pure tier](../glossary/library-tier.md). No services, no layers, no IO, no `R` anywhere — a lockfile parser that reached for the filesystem would be boundary tier, so the IO stays out by construction: every entrypoint takes content as a string, and integrity checking takes manifests as input rather than reading them. Peers are `effect` plus four pure-to-pure `workspace:^` edges — `jsonc` for bun, `yaml` for pnpm and yarn Berry, `semver` for integrity's range satisfaction, and `npm` for the shared specifier, dependency-field and integrity-hash vocabulary — each mirrored by a plain `workspace:*` devDependency, the two specifiers deliberately differing so a published patch floats. Zero external runtime dependencies: the text-parsing engines arrive through the sibling packages, so unlike `glob` and `toml` there is nothing to vendor here.

## The supported input domain

The package parses **pnpm `lockfileVersion` 9+ and npm `lockfileVersion` 3+**; an older format fails typed. This is a deliberate narrowing of the supported input domain, recorded as contract rather than implementation detail: a consumer parsing some other repository's older lockfile receives a typed failure by design, not by accident. Pre-v9 pnpm and pre-v3 npm record resolution in shapes this model does not describe, and parsing them would hand a consumer rows that silently cannot answer a resolution question. The gate is on the lockfile *format* version, and the docs say so — a lockfile records no package-manager version, and the mapping is many-to-one (pnpm 9, 10 and 11 all write format `9.0`), so a "requires pnpm 11+" claim is unenforceable and unstated; the manager versions the suite is tested against are listed separately. The gate reads the version and nothing else, never whether `snapshots:` exists or has entries — a dependency-free v9 workspace legitimately records zero snapshots, and an emptiness guard would reject that valid lockfile; both directions are mutation-checked. The gate runs **before** the shape decode, so the oldest formats report as too old rather than as malformed. bun and yarn are ungated, recording no comparable format-version line.

## The model

`Lockfile` is a `Schema.Class` carrying the format, the lockfile version, the resolved packages, the workspace dependency edges, the importers and an optional per-format extension. The package has **three fallible boundaries**: `Lockfile.parse`, and `PnpmEnvLockfile.packageManager` and `.configDependencies` (see [the env preamble](#the-env-preamble-the-pinned-package-manager)). All three map the internal failure record through one shared function, so they cannot disagree about which failure is `LockfileParseError` and which is `LockfileFramingError`. Everything else is total: the importer-name rewrite, name/importer/instance-id lookup (all backed by lazily built private indexes outside the schema), the workspace-packages getter, and integrity comparison.

`packageByInstanceId` is the index edge-walking consumers were rebuilding: `ResolvedPackage.instanceId` is what a resolved edge points at, so peer and dependency resolution is a lookup, not a scan. It mirrors `importer` exactly and deliberately — lazily built so a consumer that never walks edges pays nothing, `Map`-backed so an id colliding with an `Object` member name (`__proto__`, `constructor`) neither pollutes nor false-matches, and first-wins on a duplicate id so a malformed lockfile gets a stable answer rather than one depending on iteration order.

**A row is an instance, not a package.** `ResolvedPackage` rows are package *instances* in every format — one row per lockfile key for npm and bun, one row per *snapshot* for pnpm rather than per declaration — so one format-agnostic resolution algorithm can serve all four downstream. `instanceId` is the format's own canonical identity, verbatim and opaque (pnpm's snapshot key, npm's full entry key, bun's `packages` key, yarn's locator) — no scheme is synthesized. `resolved` maps a dependency (and, where the format records it, peer) name to the `instanceId` that name resolved to in this instance's context.

**Every edge in `resolved` is verified against the lockfile's own id set before it is emitted**, and an edge that cannot be named honestly is omitted rather than guessed. `unresolvedEdges` names dependencies whose edge the lockfile records but the model could not name — distinct from genuine absence. A consumer reading an absent `resolved` key as "nothing is there" instead of "recorded but unnameable" converts this package's honest gap into its own false positive — `workspaces`' peer check is the worked case, where an unnameable but satisfied `link:` peer would otherwise read as an unsatisfied peer, and its `"unresolvedEdge"` fail-closed reason is this field read one layer up. Only pnpm and yarn ever fill it: [npm and bun rows never populate `unresolvedEdges`](../invariants/lockfiles-npm-bun-never-populate-unresolved-edges.md), because their sections are declarations resolved positionally and "the walk found nothing" there is genuine absence.

Per-format identity and resolution:

- **pnpm** emits one row per `snapshots:` entry, joining peer declarations from the per-version `packages:` entry, so peer variants become distinct rows (a fixture's `packages.length` is an instance count and moves when variants are added). A `packages:` entry no snapshot covers is emitted as an orphan carrying no resolution rather than dropped — an unexplained disappearance is the worse failure. Registry versions resolve by composing `name@version` against the id set; a failed composition gets one second reading, the recorded version itself as an instance id, which is how pnpm spells an `npm:` alias (`typescript-classic: typescript@6.0.3`) — still compose-then-verify, since a plain version can never be an id. `link:` targets compose to nothing, and pnpm spells a linked edge two ways (a readable `link:<path>` in the body, a mangled `name@packages+dir` inside peer suffixes), so they resolve by path normalization instead: snapshot targets are root-relative, importer targets importer-relative, and either matches a workspace importer's id. A target that is no importer gets two further chances. The publish-directory map — an importer that declares `publishDirectory` has said exactly which build directory its links point at — is consulted on both paths, being exact evidence. Then, on importer edges only and only under a `workspace:` specifier, the longest ancestor importer path is taken, because `publishConfig.linkDirectory` records the link against the package's publish directory; the specifier is what makes that a resolution rather than a guess (a hand-written `link:` may be a vendored stub with its own identity, and stays unnameable), the root importer is excluded as an ancestor of everything, and snapshot edges carry no specifier so get no walk.
- **npm** and **bun** resolve positionally by replaying the walk their key scheme encodes, [deepest-first](../invariants/lockfiles-positional-walk-is-deepest-first.md); reversing the order returns the hoisted copy for every shadowed dependency.
- **yarn** identifies by locator and resolves dependency edges through the lockfile's own descriptor→locator index, so the lookup is exact rather than reconstructed. Peer edges are deliberately absent — [yarn carries no resolved peer edges](../limitations/lockfiles-yarn-carries-no-peer-edges.md) — and there is no dev section to iterate because [a Berry lockfile has no `devDependencies` section](../gotchas/yarn-berry-lockfile-has-no-devdependencies-section.md).

Every format records peer declarations, held as `peerDependencies` (name→range) and `peerDependenciesMeta` (name→`{ optional: boolean }`), both defaulting to `{}` at construction and on decode — an absent section is an empty record, never `undefined`. These fields hold declarations only, distinct from `resolved`'s per-instance verified answer. bun's `optionalPeers` *array* of names is normalized into the meta shape. pnpm records no peer declarations for workspace projects at all (probed against pnpm 11.22.0, with and without `autoInstallPeers`); yarn's peer data is populated even though the downstream peer check does not consume it, since populating it is nearly free and a normalized model that silently drops one format's data is a trap for the next consumer.

Three surface shapes are deliberate rather than incidental. `LockfileParseError.cause` stays `Schema.Defect`: it carries whatever the delegated engines throw, so widening it to a union would misrepresent an open channel as an exhaustive one; the version-gate failure is instead exposed as the `UnsupportedLockfileVersion` type plus the `isUnsupportedLockfileVersion` predicate, which reads `_tag` as an **own** property so a foreign throwable inheriting one is never reported as "your lockfile is too old". The integrity check is `LockfileIntegrity.compare`, not `.check`, because every v4 `Schema.Class` already carries a `static check(...checks)`. `filenamesFor(format)` lists every filename a format is genuinely written under, primary first (npm adds `npm-shrinkwrap.json`, bun the binary `bun.lockb`) — detection vocabulary, not parse routing: `bun.lockb` is not a parse target, `fromFilename` answers for the primary names only, and workspace-config extras (`pnpm-workspace.yaml`, `.pnpmfile.cjs`, yarn PnP files) are a consumer's cache policy and stay out.

## Document framing: a lockfile is a YAML stream

A lockfile is not always one YAML document — see [a lockfile is a YAML stream](../decisions/lockfile-is-a-yaml-stream.md) for the framing rule, why it is deterministic rather than heuristic, and the per-format behavior it produces.

One internal splitter, `splitPnpmStream`, decides pnpm framing for both `Lockfile.parse` and `PnpmEnvLockfile`, so the two cannot drift: at most two documents (more fail `unexpectedDocuments` through either reader), preamble first, lockfile last. An empty main document after a preamble is **ambiguous**, so by default it fails `noLockfileDocument`. pnpm 11 and 12 write that shape for a workspace with no root `package.json` and only `configDependencies` (effected#845, fixtures `pnpm/env-configonly-pnpm11` and `-pnpm12`), and pnpm 12.7.0 writes the same bytes when a workspace *with* a root `package.json` fails its first install after its config dependencies are in (fixture `pnpm/unsupported-interrupted-pnpm12`, byte-identical to the config-only capture). Only the caller can tell them apart, so `Lockfile.parse` takes a `configOnly` option: the caller's assertion that the root has no `package.json`. With it, the stream reads as an empty lockfile (no packages, importers or workspace edges) with `lockfileVersion` taken from the preamble after the preamble passes the version gate. The flag loosens nothing else: an empty main document with no preamble, a stream of more than two documents, and a non-empty main document with no importers all fail as they do without it, and non-pnpm formats ignore it. `@effected/workspaces`' `LockfileReader` passes it only when the root `package.json` is absent.

## The env preamble: the pinned package manager

`PnpmEnvLockfile.packageManager(content)` reads the **first** document of a pnpm stream, the env preamble `Lockfile.parse` skips. pnpm 11 and 12 both write it when a workspace declares `devEngines.packageManager` or `configDependencies`. It is the same position rule read from the other end, and it too takes text and performs no IO. It answers `Effect<Option<PackageManagerLock>, LockfileParseError | LockfileFramingError>`. Its sibling `PnpmEnvLockfile.configDependencies(content)` reads the same preamble's root-importer `configDependencies` into a `ReadonlyMap` of `ConfigDependencyLock` (`name`, `specifier`, `version`, SRI `integrity`), empty when none are recorded. It fails on the same terms: a recorded entry with no `packages` entry, integrity or SRI form, or an empty version, fails at `validation`. `@effected/workspaces` reads it to verify a config dependency it fetches (effected#842).

`PackageManagerLock` carries `name` (always `"pnpm"`), the declared `specifier` verbatim (it may keep a `+sha512.<hex>` tail), the resolved `version`, the SRI `integrity` of `pnpm@<version>`, and `nativeIntegrity`: SRI per native package keyed by bare name (`"@pnpm/exe.linux-x64"`). The natives come from the lockfile's own graph, the `optionalDependencies` of the `snapshots["pnpm@<version>"]` entry, never from a name pattern. pnpm 12 records one `@pnpm/exe.<target>` there per platform. pnpm 11 records none, so its record is empty: pnpm 11 hangs its platform binaries off a separate `@pnpm/exe` entry, which this model does not carry.

The contract splits "nothing recorded" from "recorded but unbacked":

- **`Option.none()`** means the lockfile records no package manager. That is a single-document stream, an empty first document, or a preamble whose root importer (`.`) declares no `pnpm` in `packageManagerDependencies`.
- **`LockfileParseError` at `stage: "validation"`** covers a claim the preamble cannot back: an empty recorded version, no `packages["pnpm@<version>"]` entry, no snapshot, or a missing or non-SRI integrity for pnpm or any native it lists. A lockfile that names a version it cannot account for is a failure, never `none`. A preamble failing the format-version gate fails the same way `Lockfile.parse` does.
- **`LockfileFramingError` with `reason: "unexpectedDocuments"`** covers a stream of more than two documents. No position identifies the preamble there, and this selection feeds integrity verification, so a guess would be a trust decision.

The decoded records are read with own-property semantics, so a key such as `__proto__` or `constructor` is never answered by `Object.prototype`. Its consumer is `@effected/github-actions`' `PackageManagerInstaller`, whose `integrity` and `nativeIntegrity` options take these values (see [actions-storage](../interfaces/actions-storage.md#tool-and-package-manager-installation)).

## Importers

The importers field records each workspace importer's *declared* dependencies — the data a before/after lockfile diff needs, which is what `silk-update-action` parses two texts through this pure boundary to compare. `ImporterDependency` holds one declared dependency: its specifier is `npm`'s branded specifier via that package's string codec, so a decoded value is tag-matchable while encoding round-trips the exact original string; its version is **pnpm-only**, since pnpm records a specifier-and-version pair per importer dependency while bun and npm record resolved versions on package entries, so consumers there join by name against the packages array. That version is always the plain version — pnpm's peer-disambiguation context splits off into a separate optional `peerSuffix` field holding the raw parenthesized chain, with one shared implementation for the split so the pnpm package-key parser and the importer-dependency parser cannot disagree about where a version ends. The split is pnpm's own rule (`@pnpm/dependency-path`'s `indexOfDepPathSuffix`): the suffix is the maximal trailing run of balanced parenthesized groups, so nested chains split whole and a parenthesis followed by more path stays in the path. It applies to protocol resolutions too, because pnpm suffixes a `file:` directory or tarball exactly like a registry version whenever the package declares peers (`lib@file:vendor/lib(react@18.3.1)`, measured against pnpm 12.6.0, fixture `pnpm/filepeer`). `link:` is the one exception, since pnpm never suffixes it. A path that ENDS in a group is ambiguous, and it is read as pnpm reads it: pnpm keys `file:vendor/paren(lib)`'s `packages:` entry `parenlib@file:vendor/paren`, so taking the group as suffix is what keeps the snapshot joined to its metadata. The name then splits from the version at the first `@` after a scoped name's own, never the last, because a version part may hold one (`file:../@scope/lib`). `LockfileImporter` holds the root-relative importer path plus the dependencies. pnpm, bun and npm populate importers off a shared dependency-sections table; yarn always yields an empty array, since yarn records no importers; and the importer-name rewrite deliberately does not touch importers, since they stay keyed by path, the join key.

## Hardening

This package's position is unusually good: it adds no new text-parsing engine and no new recursion surface, since text parsing is delegated to already-hardened sibling packages, with npm's native parse wrapped so its throw on hostile input lands in the typed channel. The transforms that remain are single-pass iterations over flat records, and they still owe: prototype-pollution discipline (key-bearing intermediates stay `Map`s and `Set`s, records are built with own-property semantics rather than manual assignment); total string surgery (the `name@version` splitters and yarn's descriptor extractors are total — malformed keys are skipped, never thrown on); and scope honesty (yarn support is Berry only — classic v1 content must exit through the typed parse error and never mis-normalize).

## Observability

Pure-tier house rule: a named `Effect.fn` span on each public fallible boundary (`Lockfile.parse`, `PnpmEnvLockfile.packageManager`, `PnpmEnvLockfile.configDependencies`) and nothing else. The total methods are span-free. Operational logging belongs to the consumer's reader, which owns the IO story. No metrics, telemetry-agnostic.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`. No platform packages, no mock layers, no `TestClock`. Four families: per-format fixture tests across each manager's lockfile versions, asserted against the unified model (package identification, integrity, workspace dependency edges, extension payloads); seam-property tests (the importer-name rewrite renames pnpm workspace packages and rewrites both edge ends while leaving unmapped entries, non-pnpm lockfiles and importers untouched; integrity comparison covers valid, missing, extra, unsatisfied and skipped cases, fed by in-memory manifests, so there is no IO anywhere in the suite); a hostility suite (malformed text and wrong shape each landing on their own stage, yarn classic content, dunder and hostile `name@version` keys, nesting bombs); and codec round-trips via `it.effect.prop` over derived arbitraries, asserting encode-decode identity.

Fixture naming carries two load-bearing conventions. A directory named `unsupported-*` holds input the parser must reject, and that prefix is the exclusion mechanism: the version-gate guard ("every non-negative fixture sits at or above its format's gate") enumerates the fixtures directory and skips exactly those, so a new fixture is covered automatically and a negative one cannot silently opt a positive one out — never re-hard-code that list. A pnpm directory named `env-configonly-*` is the second marker: the guard parses exactly those with `configOnly`, since their caller would assert it, and no other fixture with the flag. The npm `v*` directories denote fixture *sets*, not lockfile versions: `npm/v1` and `npm/v2` are both `lockfileVersion: 3`, which is why the negative fixtures carry the prefix and their own version (`npm/unsupported-v1`). Fixtures are real manager output (pnpm 11.22.0, npm 11.19.0, bun 1.3.14, yarn 4.9.1; the `pnpm/env-*` preamble fixtures pnpm 11.27.1 and 12.6.0, `pnpm/env-configonly-*` pnpm 11.28.0 and 12.7.0, `pnpm/unsupported-interrupted-pnpm12` pnpm 12.7.0) except four hand-authored for a reason no install can produce: `pnpm/emptysnapshots` (a dependency-free v9 document), `pnpm/multidoc` (its preamble integrity is a deliberate placeholder the main-document parse must never read), `npm/unsupported-v2` (the point is the version field, not the tree) and `npm/ancestor-walk` (npm's hoisting avoids the intermediate-ancestor shape it encodes).

## Build

Scaffolded from a pure sibling, model paths under `website/lib/models/lockfiles`. The model and error classes are class factories, so `savvy.build.ts` carries the narrow `_base` API Extractor suppression; a clean prod gate reports 12 suppressed `_base` entries, `PackageManagerLock_base` being the newest. Because it has workspace peers, the package needs a `prepare` script so turbo's upstream-build ordering applies.

## Consumer contract

`workspaces`' `LockfileReader` finds the root, detects the package manager, reads the file (its read error stays there), and calls `Lockfile.parse` directly, because document framing is this package's job, not the reader's. For pnpm it then reads the workspace manifests and applies the importer-name rewrite; integrity is manifest IO plus the comparison; resolved-version lookup is the name index. `workspaces` defines its **own** package-manager literal rather than aliasing this package's format literal — the two are structurally identical and assign freely, but they are different concepts (which manager drives this workspace, versus which lockfile grammar to parse), and a separate name avoids colliding with `package-json`'s package-manager class in a consumer's imports.


---
<!-- okf/invariants/lockfiles-npm-bun-never-populate-unresolved-edges.md -->
---
type: Invariant
title: npm and bun rows never populate unresolvedEdges
description: "In @effected/lockfiles a declaration the positional walk does not find on an npm or bun row is genuine absence and stays out of unresolvedEdges; only pnpm and yarn, whose lockfiles record an edge the model may fail to name, ever fill the field."
status: stable
resource: ../../packages/lockfiles/__test__/Lockfile.test.ts
tags:
  - testing
sources:
  - id: npm-resolve-edges
    resource: ../../packages/lockfiles/src/internal/npm.ts
  - id: exemption-test
    resource: ../../packages/lockfiles/__test__/Lockfile.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 4e471246dd991c95a7d7a4a775c1ff2b678bc472b82549790d42d4f072be312e
---

# npm and bun rows never populate unresolvedEdges

## The property

A `ResolvedPackage` parsed from `package-lock.json` or `bun.lock` always
carries `unresolvedEdges: []`. When the positional walk finds no key for a
declared name, the name is simply absent from `resolved` — it is never
reported as an edge the model could not name. pnpm and yarn rows are the
only ones that ever populate the field.

## Why it must hold

`unresolvedEdges` exists to separate "the lockfile records an edge this
model could not name" from "nothing is there", because
[`workspaces`' peer check](../modules/lockfiles.md) reads the field
one layer up as its fail-closed `"unresolvedEdge"` reason. That split only
carries information where the lockfile *does* record edges: pnpm's
snapshot bodies and yarn's descriptors name a target for every edge, so a
name that fails to compose is a real gap. npm and bun sections are
declarations — `name → range` — resolved positionally against the key
space, so "the walk found nothing" means "nothing installed", the
ordinary state of every unmet optional peer.[^npm-resolve-edges]

The exemption was measured before it was pinned. Across every npm and bun
fixture, each declared name the walk misses is a `peerDependencies` entry
nothing installed (an unmet optional peer of `vite`, `vitest` or
`react-redux`); not one sits in `dependencies`, `devDependencies` or
`optionalDependencies`. Reporting those as the pnpm/yarn resolvers would
was tried as a mutant: it raises `unresolvedEdges` on ordinary lockfiles
and turns the downstream peer check to `unverified: ["unresolvedEdge"]`
for a workspace with nothing wrong with it. A fail-closed signal that is
always on is one nobody reads.

## The mechanism

`resolveNpmEdges` and its bun twin return only `resolved`; they have no
unnameable set to fill, so the row's `unresolvedEdges` takes its `[]`
default.[^npm-resolve-edges]

The test "npm and bun: a declaration nothing installed is ABSENCE, not an
unresolved edge" walks `npm/peers`, `npm/v2`, `bun/peers` and `bun/v2`
asserting every row's `unresolvedEdges` is empty, proves non-vacuity by
checking `react-redux` declares a `redux` peer that resolves to nothing,
and then parses the pnpm `unnameablelink` fixture as the positive control
that the field is reachable at all.[^exemption-test]

## What would break it

Giving the npm or bun resolver an unnameable set, or dropping the control
half of the test so the assertions could pass on a field nothing ever
writes. A refactor that unifies the four resolvers must keep the npm and
bun paths declaration-only.

[^npm-resolve-edges]: `packages/lockfiles/src/internal/npm.ts` —
    `resolveNpmEdges`, whose doc comment states that an edge npm did not
    record is omitted rather than invented; `src/internal/bun.ts` mirrors
    it.
[^exemption-test]: `packages/lockfiles/__test__/Lockfile.test.ts` — "npm
    and bun: a declaration nothing installed is ABSENCE, not an unresolved
    edge", with the `pnpm/unnameablelink` positive control.


---
<!-- okf/invariants/lockfiles-positional-walk-is-deepest-first.md -->
---
type: Invariant
title: The npm and bun resolution walk is deepest-first
description: "@effected/lockfiles replays node resolution over the npm and bun key space from the depending package's own position outward to the root; an outermost-first order would return the hoisted copy and silently mis-report every shadowed dependency."
status: stable
resource: ../../packages/lockfiles/__test__/Lockfile.test.ts
tags:
  - testing
sources:
  - id: npm-walk
    resource: ../../packages/lockfiles/src/internal/npm.ts
  - id: bun-walk
    resource: ../../packages/lockfiles/src/internal/bun.ts
  - id: shadow-tests
    resource: ../../packages/lockfiles/__test__/Lockfile.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 317606648df48a488b3eacf2d84a139ed33ac7fd093e53f46f730dd58d32c50a
---

# The npm and bun resolution walk is deepest-first

## The property

For a `package-lock.json` or `bun.lock` row, each declared dependency name
resolves to the **nearest** instance in the key space: the depending
package's own nested `node_modules` (npm) or `<parent-key>/<name>` (bun)
first, then each ancestor position, and the hoisted root last. A shadowed
copy always wins over the hoisted one, and a resolved edge only ever names
a key that exists in the lockfile.

## Why it must hold

Both formats encode install position in the key rather than recording an
explicit edge, so the walk *is* the resolution algorithm. Reversed, it
would return the hoisted copy for every shadowed dependency — `debug`
resolving to the root `ms@2.1.3` instead of its own `ms@2.0.0` — and the
error would be silent, because the hoisted copy is a real instance with a
plausible version. A consumer comparing peers or versions against such
rows would be told the wrong package satisfied the edge.

## The mechanism

`resolveNpmEdges` builds the prefix list from the entry's own directory
outward, stripping one path segment at a time to the root, and takes the
first hit.[^npm-walk] `resolveBunEdges` cannot split on `/` because scoped
names carry one, so it collects those prefixes of the key that are
themselves keys, sorts them longest-first and appends the root.[^bun-walk]

Three fixtures pin the order, each with a hoisted-versus-nested pair that
an outermost-first walk would answer wrongly: `npm/nested` (`ms` under
`debug`, plus a workspace-local `react@18` shadowing a hoisted `17`),
`bun/nested` (the same `ms` shadow), and the hand-authored
`npm/ancestor-walk`, whose intermediate-ancestor shape npm's own hoisting
avoids producing — a package at depth two resolving a name that lives at
depth one *and* at the root — so it cannot be regenerated on
demand.[^shadow-tests]

## What would break it

Iterating the prefix list root-first, computing bun's parent chain by
splitting on `/`, or replacing `npm/ancestor-walk` with generated output
(which would lose the only fixture that discriminates self-then-root from
a true ancestor walk).

[^npm-walk]: `packages/lockfiles/src/internal/npm.ts` — `resolveNpmEdges`,
    whose doc comment names deepest-first as "the whole algorithm".
[^bun-walk]: `packages/lockfiles/src/internal/bun.ts` — `resolveBunEdges`,
    prefixes read off the key space and sorted longest-first.
[^shadow-tests]: `packages/lockfiles/__test__/Lockfile.test.ts` —
    "resolves deepest-first, so a shadowed copy wins over the hoisted
    one", "resolves through an intermediate ancestor, not just
    self-then-root" and the bun "resolves deepest-first over the key
    space".


---
<!-- okf/limitations/lockfiles-yarn-carries-no-peer-edges.md -->
---
type: Limitation
title: Yarn carries no resolved peer edges
description: The yarn Berry parser records dependency edges only; peer-dependency resolution is never populated because yarn resolves peers virtually.
status: stable
bounds: ../modules/lockfiles.md
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: ffabc534129c2b4a2d126bb238e9184689e316dc5973301f782bbda80d4a50d1
---

# Yarn carries no resolved peer edges

## Condition

A consumer parses a `yarn.lock` (Berry) file and looks for resolved peer-dependency edges on a `ResolvedPackage` row the way pnpm or npm rows might carry them.

## Symptom

Yarn's `resolved` field is populated for dependency edges only; there is never a resolved peer entry for a yarn-parsed package, even when the package genuinely declares and satisfies peer dependencies in the real install.

## Why this is acceptable

This is a documented gap, not an approximation the model got wrong: yarn resolves peer dependencies **virtually**, meaning the same declared package can be satisfied by different virtual instances in different parts of the dependency graph, and `yarn.lock` itself does not record which virtual instance satisfied which peer at any given position. There is no data in the lockfile text for this package to read and normalize — the information yarn's own lockfile format would need to record simply is not present, so populating this field for yarn would mean inventing an answer yarn itself does not have.

## What the fix would take

There is no fix available at the lockfile-parsing layer, since the missing information is not recoverable from `yarn.lock` content alone. A consumer needing yarn peer-resolution data would need to derive it from a live yarn install (for instance, via yarn's own introspection commands) rather than from static lockfile parsing, which is a fundamentally different data source than what this package works from.


---
<!-- okf/gotchas/yarn-berry-lockfile-has-no-devdependencies-section.md -->
---
type: Gotcha
title: A yarn Berry lockfile has no devDependencies section
description: "The yarn resolver in @effected/lockfiles iterates only dependencies and optionalDependencies, which looks like dropped dev edges; yarn folds a workspace's dev declarations into the entry's dependencies map, so the edges are already resolved and iterating devDependencies is dead code."
status: stable
resource: ../../packages/lockfiles/src/internal/yarn.ts
stale_after: 2027-03-21T00:00:00Z
tags:
  - dx
  - compat
sources:
  - id: yarn-resolver
    resource: ../../packages/lockfiles/src/internal/yarn.ts
  - id: devdeps-test
    resource: ../../packages/lockfiles/__test__/Lockfile.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: d270cf0dc6bd08115dd5c529c75242fe7abc70cb8925e070b211cd9c075c544b
---

# A yarn Berry lockfile has no devDependencies section

## What you see

`resolveYarnEdges` walks `entry.dependencies` and
`entry.optionalDependencies` and never touches `entry.devDependencies`,
even though the raw yarn entry schema declares that field and the other
three formats' resolvers iterate a dev section.[^yarn-resolver]

## What you will conclude

That a workspace's dev edges are silently dropped for yarn, and that
adding `entry.devDependencies` to the loop is a one-line fix.

## What is actually true

A Berry lockfile records no `devDependencies` section. yarn folds a
workspace's dev declarations into the entry's single `dependencies:` map,
and the file it writes is byte-identical whether a dependency was declared
under `dependencies` or `devDependencies` in `package.json` (probed against
yarn 4.9.1). Dev edges are therefore already resolved by the existing
loop; iterating `entry.devDependencies` changes no test in this package or
in `workspaces`. The schema keeps the field only as permissive scaffolding
for hand-edited input.

The `yarn/devdeps` fixture pins this: `typescript` is declared only in
`devDependencies` and `chalk` only in `dependencies`, and both resolve on
the root and `lib` workspace rows. The pair is what makes the test
discriminating — a resolver that visited only some declared section would
show one edge and not the other.[^devdeps-test]

This is separate from the peer gap: yarn *does* omit resolved peer edges,
for the reason in
[yarn carries no resolved peer edges](../limitations/lockfiles-yarn-carries-no-peer-edges.md).

[^yarn-resolver]: `packages/lockfiles/src/internal/yarn.ts` —
    `resolveYarnEdges` and its doc comment on the missing section.
[^devdeps-test]: `packages/lockfiles/__test__/Lockfile.test.ts` — "resolves
    a workspace's DEV edges — yarn records them as dependencies", over
    `__test__/fixtures/yarn/devdeps`.


---
<!-- okf/decisions/lockfile-is-a-yaml-stream.md -->
---
type: Decision
title: A lockfile is a YAML stream, not always one document
description: pnpm lockfiles using config dependencies are two YAML documents in one file, and lockfiles is parsed against that fact by position rather than by content heuristic.
status: draft
tags:
  - architecture
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T22:15:57Z
  body_sha256: 79dc6db6e2824ae1274076bfc3343ff3c7596dccfebce61bff9371e039234ff1
---

# A lockfile is a YAML stream, not always one document

## Context

pnpm 11 and 12 write `pnpm-lock.yaml` as **two YAML documents** in one file when the workspace declares `configDependencies` or `devEngines.packageManager`: an "env" preamble, followed by the actual lockfile document. This repository's own lockfile is that shape. Both documents declare the same top-level keys (`lockfileVersion`, `importers`, `packages`), so a naive single-document parse **succeeds** on the preamble alone — it returns a valid-looking `Lockfile` with one package and no workspace importers, silently reporting an apparently empty workspace instead of failing or reading the real document.

## Decision

`@effected/lockfiles` treats a pnpm lockfile as a **YAML stream** and selects the correct document by **position**: the lockfile is always the **last** document in the stream, because pnpm's own writer composes the file as env-prefix followed by the main document (`writeEnvLockfile` emits `${env}---${main}`, and `extractMainDocument` reads back everything after the first separator) — so the preamble is always a prefix, never a suffix. pnpm writes at most two documents, so the stream holds one or two; a stream of more than two is not one pnpm wrote and fails typed rather than being read by guess. `src/internal/documents.ts` owns this selection through one splitter that both `Lockfile.parse` and `PnpmEnvLockfile` project from, so the two readers cannot drift apart on the document-count rule.

## Alternatives rejected

**A structural or content-based heuristic** — for instance, "the document with a populated `importers` map wins" — was rejected. Both documents in a config-dependencies lockfile carry the same keys, so a structural rule would pick the preamble just as happily as the real document in the cases that matter; the two documents are not distinguishable by content in general, since a legitimately empty workspace's real document can look exactly like the preamble. Position, driven directly by the writer's own contract, is the only sound discriminator available.

**Treating the framing rule as universal across formats** was also rejected. yarn shares YAML as its underlying syntax but defines no document-framing convention of its own, so a multi-document `yarn.lock` fails typed rather than being silently truncated to a guessed document — where a format states no rule, the package refuses to guess rather than inventing one. npm and bun were checked, not assumed, to confirm they never share this hazard at all: a second top-level value is a syntax error in both of their underlying formats (JSON and JSONC respectively), so there is no multi-document case to frame for either.

## Consequences

An unlocatable lockfile document now fails typed through `LockfileFramingError`, carrying the format, the document count and a reason (`noLockfileDocument`, `noImporters`, or `unexpectedDocuments`) — and never a `cause`, since the text parsed fine and there is no foreign throwable to wrap. The invariant this buys: **an unlocatable lockfile fails typed; it can never return an empty `Lockfile`.** One stream pnpm really writes cannot be settled by position alone: a preamble followed by an **empty** main document. pnpm 11 and 12 write it for a workspace with config dependencies and no root `package.json`, and pnpm 12 writes the same bytes when a workspace *with* a root `package.json` fails its first install after its config dependencies are in. The bytes are ambiguous, so the parser does not decide. By default the stream fails `noLockfileDocument`, and the invariant holds. Only on the caller's `configOnly` assertion (the root has no `package.json`, which a caller doing IO can check and the pure parser cannot) does it read as a lockfile with no importers or packages, its `lockfileVersion` taken from the preamble after the same version gate. The assertion loosens nothing else: an empty main document with no preamble in front of it fails with `noLockfileDocument` either way. Before this rule, the silent single-document parse of a config-dependencies lockfile was the most dangerous kind of wrong answer, because it was indistinguishable from a legitimately empty workspace — a parser that succeeds on the wrong input is worse than one that fails outright, and this decision closes exactly that gap for the one format where it was possible.

The same position rule, read from the other end, locates the preamble: `PnpmEnvLockfile.packageManager` takes the **first** of exactly two documents, treats a single-document stream as having no preamble, and fails a stream of more than two with `unexpectedDocuments` rather than guessing (as `Lockfile.parse` now does too), because that selection feeds integrity verification (see [lockfiles](../modules/lockfiles.md#the-env-preamble-the-pinned-package-manager)).


---
<!-- okf/gotchas/turbo-cache-hit-replays-clean-log.md -->
---
type: Gotcha
title: A turbo cache hit reads exactly like a fresh build in the log
description: "FULL TURBO and a clean issues.json summary print identically whether the build ran or a stale cached artifact was replayed; only `dist/<target>/issues.json`'s generatedAt distinguishes them."
status: stable
resource: ../../turbo.json
stale_after: 2027-03-13T00:00:00Z
tags:
  - dx
  - ci
generated:
  by: "okfit/claude-code"
  at: 2026-09-14T02:44:47Z
  body_sha256: 1006743e20584b40465fbb23ce57d4f7e03fd6c388bacb6fc0c82dbee819fbac
---

# A turbo cache hit reads exactly like a fresh build in the log

## What a reader sees

`pnpm build --filter <pkg>` prints `FULL TURBO`, the same emitted-file
count, and the same `suppressed:` figure a genuinely clean gate prints. The
log gives no visual signal distinguishing "turbo re-ran the build" from
"turbo replayed a cached artifact from before your last edit."[^turbo-json]

## What they wrongly conclude

That a clean, `FULL TURBO`-tagged build log is proof the current source
was actually compiled and gated — in particular, that an edit just made to
`src/` is reflected in `dist/<target>/` and its `issues.json`.

## What is actually true

A turbo cache hit replays the previous run's output verbatim, including
its `issues.json`. If the cache key still matches — for instance because
turbo's hash inputs missed an edit, or because the edit was made after the
cache was populated but before turbo's watch saw it — the log for a stale
artifact is indistinguishable from the log for a fresh one. The only
reliable tell is the timestamp inside the artifact itself:

```bash
node -pe "require('./dist/prod/issues.json').generatedAt"
```

`generatedAt` must postdate the last source edit under test. A replay
against genuinely unchanged inputs is legitimate, and its artifacts remain
current; a `generatedAt` predating the edit under test means the log is
reporting someone else's gate, not this one.

## The check

Before trusting a build's `issues.json` (or any gate downstream of it, such
as a suppressed-warning count), compare `generatedAt` against the mtime of
the source files the change touched. Treat a `generatedAt` that does not
postdate the edit as "this gate has not run yet," not as "the build is
clean."

[^turbo-json]: `turbo.json` — `build:prod`'s task declares `"cache": true`
    with `dist/prod/**` as its only output, so a cache hit replays that
    whole directory, `issues.json` included, without re-running the task.
