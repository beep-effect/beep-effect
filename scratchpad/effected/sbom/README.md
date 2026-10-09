# sbom (lab port of @effected/sbom)

[![npm](https://img.shields.io/npm/v/@effected%2Fsbom?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/sbom)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Supply-chain artifacts for [Effect](https://effect.website) v4: a CycloneDX 1.6 SBOM, an NTIA minimum-elements report, in-toto statements, SLSA provenance, and Sigstore DSSE signing. `Sbom.generate` and `Sbom.toJson` are total, plain functions — assembling and serializing a document cannot fail, so the package's only error channel belongs to `Sbom.write`, the one member that touches a filesystem. Signing is a separate, deliberately walled-off capability: a consumer that only ever emits an SBOM never reaches `@sigstore/*` or its Fulcio/Rekor network calls.

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

## Why @effected/sbom

`@cyclonedx/cyclonedx-library` is 6.6 MB with seven optional peer dependencies for around ten symbols this package actually needs — an object model and a JSON normalizer. The parts that would justify the weight (XML output, ajv validation, SPDX expression parsing) are exactly the parts an emitter never calls, and its `spdx-expression-parse` peer would install a second SPDX engine beside `@effected/spdx`. This package owns its CycloneDX 1.6 model directly instead, conformance-tested against the published schema rather than promised by a dependency.

Emitting an SBOM and signing one are different kinds of work — pure computation over a manifest versus network-bound cryptography against Fulcio and Rekor — and the module boundary follows that split exactly. `SbomDocument`, `Sbom`, `SbomMetadataSource`, `NtiaReport`, `InTotoStatement` and `SlsaProvenance` reach nothing but `effect`, `@effected/spdx` and (as a type-only import) `@effected/package-json`. Only `SigstoreSigner.ts` imports `@sigstore/*`, and it is walked by a reachability test rather than left to convention: a namespace object gathering `generate` and `sign` together would make every SBOM consumer reachable to Fulcio's HTTP stack, silently, which is why none exists here.

A license is a CycloneDX **expression** field with three legal shapes — `{license:{id}}` for a catalog identifier, a one-element `[{expression}]` tuple for an expression like `MIT OR Apache-2.0`, and `{license:{name}}` for anything else — and choosing between them is `@effected/spdx`'s job (`License.isKnownId`, `isValidExpression`), never a local regex. Emitting every value as an `id` produces a document that looks right and fails validation.

## Install

```bash
npm install @effected/sbom effect
```

```bash
pnpm add @effected/sbom effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Generating an SBOM needs no layer, no service and no network call:

```ts
import { Package, Sbom, SbomMetadataSource } from "@effected/sbom";

declare const pkg: Package;

const root = SbomMetadataSource.rootComponent(pkg);
const metadata = SbomMetadataSource.fromPackage(pkg, { timestamp: new Date().toISOString() });
const components = [
  SbomMetadataSource.componentFor({ name: "effect", version: "4.0.0", license: "MIT" }),
];

const document = Sbom.generate({ root, components, metadata });
console.log(Sbom.toJson(document));
// canonical CycloneDX 1.6 JSON — component names sorted, so two runs over
// the same inputs produce identical bytes
```

Components are sorted by name so the document's digest — which becomes an attestation subject — does not change between runs over the same inputs for no reason.

`Package`, `Person` and `Repository` come from `@effected/package-json` and are re-exported here, so naming the type `fromPackage` takes does not mean declaring a dependency you would not otherwise have. Inside `src/` the manifest types stay a type-only import; the entry point is the one place they cross as values.

## NTIA compliance

`NtiaReport.of` is total: it answers for every document, including one that satisfies nothing.

```ts
import { NtiaReport, SbomDocument } from "@effected/sbom";
import { Effect } from "effect";

declare const document: SbomDocument;

const program = Effect.gen(function* () {
  const report = NtiaReport.of(document);
  if (!report.compliant) {
    yield* Effect.logWarning(`SBOM missing: ${report.missing.join(", ")}`);
  }
  return report;
});
// report.missing: readonly NtiaElementId[] — e.g. ["sbomAuthor", "timestamp"]
```

## Provenance and attestation

`InTotoStatement` and `SlsaProvenance` build the predicate an attestation wraps around an SBOM or a build. Both are pure projections of their input — nothing is read from the environment, and nothing can fail:

```ts
import { InTotoStatement, Sha256Digest, SbomMetadataSource, SlsaProvenance } from "@effected/sbom";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const digest = yield* Sha256Digest.parse("a".repeat(64));
  const provenance = SlsaProvenance.forGitHubWorkflow({
    serverUrl: "https://github.com",
    repository: "acme/widget",
    ref: "refs/heads/main",
    sha: "abc123",
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
```

## Signing

`SigstoreSigner` fetches an identity token, exchanges it with Fulcio for a certificate, signs the statement, and (unless `witnesses: []`) logs it to Rekor — all behind one method, `sign`, over `IdentityToken`:

```ts
import { IdentityToken, InTotoStatement, SigstoreSigner } from "@effected/sbom";
import { Effect, Layer } from "effect";

declare const oidcToken: string;
declare const statement: InTotoStatement;

const program = Effect.gen(function* () {
  const signer = yield* SigstoreSigner;
  return yield* signer.sign(statement);
});

const SignerLayer = SigstoreSigner.layer.pipe(Layer.provide(IdentityToken.layerStatic(oidcToken)));

Effect.runPromise(program.pipe(Effect.provide(SignerLayer))).then(console.log);
// SigstoreBundle: { mediaType, verificationMaterial, dsseEnvelope }
```

`IdentityToken` is a narrow, one-method contract deliberately smaller than any real issuer's surface, so several things can satisfy it. On a GitHub runner that is `ActionsIdentityToken.layer`, which `@effected/github-actions` ships over its own `OidcTokenIssuer` — the dependency points that way so signing never drags the Actions runtime into a consumer that only emits an SBOM. A CI system that mints its own token works the same way through `IdentityToken.layerStatic`.

## Errors

`SigningError.kind` names which step failed — `identity` (a workflow permissions problem), `certificate` (Fulcio), `transparencyLog` (Rekor), or `bundle` (assembly) — with the original failure preserved structurally on `cause` rather than flattened into a message:

```ts
import { SigningError } from "@effected/sbom";
import { Effect } from "effect";

declare const sign: Effect.Effect<unknown, SigningError>;

const program = sign.pipe(Effect.catchTag("SigningError", (error) => Effect.logError(`${error.kind}: ${error.message}`)));
```

`Sbom.write` is the package's only other error channel (`SbomWriteError`), because assembling and serializing a document cannot fail — there is nothing in `generate` or `toJson` that reaches an error path.

## Testing

`SigstoreSigner.makeTest().sign` **dies** rather than fabricating a bundle: a signature-shaped lie is exactly the failure an attestation exists to prevent. A test that needs a real bundle without a network drives the real `DSSEBundleBuilder` through `SigstoreSigner.layerWith({ signer, witnesses })`. `IdentityToken.makeTest`, by contrast, **answers** — a fabricated OIDC token is a real answer to "give me a token":

```ts
import { IdentityToken } from "@effected/sbom";
import { Effect } from "effect";

const TestToken = IdentityToken.layerTest({
  token: () => Effect.succeed("test-token"),
});
```

## Features

- `Sbom` — `generate` (total), `toJson` (total, canonical CycloneDX 1.6), and `write` (the package's one fallible member, over core `FileSystem`).
- `SbomDocument` — the owned CycloneDX 1.6 model: `Component`, `ComponentType`, `ExternalReference`, `Contact`, `Supplier`, `SbomMetadata`.
- `SbomMetadataSource` — manifest-derived metadata: `npmPurl`, `componentFor`, `rootComponent`, `externalReferences`, `fromPackage`, `formatCopyright`, `merge`.
- `NtiaReport` — the seven NTIA minimum elements as a total report (`compliant`, `missing`).
- `InTotoStatement` — `of` / `forSubject`, over `InTotoSubject` and a validated `Sha256Digest`.
- `SlsaProvenance` — `forGitHubWorkflow`, a total projection to a SLSA Provenance v1 predicate.
- `SigstoreSigner` — DSSE signing against Fulcio and Rekor, `layerWith` for a supplied signer/witnesses/endpoints, and a die-on-unstubbed test double.
- `IdentityToken` — the narrow, one-method OIDC contract `SigstoreSigner` runs on; `layerStatic` for a token you already hold.
- `SigstoreBundle` — the bundle value and media-type constants, importing nothing from `@sigstore/*`.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/sbom` 0.10.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/sbom/SbomDocument.ts:11 import { License, isValidExpression } from "../spdx/index.ts";
- scratchpad/effected/sbom/SbomMetadataSource.ts:16 // timestamp is an argument, and so is the copyright year.
- scratchpad/effected/sbom/SigstoreBundle.ts:7 // re-exported from `@sigstore/bundle`.
- scratchpad/effected/sbom/index.ts:40 type CopyrightYears,

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
