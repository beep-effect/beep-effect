# package-json (lab port of @effected/package-json)

package.json parsing, editing, validation and file IO as Effect schemas. `Package` is a `Schema.Class` with the manifest's known fields typed — `name` is a branded npm name, `version` is a real `SemVer`, `packageManager` decodes into `{ name, version, integrity }` — and a `rest` catch-all that carries every unknown top-level key through a read, edit and write cycle without losing it. Editing is immutable and dual-signature, validation is a rule set you can replace, and `catalog:` / `workspace:` specifiers expand through the `@effected/npm` resolver contracts as an explicit step you opt into.

## Why @effected/package-json

Tools that rewrite a package.json usually treat it as a `Record<string, unknown>`: read it, mutate a key, `JSON.stringify` it back. That works right up until it does not. Unknown keys survive by accident rather than by design, `version` is a string you compare with `<`, and the day someone's manifest has a field your types never modeled is the day you find out whether your write path preserved it. The alternative — a strict schema over the *known* fields — usually solves the typing by deleting everyone's data.

This package refuses both. Known fields are typed and validated; everything else lands in `rest` and is flattened back to top-level keys on encode, so the on-disk shape never grows a literal `rest` key and never loses your `customTool` block. Serialization applies the canonical `sort-package-json` key order, alphabetizes dependency maps and strips empty ones, deterministically and locale-independently. `PackageJsonFile.write` does not silently resolve your `workspace:` specifiers on the way out, because a write that quietly rewrites your dependency values is not a write, it is a policy — so `Package.resolve` is a step you compose in deliberately. And every distinct failure has its own tag: a missing file, an unreadable file, invalid JSON and a document that does not satisfy the schema are four different problems with four different recoveries.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`effect` v4 is the only peer dependency. `@effected/semver` and `@effected/npm` come along as ordinary dependencies — they back the `version` field and the resolver contracts — and `spdx-expression-parse` is the one external package in the tree, used to validate SPDX license expressions.

Reading and writing files needs a `FileSystem` and a `Path` implementation, provided once at the edge, from `@effect/platform-node` on Node. Everything except `PackageJsonFile` is pure and needs no platform layer at all.

## Quick start

Decode a manifest, edit it, read the computed properties back:

```ts
import { Package } from "@beep/scratchpad/effected/package-json/Package";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pkg = yield* Package.decode({ name: "@acme/widget", version: "1.0.0", private: true });
  const next = yield* Package.setVersion(pkg, "1.1.0");
  return [next.name, next.version.toString(), next.isScoped, next.isPrivate];
});

console.log(Effect.runSync(program));
// => ["@acme/widget", "1.1.0", true, true]
```

`next.version` is a `SemVer`, not a string, so you compare it with `SemVer.gt` and bump it with `version.bump.minor()` rather than reaching for a regex.

## The Package model

Editing returns a new `Package`. The mutation statics are dual, so `Package.addDependency(pkg, "effect", "^4.0.0")` and `pkg.pipe(Package.addDependency("effect", "^4.0.0"))` are the same call. The ones that can fail — `setVersion`, `setName`, `setLicense` — return an `Effect` with the corresponding typed error, and the rest are plain functions.

Unknown keys round-trip. `toJsonString` encodes through the wire codec, flattens `rest` back to the top level, and applies the canonical key order:

```ts
import { Package } from "@beep/scratchpad/effected/package-json/Package";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pkg = yield* Package.decode({
    name: "widget",
    version: "1.0.0",
    scripts: { build: "tsc" },
    customTool: { flag: true },
  });
  return Package.addDevDependency(pkg, "typescript", "^6.0.0").toJsonString();
});

console.log(Effect.runSync(program));
// {
//   "name": "widget",
//   "version": "1.0.0",
//   "scripts": {
//     "build": "tsc"
//   },
//   "devDependencies": {
//     "typescript": "^6.0.0"
//   },
//   "customTool": {
//     "flag": true
//   }
// }
```

`toJsonString` takes `PackageFormatOptions` — `indent`, `sort`, `stripEmpty`, `newline` — if you want the raw shape instead of the canonical one.

Alongside `Package` the leaf concepts are usable on their own. `PackageName` classifies and validates npm names (`isValid`, `isScoped`, `scope`, `unscoped`) and brands them as `ScopedPackageName` or `UnscopedPackageName`. `DependencySpecifier` classifies any specifier string into one protocol — `range`, `tag`, `git`, `url`, `npm`, `file`, `link`, `portal`, `catalog`, `workspace` or `unknown` — and parses the range case into a `Range` from `@effected/semver`. `Dependency` pairs a name with a specifier and the `kind` of map it came from, exposing the same protocol predicates as getters.

## Reading and writing

`PackageJsonFile` is the only IO in the package: one service, two methods, over core `FileSystem` and `Path`.

```ts
import { PackageJsonFile } from "@beep/scratchpad/effected/package-json/PackageJsonFile";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const bumpMinor = Effect.gen(function* () {
  const files = yield* PackageJsonFile;
  const pkg = yield* files.read("./package.json");
  const next = pkg.copyWith({ version: pkg.version.bump.minor() });
  yield* files.write("./package.json", next);
});

const PlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const program = bumpMinor.pipe(Effect.provide(PackageJsonFile.layer), Effect.provide(PlatformLive));
console.log(Effect.isEffect(program)) // true
```

`read` fails four different ways and says which: `PackageJsonNotFoundError` when the file is not there, `PackageJsonReadError` for any other filesystem failure, `PackageJsonParseError` when the bytes are not JSON, and `PackageDecodeError` when the JSON is not a package.json. There is no `exists` pre-check, so a file deleted between the check and the read cannot be misreported as an IO error.

## Validation

`PackageValidator` runs a rule set over a decoded `Package` and aggregates *every* failure into one `PackageValidationError`, rather than stopping at the first.

```ts
import { Package } from "@beep/scratchpad/effected/package-json/Package";
import { PackageValidator } from "@beep/scratchpad/effected/package-json/PackageValidator";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pkg = yield* Package.decode({ name: "widget", version: "1.0.0" });
  const validator = yield* PackageValidator;
  return yield* validator.validate(pkg);
}).pipe(
  Effect.provide(PackageValidator.layer),
  Effect.catchTag("PackageValidationError", (error) => Effect.succeed(error.failures.map((failure) => failure.rule))),
);

console.log(Effect.runSync(program));
// => ["has-license", "has-description", "has-repository"]
```

`PackageValidator.layer` carries the default rules (`has-license`, `has-description`, `has-repository`, `not-private`). `PackageValidator.layerRules({ rules })` takes your own set instead — a `ValidationRule` is a name plus a check that fails with a `RuleFailure`. Two extra rules ship for publish gates: `noUnresolvedDepsRule` fails on any `workspace:` or `catalog:` specifier still in the manifest, and `noLocalDepsRule` fails on `file:`, `link:` and `portal:`.

## Resolving catalog: and workspace: specifiers

`Package.resolve` expands `catalog:` and `workspace:` specifiers across all four dependency maps, using the `CatalogResolver` and `WorkspaceResolver` contracts from `@effected/npm`. This package deliberately cannot implement them — it has no view of the workspace — so the implementation arrives from context. `@effected/workspaces` provides the real ones; a fixed record does fine for a test.

Specifiers the resolvers answer `None` for are left exactly as they were.

```ts
import { CatalogResolver, WorkspaceResolver } from "@beep/scratchpad/effected/npm/index";
import { Package } from "@beep/scratchpad/effected/package-json/Package";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

const Resolvers = Layer.mergeAll(
  Layer.succeed(CatalogResolver, { rangeOf: () => Effect.succeed(O.some("^4.0.0")) }),
  Layer.succeed(WorkspaceResolver, { versionOf: () => Effect.succeed(O.some("1.4.0")) }),
);

const program = Effect.gen(function* () {
  const pkg = yield* Package.decode({
    name: "widget",
    version: "1.0.0",
    dependencies: { effect: "catalog:", "@acme/core": "workspace:^" },
  });
  const resolved = yield* Package.resolve(pkg);
  return [
    O.getOrElse(HashMap.get(resolved.dependencies, "effect"), () => "unresolved"),
    O.getOrElse(HashMap.get(resolved.dependencies, "@acme/core"), () => "unresolved"),
  ];
}).pipe(Effect.provide(Resolvers));

console.log(Effect.runSync(program));
// => ["^4.0.0", "^1.4.0"]
```

The `workspace:` range modifier is honored: `workspace:*` takes the bare version, `workspace:^` and `workspace:~` prefix it, and an explicit modifier is used as-is. The projection is `@effected/npm`'s `DependencySpecifier` statics with full pnpm publish semantics: the alias form `workspace:<name>@<range>` resolves the *target* package's version and becomes the `npm:<name>@<range>` alias pnpm publishes, and a blank catalog name selects the default catalog. A failed catalog assembly surfaces typed as `@effected/npm`'s `CatalogAssemblyError`, alongside the contracts' `DependencyResolutionError`.

## Lenient discovery

`Package.decode` and `PackageManifest` are strict: a malformed field fails the whole document. That is the right behavior for a manifest you are about to write or publish, and the wrong one for a manifest you are only sniffing — a fetched tarball, a `node_modules` walk, a registry response — where the document is someone else's data and one bad field should not sink the read. `LenientManifest` is that discovery tier: every `Package` field decodes to its plain permissive JSON shape (`name` and `version` accept any string, not the branded npm grammar; `license` accepts any string, no SPDX check; the dependency maps are plain records, not `HashMap`s). A field present but not even that shape degrades to absence instead of failing the document, its raw value is preserved verbatim in `rest` (a malformed known field is treated exactly like an unknown one), and the degradation is reported on `issues`:

```ts
import { LenientManifest } from "@beep/scratchpad/effected/package-json/LenientManifest";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const sniffed = yield* LenientManifest.decode({ name: "JSONStream", version: "1.0", license: 42 });
  return [sniffed.name, sniffed.version, sniffed.issues, sniffed.rest?.license];
});

console.log(Effect.runSync(program));
// [
//   "JSONStream",
//   "1.0",
//   [{ field: "license", expected: "a string", value: 42 }],
//   42,
// ]
```

Leniency is per-field, never per-syntax: `decodeResult`/`decode` still fail typed with `PackageDecodeError` when the input is not a JSON object at all (`null`, an array, a scalar), and `parseResult`/`parse` — the pair that also handles the raw `JSON.parse` — fail typed with `PackageJsonSyntaxError` when the text is not valid JSON or does not parse to an object. Each pair follows the package's usual shape: `decodeResult`/`parseResult` are the synchronous `Result` primitives, `decode`/`parse` are their `Effect` forms with a tracing span.

An empty `issues` array is not a validity guarantee — the permissive shapes check JSON shape, not npm semantics, so a `LenientManifest` with no issues can still fail `Package.decode`. `LenientManifest` carries no mutation statics and no write path; once you need to validate or edit, re-decode the *original* input through `PackageManifest.decode` (presence-lenient, shape-on-presence strict) or `Package.decode` (strict, publishable).

## Resolving an entry point

`resolveEntryPoint` answers one question about a manifest — which file is the package's `"."` entry — and it is pure, IO-free and `Result`-returning, so it works against a plain object with no package on disk:

```ts
import { resolveEntryPoint } from "@beep/scratchpad/effected/package-json/EntryPoint";
import * as Result from "effect/Result";

console.log(Result.getOrThrow(resolveEntryPoint({ exports: { import: "./esm.js", require: "./cjs.js" } }))) // "./esm.js"

console.log(Result.getOrThrow(resolveEntryPoint({ exports: { require: "./cjs.js" } }, { conditions: ["require"] }))) // "./cjs.js"

// No exports field, so main applies.
console.log(Result.getOrThrow(resolveEntryPoint({ main: "./legacy.js" }))) // "./legacy.js"

const unmatched = resolveEntryPoint({ exports: { require: "./cjs.js" }, main: "./legacy.js" });
console.log(Result.isFailure(unmatched)) // true
if (Result.isFailure(unmatched)) {
  console.log(unmatched.failure.reason) // "noConditionMatched"
}
```

All three legal `exports` spellings are honored — the string shorthand, a subpath map, and conditions at the root with no `"."` key — and conditions default to `["import", "default"]`, in priority order.

The last case above is the semantic worth knowing: **`exports` encapsulates the package**, so a present-but-unmatched `exports` is a typed failure and `main` is *not* consulted. That is Node's rule. The lenient reading — falling through to `main`, then to `index.js` — answers a file the package deliberately does not export, and it loads and behaves plausibly instead of failing. Only an **absent** `exports` reaches `main`, and then the legacy `index.js` default. An `exports` form the resolver does not implement (an array fallback list, or a subpath map with no `"."` entry) fails for its own reason rather than being guessed at.

Pair it with `@effected/npm`'s `PackageTarball` to find the entry file inside a tarball extracted before any install has run.

## Errors

Every failure is a `Schema.TaggedError` routed with `Effect.catchTag`. Causes are preserved structurally on a `Schema.Defect` field — a `PackageDecodeError` hands you the `SchemaError` issue tree, not `String(error)`.

| Tag | Means |
| --- | ----- |
| `PackageJsonNotFoundError` | No file at the path. Often not an error at all: fall back, or walk up. |
| `PackageJsonReadError` | The file is there and could not be read. Carries `path` and the structural `cause`. |
| `PackageJsonParseError` | The bytes are not JSON. Carries `path` and the `SyntaxError`. |
| `PackageDecodeError` | The JSON is not a package.json. Carries the `SchemaError` cause with its issue tree. |
| `PackageJsonWriteError` | The write failed. Narrowed to the filesystem failure only, never an encode error. |
| `PackageValidationError` | One or more validation rules failed. Carries every `failure`, each with its rule name, message and JSON path. |
| `InvalidPackageNameError` | A string does not satisfy npm's naming rules. Raised by `Package.setName`. |
| `InvalidSpdxLicenseError` | A string is not a valid SPDX license expression. Raised by `Package.setLicense`. |
| `InvalidDependencySpecifierError` | A string is not a recognized dependency specifier. Raised by `DependencySpecifier.decode`. |
| `UnresolvedEntryPointError` | No entry point could be resolved from a manifest. Returned in a `Result` by `resolveEntryPoint`, never raised, with `reason` telling `noConditionMatched`, `noRootExport` and `unsupportedExportsForm` apart. |

`Package.setVersion` fails with `InvalidVersionError` from `@effected/semver`, which is where the version grammar lives.

## Features

- `Package` — the manifest model: typed known fields, the `rest` catch-all, computed getters (`isPrivate`, `isScoped`, `isESM`, `hasDependency`, the four `get*Dependencies`), dual mutation statics, `copyWith`, `Package.decode` and the pure `toJsonString` serializer.
- `Package.schema` / `Package.wireFor` — the open-JSON ↔ class wire codec, and the factory that builds one for a `.extend()`ed subclass so its custom fields decode as typed members instead of falling into `rest`.
- `PackageJsonFile` — the IO surface: `read` and `write` over core `FileSystem` / `Path`, with the platform implementation supplied at the edge.
- `PackageValidator` — rule-based validation aggregating every failure, with the default rule set, a parameterized `layerRules` factory, and the publish-gate rules `noUnresolvedDepsRule` and `noLocalDepsRule`.
- `resolveEntryPoint` — the pure, `Result`-returning entry-point resolver over a manifest's `exports`/`main`, honoring `exports` encapsulation rather than falling through to `main`, with `EntryPointManifest` as its tolerant input shape.
- `LenientManifest` — the shape-lenient discovery tier below `PackageManifest`: malformed known fields degrade to absence, are preserved verbatim in `rest` and reported on `issues`, rather than failing the document; `decodeResult`/`decode` and `parseResult`/`parse` in the package's usual `Result`/`Effect` pairing.
- `Package.resolve` — `catalog:` and `workspace:` expansion over the `@effected/npm` contracts with pnpm's publish-time projection (alias form included), as an explicit step that `write` never performs for you.
- `PackageName`, `DependencySpecifier`, `Dependency`, `SpdxLicense`, `PackageManager`, `Person`, `Repository`, `Bugs`, `Funding`, `DevEngine` — the leaf concepts, each owning its own statics, brand and error, usable independently of `Package`. `Repository` and `Bugs` decode the `repository` and `bugs` fields from either their shorthand or object form, the same way `Person` does for `author`, `contributors` and `maintainers`; `Repository` also exposes `browseUrl` and `gitUrl` getters that normalize a shorthand or SSH form to `https://`.
- `Repository.directoryUrl` — the browse URL of a monorepo member's own subdirectory, built from `repository.directory` against the host's path convention on GitHub, GitLab and Bitbucket. `none` for a host whose convention is unknown, or for a `directory` that climbs out of the repository — a guessed path would resolve to nothing while looking authoritative. With no `directory`, it is `browseUrl`.
- `Funding` — the `funding` field, decoded from a bare URL string, an object, or an array of either, and **always** to an array so a consumer never branches on arity. Each entry re-encodes in the form it was read from, and unrecognized keys survive in `rest`.
- `licenseExpressionOf` — a `SpdxLicense` as an `Option<SpdxExpression>` from `@effected/spdx`, for a caller that wants the parsed expression rather than the string. `none` for the `SEE LICENSE IN …` and `UNLICENSED` forms, which are valid `license` values but not license expressions.
- `Package` also types `keywords`, `maintainers` and `homepage` directly, alongside the existing `author` and `contributors`.
- Field schemas (`DependencyMapField`, `BinField`, `ExportsField`, `PublishConfigField`, `PeerDependenciesMetaField`, `StringMapField`) exported for subclasses that extend the model. `RepositoryField` is exported too but deprecated: `Package.repository` now decodes through `Repository.FromValue`, which round-trips the original shorthand or object form; `RepositoryField` remains only for consumers still matching on the raw union.

## License

[MIT](LICENSE)

## Port notes

### Attribution

- Upstream package: `@effected/package-json` 0.20.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/package-json/License.ts:1 // SPDX license validation: the `SpdxLicense` branded schema (accepting real
- scratchpad/effected/package-json/License.ts:2 // SPDX expressions plus the `UNLICENSED` and `SEE LICENSE IN` special cases)
- scratchpad/effected/package-json/License.ts:3 // and the `InvalidSpdxLicenseError` the concept raises.
- scratchpad/effected/package-json/License.ts:11 * Indicates that a string is not a valid SPDX license identifier or expression.
- scratchpad/effected/package-json/License.ts:13 * Raised by {@link Package.setLicense} and the decode direction of
- scratchpad/effected/package-json/License.ts:14 * `SpdxLicense`. The offending string is preserved on `input`.
- scratchpad/effected/package-json/License.ts:18 export class InvalidSpdxLicenseError extends Schema.TaggedError<InvalidSpdxLicenseError>()("InvalidSpdxLicenseError", {
- scratchpad/effected/package-json/License.ts:23 return `Invalid SPDX license "${this.input}": not a recognized identifier or expression`;
- scratchpad/effected/package-json/License.ts:28 * Whether a string is a valid SPDX license identifier or expression, or one of
- scratchpad/effected/package-json/License.ts:29 * the npm special cases `UNLICENSED` / `SEE LICENSE IN <file>`.
- scratchpad/effected/package-json/License.ts:34 if (value === "UNLICENSED") return true;
- scratchpad/effected/package-json/License.ts:35 if (value.startsWith("SEE LICENSE IN ") && value.length > "SEE LICENSE IN ".length) return true;
- scratchpad/effected/package-json/License.ts:40 * A valid SPDX license identifier, expression, `UNLICENSED`, or
- scratchpad/effected/package-json/Package.ts:17 import { InvalidSpdxLicenseError, SpdxLicense, isValidSpdx } from "./License.ts";
- scratchpad/effected/package-json/PackageValidator.ts:28 /** The rule identifier (e.g. `has-license`). */
- scratchpad/effected/package-json/index.ts:8 * `SpdxLicense`, {@link PackageManager}, {@link Person}, {@link DevEngine},
- scratchpad/effected/package-json/internal/format.ts:6 // Private implementation module — never re-exported from `index.ts`.
- scratchpad/effected/package-json/internal/format.ts:31 "license",
- scratchpad/effected/package-json/internal/wire.ts:8 // Private implementation module — never re-exported from `index.ts`.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab replaces native membership, record and sorting operations with Effect helpers while preserving formatting and null-prototype storage. (scratchpad/test/package-json/Format.test.ts:167; scratchpad/test/package-json/LenientManifest.test.ts:127; scratchpad/test/package-json/Package.test.ts:174)
- **identity-keys** — The lab stores wire provenance and Funding arity in private instance fields instead of upstream WeakMaps and WeakSet. (scratchpad/test/package-json/Funding.test.ts:92; scratchpad/test/package-json/Person.test.ts:77; scratchpad/test/package-json/Person.test.ts:109; scratchpad/test/package-json/Repository.test.ts:355,394)
- **tagged-errors** — The lab propagates typed JsoncStringifyError failures through modify APIs whose upstream error channels lacked that member. (scratchpad/test/package-json/Modify.test.ts:127; module suite scratchpad/test/package-json/**)
- **schema-first** — The lab uses schema-owned models, an S.Opaque PackageName and JSON codecs whose SchemaError failures and undefined-output rejection replace upstream native JSON behavior. (scratchpad/test/package-json/PackageName.test.ts:45,55; scratchpad/test/package-json/PackageJsonFormat.test.ts:220; scratchpad/test/package-json/LenientManifest.test.ts:228; scratchpad/test/package-json/EntryPoint.test.ts:51)
- **numeric-domains** — The lab rejects non-finite numeric error-path segments through S.Finite where upstream Schema.Number accepted them. (scratchpad/test/package-json/Modify.test.ts:127; module suite scratchpad/test/package-json/**)
- **type-safety** — The lab removes unsafe assertions with generic codecs, schema guards and typed tests, retaining only the approved deliberatelyInvalid helper cast. (scratchpad/test/package-json/Package.test.ts:107,118,227; scratchpad/test/package-json/PackageJsonFormat.test.ts:83; scratchpad/test/package-json/Funding.test.ts; scratchpad/test/package-json/deliberatelyInvalid.ts)
- **tsgo-diagnostics** — The lab adds tsgo-required dual overloads and Effect.fn callbacks, with explicit options required for empty or extension-only direct entry-point manifests. (scratchpad/test/package-json/EntryPoint.test.ts:22,30,39; scratchpad/test/package-json/Format.test.ts:25,36; module suite scratchpad/test/package-json/**)
- **effect-first** — The lab wraps generator helpers in Effect.fn and uses Effect helpers and Match where upstream used bare generators and native operations. (scratchpad/test/package-json/integration/PackageJsonFile.int.test.ts; scratchpad/test/package-json/PackageValidator.test.ts; scratchpad/test/package-json/Repository.test.ts; scratchpad/test/package-json/Resolve.test.ts)
- **effect-imports** — The lab imports individual effect modules where upstream used the root effect barrel. (module suite scratchpad/test/package-json/**)
- **identity-annotations** — The lab adds owning Beep identity keys and annotations where upstream used short or @effected identifiers without that metadata. (scratchpad/test/package-json/PackageName.test.ts:45,114; scratchpad/test/package-json/License.test.ts:24; scratchpad/test/package-json/PackageFields.test.ts:9; scratchpad/test/package-json/PackageManagerRange.test.ts:25)
- **upstream-bug** — The lab preserves nested sorted-map __proto__ data that upstream sorting dropped. (scratchpad/test/package-json/Format.test.ts:185)
- **upstream-bug** — The lab preserves top-level __proto__ data in default rendering that upstream sorting dropped. (scratchpad/test/package-json/Package.test.ts:174,199)

### Dependency backlog

None.
