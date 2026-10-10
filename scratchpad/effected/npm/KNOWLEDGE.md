# npm — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/npm/CLAUDE.md -->
# @effected/npm

Effect contracts for resolving pnpm `catalog:` and `workspace:` specifiers, the
kit's shared dependency vocabulary, and the registry, tarball and publish
services over them. **Boundary tier**, deliberately — never let "pure" creep
back in, and never accept an integrated npm.

## Knowledge bundle

Everything durable about this package lives in `okf/`, not here. Start at
`okf/index.md`, then load what the task needs:

- Package design (purpose, tier posture, module layout, every surface and the
  reasoning behind its shape, consumers and implementers, testing, build) →
  `okf/modules/npm.md` — Load when: changing a contract shape, `Manifest`, a
  vocabulary module, or any of `NpmRegistry`, `PackageTarball`,
  `RegistryCredential`, `PackagePublish`, `NpmExecutor`, `RegistryKind`.
- The tier guardrail (pure vocabulary never reaches IO; `index.ts` exports
  individually; the escalation answer is a split, never a retier) →
  `okf/decisions/npm-tier-guardrail.md`,
  `okf/conventions/dependency-policy.md` — Load when: adding any dependency
  or import to a service or vocabulary module, or touching
  `__test__/reachability.test.ts` (do not weaken it).
- Why the contracts live here, not beside their implementer →
  `okf/decisions/contract-inversion-default.md`; why `CatalogAssemblyError`
  is not in a shared errors package →
  `okf/decisions/no-shared-errors-package.md`.
- `CorepackIntegrityHash` is shared by identity, and only a runtime identity
  assertion can see a re-fork →
  `okf/invariants/corepack-integrity-hash-shared-by-identity.md` — Load
  when: touching `IntegrityHash.ts`, `PackageManagerPin.integrity`, or the
  matching `@effected/package-json` field. Its SRI sibling,
  `SriIntegrityHash`, is consumed the same way by `@effected/workspaces`'
  `ConfigDependencySpec` → the vocabulary section of `okf/modules/npm.md`.
- Traps → `okf/gotchas/npm-renamed-field-silent-spread-drop.md`
  (`RegistryTarget.token` is a `never` tripwire — never alias or delete it
  early), `okf/gotchas/npm-12-pack-json-is-keyed-by-name.md` (`pack --json`
  is an array on npm 11 and a name-keyed object on npm 12),
  `okf/gotchas/action-macos-npm-cache.md` (why `withCacheDir` exists) —
  Load when: a publish or pack fails on a runner, or a caller loses auth.
- Known edge → `okf/limitations/npm-no-packument-caching.md`.
- Package-manager support window (which npm majors `PackagePublish` must
  decode) → `okf/conventions/package-manager-support-policy.md`.
- Kit-wide standards this package is bound by →
  `okf/conventions/no-barrel-re-exports.md` (only `src/index.ts`
  re-exports; grouped statics are a class, never an `as const` object),
  `okf/conventions/error-standards.md`, `okf/conventions/testing-standards.md`.

## Operating instructions

- Read `okf/modules/npm.md` before changing anything; re-check the tier
  against `okf/decisions/npm-tier-guardrail.md` before adding a dependency.
- Verify a claim against `src/` and `__test__/` before acting on it; the
  bundle describes the present, and the source settles disputes.
- Tests provide layers via top-level `layer(...)`, assert with `assert.*`,
  and take any `FileSystem` from `@effected/memfs`.

```bash
pnpm vitest run packages/npm          # from the repo root
pnpm build --filter @effected/npm     # dev + prod
```

Never run `node savvy.build.ts --target prod` directly (root `CLAUDE.md` says
why). A prod `issues.json` with `suppressed: 0` means the build did not run
properly; `dist/dev/issues.json` legitimately has `suppressed: []`.


---
<!-- okf/modules/npm.md -->
---
type: Module
title: npm
description: The dependency-resolution contracts a manifest library defines but cannot implement, the npm vocabulary shared across the kit, and the registry/tarball/publish services that replace a shelled-out npm CLI.
status: stable
kind: package
resource: ../../packages/npm
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-28T18:00:23Z
  body_sha256: 3dc46bbce5c3cedf2eae1807ebfd650d76f780113f603cfb05d7f8b180e0b81b
---

# npm

## Purpose

`@effected/npm` is an internal package with no source repository predecessor. It owns four things: the dependency-resolution contracts (`CatalogResolver`, `WorkspaceResolver`) that `@effected/package-json` defines a need for but cannot implement, since resolving a `catalog:`/`workspace:` specifier needs workspace and catalog context a document library never has; the cross-cutting npm vocabulary shared by three or more packages (`DependencySpecifier`, `DependencySection`, `IntegrityHash`, `PackageManagerPin`, `PackageManagerCache`, `ReleaseAgeGate`); the tolerant `Manifest` domain model built on the per-specifier contracts; and the registry, tarball and publish services (`NpmRegistry`, `PackageTarball`, `PackagePublish`) that do their own IO through core contracts in `R`. See [contract inversion is the default](../decisions/contract-inversion-default.md) for why the contracts live here rather than beside their implementer.

## Tier and dependency posture

Boundary tier — not because of an [R2](../conventions/dependency-policy.md) edge (the `@effected/commands` dependency is itself boundary, with zero runtime dependencies, and boundary does not propagate), but because the package performs IO itself through core-declared contracts (`HttpClient`, `ChildProcessSpawner`, `FileSystem`, `Path`, `Crypto`) required in `R` — the same shape `walker`, `xdg` and `git` share. `peerDependencies` is `effect` plus one pure-to-pure `@effected/semver` edge, used only so the range case validates through `Range.FromString`. `dependencies` is `@effected/commands` and nothing else — zero external runtime dependencies. `@effected/package-json`, `@effected/lockfiles` and `@effected/workspaces` all depend on this package; the dependency arrows point at it, never away from it.

This package was pure until 2026-07-25, when the registry/tarball/publish services landed; a guardrail keeps it from drifting further to integrated — see [the tier guardrail](../decisions/npm-tier-guardrail.md).

## Module layout

Module-per-concept in `src/`, no barrels below `index.ts`. The placements that are decisions rather than mechanics:

- `WorkspaceResolver.ts` owns `DependencyResolutionError` (both resolvers raise it); `CatalogResolver.ts` type-imports it, a one-way edge that keeps `noImportCycles` satisfied.
- `CatalogAssemblyError.ts` and `PublishError.ts` are leaf modules, not residents of the module that raises them, because two modules must reference each without an import cycle. `PublishError.kind` is `auth | pack | publish | output | digest | executor`; `digest` exists because npm succeeding while the tarball cannot be read back is not "npm pack failed".
- `index.ts` owns the composite `Default` layer (both no-op resolver layers merged), the cycle-free home for the merge.

Every Effect class factory is written inline, with the synthesized `_base` heritage symbols suppressed narrowly in `savvy.build.ts` per the kit's API Extractor policy.

## Resolver contracts

`CatalogResolver` and `WorkspaceResolver` are both `Context.Service` with the shape inlined structurally, and no-op layers bound to a `const` so they memoize by reference. `CatalogResolver.rangeOf` takes a package name and an `Option` catalog name (`None` meaning the default catalog) and answers the configured range, or `None` if unresolvable. `WorkspaceResolver.versionOf` answers the concrete version with the range modifier stripped, or `None`. An unmatched specifier is `Option.none()`, not an error — `DependencyResolutionError` is reserved for mechanism failure, never for "no match found." Its one other case is a `workspace:` specifier naming a known member that declares no `version`, which `none` would misreport as a non-member; a `reason` literal (`"mechanism"`, the constructor and decoding default, or `"no-version"`, raised with no `cause`) separates the two so a consumer never string-matches the wrapped cause, and the `message` getter names the no-version case.

`CatalogAssemblyError` is the typed failure of catalog assembly, and it lives beside the contract rather than in the implementing package: the contract package owns the contract's error vocabulary. Before the relocation, `rangeOf` could only name `DependencyResolutionError`, so implementations folded assembly failures into its defect `cause` and every consumer `_tag`-sniffed `unknown` to distinguish an assembly failure from a resolution failure. `@effected/workspaces` implements both contracts directly as layers over its own services, and imports `CatalogAssemblyError` back from here without re-exporting it, so there is exactly one home for it. Its `message` appends the cause's message, since the cause carries the actionable detail and a consumer rendering `message` must not lose it. An optional `reason` (`notInstalled`, `ambiguous`, `fetchFailed`, `integrityMismatch`, `integrityUnavailable`) distinguishes a config dependency that could not be resolved at its declared version (effected#842).

## Manifest: tolerant manifest-level resolution

`Manifest` is a `Schema.Class` domain model of a tolerant manifest, offering the manifest-level resolution the per-specifier contracts alone cannot: the four dependency fields are typed `string→string` records and validate — a malformed dependency field, or a non-record input, fails typed — while every other top-level key round-trips unvalidated into a `rest` catch-all, flattened back to the top level on encode so no literal `rest` key ever appears on the wire. Mid-build manifests are arbitrary user records, and forcing them through `@effected/package-json`'s strict `Package` decode would fail resolution on fields this module never reads.

The surface is a decode static (normalizing `SchemaError` to `ManifestDecodeError`), a pure `needsResolution` getter (the fast-path predicate letting callers skip catalog assembly entirely), an instance `resolve()` returning a new `Manifest` rather than mutating, and an encode back to the wire shape. `UnresolvedDependencyError` is the manifest-level reading of the contracts' `None` convention: the resolution mechanism worked, the answer was empty, and a manifest with an unanswerable specifier cannot be projected to concrete ranges. Three failure vocabularies meet here and must not blur: `DependencyResolutionError` is failure of the resolution *mechanism*, `CatalogAssemblyError` of catalog assembly, and `UnresolvedDependencyError` the empty answer — its `dependency` names the manifest key, which for a `workspace:<alias>@<range>` specifier is the alias whose *target*'s version was resolved.

## DependencySpecifier and the vocabulary modules

`DependencySpecifier` is one specifier grammar spanning the kit — lockfiles, workspaces and package-json all classify a specifier the same way. The branded string is the ground truth; a `FromString` codec decodes it to a coarse five-case tagged union (catalog, workspace, semver range, dist-tag, raw fallback), and every union case stores the original raw string so decode∘encode is byte-for-byte identity by construction. Resolution projections — extracting a catalog name, applying pnpm's publish-time workspace projection — are statics here, sharing one internal implementation with the classified instance's own `resolve` so the two can never disagree. The protocol taxonomy (`protocolOf` and friends) classifies eleven specifier protocols; the workspace projection handles the alias form `workspace:<alias>@<range>` with a last-`@`, scope-aware split and projects it to `npm:<name>@<projected>`, and `workspaceTargetOf` answers the alias target (`None` for the plain form). Range detection decodes `@effected/semver`'s `Range.FromString` purely — the only use of the `semver` edge.

Other vocabulary modules:

- `DependencySection` — one concept as two literal schemas: the short dependency kinds and the manifest field names, with a single source-of-truth mapping and its derived inverse, replacing private copies package-json, lockfiles and workspaces each carried independently.
- `IntegrityHash` — an SRI brand covering three textual forms, because lockfile integrity is not all-SRI: npm/pnpm record SRI, corepack records its own pin form, and yarn Berry records cache checksums (`10c0/<hex>`, naming no algorithm, so `algorithmOf` is `None` for it). `CorepackIntegrityHash` is the corepack-only narrowing shared by identity with `@effected/package-json`'s `PackageManager.integrity` field, so both sides assert against one home — see [consumed by identity](../invariants/corepack-integrity-hash-shared-by-identity.md) for why only a runtime identity assertion can see a re-fork. `SriIntegrityHash` is the sibling narrowing to the SRI `<algo>-<base64>` form lockfiles record, which rejects a corepack `sha512.<hex>` or yarn `10c0/<hex>` value. It has the same posture: it decodes to the same `IntegrityHashBrand` rather than a second brand, and since the `Schema.check` is erased from the built type, a consumer asserts by object identity that its field schema IS this export. `@effected/workspaces`' `ConfigDependencySpec.integrity` is its first consumer and carries that assertion. `IntegrityHash.isSri` asks the same question of a raw string without decoding; `InvalidSriIntegrityHashError` belongs to the SRI → corepack conversion below, not to this schema.
- `PackageManagerPin` — the corepack pin triple `<name>@<version>[+<integrity>]` as a first-class class, independent of any package.json field, sharing the strict version ruling with package-json's field model but deliberately diverging on the name grammar: the pin vocabulary is a closed four-literal set (npm/pnpm/yarn/bun) where the field model is permissive, because corepack itself recognizes only three names and would reject the real-world `bun@…`, and npm documents no constraint on the field at all. Do not "finish" that consolidation — the divergence is evidence-backed in both modules' TSDoc. The shared version ruling is string-level, through `SemVer.isPinnable`, so a padded substring like `pnpm@ 11.17.0` fails typed with `reason: "version"` where a bare `SemVer.parseResult` check would trim and silently canonicalize; the first `+` after the version always begins the integrity, so a malformed tail fails with `reason: "integrity"` rather than falling back to build-metadata parsing. Prereleases are pinnable; ranges, partials and dist-tags are not. `parseResult` (a sync `Result`) is the primitive under `parse` and the `FromString` codec.
- `PackageManagerCache` — the per-manager default-cache-directory facts table: a pure function of manager, platform and home (no IO, no `node:path` — paths join with the platform family's separator) a CI action, a workspace tool or a doctor command can read with no runner, filesystem or subprocess. Five rows, because yarn splits into `yarn-classic` and `yarn-berry`, whose two lines document different cache locations. Every row is cited to the manager's own authority, because prior art in this space was partly folklore and wrong. It is a table of **defaults only**: `$PNPM_HOME`, `$XDG_*`, `$BUN_INSTALL_CACHE_DIR` and npm's `--cache` are deliberately out of scope, and the tests pin every cell — so a "tidied" path never hits.

## SRI-to-corepack conversion

npm's SRI form (`sha512-<base64>`) and corepack's pin form (`sha512.<hex>`) encode the same digest, and converting between them is a real consumer need — writing a `packageManager` pin from a registry read means converting a value the registry hands over in SRI form. The conversion is a `Schema` transformation, `CorepackIntegrityHash.FromSri`, plus an `Effect` convenience `fromSri` failing with a typed `InvalidSriIntegrityHashError`. Non-sha512 input and the wrong digest length both fail typed decode rather than producing garbage a corepack install would reject at the worst possible time. The base64 reader is strict and hand-rolled rather than `Buffer` (Node-only and lenient) or core's `Base64.decode` from `effect/encoding/Base64` (probed: it accepts non-zero trailing bits and embedded CRLF, so three spellings decode to one digest, yet rejects the unpadded form — a drop-in in neither); `Buffer`-style lenience would mint pins corepack rejects at install, and only padding is optional. That verdict is **decode-only**: `PackageTarball` verifies through core's *encoder*, `Base64.encode`, and the codec's encode direction is the exact inverse of its decoder, not a second acceptance rule. The conversion is one-way from SRI: an already-corepack-form input does not pass through decode, so a caller cannot feed pins back in and mask a wiring bug.

## ReleaseAgeGate

pnpm's publish-time release-age gate — refusing to install a version younger than a configured cutoff — is shared npm vocabulary, resident here because a resolver with no publish-time awareness would otherwise pick a version pnpm then rejects. `combine` is variadic and total: it assembles the effective gate from partial contributions across sources, where the strictest age wins, exclude sets union into a deduplicated sorted wire form, and zero contributions yield the inert zero gate — the single clamping authority. Exclude matching is flat-string with `@pnpm/matcher` parity, where `*` crosses `/`, deliberately not `@effected/glob`'s minimatch dialect, because pnpm treats the package name as a flat string — and a second consumer rides on `matchesExclude`: `@effected/workspaces`' `PeerCheck` resolves `peerDependencyRules.ignoreMissing` / `allowAny` patterns through it (via its `internal/peerPatterns.ts`), so a change tracking a `minimumReleaseAgeExclude` tweak moves peer verdicts too. Never clamp a `PartialReleaseAgeGate` (the permissive `Schema.Struct` inbound form for hook and manifest contributions) in isolation; `combine` is the one authority. Version filtering is pure with a caller-supplied clock and drops versions younger than the cutoff or with a missing/unparseable timestamp. Consumer-side config readers stay out of this package: `@effected/workspaces` owns reading the gate from workspace config keys, and this pure module is the vocabulary those readers combine.

## The service half: registry reads, tarballs and publishing

Three services replace a shelled-out `npm` CLI wherever the work can be done structurally.

**`NpmRegistry`** reads over core `HttpClient`, replacing every shelled `npm view`. The model is keyed by `(registry, package, version)` with the registry a per-call argument, never layer-baked, because a publish flow can probe two registries for one package inside a single program. A 404 is `Option.none()`, decided structurally from the typed HTTP error rather than by matching stderr wording — extending the resolver contracts' `None`-is-success convention to registry reads. `integrity` is typed as this package's `IntegrityHash`, not a bare string. A per-version read falls back to the whole packument on a 405 from any registry, not just the GitHub Packages case that motivated it (that registry answers the per-version endpoint 405 whatever the credentials, so a `github-packages` target routes through the packument up front), because the routing is by observed behavior rather than a vendor allowlist. Version selection out of a packument uses `Object.hasOwn`: the version number is caller input, and a key like `constructor` must not read the prototype. `RegistryReadError` routes on `kind: transport | status | decode`. Two doubles ship: `layerTest(Partial<Shape>)`, whose unstubbed members die rather than answer a fake default, and `layerSeeded(RegistrySeed)`, a working fake keyed on all three axes `registries[registry][name][version]` — a double keyed by package name alone cannot express two registries disagreeing about one package, which is the case the publish flow exists to probe.

**`PackageTarball`** is the inbound half — `NpmRegistry` reads metadata and `PackagePublish` sends a tarball out, but nothing previously read a published one back. `extract` takes a `PublishedVersion` and yields, inside a `Scope`, the directory the tarball's fixed `package/` root unpacked into. Integrity is verified before extraction and before anything reads the contents, using core's `Crypto` digest and `Base64.encode` from `effect/encoding/Base64`; a non-2xx is caught before anything reaches disk, since piping a 404 error page into `tar` would surface as a misleading "could not extract." The digest compare is padding-insensitive, since the SRI grammar permits an unpadded value; an integrity form this cannot check (the yarn form names no algorithm) logs a warning that it could not verify rather than skipping silently, and a digest that could not be computed fails as `integrityUnverifiable`, never as `integrityMismatch`, because nothing was compared. `TarballError.reason` (`notFound | http | integrityMismatch | integrityUnverifiable | extractFailed`) is discriminated rather than collapsed to one sentinel, because a consumer that cannot tell "this version legitimately does not exist" from "something went wrong fetching a version that does" treats both the same way — an incident where an integrity mismatch was handled as a missing merge base, downgrading a merge to a lossy algorithm and dropping a user's override on a run that reported success, is the standing argument against collapsing it. Extraction shells out to `tar` through core's `ChildProcessSpawner` rather than taking a tarball-reader library dependency — see [the tier guardrail](../decisions/npm-tier-guardrail.md) for why that is a tier decision, not a convenience. Loading the extracted file is deliberately not part of this surface, since a dynamic `import()` of a computed path becomes a bundler context module; the composition instead pairs this with `@effected/package-json`'s pure `resolveEntryPoint` and leaves the load to the consumer's own bundler-visible code.

**`RegistryCredential`** is a closed union (`{ kind: "token" }` or `{ kind: "basic" }`) taken by both the read probe and `PackagePublish.setupAuth`, because a probe and a publish disagreeing about the authentication scheme against the same registry is the worst kind of bug: a bearer probe against a basic-auth registry answers 401, which reads as "not published," so a publish proceeds on a false premise. The basic arm holds the already-encoded blob npm itself stores in `_auth`, never a user/password pair; `basicCredentialFromPair` mints one for the caller who genuinely holds a pair and refuses a username containing `:`. The kind picks the npmrc key (`_authToken` vs `_auth`) and the header scheme, and is span-annotated; the value never is. `RegistryTarget.token` survives one minor as a deprecated `never` tripwire rather than being dropped silently or aliased, because a caller's conditional spread of a no-longer-known property compiles clean and drops the field with no error — typed `never` makes that spread a compile error instead.

**`NpmExecutor`** carries `withCacheDir` and a generic `withExtraArgs`, both copy-returning; `withExtraArgs` replaces rather than accumulates. `dlx(spec)` runs through `@effected/commands`' `LocalExec.applyDlx` (`pnpm dlx npm@11 …`) because OIDC trusted publishing needs npm ≥ 11.5.1 and GitHub-hosted runners ship 10.x. The cache redirect is named API, not tribal knowledge, because GitHub's macOS runner images ship a partially root-owned `~/.npm/_cacache` and current npm hard-fails `EACCES` on sight of it — an environment variable fixes it identically, but invisibly, which is how the fix gets lost in a port and rediscovered the hard way. The redirect overrides a deliberately configured cache (a `--cache` flag in argv outranks both `npm_config_cache` and any npmrc setting), and the combinator stays dumb about ambient state on purpose: a value transformation that reads ambient state cannot be reasoned about from the call site.

**`PackagePublish`** collapses a repeated per-method package-manager option into one `NpmExecutor` value (ambient or dlx), because `@effected/commands` already models fetch-and-run of a package binary. OIDC trusted publishing needs a fresh npm rather than the runner's bundled one, so `dlx` fails typed when no launcher is available rather than degrading to the ambient npm — degrading would reintroduce the exact OIDC failure the pinned spec exists to avoid, invisibly. Auth setup writes the credential into a caller-supplied npmrc path rather than argv, because redaction protects this kit's error messages, not the operating system's process table, and keeping the token off argv stays the security-correct choice regardless; masking the value is the caller's job, since this package takes no `ActionOutputs` edge. `pack` reports two digests that are **not interchangeable**: `integrity` is npm's sha512 SRI, the value that compares against the registry's `dist.integrity`, and `sha256Hex` is a local hex sha256, the attestation subject. Its `pack --json` decoder accepts both the npm 11 array and the npm 12 name-keyed object — see [the npm 12 gotcha](../gotchas/npm-12-pack-json-is-keyed-by-name.md). A failed `dryRun` is a **result**, not an error. On a result record the fields match their neighbours' optionality: `PublishOutcome.provenanceUrl` is a plain optional field, not an `Option`, because as an `Option` a bare `=== undefined` check compiled clean, was always true, and bit a consumer live — `Option` discipline is for the resolver contracts, where `None` is the answer. A fused probe-then-publish convenience is deliberately absent: the composition it would replace is consumer composition, and a fused form would hardcode one registry and could not recover from a partial multi-registry publish.

**`RegistryKind`** replaces four boolean predicates with one exhaustive classification (`npm | github-packages | jsr | custom`); the domain match is exact-or-subdomain with a leading dot, because a bare `endsWith` would classify a lookalike domain as the public registry and that classification decides whether a token is sent. Two label projections (`registryShortLabel` — `npm`/`github`/`jsr`, else the host — and `registryDisplayName` — `npm`/`GitHub Packages`/`JSR`, else the host) ship beside the classifier as functions over the registry string rather than a lookup table, so the same leading-dot domain guard covers the labels too; both fall back to the shared `registryHost`, which **keeps the port**, unlike the hostname the classifier compares. `registryDisplayName` accepts absent-or-empty and answers `npm`; `registryShortLabel` takes a plain `string`, so a nullish value is a compile error.

Both services follow the kit's service conventions: all-effectful shapes, `static readonly layer` using `this`, named spans on public boundaries carrying package name, registry host and version — never a token, never argv. Service `R` is discharged at construction, so every method's own `R` is `never`.

## Vocabulary registry

Four packages — npm, package-json, lockfiles, workspaces — operate around overlapping npm concepts, and API ships on evidence: an unmodeled concept stays unmodeled until a second consumer materializes, but a registry records where every modeled concept lives so nobody rebuilds an idiom for lack of a map. Standing assignments: versions and ranges → `@effected/semver`; manifest shapes → `@effected/package-json`; lockfile shapes → `@effected/lockfiles`; workspace and monorepo semantics → `@effected/workspaces`; cross-cutting scalars flowing between those concerns → here. Anything not modeled is preserved verbatim by the manifest or lockfile layer rather than discarded. Two standing rulings: `PackageName` stays in `@effected/package-json` until a second consumer materializes, and the pnpm `catalogs:` record shape is not pre-claimed here — it routes to `@effected/lockfiles`.

## Consumers and implementers

Consumers today are `@effected/package-json` (`Package.resolve`, and re-exporting `DependencySpecifier`), `@effected/lockfiles` (which pulled `DependencySpecifier`, `DependencyField` and `IntegrityHash` here as the second consumer) and `@effected/workspaces`. Arrows point *at* this package; the only outbound edges are the pure `@effected/semver` peer and the boundary `@effected/commands` dependency. `@effected/workspaces` implements both contracts as layers over its own services — `WorkspaceCatalogs.catalogResolver` and `WorkspaceDiscovery.workspaceResolver` — and its `Workspaces.resolverLayer` / `Workspaces.resolveManifest` are the batteries-included path over `Manifest`. It also surfaces the release-age contract (`WorkspaceCatalogsShape.releaseAgeGate`, `HookInjection.releaseAge`) that it cannot own, which is why the gate vocabulary lives here.

## Testing

Suites in `__test__/` per concept. Shared layers are provided through a top-level `layer(...)`, never per-test `Effect.provide`, and stubs build `Option` results with `Option.fromUndefinedOr`. The resolver-contract tests are light — no-op layers answer `None`, a stub-implementation layer proves the contract is implementable, and the resolution error preserves its structured cause — while the vocabulary tests carry the weight: specifier classification across the protocol set, the round-trip property, resolution projections, the section mapping, integrity across all three forms and the release-age gate's strictest-wins/union/totality behavior. Registry reads run against a stubbed core `HttpClient`, no platform package involved; publishing runs against `@effected/commands`' scripted-spawner fixture, which records argv, so "the token never reached argv" is an assertion rather than a hope. The tarball suite uses `@effected/memfs` as a devDependency so a write failure is a test input rather than a stub body, and its discriminating claims are ordering claims — a mismatched digest fails before anything is written, and a non-2xx never reaches the extractor.

## Build

Every Effect class factory is inline with no exported `*_base` const; `savvy.build.ts` suppresses `ae-forgotten-export` for the `_base` pattern, so a clean *prod* `issues.json` carries empty `warnings`/`errors` and one `suppressed` entry per such class. `suppressed: 0` in the prod gate means the build did not run properly, while `dist/dev/issues.json` legitimately has `suppressed: []` — the dev target does not run API Extractor. `pnpm build --filter @effected/npm` runs the dev+prod pipeline; never invoke `node savvy.build.ts --target prod` directly — see [the direct prod build gotcha](../gotchas/direct-prod-build-fakes-a-clean-gate.md).


---
<!-- okf/index.md -->
---
okf_version: "0.2"
---

# Project

* [effected](project.md) - What this project is, its boundaries, and its non-goals.

# Subdirectories

* [consumers](consumers/index.md)
* [conventions](conventions/index.md)
* [decisions](decisions/index.md)
* [glossary](glossary/index.md)
* [gotchas](gotchas/index.md)
* [interfaces](interfaces/index.md)
* [invariants](invariants/index.md)
* [limitations](limitations/index.md)
* [models](models/index.md)
* [modules](modules/index.md)
* [references](references/index.md)
* [runbooks](runbooks/index.md)


---
<!-- okf/decisions/npm-tier-guardrail.md -->
---
type: Decision
title: The npm tier guardrail — a non-core runtime dependency in a service escalates the whole package
description: "@effected/npm stays boundary only while its pure vocabulary never reaches IO and index.ts exports individually; a reachability test asserts both from the source graph, and the answer to the named escalation trigger is a package split, never an accepted retier."
status: draft
tags:
  - architecture
  - bundle
sources:
  - id: npm-reachability-test
    resource: ../../packages/npm/__test__/reachability.test.ts
  - id: npm-package-tarball
    resource: ../../packages/npm/src/PackageTarball.ts
  - id: npm-package-json
    resource: ../../packages/npm/package.json
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 4bcf6f7e1a7fc827657b9b11aea8ffcbc85d43b4daa0c94c31834063f5cccfed
---

# The npm tier guardrail — a non-core runtime dependency in a service escalates the whole package

## Context

`@effected/npm` moved from pure to boundary tier when its registry, tarball
and publish services landed, because those services do IO through
core-declared contracts required in `R`. Under the dependency policy's
tier-propagation rule, a *boundary* dependency does not propagate — so
`@effected/lockfiles` (pure) and `@effected/package-json` (boundary) were
able to stay at their own tiers even though both depend on `npm`. That
stability holds only while npm's services keep their IO confined to core
contracts; the moment a service takes a genuinely external runtime
dependency, the package would become integrated, and integrated *does*
propagate under R2 — dragging `lockfiles` and `package-json` up with it.
The question was how to keep that boundary from eroding silently as new
service capability gets added.

## Decision

Two structural properties keep `@effected/npm` at boundary tier, and a
test asserts both directly from the source import graph rather than
relying on review discipline:

1. **The pure vocabulary modules must not reach IO.** `IntegrityHash` and
   its siblings must import neither a service module nor
   `@effected/commands`, so a consumer that only wants vocabulary links
   no HTTP client and no subprocess runner.
2. **`index.ts` must export individually**, never through a namespace
   object — a namespace object is one live binding a bundler cannot see
   through, so importing `IntegrityHash` through one would retain every
   service's whole module graph.

`packages/npm/__test__/reachability.test.ts` checks both from the source
graph and is proven discriminating: adding a `commands` import to a
vocabulary module fails it.[^npm-reachability-test] It exists because the
guardrail was otherwise only prose.

**The escalation trigger, named explicitly:** the moment any service
takes a non-core runtime dependency — an npm client library, a tarball
reader, a registry SDK — the package becomes integrated. The recorded
answer to that day is **not** "accept an integrated npm." It is to split
the services into their own package, leaving the contracts and vocabulary
pure here. That split was considered and rejected *for now*, because the
services' densest dependency is this package's own vocabulary, so
splitting today would buy a package boundary between two halves that talk
constantly for no present benefit. The trigger to revisit is the
guardrail breaking, not taste.

**The rule has since been tested against its own named trigger and
held.** `PackageTarball` needs to unpack a `.tgz`, and the obvious
implementation is a tarball-reader library — the exact named escalation
trigger, verbatim. It extracts instead by shelling out to `tar` through
core's `ChildProcessSpawner`, so the tier stayed unmoved and `lockfiles`
stayed pure.[^npm-package-tarball] That is a tier decision, not a
convenience: the cost is that a consumer off a CI runner image needs both
a spawner and the `tar` binary, and paying that cost was judged cheaper
than moving three packages' tiers.

## Alternatives rejected

- **Accept the retier to integrated** once a service needs a real
  registry/tarball library, on the theory that the package already does
  real IO and one more dependency changes nothing qualitative. Rejected
  because R2 propagation is not free: it would move `lockfiles` (pure)
  and `package-json` (boundary) to integrated too, and every consumer of
  those two pays the widened peer closure for a dependency neither of
  them actually needs.
- **Split the services out of `@effected/npm` preemptively**, before any
  concrete trigger forces the question, to keep the pure vocabulary
  permanently insulated. Rejected because the services' heaviest
  dependency today is the package's own vocabulary — splitting now would
  create a package boundary between two halves that constantly talk to
  each other, for a hypothetical future dependency that has not
  materialized.
- **Trust code review alone** to keep the pure vocabulary modules from
  acquiring an IO import over time. Rejected in favor of an automated
  reachability test, because the guardrail is exactly the kind of
  constraint that erodes silently one import at a time without a test
  that actively fails on the violation.

## Consequences

Any future service capability added to `@effected/npm` — a new registry
operation, a richer tarball inspection, an extended publish flow — must
be checked against whether it can still be built on core contracts alone.
If it cannot, the guardrail's own recorded answer applies: split the
services, do not retier the package. `packages/npm/package.json`'s
`dependencies` staying at exactly `{ "@effected/commands": "workspace:^" }`
is the observable proof the guardrail currently holds — zero external
runtime dependencies.[^npm-package-json]

[^npm-reachability-test]: `packages/npm/__test__/reachability.test.ts:5-15,24-70`
    — the confinement test asserting vocabulary modules import no IO
    module and that `index.ts` exports individually.
[^npm-package-tarball]: `packages/npm/src/PackageTarball.ts` — extraction
    shells out to `tar` through core's `ChildProcessSpawner` rather than
    taking a tarball-reader dependency.
[^npm-package-json]: `packages/npm/package.json` — `"dependencies": {
    "@effected/commands": "workspace:^" }`, the package's only runtime
    dependency.


---
<!-- okf/conventions/dependency-policy.md -->
---
type: Convention
title: "Dependency policy: R1-R4"
description: The four rules governing how a library's tier and its dependencies relate, including when a retier to integrated is admissible.
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - architecture
  - bundle
sources:
  - id: schemastore-build
    resource: ../../packages/schemastore/savvy.build.ts
  - id: config-file-package-json
    resource: ../../packages/config-file/package.json
  - id: lockfiles-src
    resource: ../../packages/lockfiles/src
generated:
  by: "okfit/claude-code"
  at: 2026-09-15T15:38:20Z
  body_sha256: f7023a22ec7fb274de74de596856ff20eedc31eeeaa0516fbafab0fd92dadb7d
---

# Dependency policy: R1-R4

Four rules govern how a library's [tier](../glossary/library-tier.md) and
its dependencies relate. The framing default is to stay as Effect-native
as possible — a program built only from Effect primitives composes and
typechecks as one thing — but that default is tier-scoped, not global.

## R1 — tiers 1 and 2 take no external runtime dependencies

> Pure and boundary packages peer-depend on `effect` and may take
> `@effected/*` edges (`workspace:^`, regardless of whether the edge is a
> peer or a regular dependency), nothing else. Moving a package to tier 3
> (integrated) is a decision recorded in that package's design doc, never
> a default.

`@effected/schemastore` is the one package in the kit retiered after
publishing[^schemastore-build] — boundary to integrated on 2026-08-04,
to take `ajv` directly for build-time schema validation. What made the
retier admissible: nothing in the kit depends on `schemastore`, so R2
propagates the tier to nobody, and `ajv` is build-time tooling a
consumer installs as a devDependency, so the runtime-graph weight R1
guards against was never on anyone's bill. The second fact stopped
holding once applications imported the library at runtime for
`HostedSchema`, and on 2026-09-15 the engine moved to the
`schemastore-cli` companion and the package returned to boundary
([the engine lives in the CLI](../decisions/schemastore-engine-lives-in-the-cli.md)).
A retier candidate should be checked against those same two facts
before being accepted — and re-checked when a consumer's use changes.

R1 does not mean "parsing has no IO, so a format package is pure, so it
may not take a runtime dependency." Tier 3 is defined by dependencies
alone, so a package that does no IO can still legally be tier 3.
`@effected/toml` and `@effected/glob` vendor their engines into
`src/internal/` because of R1, not because they happen to lack IO — the
vendoring *is* the wrapper that keeps the package at tier 1, hardened per
the [input-hardening standards](input-hardening-standards.md). The rule
only bites where the third-party code is large, encumbered or itself
dependency-laden; in that case a tier-1/2 shape was wrong to begin with.

## R2 — tier 3 propagates

> Depending on a tier-3 `@effected` package makes you tier 3, whatever
> your own imports say, because that package's external code lands in
> your consumer's tree transitively.

See the [tier taxonomy](../glossary/library-tier.md) for the trap this
creates: a package's own `package.json` is not enough to determine its
tier, because the classification has to walk the `@effected/*`
dependency graph.

## R3 — tier 2 does not propagate

> A boundary package's IO is discharged by the app's platform layer,
> provided once at the edge, so a consumer of a tier-2 package pays no
> external install for it.

`@effected/config-file` (boundary) depends on `@effected/walker`
(boundary) and stays boundary rather than being pushed up a tier by that
edge — its `package.json` declares no external runtime
dependency.[^config-file-package-json] R3 is what justifies R4's claim
that tier follows a package's own surface rather than its dependents'.

## R4 — tier follows a package's own surface, never its consumers'

> Tier follows a package's own surface (plus R2 for propagation), never
> its consumers'.

A package that wraps `parse`/`stringify` and never touches `FileSystem`
is pure even when its only consumer is a boundary library.
`@effected/lockfiles` is pure for exactly this reason: every entrypoint
takes `content: string`, and the file reading lives in
`@effected/workspaces` instead.[^lockfiles-src] Conversely, a package
becomes boundary the moment it performs IO itself, however thin.

R3 and R4 together are what keep `@effected/config-file` at boundary even
though it absorbs the four config codecs and peers on the pure `jsonc`,
`yaml` and `toml` format packages: `@effected/*` edges do not propagate
tier by themselves, only tier-3 does under R2.

## What the scheme buys

The tier label carries the dependency fact directly: "boundary" on
`@effected/config-file` says it carries zero external runtime
dependencies, which is what distinguishes it from integrated
`@effected/workspaces` without a sentence of prose. It also drives split
decisions — a package whose platform-specific half is tier 3 and whose
core logic is tier 2 should be split so the tier-2 half's consumers do
not pay for a tier-3 install they never asked for.

[^schemastore-build]: `packages/schemastore/savvy.build.ts` — the build
    configuration for the one package retiered after publishing, first
    to integrated and then back to boundary.
[^config-file-package-json]: `packages/config-file/package.json` —
    declares no runtime dependency outside `effect` and `@effected/*`
    peers.
[^lockfiles-src]: `packages/lockfiles/src/` — every parse entrypoint
    takes `content: string` rather than a path, keeping the package pure.


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


---
<!-- okf/decisions/no-shared-errors-package.md -->
---
type: Decision
title: "Decided against: a shared @effected/errors package"
description: A cross-package errors package was rejected for four reasons — the kit already has a shared error vocabulary in effect core, a central errors package inverts ownership and couples every error change to a cross-package release, Effect's error channel already composes unions structurally, and the genuine cross-boundary case already has a house pattern.
status: draft
tags:
  - architecture
sources:
  - id: root-claude-conventions
    resource: ../../CLAUDE.md
  - id: npm-catalog-assembly-error
    resource: ../../packages/npm/src/CatalogAssemblyError.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 269716f90fdc58fa641986808dc8f3d019f47dbb7b676615733468bd2af9c3f1
---

# Decided against: a shared @effected/errors package

## Context

Several kit packages define tagged errors that other packages need to
catch or compose against. A recurring proposal was a shared
`@effected/errors` package: one place to define common error shapes so
packages did not each reinvent conventions like a `_tag` field or a
`reason` union.

## Decision

The kit decided against a shared `@effected/errors` package, for four
reasons:

1. **The kit already has a shared error vocabulary.** Effect core's
   `PlatformError`, `SqlError` and Schema parse issues are the errors
   that genuinely cross every package boundary already, and they live in
   `effect` rather than in a kit-authored package.
2. **A central errors package is a barrel with different syntax**, and it
   inverts ownership: each package's error model is part of its designed
   API surface, and centralizing that model would make every error
   change a cross-package release event rather than a change contained
   to the package that owns the behaviour producing the error.
3. **Effect's error channel already composes unions structurally.**
   Tagged errors discriminate on `_tag`, `catchTag` narrows on it, and an
   effect typed `Effect<A, WalkerError | ConfigParseError>` flows across
   package boundaries with no nominal coordination required — nothing a
   shared errors package would add composes any better.
4. **The genuine cross-boundary case already has a house pattern.**
   `@effected/npm` is the worked example: when an error must cross a
   package boundary, it travels with the contract it belongs to, into a
   small package named for that contract, rather than into a generic
   errors package. `CatalogAssemblyError` lives beside the
   `CatalogResolver` contract that raises it, for the same reason
   `DependencyResolutionError` lives beside
   `WorkspaceResolver`.[^npm-catalog-assembly-error]

## Alternatives rejected

- **A shared `@effected/errors` package** carrying common tagged-error
  base shapes or a `reason`-union convention every package's errors
  would extend. Rejected for the four reasons above.
- **A convention document with no package at all**, leaving each
  package's error shape entirely independent with no shared reference.
  Rejected in favor of still legislating error-shape conventions — `_tag`
  naming, structure-preserving fields, per-reason tagged unions rather
  than one class carrying a `reason` field — as a repository
  convention,[^root-claude-conventions] just not as a runtime package.

## Consequences

An error that needs to travel between two packages gets its own small,
purpose-named package beside the contract it serves, following the
`@effected/npm` pattern, rather than a dependency on a shared errors
package. Error-shape conventions (tag naming, field structure) are
enforced as house style rather than by importing a common base class, so
a package's error types remain fully part of that package's own API
surface and versioning.

[^root-claude-conventions]: `CLAUDE.md` — the commit/testing conventions
    this decision sits alongside; the kit legislates error *shape* as
    convention rather than as a shared runtime dependency.
[^npm-catalog-assembly-error]: `packages/npm/src/CatalogAssemblyError.ts:3-7,27`
    — "so the `CatalogResolver` contract can name it in its error
    channel… It lives in its own module… for the same reason
    `DependencyResolutionError` lives in `WorkspaceResolver.ts`."


---
<!-- okf/invariants/corepack-integrity-hash-shared-by-identity.md -->
---
type: Invariant
title: CorepackIntegrityHash is consumed by identity, and only a runtime identity assertion can see a re-fork
description: "Both pin-tail models — @effected/npm's PackageManagerPin.integrity and @effected/package-json's PackageManager.integrity — consume the one CorepackIntegrityHash schema value; because a Schema.check is erased from the built type, a private copy that merely agrees with it is neither a type error nor a behaviour change, so each consumer's suite asserts object identity with a control against the unrestricted brand."
status: stable
resource: ../../packages/npm/__test__/IntegrityHash.test.ts
tags:
  - testing
  - architecture
sources:
  - id: npm-integrity-test
    resource: ../../packages/npm/__test__/IntegrityHash.test.ts
  - id: package-json-manager-test
    resource: ../../packages/package-json/__test__/PackageManager.test.ts
  - id: npm-integrity-source
    resource: ../../packages/npm/src/IntegrityHash.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 73b4e393c33e48cebcb211af82af6b52e49fff93a324939b96091aac2c78e89a
---

# CorepackIntegrityHash is consumed by identity, and only a runtime identity assertion can see a re-fork

## The property

`CorepackIntegrityHash` — the corepack-only narrowing of `IntegrityHash` to
`<algo>.<hex>`, sha224 included — has exactly one home, in
`@effected/npm`'s `IntegrityHash` module.[^npm-integrity-source] Both
surfaces that model a package-manager pin tail consume that very value
rather than re-deriving the restriction: `PackageManagerPin.integrity` in
the same package, and `@effected/package-json`'s `PackageManager.integrity`.
A caller decoding a pin through either model is therefore decoding through
the same check, and a rule change in one place is a rule change in both.

## The mechanism

The type system cannot enforce this. A `Schema.check` is erased from the
built `.d.ts`, so a consumer that severs itself from the shared schema and
keeps a private copy of the same regex produces neither a type error nor a
behavioural difference — every rejection test still passes and `tsc` is
silent. What discriminates is the field schema's **object identity**, so each
consumer's suite pins it directly:

- `PackageManagerPin.fields.integrity.schema === CorepackIntegrityHash` —
  a `Schema.optionalKey(X)` keeps the inner schema on
  `.schema`.[^npm-integrity-test]
- `PackageManager.fields.integrity.value === CorepackIntegrityHash` — a
  `Schema.Option(X)` keeps it on `.value`.[^package-json-manager-test]

Each assertion carries a control, `notStrictEqual` against the unrestricted
`IntegrityHash` brand, proving the assertion discriminates: a consumer that
falls back to the wide brand fails the control, which a type error would
never catch. The comparison is widened to `unknown` because the two schema
values carry different statics and no longer unify as types; the claim is
runtime identity, not assignability.

## What a refactor would have to break

A faithful re-fork — copying the restriction into the consumer and pointing
the field at the copy — fails both assertions with vitest's "compared values
have no visual difference," which is the point: the values are
indistinguishable by shape and distinguishable only by identity. Never
downgrade the assertion to a behavioural test (decode a good and a bad value
through the field), because that is exactly the test a re-fork passes. The
invariant stops holding only if a consumer removes the identity assertion
along with the import, or if `IntegrityHash.ts` starts exporting the
narrowing under a second value.

The `package-json` side of this edge, together with the sibling version edge
to `@effected/semver`, is pinned from the consumer's view in
[PackageManager shares strict schemas by identity](package-manager-shares-strict-schemas-by-identity.md).

[^npm-integrity-source]: `packages/npm/src/IntegrityHash.ts` — the
    `corepackRestricted` narrowing and the exported `CorepackIntegrityHash`
    it backs, the single home for the corepack-only rule.
[^npm-integrity-test]: `packages/npm/__test__/IntegrityHash.test.ts:143-156`
    — `PackageManagerPin.integrity IS this schema, not a copy that agrees
    with it`, with the `notStrictEqual` control against `IntegrityHash`.
[^package-json-manager-test]: `packages/package-json/__test__/PackageManager.test.ts:219-230`
    — `integrity IS @effected/npm's shared corepack schema`, with the same
    control.


---
<!-- okf/gotchas/npm-renamed-field-silent-spread-drop.md -->
---
type: Gotcha
title: A renamed field typed never turns a silent conditional-spread drop into a compile error
description: "Dropping a renamed field outright lets a caller's conditional spread (`...(token !== null ? { token } : {})`) compile clean while silently omitting the field, because a spread of an unknown property is not an excess-property error — typing the deprecated field never makes the same spread fail to compile instead."
status: stable
resource: ../../packages/npm/src/NpmRegistry.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - dx
sources:
  - id: npm-registry-source
    resource: ../../packages/npm/src/NpmRegistry.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: d4a8b6200e587a5972a4acdf0aee12869e2f7e08c26e35fd28713eb4ab01b344
---

# A renamed field typed never turns a silent conditional-spread drop into a compile error

## What a reader sees

`@effected/npm`'s `RegistryTarget.token` field is typed `readonly
token?: never`,[^npm-registry-source] and a call site somewhere still
writes `...(token !== null ? { token } : {})` when constructing the
object. TypeScript compiles this without complaint.

## What they would wrongly conclude

That leaving a deprecated field typed `never` rather than deleting it
outright is pure ceremony — a documentation gesture with no functional
effect, since the field cannot legitimately hold a value anyway and the
spread "obviously" still does what it always did.

## What is actually true

`RegistryTarget` replaced a bare `token` field with a `credential` union
(`{ kind: "token" } | { kind: "basic" }`). Simply deleting the old
`token` field would have been a **silent** break: a caller's conditional
spread of a property TypeScript no longer knows about is not an
excess-property error, so the spread would compile clean and the field
would simply vanish from the constructed object — an authenticated probe
silently becomes an anonymous one. Against a private registry that
answers 401 to an anonymous read, `NpmRegistry.version` reads that as
"not published," and a publish flow acting on that reading republishes a
version that already exists.

Typing the field `never` instead of deleting it, and keeping it for one
deprecation cycle, converts that same spread into a genuine compile
error: assigning any value — even inside a conditional spread — to a
field typed `never` fails to typecheck. An alias to the new field would
have kept the silent path compiling too, which is why the field is typed
`never` rather than `Redacted<string>` or removed outright.

## The check

When retiring a field a caller might still be constructing through a
conditional spread, do not delete it outright and do not alias it to the
replacement. Type it `never` for one deprecation cycle, so any surviving
call site that still tries to populate it fails to compile rather than
silently dropping the value. Generalize this rule to any field removed
from a type that callers commonly populate through a spread rather than a
literal object — the spread is exactly the shape that an outright
deletion cannot catch.

[^npm-registry-source]: `packages/npm/src/NpmRegistry.ts:33-44` — the
    `@deprecated` `token?: never` field and its comment explaining the
    conditional-spread hazard it exists to catch at compile time.


---
<!-- okf/gotchas/npm-12-pack-json-is-keyed-by-name.md -->
---
type: Gotcha
title: npm 12's pack --json is an object keyed by name, not an array
description: A PackagePublish.pack or dryRun that fails with PublishError kind "output" on a runner whose npm is 12.x, after working for months, is not corrupt npm output — npm 12 changed `pack --json` from an array of entries to an object keyed by package name, and any decoder written against the npm 11 array rejects every npm 12 answer as unreadable.
status: stable
resource: ../../packages/npm/src/PackagePublish.ts
stale_after: 2027-03-18T00:00:00Z
tags:
  - compat
  - release
sources:
  - id: publish
    resource: ../../packages/npm/src/PackagePublish.ts
  - id: npm-pack
    resource: https://github.com/npm/cli/blob/v12.0.2/lib/commands/pack.js
  - id: npm-12-notes
    resource: https://github.com/npm/cli/releases/tag/v12.0.0
generated:
  by: "okfit/claude-code"
  at: 2026-09-19T02:46:28Z
  body_sha256: 7ba215d12f3da92c3ca5f77b61b220b26754fa650aadf08b4de6fbac52005fd0
---

# npm 12's pack --json is an object keyed by name, not an array

## What a reader sees

`PackagePublish.pack` (or `dryRun`) fails with a `PublishError` whose
`kind` is `output` — "npm's output could not be read" — although `npm pack`
exited 0 and wrote the tarball. It reproduces on every package, on a runner
or workstation whose `npm --version` is `12.x`, and the same code passes on
a machine still running npm 11.

## What they wrongly conclude

That npm printed something unparseable (a stray notice on stdout, a broken
JSON mode), or that the package itself is malformed, and go looking in the
package or in npm's log for the corruption. There is none.

## What is actually true

npm 12.0.0 made `npm pack --json` print the shape `npm publish --json`
already had: an object keyed by the packed package's name. On npm 11 only
`pack` printed an array — `publish --json` was keyed by name there too —
so the breaking change listed in 12.0.0's notes as "the --json output of
npm pack and npm publish have changed" is, for a `pack` consumer, `pack`
moving to match `publish`.[^npm-pack][^npm-12-notes]

The mechanism is one line in npm's `pack` command handing the tarball
logger the package `name` as the key where 11 handed it the array index,
plus npm's JSON output merging each `{ [key]: tarball }` item into an array
only when every key is positional (`lib/utils/display.js`,
`getArrayOrObject`). Name keys fail that test, hence the object — a package
literally named `0` would still merge to an array on npm 12, which is one
more reason to accept both containers rather than switch on the major.

```json
// npm 11.19.1
[ { "id": "pkg@1.1.0", "name": "pkg", "filename": "pkg-1.1.0.tgz", ... } ]
// npm 12.0.2
{ "pkg": { "id": "pkg@1.1.0", "name": "pkg", "filename": "pkg-1.1.0.tgz", ... } }
```

The entry itself is unchanged — `name`, `version`, `filename`, `integrity`,
`size`, `unpackedSize`, `entryCount` all carry the same values — so a
decoder that reaches the entry reads it identically; only the container
moved. `@effected/npm`'s `PackJson` codec accepts both containers from the
release carrying the npm 12 support work, per
[the support policy](../conventions/package-manager-support-policy.md)
(npm 11 and 12 are both in the window, so both shapes are
contractual).[^publish] A consumer decoding `pack --json` on its own, or
pinned to an older `@effected/npm`, hits this the day its runner's npm
moves to 12.

`npm view --json` moved in the same release (it now always answers an
array); the kit shells no `npm view` — `NpmRegistry` replaced it with
direct registry calls — so nothing here reads that output.

[^publish]: `PackagePublish.ts` — `PackJson` and `parsePackJson`, which
    take the first entry of either container.
[^npm-pack]: `lib/commands/pack.js` at v12.0.2 — `logTar(tar, { ..., key: tar.name })`;
    at v11.19.1 the key was the array index, while `publish.js` passed
    `key: pkgContents.name` on both majors.
[^npm-12-notes]: The v12.0.0 release notes, "⚠️ BREAKING CHANGES".


---
<!-- okf/gotchas/action-macos-npm-cache.md -->
---
type: Gotcha
title: A macOS Actions runner's npm cache is partly root-owned
description: GitHub's macOS runners ship a partly root-owned ~/.npm/_cacache, so a bare npm pack or npm publish dies with EACCES unless the cache directory is redirected explicitly at the call site.
status: stable
resource: ../../packages/npm/src/NpmExecutor.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - ci
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 92877ebeaee2e336732e6fdba084f1b61634f4b3398b2f5a7c0305f49779e784
---

# A macOS Actions runner's npm cache is partly root-owned

## What a reader sees

A publish step that runs `npm pack` or `npm publish` on a macOS Actions
runner, with no cache configuration of its own, works locally and in CI
on Linux runners.

## What they would wrongly conclude

That the step is portable across runner images, or that a failure on the
macOS runner points at a credentials or registry problem rather than the
filesystem npm is writing its cache to.

## What is actually true

GitHub's macOS runner images ship `~/.npm/_cacache` with some entries
already owned by root. npm silently tries to use that directory, and the
process (running as the normal runner user) dies with `EACCES` the moment
it needs to write there — a run that previously reported 11 of 11 publish
targets failing at once on the first real run against a fresh macOS
image. There is nothing wrong with the credentials, the registry, or the
packages being published; the cache directory itself is not writable.

## The check

Never invoke npm without an explicit cache redirect on a macOS runner.
`NpmExecutor.withCacheDir` owns this — build the executor with a runner-
temp cache directory rather than letting it fall through to the default,
and keep the redirect visible at the call site rather than hidden behind
an environment variable a later reader will not think to look
for.[^npm-executor]

[^npm-executor]: `packages/npm/src/NpmExecutor.ts:27-77` — `cacheDir` is
    emitted as `--cache <dir>` on every invocation, and `withCacheDir`
    documents the root-owned-cache failure mode this redirect exists to
    avoid.


---
<!-- okf/limitations/npm-no-packument-caching.md -->
---
type: Limitation
title: NpmRegistry does not cache repeated packument reads
description: Several NpmRegistry read paths fetch the same registry document more than once in a single program — most visibly the per-version read's 405 packument fallback — and nothing caches it; the fix is deferred until a consumer's call pattern demonstrates the cost rather than the redundancy alone.
status: stable
bounds: ../modules/npm.md
tags:
  - performance
sources:
  - id: npm-registry-source
    resource: ../../packages/npm/src/NpmRegistry.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 5ff0da77a9939006babaeeeb47672f5d458bf676a0422a603a0c2001c95569d1
---

# NpmRegistry does not cache repeated packument reads

## The condition

`NpmRegistry` methods each read from the registry per call, keyed on
`(registry, package, version)` with no request-level or process-level
cache. Several call patterns then fetch the same document more than once:
the per-version read's fallback to the whole packument on a 405 makes an
existing redundancy one call site larger, since a caller reading several
versions of the same package now re-fetches the packument once per
version rather than once per package.

## The observable symptom

A program that reads multiple versions, or multiple fields, of the same
package pays a full HTTP round trip to the registry for each read, even
when the underlying document has not changed and was already fetched
moments earlier in the same run.

## Why it is acceptable

The fix is well understood and not blocked on any design question: a
core `Cache` keyed on registry and package name, with the failure and
absence TTL rules already established by the `@effected/commands` work.
What is missing is evidence that any real consumer's call pattern
actually pays for the redundancy rather than merely exhibiting it — the
package's evidence-gated posture defers the work until a named consumer
demonstrates the cost, rather than building caching speculatively ahead
of a need `packages/npm/src/NpmRegistry.ts`'s current callers have not
shown.[^npm-registry-source]

## What the fix would take

A `Cache` service keyed on `(registry, package)`, reusing the TTL and
failure-caching rules `@effected/commands` already established elsewhere
in the kit, wrapping `NpmRegistry`'s packument and per-version reads so a
repeated read inside one program's lifetime resolves from the cache
rather than re-fetching. The trigger to build it is a consumer's observed
call pattern showing the waste, not the redundancy existing in principle.

[^npm-registry-source]: `packages/npm/src/NpmRegistry.ts` — the read
    methods (`version`, `versions`, `distTags`, `publishTimes`) with no
    caching layer between them and core `HttpClient`.


---
<!-- okf/conventions/package-manager-support-policy.md -->
---
type: Convention
title: Support the current major and one back of every package manager
description: The kit provisions and models the current major and one major back of every package manager — pnpm 11 + 12 and npm 11 + 12, both pairs verified as of 2026-09-18 — detecting an artifact layout by what the manifest declares, never by major; older majors get no code paths, tests, fixtures or docs.
status: stable
stale_after: 2027-03-17T00:00:00Z
tags:
  - compat
  - deps
sources:
  - id: owner
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-09-17T00:00:00Z
  - id: installer
    resource: ../../packages/github-actions/src/PackageManagerInstaller.ts
  - id: pnpm-exe
    resource: ../../packages/github-actions/src/internal/pnpmExe.ts
  - id: npm-12
    resource: npm:npm@12.0.2
  - id: npm-pack-json
    resource: ../gotchas/npm-12-pack-json-is-keyed-by-name.md
  - id: publish
    resource: ../../packages/npm/src/PackagePublish.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-19T02:46:28Z
  body_sha256: b9c198fd6cdf454ec365f654401600105568e75edac67bb338dbef4cfe331015
---

# Support the current major and one back of every package manager

Support **the current major and one major back** of every package manager
the kit provisions or models, and nothing older.[^owner] As of 2026-09-17
that window is pnpm 11 and 12 and npm 11 and 12; yarn and bun follow the
same rule. An older major is not a compatibility target: do not add a code
path, a test, a fixture or a paragraph of documentation for it, and remove
one that only an older major exercises when the window moves past it.

## The three surfaces the policy governs

- **`PackageManagerInstaller`** in
  [`github-actions`](../modules/github-actions.md) — the artifact layouts
  it can provision, documented from the consumer's side in
  [`actions-storage`](../interfaces/actions-storage.md). For pnpm the two
  in-window layouts are: pnpm 11, a Node entry at `bin/pnpm.mjs`; and
  pnpm 12, a shebang-less placeholder `pnpm` bin plus an
  `@pnpm/exe.<os>-<arch>[-musl]` native binary overlaid from the same
  registry.[^installer]
- **[`npm`](../modules/npm.md)** and
  **[`package-json`](../modules/package-json.md)** — they model the
  **latest `package.json` shape as npm 11 and 12 define it**. Previous
  shapes and deprecated fields are out of scope; do not model a field
  only an out-of-window npm reads.

## Detect a layout by artifact, never by major

The major is a hint; the layout is the contract. Decide which provisioning
path applies from what the extracted manifest declares — pnpm's
native-binary layout is recognised by an `@pnpm/exe.*` entry in the
wrapper's `optionalDependencies`, not by `version >= 12` — so a layout that
moves inside a major, or a major that keeps its layout, is handled without
a version table to keep current.[^pnpm-exe] A version-keyed branch is
exactly the code this rule forbids adding.

## What the window has cost so far

Moving the window to a new major is never "verification only" by default;
each of the two moves so far found one real break, and each in a different
surface. pnpm 12 changed the *artifact*: the `pnpm` bin became a placeholder
for a native binary, and provisioning it needed the overlay step. npm 12
changed a *program output* the kit decodes: `npm pack --json` went from an
array to an object keyed by package name, and `PackagePublish` (which
shells `pack --json` for `pack` and `dryRun`) rejected every npm 12 answer
as unreadable until it accepted both shapes.[^npm-pack-json][^publish] The
installer itself needed no change for npm 12 — `npm@12.0.2`'s `bin` is
unchanged (`bin/npm-cli.js`, `bin/npx-cli.js`) — and the verification is a
runtime probe: both `npm@12.0.2` and `npm@11.19.1` provisioned into a tool
cache and answering `npm --version` through their shims, with the
same-major near miss (ambient `12.0.1` for a `12.0.2` pin) going to the
tool cache rather than being accepted as close enough.[^npm-12]

The third surface, the manifest fields, was swept for npm 12 and found
nothing to model. npm 12 adds three root-only fields — `allowScripts`,
`packageExtensions` and `patchedDependencies` — and each is project policy
with no kit behaviour attached, so each rides through `PackageManifest`'s
`rest` untyped, exactly as `overrides` and `workspaces` do; no typed field
was deprecated (`man` is retained), and `npm-shrinkwrap.json`, which 12 no
longer honours, is referenced nowhere in the kit. The rule that decided
it: a root-only field the kit never reads stays in `rest`; a field is
typed when a kit surface consumes it.

The installer does not read an artifact's `engines.node` against the
runner's node. `npm@12.0.2` declares `^22.22.2 || ^24.15.0 || >=26.0.0`;
pinned under a node outside that set (24.9.0, say) it installs, runs, and
prints `npm warn cli npm v12.0.2 does not support Node.js v24.9.0` on
every invocation. Keeping the node pin and the manager pin coherent is the
consumer's job, made where it pins node; the kit surfaces nothing beyond
npm's own warning.

When the window moves next, sweep three things: the artifact layout the
installer extracts, every `--json` output the kit decodes from the manager,
and the manifest fields the manager reads or writes. Read the release
notes' breaking-change list against those three, then prove each with a
probe rather than trusting "bin shape unchanged" as the whole story.

[^owner]: The window, the three governed surfaces and the npm 12 status
    were stated by the repository owner on 2026-09-17.
[^installer]: `PackageManagerInstaller.ts` — the pnpm layout notes on
    `readPackageManifest` and the `overlayNativeBinary` step.
[^pnpm-exe]: `internal/pnpmExe.ts` — the module comment: detection is by
    layout, never by major version.
[^npm-12]: The `npm@12.0.2` packument: `dist-tags.latest`, `engines.node`
    and `bin`. Runtime probe 2026-09-18 on macOS arm64 against the real
    registry: `npm@12.0.2` and `npm@11.19.1` provisioned to a tool cache
    with integrity, shims answering `12.0.2` / `11.19.1`; under node
    24.9.0 the 12.0.2 cli ran and printed npm's own unsupported-node
    warning, under 22.23.2 and 26.9.0 it did not.
[^npm-pack-json]: The gotcha recording the `pack --json` shape change and
    the tell in `PublishError`.
[^publish]: `PackagePublish.ts` — the `PackJson` codec accepting both the
    array and the name-keyed shape.


---
<!-- okf/conventions/no-barrel-re-exports.md -->
---
type: Convention
title: Only entrypoint files re-export; never a barrel or a namespace object
description: Restrict re-exports to src/index.ts and published subpath entrypoints; every other module imports explicitly, and grouped implementations that each reach a distinct engine are never collected into one binding.
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - architecture
  - bundle
sources:
  - id: config-file-index
    resource: ../../packages/config-file/src/index.ts
  - id: config-file-codec
    resource: ../../packages/config-file/src/ConfigCodec.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 34b360c986fec3e21129ca358e4ed78fb507b90a9a462561b9bc1466a3b26c54
---

# Only entrypoint files re-export; never a barrel or a namespace object

Only entrypoint files — `src/index.ts` and any published subpath
entrypoints — may re-export. Every other module imports the values and
types it uses explicitly from their defining module: no intermediate
barrel files, no blanket `export * from` facades, and no re-exporting a
dependency's surface. Two failure modes justify the rule, both observed
in this kit's predecessor libraries: a blanket re-export facade creates a
phantom dependency nothing in `src/` actually uses, and entrypoint-based
static wiring couples module load order to the entrypoint, forcing
`sideEffects` declarations and deep imports on consumers.

## A namespace object is a barrel in different syntax, and a worse one

`export const Codecs = { json, jsonc, yaml, toml }` collects independent
implementations behind one binding exactly as `export *` collects
independent modules behind one module. It is worse because a bundler can
see through a re-export barrel — the named exports stay individually
reachable — but a namespace object is a **single live binding**:
reference it at all and every member is reachable, so every member's
whole module graph is retained. The failure is silent: no error, no
warning, just a bundle carrying engines the consumer never named.

## The worked example: config-file's four codecs

`@effected/config-file` holds every config codec, but the `jsonc`, `yaml`
and `toml` format packages stay independent, and the four codecs —
`JsonCodec`, `JsoncCodec`, `YamlCodec`, `TomlCodec` — are exported as
free-standing named exports, one per module, never collected into a
namespace object.[^config-file-index] `ConfigCodec` is the interface
only; there is no runtime value that groups the four
implementations.[^config-file-codec]

Collecting them into `export const Codecs = { JsonCodec, JsoncCodec,
YamlCodec, TomlCodec }` would drag every parsing engine — the JSONC, YAML
and TOML engines alike — into a JSON-only consumer's bundle, killing
tree-shaking silently: with the codecs as free-standing named exports, a
consumer importing only `JsonCodec` bundles a few hundred bytes; grouped
into one object, importing anything from that object would pull in all
three other engines too. Never collect the codecs into a namespace
object.

## `"sideEffects": false` does not answer this for an unbundled consumer

The entrypoint permission above is stated against bundlers, where a
barrel's named exports stay individually reachable and a tree-shaker
retains only what is named. An unbundled Node consumer has no
tree-shaker: importing one binding from `src/index.ts` evaluates that
module, which evaluates every module it re-exports, loading the whole
module graph regardless of `sideEffects: false`. The only mechanism that
answers "does a consumer that wants one class pay for the rest of the
package" is a published subpath entrypoint, reserved for a genuinely
heavy optional part of a package rather than reached for as a matter of
taste.

## When grouping is still allowed

Grouped statics are not banned outright. A set of variants of one
concept that live in one module and reach nothing heavier than each
other may be grouped — `MergeStrategy`'s `firstMatch`/`layeredMerge` pair
in `@effected/config-file` is exactly this shape. The hazard scales with
what sits behind each member: group siblings that share a module and a
dependency footprint; never group siblings that each drag in a distinct
engine. When in doubt, split — the cost of a separate module is one line
in `index.ts`, and the cost of getting it wrong is invisible until
someone measures the bundle.

### A sanctioned grouped-statics container is a class, not an `as const` object

Where grouping is warranted, the container is a `class` with a private
constructor and `static readonly` members, never
`export const X = { … } as const`. An `as const` object infers its member
types into the built `.d.ts`, and inference drops every member's doc
comment, so the documentation a package wrote for that surface becomes
invisible in a consumer's IDE. Call syntax is identical between the two
forms — this is a house-form rule about how the sanctioned group is
spelled, not a rule about whether grouping is allowed, and the two must
not be collapsed into one another: the namespace-object ban is about
*what* may be grouped and is load-bearing for bundle weight; this is
about *how* the sanctioned group is spelled and is load-bearing for docs.

[^config-file-index]: `packages/config-file/src/index.ts:33-38` —
    `JsonCodec`, `JsoncCodec`, `TomlCodec` and `YamlCodec` exported as
    separate named bindings, one import per line.
[^config-file-codec]: `packages/config-file/src/ConfigCodec.ts:55-56` —
    the four codecs "are free-standing named exports, one per module."


---
<!-- okf/conventions/error-standards.md -->
---
type: Convention
title: Error handling standards
description: The error-type preference order, where errors are defined, the Failure/Defect/Interrupt distinction, and the rule that every declared error channel must be demonstrated fireable.
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - architecture
sources:
  - id: effect-schema
    resource: ../../.repos/effect/packages/effect/src/Schema.ts
  - id: config-file-file
    resource: ../../packages/config-file/src/ConfigFile.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 59f4bba2dcf2ce241dd20e8ca9bfd4721fbee28e53b693671e8d1a7661a314fe
---

# Error handling standards

- Preference order: `Schema.TaggedError` (default — schema-backed, `_tag`
  routing, serializable, yieldable)[^effect-schema] →
  `Schema.Error` (schema-backed, no tag matching; infrastructure
  errors)[^effect-schema] → `Data.TaggedError` (fallback, reserved for
  truly local in-memory-only failures with non-serializable payloads).
- Errors are defined in the module file of the concept that raises them
  (see [module-per-concept layout](module-per-concept-layout.md)), never
  in a central `errors/` directory. `@effected/config-file`'s
  `ConfigFile.ts` defines `ConfigFileNotFoundError`,
  `ConfigFileReadError`, `ConfigFileWriteError`,
  `ConfigDefaultPathMissingError` and `ConfigValidationError` in the same
  module as the `ConfigFile` service that raises them.[^config-file-file]
- Three failure modes stay distinct: Failure (the typed `E` channel —
  expected, recoverable), Defect (`Cause.Die` — invariant violations,
  programmer error), and Interrupt (cooperative cancellation). Never
  model an expected business failure as a defect; reach for `orDie` only
  when the failure is validated as unrecoverable, and never to silence a
  type error.
- Wrap a foreign (third-party or runtime) error in a typed schema-backed
  error with a `cause: Schema.Defect` field; never leak a raw `Error` as
  part of a public contract.
- Normalize `SchemaError` to a domain error at the boundary via
  `Effect.catchTag("SchemaError", ...)`; never let `SchemaError` leak
  deep into application logic.
- Recovery operators: `catchTag` / `catchTags` for tagged recovery,
  `catchIf` for predicates, `match` to fold, `sandbox` / `catchCause` /
  `matchCause` to distinguish failure from defect from interrupt,
  `onInterrupt` for cleanup.
- Keep `_tag` names stable and descriptive; never collapse an error to
  `string` or `unknown` early.

## Every declared error channel is demonstrated fireable by a test, or deleted from the signature

A channel that cannot fire forces every caller to handle a case that does
not exist, and makes the type lie in the one direction the compiler
cannot check. Ported code is where these accumulate: a can't-fire channel
is typically a residue of something the port changed underneath it — a
validated construction that made formatting total, or an owned emitter
that removed the library whose failures the channel used to model. Treat
an error case with no failing test as a defect to fix, not a case to
leave documented for a future caller.

[^effect-schema]: `.repos/effect/packages/effect/src/Schema.ts` —
    `TaggedError` (line ~14201) and `Error` (line ~14141) constructors.
[^config-file-file]: `packages/config-file/src/ConfigFile.ts:21-103` —
    five `Schema.TaggedError` classes defined in the same module as the
    `ConfigFile` service.


---
<!-- okf/conventions/testing-standards.md -->
---
type: Convention
title: Testing standards
description: "@effect/vitest as the default runner, assert.* never expect, memfs as the real filesystem double, and why the oracle for a ported algorithm must be external."
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - testing
sources:
  - id: semver-comparator-test
    resource: ../../packages/semver/__test__/Comparator.test.ts
  - id: memfs-faultinjection-test
    resource: ../../packages/memfs/__test__/FaultInjection.test.ts
  - id: memfs-fs
    resource: ../../packages/memfs/src/MemoryFileSystem.ts
  - id: claude-md
    resource: ../../CLAUDE.md
generated:
  by: "okfit/claude-code"
  at: 2026-09-30T01:39:09Z
  body_sha256: 0c8fb2856835b9ef2052d58921835a5aa9db3f4fa5b497d093afb478eb482498
---

# Testing standards

- `@effect/vitest`: `it.effect` is the default test mode, providing
  `TestClock` and `TestConsole`; `it.live` only when real `Clock` or
  runtime behavior is genuinely required.[^semver-comparator-test] Never
  plain `it()` + `Effect.runPromise` for routine Effect code.
- Shared setup goes through a top-level `layer(ServiceLayer)((it) => {
  ... })`, built once and memoized, scoped to the group; `it.layer(...)`
  for nested isolation. The anti-pattern is repeating
  `Effect.provide(Layer)` inside each test body — provisioning belongs at
  the boundary, not per test.
- An integration suite over a shared, expensive real-world fixture — a
  temp-dir git repository driven by a real spawner, for instance — may
  use plain `beforeAll`/`afterAll` with `Effect.runPromise` to build and
  tear the fixture down once per file; `@effected/git`'s integration
  suites are the sanctioned example. The per-test `Effect.ensuring`
  pattern remains the default for cheap per-test fixtures.
- `TestClock.adjust` for time control with forked fibers.
- Property-based tests use `it.effect.prop` with FastCheck arbitraries;
  Schema inputs go through `Schema.toArbitrary`, since top-level `it.prop`
  does not support Schema inputs.[^semver-comparator-test]
- `assert.*` for uniform, explicit checks — **never `expect`**.
  `flakyTest` is reserved for genuinely flaky integration conditions, not
  a way to paper over a nondeterministic assertion.
- Tests live in each package's `__test__/` directory per repository
  convention, never co-located in `src/` — unit tests as `*.test.ts`,
  plus `e2e/` and `integration/` subdirectories where a package needs
  them.[^claude-md]

## The filesystem double is a real volume

A test needing `FileSystem` provides `@effected/memfs` as a
devDependency, never a hand-rolled `FileSystem.layerNoop` over a `Map`.
`layerNoop` is deny-by-default — it fails every member the fixture's
author did not think to write — so a stub encodes only the semantics that
author had in mind, and a bug depending on anything else cannot
surface.[^memfs-fs] Swapping hand-rolled stubs for a real volume across
the kit surfaced defects in packages that had been passing tests for
years — the value of a faithful double is the tests it stops passing.

Three rules generalize from that migration:

- **Inject a misbehavior as a fault, not as a stub body.**
  `layerWith(seed, { faults })` delegates every method a handler
  declines, so the fixture survives the code under test growing a new
  call — where a `layerNoop` stub starts failing on any unimplemented
  member instead.[^memfs-faultinjection-test] Then prove the fault is
  load-bearing by disabling it and watching the tests it should break
  actually die; a fault nothing depends on is decoration.
- **A handler that records and returns `undefined` is a spy, not a
  replacement.** It counts the call *and* lets it really happen. The
  mutant such a fixture must kill is precisely the one that swallows a
  write while still counting it — a stub body does not kill that mutant,
  a declining handler does.
- **Assertion timing picks the constructor family.** The `layer*` forms
  re-seed a fresh volume per `Effect.provide`, so they fit tests that
  assert *inside* the effect. The `make*` forms plus `Layer.succeed` pin
  one volume's identity for tests that assert *after* it runs. Used
  backwards, a post-run assertion reads a volume nobody wrote to.

A consumer-supplied sync filesystem port takes a volume too — it does not
require `FileSystem`, only a small structural port from its caller, so
the double for it is `MemoryFileSystem.syncFileSystem(volume)`.

A double that exists to control *timing* rather than to hold bytes is a
different artifact and stays hand-written; `@effected/jsonl`'s watch
harness is the standing example of that exception.

## The oracle for a ported algorithm is external

When an implementation and a remembered constant disagree, neither one
is the oracle — climb to the published intermediates instead. A signing
algorithm ported from a specification should be pinned against the
specification's own documented intermediate values (a canonical-request
hash, a signing-key derivation), not against a remembered end-to-end
example that may belong to a different worked case entirely. Where the
artifact has a published schema, the schema is the oracle: an emitted
document format is validated against its own published JSON Schema,
vendored as a test fixture, rather than against a hand-maintained
approximation of that schema.

**Never pin your own output as the fixture.** A snapshot of what the code
currently emits asserts only that it has not changed, which is the one
property that was never in doubt.

[^semver-comparator-test]: `packages/semver/__test__/Comparator.test.ts`
    — `it.effect` as the default mode and `it.effect.prop` with a
    `Comparator` schema arbitrary.
[^memfs-faultinjection-test]: `packages/memfs/__test__/FaultInjection.test.ts`
    — fault-injection tests over `layerWith` `faults`.
[^memfs-fs]: `packages/memfs/src/MemoryFileSystem.ts:274` — contrasts the
    delegate-by-default fault layers with `FileSystem.layerNoop`'s
    deny-by-default behavior.
[^claude-md]: `CLAUDE.md` §Testing — "tests live in each package's
    `__test__/` directory, never co-located in `src/`."
