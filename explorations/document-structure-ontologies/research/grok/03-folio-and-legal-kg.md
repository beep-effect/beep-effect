# FOLIO and Legal Knowledge-Graph Vocabularies

**Sweep:** 03 — FOLIO deep-dive + legal KG comparison + MCP surface
**Date:** 2026-08-11
**Author:** Grok 4.5 research agent (live web + API probes)
**Packet:** `explorations/document-structure-ontologies`
**Audience:** beep-effect architecture — schema-first ASTs, RDF vocab modules, taxonomy loader, professional-desktop agents drafting patent applications and office-action responses

**Method.** Claims are grounded in primary sources: openlegalstandard.org, folio.openlegalstandard.org (REST API health + search + class GET), alea-institute GitHub (FOLIO / folio-mcp / folio-python), SALI / LKIF / Lynx primary pages, and prior in-repo Lynx packet work. Live API probe (2026-08-11): `GET /info/health` reported **18,323 classes**, **175 properties**, graph source `github.com/alea-institute/folio` branch **`2.0.0`**. Scrapes and JSON probe dumps archived under `research/grok/raw/.firecrawl-03/`.

---

## 0. Executive summary

| Finding | Evidence |
| --- | --- |
| **FOLIO is the ALEA-maintained federated legal ontology/taxonomy** for matter, document, entity, venue, and practice-area tags — **not** a document-structure AST ontology (not DoCO/DEO/PO, not claim-chart structure). | [openlegalstandard.org](https://openlegalstandard.org/), [alea-institute/FOLIO](https://github.com/alea-institute/FOLIO) |
| **Scale:** ~18k OWL classes, ~175 object properties, 24 taxonomy branches, multilingual labels on a minority of concepts. | Live [API health](https://folio.openlegalstandard.org/info/health); MCP tools docs |
| **Heritage:** MIT-licensed **SALI LMSS** fork (2024 SOLI → 2025 FOLIO rebrand); ontology data **CC-BY 4.0**, tooling **MIT**. Governance is federated via GitHub + Discourse under ALEA Institute; parallel SALI Alliance continues separately. | [NOTICES.md](https://raw.githubusercontent.com/alea-institute/FOLIO/main/NOTICES.md), [heritage post](https://openlegalstandard.org/whats-happening-with-sali-soli-folio/), [sali.org](https://www.sali.org/) |
| **Agent surface is best-in-class among legal KGs surveyed:** public REST API (OAS 3.1), **folio-mcp** (12 tools, resources, prompt templates), **folio-python**. **No official TypeScript client.** | [folio-mcp](https://github.com/alea-institute/folio-mcp), [PyPI folio-mcp](https://pypi.org/project/folio-mcp/), [API docs](https://folio.openlegalstandard.org/docs) |
| **Patent/IP coverage is present but shallow for drafting:** strong **matter taxonomy** (IP Law → Patent/TM/Copyright/Trade Secret; USPTO; Prior Art; UTBMS PA\* prosecution task codes including PA430 “Office Action” *as a billing task*). **Missing:** independent/dependent claim structure, specification section roles, MPEP/CFR rule nodes, claim charts, office-action *document* AST types. | Live label searches + class GETs (see §6) |
| **Fit for beep-effect:** **adopt as optional interoperability / matter-tag layer + MCP reference design**, not as the document AST or the patent-structure ontology. Build a **beep-taxonomy MCP** over `@beep/ontology` that mirrors FOLIO’s tool shape but serves **vetted vendor slices + patent structure rules**. | §9–§10 |

**Ranked shortlist (ontology / tooling for this packet):**

1. **FOLIO** (ontology + API + MCP) — primary legal *classification* KG to interoperate with.
2. **SALI LMSS** — same conceptual product family (still MIT on GitHub); industry membership surface; weaker public agent tooling.
3. **Lynx LKG** — document-centric compliance KG + NIF offsets (already deep-dived in-repo); not a practice-area taxonomy.
4. **LKIF-core** — formal legal-theory upper ontology (norms, roles, actions); reference for axioms, not 18k matter tags.
5. **DoCO / DEO / PO (SPAR)** — already assessed in this packet for *document structure*; complementary, not competing with FOLIO.

---

## 1. What FOLIO is (scope and non-scope)

### 1.1 Identity

- **Name:** Federated Open Legal Information Ontology (FOLIO).
- **Sites:** [https://openlegalstandard.org/](https://openlegalstandard.org/) (project), [https://folio.openlegalstandard.org/](https://folio.openlegalstandard.org/) (explorer + API).
- **Canonical OWL:** [https://github.com/alea-institute/FOLIO](https://github.com/alea-institute/FOLIO) (`FOLIO.owl`).
- **Maintainers:** ALEA Institute and community contributors (public GitHub; contact `hello@aleainstitute.ai` on API docs).
- **Self-description:** open, modular, federated standard for **interoperable legal data tags** — unique IRIs for concepts so systems can exchange matter, document, entity, and related classifications without ambiguous free text. See [Overview on GitHub](https://github.com/alea-institute/FOLIO#overview) and the [homepage “What is FOLIO?”](https://openlegalstandard.org/).

### 1.2 What FOLIO *is* for

Stated and demonstrated use cases (homepage + MCP docs + Python README):

| Use case | How FOLIO helps | Source |
| --- | --- | --- |
| Matter / case management | Tag matters by area of law, status, objectives, services, parties | [openlegalstandard.org use cases](https://openlegalstandard.org/) |
| Document classification | Map filings/contracts to document-type concepts | MCP workflows on [folio-mcp-tools](https://openlegalstandard.org/resources/folio-mcp-tools/) |
| CLM / contract analytics | Annotate clause types (e.g. Assignment, Indemnification) | Same; homepage lease annotation example |
| Timekeeping / UTBMS-aligned work | Patent/trademark task codes under UTBMS branches | Live class tree under **UTBMS Patent** (API) |
| Generative AI grounding | Constrain LLM classification to expert-vetted IRIs | Homepage GenAI section; LLM search endpoints on API |
| Interoperability | Export JSON-LD / OWL XML / Markdown per concept | MCP `export_concept`; API `/{iri}/jsonld` |

### 1.3 What FOLIO is *not*

| Non-scope | Why it matters for beep-effect |
| --- | --- |
| **Not a recursive document AST** | No equivalent of `@beep/md` Inline/Block unions, Pandoc blocks, or Lexical nodes. Document *types* (motion, lease, license agreement) are taxonomy classes, not structural trees. |
| **Not a rhetorical / discourse ontology** | Unlike SPAR DEO (discourse elements) or PO (document patterns), FOLIO does not model Introduction/Method/Claim Construction as discourse roles. |
| **Not a full legal reasoner** | Object properties exist (~175) and `find_connections` returns triples, but the product is a **classification KG**, not LKIF-style deontic formalization of norms. |
| **Not a patent document model** | No first-class independent claim / dependent claim / specification section / figure reference graph as structural types (see §6). |
| **Not Akoma Ntoso / LegalDocML** | Does not replace legislative/judicial XML markup standards. |

Cross-link: SPAR DoCO/DEO/PO assessments live in this same exploration packet (`research/SOURCES.md` ledger); FOLIO sits in a **different layer** (matter semantics / industry taxonomy) from document-structure ontologies.

---

## 2. Class structure and ontology shape

### 2.1 Top-level organization: 24 “NOUN” branches + “VERB” properties

The interactive explorer groups **classes (NOUNS)** into **24 branches** and **object properties (VERBS)** separately. Explorer snapshot (scrape of [folio.openlegalstandard.org](https://folio.openlegalstandard.org/)):

**Branches (classes):** Actor/Player; Area of Law; Asset Type; Communication Modality; Currency; Data Format; Document/Artifact; Engagement Attributes; Event; Financial Concepts and Metrics; Forums and Venues; Governmental Body; Industry and Market; Language; Legal Authorities; Legal Entity; Legal Use Cases; Location; Matter Narrative; Objectives; Service; Standards Compatibility; Status; System Identifiers.

MCP `list_branches()` documentation uses snake_case keys and reports concept *counts at branch root* (not total ontology size), e.g. `areas_of_law: 31`, `languages: 487`, `currencies: 178` — see [tools reference](https://openlegalstandard.org/resources/folio-mcp-tools/#list_branches). The README branch table also lists `folio_types` among 24 branches: [folio-mcp README — Taxonomy Branches](https://github.com/alea-institute/folio-mcp#taxonomy-branches).

**Properties (verbs):** the explorer lists dozens of relationship labels (e.g. `advised`, `analyzed`, `appealsTo`, `authored`, `cited`, `codified`, `governedBy`-style relations). Live health reports **175** properties. API `GET /search/query_properties` returns property records with `domain`/`range` often sparse (many empty arrays in probe samples) — properties are present but **not uniformly axiomatized** the way LKIF norms are.

### 2.2 Concept record shape

A typical class GET (example: **Patent Law**, IRI `https://folio.openlegalstandard.org/R2e3mdhrPrjPbiYOMYQU0g`, 2026-08-11) includes:

| Field | Patent Law example |
| --- | --- |
| `iri` | Stable `https://folio.openlegalstandard.org/R…` |
| `label` | `Patent Law` |
| `definition` | Short prose definition |
| `sub_class_of` | → Intellectual Property Law |
| `parent_class_of` | (empty for Patent Law — leaf under IP Law in probe) |
| `alternative_labels` / `translations` | Multilingual strings (es, fr, de, he, hi, zh, ja, …) |
| `hidden_label` | `PATE` |
| `identifier` | `INTP-PATE` (SALI-style code heritage) |
| `deprecated`, `see_also`, notes, source, country | Present in schema; often null |

IRI strategy: opaque random-looking local names under a single host namespace (`https://folio.openlegalstandard.org/R…`). This is **stable identity for tagging**, not human-readable local names like `eli:LegalResource`. API accepts short IDs or full IRIs for GET/export ([MCP get_concept](https://openlegalstandard.org/resources/folio-mcp-tools/#get_concept)).

### 2.3 Area of Law sample (live)

`GET /taxonomy/area_of_law` returned top-level practice areas including (non-exhaustive): Constitutional and Civil Rights; Personal Injury and Tort; Information Security; Banking; Municipal; Public and Administrative; Bankruptcy/Insolvency; Food and Drug; Energy; Transportation; Family; Religious; Cannabis; Gaming; Securities; Contract; Labor/Employment; Education; Insurance; Real Property; **Intellectual Property**; Finance/Lending; Corporate; Criminal; Environmental; Agriculture; Tax; Health; Telecommunications/Media/Entertainment; Commercial/Trade.

**Intellectual Property Law** (`RDdMucRftztKt4Ag7WzUxX`, identifier `INTP`) has exactly **four** children in the live graph:

1. Patent Law (`INTP-PATE`)
2. Trade Secret Law
3. Trademark and Trade Dress Law
4. Copyright Law

Source: `GET /RDdMucRftztKt4Ag7WzUxX` (2026-08-11).

### 2.4 Document artifact branch (coarse)

`GET /taxonomy/document_artifact` top concepts: Document Provenance; Document Types; Document Location; Document's Intended Audience; Document Attributes; Document Components; Knowledge Type.

Under **Document Types**, children include: Legal Assistance Document; Bankruptcy and Restructuring Document; Advisory Document; Legal Services Engagement Documents; Regulatory Document; Transactional Document; Project Management Document; Litigation Document.

That is a **practice-document taxonomy**, not a paragraph/section/claim AST. “Document Components” may hold some component vocabulary, but live probes for patent-structure terms (independent claim, MPEP, invention disclosure) did not surface structural patent-document types (see §6).

### 2.5 Ontology engineering notes

- Format: OWL (RDF/XML primary in repo; tools also emit JSON-LD and OWL XML).
- Modeling style: large **taxonomy** (`rdfs:subClassOf` hierarchy) + SKOS-like labeling (`preferred_label`, `alternative_labels`, translations) + some object properties.
- Multilingual: MCP docs claim **~31% of concepts** have translations across **10+ languages** ([folio-mcp page](https://openlegalstandard.org/resources/folio-mcp/)).
- Version pin: production API graph branch **`2.0.0`** per health endpoint; GitHub `main` also carries ongoing OWL edits.

---

## 3. Governance, history, and dual-ecosystem risk

### 3.1 Timeline (from FOLIO’s public account)

| When | Event | Source |
| --- | --- | --- |
| 2022–2024 | SALI Alliance publishes **LMSS** (Legal Matter Standard Specification) under **MIT** on GitHub | [sali-legal/LMSS](https://github.com/sali-legal/LMSS), [FOLIO NOTICES](https://raw.githubusercontent.com/alea-institute/FOLIO/main/NOTICES.md) |
| Aug 2024 | ALEA / contributors raise Delaware corporate “void” and other compliance concerns; SALI activities described as paused | [What’s happening with SALI / SOLI / FOLIO](https://openlegalstandard.org/whats-happening-with-sali-soli-folio/) |
| Sep 2024 | **SOLI** (Standard for Open Legal Information) fork of LMSS under MIT terms | Same post |
| Jan 2025 | SALI cease-and-desist; ALEA response; dispute continues | Same post |
| Mar 14, 2025 | Rebrand **SOLI → FOLIO** for trademark clarity and fresh identity | Same post |
| 2025–2026 | FOLIO software stack (API, Python, MCP) matures; SALI Alliance site remains live with LMSS viewer | [sali.org](https://www.sali.org/), [viewer.sali.org](http://viewer.sali.org/) |

### 3.2 Governance model (FOLIO)

- **Federated development:** stakeholders develop under interoperable technical standards while remaining autonomous ([homepage modular/federated design](https://openlegalstandard.org/)).
- **Technical venue:** GitHub issues/PRs on [alea-institute/FOLIO](https://github.com/alea-institute/FOLIO).
- **Community forum:** [discourse.openlegalstandard.org](https://discourse.openlegalstandard.org/).
- **No membership dues required** for use of the open standard (stated in heritage post).
- **Steward:** ALEA Institute (API contact + GitHub org).

### 3.3 Parallel SALI Alliance

As of 2026, [sali.org](https://www.sali.org/) still presents LMSS as the industry shared taxonomy, with membership, a rebrand announcement, and a public taxonomy viewer. GitHub [sali-legal/LMSS](https://github.com/sali-legal/LMSS) remains public (MIT license badge), describing **18,000+ tags** and SALI API IRIs ([SALI_API.yml](https://github.com/sali-legal/api/blob/main/SALI_API.yml)).

**Operational implication for beep-effect:** treat FOLIO and SALI LMSS as **sibling taxonomies with shared DNA**, not as one superseded lineage. IRIs, labels, and codes may align or diverge over time. Prefer **explicit vendor slice + version pin** if ingesting either OWL into `@beep/ontology`. Do not assume marketplace “SALI-tagged” data is bit-identical to `alea-institute/folio@2.0.0`.

### 3.4 Contributors (historical)

NOTICES credits original LMSS contributors including Damien Riehl, Michael Bommarito, Yaniv Schiller, Alex Hamilton, and the SALI Alliance; current FOLIO managed by ALEA with continuing contributor work ([NOTICES.md](https://raw.githubusercontent.com/alea-institute/FOLIO/main/NOTICES.md)).

---

## 4. License and disposition for beep-effect

| Artifact | License | Source | Disposition for beep-effect |
| --- | --- | --- | --- |
| **FOLIO ontology data** (`FOLIO.owl`, concept definitions) | **CC BY 4.0** | [LICENSE](https://github.com/alea-institute/FOLIO/blob/main/LICENSE), [API license field](https://folio.openlegalstandard.org/openapi.json), [homepage](https://openlegalstandard.org/) | **Port/vendor/map with attribution** — attribution to FOLIO / ALEA / contributors as required by CC BY |
| **FOLIO software** (folio-python, folio-mcp, folio-api code) | **MIT** | [folio-mcp README](https://github.com/alea-institute/folio-mcp), [folio-python README](https://github.com/alea-institute/folio-python) | **Use/modify/ship freely** with MIT notice |
| **SALI LMSS** | **MIT** (repo) | [sali-legal/LMSS](https://github.com/sali-legal/LMSS) | Permissive code/data license; still **verify** any separate membership or trademark constraints before marketing “SALI-certified” |
| **LKIF-core** | **CC BY 4.0** (updated 2026-02-23) | [lkif-core README](https://github.com/RinkeHoekstra/lkif-core) | Port-with-attribution |
| **Lynx LKG** | **CC BY 4.0** | [lynx LKG deep-dive](../../lynx-lkg-ontology-grounding/research/02-lkg-ontology-deep-dive.md), [lkg.ttl](http://lynx-project.eu/doc/lkg.ttl) | Port-with-attribution |

**CC BY practical note:** attribution is mandatory; no copyleft on derivatives. For a public monorepo, keep `NOTICES`/attribution rows in the vendor slice manifest when shipping FOLIO-derived JSON-LD seeds.

**Risk note (non-license):** the SALI/FOLIO dispute is political/governance risk, not a GPL foot-gun. Prefer dual-mapping capability rather than hard dependency on one brand’s continued existence.

---

## 5. Tooling stack

### 5.1 Public REST API

- **Base:** [https://folio.openlegalstandard.org/](https://folio.openlegalstandard.org/)
- **OpenAPI 3.1:** [https://folio.openlegalstandard.org/openapi.json](https://folio.openlegalstandard.org/openapi.json)
- **Interactive docs:** [https://folio.openlegalstandard.org/docs](https://folio.openlegalstandard.org/docs)
- **Auth:** none required for public use; MCP docs state open CORS ([folio-mcp architecture](https://openlegalstandard.org/resources/folio-mcp/)).
- **Version:** API `0.4.0` (OpenAPI `info.version`); graph branch `2.0.0`.

**Endpoint groups (from docs scrape):**

| Group | Examples |
| --- | --- |
| Info | `GET /info/health` |
| Ontology class by IRI | `GET /{iri}`, `/{iri}/markdown`, `/{iri}/jsonld`, `/{iri}/xml`, `/{iri}/html` |
| Connections | `GET /connections` |
| Search | `/search/prefix`, `/search/label`, `/search/definition`, `/search/query`, `/search/query_properties` |
| LLM branch search | `/search/llm/area-of-law`, `/search/llm/document-artifacts`, … (one per major branch) |
| Taxonomy | `/taxonomy/area_of_law`, `/taxonomy/document_artifact`, `/taxonomy/forums_venues`, … |

**Live health (2026-08-11):**

```json
{
  "status": "healthy",
  "folio_graph": {
    "num_classes": 18323,
    "num_properties": 175,
    "title": "FOLIO",
    "github_repo_owner": "alea-institute",
    "github_repo_name": "folio",
    "github_repo_branch": "2.0.0"
  }
}
```

Source: [https://folio.openlegalstandard.org/info/health](https://folio.openlegalstandard.org/info/health).

### 5.2 Python: `folio-python`

- **Repo:** [https://github.com/alea-institute/folio-python](https://github.com/alea-institute/folio-python)
- **PyPI:** [https://pypi.org/project/folio-python/](https://pypi.org/project/folio-python/) (probe: version **0.3.6**, Python `>=3.10,<4`)
- **License:** MIT (code); loads CC-BY ontology data
- **Features:** load OWL from GitHub/URL; search by label/definition/prefix; structured `query` / `query_properties`; parent/child walk; property analysis; `find_connections`; export Markdown / JSON-LD / OWL XML
- **Extras:** `folio-python[search]` adds rapidfuzz, marisa-trie, alea-llm-client for fuzzy + LLM search
- **Positioning:** ontology layer under folio-enrich, folio-insights, folio-resolve, folio-api, alea-intake ([README](https://github.com/alea-institute/folio-python))

### 5.3 Python: `folio-mcp`

- **Repo:** [https://github.com/alea-institute/folio-mcp](https://github.com/alea-institute/folio-mcp)
- **PyPI:** [https://pypi.org/project/folio-mcp/](https://pypi.org/project/folio-mcp/) — **0.4.1**
- **License:** MIT
- **Install surface:** `uvx folio-mcp`, Claude Code / Cursor / VS Code / Gemini CLI / Codex recipes, hosted Streamable HTTP at `https://folio.openlegalstandard.org/mcp`
- **Backends:** API mode (default, httpx → public API) or `--local` / `FOLIO_MCP_LOCAL=1` with `folio-python[search]` (~10s load of ~18k classes)
- Deep dive: §7

### 5.4 Related ALEA packages (named, not fully audited here)

folio-mcp README links: **folio-api** (REST server implementation), **folio-enrich**, **folio-insights**, **folio-resolve**, **alea-intake**. Treat as ecosystem, not beep-effect dependencies, until separately vetted.

### 5.5 TypeScript / JavaScript

**No official `@folio/*` TypeScript ontology client** was found on npm for the Open Legal Standard project.

| npm hit | Relation to FOLIO ontology |
| --- | --- |
| `folio-mcp` (if any JS port) | Not observed as official ALEA package |
| `@henrikkvamme/folio-mcp` | **Unrelated** — Norwegian Folio *business banking* API MCP ([npm description](https://www.npmjs.com/package/@henrikkvamme/folio-mcp)) |
| `@stll/folio-core`, `@stll/folio-react`, `@stll/folio-agents` | **Unrelated** — OOXML/Word editor stack |

**Implication:** beep-effect (Effect-TS monorepo) will not get a first-party TS SDK. Integration paths:

1. Call public HTTPS API via Effect HTTP client (`effect/unstable/http`).
2. Optionally run `folio-mcp` as a sibling MCP process for coding agents (not in-process TS).
3. Ingest a **vetted JSON-LD/TTL slice** into `@beep/ontology` TaxonomyLoader (preferred for offline professional desktop).
4. Port a thin TS schema for FOLIO concept records (mirroring API JSON) — not a full OWL reasoner.

### 5.6 OWL tooling (generic)

Protégé / WebProtégé for exploration ([FOLIO getting started](https://github.com/alea-institute/FOLIO#getting-started)). No SPARQL endpoint advertised on the public FOLIO site (contrast Lynx’s historical SPARQL endpoint).

---

## 6. Patent and IP practice coverage (live probes)

### 6.1 What exists (good for matter tagging)

| Concept | Evidence | Notes |
| --- | --- | --- |
| **Intellectual Property Law** | Area-of-law child; id `INTP` | Parent of four specialties |
| **Patent Law** | Child of IP Law; id `INTP-PATE`; multilingual labels | Leaf practice area in probe |
| **Trademark / Copyright / Trade Secret Law** | Siblings under IP Law | Same shallow depth |
| **USPTO** | Label search hit: “U.S. Patent and Trademark Office” | Governmental body concept |
| **Prior Art** | Definition matches patent sense; leaf (no children) | Good tag; not a corpus model |
| **Software Patent**, **Design Patent Assets** | Label search hits | Asset / subject tags |
| **Application for Patent Registration** | Document-ish concept with definition | Coarse filing type |
| **UTBMS Patent (PA\*)** | Full task tree under billing codes | **Best patent-depth in FOLIO** |
| **830 Patent (PACER NoS)** | Nature-of-suit code | Litigation docket tag |
| **X201 Patent and Trademark Records** | Expense code for file histories / priority docs | Cost coding |
| **Intellectual Property Assets / Clause / Agreement / Claims** | Contract and asset vocabulary | CLM-oriented |

**UTBMS Patent tree (live children of `UTBMS Patent`):**

| Code family | Role |
| --- | --- |
| PA100 Assessment, Development, and Administration | Matter admin, strategy, budgeting |
| PA200 Patent Investigation and Analysis | Patentability, clearance, validity, infringement investigations, watches |
| PA300 Domestic Patent **Preparation** | Provisional, non-provisional, design, continuing, validation prep |
| PA400 Domestic Patent **Preparation** *(label bug — children are prosecution)* | IDS, preliminary amendment, **PA430 Official Communication (Office Action)**, quasi-judicial, post-issuance |
| PA500 International Patent Preparation | International filing prep analogues |
| PA600 International Patent Prosecution | International OA / IDS analogues |
| PA700 Other Patent Related Tasks | Opinions, portfolio, assignments, licensing |

**PA430 Official Communication - Domestic** definition explicitly equates U.S. merits communications with **“Office Action”** and covers docketing, client report, amendments/arguments, examiner interviews, restriction requirements, petitions, etc.
IRI (2026-08-11): `https://folio.openlegalstandard.org/RkF_JygU6SwyGAijZ3c8bsA` via label search.

**Trademark analogue:** `TR430 Official Communication - Domestic` definition (definition-search hit) describes Trademark Office communications known as “Office Action” in the U.S.

### 6.2 What is missing or weak (critical for drafting agents)

| Needed for patent drafting / OA response agents | FOLIO status (2026-08-11 probes) |
| --- | --- |
| **Independent claim / dependent claim** as document structure types | **Missing** — “claim” search returns civil claims, bankruptcy claims, constitutional claims |
| **Claim chart** / element-by-element mapping | **Missing** |
| **Specification sections** (field, background, summary, detailed description, abstract) as typed components | **Missing** as patent-spec structure (generic “Document Components” only) |
| **MPEP / 35 U.S.C. / 37 C.F.R.** rule nodes as navigable authority graph for rejection types | **Missing** (MPEP label search returned noise) |
| **Invention disclosure** as a first-class document type | **Missing** (search noise) |
| **Office Action as a document type** (not a billing task) | **Weak** — only via UTBMS PA430 *task* definition text; label “Office Action” does not resolve to a clean concept |
| **Response to Office Action** document type | **Missing** as a named type |
| **CPC/IPC classification** hierarchy | **Missing** (industry NAICS-like tags exist elsewhere; not patent classification) |
| **Patent family / priority claim / continuation-in-part structure** | Partial at best via UTBMS continuing-application *tasks*, not family graph |
| **Figure / claim support / enablement** rhetorical roles | **Out of scope** (DoCO/DEO territory) |

**Bottom line:** FOLIO is useful to tag *that a matter is patent prosecution* and *which UTBMS task a time entry is*, and to name USPTO / prior art / IP assets. It does **not** give agents a schema for *writing* a patent application or structured office-action response. That gap is **open** and must be filled by beep-effect’s own patent document ontology + AST rules (composing DoCO-like structure, OA annotation, and domain schemas).

This matches the earlier Lynx reference-ontology sweep conclusion: **zero patent/IP-specific structural modelling** across that 15-ontology list either ([03-reference-ontologies-sweep.md](../../lynx-lkg-ontology-grounding/research/03-reference-ontologies-sweep.md) §0.4).

---

## 7. FOLIO MCP server — agent surface deep dive

Primary docs:

- Overview: [https://openlegalstandard.org/resources/folio-mcp/](https://openlegalstandard.org/resources/folio-mcp/)
- Tools reference: [https://openlegalstandard.org/resources/folio-mcp-tools/](https://openlegalstandard.org/resources/folio-mcp-tools/)
- Source: [https://github.com/alea-institute/folio-mcp](https://github.com/alea-institute/folio-mcp)
- Hosted MCP: `https://folio.openlegalstandard.org/mcp`

### 7.1 Design goal

Expose the full FOLIO ontology to **coding agents and LLM assistants** (Claude Code, Gemini CLI, Codex, Cursor, VS Code) via [Model Context Protocol](https://modelcontextprotocol.io/) so agents can search, browse, and export legal concepts **without leaving the IDE**. Use cases called out: legal software development, document classification, ontology-driven workflows ([overview](https://openlegalstandard.org/resources/folio-mcp/)).

### 7.2 Transport and backends

```
API mode (default):
  AI assistant ──stdio──► folio-mcp ──HTTPS──► folio.openlegalstandard.org

Local mode:
  AI assistant ──stdio──► folio-mcp ──in-process──► FOLIO OWL (~18k classes)

Remote:
  AI assistant ──Streamable HTTP──► https://folio.openlegalstandard.org/mcp
```

Config examples use `uvx folio-mcp` or `folio-mcp --local` / `--api-url` ([README](https://github.com/alea-institute/folio-mcp)).

### 7.3 Complete tool inventory (12 tools)

Grouped as in the official tools reference.

#### Discovery

| Tool | Parameters | Returns | Role for agents |
| --- | --- | --- | --- |
| **`list_branches`** | none | Map branch → concept counts | Orient: what taxonomy exists |
| **`search_concepts`** | `query`, `limit=10` | `{iri, label, definition, score}[]` | **Primary entry** — fuzzy label search |
| **`search_definitions`** | `query`, `limit=10` | same shape | When name search fails; definition text match |

#### Browsing

| Tool | Parameters | Returns | Role |
| --- | --- | --- | --- |
| **`get_taxonomy_branch`** | `branch_name`, `max_depth=1` | Concept summaries | Enumerate a branch (e.g. `areas_of_law`) |
| **`get_concept`** | `iri` (short or full) | Full record (translations, parents/children IRIs, identifiers, …) | Hydrate after search |
| **`get_children`** | `iri`, `max_depth=1` | Summaries | Walk down taxonomy |
| **`get_parents`** | `iri`, `max_depth=1` | Summaries | Walk up taxonomy path |

#### Advanced query

| Tool | Parameters | Returns | Role |
| --- | --- | --- | --- |
| **`query_concepts`** | `label`, `definition`, `alt_label`, `example`, `any_text`, `branch`, `parent_iri`, `has_children`, `deprecated`, `country`, `match_mode` (`substring`/`exact`/`regex`/`fuzzy`), `limit` | Concepts | AND-composed filters; leaf-only etc. |
| **`query_properties`** | `label`, `definition`, `domain_iri`, `range_iri`, `has_inverse`, `match_mode`, `limit` | Properties | Find relationship types |
| **`get_properties`** | none | All object properties | Schema design / full relationship inventory |

#### Relationship & export

| Tool | Parameters | Returns | Role |
| --- | --- | --- | --- |
| **`find_connections`** | `subject_iri` (req), `property_name`, `object_iri` | Triples `{subject, property, object}` | Semantic edges beyond pure hierarchy |
| **`export_concept`** | `iri`, `format` ∈ `markdown` \| `jsonld` \| `owl_xml` | Serialized concept | Integration handoff |

**Important agent note (official):** many concepts only participate in `subClassOf` hierarchy; connections may be empty — use parents/children instead ([find_connections note](https://openlegalstandard.org/resources/folio-mcp-tools/#find_connections)).

### 7.4 MCP resources (3)

| URI | Content |
| --- | --- |
| `folio://branches` | Index of 24 branches + counts |
| `folio://stats` | Version, class/property counts, license |
| `folio://branch/{name}` | Top-level concepts for a branch (on demand) |

Resources give **passive context injection** without a tool call — useful for system prompts that need “what does FOLIO cover?”

### 7.5 Prompt templates

**Product page (11 prompts)** vs **GitHub README snapshot (3 prompts)** — the published product page is the superset and matches changelog work that expanded prompts to 11 ([commit note in repo listing](https://github.com/alea-institute/folio-mcp)). Treat **11** as the documented product surface:

| Prompt | Argument | Intent |
| --- | --- | --- |
| `classify-document` | `description` | Map free-text doc description → FOLIO document concept |
| `identify-area-of-law` | `situation` | Practice-area identification |
| `classify-entity` | `entity` | Person/org/role classification |
| `classify-industry` | `description` | Industry sector |
| `identify-legal-authority` | `authority` | Statute/regulation/case-law type |
| `classify-event` | `event` | Legal event type |
| `identify-service-type` | `matter` | Legal service type |
| `identify-forum-venue` | `matter` | Court/agency/ADR venue |
| `identify-objective` | `matter` | Matter objectives |
| `classify-asset` | `asset` | Asset type (incl. IP assets) |
| `identify-engagement-terms` | `arrangement` | Engagement/fee terms |

Each prompt is designed to **guide the model through the correct tool workflow** and return structured output (label, IRI, definition, confidence, reasoning) ([overview](https://openlegalstandard.org/resources/folio-mcp/), [README prompts](https://github.com/alea-institute/folio-mcp#prompts-3)).

### 7.6 Documented multi-tool workflows

From [folio-mcp-tools](https://openlegalstandard.org/resources/folio-mcp-tools/):

1. **Labeling contract clauses** — `search_concepts` → `get_concept` → `get_parents` → `get_children` → optional `export_concept`.
2. **Classifying docket motions** — branch browse `document_artifacts` → search motion type → parents path → JSON-LD export.
3. **Client intake area-of-law** — branch list → definition search → `query_concepts` → children for sub-specialties.
4. **Multilingual glossary** — search + translations fields.
5. **Schema design** — `get_properties` / `query_properties` / `find_connections`.

These workflows are the **template for how ontology should be exposed to LLM agents**: small, composable tools; hierarchical navigation with depth limits; export for system integration; prompts that encode the playbook.

### 7.7 How the ontology is exposed to LLMs (mechanics)

| Layer | Mechanism |
| --- | --- |
| **Discovery** | Branch index resource + list/search tools reduce 18k-class space |
| **Retrieval** | Fuzzy/substring/regex/definition/LLM-branch search (API also has `/search/llm/*`) |
| **Structure** | Parent/child walks reconstruct taxonomy path for explanation |
| **Semantics** | Optional object-property triples |
| **Grounding** | Stable IRIs + definitions in every high-value response |
| **Interoperability** | JSON-LD / OWL XML export for other systems |
| **Guidance** | Prompt templates encode expert workflows (classification playbooks) |
| **Offline** | Local OWL load avoids network for air-gapped agents |

This is **tool-augmented RAG over a controlled vocabulary**, not free-form vector RAG over statutes. Quality depends on ontology coverage and definition quality — which is strong for general U.S. legal practice tags, weaker for patent document structure (§6).

---

## 8. Comparison: FOLIO vs SALI LMSS vs LKIF vs Lynx LKG

### 8.1 Comparison matrix

| Dimension | **FOLIO** | **SALI LMSS** | **LKIF-core** | **Lynx LKG** |
| --- | --- | --- | --- | --- |
| **Primary purpose** | Federated legal *matter/data* taxonomy + interoperability IRIs | Industry legal matter specification / same product family | Foundational *legal theory* ontology (norms, roles, actions, time) | Multilingual *compliance document* KG (legislation, case law, contracts, standards) |
| **Approx. size** | ~18.3k classes, 175 props (live) | “18,000+ tags” (README) | Modular library (~15 modules), small class count vs FOLIO | ~10 core classes + properties; imports ELI/NIF |
| **Structure** | Deep taxonomy + light object properties | Same style (shared heritage) | Highly axiomatized OWL modules | Document/annotation-centric; NIF offsets |
| **Agent / MCP tooling** | **Strong** (folio-mcp, public API, Python) | Weak public agent tooling; SALI API YAML | None modern MCP | Historical Lynx services; not an MCP product |
| **TS-native** | No official | No | No | No |
| **License** | Data CC-BY 4.0; code MIT | MIT (repo) | CC-BY 4.0 | CC-BY 4.0 |
| **Governance** | ALEA + open GitHub/Discourse | SALI Alliance membership + GitHub | Academic maintainer (Hoekstra et al.) | EU H2020 project (ended); artifacts static |
| **Patent drafting depth** | Matter tags + UTBMS PA\* | Similar if still aligned | Norm/role theory only | Document KG, not patent claims |
| **Document AST depth** | Coarse document *types* | Coarse document types | Document as expression/source types | **Parts + annotations + offsets** (strongest of four for spans) |
| **Best fit in beep-effect** | Matter tagging + MCP design reference | Industry interchange if clients demand SALI | Upper-ontology inspiration | Span-anchored annotation + ELI FRBR ideas |

### 8.2 SALI LMSS detail

- **Home:** [https://www.sali.org/](https://www.sali.org/); explore: [https://sali.org/explore-the-standard/](https://sali.org/explore-the-standard/); viewer: [http://viewer.sali.org/](http://viewer.sali.org/).
- **Repo:** [https://github.com/sali-legal/LMSS](https://github.com/sali-legal/LMSS) — `LMSS.owl`, MIT.
- **Stability policy:** IRIs intended long-lived; properties (labels, synonyms, translations, definitions, edges) evolve; formal versioned Releases planned ([README](https://github.com/sali-legal/LMSS)).
- **API:** [SALI_API.yml](https://github.com/sali-legal/api/blob/main/SALI_API.yml) — IRIs as API identifiers.
- **Relation to FOLIO:** FOLIO is an ALEA fork of LMSS with rebrand and expanded software; both claim 18k-class scale. **Do not treat as interchangeable without IRI/version checks.**

### 8.3 LKIF-core detail

- **Repo:** [https://github.com/RinkeHoekstra/lkif-core](https://github.com/RinkeHoekstra/lkif-core)
- **Modules:** top, place, mereology, time; process, role, action, expression; legal-action, legal-role, norm; modification, rules; aggregated as lkif-core / lkif-extended.
- **Strength:** formal vocabulary for **norms, rights, powers, legal persons, propositional attitudes**, Allen time, mereology — useful if beep-effect models *legal effects* or *normative rules* over documents.
- **Weakness:** not a matter-management taxonomy; not patent prosecution structure; no MCP.
- **License:** CC BY 4.0 (2026-02-23 update also added Turtle serializations).

### 8.4 Lynx LKG detail

- **Project:** [https://lynx-project.eu/](https://lynx-project.eu/) — Legal Knowledge Graph for multilingual compliance.
- **Ontology:** [https://lynx-project.eu/doc/lkg/](https://lynx-project.eu/doc/lkg/); TTL at [lkg.ttl](http://lynx-project.eu/doc/lkg.ttl).
- **Classes:** LynxDocument, LynxDocumentPart, LynxAnnotation, Metadata, Agreement, CollectiveAgreement, CaseLaw, Legislation, TechnicalSpecification, Standard (see in-repo deep dive).
- **Killer idea for beep-effect:** NIF **offset-based fragment IRIs** for annotations (`#offset_begin_end`) — binds KG entities to exact character spans; already analyzed as the best port for closing span gaps.
- **Caveats:** HTML docs vs OWL inconsistencies; frozen EU project; not a substitute for FOLIO’s practice-area tags.

### 8.5 Layering picture (how they stack)

```
┌─────────────────────────────────────────────────────────────┐
│ Application agents (professional-desktop drafting / OA)     │
├─────────────────────────────────────────────────────────────┤
│ beep AST: @beep/md · pandoc-ast · lexical-schema            │  structural
│ + patent structure schemas (claims, OA units)  ← BUILD      │  (gap)
├─────────────────────────────────────────────────────────────┤
│ Discourse / doc components: DoCO · DEO · PO (SPAR)          │  rhetorical
├─────────────────────────────────────────────────────────────┤
│ Span / annotation: OA · NIF-style offsets · PROV            │  grounding
├─────────────────────────────────────────────────────────────┤
│ Matter tags: FOLIO / SALI LMSS                              │  classification
│ Upper legal theory (optional): LKIF                         │  axioms
│ Compliance docs (optional): Lynx LKG · ELI                  │  legislation
└─────────────────────────────────────────────────────────────┘
```

FOLIO sits in the **classification** layer. beep-effect’s differentiator for patent practice is the **structural + rhetorical + span** layers plus a **patent domain ontology** FOLIO does not provide.

---

## 9. Equivalent MCP surface over beep-effect’s taxonomy loader

### 9.1 Current beep bricks (in-repo)

| Brick | Path / role |
| --- | --- |
| Taxonomy loader | `packages/foundation/modeling/ontology/src/TaxonomyLoader.ts` — fail-closed manifest, `VETTED`/`UNVETTED`, JSON-LD vendor slices |
| Taxonomy registry | `TaxonomyRegistry.ts` — pure projections, librarian loop, `TaxonomyConceptNotFound` |
| Semantic foundation models | `SemanticFoundation.models.ts` — `TaxonomySeed`, filing segments, document classes |
| RDF vocab | `packages/foundation/modeling/rdf/src/Vocab/` — OA, PROV, DCTERMS, SKOS, OWL, RDFS, … |
| Document ASTs | `@beep/md`, `@beep/pandoc-ast`, `@beep/lexical-schema` |
| Agent host | `apps/professional-desktop` |

Loader design is **schema-first and fail-closed** (path traversal rejected at decode; only vetted slices admitted) — stronger operational control than “load all of FOLIO.owl”.

### 9.2 Design principles borrowed from FOLIO MCP

1. **Small tool count, high composability** (≈10–15 tools).
2. **Search → hydrate → walk hierarchy → export** pipeline.
3. **Depth-limited children** to protect context windows.
4. **Resources** for stats/branch index (cheap context).
5. **Prompt templates** that encode firm playbooks (classify OA; classify patent section; map rejection type).
6. **Stable IRIs** in every response.
7. **Offline-first** for professional desktop (local seed, not required public API).
8. **Export** formats agents and pipelines can re-ingest (JSON-LD, Markdown).

### 9.3 Proposed beep MCP tool surface

Name sketch: `beep-ontology-mcp` or `beep-taxonomy` (stdio + optional HTTP). Backend: Effect services over `TaxonomyRegistry` + optional FOLIO remote client.

#### A. Taxonomy / concept tools (FOLIO-analogue)

| Tool | Purpose |
| --- | --- |
| `list_slices` | List loaded vendor slices + loadStatus + concept counts |
| `list_branches` / `list_schemes` | SKOS schemes / beep branch roots |
| `search_concepts` | Fuzzy/label search across loaded seeds |
| `search_definitions` | Definition text search |
| `query_concepts` | Filters: scheme, parent, leaf-only, deprecated, vendor, tags |
| `get_concept` | Full concept record by IRI |
| `get_children` / `get_parents` | Hierarchy walk with `max_depth` |
| `export_concept` | JSON-LD / Markdown / beep Schema snippet |
| `find_connections` | Object properties / seeAlso / custom edges from seed |

#### B. Document-structure tools (FOLIO does not have these — beep differentiator)

| Tool | Purpose |
| --- | --- |
| `list_ast_node_types` | Enumerate Md/Pandoc/Lexical node tags |
| `get_structure_rules` | Ontology-informed rules for a document class (e.g. utility application sections) |
| `validate_document_shape` | Check AST against structure rules (Effect typed errors) |
| `suggest_section_map` | Map free-text / outline → typed section roles |
| `annotate_span` | Propose OA-compatible annotation payload for a char span |

#### C. Patent-practice tools (fill FOLIO gap)

| Tool | Purpose |
| --- | --- |
| `list_rejection_types` | 101/102/103/112 family (from **beep** patent authority seed, not FOLIO) |
| `map_office_action_units` | Segment OA text → rejection units + cited art slots |
| `claim_tree_summary` | Independent/dependent claim graph from claim AST |
| `prior_art_slot_schema` | Required fields for a prior-art reference record |
| `folio_bridge_search` | Optional: proxy to public FOLIO API for matter-tag IRIs |

#### D. Resources

| Resource | Content |
| --- | --- |
| `beep://ontology/stats` | Loaded slices, concept counts, licenses, graph hash |
| `beep://ontology/slices` | Manifest rows |
| `beep://ontology/slice/{id}` | Branch index for one vendor |
| `beep://ast/md-nodes` | Canonical Md node inventory |
| `beep://patent/document-classes` | Patent application / OA / IDS / etc. |

#### E. Prompt templates (examples)

- `classify-intake-document` — map upload → DocumentClass + FOLIO/beep IRIs
- `draft-outline-utility-application` — section roles from patent structure seed
- `parse-office-action` — rejection units + docket deadlines (with human confirm)
- `align-claims-to-spec` — claim support checklist
- `tag-matter-folio` — optional FOLIO area-of-law / UTBMS task suggestion

### 9.4 Implementation notes (Effect / schema-first)

- **Schema → Context.Service → implementation** order (repo law).
- Concept record as `S.Class` with `IRIReference`, optional SKOS fields, `vendorSliceId`, `license`.
- Errors as tagged unions (`TaxonomyConceptNotFound` already exists — reuse).
- Prefer `effect/HashMap` / `HashSet` for registries.
- HTTP to FOLIO (if bridged) via `effect/unstable/http`, never `node:http`.
- **Do not** load unvetted 18k OWL at runtime in the desktop app without a pin + license attribution row; prefer **curated slices** (IP Law subtree + UTBMS PA\* + USPTO + Prior Art + document types of interest).
- MCP server can be a thin Python or TS host; given monorepo language, **TS Effect MCP** is preferable long-term; short-term **spawn folio-mcp** only for exploratory coding sessions.

### 9.5 Minimum viable “FOLIO-equivalent” for agents

If budget is one sprint: implement **A + D** over existing `TaxonomyLoader`/`Registry`, plus one patent structure seed stub. Defer remote FOLIO bridge until a client integration needs SALI/FOLIO IRIs on the wire.

---

## 10. Fit for beep-effect — assessment

### 10.1 Recommendation (ranked actions)

| Rank | Action | Rationale | License |
| --- | --- | --- | --- |
| **1** | **Study + mirror FOLIO MCP tool design** for beep taxonomy MCP | Best-in-class agent UX for ontologies | MIT (folio-mcp code) — learn freely |
| **2** | **Optionally ingest a curated FOLIO slice** (IP Law + USPTO + Prior Art + UTBMS PA\* + relevant document types) into `@beep/ontology` as a **VETTED** vendor slice with CC-BY attribution | Instant interoperable matter tags without full 18k | CC-BY 4.0 data |
| **3** | **Do not** treat FOLIO as the patent document ontology | Structural gap is decisive for drafting agents | — |
| **4** | **Compose** DoCO/DEO/PO (structure/rhetoric) + OA/PROV (annotation) + **new patent structure schemas** + optional FOLIO tags | Full stack for professional desktop | SPAR CC-BY; OA/PROV standard |
| **5** | Keep **SALI LMSS** as a mapping target if industry partners require SALI IRIs | Dual-ecosystem reality | MIT |
| **6** | Use **Lynx LKG** ideas (offset IRIs) and **LKIF** only as upper-ontology reference | Already researched in-repo | CC-BY 4.0 |
| **7** | Run **public folio-mcp** in agent coding sessions for exploration | Zero integration cost | MIT + public API |

### 10.2 Fit scores (subjective, evidence-based)

| Concern | Score (1–5) | Comment |
| --- | --- | --- |
| Matter / practice-area tagging | **5** | Exactly FOLIO’s strength |
| Agent-facing ontology UX (MCP) | **5** | Category leader among legal KGs |
| TypeScript / Effect-native | **1** | No official TS; DIY client or MCP sidecar |
| Document AST / editor rules | **1** | Out of scope for FOLIO |
| Patent claim / OA document structure | **2** | UTBMS task depth only |
| Interoperability with clients/vendors | **4** | IRIs + JSON-LD; dual SALI path complicates slightly |
| Governance stability | **3** | Active software; political fork risk |
| License compatibility | **5** | CC-BY data + MIT code fits public monorepo with attribution |

### 10.3 Decision one-liner

**Use FOLIO as the optional classification and interoperability layer (and as the MCP design template); build patent document structure and AST rules in beep-effect; do not wait for FOLIO to grow a claim ontology.**

---

## 11. Ranked shortlist + license notes (quick card)

| Rank | Name | Kind | License | URL | Keep? |
| --- | --- | --- | --- | --- | --- |
| 1 | **FOLIO** | Legal matter ontology + API + MCP | **CC-BY 4.0** (data), **MIT** (code) | [openlegalstandard.org](https://openlegalstandard.org/), [FOLIO.owl](https://github.com/alea-institute/FOLIO) | **Yes** — curated slice + MCP patterns |
| 2 | **folio-mcp** | MCP server | **MIT** | [github.com/alea-institute/folio-mcp](https://github.com/alea-institute/folio-mcp) | **Yes** — design reference; optional agent dependency |
| 3 | **folio-python** | Python client | **MIT** | [github.com/alea-institute/folio-python](https://github.com/alea-institute/folio-python) | Optional (ops/scripts); not core TS path |
| 4 | **SALI LMSS** | Industry twin taxonomy | **MIT** | [github.com/sali-legal/LMSS](https://github.com/sali-legal/LMSS), [sali.org](https://www.sali.org/) | Map if partners require |
| 5 | **Lynx LKG** | Compliance document KG | **CC-BY 4.0** | [lynx-project.eu/doc/lkg](https://lynx-project.eu/doc/lkg/) | Offset/annotation ideas |
| 6 | **LKIF-core** | Legal upper ontology | **CC-BY 4.0** | [github.com/RinkeHoekstra/lkif-core](https://github.com/RinkeHoekstra/lkif-core) | Reference axioms only |
| 7 | **SPAR DoCO/DEO/PO** | Document structure/rhetoric | **CC-BY 4.0** (DoCO stated) | [sparontologies.github.io](https://sparontologies.github.io/) | Parallel packet track for AST rules |

---

## 12. Source ledger (non-exhaustive but load-bearing)

### FOLIO / ALEA

- https://openlegalstandard.org/
- https://openlegalstandard.org/resources/folio-mcp/
- https://openlegalstandard.org/resources/folio-mcp-tools/
- https://openlegalstandard.org/whats-happening-with-sali-soli-folio/
- https://folio.openlegalstandard.org/
- https://folio.openlegalstandard.org/docs
- https://folio.openlegalstandard.org/openapi.json
- https://folio.openlegalstandard.org/info/health
- https://folio.openlegalstandard.org/search/label?query=patent
- https://folio.openlegalstandard.org/taxonomy/area_of_law
- https://github.com/alea-institute/FOLIO
- https://raw.githubusercontent.com/alea-institute/FOLIO/main/README.md
- https://raw.githubusercontent.com/alea-institute/FOLIO/main/NOTICES.md
- https://github.com/alea-institute/folio-mcp
- https://github.com/alea-institute/folio-python
- https://pypi.org/project/folio-mcp/
- https://pypi.org/project/folio-python/
- https://creativecommons.org/licenses/by/4.0/
- https://discourse.openlegalstandard.org/
- https://modelcontextprotocol.io/

### SALI

- https://www.sali.org/
- https://github.com/sali-legal/LMSS
- https://github.com/sali-legal/api/blob/main/SALI_API.yml
- http://viewer.sali.org/

### LKIF / Lynx

- https://github.com/RinkeHoekstra/lkif-core
- https://lynx-project.eu/
- https://lynx-project.eu/doc/lkg/
- http://lynx-project.eu/doc/lkg.ttl

### In-repo prior work

- `explorations/lynx-lkg-ontology-grounding/research/02-lkg-ontology-deep-dive.md`
- `explorations/lynx-lkg-ontology-grounding/research/03-reference-ontologies-sweep.md`
- `explorations/document-structure-ontologies/research/SOURCES.md`
- `packages/foundation/modeling/ontology/src/TaxonomyLoader.ts`
- `packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts`

### Probe artifacts

- `explorations/document-structure-ontologies/research/grok/raw/.firecrawl-03/` (scrapes + API JSON dumps)

---

## 13. Open questions for the packet

1. **IRI strategy:** map FOLIO IRIs 1:1 as external identifiers on beep concepts, or mint `https://ns.beep.sh/…` with `skos:exactMatch` / `owl:sameAs` to FOLIO?
2. **Which UTBMS PA\* depth to vendor?** Full PA tree vs PA300/PA400 only?
3. **Dual SALI/FOLIO:** is any client already on SALI API IRIs that must round-trip?
4. **MCP host language:** TS Effect in-repo vs Python sidecar?
5. **Patent structure seed ownership:** new `@beep/patent-ontology` package vs slice under ontology seeds?
6. **Whether to contribute upstream** patent document types to FOLIO (CC-BY ecosystem) vs keep firm-private structure rules.

---

*End of report 03 — FOLIO and legal KG.*
