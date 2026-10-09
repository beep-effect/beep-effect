# npm (lab port of @effected/npm)

[![npm](https://img.shields.io/npm/v/@effected%2Fnpm?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/npm)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Effect service contracts for resolving pnpm `catalog:` and `workspace:` dependency specifiers, plus the npm registry and publish surface built on top of them. `CatalogResolver.rangeOf` turns a package name plus an optional catalog name into the configured range; `WorkspaceResolver.versionOf` turns a workspace package name into its concrete version. Both are `Context.Service` contracts, both ship a no-op default layer that resolves nothing, and neither one reads a file. The package is the seam: a library that needs to *expand* a specifier depends on this, and something that can actually see the workspace supplies the implementation. On top of the contracts sit the kit's shared dependency vocabulary — `DependencySpecifier`, `DependencySection`, `IntegrityHash` — and `Manifest`, a tolerant manifest model that resolves every `catalog:` and `workspace:` specifier through the contracts in one call. `NpmRegistry` and `PackagePublish` round out the package with the registry reads and pack/publish workflow a release tool needs, over core `HttpClient` and `@effected/commands`.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/npm

`catalog:` and `workspace:` are specifiers whose meaning lives somewhere other than the manifest they appear in. A package.json document library can parse `"effect": "catalog:"` perfectly well and still have no way to say what it resolves to, because the answer is in a workspace file it has no business reading. The usual escape hatches are both bad: take a dependency on a workspace crawler and drag a filesystem into a pure document library, or accept a resolver as an untyped callback and lose the failure channel. Neither is a contract. This package is the contract — shape only, so `@effected/package-json` can express `Package.resolve` against services in `R` and let the application decide where resolution actually comes from.

The one design decision worth stating up front: **an unmatched specifier is `Option.none()`, not an error**. A package that is absent from a catalog, or a name that is not a workspace member, is an ordinary answer and the resolver succeeds with `None`. The error channel is reserved for the resolution *mechanism* failing — an unreadable catalog file, a malformed workspace manifest — and `DependencyResolutionError` carries that cause structurally on a `Schema.Defect` field rather than folding it into a string. Blurring those two is how "no such package" ends up indistinguishable from "your disk is on fire".

## Install

```bash
npm install @effected/npm effect
```

```bash
pnpm add @effected/npm effect
```

Requires Node.js >=24.11.0.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`effect` v4 and `@effected/semver` are peer dependencies; `@effected/commands` arrives as an ordinary dependency, behind `PackagePublish`. Defining the resolver contracts runs no effect and touches no filesystem — their default layers are `Layer.succeed` over functions that return `Option.none()` — but `NpmRegistry` needs a `HttpClient` and `PackagePublish` needs `FileSystem`, `Crypto` and a `ChildProcessSpawner`, each supplied at the edge from `@effect/platform-node` or `@effect/platform-bun`.

## Quick start

The `Default` layer merges both no-op resolvers. Provide it when the contracts need to be satisfied but nothing should be resolved:

```ts
import { CatalogResolver, Default, WorkspaceResolver } from "@effected/npm";
import { Effect, Option } from "effect";

const program = Effect.gen(function* () {
  const catalog = yield* CatalogResolver;
  const workspace = yield* WorkspaceResolver;
  return yield* Effect.all([
    catalog.rangeOf("effect", Option.none()),
    workspace.versionOf("@effected/semver"),
  ]);
});

Effect.runPromise(Effect.provide(program, Default)).then(console.log);
// => [Option.none(), Option.none()]
```

`Option.none()` for the `catalog` argument selects the default catalog; `Option.some("build")` selects the named one.

## The contracts

| Service | Method | Returns |
| ------- | ------ | ------- |
| `CatalogResolver` | `rangeOf(packageName, catalog: Option<string>)` | `Option<string>` — the configured range, or `None` when the package is not in that catalog |
| `WorkspaceResolver` | `versionOf(packageName)` | `Option<string>` — the concrete version with the range modifier stripped, or `None` when the name is not a workspace member |

Both fail with `DependencyResolutionError`, which carries the `specifier` that could not be resolved and the structured `cause` of the underlying failure; `rangeOf` can additionally fail with `CatalogAssemblyError` when the catalogs could not be assembled from their sources. Both ship a `noop` layer bound to a const, so it memoizes by reference rather than minting a fresh layer at every use.

## Implementing a resolver

A real resolver is a `Layer.succeed` over the shape. `@effected/workspaces` implements these against a discovered monorepo, but the contract is small enough that a fixed record is a legitimate implementation — for a test, a fixture, or a tool that already knows its own catalog:

```ts
import { CatalogResolver, WorkspaceResolver } from "@effected/npm";
import { Effect, Layer, Option } from "effect";

const catalogs: Record<string, Record<string, string>> = {
  default: { effect: "^4.0.0" },
  build: { typescript: "^6.0.0" },
};

const workspaceVersions: Record<string, string> = { "@acme/widget": "1.4.0" };

export const ResolversLive = Layer.mergeAll(
  Layer.succeed(CatalogResolver, {
    rangeOf: (packageName, catalog) =>
      Effect.succeed(Option.fromUndefinedOr(catalogs[Option.getOrElse(catalog, () => "default")]?.[packageName])),
  }),
  Layer.succeed(WorkspaceResolver, {
    versionOf: (packageName) => Effect.succeed(Option.fromUndefinedOr(workspaceVersions[packageName])),
  }),
);
```

Note what the implementation does *not* do: an unknown package name returns `Option.none()` and never fails. Save the error channel for the case where you tried to read the catalog and could not.

## Manifest-level resolution

`Manifest` is a tolerant manifest model over the contracts: the four dependency fields are typed as string→string records, and every other top-level field rides through a `rest` catch-all that flattens back on encode, so the wire shape never carries a literal `rest` key. It is deliberately not `@effected/package-json`'s strict `Package` — a mid-build manifest is an arbitrary user record, and resolution has no business validating fields it never reads.

```ts
import { Default, Manifest } from "@effected/npm";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const manifest = yield* Manifest.decode({ name: "app", dependencies: { effect: "^4.0.0" } });
  const resolved = manifest.needsResolution ? yield* manifest.resolve() : manifest;
  return resolved.toRecord();
});

Effect.runPromise(Effect.provide(program, Default)).then(console.log);
// => { dependencies: { effect: "^4.0.0" }, name: "app" }
```

`needsResolution` is a pure getter: check it first and skip resolution entirely (and whatever catalog assembly backs the resolvers) when no dependency field carries a `catalog:` or `workspace:` specifier. `resolve()` projects every such specifier through the contracts and returns a new `Manifest`, applying pnpm's publish-time semantics — the alias form `workspace:<name>@<range>` resolves the *target* package's version and becomes the `npm:<name>@<range>` alias pnpm publishes. At the manifest level a specifier the resolvers answer `Option.none()` for fails typed as `UnresolvedDependencyError`, naming the field, the dependency and the reason: an unmatched entry is an ordinary answer for a resolver, but it means the manifest cannot be projected.

## Registry reads and publishing

`NpmRegistry` replaces every shelled `npm view`, reading over core `HttpClient` instead. The registry is a per-call argument rather than baked into the layer, so one program can probe two registries for the same package, and an absent package or version is `Option.none()` rather than an error:

```ts
import { NpmRegistry } from "@effected/npm";
import { FetchHttpClient } from "effect/http";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const registry = yield* NpmRegistry;
  return yield* registry.version("effect", "4.0.0");
});

Effect.runPromise(program.pipe(Effect.provide(NpmRegistry.layer), Effect.provide(FetchHttpClient.layer)));
// Option.some(PublishedVersion) when that version is on the registry, Option.none() otherwise
```

A `github-packages` target reads through the packument instead: that registry answers the per-version endpoint with a 405 whatever the credentials, so `version` routes there up front — and any other registry that answers 405 falls back the same way, so "is this version published" gives the same answer everywhere.

`PackagePublish` runs the rest of a release through `@effected/commands`' `Run`: `pack` writes the tarball and reports both its npm integrity and a local sha256 (the attestation subject), `publishTarball` uploads bytes packed earlier, and `dryRun` reports packability without contacting a registry. Every step fails typed as `PublishError`, routed by `kind`, rather than throwing on a non-zero npm exit. `NpmExecutor.ambient` runs the runner's own npm; `NpmExecutor.dlx("npm@11")` fetches a pinned one through the project's launcher, which is what OIDC trusted publishing needs on runners that still ship npm 10.x.

`NpmExecutor` is a value you copy rather than a flag bag: `withCacheDir(dir)` redirects npm's cache — worth doing on a runner whose `$HOME` is not writable, or where the cache belongs on the same volume as the workspace — and `withExtraArgs(args)` is the generic vent for a flag this package has not named. Both return a new executor, and `withExtraArgs` replaces rather than accumulates, so a copy is a complete statement of its own flags. `--cache` outranks both `npm_config_cache` and an npmrc `cache`, so `withCacheDir` overrides a cache someone configured deliberately — the combinator stays dumb about ambient state, and checking for one is the caller's call.

```ts
import { NpmExecutor } from "@effected/npm";

declare const runnerTemp: string;

const executor = NpmExecutor.dlx("npm@11").withCacheDir(`${runnerTemp}/npm-cache`);
// every invocation now carries `--cache <runnerTemp>/npm-cache`, after its own args
```

`classifyRegistry` tells npm, GitHub Packages, JSR and a custom registry apart as a `RegistryKind`, since provenance and auth differ by kind, and three projections render one for a human: `registryShortLabel` (`npm`, `github`, `jsr`, or the host) for a log line or a check name, `registryDisplayName` (`npm`, `GitHub Packages`, `JSR`, or the host) for prose, and `registryHost` for the bare host of any URL.

## How a registry is authenticated

`RegistryCredential` is the closed union both halves of the registry surface speak — `{ kind: "token", token }` for npm's `_authToken`, and `{ kind: "basic", encoded }` for its `_auth`, carried already base64-encoded because that is what npm stores and what registry configuration in the wild already contains. `basicCredentialFromPair(username, password)` encodes for a caller that genuinely holds a pair; the secret is `Redacted` on both sides of it.

```ts
import { PackagePublish, basicCredentialFromPair } from "@effected/npm";
import { Effect, Redacted } from "effect";

declare const password: Redacted.Redacted<string>;

const program = Effect.gen(function* () {
  const publish = yield* PackagePublish;
  yield* publish.setupAuth({
    registry: "https://npm.internal.example",
    credential: basicCredentialFromPair("ci", password),
    npmrcPath: "/tmp/.npmrc",
  });
});
// appends `//npm.internal.example/:_auth=<encoded>` to the npmrc, creating it when absent
```

One union rather than two spellings is the point: `NpmRegistry`'s per-call `RegistryTarget` takes the same `credential`, so a read probe and a publish cannot disagree about the scheme for one registry. A bearer probe against a basic-auth registry answers 401, `version` reads that as "not published", and a publish flow acting on it republishes a version that already exists.

**Breaking, and how to migrate.** `setupAuth` and `RegistryTarget` took a `token` field before; both take `credential` now. The rewrite is mechanical:

```ts
import type { RegistryCredential } from "@effected/npm";
import type { Redacted } from "effect";

declare const token: Redacted.Redacted<string>;

// before: setupAuth({ registry, token, npmrcPath })
const credential: RegistryCredential = { kind: "token", token };
// after:  setupAuth({ registry, credential, npmrcPath })
```

`RegistryTarget.token` survives for one minor typed as `never`, deliberately, so the break is loud. Callers commonly pass the field through a conditional spread (`...(token !== null ? { token } : {})`), and a spread of a no-longer-known property is not an excess-property error — the field would simply vanish and an authenticated probe would silently become an anonymous one. Typed `never`, the same spread fails to compile.

## Reading a published tarball

`PackageTarball` is the inbound half of the registry surface: `NpmRegistry` reads metadata and `PackagePublish` sends a tarball out, but nothing read a published one back. `extract` downloads a version, verifies the bytes against the integrity the registry vouched for, unpacks it, and answers the directory the `package/` root landed in — as a **scoped** resource, so the temporary directory is removed when the calling scope closes:

```ts
import { NpmRegistry, PackageTarball } from "@effected/npm";
import { Effect, Option } from "effect";

const read = Effect.gen(function* () {
  const registry = yield* NpmRegistry;
  const tarball = yield* PackageTarball;
  const found = yield* registry.version("some-config", "1.2.3");
  if (Option.isNone(found)) return Option.none();
  return Option.some(yield* tarball.extract(found.value));
}).pipe(Effect.scoped);
// Option.some("<a temporary directory>") — removed when the scope closes
```

Verification happens before extraction and before anything reads the contents, so a poisoned intermediary — a CDN edge, a proxy, a mirror — never reaches `tar`. `TarballError` carries a `reason` that keeps the outcomes apart: `notFound` (no recorded tarball, or a 404), `http` (any other transport or non-2xx failure), `integrityMismatch` (with `expected` and `actual`) and `extractFailed`. The `notFound` split is load-bearing — a consumer that cannot tell "this version legitimately does not exist" from "something went wrong fetching a version that does" has to treat both alike, and that failure is silent.

Extraction shells out to `tar` through core's `ChildProcessSpawner` rather than taking a tarball-reader dependency, which is a tier decision: a non-core runtime dependency here would make this package *integrated*, and that propagates to the pure packages that depend on it for vocabulary. `tar` is on every CI runner image; a consumer off a runner needs both a spawner and the binary. Pair it with `resolveEntryPoint` from `@effected/package-json` to find the entry file inside the extracted directory — loading that file is deliberately not part of this surface, since a dynamic `import()` of a computed path becomes a bundler context module with no seam to fix it.

## Integrity hashes

`IntegrityHash` is a brand over the three textual integrity forms a dependency graph carries — npm's SRI `sha512-<base64>`, corepack's `sha512.<hex>` and yarn's — with `algorithmOf` reading the algorithm out of any of them. `CorepackIntegrityHash` narrows the brand to the corepack spelling, which is what a `packageManager` pin has to be written in, and carries the bridge from the form npm actually hands you:

```ts
import { CorepackIntegrityHash } from "@effected/npm";
import { Effect } from "effect";

declare const npmIntegrity: string; // "sha512-<base64>", as the registry reports it

Effect.runPromise(CorepackIntegrityHash.fromSri(npmIntegrity)).then(console.log);
// "sha512.<the same digest, lowercase hex>" — the spelling a packageManager pin takes
// Failure: InvalidSriIntegrityHashError, carrying the offending `input`
```

`FromSri` is the same conversion as a `Schema.Codec`, for decoding an integrity field inside your own schemas; `fromSri` is the `Effect` convenience over it. The bridge is deliberately **one-way**: an input that is already in the corepack form fails typed rather than passing through, so a caller feeding pins back into the converter finds the wiring bug instead of masking it. The base64 reader is strict for the same reason — a lenient one mints pins corepack rejects at install time. Padding is its one latitude: a digest's padded and unpadded spellings decode to the same pin, while a stray character, an interior `=`, or non-zero trailing bits all fail.

## Who consumes this

`@effected/package-json` is the reason the package exists. `Package.resolve` walks all four dependency maps, expands every `catalog:` and `workspace:` specifier through these two services, and leaves untouched any specifier the resolvers answered `None` for. `@effected/lockfiles` came second, which is why the specifier and integrity vocabulary lives here rather than in package-json. `@effected/workspaces` sits on the other side of the seam and provides the implementations that read a real pnpm workspace — its `Workspaces.resolveManifest` runs `Manifest.resolve()` for you over a freshly discovered workspace. Nothing in this package points outward at any of them.

## Features

- `CatalogResolver` — the `catalog:` contract, plus `CatalogResolver.noop`.
- `WorkspaceResolver` — the `workspace:` contract, plus `WorkspaceResolver.noop`.
- `DependencyResolutionError` / `CatalogAssemblyError` — the typed failures: the resolution mechanism broke, or the catalogs could not be assembled from their sources.
- `Default` — `Layer.mergeAll` of the two no-op layers, for when the types need satisfying and nothing needs resolving.
- `Manifest` — the tolerant manifest model: `Manifest.decode`, the pure `needsResolution` fast path, `resolve()` over the contracts and `toRecord()` back to the wire shape, with `ManifestDecodeError` and `UnresolvedDependencyError` as its typed failures.
- `DependencySpecifier` — the specifier taxonomy: an eleven-protocol classifier, a codec decoding any specifier into a matchable tagged union that encodes back byte-for-byte, and the resolution statics (`catalogNameOf`, `resolveWorkspace`, `workspaceTargetOf`) implementing pnpm's publish-time projection.
- `DependencySection` — the kit-wide dependency vocabulary: `DependencyKind`, `DependencyField` and the mapping between them.
- `IntegrityHash` — a brand over the three textual integrity forms (SRI, corepack, yarn), with `algorithmOf`.
- `CorepackIntegrityHash` — the corepack-form narrowing a `packageManager` pin needs, plus the one-way SRI bridge: the `FromSri` codec, the `fromSri` effect over it, and `InvalidSriIntegrityHashError` carrying the input that would not convert.
- `ReleaseAgeGate` / `PartialReleaseAgeGate` — pnpm's `minimumReleaseAge` / `minimumReleaseAgeExclude` gate as pure vocabulary: `combine` merges contributions from multiple config sources strictest-age-wins, and `filterVersions` / `isExcluded` drop candidate versions younger than the cutoff against a caller-supplied clock, so a resolver never picks a version pnpm would reject. `matchesExclude` is pnpm's flat-`*` matcher, deliberately not `@effected/glob`'s dialect. `PartialReleaseAgeGate` is the permissive inbound form each source contributes.
- `NpmRegistry` — registry reads over `HttpClient`: `version`, `versions`, `distTags` and `publishTimes`, each taking a per-call `RegistryTarget` carrying the registry and an optional `credential`, with `version` reading a GitHub Packages target through the packument; `layerTest` and the fully-working `layerSeeded` are the test doubles.
- `PackagePublish` — the pack/publish workflow over `@effected/commands`: `setupAuth` (taking a `RegistryCredential`), `pack`, `publishTarball` and `dryRun`, with `PackedTarball` carrying both npm's integrity and a local sha256 digest.
- `PackageTarball` — fetch, verify and extract a published tarball as a scoped resource, with `TarballError` routed by `reason: notFound | http | integrityMismatch | extractFailed`.
- `RegistryCredential` — the closed auth union both `setupAuth` and `RegistryTarget` take (`token` for npm's `_authToken`, `basic` for its `_auth`), plus `basicCredentialFromPair` for a caller holding a username and password.
- `NpmExecutor` — `ambient` or `dlx(spec)`, the launcher choice a pinned, OIDC-capable npm needs on runners that ship an older one, plus the copying `withCacheDir(dir)` and `withExtraArgs(args)`.
- `PublishError` — the publish-workflow failure, routed by `kind: auth | pack | publish | output | digest | executor`.
- `RegistryKind` / `classifyRegistry` — classify a registry URL as `npm`, `github-packages`, `jsr` or `custom`, since provenance and auth differ by kind, with `registryShortLabel`, `registryDisplayName` and `registryHost` rendering one for a log line, prose or a bare host.

The surface grows when a consumer proves it needs more, not before.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/npm` 0.20.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/npm/DependencySection.ts:10 // `KIND_TO_FIELD` is the single source of truth; the inverse is derived from it,

### Added exports

| Export | Facets | Why |
| --- | --- | --- |
| `InvalidBasicAuthUsernameError` | value, type | Added by review round 1; see the deviations below. |

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab uses Effect collections, record/date/clock helpers, JSON codecs and S.Opaque statics where upstream used native runtime operations, with malformed pack JSON now carrying SchemaError. (scratchpad/test/npm/IntegrityHash.test.ts; scratchpad/test/npm/DependencySpecifier.test.ts; scratchpad/test/npm/Manifest.test.ts; scratchpad/test/npm/ReleaseAgeGate.test.ts; scratchpad/test/npm/RegistryKind.test.ts; scratchpad/test/npm/PackagePublish.test.ts:377)
- **tagged-errors** — The lab replaces upstream native credential/test-double errors with tagged errors and preserves originating stacks when encoding the six existing error causes. (scratchpad/test/npm/PackagePublish.test.ts:649,664; scratchpad/test/npm/NpmRegistry.test.ts:531; scratchpad/test/npm/PackageTarball.test.ts:228; scratchpad/test/npm/Manifest.test.ts:74; scratchpad/test/npm/CatalogAssemblyError.test.ts:94; scratchpad/test/npm/WorkspaceResolver.test.ts:67; NpmRegistry test-double and PackagePublish unstubbed-member cases)
- **schema-first** — The lab derives model types, guards and vocabularies from executable schemas and uses S.Opaque statics and validated internal error variants where upstream maintained type-only models and helper-first grammar. (scratchpad/test/npm/DependencySection.test.ts; scratchpad/test/npm/DependencySpecifier.test.ts; scratchpad/test/npm/IntegrityHash.test.ts; scratchpad/test/npm/PackageManagerPin.test.ts; scratchpad/test/npm/PackageManagerCache.test.ts; scratchpad/test/npm/PackageTarball.test.ts:244; scratchpad/test/npm/NpmRegistry.test.ts; scratchpad/test/npm/PackagePublish.test.ts)
- **numeric-domains** — The lab validates the listed status, exit-code, sizing and partial-age fields as finite numbers where upstream used unconstrained Number schemas or type-only numbers. (scratchpad/test/npm/ReleaseAgeGate.test.ts (PartialReleaseAgeGate schema cases); scratchpad/test/npm/PackagePublish.test.ts (pack/dryRun sizing cases); scratchpad/test/npm/NpmRegistry.test.ts; scratchpad/test/npm/PackageTarball.test.ts; no upstream assertion was changed solely for these finite refinements)
- **type-safety** — The lab uses checked codec types, guards and satisfies in place of upstream unsafe casts, with invalid test inputs confined to the operator-approved helper. (scratchpad/test/npm/DependencySpecifier.test.ts (classified payload assertions); scratchpad/test/npm/PackagePublish.test.ts (typed auth errors); scratchpad/test/npm/WorkspaceResolver.test.ts:79,120,130; scratchpad/test/npm/IntegrityHash.test.ts (algorithmOf))
- **tsgo-diagnostics** — The lab uses diagnostic-compliant schema constructors, decoding and Effect combinators where upstream used new constructors, broader decoders and redundant generator/error wrappers. (module suite scratchpad/test/npm/**)
- **effect-first** — The lab runs credential validation through a typed Effect and uses Effect function wrappers, matches and helper modules where upstream used synchronous throwing logic, inline generators and native helpers. (scratchpad/test/npm/CatalogResolver.test.ts; scratchpad/test/npm/WorkspaceResolver.test.ts; scratchpad/test/npm/PackagePublish.test.ts:83,150,356,642,649,656; scratchpad/test/npm/PackageTarball.test.ts; scratchpad/test/npm/DependencySpecifier.test.ts; scratchpad/test/npm/PackageManagerPin.test.ts)
- **effect-imports** — The lab imports Effect modules from dedicated subpaths where upstream source, tests and carried examples imported the root effect barrel. (module suite scratchpad/test/npm/**)
- **identity-annotations** — The lab gives services, schemas, fields and reusable checks namespaced @beep/identity metadata where upstream used local or @effected service identifiers and unannotated schema values. (module suite scratchpad/test/npm/**)
- **test-environment** — The lab token-contract test reads the copied NpmRegistry source path where upstream read its package-local src path. (scratchpad/test/npm/NpmRegistry.test.ts:210 (the registry token source-contract assertion))
- **reachability** — The lab reachability guard scans copied TypeScript modules and their relative commands edge where upstream scanned package src and published import specifiers. (scratchpad/test/npm/reachability.test.ts:23,40,64,104,115,128)
- **upstream-bug** — The lab preserves an own __proto__ unknown field during Manifest round-trip where upstream loses that field through ordinary-object assignment. (scratchpad/test/npm/Manifest.test.ts:52; scratchpad/test/npm/Manifest.test.ts:64)

### Dependency backlog

None.
