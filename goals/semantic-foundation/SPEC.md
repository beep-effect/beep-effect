# Semantic Foundation Spec

## Objective

Deliver the shared semantic substrate for legal intake and future law-practice
domain packets: repo-owned SKOS concept schemes minted with `@beep/identity`
under `https://ns.beep.sh/`, FOLIO-aligned where vetted, loaded through
schema-first `@beep/ontology` registry/service APIs, and consumable by document
intake, filing-path, classification, ClaimGate, docketing, and party-role
workflows without introducing a graph store, SPARQL runtime, or law-practice
domain entities.

## Non-Goals

- No SPARQL engine wiring in v1. The contract stays
  `UnsupportedSparqlQueryServiceLive`; any topology report for SPARQL belongs
  to a separate gated P4/M4 decision.
- No graph store. Legal semantic facts remain projected into Postgres/PGlite
  per `goals/legal-document-intake` D6.
- No law-practice domain entities. `TrademarkAsset`, docketing entities, and
  time-bounded trademark workflow models stay out; spawn a
  `trademark-docketing-domain` packet when M3 vocabulary stabilizes.
- No duplication of `goals/legal-document-intake` documents-slice work:
  taxonomy-derived vault path implementation and concrete taxonomy-backed
  ClaimGate use stay there. This packet supplies vocabulary and registry
  capabilities those packets consume.
- The former ontology-survey packet was removed 2026-07-14, so its no-edit
  fence is moot; grounding remains in `explorations/legal-ontology-landscape`.
- No vendoring third-party TTL/OWL into tracked package source. Third-party
  material stays gitignored under the exploration asset pack with committed
  fetch/manifest metadata; repo-owned seed TTL/JSON-LD is tracked as our IP.

## Source Hierarchy

1. User locked decisions from the 2026-07-08 legal-ontology-landscape grilling
   log, mirrored in
   [`DECISIONS.md`](../../explorations/legal-ontology-landscape/DECISIONS.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`explore`,
   `repo-symbol-discovery`, `effect-first-development`,
   `schema-first-development` when implementation starts).
3. `goals/README.md`, `explorations/README.md`, the goal template, and
   `goals/identity-iri-core` as packet exemplar.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `history/`, and the source exploration's
   `research/` reports.

Higher sources outrank lower sources when they conflict. Exploration P1-P4
research can decide which vocabularies earn constants or loader support, but it
cannot widen non-goals without a dated `SPEC.md` change.

## Target Surfaces

- `packages/foundation/modeling/rdf/src/Vocab/*` (`@beep/rdf`) - may gain
  constants only for vocabularies that earn them through P1/P2 research
  verdicts. Existing SKOS constants (`Concept`, `ConceptScheme`,
  `broader`, `narrower`, `exactMatch`, `closeMatch`) are reused.
- `packages/foundation/modeling/ontology/src/**` (`@beep/ontology`) - gains
  SKOS concept-scheme/taxonomy registry models and a loader service. Current
  surface is FOLIO OpenAPI component models (`Ontology.models.ts`) only.
- `packages/foundation/modeling/identity/src/Vocab.ts` and
  `packages/foundation/modeling/identity/src/packages.ts` (`@beep/identity`) -
  concept IRIs are minted through `IdentityComposer`; vocabulary extension uses
  the existing `mergeVocab` extension point and `https://ns.beep.sh/`
  authority.
- `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`
  and `packages/foundation/capability/semantic-web/src/adapters/shacl-engine.ts`
  (`@beep/semantic-web`) - bounded SHACL contract remains unchanged; M4 authors
  intake/ClaimGate shapes against it.

## Constraints

- Graph-is-projection doctrine is load-bearing: semantic source data can be RDF
  or SKOS, but application graph state projects into schema-first
  Postgres/PGlite tables. A dedicated graph database is out of scope.
- Schema-first Effect models, typed errors, and tagged unions are required for
  registry, loader, and concept-scheme data.
- `https://ns.beep.sh/` is the repo authority for minted concept IRIs; ad-hoc
  local namespaces such as `https://beep.local/...` are not acceptable for new
  committed seed data.
- M1 is intake-serving and starts now. M2-M4 are gated and must not be pulled
  forward without their gate conditions.
- FOLIO alignment is metadata (`skos:exactMatch` / `skos:closeMatch`) where
  available and vetted, not an external source of truth that can overwrite
  repo-owned concepts.
- Third-party ontology/vendor asset hygiene is strict: vendor TTL/OWL remains
  under `explorations/legal-ontology-landscape/assets/vendor/`, with committed
  manifest/fetch metadata in the exploration asset pack; repo-owned taxonomy
  seed TTL/JSON-LD is committed in the goal implementation.
- Do not create law-practice package models or document-intake workflow code in
  this packet.

## Milestones

| Milestone | Gate | Capability | Exit criteria |
| --- | --- | --- | --- |
| M1 Intake-Serving Semantic Seed | Starts now | Repo-owned SKOS taxonomy seed with `https://ns.beep.sh/` concept IRIs, FOLIO `skos:exactMatch`/`skos:closeMatch` where available, document-class vocabulary (`draft`, `redline`, `filed`, `received`, `privileged`, `extracted-child`), filing-path semantics for local vault + Box mirror, and `@beep/ontology` taxonomy registry/loader loading committed seed plus vetted gitignored vendor slices from the exploration asset-pack manifest. | An intake librarian loop can classify a sample document against the taxonomy seed and produce a filing path plus document class with FOLIO-aligned concept IRIs; `bun run beep yeet verify` is green or unrelated failures are recorded. |
| M2 Classification Schemes | Gated behind the August 5 first-user metric or a demo-day pull | IPC, CPC, and Nice as loadable SKOS concept schemes with edition tracking and broader/narrower lookup. | A caller can load a pinned edition and resolve classification code hierarchy without confusing CPC and IPC. |
| M3 Docketing and Party Roles | Gated after M2 readiness and explicit product pull | Docketing/deadline vocabulary plus party-role vocabulary modules that separate enduring party identity from time-bounded legal roles. | A `trademark-docketing-domain` packet can be spawned with stable vocabulary contracts for trademark docketing entities. |
| M4 Intake ClaimGate Shapes | Gated after M1 consumers prove need and M3 vocabulary is stable enough | SHACL shape authoring for intake/ClaimGate gates against the existing bounded validator in `@beep/semantic-web`. | Shapes validate against `ShaclValidationService` without changing the semantic-web service contract; SPARQL remains unsupported. |

## Acceptance Criteria

- [ ] M1 taxonomy seed is committed as repo-owned TTL/JSON-LD and schema-first
      data, with concept IRIs minted under `https://ns.beep.sh/`.
- [ ] M1 includes document-class vocabulary for `draft`, `redline`, `filed`,
      `received`, `privileged`, and `extracted-child`.
- [ ] M1 registry/loader can load the committed seed plus vetted gitignored
      vendor slices listed by the exploration asset-pack manifest, without
      tracking third-party TTL/OWL.
- [ ] M1 exposes filing-path semantics for local vault plus Box mirror as
      vocabulary/registry data, not document-slice placement code.
- [ ] M1 intake librarian loop can classify a sample document against the
      taxonomy seed and produce a filing path plus document class with
      FOLIO-aligned concept IRIs.
- [ ] `@beep/rdf` constants are added only when P1/P2 research verdicts justify
      them; otherwise existing SKOS/RDF vocabulary constants are reused.
- [ ] `@beep/semantic-web` bounded SHACL and
      `UnsupportedSparqlQueryServiceLive` contracts remain unchanged.
- [ ] `bun run beep yeet verify` passes, or unrelated baseline failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors, package-source churn outside target surfaces, or
      expansion beyond the ontology-survey scope absorbed from
      `explorations/legal-ontology-landscape`; the removed packet's fence is
      moot as of 2026-07-14.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/semantic-foundation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/semantic-foundation/ops/manifest.json` | Passes |
| Packet references | `rg -n "semantic-foundation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantic-foundation` | Passes |
| Whitespace | `git diff --check -- goals/semantic-foundation explorations/legal-ontology-landscape explorations/ATLAS.md` | Passes |
| M1 registry/loader | Package-local tests for `@beep/ontology` and touched target packages | Green |
| M1 intake loop | Fixture proves sample document -> taxonomy concept -> document class -> filing path with aligned concept IRI | Green |
| Repo quality | `bun run beep yeet verify` | Green or unrelated failures documented |
| Reflection closeout | `bun run beep lint reflection-artifacts` | Green before completion |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed M1 or pull M2-M4 work forward without the
  named gate.
- A change exceeds the ontology-survey scope absorbed from
  `explorations/legal-ontology-landscape` (the former packet was removed
  2026-07-14), or requires touching law-practice domain entities,
  document-intake workflow code, graph-store wiring, SPARQL
  engine wiring, dependencies, lockfiles, credentials, or generated artifacts
  not explicitly required by this spec.
- Vendor ontology material cannot be licensed or manifested safely.
- Verification requires unnamed credentials, cost, destructive side effects, or
  policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | — | — | A drafting-time exception about absent exploration source files was removed 2026-07-08: the files exist (`CAPTURE.md`, `research/01-direction-grounding.md`, `assets/README.md`) and this SPEC was reconciled against them at review. | — |
