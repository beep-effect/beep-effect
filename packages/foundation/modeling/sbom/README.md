# @beep/sbom

Software-supply-chain artifacts as Effect schemas: a CycloneDX 1.6 SBOM, an NTIA minimum-elements report, in-toto statements, SLSA provenance, the Sigstore bundle value and the workload identity token contract. `Sbom.generate` and `Sbom.toJson` are total, plain functions — assembling and serializing a document cannot fail, so the package's only fallible member is `Sbom.write`, the one that touches a filesystem.

## Why @beep/sbom

`@cyclonedx/cyclonedx-library` is 6.6 MB with seven optional peer dependencies for around ten symbols an emitter needs — an object model and a JSON normalizer. The parts that would justify the weight (XML output, schema validation, SPDX expression parsing) are exactly the parts an emitter never calls, and its `spdx-expression-parse` peer would install a second SPDX engine beside `@beep/spdx`. This package owns its CycloneDX 1.6 model instead, and proves conformance against the published schema in its tests rather than promising it through a dependency.

Emitting an SBOM and signing one are different kinds of work: pure computation over a manifest versus network-bound cryptography against Fulcio and Rekor. This package is the first half only. Every module reaches nothing but `effect`, `@beep/identity`, `@beep/schema` and `@beep/spdx`, plus `@beep/package-json` as a type-only import, and `test/reachability.test.ts` walks the runtime import graph to pin that no module reaches `@sigstore/*`, a `node:*` builtin or the runtime half of `@beep/package-json`. The Sigstore DSSE signer stays in the effected lab as the deferred `@beep/sigstore` half; it consumes `IdentityToken` and produces `SigstoreBundle` from here, so a verifier or a store can name both shapes without loading Fulcio's transport.

A license is a CycloneDX **expression** field with three legal shapes — `{license:{id}}` for a catalog identifier, a one-element `[{expression}]` tuple for an expression like `MIT OR Apache-2.0`, and `{license:{name}}` for anything else — and choosing between them is `@beep/spdx`'s job (`License.isKnownId`, `isValidExpression`), never a local regex.

The package is ESM-only and `private` to this workspace. Import it from the `@beep/sbom` root or from a `@beep/sbom/<Module>` leaf. `Sbom.write` needs a `FileSystem` in `R`, provided once at the edge; everything else needs no layer at all.

## Usage

### Quick start

Generating an SBOM needs no layer, no service and no network call:

```ts
import { Package } from "@beep/package-json/Package";
import { Sbom } from "@beep/sbom/Sbom";
import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pkg = yield* Package.decode({ name: "@acme/app", version: "1.0.0", license: "MIT" });
  const document = Sbom.generate({
    root: SbomMetadataSource.rootComponent(pkg),
    components: [SbomMetadataSource.componentFor({ name: "effect", version: "4.0.5", license: "MIT" })],
    metadata: SbomMetadataSource.fromPackage(pkg, { timestamp: "2026-10-23T00:00:00.000Z" }),
  });
  return Sbom.toJson(document);
});

console.log(Effect.runSync(program));
// canonical CycloneDX 1.6 JSON: component names sorted, so two runs over the
// same inputs produce identical bytes
```

Components are sorted by name, in code-unit order rather than a locale collation, so the document's digest — which becomes an attestation subject — does not change between runs over the same inputs. The models are branded `S.Opaque` records: `Sbom.generate` takes admitted components (from `Component.make`, `SbomMetadataSource` or a decode), assembles the document around them and admits it with one `SbomDocument.make`, which copies, so the returned components are never the caller's objects. Because its inputs are already valid, that `make` cannot throw; an invalid component, such as one with an empty `bomRef`, fails where it is built. The option functions take each input's `Encoded` shape, so object literals work there.

`fromPackage` and `rootComponent` take a `Package` from `@beep/package-json`. A manifest never says which organization supplied the software, who assembled the BOM, or when, so `supplier`, `authors` and `timestamp` are explicit options, never derived.

### NTIA compliance

`NtiaReport.of` is total: it answers for every document, including one that satisfies nothing.

```ts
import { NtiaReport } from "@beep/sbom/NtiaReport";
import { Sbom } from "@beep/sbom/Sbom";
import { Component } from "@beep/sbom/SbomDocument";

const root = Component.make({ type: "library", name: "lib", version: "1.0.0" });
const report = NtiaReport.of(Sbom.generate({ root, components: [] }));

console.log(report.compliant); // false
console.log(report.missing.join(", ")); // supplierName, uniqueIdentifier, sbomAuthor, timestamp
```

### Provenance and attestation

`InTotoStatement` and `SlsaProvenance` build the predicate an attestation wraps around an SBOM or a build. Both are pure projections of their input — nothing is read from the environment, and nothing can fail:

```ts
import { InTotoStatement, Sha256Digest } from "@beep/sbom/InTotoStatement";
import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
import { SlsaProvenance } from "@beep/sbom/SlsaProvenance";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const digest = yield* Sha256Digest.parse("ab".repeat(32));
  const provenance = SlsaProvenance.forGitHubWorkflow({
    serverUrl: "https://github.com",
    repository: "acme/widget",
    ref: "refs/heads/main",
    sha: "0123456789abcdef0123456789abcdef01234567",
    eventName: "push",
    workflowRef: "acme/widget/.github/workflows/release.yml@refs/heads/main",
    jobWorkflowRef: "acme/widget/.github/workflows/release.yml@refs/heads/main",
    repositoryId: "1",
    repositoryOwnerId: "1",
    runnerEnvironment: "github-hosted",
    runId: "1",
    runAttempt: "1",
  });
  return InTotoStatement.forSubject({
    name: SbomMetadataSource.npmPurl("@acme/widget", "1.0.0"),
    digest,
    predicateType: SlsaProvenance.predicateType,
    predicate: provenance,
  });
});

console.log(Effect.runSync(program).toJson().length > 0); // true
```

`serverUrl` is a required field rather than an ambient `GITHUB_SERVER_URL` read: upstream `@actions/attest` writes the literal string `undefined` into every URL when that variable is unset.

### The identity token contract

`IdentityToken` is the narrow, one-method OIDC contract a signer runs on, deliberately smaller than any real issuer's surface. On a GitHub runner the lab `github-actions` module serves it (`ActionsIdentityToken.layer`, over its `OidcTokenIssuer`); a caller that already holds a token uses `IdentityToken.layerStatic`, and tests use `IdentityToken.layerTest`, which answers rather than dying:

```ts
import { IdentityToken } from "@beep/sbom/IdentityToken";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const program = Effect.gen(function* () {
  const issuer = yield* IdentityToken;
  return Redacted.isRedacted(yield* issuer.token("sigstore"));
});

console.log(Effect.runSync(program.pipe(Effect.provide(IdentityToken.layerStatic("example-token"))))); // true
```

### Errors

`Sbom.write` fails with `SbomWriteError` (the path and the filesystem cause), `IdentityToken.token` with `IdentityTokenError` (the audience and the cause), and `Sha256Digest.parse` with `InvalidSha256DigestError` (the offending input). Nothing else has an error channel.

## Features

- `Sbom` — `generate` (total over admitted components: it takes `SbomInput.Admitted`, so an invalid component fails at the caller's `Component.make`, and makes one admission per document), `toJson` (total, canonical CycloneDX 1.6, `bomRef` emitted as `bom-ref`), and `write` (the one fallible member, over core `FileSystem`).
- `SbomDocument` — the owned CycloneDX 1.6 model: `Component`, `ComponentType`, `ExternalReference`, `ExternalReferenceType`, `Contact`, `Supplier`, `SbomMetadata`, `SbomDocument`.
- `SbomMetadataSource` — manifest-derived metadata: `npmPurl`, `componentFor`, `rootComponent`, `externalReferences`, `fromPackage`, `formatCopyright`, `merge`, with `SbomMetadataOptions`, `ComponentInput` and `CopyrightYears`.
- `NtiaReport` — the seven NTIA minimum elements as a total report (`compliant`, `missing`), with `NtiaElement` and `NtiaElementId`.
- `InTotoStatement` — `of` / `forSubject` / `toJson`, over `InTotoSubject` and a validated `Sha256Digest`.
- `SlsaProvenance` — `forGitHubWorkflow`, a total projection to a SLSA Provenance v1 predicate, byte-compatible with `@actions/attest`.
- `SigstoreBundle` — the bundle value and the media-type constants, importing nothing from `@sigstore/*`.
- `IdentityToken` — the workload identity contract, with `layerStatic`, `makeTest` and `layerTest`.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/sbom

# from packages/foundation/modeling/sbom
bun run check
bun run test
```

`test/conformance.test.ts` derives its expectations from the vendored CycloneDX 1.6 schema, and
`test/conformance.ajv.test.ts` validates whole documents against it with `ajv` (exact devDependency pins). See
[`test/fixtures/VENDORED.md`](./test/fixtures/VENDORED.md) for the vendored files, including the SPDX and JSF sibling
schemas the CycloneDX schema `$ref`s. `goals/effected-promotion/ops/sbom-corpus.ts` generates an SBOM for every tracked repo
manifest and records the schema, NTIA and byte-stability verdicts
(`goals/effected-promotion/research/sbom-corpus-w4.json`).

## Provenance

`@beep/sbom` is ported from upstream `@effected/sbom` 0.10.0 (MIT, C. Spencer Beggs) at commit
`af7566a9da2eff169cb74955efcc5ede1e5de9f8`. It was carried through the effected port in `scratchpad/effected/sbom`
(pure half last held at `a6ca837ca9d641e797833ff43d18e192a428c7d4`), and its pure half was promoted into this
workspace package by `goals/effected-promotion` (wave 4-S, SPEC W4-b); the Sigstore signer is the deferred
`@beep/sigstore` half, deleted from the lab when the packet closed (restore it from
`bb2134fcb952e07580c4cebf2586c901f090ef5b`). The package [LICENSE](./LICENSE) carries both the beep-effect and the
upstream copyright notices. [KNOWLEDGE.md](./KNOWLEDGE.md) holds the upstream knowledge bundle verbatim; its relative
links point into the upstream checkout. The port reviews and the lab's canon exceptions are archived under
`goals/effected-promotion/history/`.

Promotion changes, beyond the lab port recorded below:

- The root barrel no longer exports `SigstoreSigner`, `SigningError`, `SigningErrorKind` or
  `SIGSTORE_OIDC_AUDIENCE`; they belong to the deferred `@beep/sigstore` signer, and nothing in this package reaches `@sigstore/*`.
- The ten member-less model classes, the two static-only records (`InTotoSubject`, `SlsaProvenance`) and the eight
  option and input structs are branded `S.Opaque`; `InTotoStatement` and `NtiaReport` stay `S.Class`. Values are
  plain objects: membership is the structural `S.is`, and `make` validates and copies, so no caller may rely on
  reference identity. Functions take `X.Encoded`, except `InTotoStatement.forSubject`, which takes the make input so
  the digest stays a validated `Sha256Digest`. The data-first dispatch of `Sbom.toJson` and `Sbom.write` reads the
  `bomFormat` key instead of a structural check.
- The five input and option structs that upstream typed `?: T | undefined` (`SbomInput.metadata`,
  `SbomJsonOptions.space`, `SbomMetadataOptions`, `ComponentInput`, `CopyrightYears.startYear`) keep the lab's exact
  `S.optionalKey` (EF-40): a caller omits an absent field, and a present key holding `undefined` is rejected, both by
  the type checker and by decoding. The document model is `S.optionalKey` too, as upstream has it.
- `Component.bomRef` is non-empty, as the CycloneDX `refType` (`minLength: 1`) requires; upstream accepted `""`
  and emitted a document the schema rejects.
- `Contact.email` is the named external-protocol schema `ContactEmail` (passed through verbatim).
- The reachability test reads Vite-inlined source text instead of parsing the filesystem through `TsNativeApi`, so it
  runs under the package's Bun test runner.
- Identity strings re-key from `@beep/scratchpad/effected/sbom` to `@beep/sbom`.

## Port notes

### Attribution

- Upstream package: `@effected/sbom` 0.10.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (beep-effect notice plus the verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

`SbomInput`, `SbomJsonOptions`, `SbomMetadataOptions`, `ComponentInput`, `CopyrightYears`, `InTotoStatementInput`,
`InTotoSubjectInput` and `GitHubWorkflowProvenance` are runtime schemas (upstream declared them as interfaces), each
with an `Encoded` companion type.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence, each with the tests in this
package that pin it. The `sbom` row of the lab ledger
(`bb2134fcb952e07580c4cebf2586c901f090ef5b:scratchpad/effected/PORT_LEDGER.json`) keeps the lab-era evidence under the
pre-promotion `scratchpad/test/sbom/` paths, which resolve at `a6ca837ca9d641e797833ff43d18e192a428c7d4`; the port
reviews are archived in `goals/effected-promotion/history/port-reviews/sbom/`.

- **native-runtime** — The lab replaces upstream `Object.entries`, `Date.parse`, `Object.assign` schema statics and native `Error` with Effect Record/Schema facilities, `S.Opaque` statics and a tagged error. (test/Sbom.test.ts; test/NtiaReport.test.ts; test/InTotoStatement.test.ts)
- **identity-keys** — The lab registers `IdentityToken` with a package `IdentityComposer` key instead of the upstream `@effected/sbom` service key. (test/IdentityToken.test.ts)
- **schema-first** — The lab replaces eight upstream input interfaces with runtime schemas, named literal domains with `LiteralKit`, digest and NTIA predicates with schema guards and `JSON.stringify` with schema codecs that preserve successful bytes but surface `SchemaError` on failure. (test/InTotoStatement.test.ts; test/Sbom.test.ts; test/NtiaReport.test.ts)
- **numeric-domains** — The lab rejects non-finite `SbomDocument` revisions accepted by upstream `Schema.Number` and gives the indentation and year schemas finite-number domains. (module suite test/**)
- **type-safety** — The lab replaces upstream digest, cause and parsed-JSON casts with schema-derived guards, property guards and typed inference while retaining the oracle assertions. (test/InTotoStatement.test.ts; test/Sbom.test.ts; test/conformance.test.ts)
- **tsgo-diagnostics** — The lab uses named `Effect.fn` callbacks, schema `.make` constructors and `S.Finite` in place of upstream diagnostic-triggering forms. (test/IdentityToken.test.ts; test/InTotoStatement.test.ts; module suite test/**)
- **effect-first** — The lab replaces upstream callbacks, `typeof` checks and native component sorting with `Effect.fn`, Predicate helpers and Array/Order/String helpers. (test/Sbom.test.ts; test/IdentityToken.test.ts)
- **effect-imports** — The lab source, tests and examples import dedicated `effect/*` modules instead of the upstream root `effect` barrel. (module suite test/**)
- **identity-annotations** — The lab adds identity annotations and field descriptions absent upstream, including digest identity metadata and nested provenance descriptions, while retaining the inline digest pattern. (test/InTotoStatement.test.ts; module suite test/**)
- **reachability** — The package pins its exact runtime closures, its runtime workspace roots and the type-only `@beep/package-json` edge instead of upstream bare-package graph expectations, and reads source through Vite instead of the filesystem. (test/reachability.test.ts)
- **upstream-bug** — The source walker excludes the phantom `${this.path}` import that the upstream regex walker took from an exported error message, with a regression fixture pinning the correction. (test/reachability.test.ts)
- **ordering** — Components sort by name with `Str.Order`, in UTF-16 code-unit order instead of upstream's locale collation, so the emitted bytes are the same on every host whatever its locale or ICU data. CycloneDX requires no component order. Code-unit order puts `B` before `a` and `é` after `f`. (test/Sbom.test.ts "sorts by code unit, not by locale collation")
- **upstream-bug** — `Component.bomRef` rejects `""`, which upstream emitted into a document the CycloneDX `refType` rejects. (test/conformance.ajv.test.ts)

### Dependency backlog

None.

## License

[MIT](LICENSE)
