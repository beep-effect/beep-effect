# package-json — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/package-json/CLAUDE.md -->
# @effected/package-json

package.json parsing, editing, validation and file IO as Effect schemas —
boundary tier. **One module per concept in `src/`**; the consolidation is the
point, do not re-fragment it. Everything exports from `src/index.ts` (single
entry point, no barrel re-exports below it) — read it for the inventory of
what each module owns.

## Knowledge bundle

Durable knowledge lives under `okf/`; `okf/project.md` is authoritative on the
package roster. Load the concept a task needs:

- `okf/modules/package-json.md` — Load when: changing the public surface, the
  tier or dependency posture, the module layout, the `rest` wire transform and
  `.extend()` story, wire provenance and the guarded replay, `Funding`,
  `Repository.directoryUrl`, `PackageManager` versus `PackageManagerRange`
  (its `packageManager` and `devEngines.packageManager` readers and three
  renderings), the error set, `PackageJsonFile`, or the Effect-wrapping policy.
- `okf/decisions/package-json-tolerance-ladder.md` — Load when: choosing
  between `Package`, `PackageManifest`, `LenientManifest`, npm's `Manifest`
  and the text path, or adding a tier.
- `okf/interfaces/package-json-text.md` — Load when: working on the decode-free
  text path — `PackageJsonFormat`'s canonical key order, `PackageIndent` /
  `"preserve"`, the surgical `modify` mutator, or re-baselining the
  `sort-package-json` fixtures.
- `okf/interfaces/package-json-entry-point.md` — Load when: touching
  `resolveEntryPoint`, its condition policy, or the `exports`-encapsulation
  rule.
- `okf/invariants/package-manager-shares-strict-schemas-by-identity.md` — Load
  when: touching `PackageManager`'s `version` or `integrity` field or the
  identity assertions that pin them.
- `okf/decisions/spdx-delegation.md` — Load when: touching `License.ts` or
  asking why `UNLICENSED` / `SEE LICENSE IN` live here and not in
  `@effected/spdx`.
- `okf/decisions/format-naming.md`, `okf/conventions/format-package-convention.md`
  — Load when: naming or shaping a formatter static.
- `okf/gotchas/api-extractor-forgotten-export-on-class-factories.md` — Load
  when: a build reports `ae-forgotten-export`; `savvy.build.ts` carries a
  **narrow** `_base` suppression — never widen it.

`Package.resolve` expands `catalog:` / `workspace:` specifiers through the
`CatalogResolver` / `WorkspaceResolver` contracts owned by `@effected/npm`
(`okf/modules/npm.md`); `PackageJsonFile.write` never resolves — compose
`Package.resolve` explicitly.

## Operating rules

- All IO lives in `src/PackageJsonFile.ts`; every other module is pure. If a
  change wants to read or write, route it through `PackageJsonFile` or leave
  it to the caller.
- `Schema.Class` instances are not `Pipeable` in v4; `Package` hand-rolls the
  `pipe` overload block. Preserve it.
- Never run an Effect inside a getter — decode via `Schema.decodeUnknownExit`.
- A new wire-provenance replay branch is presumed unguarded until a
  mutate-in-place round-trip test says otherwise; the string branch needs its
  own such test.
- `package.json` stays `"private": true`; the bundler emits the publishable
  manifest.

## Test and build

```bash
pnpm vitest run packages/package-json          # this package's tests
pnpm build --filter @effected/package-json     # from the repo root
```

Tests live in `__test__/` (`integration/*.int.test.ts` for `PackageJsonFile`),
use `@effect/vitest`, and assert with `assert.*` — **never `expect`**. Never
run `node savvy.build.ts --target prod` directly.


---
<!-- okf/modules/package-json.md -->
---
type: Module
title: package-json
description: package.json parsing, editing, validation and file IO as Effect schemas — the kit's boundary-tier manifest library and its reference for pure/IO separation.
status: stable
kind: package
resource: ../../packages/package-json
tags:
  - dx
  - architecture
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T06:20:52Z
  body_sha256: 68ab8d3520cae816d68b4477e423396925babeb542cbc2aff362f050c8237e4f
---

# package-json

## Purpose

`@effected/package-json` is package.json parsing, editing, validation and file IO as Effect schemas. The rich `Package` `Schema.Class` is the domain model: computed getters, immutable-mutation statics, a round-trip-fidelity `rest` catch-all and semantic field decoding. All IO is confined to a single module, `PackageJsonFile.ts`.

## Tier and dependency posture

Boundary tier, set by the file IO in `PackageJsonFile.ts` and nothing more — the package carries no third-party runtime dependency outside `effect` core. Its `@effected` edges (`@effected/npm`, `@effected/semver`, `@effected/spdx`, `@effected/jsonc`, all `workspace:^`) are to pure and boundary packages, and the dependency policy's tier propagation applies only to tier-3 (integrated) edges, so none of them lifts this package's tier.

`effect` is the only peer — there is no `@effect/platform` peer, because `FileSystem` and `Path` live in core. `@effect/platform-node` stays a devDependency for integration tests that provide a real filesystem; consumers of the file API supply their own platform implementation at the edge. The IO is deliberately not split into its own package: in v4 the motivation for that split evaporates, since platform abstractions already live in core, so a hypothetical fs-only package would carry the identical peer closure as the whole package does now, and `"sideEffects": false` already lets bundlers tree-shake the fs code out of pure usage.

Core SPDX license validity is delegated to [`@effected/spdx`](spdx.md); see [the SPDX-delegation decision](../decisions/spdx-delegation.md).

## Module layout

Module-per-concept, one class or concept per file:

- `Package.ts` — the core model, the wire transform and `.extend()` story, and the reusable `@public` field codecs.
- `PackageManifest.ts` and `LenientManifest.ts` — the two more permissive tiers; see [the tolerance ladder](#the-tolerance-ladder).
- The leaf concepts: `PackageName.ts`, `License.ts`, `PackageManager.ts`, `PackageManagerRange.ts` (with `InvalidPackageManagerRangeError`), `Person.ts`, `Repository.ts` (holding both `Repository` and `Bugs`, since they share the shorthand-or-object encoding and the wire-provenance machinery), `Funding.ts`, `DevEngines.ts`, `Dependency.ts`.
- `PackageValidator.ts` — the validation service, its rule interface, the default rule set and a parameterized layer factory.
- `PackageJsonFile.ts` — the only IO module: one service, read/write over core `FileSystem`/`Path`, plus its error tags.
- `EntryPoint.ts` — entry-point resolution, pure and IO-free, and the one module whose input is deliberately structural rather than a `Package`. See [the entry-point resolver interface](../interfaces/package-json-entry-point.md).
- `PackageJsonFormat.ts` — the decode-free text seam: formatting and surgical edits, neither of which decodes. See [the decode-free text path interface](../interfaces/package-json-text.md).
- `internal/format.ts` — the pure canonical-key-order, map-alphabetizing and empty-map-stripping functions shared by the write options, the model's serializer and the format seam.
- `internal/wire.ts` — the `rest`-partitioning wire codec builder, shared by `Package` and `PackageManifest` so the two tiers cannot drift on what round-trips.

The package ships a single entry point; there is no `./schema` subpath. `DependencySpecifier` is not defined here — the specifier taxonomy lives in `@effected/npm`, because `@effected/lockfiles` is its second consumer — and `index.ts` re-exports it for surface compatibility, alongside `@effected/jsonc`'s `JsoncEdit`/`JsoncPath` since a caller applying `modify`'s edits needs them without declaring a jsonc edge of their own.

## Effect-wrapping policy

Pure synchronous where nothing can fail; `Effect` where the error channel is real, including all service IO; no `Effect.runSync` inside a getter, ever. Pure and synchronous: the computed getters, the specifier-taxonomy statics, the name predicates, the format functions and the serializer — absence is `Option` or a plain optional field, never a wrapping `Effect`. `Effect`: the mutation statics that validate, `Package.resolve`, decode-from-unknown, and every file and validator operation. Range detection inside the specifier taxonomy decodes semver's range codec purely via `Schema.decodeUnknownExit` plus an exit check, so no effect runs inside a getter even at that one sharp edge.

## Package

The `Package` `Schema.Class` carries: computed getters over privacy, scoping, module format and dependency lookup; immutable mutation statics using the dual-signature idiom (`Function.dual`, so data-first, curried and pipeable call styles all work); `copyWith`, taking a patch type derived from the fields rather than a hand-maintained partial that silently omits half of them; `resolve` — the static-with-`R` that turns `catalog:` and `workspace:` specifiers into concrete ranges from resolver services in context, the one place the pure model reaches into DI, deliberately not fused into `write`; `rest`, the catch-all preserving unknown top-level fields across a read/edit/write cycle; and `toJsonString`, the pure serialization path, reachable independent of the writer.

`publishConfig` is modeled as an open `Schema.Record` rather than a typed open struct, because a typed open struct does not annotate cleanly for a zero-warning `issues.json`; round-trip fidelity is fully preserved, and the only cost is that typed field access is dropped. `v4 Schema.Class` instances are not `Pipeable` out of the box, so `Package` retains a manual `pipe` overload block.

## Leaf concepts

**`PackageName`** brands the npm name grammar with scoped and unscoped refinements, written with lookahead-free regexes so `Schema.toArbitrary` property tests derive; its statics attach via `Object.assign` since a `const` and a `namespace` cannot merge in TypeScript. The locally owned branded types — `ScopedPackageName`, `UnscopedPackageName` and `SpdxLicense` — export as `string & Brand.Brand<"…">`, never as `typeof X.Type`, so the built `.d.ts` names a readable brand rather than an inlined schema projection; `DependencySpecifierBrand` follows the same shape but is defined in `@effected/npm` and only re-exported here.

**`SpdxLicense`** (in `License.ts`) validates the `license` field, delegating core SPDX-expression validity to `@effected/spdx` and keeping only the npm-specific `UNLICENSED` and `SEE LICENSE IN <file>` cases, which are npm semantics rather than SPDX grammar — see [the SPDX-delegation decision](../decisions/spdx-delegation.md). A branded `SpdxLicense` is therefore not necessarily parseable as SPDX, and `licenseExpressionOf(license) => Option<SpdxExpression>` is the accessor for turning a branded value into an actual expression when one is needed, yielding `none` for a spelling that is not an expression. The implementation deliberately contains no screen for npm's two special cases: the SPDX grammar already declines both, so discarding the parse failure is the screen, and the day npm admits a third special case the grammar answers "not an expression" for it too with no change here.

**`PackageManager`** parses corepack's `<name>@<version>[+<integrity>]` triple. Both strict halves are shared by identity with the packages that own them rather than re-derived: the version field is `@effected/semver`'s `SemVer.PinnableVersionString`, and integrity is `@effected/npm`'s `CorepackIntegrityHash`. That sharing is runtime-asserted by identity, not by source text, because a `Schema.check` is erased from the built `.d.ts` and severing either schema would be neither a type error nor a compile-time-visible break — see [the identity invariant](../invariants/package-manager-shares-strict-schemas-by-identity.md). The name grammar is the one place this model and npm's pin diverge, deliberately: the field model keeps any lowercase name (manifests as they exist in the wild), while the pin closes the set to four (the kit's own provisioning vocabulary) — corepack itself recognizes only three names and would reject the very real `bun@…`, and npm documents no constraint on this field.

**`Person`** parses the `"Name <email> (url)"` shorthand into structured fields and encodes back. **`Repository` and `Bugs`** accept npm's string-or-object encodings; `Bugs.url` is optional because an email-only entry is legal, while a model requiring a URL would reject valid manifests. `homepage` is a plain string with nothing to model.

**`Dependency`** is one class with a `kind` field rather than four near-identical tagged classes, so the protocol getters are written once and delegate to npm's specifier taxonomy.

### Repository carries the reference verbatim

`Repository` holds the reference verbatim and exposes normalization as derived getters, so reading a manifest never rewrites the field and a caller that wants a link asks for one explicitly. `directoryUrl` descends `browseUrl` into `directory` for the monorepo-member case: with no `directory`, `directoryUrl` is `browseUrl` (a correct answer, not a missing one); with `directory` on a known host (GitHub's `tree/HEAD`, GitLab's `-/tree/HEAD`, Bitbucket's `src/HEAD`), it is the descended URL, using `HEAD` because the default branch is not knowable from a manifest and every one of these hosts resolves `HEAD` to it; with `directory` on any other host, or one containing `..`, it answers `Option.none()` rather than fabricating a path for an unrecognized forge — what to do with that `none` is left to the caller, since falling back to `browseUrl` is reasonable in some contexts and wrong in others.

### Wire provenance, and why the replay is guarded

`Person`, `Repository`, `Bugs` and `Funding` each remember the exact wire value the instance decoded from, in a `WeakMap`, and replay it on encode for byte-level fidelity. The replay must be guarded on the value still matching its provenance: `Schema.Class` instances are not frozen at runtime, so an instance mutated in place keeps a provenance entry that no longer describes it, and an unguarded replay would silently write the original value back, discarding the edit. Every class guards every replay branch — shorthand string and object alike. Two lessons carry it: a guard on one branch is not a guard (the object branch is the boring one and is where an unguarded replay hides), and every replay branch needs its own mutate-in-place test, because a test that rebuilds the value with a spread cannot reach the replay path at all.

**Provenance keys must be leaf instances, never rebuilt containers.** A `decodeTo` target of `Schema.Array(...)` or `Schema.Struct(...)` does not preserve the object identity the transform returned — the container is rebuilt on the way out — so a `WeakMap`/`WeakSet` keyed on it is empty by the time `encode` runs, with no error or warning, just a fidelity guarantee that silently degrades to the canonical form. `Funding` is the worked example: the field's arity provenance (was this written bare, or as an array?) rides the single entry that was the field, never the decoded array. An edited shorthand re-emits as a shorthand; the object form is the fallback only when the shorthand genuinely cannot carry the value, because shape fidelity is the promise and data fidelity outranks it only in the one case where they conflict — one predicate decides both, deliberately, so a person cannot be refused the replay yet handed back as a shorthand that silently drops the very keys the refusal detected.

### Funding

npm's `funding` field accepts a bare URL string, an object with `url` and an optional `type`, or an array mixing either; the model normalizes the **read** side only, so `Funding.FromField` always decodes to an array and no consumer branches on arity. The **write** side is deliberately not normalized: a lone entry read bare re-encodes bare, and an entry read from the string form re-encodes to that exact string, honoring the fidelity obligation that a formatter must not rewrite one legal encoding into another. `url` is required, unlike `Bugs.url` — the two look parallel and are not, since an email-only `bugs` entry is legal npm, while npm's funding object carries no other way to say where the money goes, so an entry without a url is a decode failure rather than a partially-populated value.

## The compliance field set

The modeled field set is scoped to every manifest field a named consumer's mapping reads, drawn first from `@effected/sbom`'s CycloneDX 1.6 plus NTIA-minimum-elements metadata-source mapping rather than a general sweep of npm's documentation: name, version, description, license, author, contributors, maintainers, keywords, repository, bugs, homepage, and — since a second mapping target appeared — `funding`. `funding` is the worked example of the scope rule: CycloneDX 1.6 has no funding external-reference type, so under the first mapping the field had no target and was excluded with its release condition recorded ("it earns its place the day a consumer names a target for it"); `tsdoctor` later named one (schema.org's `funding` property, emitted into a documented package's JSON-LD), so the field was modeled under the rule as written, not by relaxing it. The scope rule is "something consumes it," not "CycloneDX 1.6 or nothing" — a second mapping target is a legitimate way to satisfy it, and a recorded exclusion with a stated condition is what makes adding a field cheap later.

## The tolerance ladder

The kit's package.json tolerance ladder, strictest to most permissive, spans five surfaces that all read the same document:

- **`Package`** — strict, publishable: `name`/`version` required, every present field shape-validated against its npm grammar.
- **`PackageManifest`** — presence-lenient: fields may be absent (the private workspace-root shape), but a present field is still shape-validated exactly as strictly as `Package`'s. It relaxes exactly two things: `name` and `version` become optional, and `packageManager` decodes through `PackageManagerRange` instead of the exact pin.
- **`LenientManifest`** — shape-lenient discovery/sniffing: a present field that fails even its permissive shape check degrades to absence rather than failing the whole document — degradation granularity is the top-level field, and the malformed value is preserved verbatim in `rest` as though it were an unknown key — with the degradation recorded on `issues` as a `LenientFieldIssue`. The sync primitives are `decodeResult`/`parseResult`, with `Effect.fn`-spanned `decode`/`parse` derived from them; there are no mutation statics and no write path, and the upgrade path is re-decoding the original input through `PackageManifest.decode` or `Package.decode`. Leniency is per-field, never per-syntax: text that fails to `JSON.parse` fails typed as `PackageJsonSyntaxError`, and a parsed non-object value fails typed as `PackageDecodeError`. An empty `issues` array does not imply the strict tiers would accept the document — the permissive guards check JSON shape, not npm semantics (no SPDX validity, no semver grammar, no npm name grammar).
- **`@effected/npm`'s `Manifest`** — shape-blind outside the four dependency fields, for mid-build resolution.
- **`PackageJsonFormat`** — the decode-free text path: anything syntactically JSON, no field validation at all. See [the decode-free text path interface](../interfaces/package-json-text.md).

`PackageManagerRange` models pnpm's own wider reading of `packageManager` under `manage-package-manager-versions` (a semver range, not just an exact pin), as a separate class from `PackageManager` rather than one loosened field — so a caller asking "can corepack provision this?" still gets a typed answer from the strict class. It shares `PackageManager`'s one load-bearing rule: the first `+` after the `@` begins the integrity component, never semver build metadata.

It reads two fields through one component validation, so they cannot drift apart. `parseResult(input)` (a sync `Result`, the primitive under `parse` and the `FromString` codec) reads a `packageManager` string. `fromDevEngineResult(engine)` (under `fromDevEngine`) reads a `devEngines.packageManager` entry, whose `name` is the manager and whose `version` holds the same `<range>[+<integrity>]` tail. An entry with no `version` names no range, so it fails; `onFail` is ignored. Every entry point fails with `InvalidPackageManagerRangeError`, whose `reason` names the component: `format` (a string with no `@`), `name`, `range` (absent, empty, or not a semver range) or `integrity` (the tail is not a corepack `<algo>.<hex>` hash). An empty range is a `range` failure, never the `*` node-semver would coerce it to. `FromString` still reports a generic `SchemaError` carrying the same message.

Three renderings serve three writers. `toString()` is the value as parsed, integrity included, and is what `FromString` encodes. `bare` is `<name>@<range>` with the integrity dropped and the operator kept. `range` alone is the bare `devEngines.packageManager.version` value, so `^12.6.0+sha512.<hex>` writes back as `^12.6.0`.

## The `rest` catch-all and `.extend()` story

`Package` carries a `rest` field holding unknown top-level keys. The wire transform partitions raw object keys against `Class.fields`: known keys decode to typed members, the remainder flow into `rest`; on encode, `rest` flattens back out to top-level keys, so there is never a literal `rest` key on disk. Because the partition is against `Class.fields`, `.extend()`ed subclasses automatically pull their new fields out of `rest` into typed members — the codec is rebuilt against the subclass's fields. `rest` itself is a plain optional record: no `Schema.Data` cast, no disabled validation.

The catch-all is needed at every level a round-tripped document has, not just the top: a `Schema.Class` modeling a sub-object (`Person` for object-form `author`/`contributors`/`maintainers`) needs its own `rest`, or unknown keys inside that object silently drop on read→write (`{"name":"Dee","twitter":"@dee"}` re-encoding as `{"name":"Dee"}`). `Person` collects them into `rest` and flattens them back on encode, so the on-disk shape never carries a literal `rest` key there either; check every new sub-object class against a round-trip test.

## Optional-field and dependency-map representation

Omissible object fields decode via `Schema.optionalKey` with implementation-level defaults; a `Schema.Option`-typed decoded field survives only where presence versus absence is actively branched on in the model's logic. The dependency maps and `scripts` are `HashMap`s — immutable, Effect-idiomatic, structural equality for free. The record-to-HashMap codec sits its decoding default on the record side, before `decodeTo`, taking an `Effect`; applying the default after the HashMap decode breaks the encode direction. Empty maps are stripped on encode.

## Dual-signature statics

The mutation statics use `Function.dual` so data-first, curried and pipeable call styles all work, reusing the machinery proven in `@effected/semver`.

## Error set

Each error is a `Schema.TaggedError` defined in the module of the concept that raises it, keeping its `message` getter. Structure-preserving discipline is the rule that matters: decode and read/write errors carry the underlying failure as a structured `cause` field, never a stringified message. `SchemaError` is normalized to the domain error at the boundary via `Effect.catchTag`, never leaked deep into logic. Not-found keeps its own tag for routing, the write error is narrowed to the fs-write failure only, and the read path folds decode failures into the shared decode error rather than minting a second one.

## Services and layers

Layers are exported as consts inside each concept module, memoized by reference (never getters) and provided at boundaries only — business logic requires services and never calls `Effect.provide` locally. `PackageJsonFile` is the only IO service, working over core `FileSystem`/`Path` so its layer requires no platform peer. It carries three pairs of operations against a path: the strict `read`/`write`, the presence-lenient `readManifest`/`writeManifest`, and the byte-preserving `modify` (see [the decode-free text path interface](../interfaces/package-json-text.md)) — so a caller picks a tolerance tier without leaving the service. Write creates the parent directory before writing, and both steps fail as the narrowed write error. Read deliberately has no `exists` pre-check — that is a TOCTOU window — and instead reads the text directly, routing only the `PlatformError` whose `reason._tag` is `"NotFound"` to `PackageJsonNotFoundError`. Resolution is deliberately kept out of `write`: write writes what it is given, and resolution is an explicit step the caller composes, since a writer that silently resolved would make writing a file mutate its contents. The resolver services are not defined here — `Package.resolve` imports the tags from `@effected/npm` and requires them from context, per [contract inversion](../decisions/contract-inversion-default.md).

## The decode-free text path

Formatting and surgical field edits both work on manifest text and never decode, which is what makes them usable where `Package.decode` hard-fails on legal input (`{"private": true}` and version-less roots are both perfectly valid manifests that the strict decode rejects). Both live in `src/PackageJsonFormat.ts` and are reachable from `PackageJsonFile` against a path. See [the package-json-text interface](../interfaces/package-json-text.md) for the byte-parity rule, indentation options and edit conventions.

## Observability

Per the kit's observability standard, `Effect.fn("name")` at public fallible boundaries: every file operation, validation, resolution, the effectful mutation statics and the decode entry. Pure getters, the specifier taxonomy and the format functions are not instrumented. The library stays telemetry-agnostic; applications compose `@effect/opentelemetry` at the edge.

## Testing

`@effect/vitest` with `it.effect` the default mode; shared wiring via top-level `layer(...)` groups, scoped and memoized. Tests in `__test__/` split per concept, integration under `__test__/integration/`. Property tests cover the specifier taxonomy and name-brand validation. Round-trip and wire-transform tests assert the fidelity contract structurally — unknown fields survive read/edit/write, subclasses pull custom fields out of `rest`, empty maps strip and keys land in canonical order — rather than through brittle output snapshots. Integration tests with a real platform filesystem layer are the only tests that provide one, making the boundary discipline explicit. Error-path and behavior-contract tests cover each read error tag, validation aggregation, structured cause preservation, the dual-signature call styles, `copyWith` completeness, resolution with real versus no-op resolvers, and the contract that writing does not mutate contents.

## Build

Every Effect class factory is written inline with no exported `*_base` const; the synthesized `_base` heritage symbols are suppressed narrowly in `savvy.build.ts`. `pnpm build --filter @effected/package-json` runs the dev+prod pipeline; never invoke `node savvy.build.ts --target prod` directly.


---
<!-- okf/project.md -->
---
type: Project
title: effected
description: What this project is, its boundaries, and its non-goals.
status: stable
tags:
  - architecture
generated:
  by: "claude-code/opus-5.5"
  at: 2026-10-05T18:09:34Z
  body_sha256: 739e7470d009ee808999904826fbdf578d0a51c43f95f389f3af8e815a8c428e
---

# effected

## Purpose

effected (GitHub `spencerbeggs/effected`, npm org `@effected`) is a pnpm monorepo building an **Effect v4 app kit**: a coherent set of libraries designed v4-first rather than a grab-bag of utilities that happen to share a repo. It replaces per-repo development of a family of predecessor `*-effect` libraries that suffered cross-repo release loops and dependency-interaction bugs surfacing only after publishing. The unit of design is the kit, not the package — packages are carved along the seams real applications press on, and a capability with no named consumer is not built. Scope is closed by five consuming applications (below), not by how much surface an ecosystem could have. All `@effected/*` packages target Effect v4, now stable: the `effect` pnpm catalog gives it the caret range `^4.0.0` and the lockfile fixes the exact release. Everything published is `0.x` and unstable; Effect v4 being stable makes a kit `1.0.0` possible, not automatic, and the kit takes it when it chooses to. Releases are changeset-driven: CI builds the changesets present on a branch and releases the packages they name, whether that is the whole kit behind a catalog advance or a single package on a patch — both are ordinary outcomes of the same mechanism, not different processes.

## Design posture

The developer-experience exemplar is the [`semver`](modules/semver.md) package, for its class-based API: static and instance methods on domain classes, no floating functions. In Effect v4 the domain-model class and the schema are the same artifact (`Schema.Class`), so this class-based DX is the ecosystem norm the kit follows, not a house deviation from it.

## Boundaries

The repository holds **libraries and their companions**. Standalone tools and applications built on these libraries stay in their own repos and consume published `@effected` packages: a repository with an entry point a user runs, rather than an API a program imports, does not belong here. The one admitted exception is a **companion** that fronts exactly one library here and releases as a fixed pair with it (`schemastore-cli` over `schemastore`): it is the library's own command-line surface, not an application, and it carries no library tier — see [companion package](glossary/companion-package.md). Package membership is the `packages/` directory listing.

| Package | Tier | Provenance |
| --- | --- | --- |
| `semver` | pure | port of `semver-effect`; the DX exemplar |
| `jsonc` | pure | port of `jsonc-effect` |
| `yaml` | pure | port of `yaml-effect`; the largest package in the repo |
| `package-json` | boundary | port of `package-json-effect`; SPDX validity delegated to `spdx` |
| `npm` | boundary (was pure) | extraction from `package-json`; resolver contracts plus registry/publish services |
| `config-file` | boundary | port of `config-file-effect`; the four config codecs as free-standing named exports |
| `walker` | boundary | extraction from `config-file`; upward path traversal |
| `glob` | pure | invention; a vendored minimatch dialect as pure string→predicate schemas |
| `toml` | pure | invention; a from-scratch, full-parity TOML engine |
| `lockfiles` | pure | extraction from `workspaces`; bun/npm/pnpm/yarn parsers |
| `store` | integrated | extraction from `xdg`; migrated SQLite `Store` and TTL `Cache` |
| `xdg` | boundary | port of `xdg-effect`; does not depend on `store` |
| `workspaces` | integrated | port of `workspaces-effect`; discovery, dependency graph, catalogs, change detection |
| `runtimes` | boundary | port of `runtime-resolver`'s library half |
| `tsconfig-json` | boundary | invention; zero `typescript` imports |
| `git` | boundary | invention; typed git introspection over core's `ChildProcessSpawner` |
| `spdx` | pure | invention; vendored SPDX license expressions as pure schemas |
| `app` | integrated | invention; thin composition over `xdg` + `config-file` + `store` |
| `engine` | pure | invention; platform-free primitives shared across front ends (distribution identity, remediation, launch context, and transport-neutral process crash guards on the import-free `./guard` subpath) |
| `env` | boundary | invention; who is running a program and in what terminal (`RuntimeEnv`, `TerminalEnv`, `Audience`, `EnvOverride`) read through `Config`, with no `node:` import; a required peer of `cli`, so an MCP server or engine detects without a CLI dependency |
| `cli` | boundary (`./ui` integrated on opt-in) | invention; the CLI presentation boundary over `effect/cli`: audience, theme and messages, the document IR and its renderers, links, failure reports, logging and prompts in a React-free root; interactive Ink screens and the live view behind `./ui` (`ink` and `react` optional peers) and their harness behind `./ui/testing` |
| `mcp` | boundary | invention; the MCP boundary (stdio wiring, tool-failure shaping, strict-input walkers) over `effect/ai`, plus `./testing` clients |
| `lsp` | boundary | invention; LSP base-protocol framing (byte-counted `Content-Length` encode, an incremental decoder and a `Stream` transform) as pure functions, plus `LspProbe`, the packed-install boot proof for a Language Server bin, behind `./testing` |
| `markdown` | pure | invention; CommonMark + GFM as pure schemas |
| `commands` | boundary | part-port of `@savvy-web/silk-effects`' `ToolDiscovery` plus invention |
| `templates` | boundary | port of `@savvy-web/silk-effects`' `ManagedSection` |
| `memfs` | pure | invention; a virtual POSIX volume behind core's `FileSystem` key — carries **no `@effected/*` edge, ever** |
| `github` | integrated | port-with-redesign of `@savvy-web/github-action-effects`'s GitHub half |
| `github-references` | pure | extraction from `github`; the issue-reference grammar as pure functions |
| `github-commands` | pure | extraction from `github-actions`; the workflow-command grammar (`WorkflowCommand`, and `CommandNeutralizer`, the runner's two-parser rule) as pure functions; a regular dependency of `github-actions` and `cli` |
| `github-actions` | integrated | port-with-redesign of the same package's Actions half |
| `sbom` | integrated | port-with-redesign of the same package's `Attest` knot |
| `schemastore` | boundary (integrated 2026-08-04 → 2026-09-15) | invention; SchemaStore-shaped JSON Schema documents from Effect Schema sources |
| `schemastore-cli` | companion — no tier | invention; the `schemastore` bin over `@effected/schemastore`: build/check a `schemastore.config.ts` under a per-schema published flag and a drift policy; also exports `AjvValidator`, the one shipped validation engine |
| `schema-org` | pure | invention; schema.org vocabulary as Effect Schema classes |
| `jsonl` | boundary | invention; append-only schema-validated JSONL journals |
| `pnpm-plugin-effect` | companion — no tier | invention; publishes the Effect catalogs the kit pins against |

The roster is **37 packages**: 35 libraries and two companions (`pnpm-plugin-effect` and `schemastore-cli`). 31 have published; `env`, `github-commands`, `engine`, `mcp`, `lsp` and `schemastore-cli` await their first release.

### Consumers

The kit's scope is closed by the applications that consume it, surveyed read-only from outside this repository.

| Consumer | Register entry |
| --- | --- |
| savvy-web/silk-release-action | [silk-release-action](consumers/silk-release-action.md) |
| savvy-web/silk-update-action | [silk-update-action](consumers/silk-update-action.md) |
| savvy-web/silk-runtime-action | [silk-runtime-action](consumers/silk-runtime-action.md) |
| savvy-web/silk-sync-action | [silk-sync-action](consumers/silk-sync-action.md) |
| savvy-web/silk-router-action | [silk-router-action](consumers/silk-router-action.md) |
| spencerbeggs/claude-code-marketplace-manager | [claude-code-marketplace-manager](consumers/claude-code-marketplace-manager.md) |
| savvy-web/systems | [systems](consumers/systems.md) |
| spencerbeggs/reposets | [reposets](consumers/reposets.md) |
| spencerbeggs/tsdoctor | [tsdoctor](consumers/tsdoctor.md) |
| spencerbeggs/okfit | [okfit](consumers/okfit.md) |
| spencerbeggs/vitest-agent | [vitest-agent](consumers/vitest-agent.md) |

Two named applications resolved the "library wearing app clothing" question differently rather than joining the kit outright: `type-registry-effect` stays entirely outside, in its own repo, because it carries `typescript` / `@typescript/vfs` peers the kit refuses; `runtime-resolver`'s library half ships from the kit as `runtimes`, while its CLI ships from the external `runtime-resolver` repo against the published package, so the library's consumers never install `@effect/platform-node`. Further external consumers — `rolldown-pnpm-config`, `rspress-plugin-api-extractor`, and `soda3js/tools` via `@soda3js/config` — take published packages without a register entry of their own in this bundle.

The repository's monorepo tooling and layout are documented in [the workspace module](modules/workspace.md); the agent plugin, the probe workspace and the docs site each have their own Module: [ai-plugin](modules/ai-plugin.md), [scratchpad](modules/scratchpad.md), [website](modules/website.md).

## Non-goals / out of scope

- **Applications.** Anything with a user-run entry point rather than an importable API stays in its own repo, even when it started life here or shares packages with the kit.
- **`@effected/json-schema`.** Off the roadmap entirely: its core value is superseded by Effect v4's `Schema.toJsonSchemaDocument`, and the one internal dependency on it (from `xdg`) was a dead facade that has been cut. It would be revisited only if a consuming application appeared.
- **`ts-vfs`.** Lives in the external `type-registry-effect` repo; carries the `typescript` / `@typescript/vfs` peers the kit's "no `@effected/*` package imports `typescript`" posture excludes.
- **The `runtime-resolver` binary.** Ships from the external `runtime-resolver` repo against the published `runtimes` package, so the library's own consumers never need `@effect/platform-node`.
- **Importing `typescript`.** No `@effected/*` package imports the `typescript` package; version-coupled facts it would otherwise need (such as `tsconfig-json`'s enum mappings) are carried as data instead.


---
<!-- okf/decisions/package-json-tolerance-ladder.md -->
---
type: Decision
title: package-json reads the same document through five tolerance tiers
description: Package, PackageManifest, LenientManifest, npm's Manifest and the decode-free PackageJsonFormat text path form one strictest-to-most-permissive ladder over the same manifest document, so a caller picks the tolerance its use case actually needs rather than fighting one all-or-nothing decode.
status: draft
tags:
  - architecture
  - dx
sources:
  - id: package-manifest-source
    resource: ../../packages/package-json/src/PackageManifest.ts
  - id: lenient-manifest-source
    resource: ../../packages/package-json/src/LenientManifest.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 580fc8c3f680a8caeac0c3810417811c6f28af8d90ae9977ef350652c60944a4
---

# package-json reads the same document through five tolerance tiers

## Context

A package.json document gets read for very different purposes: publishing
a strict, valid manifest; editing a private workspace root that
legitimately omits `name`/`version`; sniffing a `node_modules` tree or a
fetched tarball where the document is other people's data and one
malformed field must not fail the whole read; resolving `catalog:`/
`workspace:` specifiers mid-build against arbitrary user records; and
reformatting or single-field-editing a manifest that is syntactically
valid JSON but semantically nothing has decoded yet. A single strict
schema cannot serve all five without either rejecting legal input in the
lenient cases or silently accepting garbage in the strict ones.

## Decision

The kit models these as one ladder, strictest to most permissive, over
the same underlying document:

1. **`Package`** — strict, publishable: `name`/`version` required, every
   present field shape-validated against its npm grammar.
2. **`PackageManifest`** — presence-lenient: fields may be absent (the
   private workspace-root shape), but a present field is validated
   exactly as strictly as `Package`'s.[^package-manifest-source]
3. **`LenientManifest`** — shape-lenient discovery/sniffing: a present
   field that fails even its permissive shape check degrades to absence
   rather than failing the whole document, with the degradation recorded
   on `issues`.[^lenient-manifest-source]
4. **`@effected/npm`'s `Manifest`** — shape-blind outside the four
   dependency fields, for mid-build resolution.
5. **`PackageJsonFormat`** — the decode-free text path: anything
   syntactically JSON, no field validation at all.

Each tier relaxes a specific, named axis relative to the one above it
rather than being an independent redesign: `PackageManifest` relaxes
presence of exactly two fields (`name`, `version`) plus the
`packageManager` field's strictness; `LenientManifest` relaxes shape
validation per top-level field, discarding a malformed field into `rest`
rather than failing the document; `Manifest` drops shape validation
entirely outside the four dependency fields; and `PackageJsonFormat`
drops decoding altogether.

## Alternatives rejected

- **One strict schema with an optional "lenient mode" flag.** Rejected
  because a flag would make the return type a union of guarantees hidden
  from both the call site and a reader grepping for which tier a given
  call actually exercises — the same reasoning that keeps the
  decode-free text path a distinctly named entry point rather than a
  `{ strict: false }` option.
- **A single "best effort" decode that silently degrades whatever it
  cannot validate**, with no distinct named tiers at all. Rejected
  because it would make "zero issues" ambiguous between "this document is
  actually valid" and "this document merely didn't hit a check" — the
  ladder keeps that distinction explicit by naming which tier a caller
  chose and what it does and does not verify.
- **Merging `LenientManifest` and `Package`'s presence-lenient tier into
  one class** that is both shape-lenient and presence-lenient at once.
  Rejected because the two lenience axes serve different callers:
  `PackageManifest` is the tier a manifest *editor* works in, expecting
  shape-correct but possibly-incomplete data, while `LenientManifest`
  is a *sniffing* tier for other people's data where shape itself cannot
  be trusted. Collapsing them would force an editor to tolerate malformed
  fields it should instead reject.

## Consequences

A caller picks the tier that matches its actual tolerance need instead
of fighting one all-or-nothing schema — an editor of a private workspace
root uses `PackageManifest`, a tool sniffing published tarballs uses
`LenientManifest`, and a lint or single-field-edit tool uses
`PackageJsonFormat`. The cost is that a reader must know which tier a
given call site is using to know what has actually been validated: an
empty `LenientManifest.issues` array does not imply the document would
pass `Package.decode`, and confusing the two tiers' guarantees is the
one trap the ladder's documentation exists to prevent.

[^package-manifest-source]: `packages/package-json/src/PackageManifest.ts`
    — the presence-lenient tier relaxing exactly `name`, `version` and
    `packageManager`'s strictness relative to `Package`.
[^lenient-manifest-source]: `packages/package-json/src/LenientManifest.ts`
    — the shape-lenient discovery tier, degrading a malformed field to
    `rest` plus a recorded `LenientFieldIssue`.


---
<!-- okf/interfaces/package-json-text.md -->
---
type: Interface
title: The package-json decode-free text path
description: PackageJsonFormat's formatter and surgical mutator work on manifest text without ever decoding it — the formatter matching sort-package-json's byte order exactly, and the mutator preserving every untouched byte around an edit — so both work on legal manifests the strict Package decode rejects.
status: stable
kind: api
resource: ../../packages/package-json/src/PackageJsonFormat.ts
tags:
  - dx
sources:
  - id: internal-format
    resource: ../../packages/package-json/src/internal/format.ts
  - id: fixtures-dir
    resource: ../../packages/package-json/__test__/fixtures
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 2111dfd4fc6dd84e455f719eef1ccd0f4e1bce4b324e39671f5146d0967c85db
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:16.643Z
---

# The package-json decode-free text path

## What stays stable

`PackageJsonFormat` exposes two independent capabilities over manifest
**text**, neither of which decodes into `Package`: formatting, which
rewrites a document into the key order the npm ecosystem already
produces, and surgical mutation, which changes one field and leaves
every other byte alone. Both exist because the strict `Package.decode`
path hard-fails on legal input — `{"private": true}` and version-less
roots are both valid manifests the strict decode rejects — which makes
the strict path unusable as a lint or single-field-edit handler. Four
statics form the stable contract:

- **`sortValue`** — value→value, total, returns its input type `T`. Only
  ever reorders keys; it never adds or removes one, and this is
  type-enforced — a key-removing option there is a compile error. A
  non-object input (array, scalar, `null`) returns unchanged rather than
  mangled.
- **`formatToString`** — text→text, `Result<string, PackageJsonSyntaxError>`.
- **`modify`** / **`modifyToString`** — the surgical mutators, taking an
  ordered list of field edits (`{ path, value }`, where `value: undefined`
  deletes) applied through `@effected/jsonc`'s scanner-based edit surface,
  so every byte outside the edited spans — key order, indentation, line
  endings, trailing newline — survives.

`PackageJsonFile.modify` is the same surgical operation read-modify-write
against a path, skipping the write entirely when the result is
byte-identical to what was read.

## Byte-agreement with the ecosystem oracle

The formatter's canonical top-level key order is `sort-package-json`'s
default sort order, re-baselined verbatim rather than hand-curated, with
the source version recorded as provenance beside the
list.[^internal-format] Verbatim is the contract: a hand-curated
near-copy is the shape that drifts silently, since every disagreement
would show up as a diff in a consumer's repository rather than as a
failure here. Unknown keys append after the known ones — public keys
alphabetically, then underscore-prefixed keys alphabetically — matching
the oracle's own behavior. The dependency maps, plus `scripts`,
`engines` and `bin` (all `HashMap`-backed, whose encode order is hash
order and therefore not source order), are alphabetized for the same
reason: source order is already unrecoverable for those fields, so the
choice is hash order or alphabetical, and alphabetical wins.

`__test__/fixtures/` holds real manifests from this repository paired
with frozen oracle output for the same input, and the format test
asserts byte equality.[^fixtures-dir] `sort-package-json` is deliberately
not a runtime dependency of the package — the oracle's *output* is
committed, not the tool, so the parity claim is checked without taking a
dependency edge on the thing being matched. The re-baseline rule is that
the fixtures, the recorded version in the fixture README, and the
key-order provenance comment move together in one deliberate act;
regenerating fixtures alone would silently ratify whatever a newer
oracle version changed, turning the parity test from a check into a
rubber stamp.

## Surgical edits preserve every untouched byte

`modify`/`modifyToString` are the opposite posture from the formatter on
purpose: the formatter's job is canonical order, and the mutator's job is
to leave every byte it did not edit alone, so a tool committing a
one-field change to somebody else's repository produces a reviewable
diff instead of a whole-file rewrite. Neither decodes, so both work on
manifests `Package.decode` rejects. Inserted content matches the
source's own style — indentation and line ending are detected from the
text being edited, not chosen by the writer. Deletion is spelled
`value: undefined`, the same convention `@effected/jsonc`'s own modify
surface uses, so removing a key is always deliberate rather than a side
effect of an absent property. The input is strict JSON, not JSONC — npm
does not accept comments in a manifest, and neither does this path.

## The return-type split, and why it is Result on the text side

The text path returns `Result`, not `Effect`, because lint hosts are
synchronous and an `Effect` return would force every one of them to build
a runtime just to format a file. Effect hosts lift with
`Effect.fromResult` in one call, so the `Result` form serves both
audiences. The options type for the text path is deliberately separate
from the strict path's — a source-text option is meaningless when the
text already *is* the source.
[^internal-format]: `packages/package-json/src/internal/format.ts:11-19`
    — the `KEY_ORDER` constant's provenance comment: "canonical top-level
    key order — `sort-package-json@4.0.0`'s default `sortOrder`."
[^fixtures-dir]: `packages/package-json/__test__/fixtures/` — the
    committed oracle-output fixtures the format test compares against
    byte-for-byte.


---
<!-- okf/interfaces/package-json-entry-point.md -->
---
type: Interface
title: The package-json entry-point resolver
description: "resolveEntryPoint answers which file is a manifest's root entry: pure, Result-returning, over a structural { exports?, main? } input rather than a Package; the condition list is the caller's ordered policy, a present exports encapsulates the package and never falls through to main, and every failure names its discriminated reason."
status: stable
kind: api
resource: ../../packages/package-json/src/EntryPoint.ts
tags:
  - dx
sources:
  - id: entry-point-source
    resource: ../../packages/package-json/src/EntryPoint.ts
  - id: entry-point-test
    resource: ../../packages/package-json/__test__/EntryPoint.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 2b3d0dab707e641baf242da95fb9d8129a4c11f70a7b7c9d0605cbf4008b8d82
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:21.362Z
---

# The package-json entry-point resolver

## What stays stable

`resolveEntryPoint(manifest, options?)` answers "which file is this
manifest's `"."` entry?" and nothing else. Three properties of its
shape are the contract:

- **Pure, IO-free and `Result`-returning.** It reads no disk and runs no
  `Effect`; the answer is `Result<string, UnresolvedEntryPointError>`,
  so lint hosts and tarball inspectors call it synchronously and Effect
  hosts lift it with `Effect.fromResult`.
- **The input is structural, not a `Package`.** `EntryPointManifest` is
  `{ exports?: unknown; main?: unknown }`, so a manifest read straight
  out of a tarball or a `node_modules` tree resolves with nothing else
  validated — a document the strict `Package` decode would reject still
  gets an answer here.[^entry-point-source]
- **The condition list is caller-supplied and ordered — the order IS the
  policy.** `options.conditions` is honoured in the order given, never
  in the manifest's key order, and conditions recurse
  (`{ "import": { "node": "./n.js" } }` resolves through both levels).
  The default is the package's own `DEFAULT_CONDITIONS`; a caller with a
  different policy passes its own list.

All three legal `exports` spellings are honoured: the string shorthand,
the subpath map with a `"."` entry, and root conditions with no `"."`
key.

## A present `exports` encapsulates the package

When `exports` is present but nothing in it matches, the answer is a
typed failure — `main` is **not** consulted. That is Node's own rule,
and the lenient reading (fall through to `main`, then to `index.js`) is
exactly what a future reader would "fix" it back to, because it looks
friendlier: it answers a file the package deliberately does not export,
which then loads and behaves plausibly instead of failing. A test pins
the strict behaviour by name.[^entry-point-test] `main`, and then the
legacy `index.js` default, are consulted only when `exports` is
**absent**. An `exports` form the resolver does not implement (an array
fallback list, or any non-string non-object value) is likewise a
failure, not a fall-through — encapsulation still applies.

## The failure names its reason

`UnresolvedEntryPointError` carries a discriminated `reason` —
`noRootExport` (a subpath map with no `"."` entry), `noConditionMatched`
(a root entry exists but none of the requested conditions are present,
with the `conditions` tried carried on the error so the message can name
them) and `unsupportedExportsForm`. Never collapse these to one
"not found" sentinel: the three call for different responses from a
caller, and the test suite asserts each reason separately.

[^entry-point-source]: `packages/package-json/src/EntryPoint.ts` — the
    `EntryPointManifest` shape, `resolveEntryPoint` and the
    `UnresolvedEntryPointError` reasons.
[^entry-point-test]: `packages/package-json/__test__/EntryPoint.test.ts`
    — the "exports encapsulates the package" group, including "does NOT
    fall back to main when exports is present and nothing matched".


---
<!-- okf/invariants/package-manager-shares-strict-schemas-by-identity.md -->
---
type: Invariant
title: PackageManager's version and integrity fields ARE the schemas their owning packages export
description: "package-json's PackageManager.fields.version is the same object as @effected/semver's SemVer.PinnableVersionString and fields.integrity.value the same object as @effected/npm's CorepackIntegrityHash; the property is pinned by identity assertions with controls, because a Schema.check is erased from the built .d.ts and a re-derived copy would compile clean and pass every rejection test."
status: stable
resource: ../../packages/package-json/__test__/PackageManager.test.ts
tags:
  - testing
  - architecture
sources:
  - id: package-manager-source
    resource: ../../packages/package-json/src/PackageManager.ts
  - id: package-manager-test
    resource: ../../packages/package-json/__test__/PackageManager.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: f7e7713dc3f2891d76d08b6488fd78d0b00bf813844ba00a1f9618ea6119911e
---

# PackageManager's version and integrity fields ARE the schemas their owning packages export

## The property

`PackageManager` models corepack's `<name>@<version>[+<integrity>]`
triple, and both strict halves are consumed from the packages that own
them rather than re-derived:

- `PackageManager.fields.version === SemVer.PinnableVersionString` — the
  version IS `@effected/semver`'s pinnable-version schema (decode rules
  through `SemVer.isPinnable`).
- `PackageManager.fields.integrity.value === CorepackIntegrityHash` —
  the integrity IS `@effected/npm`'s shared corepack `<algo>.<hex>`
  narrowing of `IntegrityHash`.[^package-manager-source]

The version fold is a deliberate strictening of
`PackageManager.FromString`: `pnpm@01.2.3`, `pnpm@1.2.3-01`,
`pnpm@1.2.3-a..b` and the padded `pnpm@ 10.33.0` all fail typed,
matching corepack's own `semver.valid` check minus its trim. The check
sits on the *field*, so `PackageManager.make` refuses a malformed
version — and any build metadata, which the grammar cannot express
because the first `+` after the `@` is spoken for by the integrity —
rather than producing a manifest value that re-parses differently.

## The mechanism

Identity assertions in the consolidation test group, each with a
control that proves the assertion discriminates.[^package-manager-test]
`Schema.Option(X)` keeps `X` on `.value`, so the integrity assertion
reads `fields.integrity.value`; a bare field keeps the schema directly
on `fields`, so the version assertion reads `fields.version`. The
integrity control rejects the unrestricted `IntegrityHash`; the version
controls reject `SemVer.ExactVersionString` and `Schema.String`, the
two neighbours a faithful re-derivation would plausibly reach for. The
version half is additionally pinned behaviourally by an equivalence
test over an untrimmed corpus against `SemVer.parseResult` — whichever
direction a hand-rolled parser drifted, some corpus entry disagrees.

## What a refactor would have to break

Identity is the only guard that can see a severed edge. A
`Schema.check` is erased from the built `.d.ts`, so the public type is
unchanged whether the field is the shared schema or a private copy that
happens to agree with it: severing either edge is not a type error, not
a compile-time-visible break, and passes every rejection test in the
suite. Only `strictEqual` against the owner's export fails. Do not
downgrade either assertion to a source-text check (grepping for the
import), which a re-export shim or an alias defeats, and do not replace
the `.value` read with a fresh `Schema.Option(...)` comparison, which
would be a new object.

The name grammar is deliberately *not* shared: this field model keeps
any lowercase name (manifests as they exist in the wild — corepack
0.34.0 recognizes only npm/pnpm/yarn and would reject the very real
`bun@1.2.20`), while `@effected/npm`'s `PackageManagerPin` closes the
set to the kit's provisioning vocabulary. That divergence is on purpose
and lives in the class's TSDoc; the invariant covers only the two shared
halves.

The integrity edge seen from its owner — `CorepackIntegrityHash` has one
home and two consumers, each pinning identity — is
[CorepackIntegrityHash is consumed by identity](corepack-integrity-hash-shared-by-identity.md).

[^package-manager-source]: `packages/package-json/src/PackageManager.ts`
    — the `version: SemVer.PinnableVersionString` and
    `integrity: Schema.Option(CorepackIntegrityHash)` fields.
[^package-manager-test]: `packages/package-json/__test__/PackageManager.test.ts`
    — the "PackageManager consolidation" group: the two identity
    assertions with controls and the `SemVer.parseResult` equivalence
    corpus.


---
<!-- okf/decisions/spdx-delegation.md -->
---
type: Decision
title: package-json delegates SPDX license validity to @effected/spdx
description: License.ts validates the license field's SPDX expression grammar by calling @effected/spdx's isValidExpression rather than owning that grammar itself, keeping only the two npm-specific special cases (UNLICENSED, SEE LICENSE IN); the delegation dropped the kit's last foreign spdx-expression-parse runtime dependency.
status: draft
tags:
  - architecture
  - bundle
sources:
  - id: package-json-license
    resource: ../../packages/package-json/src/License.ts
  - id: package-json-claude
    resource: ../../packages/package-json/CLAUDE.md
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 007cda72f962dbf881a13a91a3f638f0ba1dd45885bc1a2c86d0e1996662fb13
---

# package-json delegates SPDX license validity to @effected/spdx

## Context

npm's `license` field is either a real SPDX license expression or one of
two npm-specific spellings SPDX itself does not recognize: `UNLICENSED`
and `SEE LICENSE IN <file>`. Validating this field therefore needs both
the actual SPDX expression grammar (a real parser) and the two npm
carve-outs layered on top. Before `@effected/spdx` existed,
`@effected/package-json` carried its own SPDX validity check through the
`spdx-expression-parse` npm package, which was the kit's last
foreign (non-`@effected/*`) runtime dependency and the dependency that
made this package integrated tier.

## Decision

`@effected/package-json`'s `License.ts` delegates real SPDX expression
validity to `@effected/spdx`'s `isValidExpression`, and keeps only the
npm-specific `UNLICENSED` and `SEE LICENSE IN <file>` cases as its own
logic layered on top:[^package-json-license]

```text
isValidSpdx(value) =
  value === "UNLICENSED"
  || value starts with "SEE LICENSE IN " and has content after it
  || SpdxExpressionOps.isValidExpression(value)
```

This delegation is what dropped the former `spdx-expression-parse`
runtime dependency and its ambient shim — the dependency that once made
this package integrated — so `@effected/package-json`'s tier is now
boundary.[^package-json-claude] The npm-specific cases stay local because
they are npm semantics, not SPDX grammar: `@effected/spdx` has no reason
to know that npm treats those two strings specially, and folding them
into the shared package would leak an npm-specific carve-out into a
package meant to model SPDX itself.

## Alternatives rejected

- **Keep the local `spdx-expression-parse` dependency** and accept the
  integrated tier it forced. Rejected because a genuine cross-package
  vendored SPDX schema package (`@effected/spdx`) already existed as a
  candidate to replace it, and the tier cost of keeping a foreign
  dependency for a capability the kit could own itself outweighed the
  cost of the delegation.
- **Move the npm-specific special cases (`UNLICENSED`, `SEE LICENSE IN`)
  into `@effected/spdx` itself**, so package-json's `License.ts` could
  call one function covering the whole field grammar. Rejected because
  those two spellings are not SPDX grammar at all — they are npm's own
  convention — and folding them into the SPDX package would misrepresent
  what SPDX itself defines, plus create an npm-shaped dependency inside
  a package meant to be a general-purpose vocabulary vendor.

## Consequences

`@effected/package-json` carries zero third-party runtime dependencies
outside `effect` core, with `@effected/spdx` as its only source of real
SPDX grammar. A branded `SpdxLicense` value is therefore not guaranteed
to be parseable as an actual SPDX expression — `licenseExpressionOf`
exists precisely because a value passing `isValidSpdx` might still be one
of the two npm carve-outs, and any consumer needing an actual expression
(a license URL, a badge, structured data, a policy check) must go through
that accessor rather than assuming every valid `SpdxLicense` parses.

[^package-json-license]: `packages/package-json/src/License.ts:5-6,29-34`
    — `isValidSpdx` calling `@effected/spdx`'s `isValidExpression` for
    the real grammar, with the two npm special cases handled inline.
[^package-json-claude]: `packages/package-json/CLAUDE.md` — "Core SPDX
    license validity is delegated to `@effected/spdx`… That delegation
    dropped the former `spdx-expression-parse` runtime dependency and its
    ambient shim — the dep that once made this package integrated — so
    its tier is now boundary."


---
<!-- okf/decisions/format-naming.md -->
---
type: Decision
title: "Format-package naming is `*Format`, not `*Unvalidated`"
description: "The `*Format` concept class with total statics is the kit's naming convention; `*Unvalidated` is rejected."
status: draft
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 9a9966b582e8f2db71f0f0ae3597e123d464d05c27da1ba523e429e8fca2c959
---

# Format-package naming is `*Format`, not `*Unvalidated`

## Context

Four of the kit's five format packages — `jsonc`, `yaml`, `toml`, `markdown`
— converged independently on a `*Format`/`*Formatter` concept class exposing
`format` (edits) and `formatToString` (bytes→bytes), per the [format-package
convention](../conventions/format-package-convention.md). The fifth,
`package-json`, differs because it alone decodes against a schema. A naming
convention was needed for the shared shape before any of these surfaces
shipped and became unchangeable.

## Decision

The `*Format` concept class with total statics is the kit's naming
convention. `formatToString` is the shared name for the bytes→bytes shape, so
a consumer who has met one kit formatter has met them all
(`packages/jsonc/src/JsoncFormatter.ts:48`, `packages/yaml/src/YamlFormat.ts:826`,
`packages/toml/src/TomlFormat.ts:790`, `packages/markdown/src/MarkdownFormat.ts:673`,
`packages/package-json/src/PackageJsonFormat.ts:196`). A package-specific
shape gets a package-specific name instead of being forced into the shared
one — `package-json`'s value-path entry point is `sortValue`
(`packages/package-json/src/PackageJsonFormat.ts:159`), not `format`, because
its shape (`T → T`) differs from the other four's (`string →
ReadonlyArray<Edit>`).

The guarantee a formatter makes lives in the class's doc comment, where it
can be stated precisely, rather than compressed into a name prefix.

## Alternatives rejected

**`*Unvalidated`.** Accurate for `package-json`, which has a decode step to
skip, and wrong everywhere else. `yaml`, `toml`, `jsonc` and `markdown` have
no validation to be un-done — their tolerant/strict distinction is about
fidelity and error tolerance, not schema decoding. The axis worth naming is
not "validated" but whether the path decodes at all: a decode-free path
cannot normalize, because it never looks at the field, and *source-preserving*
is the guarantee a consumer is actually shopping for.

## Consequences

A reader who has used `JsoncFormatter.formatToString` recognizes
`YamlFormat.formatToString` on sight, and can predict that a package with a
genuinely different shape (`package-json`) will diverge in the value-path
name while keeping the shared text-path name. New format surfaces added to
the kit are checked against this naming before they ship, since renaming a
published static is a breaking change.


---
<!-- okf/conventions/format-package-convention.md -->
---
type: Convention
title: Format-package convention
description: How @effected/* packages expose formatting as distinct from validation, and the fidelity guarantee a kit formatter makes.
status: stable
stale_after: 2027-03-13T00:00:00Z
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 56015737879a155ff6561cca92d4b80cbf27de64a5593b4a95c9463d106ec1b7
---

# Format-package convention

The kit contains five packages that format text — `jsonc`, `yaml`, `toml`,
`markdown` and `package-json` — and this convention states the one seam they
all expose, so a new formatting surface is checked against a stated rule
rather than reinvented per package. It ratifies what the five packages had
already converged on independently rather than minting a further spelling.

## The driving constraint

Kit formatters ship into consumers' lint hooks — lint-staged, pre-commit.
Those hosts hand a formatter file contents and expect text back,
synchronously. Two properties follow, and they are the whole basis of the
rules below.

**C1 — a formatter must not hard-fail on legal input.** A strict path that
throws on `{"private": true}` or a version-less root — both perfectly legal
`package.json` files — is unusable as a lint handler, and the consumer routes
around the kit to whatever does work. A formatter that rejects legal input is
not a formatter.

**C2 — a formatter must not silently rewrite legal input into a
different-but-equivalent encoding.** Two bugs of this class shipped in
released packages, neither caught by its own suite: a model class with no
catch-all dropped unknown author keys on a read→write round trip, and a YAML
emitter wrote C0 control characters raw in plain scalars, corrupting on round
trip. Fidelity is the whole job of a kit containing four format packages, and
suites that test the emitter against the model do not catch fidelity bugs —
which is why the fidelity obligation below is the rule with the most teeth.

### Why a convention and not four local answers

Precedent from inside the kit: one consumer once wrote four differently-shaped
error folds for a single compile-plus-expand glob pattern inside one package,
because no kit package owned the seam, and that fan-out produced a real bug —
two divergent `dot` semantics in one package. Absent a stated convention, the
same fan-out happens across four format packages, on published surfaces that
cannot then be changed without a breaking release.

## The rules

Four rules, stated so a reviewer can check a package against them.

**P1 — the tolerant path is its own named entry point, never a flag.** A
`{ strict: false }` option on the strict path is banned: it makes the strict
path's return type a union of guarantees and hides the choice from the call
site and from `grep`.

**P2 — offer the shape(s) the hosts actually have, and route them through one
implementation.** Value→value and bytes→bytes are different hosts, not a
convenience pair; a package with only one kind of host ships only one entry
point. Two entry points that re-derive the same ordering will drift, so they
share the internal.

**P3 — the value path only reorders. It never adds or removes a key.** This is
what makes a `T → T` signature honest, and the type system enforces it: an
earlier `stripEmpty` option on the value path was rejected by `tsc`, because
removing a key makes `T → T` a lie. The option moved to the text path rather
than the return weakening to `Partial<T>`. A capability that must remove keys
belongs on the text path with an explicitly-defaulted-off option.

**P4 — input the formatter cannot handle is returned unchanged.** Never
partially rewritten. A formatter returning zero edits on a fatal parse error
and a value path passing non-objects through are the same rule.

## The five packages as they are

| Package | Formatting surface | Shape | Fails on bad input? |
| --- | --- | --- | --- |
| `jsonc` | `JsoncFormatter.format` / `.formatToString` (`packages/jsonc/src/JsoncFormatter.ts:33,48`) | `string → ReadonlyArray<JsoncEdit>` / `string → string` | No — pure and total |
| `yaml` | `YamlFormat.format` / `.formatToString` (`packages/yaml/src/YamlFormat.ts:799,826`) | same shape | No — malformed input yields no edits rather than corrupting the document |
| `toml` | `TomlFormat.format` / `.formatToString` (`packages/toml/src/TomlFormat.ts:775,790`) | same shape | No — same construction |
| `markdown` | `MarkdownFormat.format` / `.formatToString` (`packages/markdown/src/MarkdownFormat.ts:609,673`) | same shape | No — an unparseable document yields no edits |
| `package-json` | `PackageJsonFormat.sortValue` / `.formatToString` (`packages/package-json/src/PackageJsonFormat.ts:159,196`) | `T → T` / `string → Result<string, …>` | Text path fails on non-JSON only |

The four format packages converged independently on the same shape: a
`*Format`/`*Formatter` concept class carrying total statics, edit-based
(`format` returns edits, `formatToString` applies them), degrading to identity
when the document cannot be parsed. That convergence is the strongest
available evidence about what the convention should be. `MarkdownFormat` and
`PackageJsonFormat` also carry `modify`/`modifyToString`, which replace a node
or field through the canonical emitter — an editing operation rather than a
formatting entry point, and not governed by the [return-type
decision](../decisions/format-return-type.md).

`package-json` differs for a real reason: it is the only one of the five with
a schema between text and text, so it is the only one where a formatting path
could ever have hard-failed on legal input. The other four satisfy C1 by
construction.

The rest of the shape decisions — naming, which packages need a tolerant
seam, the return-type rule, the options-type rule, and the fidelity
obligation — each carry their own alternatives-rejected record: see
[format-naming](../decisions/format-naming.md),
[format-tolerant-seam](../decisions/format-tolerant-seam.md),
[format-return-type](../decisions/format-return-type.md),
[format-options-type](../decisions/format-options-type.md), and
[format-fidelity-obligation](../decisions/format-fidelity-obligation.md).
The return-type rule generalizes past formatting into the
[sync-primitive policy](sync-primitive-policy.md).

## Open notes

These points are open by design rather than settled, so a future change
finds them here instead of re-litigating from nothing:

1. Should the total formatters gain a way to signal "could not parse"?
   Recommendation is no change — totality is what makes them safe in a lint
   hook, and each package's `parse` entry point already provides the
   diagnostic to any host that needs it. Flagged because it is a real
   ergonomic gap and the decision should be conscious rather than inherited.
2. Is the `toml` oracle-differential pattern (property tests run against an
   independent reference implementation) worth replicating for `yaml` and
   `jsonc`? Not recommended as a mandate — both would need a reference
   implementation to differ against, reintroducing a dependency question for
   a devDependency-only benefit. The fidelity rules are the mandate; an
   oracle stays a per-package judgment call where a suitable reference
   exists.
3. Parity hardening is the next planned pass: complete frontmatter updates
   flowing through `markdown`'s edit layer, standardize the four packages'
   three different range-filter postures onto one, and then promote the
   kit's parity contract from shape-identical to behavior-identical.


---
<!-- okf/gotchas/api-extractor-forgotten-export-on-class-factories.md -->
---
type: Gotcha
title: "ae-forgotten-export on _base looks like a real export bug; it is a synthesized, un-nameable symbol"
description: API Extractor reports ae-forgotten-export on the anonymous heritage base an Effect class factory synthesizes; the fix is a narrow, logged suppression, never a hand-written base export.
status: stable
stale_after: "2027-03-13T00:00:00Z"
resource: ../../packages/config-file/savvy.build.ts
tags:
  - ci
  - dx
sources:
  - id: config-file-build
    resource: ../../packages/config-file/savvy.build.ts
  - id: config-file-md
    resource: ../../packages/config-file/CLAUDE.md
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 8de5398de96add599d22dafc7f889b133dc90c2af1d1ce60bad2213f8bbbda94
---

# ae-forgotten-export on _base looks like a real export bug; it is a synthesized, un-nameable symbol

## What a reader sees

A package build using `@savvy-web/bundler`'s API Extractor pass fails
CI-fatally with `ae-forgotten-export` naming a symbol like
`ConfigFile_base` or `SemVer_base` — a name that appears nowhere in the
package's source. The diagnostic reads exactly like every other
forgotten-export warning: "this type is referenced by an exported
declaration but is itself not exported."

## What a reader wrongly concludes

That some internal helper type needs an `export` keyword added, or that
a base class was accidentally left un-exported and needs to be split out
into its own `@public` const so API Extractor can see it.

## What is actually true

Effect class factories — `Schema.Class`, `Schema.TaggedClass`,
`Schema.TaggedError`, `Schema.Opaque`, `Context.Service` — produce an
anonymous heritage type at the call site
(`export class X extends Schema.Class<X>("X")({...}) {}`). API Extractor
names that anonymous base `X_base` in its emitted report and flags it as
forgotten, because the base genuinely has no name a consumer could ever
import — it is inlined into the exported class's own `.d.ts` shape, not
a separate declaration. There is nothing to export, because there is
nothing nameable to export.

House policy is to write the class factory inline — no split-out base
const, no hand-written annotation trying to name the anonymous type —
and suppress the synthesized-base warning narrowly in the package's
`savvy.build.ts`:

```typescript
tsdoc: {
  suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
},
```

`@effected/config-file`'s `savvy.build.ts` carries exactly this
suppression.[^config-file-build] The suppression is scoped to the
`_base` pattern only: it still shows up in the build's `issues.json`
under the `suppressed` bucket rather than disappearing silently, and it
must never be widened. An internal type named on a `@public` method or
return signature is a different symbol that also trips
`ae-forgotten-export` and genuinely needs fixing — either inlined
structurally or promoted to `@public` — because that one is real surface
a consumer can actually reach, unlike the un-nameable `_base` heritage
type.[^config-file-md]

## The check

Confirm a `savvy.build.ts` diagnostic names a `*_base` symbol before
reaching for the suppression, and confirm the package's `issues.json`
still lists it in `suppressed` (not silently absent) after adding the
entry — a suppression that vanishes the diagnostic from the report
entirely, rather than moving it to the suppressed bucket, is being
applied more broadly than the narrow pattern allows.

[^config-file-build]: `packages/config-file/savvy.build.ts:7` —
    `suppressWarnings: [{ messageId: "ae-forgotten-export", pattern:
    "_base" }]`.
[^config-file-md]: `packages/config-file/CLAUDE.md` §"The codecs" /
    testing section — "`savvy.build.ts` carries a narrow suppression …
    Never widen it."


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
