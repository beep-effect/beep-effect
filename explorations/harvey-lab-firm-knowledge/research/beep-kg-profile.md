# beep-effect KG / Retrieval / Ontology — Honest In-Repo Profile

Date: 2026-08-08 · Packet: `explorations/harvey-lab-firm-knowledge` ·
Lane: in-repo profile (no web research) · Method: live source + packet docs only

> **Scope note.** This report makes **zero external claims**. Every statement
> below is verified by `rg`/`ls`/`read` against the working tree at
> `/home/elpresidank/YeeBois/projects/beep-effect13` on commit `6b42b239a6`
> (branch `main`). No URLs were fetched; the Sources section lists repo paths
> and prior packet reports instead. Where a statement rests on a document
> rather than executable code, it is labelled **DOC-CLAIM** — a written
> assertion I did not independently re-run.

---

## 1. Recommendation up front

beep-effect's edge is **not** the knowledge graph. The graph is small, the
retrieval is lexical-only, and the flagship KG delivery
(`goals/practice-kg-mcp`) is sitting on two confirmed blocker-class data
defects. The edge is one layer down: **a schema-first substrate where the
type system, the persistence layer, the ontology, the tool contracts, and the
provenance/admission gates are all projections of the same Effect Schema
declarations.** 998 `LiteralKit(...)` closed domains across 419 files and 3,450
`S.Class` declarations are not decoration — they are the reason
`packages/foundation/modeling/ontology/src/Fold.assembly.ts:886` can derive an
OWL/SKOS ontology, a JSON-LD context, and Turtle *from the running domain
model* rather than from a hand-maintained side file.

Against a "RAG + agentic search" baseline, beep is **ahead on admissibility**
(closed vocabularies, decode boundaries, span-verified evidence, a total
refusal-as-value claim gate, local-first-by-default extraction) and **behind on
recall** (no dense retrieval, no reranking, no stemming, no OCR, ~7.3k
documents, 7 node kinds, 9 edge predicates).

That asymmetry is the strategy signal for the Harvey comparison: beep is not a
smaller Harvey, it is a differently-shaped system whose scarce resource is
corpus and evaluation, not architecture.

---

## 2. The schema-first substrate (the real differentiator)

### 2.1 What is actually enforced

| Mechanism | Evidence |
| --- | --- |
| Closed literal domains everywhere | 998 `LiteralKit(` call sites across 419 files under `packages/`+`apps/` |
| Schema classes as the domain model | 3,450 `extends S.Class<` declarations |
| Identity composers mint IRIs | `packages/foundation/modeling/identity/src/packages.ts:40` — `Identity.make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })`; per-package composers e.g. `$SemanticFoundationId.iri === "https://ns.beep.sh/ontology/semantic-foundation"` (`packages.ts:295`) |
| Every schema carries annotation identity | `$I.annoteSchema(...)` / `$I.annote(...)` on essentially every exported schema, e.g. `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:47` |

Scale for context: 138 workspace `package.json` files, 2,722 `src/**` `.ts`/`.tsx`
files, 651 test files.

### 2.2 Why this is architecturally load-bearing, not stylistic

`packages/foundation/modeling/ontology/src/Fold.assembly.ts` implements
`fold(composer, { label, schemas, triples })` — it walks Effect Schema class
declarations, resolves class IRIs *through their identity annotations*, defaults
owned predicate local names from struct keys, routes borrowed predicates through
an `ontologyTerm` channel, checks SKOS hard-errors, and emits an
`AssembledOntology` (`Fold.assembly.ts:886–927`). Projections to JSON-LD, a
JSON-LD context, and Turtle live in `Fold.projections.ts` (648 lines); a
Markdown projection in `Fold.markdown.ts` (289 lines).

The consequence: **the ontology cannot drift from the code**, because the
ontology *is* the code. That is the single strongest architectural claim in this
repo's semantic stack, and it is a claim a Python/LLM-pipeline shop structurally
cannot make.

**Caveat (important, and it is the honest half):** no production code path calls
`fold()` today. Grepping `fold(`-shaped call sites outside
`packages/foundation/modeling/ontology/**` returns nothing in `src/`. The fold is
exercised by `packages/foundation/modeling/ontology/test/Fold.test.ts` and
documented in JSDoc examples. **It is a proven capability with no shipping
consumer.** There is no `bun run beep`-driven "publish the beep ontology" lane.

### 2.3 Zero-vendor RDF core

`packages/foundation/modeling/rdf/package.json` and
`packages/foundation/capability/semantic-web/package.json` declare **no external
RDF dependency** — only `@beep/identity`, `@beep/schema`, `@beep/utils`,
`effect`. The RDF term model, IRI schemas, PROV vocabulary, JSON-LD
context/document/stream handling, and Web Annotation adapters (28 src files,
5,088 lines in `semantic-web`; 22 files, 7,071 lines in `rdf`) are hand-built
schema-first. Real engines enter only as separate drivers (`@beep/oxigraph`,
`@beep/shacl`, `@beep/n3`, `@beep/rdf-canonize`).

Trade-off, stated plainly: full decode-boundary typing and no vendor lock-in,
paid for with a large hand-maintained surface that one person owns.

---

## 3. Semantic / ontology capability

### 3.1 `goals/semantic-foundation` — M-milestone reality

`goals/semantic-foundation/ops/manifest.json` phases:

| Milestone | Manifest status | What actually exists |
| --- | --- | --- |
| M1 Intake-Serving Semantic Seed | `complete` | Real. See below. |
| M2 Classification Schemes (IPC/CPC/Nice) | `pending` — gated on "the August 5 first-user metric or a demo-day pull" | **Nothing.** No IPC/CPC/Nice loader, no edition tracking. |
| M3 Docketing + Party Roles | `pending` — gated after M2 | **Nothing.** |
| M4 Intake ClaimGate SHACL Shapes | `pending` — gated after M1 consumers prove need | **Nothing** in `@beep/ontology`; the epistemic ClaimGate ships one hardcoded shape (§6.2). |
| P3 Yeet-to-mergeable / P4 Close | `pending` | Packet has never closed. |

**M1 as-built, precisely:**
- `packages/foundation/modeling/ontology/src/SemanticFoundation.seed.ts` (140
  lines) declares **9** `TaxonomyConcept.make(...)` entries.
- **All 9 carry `alignments: []`.** The FOLIO alignment promised in
  `SPEC.md:98` does not exist; the source comment is candid about why —
  "FOLIO mappings remain empty until a report verifies a term-level semantic
  match" (`SemanticFoundation.seed.ts:37`).
- Committed RDF seed: `src/seed/legal-intake.ttl` (33 lines) and
  `legal-intake.jsonld` (87 lines) — one `skos:ConceptScheme`, a 3-level concept
  hierarchy (`legal-document` → `correspondence` → `email-message`), 6
  document-class concepts (`draft`, `redline`, `filed`, `received`,
  `privileged`, `extracted-child`), and 2 filing-root concepts.
- `TaxonomyLoader.ts` (294 lines) is a genuinely careful fail-closed loader:
  `VendorSlicePath` rejects `..`/absolute/separator traversal *at decode time*
  (`TaxonomyLoader.ts:33–46`), and `VendorLoadStatus = LiteralKit(["VETTED",
  "UNVETTED"])` means an unvetted slice fails closed with `VendorSliceUnvetted`.
- **No vendor slice is live-wired.** `goals/semantic-foundation/README.md`
  states this directly, and adds an R1 reconciliation caveat: the loader's
  `VendorManifestEntry` shape is narrower than the exploration asset-pack's
  `manifest.jsonl`, so pointing the loader at the real manifest today *fails
  closed with a parse error*. **DOC-CLAIM** (README assertion; the shape
  mismatch is visible in `TaxonomyLoader.ts:84`, the asset pack is out of repo).

**Honest summary: M1 is a 9-concept taxonomy seed with a hardened loader and
zero external alignment. It is correct, small, and unconsumed by any product
flow.**

### 3.2 `@beep/ontology` (foundation) vs `packages/ontology/*` (the slice)

Two distinct things share a name:

1. **`packages/foundation/modeling/ontology`** (11 src files, 4,457 lines) —
   the schema→ontology *fold*, the semantic-foundation seed, the taxonomy
   registry/loader, plus FOLIO OpenAPI component schemas in `Ontology.models.ts`
   (872 lines, `@see https://folio.openlegalstandard.org/openapi.json` at line 4
   — a *schema of FOLIO's API*, not loaded FOLIO data).
2. **`packages/ontology/{domain,use-cases,server,client,ui,config}`** — the
   ontology **workbench**, a live editing surface, `completed-retained` as of
   2026-07-09 (`goals/ontology-workbench/ops/manifest.json`).

The workbench is the most complete semantic surface in the repo and is the
piece most people would under-rate:

- `Session` aggregate with named-graph partitions
  `LiteralKit(["asserted","ontologies","inferred","shapes","provenance"])`
  (`packages/ontology/domain/src/aggregates/Session/Session.values.ts:72`), plus
  `isExcludedFromReasoning` — i.e. proper provenance/inference separation.
- Change operations with invertibility (`invertChangeOperation`,
  `Session.model.ts:861`) and delta accounting — an undoable ontology editor.
- **A real SPARQL engine**: `OntologySparqlRunnerLayer` is provided by
  `OxigraphSparqlQueryServiceLive` from `@beep/oxigraph`, which depends on the
  `oxigraph` npm package
  (`packages/ontology/server/src/aggregates/Session/Session.layer.ts:134`;
  `packages/drivers/oxigraph/package.json:61`). Query safeguards
  (`defaultLimit`, `maxResultCount`) are enforced at the use-case boundary
  (`packages/ontology/use-cases/src/tools/OntologyToolService.ts:494–497`).
- **A hand-rolled RDFS-subset reasoner**:
  `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts` (925
  lines) computes `rdfs:subClassOf` / `rdfs:subPropertyOf` transitive closure and
  `rdfs:domain`/`rdfs:range` typing (lines 543–627). Not OWL-DL. Not a tableau
  reasoner. Bounded and honest.
- **A 10-tool agent surface** (`OntologyToolkit`,
  `packages/ontology/use-cases/src/tools/OntologyToolkit.ts:713–937`):
  `OpenInspect`, `SnapshotDescribe`, `OntologySearch`, `OntologySparqlQuery`,
  `ProposeChangeBatch`, `ValidateOntology`, `RepairOntology`,
  `ExportProvenance`, `PublishProvenance`, `CapabilityMetadata` — split into
  read-only / mutation / publish sub-toolkits, with budget kinds and
  fingerprints (`OntologyFingerprint = Sha256Hex`).
- 7 test files in `packages/ontology/use-cases/test/`, including a
  `PizzaTutorial.e2e.test.ts` — the canonical ontology-tutorial as an end-to-end
  proof.
- Hosted in `apps/professional-desktop` (`src/ontology/OntologyOrchestrator.ts`,
  `server/OntologyMcpTransport.ts`), with an MCP-over-HTTP integration test.

**This is the strongest under-marketed asset in the repo:** an Effect-native,
schema-first, provenance-partitioned ontology workbench with real SPARQL,
bounded reasoning, SHACL validation, and an MCP agent surface.

### 3.3 `@beep/semantic-web` — contracts with one deliberate hole

- SHACL: a **bounded, honestly-scoped subset** — "targetClass, targetNode,
  minCount, maxCount, datatype, class, and hasValue"
  (`src/services/shacl-validation.ts:28`), with an optional `shapesDataset`
  escape hatch for full external engines.
- SPARQL: `SparqlQueryService` is a contract whose *only shipped live layer is*
  `UnsupportedSparqlQueryServiceLive` (`src/services/sparql-query.ts:383`) —
  it fails with `SparqlQueryError`. Real SPARQL exists only via
  `@beep/oxigraph` in the ontology slice (§3.2). This is a deliberate
  fail-closed default, not an oversight, but it means "beep has SPARQL" is
  true only inside the workbench.

### 3.4 The two open ontology explorations

- `explorations/legal-patent-kg-deepening` — stage `align`. Wave-1 mining
  complete: 140 catalog rows over ~120 papers / 24 repos. Two packets already
  graduated (candor implemented via PR #575; relator not started). Third wedge
  (`patent-drafting-episode-ledger`) opened 2026-08-06 at capture stage.
  **DOC-CLAIM** (README trail).
- `explorations/lynx-lkg-ontology-grounding` — stage `align`. Verdict recorded:
  "Lynx is a pattern donor, not a vocabulary donor; zero patent/IP modelling
  anywhere in its corpus." Two leads: reshape AnnotationUnit onto
  `EvidenceSpan`/`TextAnchorFields`, and admit `lkg.ttl` (CC-BY-4.0, 12.7KB) as
  the *first real VETTED vendor slice*. **DOC-CLAIM** (README trail).

**Ontology strategy, as it actually stands:** repo-owned SKOS under
`https://ns.beep.sh/`, alignment-when-vetted, no graph store in the foundation
layer, an editing workbench that does have a store. External vocabulary
adoption is 0 slices after two research waves. The gate is real (vetting), but
the throughput through that gate is currently zero.

---

## 4. PracticeKg — what it can answer TODAY

### 4.1 Vocabulary (closed, small, deliberate)

`KgNodeKind` — **7** kinds
(`packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:38`):
`client`, `docket_family`, `docket`, `application`, `patent`, `document`,
`email_archive`.

`KgEdgePredicate` — **9** predicates
(`packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts:37`):
`has_docket_family`, `has_docket`, `files_as`, `granted_as`, `has_document`,
`family_document`, `archived_in`, `continuation_of`, `enriched_family`.

The JSDoc states the design intent exactly: "The set is closed: an edge whose
predicate is absent here cannot be projected, which is what keeps the graph
spine reconcilable against the corpus catalog"
(`KgEdgePredicate.model.ts:15–18`).

Also closed: `PracticeKgProvenanceKind`, `PracticeKgEpistemicStatus`
(`packages/law-practice/domain/src/values/`).

### 4.2 Projection + storage

`packages/law-practice/server/src/PracticeKg.projections.ts` (782 lines) builds
a deterministic bundle: PGlite (`kg.pglite`) for nodes/edges/build tables, DuckDB
for documents/emails/enrichment/text/BM25. Bundle version constant
`"2026-07-27-01"` (`PracticeKg.projections.ts:42`). Build entrypoint is
`apps/practice-kg-mcp/src/build.ts` (a Bun CLI with `--corpus-root`,
`--bundle-out`, `--include-refresh`, `--skip-emails`, `--max-text-bytes`,
`--overwrite`).

> **Drift finding.** `goals/practice-kg-mcp/SPEC.md:73` states AC-1 as
> "`beep corpus graph` is deterministic". **There is no `graph` subcommand.**
> `corpusCommand.withSubcommands([...])` at
> `packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts:325–334`
> lists exactly six: `archive-move`, `catalog`, `enrich`, `extract`,
> `organize`, `salvage`. The KG build lives in `apps/practice-kg-mcp/src/build.ts`.
> The spec's acceptance criterion names a command that does not exist.

### 4.3 FTS — hand-rolled deterministic BM25

`packages/law-practice/server/src/PracticeKg.fts.ts` (341 lines) builds
`fts_tokens` → `fts_docstats` → `fts_postings` → `fts_terms` → a `fts_bm25`
view implementing standard BM25 with k1 = 1.2 and b = 0.75
(`PracticeKg.fts.ts:160–174`).

Tokenizer: `regexp_extract_all(lower(content), '[a-z0-9]+(?:[-/][a-z0-9]+)*')`
(`PracticeKg.fts.ts:139`) — lowercase alphanumerics with hyphen/slash joins
(good for `12/345,678`-shaped patent identifiers).

**No stemming. No stopword list. No phrase queries. No synonyms. No dense
vectors. No reranking.** The whole point is bit-identical rebuilds, and it
achieves that; recall is the price.

### 4.4 The 9 MCP tools

`packages/law-practice/use-cases/src/PracticeKg.tools.ts` (807 lines), all
declared through a `readTool` helper carrying
`FourHintAnnotations.make({ destructive:false, idempotent:true, openWorld:false,
readOnly:true })` (`PracticeKg.tools.ts:615–620`) — note the explicit override
of mcp-kit's read-only preset because "the practice KG host is a strictly
offline bundle reader".

| Tool | Answers |
| --- | --- |
| `kg_clients` | Client attribution list — *self-describing as sparse*: "Attribution is sparse; docket families are the primary practice spine." |
| `kg_docket_family` | One family → its dockets, application chain, documents |
| `kg_application_lookup` | Application/patent/docket → docket, grant, continuation, enriched-family walk |
| `kg_find` | Node lookup by label or number fragment |
| `corpus_search_text` | BM25 over extracted text with digest-cited snippets |
| `corpus_get_document` | Bounded text range by digest or organized path, degrading to a pointer |
| `email_search` | Header-only email search — "Matter linkage is an archive-level heuristic, not message-level proof." |
| `kg_candidate_claims` | Unreviewed claims with resolvable evidence spans, or a typed not-loaded result |
| `kg_provenance` | Node/document provenance, or bundle build status with no identity |

Two things worth noting for the Harvey comparison. First, **the epistemic
disclaimers are in the tool descriptions themselves**, where the model reads
them — sparse attribution, heuristic email linkage, unreviewed claims. Second,
every result is a schema-decoded, byte-budgeted columnar row set
(`BudgetParams`, default 8000 bytes), with progressive field tiers
(`minimal`/`balanced`/`complete` via `defineFieldTiers`,
`PracticeKg.tools.ts:603`).

### 4.5 What it cannot answer — from the packet's own gauntlet

`goals/practice-kg-mcp/history/p5/2026-07-30-defect-register.md` is the most
valuable honest artifact in this repo. Verified findings (client names
anonymized in the register itself):

- **A-1 (Blocker, CONFIRMED-data/-source/-code): cross-client contamination.**
  `documents.client` is populated on **81 of 7,330 rows**, and *never* on a row
  that also carries `docket_family`. Family nodes key on the bare family string
  (`PracticeKg.projections.ts:325` — the `client` field is in scope and
  excluded). Two clients sharing a docket number collapse into one family.
  This is a confidentiality hazard, not just a quality bug.
- **A-12 (Blocker, CONFIRMED-data/-code): cartesian family fan-out.**
  `enrichment.docket_families` records which families' documents *mention* a
  candidate number (prior-art citations included), but
  `PracticeKg.projections.ts:380–395` treats it as *membership*. **75 of 150**
  enrichment rows fan to >1 family (max 16). One application anchors 7 families.
- **A-13 (Blocker, CONFIRMED-data): no USPTO prosecution status anywhere.** No
  status, examiner, issue/abandonment, or due dates. "Docket-status questions
  [are] unanswerable by construction."
- **AC-2 not met.** `SPEC.md:40` (decision D-10) revises the criterion and
  records the outcome bluntly: document/container rows resolve through
  `kg_provenance`, but "**Graph nodes (family / application / patent) do not
  resolve in the shipped build**"; AC-2 "remains unmet until node provenance
  exists or is declared out of scope with a typed capability boundary."
- **AC-4/AC-5 environment corrections.** Claude Desktop ships no Linux build,
  so the gauntlet ran on a Windows target; AC-5's "zero egress" was satisfied
  only by *interval sampling*, which the packet explicitly records as weaker
  than enforced network isolation.

`goals/practice-kg-mcp/ops/manifest.json`: P0–P4 `complete`, **P5
`in-progress`**, P6 (graph-integrity repair), P7 (server hardening), P8
(handoff+close) `pending`. Lifecycle `active`, last updated 2026-07-30 — **nine
days stale as of this report.**

**Bottom line for §4:** PracticeKg reliably answers "find me this document /
search this text / show me this application chain" with citations. It does
**not** reliably answer "whose matter is this" or "what is the status of this
docket". The packet knows this and wrote it down. That epistemic hygiene is
itself a differentiator — but it does not make the graph trustworthy today.

---

## 5. Ingestion

### 5.1 The six corpus lanes

`bun run beep corpus <lane>` — `packages/tooling/tool/cli/src/commands/Corpus/`
(5,860 lines total, `ServicePrograms.ts` alone is 2,846):

| Lane | What it does |
| --- | --- |
| `salvage` | Copy labeled sources into `raw/` with provenance, or verify an existing `raw/provenance.jsonl` |
| `catalog` | Build the corpus DuckDB catalog, exact-duplicate report, and recycle-bin name-restoration manifest |
| `extract` | Run engines over catalog entries (flags: `--tika-jar`, `--java`, `--pffexport`, `--export-children`, `--concurrency`, `--max-files`, `--include-duplicates`) |
| `organize` | Build the `organized/` client, docket, and email-archive taxonomy from the catalog |
| `enrich` | Resolve corpus-derived patent/application numbers against the USPTO open data portal (with `--max-lookups`, `--lookup-delay-millis` rate limiting) |
| `archive-move` | Move fully provenance-covered source dirs/files into an archive root |

Provenance is threaded through as content-addressed identity:
`ContentDigest`, `Sha256Hex`, `OperationId` derived as
`operation:<sha256>` (`ServicePrograms.ts:769–777`).

### 5.2 Format routing — what routes, what doesn't

`FileFormatFamily` is a 14-member closed domain
(`packages/foundation/capability/file-processing/src/Strategy/index.ts:99`)
with a `fromExtension` `Match` at lines 119–133.

| Format family | Extensions | Engine | Status |
| --- | --- | --- | --- |
| `doc`, `docx`, `docm` | .doc/.docx/.docm | tika-app | routes |
| `rtf` | .rtf | tika-app | routes |
| `html`, `xhtml` | .htm/.html/.xhtml | tika-app | routes |
| `pdf-text-layer` | .pdf | tika-app / doc-text | routes **text layer only** |
| `plain-text`, `markdown` | .txt/.text/.md/.markdown | tika-app | routes |
| `image-metadata` | bmp/gif/jpeg/jpg/png/tif/tiff/webp | tika-app | **metadata only** — text is explicitly excluded (`Tika.tikaapp.ts:162`) |
| `xls`, `xlsx` | .xls/.xlsx | tika-app | in `supportedFormats` (`Tika.service.ts:54–55`) but marked `outOfScopeFormats` for the scaffold engine (`Tika.service.ts:61`) |
| `pst` | .pst | libpff / `pffexport` | routes (container-level) |
| `unknown` | everything else | — | catch-all |

Engines: `FileProcessingEngineFamily = LiteralKit(["auto","tika","libpff","test"])`
(`Strategy/index.ts:64`). Registered live in
`ServicePrograms.ts:1028–1040`: `makePffexportFileProcessingEngine` +
`makeTikaAppFileProcessingEngine`.

**What does NOT route (verified absences):**

- **OCR — categorically disabled.** `packages/drivers/doc-text/src/DocText.service.ts:72`
  returns `details: { outcome: "empty-text-layer", ocr: "disabled" }` with
  message "The PDF has no extractable text layer and OCR is disabled." Repo-wide
  grep finds no OCR/Tesseract dependency. **For a patent practice this is a
  first-order gap** — scanned OA PDFs, faxed correspondence, and older file
  wrappers produce a typed failure, not text.
- **No PowerPoint, no ODF, no ZIP/archive family** in `FileFormatFamily`.
- **No per-message email identity.** PST containers route through libpff; but
  defect A-10 records "No per-message email provenance — floor is the PST
  container", which "blocks privilege-log / fee-dispute proof of a specific
  message". The `email_search` tool's own description says linkage is
  "archive-level heuristic, not message-level proof".
- **`tika-app` cannot export archive children** — it fails with
  `unsupported-file-format` (`Tika.tikaapp.ts:169–177`); child export is libpff's
  job only.
- **Redlines / tracked changes.** No `w:ins`/`w:del` handling appears in the
  file-processing or tika paths. This corroborates the packet's own G2
  "redline-blindness" defect and its U4 gate on `@beep/pandoc-ast`
  (`explorations/harvey-lab-firm-knowledge/README.md`). Tika flattens; the
  document-class vocabulary *has* a `redline` concept
  (`ontology/src/seed/legal-intake.ttl`) with nothing populating it.

Skip/deferral is itself modeled:
`FileProcessingSkipReason = LiteralKit(["engine-unavailable","encrypted-source",
"fixture-unavailable","format-out-of-scope", ...])` (`Strategy/index.ts:244`),
and strategy resolution is a three-way tagged split
(`SupportedSelectedStrategy` / `DeferredSelectedStrategy` /
`UnsupportedSelectedStrategy`). **An unsupported file produces a typed, auditable
disposition rather than silently vanishing from the index** — a real advantage
over a "throw it at the parser and see" pipeline.

### 5.3 Extraction & span grounding

`@beep/langextract` (7 src files, 2,171 lines, 4 test files),
`goals/langextract-capability` lifecycle `completed-retained`, all P0–P6
complete.

- `AlignmentStatus = LiteralKit(["match_exact","match_lesser","match_fuzzy","unaligned"])`
  (`Extraction/index.ts:143`) — alignment quality is a first-class value.
- `VerifiedSpan` (`src/VerifiedSpan/index.ts`) is the sharp bit:
  `VERIFIED_SPAN_NORMALIZATION_VERSION = "1"`, an explicit
  `TextOffsetUnit = LiteralKit(["unicode-code-point","utf16-code-unit"])` so
  UTF-16 vs code-point confusion is *decoded*, not assumed
  (`VerifiedSpan/index.ts:68`), Unicode combining-mark and whitespace filters as
  schema checks, and effects `locateRawText`, `convertTextOffsetRange`,
  `reconstructSourceText`, `locateGroundedExtractions`. Bounds:
  `MAX_SOURCE_TEXT_LENGTH = 1_000_000`, `MAX_LOCATOR_LENGTH = 4_096`.
  It builds on `TextAnchor` / `isUtf16Boundary` from `@beep/provenance`.
- **Local-first by policy.** `Config.boolean("BEEP_LANGEXTRACT_ALLOW_REMOTE")`
  defaults to **`false`** (`Service/index.ts:183`); remote model extraction is
  opt-in per environment. For OIP confidentiality this is exactly the right
  default and it is enforced in a layer, not a README.
- **Known lossiness (corroborated):** `Handoff/index.ts:112` shows
  `toAnnotatedDocument` emitting `span: Contract.Span.make({ start: 0, end:
  input.text.length })` — the whole-document span. The NLP handoff IR does drop
  char-level spans at that boundary.

**Live end-to-end chain (verified wiring):**
`PracticeKg.claims.ts` → `OfficeActionReview`
(`packages/law-practice/server/src/Layer.ts:37–47`, composing
`FileProcessingService` + `IrToLaw` + `LangExtractService` + `ClaimGate` +
`ClaimTransition`) → persisted `epistemic_candidate_claim` rows
(`PracticeKg.claims.ts:53–105`). **This is a real, wired vertical from bytes to
gated claims.** It is the single most Harvey-comparable artifact in the repo.

---

## 6. The epistemic package — what it actually models

`packages/epistemic/{domain,tables,server,use-cases,client,ui,config}` —
domain 54 files / 7,897 lines (6 tests), server 21 / 3,921 (12 tests),
use-cases 28 / 4,464 (6 tests), tables 28 / 2,533 (4 tests).
`goals/epistemic-bitemporal-edge-core` is `completed-retained`, P0–P3 complete.

### 6.1 Entities (8) and value domains

`packages/epistemic/domain/src/entities/`: `Activity`, `CandidateClaim`,
`ClaimDisposition`, `Contradiction`, `EdgeVersion`, `Evidence`,
`EvidenceVerification`, `UsageRecord`.

Closed vocabularies (`domain/src/values/`):

| Domain | Members | Location |
| --- | --- | --- |
| `ClaimLifecycle` | `candidate` → `shape_valid` → `consistency_checked` → `admitted` | `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:18` (shared-kernel, re-exported by epistemic) |
| `EdgeRelation` | `supports`, `refutes`, `contradicts` | `EdgeRelation.model.ts:13` |
| `EdgeEndpointKind` | `claim`, `evidence`, `entity`, `observation` | `EdgeEndpoint.model.ts:94` |
| `ClaimDispositionStatus` | `active`, `rejected`, `superseded` | `ClaimDispositionStatus.model.ts:12` |
| `ClaimGateSeverity` / `ClaimGateVerdict` | `info`/`warning`/`violation`; `admitted`/`rejected` | `ClaimGateResult.model.ts:12,90` |
| `ContradictionMatchBasisKind` | `same-source-overlap`, `independent-evidence` | `Contradiction.model.ts:435` |
| `SinkClass` / `SinkAudience` | `network-egress`,`mcp-write`; `local-workspace`,`external-network` | `ExecutionGrant.model.ts:43,86` |
| `EgressClassification`, `DenialReason`, `ExecutionSettlement`, `ChainVerificationTag`, `GrantSetState` | — | `ExecutionVerdict.model.ts`, `ExecutionRecord.model.ts`, `GrantSet.model.ts` |

### 6.2 What the mechanisms actually do

- **Bitemporality is real.** `EdgeVersion` carries two half-open intervals —
  `[validFrom, validTo)` and `[recordedAt, expiredAt)` — as BIGINT epoch millis
  with `S.OptionFromNullOr` open ends
  (`entities/EdgeVersion/EdgeVersion.model.ts:6,157–160,223–226`), described as
  "One immutable bitemporal version of one logical epistemic edge". Logical
  identity is separate (`LogicalEdgeIdentity`, `logicalEdgeKey`). This is
  textbook-correct belief revision plumbing and it is rarer than it should be.
- **ClaimGate is total and minimal.** `makeClaimGate`
  (`use-cases/src/ClaimGate/ClaimGate.service.ts:131`) projects the bounded SHACL
  engine into a `ClaimGateResult`; **rejection is a value, never an error**, and
  engine failure is treated as a defect. But the shipped shape set is exactly
  **one** constraint: `targetClass: CLAIM_CLASS_IRI` with property
  `EVIDENCE_QUOTE_IRI`, `minCount: 1`, `datatype: xsd:string`
  (`ClaimGate.service.ts:56–68`). Translation: *a claim must quote at least one
  piece of evidence.* Everything richer is the unstarted M4.
- **Egress governance exists and is wired.**
  `packages/epistemic/server/src/GovernedEgress/` (`makeGovernedEgressFetch`,
  `GovernedEgressLive`) plus `ExecutionLedger`, `GovernedTierGate`,
  `EdgeAuthority`, `ContradictionTriage`, `ClaimDisposition`. Integration tests
  run against real Postgres (`server/test/integration/EdgeAuthority.pg.test.ts`,
  `ContradictionTriage.pg.test.ts`).
- **It has a UI.** `apps/professional-desktop` depends on all seven epistemic
  packages and ships `src/contradiction/ContradictionQaSeed.ts` plus a
  `ContradictionReviewer` in the runtime layer — contradiction triage is a
  human-facing surface, not a library.

**Honest read:** the epistemic package is the most *complete* thing profiled
here — it models claims, evidence, verification, bitemporal edges,
contradictions, dispositions, execution grants, and egress classification, with
Postgres integration tests and a desktop reviewer. What it does *not* have is
volume: the gate enforces one shape, and the only production producer of
candidate claims is the office-action extraction path.

---

## 7. Knowledge vault / Cognee

Not a product surface — an **agent-memory research pipeline**:

- `bun run beep research <sub>`
  (`packages/tooling/tool/cli/src/commands/Research/`, 3,046 lines of internals):
  `capture` (Firecrawl URL → markdown knowledge card), `history-sift`
  (Brave/Chrome history → inbox stubs), `repo-card`, `notion-pull`, `cognify`,
  `digest`, `daily`, `install-timers`, `status`.
- Vault root is **out of repo**: `BEEP_KNOWLEDGE_VAULT` or `~/YeeBois/knowledge`
  (`Research.command.ts:42`).
- Cognee is an **external HTTP service**, not vendored:
  `CogneeClient.ts:92` requires `COGNEE_API_URL` ("point it at the running
  Cognee API"), with `COGNEE_API_EMAIL` / `COGNEE_API_PASSWORD` defaults.
  `beep research cognify` pushes pending cards into Cognee datasets and starts
  cognify (`--dry-run` supported).
- Doctrine and assessment live in `standards/memory-architecture/` (9 files,
  including `05-context-graph-capability-assessment.md` and
  `00-no-escape-theorem.md`) and `docs/agent-memory-infra/`.

**Do not count Cognee as beep's KG.** It is third-party Python infrastructure
serving agent memory. It shares zero code, zero schemas, and zero provenance
model with PracticeKg or `@beep/ontology`.

`docs/BEEPGRAPH_ARCHITECTURE.md` (326 lines, dated 2026-06-15, **status:
"Proposed"**) proposes the synthesis — an effect-ontology-style typed authority
spine wrapped in a TrustGraph-style projection/retrieval shell, with FalkorDB +
GraphRAG. **DOC-CLAIM, and explicitly unimplemented:** no FalkorDB dependency,
no GraphRAG retrieval, no knowledge-core packaging exists in `packages/`.

---

## 8. As-built vs as-planned ledger

| Capability | As-built (running code) | As-planned (packet/doc only) |
| --- | --- | --- |
| Schema→ontology fold | `fold()` + JSON-LD/context/Turtle/Markdown projections, tested | **No production caller**; no "publish beep ontology" lane |
| SKOS taxonomy | 9 concepts, hardened fail-closed loader | FOLIO alignments (all `[]`); IPC/CPC/Nice (M2); docketing+party roles (M3); intake SHACL shapes (M4) |
| Vendor ontology slices | Loader + `VETTED`/`UNVETTED` gate; package-local fixtures | **0 slices live-wired**; manifest-shape mismatch blocks the real asset pack; `lkg.ttl` is a candidate, not adopted |
| SPARQL | Real, via `@beep/oxigraph` in the ontology workbench | `@beep/semantic-web` ships `UnsupportedSparqlQueryServiceLive` |
| Reasoning | RDFS subset (subClass/subProperty closure, domain/range) | No OWL-DL, no tableau, no SWRL |
| SHACL | Bounded subset (7 constraint kinds) + `@beep/shacl` engine + ClaimGate | Full shape authoring for intake/ClaimGate (M4) |
| Practice KG | 7 node kinds, 9 edge predicates, PGlite+DuckDB bundle, 9 MCP tools, deterministic BM25 | AC-2 unmet (node provenance); P6/P7/P8 pending; prosecution status absent by construction |
| Ingestion | 6 corpus lanes, tika-app + libpff, typed skip/deferral dispositions | OCR; PPT/ODF/archives; per-message email identity; tracked-changes preservation |
| Extraction | LangExtract + VerifiedSpan + alignment status, remote-off by default | Span fidelity lost at the AnnotatedDocument handoff |
| Epistemic | Bitemporal edges, contradictions, dispositions, egress governance, PG integration tests, desktop reviewer | ClaimGate enforces exactly one shape |
| Retrieval fusion | — | `goals/hybrid-retrieval-fusion-core`: **all four phases `pending`**; weighted RRF (`1/(k+rank)`, k=60), literal tiers, channel renormalization — designed, not built |
| BeepGraph (FalkorDB + GraphRAG shell) | — | `docs/BEEPGRAPH_ARCHITECTURE.md`, status "Proposed" |
| Dense retrieval | — | Explicitly a non-goal of `hybrid-retrieval-fusion-core`; deferred to unqueued `retrieval-vector-projection` / `retrieval-local-encoder` |

---

## 9. Honest gap list

**G1 — There is no semantic retrieval.** Repo-wide there is no pgvector, no
HNSW, no embedding model, no reranker. `@beep/wink` is BM25/bag-of-words
(`wink-nlp` + `wink-eng-lite-web-model`), not neural. Everything the graph can
retrieve, it retrieves by exact-ish lexical match. `goals/hybrid-retrieval-fusion-core`
has all four phases `pending` and explicitly excludes storage/encoder work.

**G2 — The flagship KG has two confirmed blocker-class data defects** (§4.5,
A-1 and A-12), one of which is a **client-confidentiality hazard**. The fix is
scoped ("One fix each, plus a rebuild, clears the two blockers") but has not
run; P6 is `pending` and the manifest has not moved since 2026-07-30.

**G3 — OCR-shaped blindness.** A patent practice's corpus contains scanned OA
PDFs and faxed correspondence. `ocr: "disabled"` is a design decision that
silently caps corpus coverage; nothing in-repo measures what fraction is lost.

**G4 — Redline blindness.** Tracked changes never survive ingestion. The
`redline` document class exists in the taxonomy with nothing populating it.
This is the packet's own G2 defect and it is real.

**G5 — Ontology adoption throughput is zero.** After two research waves
(`legal-ontology-landscape`, `legal-patent-kg-deepening`) and a Lynx deep-dive,
exactly **0** external vocabulary slices are loaded and **0** FOLIO alignments
are recorded. The vetting gate works; nothing has passed through it.

**G6 — The fold has no consumer.** The most architecturally distinctive
capability in the repo (schemas → ontology) does not run in any product path.

**G7 — Spec/impl drift is present and unlinted.** `beep corpus graph` in
`SPEC.md:73` does not exist. Nothing checks that acceptance criteria name real
commands.

**G8 — No evaluation harness.** There is no graded task set, no retrieval
metric, no regression suite for "did this change make answers better". Quality
gates in this repo measure *code* (fallow, coverage ratchets, jsdoc baselines,
17 required PR checks), not *answers*. This is precisely the hole the Harvey LAB
corpus would fill, and it is the strongest argument in the packet.

**G9 — Two disconnected graph stacks.** PracticeKg (PGlite/DuckDB, closed
7-kind vocabulary, no RDF) and the ontology workbench (Oxigraph, RDF/SPARQL,
named-graph partitions) share provenance *doctrine* but no runtime and no
vocabulary. Nothing projects PracticeKg into RDF; nothing validates PracticeKg
against the SKOS seed.

**G10 — Volume.** 7,330 documents, ~150 enrichment rows, 81 client-labeled
rows, 9 seed concepts, 7 node kinds, 9 edge predicates. Every architectural
claim here is proven at small scale only.

---

## 10. Single-developer sustainability

`git log --since=2026-02-08 --format=%an | sort | uniq -c`:
**3,596 of 3,609 commits by one author** (`elpresidank`); 12 by
`github-actions[bot]`, 1 by `Claude`. (Whole-history `shortlog` shows other
names — those are vendored upstream surfaces, not contributors.)

What one person is carrying: 138 workspace packages, 2,722 source files, 651
test files, a hand-built RDF/JSON-LD/PROV/SHACL stack with zero external RDF
deps, a bespoke ontology workbench with its own reasoner, a 5,860-line corpus
CLI, a 9-tool MCP server, a bitemporal epistemic core with Postgres integration
tests, and a repo-quality operator (`yeet`) gating 17 required hosted checks.

**Risks, stated without softening:**

1. **Surface-to-attention ratio.** `goals/` holds ~90 packets. Several
   KG-critical ones are `active` but stalled (`practice-kg-mcp` at P5 since
   2026-07-30; `semantic-foundation` M1-complete but never closed through P3/P4;
   `hybrid-retrieval-fusion-core` at P0-pending).
2. **Doctrine cost is front-loaded and recurring.** Schema-first + `LiteralKit`
   + identity composers + JSDoc-with-examples + docgen + coverage ratchets means
   every new vocabulary term costs more than it would elsewhere. That is exactly
   why the substrate is good — and exactly why external-vocabulary adoption
   throughput is 0.
3. **The mitigations are real and unusual.** Agent fan-out (this packet used 12
   Opus agents, ~2.5M tokens), durable on-disk handoffs, friction ledgers as a
   first-class output, and an exploration→goal graduation pipeline. One person
   with this much automation is not the same as one person.
4. **The honest-defect culture is load-bearing.** The P5 defect register with
   `CONFIRMED-data`/`CONFIRMED-code`/`OBSERVED`/`OPEN` status legends is better
   epistemic practice than most funded teams produce. It is also the reason this
   profile could be written at all.

**Sustainability verdict:** the architecture is sustainable *per unit of
surface*; the surface is not sustainable at its current growth rate. The binding
constraint is not capability — it is closing packets.

---

## 11. Ahead of / behind a "RAG + agentic search" baseline

### Ahead

1. **Admissibility, not just retrieval.** A baseline RAG returns chunks. beep
   returns rows that passed `ClaimGate` and carry a `ClaimLifecycle` state
   (`candidate` → `shape_valid` → `consistency_checked` → `admitted`) and a
   resolvable `EvidenceSpan`. Rejection is a *value*, so refusal is
   composable rather than exceptional.
2. **Closed vocabularies as a hallucination floor.** An edge whose predicate is
   not one of 9 cannot be projected. A tool cannot return a node kind that is
   not one of 7. This is a structural bound a prompt cannot violate.
3. **Determinism.** Bit-identical bundle rebuilds, hand-rolled BM25, no model in
   the retrieval path. Reproducibility is a property, not an aspiration — which
   matters enormously for anything a court or a client might question.
4. **Provenance-first with typed failure.** Digest-cited snippets, `kg_provenance`
   as a tool, content-addressed `operation:<sha256>` ids, and typed skip
   dispositions instead of silent drops.
5. **Confidentiality posture.** `BEEP_LANGEXTRACT_ALLOW_REMOTE=false` by default,
   `openWorld: false` MCP hints, `GovernedEgress` with `SinkClass`/`SinkAudience`
   classification, and a strictly-offline bundle reader. For pre-publication
   patent work this is not a feature — it is the entry ticket.
6. **Bitemporal belief revision.** `[validFrom,validTo)` × `[recordedAt,expiredAt)`
   over immutable edge versions. Most RAG systems cannot answer "what did we
   believe on date X" at all.
7. **The ontology cannot drift from the code** (§2.2), and there is a real
   ontology editing surface with SPARQL, bounded reasoning, undo, and an MCP
   agent toolkit.
8. **Epistemic disclaimers live in tool descriptions**, where the model reads
   them.

### Behind

1. **Recall.** Lexical BM25 only, no stemming, no stopwords, no phrase queries,
   no synonyms, no dense channel, no reranking. A 2023-vintage RAG baseline with
   `text-embedding-3-small` + a cross-encoder would beat this on any
   paraphrase-heavy query.
2. **Corpus coverage.** No OCR, no tracked changes, no per-message email, no
   PPT/ODF/archives. A baseline pipeline with a commodity document loader
   ingests strictly more.
3. **Graph richness.** 7 node kinds and 9 edge predicates describe filing
   structure, not legal substance. No claims-to-prior-art edges, no
   examiner/rejection graph, no citation network, no prosecution events. A
   GraphRAG baseline that LLM-extracts open-vocabulary triples would produce a
   denser (if noisier) graph tomorrow.
4. **No evaluation.** No graded task set, no retrieval metrics, no answer-quality
   regression suite. This is the largest strategic gap and the one the Harvey LAB
   corpus directly addresses.
5. **No agentic search loop.** No query planner, no iterative
   retrieve→reason→retrieve, no self-consistency. The MCP tools are excellent
   primitives, but the orchestration is whatever the client model improvises.
6. **Data quality behind the architecture.** The system's *design* prevents
   unprovenanced claims; its *shipped data* has cross-client contamination and
   cartesian family fan-out. Architecture is currently ahead of data by a wide
   margin.
7. **Two disconnected graph stacks** (G9) — the RDF/SPARQL machinery and the
   practice graph do not meet.

---

## 12. What this means for the Harvey question

1. **Do not argue "better KG."** On graph density, retrieval quality, corpus
   coverage, and evaluation, beep is behind a competent RAG baseline, let alone
   a funded team. Claiming otherwise is falsifiable in one query.
2. **Argue "different admissibility contract."** beep's answerable question is
   not "what's relevant" but "what can be *asserted*, with what evidence, under
   what temporal validity, having passed which gate". That is a solo-practitioner
   / regulated-professional shape, not a scale shape.
3. **The unclaimed wedge is coverage, and it is coverage beep also lacks.**
   Tracked-changes-aware ingest is unclaimed by Harvey/Engram per this packet's
   verify pass — but §5.2 confirms beep cannot do it either today. It is a wedge
   to *build*, not a wedge to *claim*. It gates on `@beep/pandoc-ast` (U4).
4. **The single highest-value import from LAB is the graded task set**, because
   G8 (no evaluation) is beep's largest gap and the one thing architecture
   cannot fix. That aligns with the packet's already-seeded "standing test asset"
   decision in `DECISIONS.md`.
5. **Before any new capability, close P6.** A knowledge graph with confirmed
   cross-client contamination is worse than no knowledge graph for an IP
   practice. Every strategy claim in this packet is downstream of that fix.

---

## Sources

**Method note:** this lane performed **no web research** and makes **no
external claims**. No URLs were fetched, quoted, or cited. All sources are
repo-internal paths verified this session at commit `6b42b239a6`. Statements
resting on repo documents rather than executable code are labelled **DOC-CLAIM**
inline.

### Live source (verified by read/grep)

- `packages/foundation/modeling/ontology/src/` — `Fold.assembly.ts` (927 L),
  `Fold.projections.ts` (648 L), `Fold.models.ts` (751 L), `Fold.markdown.ts`
  (289 L), `Ontology.models.ts` (872 L), `SemanticFoundation.models.ts` (296 L),
  `SemanticFoundation.seed.ts` (140 L), `TaxonomyLoader.ts` (294 L),
  `TaxonomyRegistry.ts` (153 L), `seed/legal-intake.ttl`, `seed/legal-intake.jsonld`
- `packages/foundation/capability/semantic-web/src/services/sparql-query.ts`,
  `services/shacl-validation.ts`, `adapters/`, `vocab/`
- `packages/foundation/modeling/rdf/`, `packages/foundation/modeling/identity/src/packages.ts`
- `packages/ontology/{domain,use-cases,server,client}/src/aggregates/Session/` —
  `Session.model.ts`, `Session.values.ts`, `Session.reasoner.ts` (925 L),
  `Session.sparql.ts` (665 L), `Session.validation.ts` (904 L),
  `Session.visualizer.ts` (1,695 L), `Session.layer.ts`
- `packages/ontology/use-cases/src/tools/OntologyToolkit.ts`, `OntologyToolService.ts`
- `packages/drivers/oxigraph/`, `packages/drivers/shacl/`, `packages/drivers/n3/`
- `packages/law-practice/domain/src/values/KgNodeKind/`, `KgEdgePredicate/`,
  `PracticeKgProvenanceKind/`, `PracticeKgEpistemicStatus/`
- `packages/law-practice/server/src/` — `PracticeKg.projections.ts` (782 L),
  `PracticeKg.fts.ts` (341 L), `PracticeKg.claims.ts` (403 L),
  `PracticeKg.schemas.ts` (596 L), `PracticeKg.queries.ts`, `PracticeKg.emails.ts`,
  `PracticeKg.rows.ts`, `PracticeKg.tool-handlers.ts`, `Layer.ts`
- `packages/law-practice/use-cases/src/PracticeKg.tools.ts` (807 L),
  `OfficeActionReview/`, `IrToLaw/`
- `apps/practice-kg-mcp/src/` — `build.ts`, `package.ts`, `runtime/`, `smoke.ts`
- `packages/foundation/capability/file-processing/src/` — `Strategy/index.ts`
  (528 L), `Service/index.ts` (540 L), `Extraction/index.ts` (1,230 L),
  `SourceText/`, `PathSafety/`, `Operation/`, `Artifact/`
- `packages/drivers/tika/src/` — `Tika.service.ts`, `Tika.tikaapp.ts`
- `packages/drivers/libpff/src/` — `Libpff.service.ts`, `Libpff.pffexport.ts`
- `packages/drivers/doc-text/src/DocText.service.ts`
- `packages/drivers/wink/src/` — `WinkVectorizer.service.ts`, `internal/bm25.ts`
- `packages/foundation/capability/langextract/src/` — `VerifiedSpan/index.ts`,
  `Extraction/index.ts`, `Handoff/index.ts`, `Service/index.ts`, `Alignment/`, `Target/`
- `packages/epistemic/domain/src/{entities,values}/`,
  `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts`,
  `packages/epistemic/server/src/{GovernedEgress,EdgeAuthority,ContradictionTriage,ExecutionLedger,GovernedTierGate,ClaimDisposition}/`
- `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts`
- `packages/tooling/tool/cli/src/commands/Corpus/` (5,860 L incl.
  `internal/ServicePrograms.ts` 2,846 L),
  `commands/Research/` (3,046 L internals incl. `CogneeClient.ts`),
  `commands/Knowledge/`
- `apps/professional-desktop/` — `package.json`, `src/ontology/OntologyOrchestrator.ts`,
  `src/contradiction/ContradictionQaSeed.ts`, `src/runtime/Layer.ts`,
  `server/OntologyMcpTransport.ts`

### Packet / goal documents (DOC-CLAIM sources)

- `goals/semantic-foundation/{README.md,SPEC.md,ops/manifest.json}`
- `goals/practice-kg-mcp/{README.md,SPEC.md,ops/manifest.json}` and
  `history/p5/{2026-07-30-defect-register.md,2026-07-30-ac4-ac5-gauntlet.md,2026-07-30-code-session-final-report.md}`
- `goals/hybrid-retrieval-fusion-core/{SPEC.md,ops/manifest.json}`
- `goals/{langextract-capability,file-processing-capability,epistemic-bitemporal-edge-core,ontology-workbench,ontology-agent-surface,identity-iri-core,oppold-corpus-pipeline,citation-verified-span-substrate,projection-dispatch-core,legal-document-intake,knowledge-surface-automation}/ops/manifest.json`
- `explorations/legal-patent-kg-deepening/README.md`
- `explorations/lynx-lkg-ontology-grounding/README.md`
- `explorations/harvey-lab-firm-knowledge/{README.md,CAPTURE.md,DECISIONS.md,RESEARCH.md}`
- `docs/BEEPGRAPH_ARCHITECTURE.md` (status: Proposed), `docs/graphs/`,
  `docs/agent-memory-infra/`, `standards/memory-architecture/`
- `AGENTS.md` / `CLAUDE.md` (repo laws)

### Prior packet mining reports (reused, not re-derived)

- `explorations/harvey-lab-firm-knowledge/research/verify-completeness.md`
  (G2 redline-blindness defect; 97%-unmined caveat)
- `.../research/verify-refutations.md` (wedge crowding; cognee/knowledge-vault mentions)
- `.../research/verify-facts.md` (286 fact-checks, 251 confirmed)
- `.../research/mine-benchmark-integration.md`, `mine-synthetic-corpus.md`,
  `mine-eval-methodology.md`, `mine-dms-taxonomy.md`
- `.../research/map-corpus.md`, `map-evaluation.md`, `map-harness.md`,
  `map-pipeline-docs.md`, `map-task-census.md`
- `.../research/{SOURCES.md,OPPORTUNITIES.md}`

### Commands run for quantitative claims

```
git rev-list --count HEAD                                  # 10521
git log --since=2026-02-08 --format=%an | sort | uniq -c    # 3596 elpresidank / 12 bot / 1 Claude
rg -c 'LiteralKit\(' --type ts packages apps                # 998 sites / 419 files
rg -c 'extends S\.Class<' --type ts packages apps           # 3450
find packages apps -name package.json -not -path '*/node_modules/*' | wc -l   # 138
find packages apps -path '*/src/*' \( -name '*.ts' -o -name '*.tsx' \) ... | wc -l  # 2722
find packages apps -path '*/test/*' -name '*.test.ts*' ... | wc -l            # 651
grep -c 'TaxonomyConcept.make' .../SemanticFoundation.seed.ts                # 9
grep -c 'alignments: \[\]' .../SemanticFoundation.seed.ts                    # 9
```
