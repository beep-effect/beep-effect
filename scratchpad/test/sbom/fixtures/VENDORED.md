# Vendored fixtures

Two oracles, each pinning this package's output against something published
rather than against our own assumptions.

## Vendored: CycloneDX 1.6 JSON schema

| | |
| --- | --- |
| File | `bom-1.6.SNAPSHOT.schema.json` |
| Schema `$id` | `http://cyclonedx.org/schema/bom-1.6.schema.json` |
| Source | `@cyclonedx/cyclonedx-library@10.1.0`, `res/schema/bom-1.6.SNAPSHOT.schema.json` |
| Upstream | <https://github.com/CycloneDX/cyclonedx-javascript-library> |
| License | Apache-2.0 |
| Pinned | 2026-07-25 |

### Why this is here

`@effected/sbom` [declines the CycloneDX library as a runtime dependency](../../../../okf/decisions/sbom-owns-its-emitter.md) — 6.6 MB with seven optional peers, for an object model and a JSON normalizer we can emit directly. Declining the *library* is not the same as declining the *specification*, so the published schema is vendored here as a **test-only conformance oracle**.

The filename says `SNAPSHOT` because that is what the library ships; the `$id` inside is the released `bom-1.6.schema.json`.

### How it is used

`__test__/conformance.test.ts` reads this file and derives its expectations from it — `required` arrays, `enum` members, property names — rather than hand-writing them. That is what makes it an oracle: a wrong `externalReference.type`, a missing `required` field or a renamed property fails against the specification itself, not against a copy of our own assumptions.

It is **targeted conformance over the subset we emit**, not full JSON-schema validation. Full validation would need a validator (`ajv`), and taking one as a devDependency to check output we fully control is the weight this package exists to avoid. The subset is the whole of what the emitter produces, so nothing we write is unchecked.

### Updating

Re-pin when targeting a new CycloneDX version. Per the settled ruling the emitter is **1.6-only** — there is no 1.5 path and no version option — so a new spec version is a deliberate migration, not an added branch.

## Vendored: the `@actions/attest` provenance shape

| | |
| --- | --- |
| File | `actions-attest-provenance.json` |
| Source | `actions/toolkit`, `packages/attest/src/provenance.ts` (`buildSLSAProvenancePredicate`) |
| Upstream | <https://github.com/actions/toolkit/blob/0be0a6ef893c47d7b130e178c1cedc03ab6ceb9c/packages/attest/src/provenance.ts> |
| Package version | `@actions/attest@3.2.0` |
| License | MIT |
| Pinned | 2026-07-25 |

### Why this is here

A verifier must see the same `buildDefinition` / `runDetails` structure whether an attestation came through `@actions/attest` or through this package. That compatibility is a **property**, so the design records it as a pinned fixture rather than a comment.

The file is the predicate `buildSLSAProvenancePredicate` produces for one fixed set of OIDC claims, transcribed from the upstream expression above. `SlsaProvenance.forGitHubWorkflow` is fed those same claims and must serialize to exactly this — deep-equal, so an extra field fails as loudly as a missing one.

One deliberate divergence, and it is in our favour: upstream reads `process.env.GITHUB_SERVER_URL` with no default, so an unset variable emits the literal string `undefined` into every URL. `GitHubWorkflowProvenance.serverUrl` is a required field, so the value is always the caller's and never the ambient environment's.

### Updating

Re-pin when the upstream predicate shape changes — a shape change there is a compatibility break here, which is exactly what this fixture exists to surface.
