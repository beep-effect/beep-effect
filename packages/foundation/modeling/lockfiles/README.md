# @beep/lockfiles

Lockfile parsing for [Effect](https://effect.website) v4: bun (`bun.lock`), npm (`package-lock.json`), pnpm (`pnpm-lock.yaml`) and yarn Berry (`yarn.lock`) all normalized into one `Lockfile` schema model, plus pure integrity checking of that model against workspace manifests. Four formats, one model, no IO and no third-party runtime dependencies (the JSONC and YAML engines are `@beep/jsonc` and `@beep/yaml`).

## Why this package

Every package manager writes its lockfile in a different dialect — JSONC for bun, JSON for npm, YAML for pnpm and yarn — and each encodes packages, workspace edges and integrity data differently. Tooling that wants to answer "which version of `typescript` is resolved here" ends up with four code paths and four sets of bugs. This package normalizes all four into one model, so the question is asked once regardless of which package manager produced the file.

Every entrypoint takes content as a **string**. The package performs no IO at all: reading files, finding workspace roots and detecting which package manager a repo uses belong to its consumers, and keeping them out means the parser is a pure function you can drive from a fixture, a network response or a git blob. Malformed input always exits through a typed error channel, never as a defect, and the two ways a lockfile can be unusable are distinct tags rather than one blurry `reason` string. Yarn support is Berry only, and that is enforced: classic v1 content fails typed instead of being mis-normalized into something that looks plausible.

## Usage

### Parse, name and check

```ts
import { Lockfile } from "@beep/lockfiles/Lockfile";
import { LockfileIntegrity, WorkspaceManifest } from "@beep/lockfiles/LockfileIntegrity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";

const content = "lockfileVersion: '9.0'\nimporters:\n  packages/core: {}";
const program = Effect.gen(function* () {
  // The only fallible boundary in the package; the caller supplies the text.
  const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });

  // pnpm workspace packages come back keyed by importer path; rewrite them
  // once you have read the manifests. Total and pure — no error channel.
  const named = lockfile.withImporterNames(HashMap.make(["packages/core", "@acme/core"]));

  // Total lookups over the model.
  const versions = A.map(named.packagesNamed("typescript"), (p) => p.version);

  // Pure integrity checking — no Effect, no error channel, no IO.
  const report = LockfileIntegrity.compare(named, [
    WorkspaceManifest.make({ name: "@acme/core", dependencies: { lodash: "^4.17.0" } }),
  ]);
  return { versions, workspaces: named.workspacePackages.length, valid: report.valid };
});

const result = Effect.runSync(program);
console.log(result.versions.length, result.workspaces, result.valid); // 0 1 true
```

### Formats

`format` is a literal, and `filenameFor` / `fromFilename` map between the literal and the file on disk so a consumer that detected a package manager never has to hard-code a filename.

| Format | Filename | Dialect | Notes |
| ------ | -------- | ------- | ----- |
| `"bun"` | `bun.lock` | JSONC | Trusted dependencies preserved on `BunExtension` |
| `"npm"` | `package-lock.json` | JSON | `lockfileVersion` 3+ — v2 and older fail typed |
| `"pnpm"` | `pnpm-lock.yaml` | YAML | `lockfileVersion` 9+ — older fails typed. Catalogs preserved on `PnpmExtension`; see below |
| `"yarn"` | `yarn.lock` | YAML | Berry only — classic v1 fails typed |

#### Supported lockfile versions

The gate is on the **lockfile format version**, which is the only version a lockfile records:

| Format | Minimum | Older input |
| ------ | ------- | ----------- |
| pnpm | `lockfileVersion` 9 | `LockfileParseError`, `stage: "validation"` |
| npm | `lockfileVersion` 3 | `LockfileParseError`, `stage: "validation"` |
| bun, yarn | not gated | — |

The `cause` is a structured `{ _tag: "UnsupportedLockfileVersion", format, lockfileVersion, minimumSupported, message }`, so a consumer can distinguish "your lockfile is too old" from "your lockfile is malformed" without parsing prose. `isUnsupportedLockfileVersion` is the exported predicate that narrows to it — discriminate on the tag, never on `message`, which is a summary rather than contract:

```ts
import { isUnsupportedLockfileVersion } from "@beep/lockfiles/UnsupportedLockfileVersion";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import * as Effect from "effect/Effect";

const content = "lockfileVersion: '8.0'\nimporters:\n  .: {}";
const program = Lockfile.parse(content, { format: "pnpm" }).pipe(
  Effect.catchTag("LockfileParseError", (error) =>
    isUnsupportedLockfileVersion(error.cause)
      ? Effect.fail("lockfileVersion " + error.cause.lockfileVersion + "; need " + error.cause.minimumSupported + "+")
      : Effect.fail("malformed lockfile"),
  ),
);
// A pre-v9 pnpm lockfile takes the first branch, a truncated one the second.
console.log(Effect.runSync(Effect.flip(program))); // lockfileVersion 8.0; need 9+
```

`cause` stays an open channel deliberately: it carries whatever the delegated parsing engines throw, so declaring it as a closed union would present an open channel as an exhaustive one. The predicate is what makes narrowing it honest.

Older formats are rejected rather than parsed because they cannot answer the questions the model now asks: pre-v9 pnpm has no `snapshots:` section, and npm v1/v2 trees record no per-instance nesting, so both would decode into rows with no resolution data.

**Tested against** pnpm 11.22.0, npm 11.19.0, bun 1.3.14 and yarn 4.9.1 — a separate claim from the gate, and deliberately so. A lockfile does not record which package manager wrote it, and the mapping is many-to-one (pnpm 9, 10 and 11 all write format `9.0`), so no manager-version requirement could be enforced here even in principle.

### Errors

`Lockfile.parse` is the only fallible entrypoint, and it fails two ways.

| Tag | Means | Fields |
| --- | ----- | ------ |
| `LockfileParseError` | The content is not a valid lockfile of that format. | `format`, `stage` (`"syntax"` when the text itself did not parse, `"validation"` when it parsed but did not have the expected shape), `cause` (structural, never stringified) |
| `LockfileFramingError` | The text parsed, but no single lockfile document could be located in it. | `format`, `documents`, `reason` (`"noLockfileDocument"`, `"noImporters"`, `"unexpectedDocuments"`) |

The framing error exists because `pnpm-lock.yaml` is a YAML **stream**, not a YAML document. pnpm 11 writes a config-dependencies preamble ahead of the lockfile whenever a workspace uses `configDependencies`, so the file carries two documents — and the preamble declares `lockfileVersion`, `importers` and `packages` too, so a parser that reads only the first document gets a lockfile that *validates* and describes an empty workspace. That is a wrong answer shaped exactly like a right one. The rule here is positional and deterministic rather than a heuristic: pnpm composes the preamble as a prefix, so the lockfile is the **last** document. A stream carrying no lockfile document fails typed. It never degrades into an empty `Lockfile`.

yarn defines no document framing at all, so multi-document `yarn.lock` content fails with `"unexpectedDocuments"` rather than being silently truncated to its first document. Where a format states no rule, this package refuses to guess.

### Instances and resolution

A row in `lockfile.packages` is one package **instance**, not one package. A dependency installed twice under different peers is two rows, and `instanceId` is that row's lockfile-native identity, carried verbatim. Treat it as **opaque**: look an id up in the model, never split or pattern-match one, because its spelling is the format's business and differs per manager.

`resolved` maps each dependency name — and each peer name the lockfile records a resolution for — to the `instanceId` it actually resolved to, which is what lets a consumer walk the real graph rather than re-resolving ranges itself. `peerDependencies` and `peerDependenciesMeta` carry the declarations as written, defaulting to `{}`.

```ts
import { Lockfile } from "@beep/lockfiles/Lockfile";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

const content = '{"lockfileVersion":3,"packages":{"node_modules/react-dom":{"version":"18.3.1","dependencies":{"react":"18.3.1"}},"node_modules/react":{"version":"18.3.1"}}}';
const lockfile = Effect.runSync(Lockfile.parse(content, { format: "npm" }));
const [instance] = lockfile.packagesNamed("react-dom");
const reactId = instance?.resolved["react"];
const react = reactId === undefined ? O.none() : lockfile.packageByInstanceId(reactId);
// Some identifies the version this particular react-dom instance resolved to.
// None means the lockfile records no row under that id.
console.log(O.getOrUndefined(react)?.version); // 18.3.1
```

`packageByInstanceId` is the lookup to reach for rather than a scan over `lockfile.packages`: it builds its index lazily on first call and reuses it, so walking a graph edge by edge stays linear instead of quadratic. A repeated id resolves to the first row, so a malformed lockfile gives a stable answer rather than an iteration-order one.

`unresolvedEdges` names the edges the lockfile **records** but the model could not name. A name listed there is not absent — it is unanswered, so a missing `resolved` key must not be read as "nothing is there". A gate that cares about completeness checks that array before trusting an empty result.

## Features

- `Lockfile.parse(content, { format })` — the package's only fallible boundary; fails with `LockfileParseError` or `LockfileFramingError`.
- `Lockfile#withImporterNames(names)` — the pure second stage for pnpm: rewrites importer-path names and both ends of each dependency edge once the consumer has read the manifests.
- `Lockfile#packagesNamed(name)`, `Lockfile#packageByInstanceId(id)` (`Option`-answering, over a lazily built index) and `Lockfile#workspacePackages` — total lookups over the model.
- `Lockfile#rootPackage(name)` — the instance the workspace root resolves `name` to, read the way each format records it (bun's bare key, npm's `node_modules/<name>`, pnpm's root importer; `None` for yarn).
- `LockfileFormat` with `filenameFor` / `fromFilename` — the format literal and its mapping to lockfile filenames.
- `LockfileIntegrity.compare(lockfile, manifests)` — total, pure integrity checking with no error channel; the report carries `valid`, `missingWorkspaces`, `extraWorkspaces` and `unsatisfiedConstraints`. Constraint checking is best-effort by design: `workspace:` / `link:` / `file:` specifiers and rows whose range does not parse as SemVer are skipped.
- `WorkspaceManifest` — the manifest input shape for integrity checking: a package name plus four optional dependency records. Deliberately a plain value rather than a strict manifest model, so consumers can derive it from anything.
- `ResolvedPackage` — one package *instance*: name, the `alias` a bun or npm instance is installed under and the alias-aware `installName`, version, optional integrity hash, workspace flag and relative path, dependency map, the peer declarations (`peerDependencies`, `peerDependenciesMeta`), the opaque `instanceId`, the `resolved` name-to-instance map and the `unresolvedEdges` the model could not name.
- `isUnsupportedLockfileVersion` and the `UnsupportedLockfileVersion` type — the predicate that narrows a `LockfileParseError.cause` to a version-gate rejection, so "too old" and "malformed" are told apart on a tag rather than on prose.
- `WorkspaceDependency` — a `from`/`to` edge between workspace packages, with `depType` spelled in `@beep/npm-spec`'s `DependencyField` vocabulary and its declared constraint.
- `PnpmExtension` (with `PnpmCatalogPin`) and `BunExtension` — format-specific data such as pnpm catalogs and bun trusted dependencies, preserved on the model's optional `extension` field.
- `PnpmEnvLockfile` — the pnpm 11+ env preamble reader (pinned package manager and config dependencies).
- `@beep/lockfiles/internal/*` — the per-format parsers and shared helpers, exported for tests and adopters (D-15); not a stable surface.

## Development

```sh
# from the repository root
bun run beep quality package-verify @beep/lockfiles

# from packages/foundation/modeling/lockfiles
bun run test
bun run check
```

The suites read the frozen captures in `test/fixtures/` (each lockfile carries an inert `.fixture` suffix; `test/fixtures/README.md` records their provenance and `digests.json` their bytes) through `import.meta.glob`, so no test reads the filesystem or the repo's own lockfile. The live comparison against the repo's `bun.lock` and `bun pm ls --all` is an ops script outside the package: `bun goals/effected-promotion/ops/lockfiles-oracle.ts`. Parse and `withImporterNames` timings are `goals/effected-promotion/ops/lockfiles-bench.ts`.

## Provenance

Ported from upstream `@effected/lockfiles` (MIT, C. Spencer Beggs) through the effected port, which landed it in the scratchpad module `scratchpad/effected/lockfiles` (last held at `f72d38e17dc896f23976707e4f39298bc6cdbdc2`). Wave 3-5 of `goals/effected-promotion` then promoted it into this package. The promotion moved the sources to `src/`, the tests to `test/` and the fixtures to `test/fixtures/`, and renamed the schema identities from `@beep/scratchpad/effected/lockfiles/<Name>` to `@beep/lockfiles/<Name>`. It also made the changes listed under Deviations. The lab review rounds and canon exceptions are archived under `goals/effected-promotion/history/`.

### Attribution

- Upstream package: `@effected/lockfiles` 0.15.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`~/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (MIT; beep-effect and upstream notices)
- Vendored-engine notices: none found in source headers.

### Added exports

- `PnpmCatalogPin`: the named catalog-entry schema behind `PnpmExtension.catalogs`, added in the promotion so the record is a branded `S.Opaque` value.
- `ResolvedPackage#withName`, `WorkspaceDependency#withEndpoints`, `LockfileImporter#dependency`: instance members added in the promotion (see Deviations).
- `ResolvedPackage.alias`, `ResolvedPackage#installName` and `Lockfile#rootPackage`: added by the first repo-cli adoption (3-A1), whose bun.lock readers needed the install name of an npm alias and the root's resolved instance. `rootPackage` reads pnpm through `LockfileImporter#dependency`. bun and npm record `alias`; pnpm and yarn key an instance by real name and record an alias only on the dependency edge, so their instances carry none.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence. The lab ledger rows hold the full upstream and port behaviour for the port-era entries.

Promotion (wave 3-5):

- **schema-first** — the plain-data records are branded `S.Opaque` structs built with `X.make`, which copies its input: compare them structurally, never with `===`. That covers `ImporterDependency`, `PackageManagerLock`, `ConfigDependencyLock`, `WorkspaceManifest`, `BunExtension`, `PnpmExtension`, `PnpmCatalogPin`, `LockfileIntegrity` (which keeps its static `compare`) and the internal records. A rewritten lockfile's `extension` is therefore deep-equal to the receiver's, not identical (`Lockfile.coverage.test.ts`), and the env reader's records are checked with `S.is` (`PnpmEnvLockfile.test.ts`).
- **performance** — `ResolvedPackage`, `WorkspaceDependency` and `LockfileImporter` stay `S.Class`. Made Opaque, they cost `withImporterNames` +889% on the repo's `bun.lock` (0.96 ms to 8.2 ms), because the one `Lockfile.make` then re-validates every package structurally where a class schema checks `instanceof`. Their behaviour moved onto them as instance members (`withName`, `withEndpoints`, `dependency`); `dependency` has no src or adopter caller yet, and 3-A1 adopts or replaces it. Each `parse` and each `withImporterNames` admits the lockfile through exactly one `Lockfile.make`; `Lockfile` keeps its three lazy indexes.
- **effect-string** — string, array and record operations go through `effect/String`, `effect/Array` and `effect/Record`; key splitting shares named helpers in `internal/shared.ts`, and the four `toFields` parsers are decomposed under the complexity ceiling.
- **option-returns** — internal helpers return `Option` instead of `null`/`undefined`: `splitNameVersion`, `toIntegrityHash` (an `Effect` of `Option`), `readPnpmPackageManager` and the yarn and pnpm path helpers.
- **test-environment** — the fixtures are read through `import.meta.glob` (`?raw`, eager), and the digest guard hashes with `JsoncFingerprint.hashText` on a WebCrypto `Crypto` layer, so no test imports `node:fs` or `node:crypto` and the four archived EV010 exceptions are cleared.

Adoption (3-A1):

- **upstream-bug** — The lab names an npm `node_modules/*` instance by the real `name` its entry records, keeping the install position as `alias`, where upstream names it by install position and drops the recorded name, so `packagesNamed` missed an `npm:` alias under its real name (packages/foundation/modeling/lockfiles/test/rootPackage.test.ts:224).
- **upstream-bug** — The lab skips a bun `packages` row whose key ends in `/` (no install name) as malformed, matching the npm parser's skip of an empty `node_modules/` install name, where upstream keeps the row (packages/foundation/modeling/lockfiles/test/rootPackage.test.ts:212).

Carried from the port:

- **native-runtime** — Lab uses Effect collections and Record/Array helpers for parser indexes and edges, and returns HashMap with Option lookup and unspecified iteration order for config dependencies where upstream returns a native Map. (packages/foundation/modeling/lockfiles/test/PnpmEnvLockfile.test.ts:340,457; Lockfile.test.ts instance identity and resolved edges; hostile.test.ts hostile keys; LockfileIntegrity.test.ts)
- **tagged-errors** — Lab represents unaccounted pnpm preamble causes as PnpmEnvPreambleError with a schema tag where upstream uses native Error, preserving validation stage and message text. (packages/foundation/modeling/lockfiles/test/PnpmEnvLockfile.test.ts:213,230,237,409,416,420)
- **schema-first** — Lab derives shared, catalog, document and resolution payload types from schemas, uses LiteralKit for named domains and schema codecs for JSON formatting where upstream uses handwritten types, Schema.Literals and JSON serialization. (packages/foundation/modeling/lockfiles/test/LockfileFormat.test.ts; roundtrip.property.test.ts codec round-trips; documents.test.ts document framing; hostile.test.ts:556; PnpmEnvLockfile.test.ts:213,230,409)
- **numeric-domains** — Lab rejects non-finite numeric versions at finite-schema boundaries and refines document-count schemas where upstream permits unrestricted numbers and either reports an unsupported version or stringifies it. (packages/foundation/modeling/lockfiles/test/hostile.test.ts:505,518,531,543; documents.test.ts document framing; Lockfile.test.ts supported lockfile versions)
- **type-safety** — Lab proves lookup, record and integrity types with assertions, schema decoding and Option checks where upstream relies on unsafe type casts. (packages/foundation/modeling/lockfiles/test/Lockfile.test.ts instance identity and resolved edges; roundtrip.property.test.ts:64,141,223; hostile.test.ts:28; PnpmEnvLockfile.test.ts:303)
- **tsgo-diagnostics** — Lab adds pipeable dual overloads, requires three data-first peerDeclarations arguments and exposes SchemaError for malformed npm JSON where upstream uses fixed-arity helpers and preserves JSON.parse throwables, while adopting make and schema-safe checks. (packages/foundation/modeling/lockfiles/test/importers.test.ts:185,197,209; hostile.test.ts:579; documents.test.ts:357; roundtrip.property.test.ts:101,246; module suite packages/foundation/modeling/lockfiles/test/**)
- **effect-first** — Lab uses Effect.fn/fnUntraced, exhaustive Match dispatch and Option helpers where upstream uses ordinary generator-returning functions, switch dispatch and conditional spreads. (module suite packages/foundation/modeling/lockfiles/test/**; packages/foundation/modeling/lockfiles/test/importers.test.ts:218)
- **effect-imports** — Lab imports Effect APIs from dedicated effect/Module paths in source, tests and affected examples where upstream uses the root effect barrel. (module suite packages/foundation/modeling/lockfiles/test/**)
- **identity-annotations** — Lab gives public and internal schemas composer identities and descriptive field/schema annotations where upstream uses bare identifiers and unannotated fields. (module suite packages/foundation/modeling/lockfiles/test/**)
- **upstream-bug** — Lab rejects incomplete or wrongly formatted unsupported-version causes where the upstream guard accepts records whose promised fields cannot safely be accessed. (packages/foundation/modeling/lockfiles/test/Lockfile.test.ts:1600,1638,1656)
- **upstream-bug** — Lab preserves recursive and version-scoped Bun override records and rejects malformed leaves where upstream rejects every nested override. (packages/foundation/modeling/lockfiles/test/Lockfile.test.ts:272,286)
- **native-runtime** — The lab accepts an Effect HashMap for withImporterNames where upstream accepts a native ReadonlyMap, preserving name-rewrite behavior (packages/foundation/modeling/lockfiles/test/Lockfile.test.ts:395; packages/foundation/modeling/lockfiles/test/Lockfile.coverage.test.ts:40).
- **upstream-bug** — The lab uses fallback workspace metadata for absent npm constructor targets where upstream fabricates Object metadata, while retaining own-target metadata (packages/foundation/modeling/lockfiles/test/internal/npm.coverage.test.ts:27,34).
- **upstream-bug** — The lab skips unmodeled npm targets and continues ancestor resolution where upstream can emit dangling resolved edges (packages/foundation/modeling/lockfiles/test/internal/npm.coverage.test.ts:41).
- **upstream-bug** — The lab marks unmodeled root and skipped pnpm targets unresolved where upstream emits dangling resolved edges, retaining valid alias and workspace targets (packages/foundation/modeling/lockfiles/test/internal/pnpm.coverage.test.ts:20; packages/foundation/modeling/lockfiles/test/Lockfile.test.ts:1066).
- **upstream-bug** — The lab resolves bun edges only to emitted identities where upstream can select malformed or suppressed tuple rows, retaining ancestor precedence and workspace identities (packages/foundation/modeling/lockfiles/test/internal/bun.coverage.test.ts:23).
- **upstream-bug** — Lab Yarn parsing records indexed targets without emitted package instances as unresolved, while upstream emits dangling resolved edges; aliases to emitted locators retain upstream behavior (packages/foundation/modeling/lockfiles/test/internal/yarn.coverage.test.ts:12,27,42).

### Dependency backlog

None.

## License

[MIT](LICENSE)
