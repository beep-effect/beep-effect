# P0 Bootstrap Evidence - 2026-07-08

## Scope Re-Affirmation

- P0 is complete as a read-mostly bootstrap phase only. No package source,
  public API, dependency, or lockfile change is in scope for this record.
- Later phases remain bounded by the packet contract and repo standards:
  scaffold the minimum legal ontology slice first, keep semantic meaning in
  the slice, and keep RDF/SPARQL/SHACL engine mechanics behind server or
  driver boundaries.
- Repo standards outrank packet prose where they conflict. For P1 this means
  starting with the minimum legal slice roles before adding UI, config, tables,
  or driver surfaces.
- Branch context was `feat/ontology-workbench-p0-bootstrap`; package checks
  below were made against the live checkout.

## Capability Surface Checks

### `@beep/rdf` - confirmed

The capability report claims `@beep/rdf` is the canonical RDF and linked-data
modeling substrate, including IRI/URI, JSON-LD, PROV, RDF terms, semantic
metadata, evidence, web annotation, CURIE, namespace binding, named node,
literal, quad, and dataset models.

Evidence:

- `packages/foundation/modeling/rdf/package.json:1-17` declares
  `@beep/rdf` as a foundation/modeling package.
- `packages/foundation/modeling/rdf/src/index.ts:24-79` exports the public
  modules for web annotation, evidence, IRI, JSON-LD, PROV, RDF, semantic
  metadata, and URI.
- `packages/foundation/modeling/rdf/src/Rdf.ts:293-316`,
  `:389-479`, `:732-801`, and `:820-857` define/export CURIE, named node,
  literal, quad, dataset, namespace binding, and prefix-map models.
- `packages/foundation/modeling/rdf/src/JsonLd.ts:55-68`, `:144-163`, and
  `:435-454` define JSON-LD keyword, context, and document surfaces.
- `packages/foundation/modeling/rdf/src/Iri.ts:888-1043` and
  `packages/foundation/modeling/rdf/src/Uri.ts:206-349` define the exported
  IRI/URI reference and absolute/relative models.
- `packages/foundation/modeling/rdf/src/Vocab/*.ts` contains RDF, RDFS, OWL,
  SKOS, PROV, DCTERMS, OA, and XSD vocabulary constants.

Result: confirmed. No P1-P5 decision-invalidating drift found.

### `@beep/semantic-web` - confirmed with boundary note

The capability report claims `@beep/semantic-web` is a foundation/capability
package that provides semantic-web utility schemas and service contracts,
including SPARQL, SHACL, and canonicalization contracts.

Evidence:

- `packages/foundation/capability/semantic-web/package.json:1-4`,
  `:33-38`, and `:57-72` declare `@beep/semantic-web` as a
  foundation/capability package with root and wildcard exports and a
  dependency on `@beep/rdf`.
- `packages/foundation/capability/semantic-web/README.md:1-8` and `:10-19`
  describe JSON-LD, SHACL/SPARQL contracts, IRI/URI helpers, service
  contracts, and lightweight adapters.
- `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:87-98`,
  `:198-219`, `:279-307`, and `:348-395` define the SPARQL request, result
  union, error, service contract, service tag, and unsupported default layer.
- `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:18-31`,
  `:91-144`, `:167-244`, `:304-332`, and `:372-374` define the bounded SHACL
  shape subset, validation request/result, error, service contract, and
  service tag.
- `packages/foundation/capability/semantic-web/src/services/canonicalization.ts:50-71`,
  `:167-214`, `:235-298`, and `:343-345` define canonicalization algorithms,
  canonicalize/fingerprint requests, results, service contract, and service
  tag.
- `packages/foundation/capability/semantic-web/src/index.ts:1-13` exports only
  the curated root IRI surface; `packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts:75-83`
  asserts that root-surface choice.

Result: confirmed. Later phases must import service contracts by explicit
subpath, such as `@beep/semantic-web/services/sparql-query`, rather than
assuming the root barrel exports them.

### `@beep/rdf-canonize` - confirmed

The capability report claims `@beep/rdf-canonize` is the driver package around
`rdf-canonize`, with `CanonicalizationServiceLive` implementing canonicalize
and fingerprint behavior needed by P1 round-trip testing.

Evidence:

- `packages/drivers/rdf-canonize/package.json:1-5`, `:33-38`, and `:57-72`
  declare `@beep/rdf-canonize` as a driver package with root and wildcard
  exports and dependencies on `@beep/rdf`, `@beep/semantic-web`, and
  `rdf-canonize`.
- `packages/drivers/rdf-canonize/README.md:1-13` and `:17-27` describe the
  driver, its relation to the semantic-web contract, and the
  `CanonicalizationServiceLive` import path.
- `packages/drivers/rdf-canonize/src/index.ts:8-14` exports the
  canonicalization adapter namespace.
- `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:24-30`,
  `:39-49`, `:185-209`, and `:230-261` wire the semantic-web
  canonicalization contract to `rdf-canonize`, resource limits, canonicalize,
  and fingerprint.
- `packages/drivers/rdf-canonize/test/CanonicalizationSecurity.test.ts:57-58`,
  `:85-122`, `:140-158`, and `:160-201` exercise the live layer, resource
  controls, lexical fallback request shape, source schema, and round-trip
  behavior.

Result: confirmed. No P1-P5 decision-invalidating drift found.

## Drift Recorded

- No decision-invalidating package-surface drift was found for P1-P5.
- Environment drift: refreshing `origin/main` with
  `git fetch origin main:refs/remotes/origin/main --quiet` failed because
  `.git/FETCH_HEAD` is read-only in this sandbox. The package-source checks
  above are therefore live-checkout evidence, not a refreshed remote-base
  comparison.
- Metadata risk, not an API blocker: `packages/drivers/rdf-canonize/package.json:5`
  declares `Apache-2.0`, while `packages/drivers/rdf-canonize/README.md:40`
  says `MIT`. Reconcile before any P3-P5 attribution or dependency-license
  evidence depends on that package metadata.

## P1 Risks

- The semantic-web root barrel is intentionally curated to IRI helpers. P1-P5
  should import SPARQL, SHACL, and canonicalization contracts through explicit
  service subpaths.
- `ShaclValidationService` currently documents a bounded SHACL-inspired subset.
  P5 needs to decide whether the existing contract is enough for loaded shapes
  plus asserted/inferred graph validation, or whether a driver-backed engine is
  required.
- SPARQL currently has an unsupported default live layer. P4 must provide the
  Oxigraph-backed implementation and keep query/resource safeguards explicit.
- Round-trip testing should compare `CanonicalizationService.fingerprint`
  output, not raw serialized graph text.
- P1 should scaffold only the minimum legal ontology slice roles
  (`domain`, `use-cases`, `server`) and keep N3 parsing/serialization at the
  server or driver boundary.
