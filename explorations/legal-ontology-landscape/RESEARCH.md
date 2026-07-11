# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-07-08 — Synthesis of P0–P4 + verification

Full reports live in [`research/`](./research/); this is the decision-ready
digest. Asset evidence: [`assets/manifest.jsonl`](./assets/manifest.jsonl)
(16 rows, 9 fully verified) + gitignored `assets/vendor/` reproducible via
[`assets/fetch.sh`](./assets/fetch.sh).

### Adopt now (M1 inputs)

- **SKOS** — structural contract for the taxonomy seed and every
  classification scheme (verified; W3C document-use terms).
- **DCTerms** — generic document metadata; do not mint duplicates under
  `ns.beep.sh` (verified; CC-BY-4.0).
- **PROV-O** (narrow profile) — document lineage: original→extracted child,
  draft→redline, filed/received copies (verified).
- **Box metadata taxonomies + folder structure** — product constraint, not an
  ontology: M1 filing semantics must project into Box's model
  ([P1 report](./research/02-legal-dms-file-metadata.md)).
- **FOLIO** — slice: legal-practice label/mapping backbone via
  `skos:exactMatch`/`closeMatch` metadata; never source of truth; shallow on
  patent/trademark practice ([P2 report](./research/03-legal-core-ip-ontologies.md)).

### Slice / inspire (later milestones)

- **PAV** — versioning predicates where clearer than generic `prov:*` (M1/M4).
- **NEPOMUK NMO/NIE** — design reference for email/attachment/thread modeling
  (CQ 11); do not import the semantic-desktop stack.
- **LKIF-core modules** (7 vendored) — inspire for norm/role/action patterns;
  namespace IRIs are dead (404), upstream unmaintained; GitHub mirror only.
- **IAO, Copyright Ontology** — vendored, verified; doctrine grounding for
  later copyright/document-artifact modeling.
- **iManage/NetDocuments patterns, SALI LMSS, XMP, PREMIS** — inspire only
  (SALI blocked on license conflict; see P1 report).

### Reject (for M1)

EXIF (image evidence only), SPDX (no SBOM path), schema.org (external
interchange only), LegalRuleML (no rule-engine consumer). Rationale per
candidate in the P1/P2 reports.

### Topology (P4 recommendations, all consistent with graph-is-projection)

1. SPARQL: keep `UnsupportedSparqlQueryServiceLive` through v1/M4; Oxigraph is
   the named candidate if gates open.
2. SHACL: deliberately keep the bounded in-repo validator for M4;
   `rdf-ext/shacl-engine` only if fixtures prove the bounded subset is the
   blocker.
3. OWL RL/EL inference: none for v1.
4. LinkML: generator inspiration only; `@beep/schema` stays the hub.
5. Projections: Postgres/PGlite + pgvector; FalkorDB optional later read
   model; Graphiti/Cognee bounded caches. Gate conditions in the
   [P4 report](./research/05-semantic-topology-recommendation.md).

### Where this graduated

- [`goals/semantic-foundation`](../../goals/semantic-foundation/README.md) —
  M1 (taxonomy seed, document classes, filing-path vocabulary, `@beep/ontology`
  registry/loader) starts now; M2 (IPC/CPC/Nice SKOS), M3 (docketing +
  party-role vocab), M4 (SHACL shapes) gated.
- [`goals/trademark-docketing-domain`](../../goals/trademark-docketing-domain/README.md)
  — deferred stub, blocks on M3.
- `goals/ip-law-knowledge-graph` — ontology-survey scope superseded;
  KG-projection scope retained (deferred); storage decision follows the P4
  gates.

### Competency-question coverage

CQs 2,3,11,15,19 → M1 (SKOS/DCTerms/PROV-O/FOLIO-alignment adopted).
CQs 9,10 → M2 (classification scheme sources listed in the P2 report).
CQs 1,7,8,5,18 → M3 (vocabulary recommendations in P2; trademark entity gap
tracked in the stub packet). CQs 12,13,14 → existing LangExtract→ClaimGate
loop + P3 patterns. CQs 16,17,20 → P4 recommendations + gate conditions.
Gap: no candidate fully covers docketing-obligation vocabulary — M3 will mint
under `ns.beep.sh` (expected; recorded in P2's M3 section).

## External Landscape

See dated synthesis above and the per-phase cited reports in
[`research/`](./research/).

## In-Repo Capability Inventory

See [`research/01-direction-grounding.md`](./research/01-direction-grounding.md)
("Existing semantic surface" table) — `@beep/rdf`, `@beep/identity`,
`@beep/ontology` (FOLIO models), `@beep/semantic-web` (bounded SHACL, unwired
SPARQL), `@beep/rdf-canonize`, LangExtract→IrToLaw→ClaimGate, Tika/libpff.

## Constraints Discovered

- Public repo: third-party ontology bytes stay gitignored (manifest + fetch
  script are the committed record).
- LKIF namespace IRIs no longer dereference; anything built on them must not
  assume dereferenceable terms.
- SALI LMSS license conflict (MIT vs CC-BY-ND claims) blocks ingestion until
  resolved.
- Firecrawl/network access inside codex sandboxes is unreliable; fetch and
  IRI verification legs may need the coordinator shell
  ([verification report](./research/06-verification-report.md)).
