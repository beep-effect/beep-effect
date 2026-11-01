# @beep/npm-spec

The pure npm vocabulary as Effect schemas and service contracts: dependency specifiers, manifests, integrity hashes, `packageManager` pins, release-age gates, registry kinds and credentials, and the `CatalogResolver` / `WorkspaceResolver` contracts that expand pnpm `catalog:` and `workspace:` specifiers. Nothing here performs IO. A package.json or lockfile model can depend on it without linking an HTTP client, a filesystem or a subprocess runner.

## Why this package

`catalog:` and `workspace:` are specifiers whose meaning lives somewhere other than the manifest they appear in. A manifest library can parse `"effect": "catalog:"` and still have no way to say what it resolves to, because the answer is in a workspace file it has no business reading. This package is the contract: `CatalogResolver.rangeOf` and `WorkspaceResolver.versionOf` are `Context.Service` shapes, both ship a no-op layer, and whatever can actually see the workspace supplies the implementation.

**An unmatched specifier is `Option.none()`, not an error.** A package absent from a catalog, or a name that is not a workspace member, is an ordinary answer. The error channel is reserved for the resolution mechanism failing, and `DependencyResolutionError` carries that cause structurally instead of folding it into a string.

The package is ESM-only (`"type": "module"`). Its runtime dependencies are `effect` v4 plus the workspace `@beep/identity`, `@beep/schema`, `@beep/semver` and `@beep/utils` packages. Every symbol is exported by name from a leaf module (`@beep/npm-spec/Manifest`, `@beep/npm-spec/IntegrityHash`, ...); there is no namespace object, so a bundler drops what a consumer does not use.

## Usage

The `Default` layer merges both no-op resolvers. Provide it when the contracts need to be satisfied but nothing should be resolved:

```ts
import { CatalogResolver } from "@beep/npm-spec/CatalogResolver";
import { Default } from "@beep/npm-spec/index";
import { WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

const program = Effect.gen(function* () {
  const catalog = yield* CatalogResolver;
  const workspace = yield* WorkspaceResolver;
  return yield* Effect.all([catalog.rangeOf("effect", O.none()), workspace.versionOf("@beep/semver")]);
});

const resolved = Effect.runSync(Effect.provide(program, Default));
console.log(resolved.every(O.isNone)); // true
```

`Option.none()` for the `catalog` argument selects the default catalog; `Option.some("build")` selects the named one.

## Manifest-level resolution

`Manifest` is a tolerant manifest model over the contracts. The four dependency fields are string-to-string records, and every other top-level field rides through a catch-all that flattens back on encode.

```ts
import { Default } from "@beep/npm-spec/index";
import { Manifest } from "@beep/npm-spec/Manifest";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const manifest = yield* Manifest.decode({ name: "app", dependencies: { effect: "^4.0.0" } });
  const resolved = manifest.needsResolution ? yield* manifest.resolve() : manifest;
  return resolved.toRecord();
});

const record = Effect.runSync(Effect.provide(program, Default));
console.log(JSON.stringify(record.dependencies)); // {"effect":"^4.0.0"}
```

`needsResolution` is a pure getter, so a caller can skip resolution when no dependency field carries a `catalog:` or `workspace:` specifier. `resolve()` applies pnpm's publish-time semantics, including the `workspace:<name>@<range>` alias form, and fails typed as `UnresolvedDependencyError` when a resolver answers `Option.none()` for a specifier the manifest needs.

## Integrity hashes

`IntegrityHash` is a brand over the three textual integrity forms a dependency graph carries: npm's SRI `sha512-<base64>`, corepack's `sha512.<hex>` and yarn's checksum. `CorepackIntegrityHash` narrows it to the corepack spelling a `packageManager` pin needs, and `CorepackIntegrityHash.fromSri` is the one-way bridge from the form npm hands you. An input already in corepack form fails typed rather than passing through.

## Features

- `CatalogResolver` / `WorkspaceResolver`: the `catalog:` and `workspace:` contracts, each with a `noop` layer; `Default` merges both.
- `DependencyResolutionError` / `CatalogAssemblyError`: the resolution mechanism failed, or the catalogs could not be assembled from their sources.
- `Manifest`: `Manifest.decode`, `needsResolution`, `resolve()` and `toRecord()`, with `ManifestDecodeError` and `UnresolvedDependencyError`.
- `DependencySpecifier`: an eleven-protocol classifier, a codec into a matchable tagged union that encodes back byte-for-byte, and the resolution statics `catalogNameOf`, `resolveWorkspace` and `workspaceTargetOf`.
- `DependencySection`: `DependencyKind`, `DependencyField` and the mapping between them.
- `IntegrityHash` / `CorepackIntegrityHash` / `SriIntegrityHash`: integrity brands, `algorithmOf`, and the SRI-to-corepack codec.
- `PackageManagerPin` / `PackageManagerCache`: the `packageManager` field model and each package manager's default cache directory.
- `ReleaseAgeGate` / `PartialReleaseAgeGate`: pnpm's `minimumReleaseAge` gate as pure vocabulary, with `combine`, `filterVersions` and `isExcluded`.
- `RegistryKind` / `classifyRegistry` / `DEFAULT_REGISTRY`: classify a registry URL as `npm`, `github-packages`, `jsr` or `custom`, with `registryShortLabel`, `registryDisplayName` and `registryHost`.
- `RegistryCredential` (`TokenCredential` | `BasicCredential`) and `basicCredentialFromPair`: the closed auth union registry reads and publishes share.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/npm-spec

# from packages/foundation/modeling/npm-spec
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` (`*.test.ts`, `*.property.test.ts`, `*.coverage.test.ts`) and import package source through `@beep/npm-spec/<Module>` aliases; `test/support/` holds the shared test helper. `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Provenance

Ported from upstream `@effected/npm` (MIT, C. Spencer Beggs) through the effected port, then promoted from the scratchpad into this workspace package by `goals/effected-promotion`. The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices.

The promotion split upstream's package in two. These modules came here, with schema identities moved from `@beep/scratchpad/effected/npm/*` to `@beep/npm-spec/*`: `CatalogAssemblyError`, `CatalogResolver`, `DependencySection`, `DependencySpecifier`, `IntegrityHash`, `Manifest`, `PackageManagerCache`, `PackageManagerPin`, `RegistryCredential`, `RegistryKind`, `ReleaseAgeGate`, `WorkspaceResolver`, and the `index.ts` entrypoint with its `Default` layer. `DEFAULT_REGISTRY` moved out of upstream's `NpmRegistry.ts` into `RegistryKind.ts`, because a consumer that only names the public registry should not need the registry client.

The driver half, `NpmExecutor`, `NpmRegistry`, `PackagePublish`, `PackageTarball` and `PublishError`, waits for its first consumer, the mcpb-kit tarball (SPEC D-05, W4-m). It was deleted from the lab when `goals/effected-promotion` closed; restore it with `git checkout bb2134fcb952e07580c4cebf2586c901f090ef5b -- scratchpad/effected/npm scratchpad/test/npm`. Those modules reach `HttpClient`, `ChildProcessSpawner` and `@beep/commands`, and they import the vocabulary from this package. The lab's reachability suite asserted that no module here imports a driver module, `@beep/commands`, or the core HTTP and process modules.

### Attribution

- Upstream package: `@effected/npm` 0.20.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`$HOME/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)

### Deviations

The module-level port deviations recorded in the scratchpad port carry over unchanged: Effect collections and helpers in place of native runtime operations, tagged errors, schema-derived models with `S.Opaque` statics, finite numeric domains, checked codec types, Effect-diagnostic-compliant constructors, per-module Effect imports, `@beep/identity` annotations, and the `Manifest` `__proto__` key preservation fixes. On promotion, plain-data schemas became branded `S.Opaque` values (`TokenCredential`, `BasicCredential`, `DefaultCacheDirectoryOptions`, `PartialReleaseAgeGate` and the classified specifier variants), constructed with `X.make`, and option parameters accept `X.Encoded`.

## License

[MIT](LICENSE)
