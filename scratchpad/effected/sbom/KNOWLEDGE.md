# sbom — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/sbom/CLAUDE.md -->
# @effected/sbom

Software-supply-chain artifacts: a CycloneDX 1.6 SBOM, the NTIA minimum-elements
report, in-toto statements and SLSA provenance, and Sigstore DSSE signing.
Phase 4 of the GitHub/Actions split — the middle piece of the old `Attest` knot,
whose other two are `@effected/github`'s `Attestation` (the REST surface) and
consumer composition (the pipeline).

**Design doc:** `@./okf/modules/sbom.md`

## Tier: integrated

`@sigstore/sign` + `@sigstore/bundle` are real runtime dependencies — this is
cryptography and a wire protocol against Fulcio and Rekor, and re-implementing
either is a security defect rather than a bug. The design question was never
*whether* to be integrated but **how small the integrated surface is**: one
module, ~380 KB.

| Edge | Why |
| --- | --- |
| `@sigstore/sign`, `@sigstore/bundle` | signing. **`SigstoreSigner.ts` only** |
| `@effected/spdx` (`workspace:^`) | license identifier vs expression, on components |
| `@effected/package-json` (`workspace:^`) | manifest-derived metadata (**type-only** in `src/`; `Package` / `Person` / `Repository` re-exported from the entry point) |
| `effect` (peer) | core |

**`@cyclonedx/cyclonedx-library` is deliberately absent** — 6.6 MB with seven
optional peer dependencies for ~10 used symbols, all of them an object model and
a JSON normalizer. The parts that earn the weight (XML, ajv validation, SPDX
expression parsing) are exactly the parts an emitter never calls, and its
`spdx-expression-parse` peer would have installed a second SPDX engine beside
our own. Reversal triggers, recorded: CycloneDX **XML** output, or *consuming
and validating* third-party BOMs. Neither is anyone's need today.

**No `@effected/github` edge, in either direction.** A `SigstoreBundle` crosses
that seam as a structural JSON value (`{ mediaType, verificationMaterial,
dsseEnvelope }`); github types the parameter structurally and the consumer wires
the two together.

## Two capabilities, and the wall between them

Emitting an SBOM is pure computation over a manifest. Signing is network-bound
cryptography. **A consumer that only wants an SBOM must not reach
`@sigstore/*`**, and that is the constraint driving the module split more than
anything else.

`__test__/reachability.test.ts` walks the runtime import graph and asserts it,
with a control (the signer *does* reach Sigstore) so the suite can fail. The
entry point legitimately reaches the signer — it re-exports it — and the test
says so rather than pretending otherwise; the property that matters is that
every pure module is reachable **without** it.

**Never introduce a namespace object** — a `Sbom = { generate, sign }`
convenience would make every SBOM consumer reachable to Fulcio's HTTP stack,
silently. This is the [config-file codec rule](../config-file/CLAUDE.md) with
sharper teeth.

## Source modules

- `SbomDocument.ts` — the owned CycloneDX 1.6 model and the JSON normalizer.
  **1.6 only**: no 1.5 path, no dual-emission branch, no version option.
- `Sbom.ts` — `generate` / `toJson` (both **total**, plain functions) and
  `write` (the package's only IO, over core `FileSystem`).
- `SbomMetadataSource.ts` — manifest → CycloneDX derivation: `npmPurl`,
  `componentFor`, `rootComponent`, `externalReferences`, `fromPackage`,
  `formatCopyright`, `merge`.

`Sbom` and `SbomMetadataSource` are static classes with a private constructor,
not `as const` namespace objects — an `as const` object's member types are
inferred in the built `.d.ts` and lose their TSDoc; `static readonly` keeps
it. Call syntax is unaffected (`Sbom.generate(...)`), and the conversion
stayed within each file — no new imports, so the reachability wall holds.

- `NtiaReport.ts` — the seven minimum elements as a report.
- `InTotoStatement.ts` — `Sha256Digest`, `InTotoSubject`, `InTotoStatement`.
- `SlsaProvenance.ts` — the typed SLSA Provenance v1 predicate.
- `SigstoreBundle.ts` — the bundle value and the media-type constants. Imports
  **nothing** from `@sigstore/*`.
- `SigstoreSigner.ts` — the service, its layers, `SigningError`. The **only**
  module importing `@sigstore/*`.
- `IdentityToken.ts` — the inverted OIDC contract.

## The things that will bite you

### Three error channels the port deleted, and why they could not fire

`Sbom.generate` and `Sbom.toJson` were `Effect<_, SbomError>` with
`reason: "build" | "serialize"` — failures that existed only because the
CycloneDX library might throw. `SlsaError { reason: "env" }` guarded string
interpolation over already-present claims. The NTIA "dependency relationship"
check was `sbom.components !== undefined` against a **required** field.

Owned models over validated `Schema.Class` values cannot fail, so those are
plain functions now. `write` keeps an error channel because the filesystem has
one. **When porting anything else from that source package, audit every error
channel for whether it can actually fire** — three in one package is a pattern.

### A license is an EXPRESSION field, and CycloneDX renders three shapes

`MIT`, `MIT OR Apache-2.0` and `UNLICENSED` are all legal `package.json`
licenses and all serialize differently: `{license:{id}}` only for a catalog
identifier (the schema constrains `id` to the SPDX enumeration), a one-element
`[{expression}]` tuple for an expression, `{license:{name}}` for anything else.
Emitting every value as an `id` produces a document that looks right and fails
validation — which the first cut did. The id-versus-expression question is
`@effected/spdx`'s (`License.isKnownId`, `isValidExpression`), **never** a local
regex.

### The purl is `pkg:npm/%40scope/name@version`

The scope is the purl **namespace**: the `@` is percent-encoded, the separating
slash stays literal. `encodeURIComponent(name)` — what the predecessor did —
collapses that slash to `%2F` and parses back as a namespace-less name. Pinned
against the package-url spec's own roundtrip vector.

### Nothing reads an ambient clock or environment

`formatCopyright` takes the year as an argument (the predecessor defaulted to
`new Date().getFullYear()`, which made it untestable). `SbomMetadata.timestamp`
is supplied by the caller. `GitHubWorkflowProvenance.serverUrl` is a required
field — upstream `@actions/attest` reads `process.env.GITHUB_SERVER_URL` with
**no default**, so an unset variable writes the literal string `undefined` into
every URL it builds. A test sets that variable to a decoy and asserts the output
does not move.

### `SbomMetadataSource` imports `Package` as a TYPE only

A value import would put `@effected/package-json` — and its `FileSystem` IO
module — on the runtime graph of a package whose SBOM half is otherwise pure.
The reachability suite asserts the resulting edge set exactly, so a stray value
import fails there rather than in a consumer's bundle.

`src/index.ts` does re-export `Package`, `Person` and `Repository` as values,
and that is the one sanctioned place: `SbomMetadataSource.fromPackage` takes a
`Package`, and without the re-export a caller could not name its argument type
without declaring a dependency it does not otherwise have. Same posture as the
entry point re-exporting the signer — the property that matters is that every
pure **module** stays reachable without the heavy graph. **Do not copy the
pattern into `src/`.**

### The signer's error `kind` comes from Sigstore's own error codes

`InternalError` carries `code` (`CA_*`, `TLOG_*`, `TSA_*`, `IDENTITY_TOKEN_*`),
which is what `kindOf` reads. That is why the predecessor's 30-line recursive
cause-chain-to-string flattener (`describeSigstoreError`) has **no successor**:
it existed because the error was about to become a message, and
`cause: Schema.Defect()` keeps the original structurally. An unattributable
failure is `kind: "bundle"` — literally "the bundle did not get built" — rather
than guessed into a step it may not belong to.

### An unwitnessed bundle has no `tlogEntries` key at all

Protobuf JSON omits empty repeated fields, so a bundle signed with
`witnesses: []` carries **no** `tlogEntries` property rather than an empty
array. Reading `.tlogEntries.length` blindly throws on a legitimately
unwitnessed bundle.

### The test doubles do not default the same way, on purpose

`SigstoreSigner.makeTest().sign` **dies**: a fabricated bundle would be a
signature-shaped lie, and that is the strongest case in the kit for the
die-loudly default. A test wanting a real bundle without a network drives the
**real** `DSSEBundleBuilder` through
`SigstoreSigner.layerWith({ signer, witnesses })`.

`IdentityToken.makeTest` **answers** — a fabricated OIDC token is a real answer
to "give me a token", the same judgement that made `LocalExec.makeTest` return
`Option.none()`. The test remains "would a real implementation legitimately
answer this?"

### The reachability walker strips LINE comments first

Ordering is load-bearing, not stylistic. This package's prose contains the token
`` `@sigstore/*` ``, whose `/*` opens a block comment as far as a regex is
concerned; stripping blocks first deleted everything from that word to the end
of the next doc comment — **imports included** — and reported a module that
imports `effect` as importing nothing. It fails in the *safe* direction, which
for a confinement test is the worst direction. Sibling packages that copied this
walker have the opposite order and are safe only by luck.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`. Run root-relative;
subset runs skip the global coverage thresholds automatically.

**Two vendored oracles, both in `__test__/fixtures/` with a `VENDORED.md` pin.**
Never hand-write an expectation either one can derive:

- `bom-1.6.SNAPSHOT.schema.json` — the published CycloneDX schema. Conformance
  expectations are read **from it** (`required` arrays, `enum` members, property
  names), which is how declining the library costs no conformance confidence.
- `actions-attest-provenance.json` — the predicate `@actions/attest` emits for a
  fixed claim set, transcribed from `actions/toolkit`'s own source. The
  assertion is a deep-equal, so an **extra** field fails as loudly as a missing
  one.

In that fixture's claims, `workflowRef` and `jobWorkflowRef` are deliberately
**different** (a reusable workflow in another repository). Upstream builds the
builder id from one and the workflow path from the other; set equal, a
constructor that confuses them passes everything. A survived mutant found
exactly that — do not collapse them.

Signing is tested with a stub `Signer`/`Witness` through the **real**
`DSSEBundleBuilder`, so the DSSE pre-authentication encoding, envelope assembly
and protobuf serialization are genuinely exercised. The discriminating assertion
is that the stub signer receives `DSSEv1 <len> <type> <len> <body>` — a
hand-rolled fake would sign the JSON.

An opt-in end-to-end run against Sigstore **staging** (via
`layerWith({ fulcioBaseUrl, rekorBaseUrl })`) is the recorded way to catch
upstream protocol drift. It is not a gate and never runs in default CI.

## Build

```bash
pnpm vitest run packages/sbom --coverage.enabled=false
pnpm build --filter @effected/sbom
```

`savvy.build.ts` carries the **narrow** `_base` suppression for Effect's
class-factory heritage types. **Never widen it** — an internal type named on a
`@public` signature is a different symbol and stays unmasked (two public input
interfaces here spell their shared members out twice rather than extend a
private base, for exactly that reason).

Never run `node savvy.build.ts --target prod` directly: it skips `build:dev`,
emits no `.d.ts`, and leaves a truncated `issues.json` shaped like a clean gate.


---
<!-- okf/modules/sbom.md -->
---
type: Module
title: sbom
description: The software-supply-chain artifact half of attestation — a CycloneDX 1.6 SBOM, the NTIA report, SLSA provenance and Sigstore DSSE signing.
status: stable
kind: package
resource: ../../packages/sbom
tags:
  - architecture
  - bundle
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 66ffbc89629b5f9f96a28296e6d2129c1bf81b77cdf3b32d1ef1a689aec3dc9c
---

# sbom

## Purpose

`@effected/sbom` owns the software-supply-chain artifact half of
attestation: producing a CycloneDX 1.6 SBOM, reporting it against the NTIA
minimum elements, modelling in-toto statements and SLSA provenance, and
signing a statement into a Sigstore DSSE bundle. The attestation REST
surface belongs to [`github`](github.md); the mint-sign-build-attest
pipeline is consumer composition; this package owns the artifacts and the
signing.

Two capabilities live in one package and must stay independently
reachable. Generating and validating an SBOM is pure computation over a
manifest. Signing is network-bound cryptography against Fulcio and Rekor.
A consumer that only wants an SBOM must not pull the Sigstore stack into
its bundle, and a consumer that only signs provenance must not pull an
SBOM emitter — see [bundle reachability](#bundle-reachability).

## Tier and the dependency decision

Integrated tier, unavoidably: `@sigstore/sign` and `@sigstore/bundle` are
real external runtime dependencies with no honest way around them. The
design question is not *whether* to be integrated but how small the
integrated surface can be — one module,
`packages/sbom/src/SigstoreSigner.ts`, roughly 380 KB. See
[sbom owns its emitter](../decisions/sbom-owns-its-emitter.md) for the
declined `@cyclonedx/cyclonedx-library` alternative.

Kit edges: [`spdx`](spdx.md) for license identifier-versus-expression
classification on components (never a second SPDX engine), and
[`package-json`](package-json.md) for manifest-derived metadata — imported
as **types only** in the metadata module, so nothing in the emitter's own
graph links `package-json`'s IO. The one runtime link is the entry
point's re-export of `Package`, `Person` and `Repository`, because a
caller assembling components must be able to name its parameter type
without declaring an edge on a package it only touches through this one.
No `github` edge exists in either direction: a `SigstoreBundle` crosses
that seam as a structural JSON value
(`{ mediaType, verificationMaterial, dsseEnvelope }`), `github` types the
parameter structurally, and the consumer wires the two together — the
same call `github` makes for its subject digest versus lockfiles'
integrity hash, a small deliberate duplication in preference to dragging
a package across a seam.

## Module map

Module-per-concept; `packages/sbom/src/index.ts` re-exports only. There is
deliberately no `src/internal/`: the JSON normalizer sits in the module
whose serializer it is, git-URL normalization belongs to
[`package-json`](package-json.md), and purl encoding is public because a
caller assembling its own components or naming an in-toto subject needs
the same encoder.

| Module | Owns | Reaches |
| --- | --- | --- |
| `SbomDocument.ts` | the CycloneDX 1.6 model and its normalizing serializer | spdx |
| `Sbom.ts` | the emitter facade: `generate`, `toJson` (both total), `write` (the package's only IO, over core `FileSystem`) | `SbomDocument.ts` only |
| `SbomMetadataSource.ts` | derivation from a `Package` manifest plus explicit overrides, and the purl encoder | package-json (types) |
| `NtiaReport.ts` | the seven-element report | — |
| `InTotoStatement.ts` | statements, subjects, digests, predicate types | — |
| `SlsaProvenance.ts` | the typed SLSA Provenance v1 predicate and its GitHub-workflow constructor | — |
| `SigstoreBundle.ts` | the DSSE bundle value and its media types; imports nothing from `@sigstore/*` | — |
| `SigstoreSigner.ts` | the only module importing `@sigstore/*`: the signer service, its layers, `SigningError` | `@sigstore/*` |
| `IdentityToken.ts` | the inverted OIDC contract and its static/test layers | — |

`Sbom` and `SbomMetadataSource` are static classes with a private
constructor, not `as const` namespace objects, because an `as const`
object's member types are inferred in the built `.d.ts` and lose their
TSDoc; `static readonly` keeps it, with call syntax unaffected
(`Sbom.generate(...)`).

## Assembly is total; only IO can fail

Assembling a document and serializing it are plain functions with no
error channel. A predecessor typed them as effects that could only fail
because a CycloneDX library might throw — a failure mode introduced *by*
the dependency, not the domain. With an owned model whose inputs are
already-validated schema values, neither `generate` nor `toJson` can fail;
only `write` keeps an error channel, because the filesystem has one. Every
error channel is audited for whether it can actually fire: an
`Effect.try` around pure string interpolation in the provenance
constructor, and an NTIA check testing a field the model declares
required, were both deleted for the same reason — a channel that cannot
fire is worse than no channel, because it forces every caller to handle a
case that does not exist.

A license is an **expression** field, and the emitter picks between three
shapes: a catalog identifier emits `{license:{id}}` (the schema constrains
`id` to the SPDX enumeration), a valid expression like `MIT OR
Apache-2.0` emits the schema's one-element `{expression}` tuple, and
anything else (`UNLICENSED`, `SEE LICENSE IN …`) emits a named license.
The branches are exclusive because the expression tuple caps at one
element. This is where the [`spdx`](spdx.md) edge becomes real:
`License.isKnownId` and `isValidExpression` decide the branch, never a
local regex.

The purl encoder follows the package-url spec rather than intuition:
`encodeURIComponent(name)` collapses a scope's separating slash, but the
spec's own npm vector is `pkg:npm/%40angular/animation@12.3.1` — the scope
is the purl namespace, its `@` percent-encoded and the slash literal.
Versions pass through verbatim, because every character semver permits is
a legal RFC 3986 path character. Both are pinned against published
vectors.

## What a manifest cannot say

See [what a manifest cannot say](../limitations/what-a-manifest-cannot-say.md).

## The NTIA report

See [the NTIA report is not a gate](../decisions/ntia-report-not-a-gate.md).

## SLSA provenance

The predicate is a typed schema class, not a `Record<string, unknown>`,
and its GitHub-workflow constructor is total. There is no ambient
environment read: the server URL is a required field on the constructor's
input, so the constructor is a pure projection and the ambient read moves
to the caller — see
[`actions-attestation`](../interfaces/actions-attestation.md) for where
that caller lives. The build-type identifier stays in this package,
because it names a provenance shape rather than an Actions runtime
detail, and the constructor's input is a plain record, not a contract
service, since there is nothing to swap and no IO to invert.

The emitted shape is byte-compatible with what the upstream Actions
attestation toolkit produces, pinned by a fixture test with a deep-equal
so an extra field fails as loudly as a missing one — the fixture's claims
deliberately give the workflow ref and the job workflow ref **different**
values, because with them equal a constructor that confuses the two
passes every assertion. One divergence from upstream favours this
package: upstream reads its server URL with no default and writes the
literal string `undefined` into every URL it builds when the variable is
unset.

## Signing and the identity seam

`SigstoreSigner.sign(statement)` is the whole surface. The audience string
for Sigstore stays inside this package rather than becoming a caller
parameter, because it is Sigstore's requirement, not the caller's
knowledge. `IdentityToken` is an inverted contract: OIDC token issuance
belongs to the Actions runtime, and this package must not depend on
[`github-actions`](github-actions.md), since that package is integrated
with a required `@effect/platform-node` peer and taking the edge would
drag a platform peer into every SBOM consumer. This package declares the
narrow contract and ships `layerStatic` for a consumer that already holds
a token; `github-actions` ships the implementing layer,
`ActionsIdentityToken` (see
[`actions-attestation`](../interfaces/actions-attestation.md)).

`SigningError`'s `kind` is chosen by reading Sigstore's own internal error
codes (`CA_*`, `TLOG_*`, `TSA_*`, `IDENTITY_TOKEN_*`) rather than guessed;
an unattributable failure is `kind: "bundle"` rather than assigned to a
step it may not belong to. There is no cause-chain-to-string flattener,
because `cause: Schema.Defect()` keeps the original structurally and such
a walk exists only to turn an error into a message. The bundle's media
type is carried through from the builder rather than declared as a
literal, since the builder picks a version depending on whether a
certificate chain is present. An unwitnessed bundle has no
`tlogEntries` key at all, because protobuf JSON omits empty repeated
fields.

## The attestation seam

This package produces a signed bundle; `github`'s attestation surface
accepts one. If `github` typed that parameter as this package's class,
`github` would depend on `sbom`; if this package performed the upload,
`sbom` would depend on `github`. Both are avoided because the bundle
crossing the seam is a serialized JSON value with a stable published
shape.

## Bundle reachability

The invariant: an SBOM-only consumer must not reach `@sigstore/*`, and a
signing-only consumer must not reach the SBOM emitter. Three mechanisms
hold it, in order of how load-bearing they are:

1. **One module imports `@sigstore/*`** — `SigstoreSigner.ts` — and
   nothing in the document, emitter, report, metadata or provenance
   modules names it, transitively or otherwise.
2. **Free-standing named exports, never a namespace object** — see
   [no barrel re-exports](../conventions/no-barrel-re-exports.md). A
   `Sbom = { generate, sign }` convenience object would make every SBOM
   consumer reachable to Fulcio's HTTP stack, silently.
3. **A reachability test with a control** —
   `packages/sbom/__test__/reachability.test.ts` walks the runtime import
   graph of `src` statically and asserts no `@sigstore/*` edge appears
   from the SBOM surface, **and** that the signer module does reach
   them, so the suite can fail. See
   [the bundle-reachability suite convention](../conventions/bundle-reachability-suite.md).

The suite constrains the **import** graph, not the **resolver** graph:
`@sigstore/*` is a declared runtime dependency of the whole package, so
it is installed wherever `sbom` is, and a bundler's resolver walks it
regardless. That distinction has a live consequence, not a theoretical
one: [`github-actions`](github-actions.md) depends on this package for
two small seam adapters
(see [`actions-attestation`](../interfaces/actions-attestation.md)), so
every consumer of `github-actions` installs `sbom`'s dependencies even
if it never signs anything. The claim this design supports is "a
consumer that does not import the signer links nothing from it, and a
tree-shaking bundler can drop it"; it does not support "the dependency is
absent from the consumer's tree by construction".

The reachability walker in this package's test suite strips **line**
comments before block comments, deliberately: the reverse order lets a
`/*`-containing token inside prose (this package's own doc comments
mention `` `@sigstore/*` ``) open a phantom block comment that deletes
everything up to the next doc comment, imports included — reported here
as a module that imports `effect` appearing to import nothing. See
[the bundle-reachability suite convention](../conventions/bundle-reachability-suite.md).

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`. The DSSE
bundle builder takes a signer and a witness by interface, so a test
supplies a stub signer returning a fixed key and certificate and a stub
witness returning a canned log entry — no network, no keys, no OIDC — and
the code under test is the **real** builder, so envelope and bundle
assembly are genuinely exercised. The discriminating proof it ran: the
stub signer receives the DSSE pre-authentication encoding, not the raw
payload. `SigstoreSigner`'s own test double dies loudly unstubbed,
because a fabricated bundle would be a signature-shaped lie. CycloneDX
conformance is pinned against the published JSON schema, vendored as a
test fixture at `packages/sbom/__test__/fixtures/bom-1.6.SNAPSHOT.schema.json`,
so declining the object-model library costs no conformance confidence.
The NTIA suite's discriminating direction is the negative case: a
validator that returns satisfied unconditionally passes every positive
test. An opt-in end-to-end run against Sigstore *staging* exists to catch
upstream protocol drift and never runs in default CI. No secrets appear in
spans: the identity token is carried as `Redacted` end to end and
declassified exactly once, inside the live signer.

## Deliberately not here

- A CycloneDX object-model dependency, and the lazy-import cache that
  existed to defer its optional peers — see
  [sbom owns its emitter](../decisions/sbom-owns-its-emitter.md).
- In-flight sibling merge semantics: a package depending on a sibling
  released in the same wave and therefore absent from the registry is a
  release-planning decision, not an SBOM one — the caller assembles the
  component list, and [`workspaces`](workspaces.md) already knows the
  release set.
- OIDC token issuance and JWT claim decoding — both belong beside the
  runner that issues the token, in
  [`github-actions`](github-actions.md).
- Archive production: attestation's subject is a digest of an artifact
  that already exists, so this package hashes a file and never creates
  one. The trigger for a future archive-producing package is a consumer
  needing the kit to produce the artifact whose digest it attests,
  reproducibly, so two builds agree.
- A CycloneDX dependency graph: the flat component list plus a declared
  root satisfies the NTIA element, and no consumer has asked for a
  transitive graph.
