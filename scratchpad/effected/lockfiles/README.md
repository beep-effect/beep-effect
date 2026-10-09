# lockfiles (lab port of @effected/lockfiles)

[![npm](https://img.shields.io/npm/v/@effected%2Flockfiles?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/lockfiles)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Lockfile parsing for [Effect](https://effect.website) v4: bun (`bun.lock`), npm (`package-lock.json`), pnpm (`pnpm-lock.yaml`) and yarn Berry (`yarn.lock`) all normalized into one `Lockfile` schema model, plus pure integrity checking of that model against workspace manifests. Four formats, one model, no IO and no external runtime dependencies.

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

## Why @effected/lockfiles

Every package manager writes its lockfile in a different dialect — JSONC for bun, JSON for npm, YAML for pnpm and yarn — and each encodes packages, workspace edges and integrity data differently. Tooling that wants to answer "which version of `typescript` is resolved here" ends up with four code paths and four sets of bugs. This package normalizes all four into one model, so the question is asked once regardless of which package manager produced the file.

Every entrypoint takes content as a **string**. The package performs no IO at all: reading files, finding workspace roots and detecting which package manager a repo uses belong to its consumers, and keeping them out means the parser is a pure function you can drive from a fixture, a network response or a git blob. Malformed input always exits through a typed error channel, never as a defect, and the two ways a lockfile can be unusable are distinct tags rather than one blurry `reason` string. Yarn support is Berry only, and that is enforced: classic v1 content fails typed instead of being mis-normalized into something that looks plausible.

## Install

```bash
npm install @effected/lockfiles @effected/jsonc @effected/npm @effected/semver @effected/yaml effect
```

```bash
pnpm add @effected/lockfiles @effected/jsonc @effected/npm @effected/semver @effected/yaml effect
```

Requires Node.js >=24.11.0. `effect` v4, `@effected/jsonc`, `@effected/npm`, `@effected/semver` and `@effected/yaml` are peer dependencies — the JSONC and YAML engines, the shared dependency-specifier vocabulary and the SemVer range checker all arrive through those siblings, so nothing outside `effect` and `@effected/*` reaches your tree. Package managers that install peers automatically will pull them in; add them to your manifest explicitly if yours does not.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

```ts
import { Lockfile, LockfileIntegrity, WorkspaceManifest } from "@effected/lockfiles";
import { Effect } from "effect";

declare const content: string; // lockfile text, read by the caller

const program = Effect.gen(function* () {
  // The only fallible boundary in the package.
  const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });

  // pnpm workspace packages come back keyed by importer path; rewrite them
  // once you have read the manifests. Total and pure — no error channel.
  const named = lockfile.withImporterNames(new Map([["packages/core", "@acme/core"]]));

  // Total lookups over the model.
  const versions = named.packagesNamed("typescript").map((p) => p.version);

  // Pure integrity checking — no Effect, no error channel, no IO.
  const report = LockfileIntegrity.compare(named, [
    WorkspaceManifest.make({ name: "@acme/core", dependencies: { lodash: "^4.17.0" } }),
  ]);

  return { versions, workspaces: named.workspacePackages.length, valid: report.valid };
});

Effect.runPromise(program).then(console.log);
// { versions: [...resolved typescript versions], workspaces: <count>, valid: true | false }
```

## Formats

`format` is a literal, and `filenameFor` / `fromFilename` map between the literal and the file on disk so a consumer that detected a package manager never has to hard-code a filename.

| Format | Filename | Dialect | Notes |
| ------ | -------- | ------- | ----- |
| `"bun"` | `bun.lock` | JSONC | Trusted dependencies preserved on `BunExtension` |
| `"npm"` | `package-lock.json` | JSON | `lockfileVersion` 3+ — v2 and older fail typed |
| `"pnpm"` | `pnpm-lock.yaml` | YAML | `lockfileVersion` 9+ — older fails typed. Catalogs preserved on `PnpmExtension`; see below |
| `"yarn"` | `yarn.lock` | YAML | Berry only — classic v1 fails typed |

### Supported lockfile versions

The gate is on the **lockfile format version**, which is the only version a lockfile records:

| Format | Minimum | Older input |
| ------ | ------- | ----------- |
| pnpm | `lockfileVersion` 9 | `LockfileParseError`, `stage: "validation"` |
| npm | `lockfileVersion` 3 | `LockfileParseError`, `stage: "validation"` |
| bun, yarn | not gated | — |

The `cause` is a structured `{ _tag: "UnsupportedLockfileVersion", format, lockfileVersion, minimumSupported, message }`, so a consumer can distinguish "your lockfile is too old" from "your lockfile is malformed" without parsing prose. `isUnsupportedLockfileVersion` is the exported predicate that narrows to it — discriminate on the tag, never on `message`, which is a summary rather than contract:

```ts
import { isUnsupportedLockfileVersion, Lockfile } from "@effected/lockfiles";
import { Effect } from "effect";

declare const content: string;

const program = Lockfile.parse(content, { format: "pnpm" }).pipe(
  Effect.catchTag("LockfileParseError", (error) =>
    isUnsupportedLockfileVersion(error.cause)
      ? Effect.fail(`lockfileVersion ${error.cause.lockfileVersion}; need ${error.cause.minimumSupported}+`)
      : Effect.fail("malformed lockfile"),
  ),
);
// a pre-v9 pnpm lockfile takes the first branch, a truncated one the second
```

`cause` stays an open channel deliberately: it carries whatever the delegated parsing engines throw, so declaring it as a closed union would present an open channel as an exhaustive one. The predicate is what makes narrowing it honest.

Older formats are rejected rather than parsed because they cannot answer the questions the model now asks: pre-v9 pnpm has no `snapshots:` section, and npm v1/v2 trees record no per-instance nesting, so both would decode into rows with no resolution data.

**Tested against** pnpm 11.22.0, npm 11.19.0, bun 1.3.14 and yarn 4.9.1 — a separate claim from the gate, and deliberately so. A lockfile does not record which package manager wrote it, and the mapping is many-to-one (pnpm 9, 10 and 11 all write format `9.0`), so no manager-version requirement could be enforced here even in principle.

## Errors

`Lockfile.parse` is the only fallible entrypoint, and it fails two ways.

| Tag | Means | Fields |
| --- | ----- | ------ |
| `LockfileParseError` | The content is not a valid lockfile of that format. | `format`, `stage` (`"syntax"` when the text itself did not parse, `"validation"` when it parsed but did not have the expected shape), `cause` (structural, never stringified) |
| `LockfileFramingError` | The text parsed, but no single lockfile document could be located in it. | `format`, `documents`, `reason` (`"noLockfileDocument"`, `"noImporters"`, `"unexpectedDocuments"`) |

The framing error exists because `pnpm-lock.yaml` is a YAML **stream**, not a YAML document. pnpm 11 writes a config-dependencies preamble ahead of the lockfile whenever a workspace uses `configDependencies`, so the file carries two documents — and the preamble declares `lockfileVersion`, `importers` and `packages` too, so a parser that reads only the first document gets a lockfile that *validates* and describes an empty workspace. That is a wrong answer shaped exactly like a right one. The rule here is positional and deterministic rather than a heuristic: pnpm composes the preamble as a prefix, so the lockfile is the **last** document. A stream carrying no lockfile document fails typed. It never degrades into an empty `Lockfile`.

yarn defines no document framing at all, so multi-document `yarn.lock` content fails with `"unexpectedDocuments"` rather than being silently truncated to its first document. Where a format states no rule, this package refuses to guess.

## Instances and resolution

A row in `lockfile.packages` is one package **instance**, not one package. A dependency installed twice under different peers is two rows, and `instanceId` is that row's lockfile-native identity, carried verbatim. Treat it as **opaque**: look an id up in the model, never split or pattern-match one, because its spelling is the format's business and differs per manager.

`resolved` maps each dependency name — and each peer name the lockfile records a resolution for — to the `instanceId` it actually resolved to, which is what lets a consumer walk the real graph rather than re-resolving ranges itself. `peerDependencies` and `peerDependenciesMeta` carry the declarations as written, defaulting to `{}`.

```ts
import { Option } from "effect";

const [instance] = lockfile.packagesNamed("react-dom");
const reactId = instance?.resolved["react"];
const react = reactId === undefined ? Option.none() : lockfile.packageByInstanceId(reactId);
// Option.some(ResolvedPackage) — the version this particular react-dom instance resolved to
// Option.none() when the lockfile records no row under that id
```

`packageByInstanceId` is the lookup to reach for rather than a scan over `lockfile.packages`: it builds its index lazily on first call and reuses it, so walking a graph edge by edge stays linear instead of quadratic. A repeated id resolves to the first row, so a malformed lockfile gives a stable answer rather than an iteration-order one.

`unresolvedEdges` names the edges the lockfile **records** but the model could not name. A name listed there is not absent — it is unanswered, so a missing `resolved` key must not be read as "nothing is there". A gate that cares about completeness checks that array before trusting an empty result.

## Features

- `Lockfile.parse(content, { format })` — the package's only fallible boundary; fails with `LockfileParseError` or `LockfileFramingError`.
- `Lockfile#withImporterNames(names)` — the pure second stage for pnpm: rewrites importer-path names and both ends of each dependency edge once the consumer has read the manifests.
- `Lockfile#packagesNamed(name)`, `Lockfile#packageByInstanceId(id)` (`Option`-answering, over a lazily built index) and `Lockfile#workspacePackages` — total lookups over the model.
- `LockfileFormat` with `filenameFor` / `fromFilename` — the format literal and its mapping to lockfile filenames.
- `LockfileIntegrity.compare(lockfile, manifests)` — total, pure integrity checking with no error channel; the report carries `valid`, `missingWorkspaces`, `extraWorkspaces` and `unsatisfiedConstraints`. Constraint checking is best-effort by design: `workspace:` / `link:` / `file:` specifiers and rows whose range does not parse as SemVer are skipped.
- `WorkspaceManifest` — the manifest input shape for integrity checking: a package name plus four optional dependency records. Deliberately a plain value rather than a strict manifest model, so consumers can derive it from anything.
- `ResolvedPackage` — one package *instance*: name, version, optional integrity hash, workspace flag and relative path, dependency map, the peer declarations (`peerDependencies`, `peerDependenciesMeta`), the opaque `instanceId`, the `resolved` name-to-instance map and the `unresolvedEdges` the model could not name.
- `isUnsupportedLockfileVersion` and the `UnsupportedLockfileVersion` type — the predicate that narrows a `LockfileParseError.cause` to a version-gate rejection, so "too old" and "malformed" are told apart on a tag rather than on prose.
- `WorkspaceDependency` — a `from`/`to` edge between workspace packages, with `depType` spelled in `@effected/npm`'s `DependencyField` vocabulary and its declared constraint.
- `PnpmExtension` and `BunExtension` — format-specific data such as pnpm catalogs and bun trusted dependencies, preserved on the model's optional `extension` field.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/lockfiles` 0.15.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Lab uses Effect collections and Record/Array helpers for parser indexes and edges, and returns HashMap with Option lookup and unspecified iteration order for config dependencies where upstream returns a native Map. (scratchpad/test/lockfiles/PnpmEnvLockfile.test.ts:340,457; Lockfile.test.ts instance identity and resolved edges; hostile.test.ts hostile keys; LockfileIntegrity.test.ts)
- **tagged-errors** — Lab represents unaccounted pnpm preamble causes as PnpmEnvPreambleError with a schema tag where upstream uses native Error, preserving validation stage and message text. (scratchpad/test/lockfiles/PnpmEnvLockfile.test.ts:213,230,237,409,416,420)
- **schema-first** — Lab derives shared, catalog, document and resolution payload types from schemas, uses LiteralKit for named domains and schema codecs for JSON formatting where upstream uses handwritten types, Schema.Literals and JSON serialization. (scratchpad/test/lockfiles/LockfileFormat.test.ts; roundtrip.property.test.ts codec round-trips; documents.test.ts document framing; hostile.test.ts:556; PnpmEnvLockfile.test.ts:213,230,409)
- **numeric-domains** — Lab rejects non-finite numeric versions at finite-schema boundaries and refines document-count schemas where upstream permits unrestricted numbers and either reports an unsupported version or stringifies it. (scratchpad/test/lockfiles/hostile.test.ts:505,518,531,543; documents.test.ts document framing; Lockfile.test.ts supported lockfile versions)
- **type-safety** — Lab proves lookup, record and integrity types with assertions, schema decoding and Option checks where upstream relies on unsafe type casts. (scratchpad/test/lockfiles/Lockfile.test.ts instance identity and resolved edges; roundtrip.property.test.ts:64,141,223; hostile.test.ts:28; PnpmEnvLockfile.test.ts:303)
- **tsgo-diagnostics** — Lab adds pipeable dual overloads, requires three data-first peerDeclarations arguments and exposes SchemaError for malformed npm JSON where upstream uses fixed-arity helpers and preserves JSON.parse throwables, while adopting make and schema-safe checks. (scratchpad/test/lockfiles/importers.test.ts:185,197,209; hostile.test.ts:579; documents.test.ts:357; roundtrip.property.test.ts:101,246; module suite scratchpad/test/lockfiles/**)
- **effect-first** — Lab uses Effect.fn/fnUntraced, exhaustive Match dispatch and Option helpers where upstream uses ordinary generator-returning functions, switch dispatch and conditional spreads. (module suite scratchpad/test/lockfiles/**; scratchpad/test/lockfiles/importers.test.ts:218)
- **effect-imports** — Lab imports Effect APIs from dedicated effect/Module paths in source, tests and affected examples where upstream uses the root effect barrel. (module suite scratchpad/test/lockfiles/**)
- **identity-annotations** — Lab gives public and internal schemas composer identities and descriptive field/schema annotations where upstream uses bare identifiers and unannotated fields. (module suite scratchpad/test/lockfiles/**)
- **upstream-bug** — Lab rejects incomplete or wrongly formatted unsupported-version causes where the upstream guard accepts records whose promised fields cannot safely be accessed. (scratchpad/test/lockfiles/Lockfile.test.ts:1600,1638,1656)
- **upstream-bug** — Lab preserves recursive and version-scoped Bun override records and rejects malformed leaves where upstream rejects every nested override. (scratchpad/test/lockfiles/Lockfile.test.ts:272,286)

### Dependency backlog

None.
