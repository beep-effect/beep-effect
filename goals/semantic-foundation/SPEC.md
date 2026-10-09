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
   `effect-first-development`,
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
  (`@beep/semantic-web`) and the bounded validator now at
  `packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts`
  (`@beep/epistemic-server`) - bounded SHACL contract remains unchanged; M4
  authors intake/ClaimGate shapes against it.

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

### 2026-10-09 gate amendment

M2 and M3 product gates are met by the Decision Log product pull. M3 code
starts after M2 tests and the real-artifact proof pass. M4 remains gated.

## Milestones

| Milestone | Gate | Capability | Exit criteria |
| --- | --- | --- | --- |
| M1 Intake-Serving Semantic Seed | Starts now | Repo-owned SKOS taxonomy seed with `https://ns.beep.sh/` concept IRIs, FOLIO `skos:exactMatch`/`skos:closeMatch` where available, document-class vocabulary (`draft`, `redline`, `filed`, `received`, `privileged`, `extracted-child`), filing-path semantics for local vault + Box mirror, and `@beep/ontology` taxonomy registry/loader loading committed seed plus vetted gitignored vendor slices from the exploration asset-pack manifest. | An intake librarian loop can classify a sample document against the taxonomy seed and produce a filing path plus document class with FOLIO-aligned concept IRIs; `bun run beep yeet verify` is green or unrelated failures are recorded. |
| M2 Classification Schemes | Gated behind the August 5 first-user metric or a demo-day pull | IPC, CPC, and Nice as loadable SKOS concept schemes with edition tracking and broader/narrower lookup. | A caller can load a pinned edition and resolve classification code hierarchy without confusing CPC and IPC. |
| M3 Docketing and Party Roles | Gated after M2 readiness and explicit product pull | Docketing/deadline vocabulary plus party-role vocabulary modules that separate enduring party identity from time-bounded legal roles. | A `trademark-docketing-domain` packet can be spawned with stable vocabulary contracts for trademark docketing entities. |
| M4 Intake ClaimGate Shapes | Gated after M1 consumers prove need and M3 vocabulary is stable enough | SHACL shape authoring for intake/ClaimGate gates against the existing bounded validator in `@beep/semantic-web`. | Shapes validate against `ShaclValidationService` without changing the semantic-web service contract; SPARQL remains unsupported. |

## Acceptance Criteria

- [x] M1 taxonomy seed is committed as repo-owned TTL/JSON-LD and schema-first
      data, with concept IRIs minted under `https://ns.beep.sh/`.
- [x] M1 includes document-class vocabulary for `draft`, `redline`, `filed`,
      `received`, `privileged`, and `extracted-child`.
- [x] M1 registry/loader can load the committed seed plus vetted gitignored
      vendor slices listed by the exploration asset-pack manifest, without
      tracking third-party TTL/OWL.
- [x] M1 exposes filing-path semantics for local vault plus Box mirror as
      vocabulary/registry data, not document-slice placement code.
- [x] M1 intake librarian loop can classify a sample document against the
      taxonomy seed and produce a filing path plus document class with
      FOLIO-aligned concept IRIs.
- [x] `@beep/rdf` constants are added only when P1/P2 research verdicts justify
      them; otherwise existing SKOS/RDF vocabulary constants are reused.
- [x] `@beep/semantic-web` bounded SHACL and
      `UnsupportedSparqlQueryServiceLive` contracts remain unchanged.
- [x] `bun run beep yeet verify` passes, or unrelated baseline failures are
      reproduced and recorded separately.
- [x] No unrelated refactors, package-source churn outside target surfaces, or
      expansion beyond the ontology-survey scope absorbed from
      `explorations/legal-ontology-landscape`; the removed packet's fence is
      moot as of 2026-07-14.

### M2 acceptance (2026-10-09)

- [ ] Pinned IPC/CPC/Nice editions resolve hierarchy with distinct scheme identities.
- [ ] Typed failures cover mismatches, unpinned editions, unvetted rows and path escape.
- [ ] Real manifest decoder preserves M1 admission and skips classification rows (R3).
- [ ] Real-artifact proof records edition, counts, checksums and three lookups per scheme.
- [ ] CPC scope and all source reuse evidence are recorded in the licence ledger (R2).

### M3 acceptance (2026-10-09)

- [ ] Docketing, party-kind and legal-role seeds have TTL/JSON-LD/TS parity.
- [ ] Every IRI uses the repository authority; party kinds and roles remain disjoint.
- [ ] Replayable CQ 1/5/7/8/18 fixtures resolve versioned concept IRIs.
- [ ] Frozen vocabulary contract and read-only trademark packet spawn seed are retained.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/semantic-foundation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/semantic-foundation/ops/manifest.json` | Passes |
| Packet references | `rg -n "semantic-foundation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantic-foundation` | Passes |
| Whitespace | `git diff --check -- goals/semantic-foundation explorations/legal-ontology-landscape explorations/ATLAS.md` | Passes |
| M1 registry/loader | Package-local tests for `@beep/ontology` and touched target packages | Green |
| M1 intake loop | Fixture proves sample document -> taxonomy concept -> document class -> filing path with aligned concept IRI | Green |
| Repo quality (M2/M3) | hosted CI on the PR | Required checks green on the PR head, or each failure attributed as unrelated in the handoff (RULINGS S11) |
| M2 lookup tests | Pinned hierarchy and CQ 9/10 fixtures | Green |
| Real-manifest decode (R3) | Shared decoder test reads the asset-pack manifest without vendor bytes | Zero parse errors; alignment and classification routes asserted |
| M2 real-artifact proof | Handoff table from beep-heavy runtime proof | All schemes and M1 regression pass |
| M3 separation and CQs | Seed parity, disjoint kinds/roles and CQ 1/5/7/8/18 fixtures | Green |
| Reflection closeout | `bun run beep lint reflection-artifacts` | Green before completion |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed M1-M3 or pull M4 work forward without the named gate.
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

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-09 | Reopen for M2 and M3. | The operator requested agent completion of the Corpus Ingestion Run Order on 2026-10-09; the orchestrator explicitly pulled both milestones. M3 implementation waits for M2 tests and real-artifact readiness. | Run `bun run beep goals set-status semantic-foundation completed-retained` and `git revert` the delivery PR. |
| 2026-10-09 | M4 stays `pending`, routed to legal-document-intake P4. | This lane supplies version-pinned vocabulary slices; M4 has a separate owner. | Reassign M4 in manifest `statusNote`. |
| 2026-10-09 | Repo-quality proof for M2/M3 is hosted CI on the PR. | AGENTS.md Quality Operator requires push-first publication; hosted CI is authoritative and `bun run beep yeet verify` is on demand. | Restore `bun run beep yeet verify` in the SPEC Verification Matrix, manifest verificationCommands and PLAN verification block; run `beep-heavy bun run beep yeet verify` before completion. |
| 2026-10-09 | R5 changes both stop-condition surfaces from "The implementation would exceed M1 or pull M2-M4 work forward without the named gate." to "The implementation would exceed M1-M3 or pull M4 work forward without the named gate." | The named product pull admits M2 and M3 while retaining the M4 gate. | Restore the old text in SPEC and manifest together in one commit. |
| 2026-10-09 | Pin IPC 2026.01, CPC 2026.08 and Nice 13-2026 (texts revision 20260715). | Official WIPO configuration marks 20260101 current; CPC bulk page lists 202608. Future IPC 20270101 is not current. | Add a new separately pinned edition after fetching and proving it; keep existing identities. |
| 2026-10-09 | Edition-scoped scheme and concept IRIs use `$SemanticFoundationId`; IPC and CPC have distinct spaces. | Shared notation is not shared identity. External IRIs never carry identity. | Introduce a versioned contract migration; deprecate old IRIs without re-pointing them. |
| 2026-10-09 | External IRIs are only exactMatch metadata backed by VETTED rows; otherwise omit them. | Prevent label-based identity and unadmitted external mappings. | Add explicit vetted mapping rows with evidence and tests. |
| 2026-10-09 | Full editions load only from vendor files; tracked fixtures are synthetic and metadata is bounded. | No tracked third-party payload; avoid unbounded package seeds. | Amend scope with redistribution evidence and a bounded data plan. |
| 2026-10-09 | Locarno and Vienna stay deferred. | P2 limits this pull to IPC/CPC/Nice. | Record a new product pull and amend scope. |
| 2026-10-09 | IPC and Nice reuse gate accepts WIPO CC BY 4.0 with attribution and conversion notice. | Terms page and edition download templates returned HTTP 200; templates link master files and show no service-specific override. | Mark sources UNVETTED and stop loading if an overriding term appears. |
| 2026-10-09 | CPC loads identifiers only: symbols, parent hierarchy and titles (R2). | EPO linked-open-data page returned HTTP 200 and names CC BY 4.0 for Linked open EP data, but does not name scheme XML or bulk zips. No definitions, notes, references or warnings are admitted. | Broaden only with explicit XML reuse evidence, a new ledger row and parser tests. |
| 2026-10-09 | R3 adds the VendorLoadKind LiteralKit domain and M1 classification skip route, with an exported row decoder. | Every M1 real-manifest load must survive the new classification rows; tests must share production decoding. | Revert this loader commit and M2 rows together; never revert the loader alone while rows remain. |
| 2026-10-09 | Select shared `decodeVendorManifestRow` and canonical vendor-path containment for M1/M2; implementation is checkpointed at `14596dceef` pending the separately owned XML-reader fix and runtime proof. | The M1 reflection requested one manifest validator when another runtime kind exists; sharing admission rejects unknown discriminators consistently and preserves symlink guards. | Revert the shared extraction and registry together, retaining the R3 skip route while classification rows remain. |
| 2026-10-09 | Release notes replace a changeset for private `@beep/ontology`, per #1566 and the standing orchestrator ruling. | The package is private; M2 adds pinned classification APIs and shared admission without breaking existing M1 callers, so no major release would be needed. Private workspaces cannot appear in changesets. | Revert the additive M2 API/extraction and classification manifest rows together; if publication policy changes, use the then-current release mechanism. |

| 2026-10-09 | Adapt classification element content to the landed `#text` reader contract (run-6 ruling); retain child elements named `text`. | Nice attributed heading/label content and attributed IPC/CPC text nodes use the reserved content key. | Revert the consumer adaptation only if the shared reader contract is also reversed; never add a fallback conflating content and child elements. |
| 2026-10-09 | R4 adds the new `ClassificationRegistry.ts` row: lines 95.61, statements 95.72, branches 86.36, functions 91.93. | The sanctioned scoped coverage writer measured these error paths; existing rows and package totals remain unchanged. | Delete this row once the file has zero uncovered units. |
| 2026-10-09 | R4 adds the new `internal/ClassificationXml.ts` row: lines 93.22, statements 93.18, branches 100, functions 87.14. | The sanctioned scoped coverage writer measured these parser paths; existing rows and package totals remain unchanged. | Delete this row once the file has zero uncovered units. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | — | — | A drafting-time exception about absent exploration source files was removed 2026-07-08: the files exist (`CAPTURE.md`, `research/01-direction-grounding.md`, `assets/README.md`) and this SPEC was reconciled against them at review. | — |

## Decision Log — shared XML reader repair, 2026-10-09

- Use fast-xml-parser's reserved `#text` key and migrate the ISO 4217 and IANA
  parsed-node consumers in the same PR. The key cannot collide with a valid
  XML element name; reverting these three source edits reverses the change.
- Follow the live private-workspace release policy: both `@beep/schema` and
  `@beep/repo-cli` have `private: true` on base `4e82f6d942`. The lane brief's
  published-schema premise is stale. A staged patch changeset failed the
  changeset graph guard, so remove it and list the packages in the PR body.
  Publication activation requires its own release-policy decision.

- Block XML publication on inherited cheap-gate reds from integrated base
  `cb64e0484f`; retain the local source and handoff commits and route the
  unrelated repairs to the orchestrator for one main PR. Resume by merging
  the main repair and retrying Yeet; no gate waiver or unrelated inventory
  refresh is introduced by this lane.
