# sbom (lab port of @effected/sbom)


Supply-chain artifacts for [Effect](https://effect.website) v4: a CycloneDX 1.6 SBOM, an NTIA minimum-elements report, in-toto statements, SLSA provenance, and Sigstore DSSE signing. `Sbom.generate` and `Sbom.toJson` are total, plain functions — assembling and serializing a document cannot fail, so the package's only error channel belongs to `Sbom.write`, the one member that touches a filesystem. Signing is a separate, deliberately walled-off capability: a consumer that only ever emits an SBOM never reaches `@sigstore/*` or its Fulcio/Rekor network calls.

## Why @effected/sbom

`@cyclonedx/cyclonedx-library` is 6.6 MB with seven optional peer dependencies for around ten symbols this package actually needs — an object model and a JSON normalizer. The parts that would justify the weight (XML output, ajv validation, SPDX expression parsing) are exactly the parts an emitter never calls, and its `spdx-expression-parse` peer would install a second SPDX engine beside `@effected/spdx`. This package owns its CycloneDX 1.6 model directly instead, conformance-tested against the published schema rather than promised by a dependency.

Emitting an SBOM and signing one are different kinds of work — pure computation over a manifest versus network-bound cryptography against Fulcio and Rekor — and the module boundary follows that split exactly. `SbomDocument`, `Sbom`, `SbomMetadataSource`, `NtiaReport`, `InTotoStatement` and `SlsaProvenance` reach nothing but `effect`, `@effected/spdx` and (as a type-only import) `@effected/package-json`. Only `SigstoreSigner.ts` imports `@sigstore/*`, and it is walked by a reachability test rather than left to convention: a namespace object gathering `generate` and `sign` together would make every SBOM consumer reachable to Fulcio's HTTP stack, silently, which is why none exists here.

A license is a CycloneDX **expression** field with three legal shapes — `{license:{id}}` for a catalog identifier, a one-element `[{expression}]` tuple for an expression like `MIT OR Apache-2.0`, and `{license:{name}}` for anything else — and choosing between them is `@effected/spdx`'s job (`License.isKnownId`, `isValidExpression`), never a local regex. Emitting every value as an `id` produces a document that looks right and fails validation.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Generating an SBOM needs no layer, no service and no network call:

```ts
import { Package, Sbom, SbomMetadataSource } from "@beep/scratchpad/effected/sbom/index";

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
import { NtiaReport, SbomDocument } from "@beep/scratchpad/effected/sbom/index";
import * as Effect from "effect/Effect";

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
import { InTotoStatement, Sha256Digest, SbomMetadataSource, SlsaProvenance } from "@beep/scratchpad/effected/sbom/index";
import * as Effect from "effect/Effect";

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
import { IdentityToken, InTotoStatement, SigstoreSigner } from "@beep/scratchpad/effected/sbom/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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
import { SigningError } from "@beep/scratchpad/effected/sbom/index";
import * as Effect from "effect/Effect";

declare const sign: Effect.Effect<unknown, SigningError>;

const program = sign.pipe(Effect.catchTag("SigningError", (error) => Effect.logError(`${error.kind}: ${error.message}`)));
```

`Sbom.write` is the package's only other error channel (`SbomWriteError`), because assembling and serializing a document cannot fail — there is nothing in `generate` or `toJson` that reaches an error path.

## Testing

`SigstoreSigner.makeTest().sign` **dies** rather than fabricating a bundle: a signature-shaped lie is exactly the failure an attestation exists to prevent. A test that needs a real bundle without a network drives the real `DSSEBundleBuilder` through `SigstoreSigner.layerWith({ signer, witnesses })`. `IdentityToken.makeTest`, by contrast, **answers** — a fabricated OIDC token is a real answer to "give me a token":

```ts
import { IdentityToken } from "@beep/scratchpad/effected/sbom/index";
import * as Effect from "effect/Effect";

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

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab replaces upstream Object.entries, Date.parse, Object.assign schema statics and native Error with Effect Record/Schema facilities, S.Opaque statics and a tagged error (scratchpad/test/sbom/Sbom.test.ts:83; scratchpad/test/sbom/NtiaReport.test.ts:134; scratchpad/test/sbom/InTotoStatement.test.ts:68; scratchpad/test/sbom/SigstoreSigner.test.ts:261).
- **identity-keys** — The lab registers IdentityToken and SigstoreSigner with module-local IdentityComposer keys instead of upstream @effected/sbom service keys (scratchpad/test/sbom/IdentityToken.test.ts:18; scratchpad/test/sbom/SigstoreSigner.test.ts:267; scratchpad/test/sbom/reachability.test.ts:132).
- **tagged-errors** — The lab unstubbed signer throws UnstubbedSigstoreSignerError with a schema tag instead of upstream native Error, preserving the synchronous failure and message (scratchpad/test/sbom/SigstoreSigner.test.ts:261).
- **schema-first** — The lab replaces eight upstream input interfaces with runtime schemas, named literal domains with LiteralKit, digest/NTIA predicates with schema guards and JSON.stringify with schema codecs that preserve successful bytes but surface SchemaError on failure (scratchpad/test/sbom/InTotoStatement.test.ts:68; scratchpad/test/sbom/InTotoStatement.test.ts:136; scratchpad/test/sbom/Sbom.test.ts:117; scratchpad/test/sbom/NtiaReport.test.ts:76; module suite scratchpad/test/sbom/**).
- **numeric-domains** — The lab rejects non-finite SbomDocument revisions accepted by upstream Schema.Number and gives the new indentation/year schemas finite-number domains without changing function validation boundaries (module suite scratchpad/test/sbom/**).
- **type-safety** — The lab replaces upstream digest, cause, bundle and parsed-JSON casts with schema-derived guards, property guards and typed inference while retaining oracle assertions (scratchpad/test/sbom/InTotoStatement.test.ts:161; scratchpad/test/sbom/Sbom.test.ts:74; scratchpad/test/sbom/SigstoreSigner.test.ts:115; scratchpad/test/sbom/conformance.test.ts:116; scratchpad/test/sbom/reachability.test.ts:191).
- **tsgo-diagnostics** — The lab uses named Effect.fn callbacks, schema .make constructors and S.Finite in place of upstream diagnostic-triggering forms, retaining scoped test entry-point diagnostic exceptions (scratchpad/test/sbom/IdentityToken.test.ts:18; scratchpad/test/sbom/IdentityToken.test.ts:84; scratchpad/test/sbom/InTotoStatement.test.ts:73; scratchpad/test/sbom/SigstoreSigner.test.ts:206; module suite scratchpad/test/sbom/**).
- **effect-first** — The lab replaces upstream callbacks, typeof checks, native component sorting and the redundant signer wrapper with Effect.fn, Predicate helpers, Array/Order/String helpers and a direct thunk while preserving ordering and stub selection (scratchpad/test/sbom/IdentityToken.test.ts:18; scratchpad/test/sbom/Sbom.test.ts:56; scratchpad/test/sbom/SigstoreSigner.test.ts:261).
- **effect-imports** — The lab source, tests and source examples import dedicated effect/* modules instead of the upstream root effect barrel (module suite scratchpad/test/sbom/**; scratchpad/test/sbom/reachability.test.ts:132; scratchpad/test/sbom/reachability.test.ts:170).
- **identity-annotations** — The lab adds $ScratchpadId identifiers and schema/field annotations absent upstream, including digest identity metadata and nested provenance/error descriptions while retaining the inline digest pattern (module suite scratchpad/test/sbom/**; scratchpad/test/sbom/InTotoStatement.test.ts:192; scratchpad/test/sbom/reachability.test.ts:170).
- **test-environment** — The lab points source/manifest/signer-path tests at scratchpad/effected/sbom, a module-data package.json and TypeScript paths instead of upstream src/package/output assumptions (scratchpad/test/sbom/reachability.test.ts:191; scratchpad/test/sbom/reachability.test.ts:199; scratchpad/test/sbom/reachability.test.ts:231).
- **reachability** — The lab enumerates effect/* and Beep imports and asserts the vendored SPDX edge plus package-json IO exclusion instead of upstream bare-package graph expectations (scratchpad/test/sbom/reachability.test.ts:132; scratchpad/test/sbom/reachability.test.ts:142; scratchpad/test/sbom/reachability.test.ts:170; scratchpad/test/sbom/reachability.test.ts:199).
- **upstream-bug** — The lab declaration parser excludes the phantom ${this.path} import emitted by the upstream regex walker, with the exported-error-message regression fixture pinning the correction (scratchpad/test/sbom/reachability.test.ts:93; scratchpad/test/sbom/reachability.test.ts:110; scratchpad/test/sbom/reachability.test.ts:116).

### Dependency backlog

None.
