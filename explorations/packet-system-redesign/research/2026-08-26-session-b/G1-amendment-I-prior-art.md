# G1 — Amendment I prior art: does a PROV-O / P-Plan JSON-LD projection of plan state deliver durable value?

**Date:** 2026-08-26
**Session:** packet-system-redesign session B, Grok webresearch G1
**Question:** A team keeps project/plan control state as Markdown packets plus an append-only event chain. Someone proposed a read-only JSON-LD projection of the fold, with IRIs anchored on PROV-O and P-Plan, mapped to AgentO. Markdown + events remain the system of record; the graph is derived and disposable. The stated justification is the JOIN to the rest of a knowledge graph — not SPARQL over 214 packets. Has anyone proven that join is worth anything?

**Default hypothesis to refute:** "Projecting plan/workflow state to PROV-O/P-Plan JSON-LD delivers durable value."

**Method:** Live fetches of project sites, repos, papers, Zenodo, W3C pages, GitHub, and X. Claims marked **VERIFIED** were fetched in this session. Claims marked **INFERRED** are synthesis. **UNCONFIRMED** items are flagged as such.

**Adversarial stance:** The projection is cheap to sketch and expensive to keep honest. Evidence of production use, abandonment, and competing shapes is weighted higher than ontology papers.

**Status:** Complete. Six sections plus Verdict. Fetched 2026-08-26.

---

## 1. Real deployments, not papers

**Headline (VERIFIED):** The people who actually ship workflow/plan provenance in 2024–2026 do **not** emit PROV-O/P-Plan as the interchange surface. They emit **schema.org JSON-LD inside RO-Crate**, or a **native JSON event model** (OpenLineage, Nextflow lineage). PROV-O remains a library format and an academic mapping target. P-Plan is a 2012 OWL vocabulary with no production consumers in engineering tooling.

### 1.1 The one live PROV-O projection of workflow runs: CWLProv / `cwltool --provenance`

**VERIFIED by fetch:**

- Spec repo [`common-workflow-language/cwlprov`](https://github.com/common-workflow-language/cwlprov): 20 stars, **last commit 2022-12-20** (`845196b7`, “Make the CWLProv paper more prominent”). Not archived, but frozen. GitHub API `pushed_at` 2022-12-20. [repo](https://github.com/common-workflow-language/cwlprov)
- Profile still documents PROV-N as **mandatory** (`primary.cwlprov.provn`) and PROV-O as optional Turtle / N-Triples / **JSON-LD**. [prov.md](https://github.com/common-workflow-language/cwlprov/blob/main/prov.md)
- `cwltool` **still ships** `--provenance` in the 2026 docs (page last updated 2026-07-23). Output is a BagIt Research Object with `metadata/manifest.json` (JSON-LD) plus PROV traces. [cwltool CWLProv.html](https://cwltool.readthedocs.io/en/latest/CWLProv.html)
- Inspector [`cwlprov-py`](https://github.com/common-workflow-language/cwlprov-py): 4 stars; last push 2026-07-20. Alive as a reader, not as a growing producer ecosystem.
- “Known implementations” listed on the spec: `cwltool --provenance` (reference), `cwlprov-py`, a 2018 Nextflow WIP (`edgano/researchObject-Nextflow`), and **Toil as “planned”** (`DataBiosphere/toil#2390`). [cwlprov README](https://github.com/common-workflow-language/cwlprov)

**VERIFIED — the authors later said this failed to spread.** The 2024 PLOS ONE WRROC paper, written by overlapping authors (Soiland-Reyes, Crusoe, Garijo, Leo, …):

> “the authors suspect [CWLProv’s design] may be one of the main causes for the **low adoption of CWLProv (at the time of writing the format is supported only by cwltool)**.”
> [Leo et al. 2024, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0309210)

They also list the join-problem that Amendment I is trying to solve, as a **reason CWLProv lost**:

- PROV traces are “highly focused on the interaction between agents, processes and related entities”
- Contextual metadata (authors, licence, creation date) lived in a **separate** RO manifest
- Multiple PROV serialisations in one bag “complicating its generation and consumption”
- Full prospective provenance required reading the native workflow file anyway

That is a production post-mortem written by the people who shipped the PROV-O projection. **INFERRED:** if the team that built CWLProv then replaced it with schema.org JSON-LD, treating PROV-O as the interchange format is swimming upstream.

### 1.2 What actually shipped: Workflow Run RO-Crate (schema.org JSON-LD, SKOS-mapped to PROV)

**VERIFIED by fetch of the project site (2026-07-06 last push) and the PLOS paper:**

[Workflow Run RO-Crate](https://www.researchobject.org/workflow-run-crate/) is the 2024–2026 interchange for *workflow run provenance*. Vocabulary is **schema.org** (`CreateAction`, `HowToStep`, `SoftwareApplication`, `agent`, `object`, `result`) plus Bioschemas `ComputationalWorkflow` / `FormalParameter`. PROV is a **SKOS mapping**, not the on-the-wire types. Mapping crate: [doi:10.5281/zenodo.10368990](https://doi.org/10.5281/zenodo.10368990).

Implementations listed on the project site (fetched 2026-08-26) and independently checkable:

| Engine | Surface | Status (this session) | Link |
| --- | --- | --- | --- |
| **Galaxy ≥ 23.1.1** (2023-02 announcement; v23) | Workflow Run Crate export from invocation UI/API | **Production on usegalaxy.\*** | [Galaxy news 2023-02-23](https://galaxyproject.org/news/2023-02-23-structured-data-exports-ro-bco/); [example crate](https://doi.org/10.5281/zenodo.7785861) |
| **Nextflow `nf-prov` ≥ 1.4.0** (2025-02-06) | WRROC JSON-LD + BioCompute Object | **Maintained.** 30 stars, last push 2026-05-17, 17 open issues. Changelog 1.5.0 **removed the legacy format**. | [github.com/nextflow-io/nf-prov](https://github.com/nextflow-io/nf-prov) |
| **COMPSs ≥ 3.2 / 3.4** | Workflow or Provenance Crate | Integrated in the runtime | [WRROC site table](https://www.researchobject.org/workflow-run-crate/) |
| **StreamFlow** | Provenance Crate | Main-branch; paper said “will be in 0.2.0” | same |
| **WfExS, Sapporo, Autosubmit** | Workflow Crate | Listed with Zenodo examples | same |
| **runcrate** | Converts **CWLProv → WRROC** | Reference converter; this is how CWLProv is consumed *today* | [runcrate](https://www.researchobject.org/runcrate/) |
| **WorkflowHub** | Workflow RO-Crate (definitions, not runs) as upload/exchange format | Production registry | [about.workflowhub.eu/Workflow-RO-Crate](https://about.workflowhub.eu/Workflow-RO-Crate/) |

Repo [`ResearchObject/workflow-run-crate`](https://github.com/ResearchObject/workflow-run-crate): 13 stars, last push **2026-07-06**, 15 open issues. Alive community, small GitHub footprint; the real adoption is *inside engines*, not stars.

**Adversarial note (INFERRED):** “JSON-LD projection” in this literature does **not** mean “PROV-O triples with P-Plan steps.” It means a **flattened, compacted schema.org graph in `ro-crate-metadata.json`** that a human can read and that WorkflowHub/Galaxy/Zenodo already ingest. Binding Amendment I to PROV-O/P-Plan/AgentO is choosing the *older* of the two JSON-LD dialects this community ran.

### 1.3 Galaxy: the third-party PROV-O exporter was bypassed by first-party RO-Crate

**VERIFIED:** [`albangaignard/galaxy-PROV`](https://github.com/albangaignard/galaxy-PROV) — “generation of provenance graphs (RDF, PROV-O ontology) based on Galaxy user histories.” 2 stars, 49 commits, README still says “web-based user interface is under active development” (2017 copyright). Last commit 2026-01-15 is a “basic RAG retriever to find bio.tools IDs” — hobby maintenance, not a Galaxy product.

Galaxy’s own production export, added in Galaxy 23, is RO-Crate + BioCompute Object, **not** PROV-O. [Galaxy Hub, 2023-02-23](https://galaxyproject.org/news/2023-02-23-structured-data-exports-ro-bco/)

That is the closest analogue to “we already have a fold; add a PROV-O projection”: a loosely-coupled RDF exporter existed for years; the platform owners shipped a different JSON-LD profile.

### 1.4 Nextflow: first-party path is BCO + WRROC + a *native* lineage store; ProvONE JSON-LD is a 1-star plugin

**VERIFIED:**

- Official plugin [`nf-prov`](https://github.com/nextflow-io/nf-prov) (30★, push 2026-05-17): BioCompute Object, WRROC, DAG HTML, GEXF (1.7.0, 2026-01-05). README: *“The `legacy` format was removed in version 1.5.0. Consider using [data lineage](https://nextflow.io/docs/latest/data-lineage.html) instead.”* Changelog 1.4.0 (2025-02-06) added WRROC and **deprecated** legacy; 1.5.0 (2025-09-04) **deleted** it. [CHANGELOG.md](https://github.com/nextflow-io/nf-prov/blob/main/CHANGELOG.md)
- Nextflow **data lineage** (experimental, 25.04+): local `.lineage` store, JSON records (`WorkflowRun` / `TaskRun` / `AgentRun` / `FileOutput`), `lid://` URIs, `jq`-friendly. **Not RDF.** Docs: [docs.seqera.io/nextflow/data-lineage](https://docs.seqera.io/nextflow/data-lineage). This is the closest production cousin of “append-only event chain + derived projection.”
- Third-party [`fbartusch/nf-provone`](https://github.com/fbartusch/nf-provone): ProvONE JSON-LD for Fuseki/SPARQL. **1 star, last push 2024-09-26.** The README contrasts itself with `nf-prov` (BCO) and pitches triple stores. No evidence of production use.

Seqera community (2024-09-10) answered “how do I get an audit trail?” with **`nf-prov` + BCO**, not PROV-O. [community.seqera.io/t/1174](https://community.seqera.io/t/provenance-or-audit-trail-of-computation/1174)

### 1.5 Snakemake: filesystem metadata → SQLite/Postgres. PROV is a blog-post sidecar

**VERIFIED:** Snakemake 9.19 docs, “Provenance”: default is `.snakemake/metadata`; experimental `--persistence-backend db` writes **SQLite or any SQLAlchemy JSON-column DB (Postgres, MySQL)**. Explicitly *not* RDF. [snakemake.readthedocs.io …/provenance.html](https://snakemake.readthedocs.io/en/v9.19.0/executing/provenance.html)

Russ Poldrack (2026-04-21) shows a third-party `makeprov` package emitting PROV-JSON from a Snakemake run. This is a researcher’s sidecar, not an engine feature. [russpoldrack.substack.com](https://russpoldrack.substack.com/p/tracking-provenance-in-workflows)

### 1.6 P-Plan / OPMW / Wf4Ever / Taverna: the original “plan + PROV execution” stack is dead as product

These *are* the prior art for Amendment I’s data model (`pplan:Plan` / `pplan:Step` ↔ `prov:Activity` via `correspondsToStep`). Track record:

| Project | What it was | Status (VERIFIED) |
| --- | --- | --- |
| **P-Plan** | OWL extension of PROV-O for plans/steps/variables. Paper 2012 (Garijo & Gil). IRI `http://purl.org/net/p-plan#`. Version 1.3. | Spec still served. FAIRsharing record: **“This record is in need of a maintainer.”** Created 2011. [FAIRsharing.RlEMBA](https://fairsharing.org/10.25504/FAIRsharing.RlEMBA) · [purl.org/net/p-plan](http://purl.org/net/p-plan) |
| **OPMW** | Workflow templates + traces, extends PROV-O *and* P-Plan. | Academic Linked Data of WINGS workflows. Not an engineering product. [opmw.org/ontology](https://www.opmw.org/ontology/) |
| **Wf4Ever `wfdesc` / `wfprov`** | Prospective/retrospective pair, used by Taverna and CWLProv. EU project. | Primer still hosted; project ended. RO-Crate is the stated successor packaging. [wf4ever.github.io/ro-primer](https://wf4ever.github.io/ro-primer/) |
| **TavernaProv** | First-class **PROV-O RDF** export inside a Research Object ZIP, plus wfdesc. The cleanest historical analogue of “emit the plan graph.” | Apache Taverna **retired 2020-02-20**. Code archived, not maintained. Last engine release 3.1 (2016-07-01). [eScience Lab announcement](http://esciencelab.org.uk/announcements/2020/03/12/taverna-retirement/) · [Apache incubator status](https://incubator.apache.org/projects/taverna.html) · Wikipedia: TavernaProv = PROV-O in an RO bundle. |

**INFERRED:** P-Plan did its job as a *paper ontology*. It did not become the interchange format anyone’s CI or workflow engine speaks in 2026. AgentO subclassing it does not change that.

### 1.7 W3C PROV implementations report: a 2013 snapshot, not a living catalog

**VERIFIED:** [W3C PROV Implementation Report](https://www.w3.org/TR/prov-implementations/), Working Group Note **30 April 2013**. 64 implementations to exit CR. No subsequent W3C follow-up report was found. Names that overlap this question: Taverna (#4), WingsProvenanceExport (#3), ProvToolbox (#7), Prov Python (#34), StatJR (#1), CollabMap (#5), AgentSwitch (#18). Several of those applications are gone (see §2).

What is still a *library*, not a plan-state projection:

- **`prov` on PyPI**, 3.1.0, published 2026-08-07: PROV-O / PROV-JSON / PROV-JSONLD / PROV-XML. “Used extensively by ProvStore.” [pypi.org/project/prov](https://pypi.org/project/prov)
- **ProvToolbox** (Java), 82★, last push **2026-08-24**. Still maintained as a converter. [github.com/lucmoreau/ProvToolbox](https://github.com/lucmoreau/ProvToolbox)
- **ProvStore**: the public repository the Python lib points at. Homepage, fetched 2026-08-26: **“ProvStore is coming back soon.”** Validator and translator still linked. [openprovenance.org](https://openprovenance.org/)

REF 2021 impact case (Southampton/KCL) claimed secondary PROV adoption (HL7 FHIR Provenance, NASA/JPL, Geoscience Australia, Imosphere clinical ~4,000 users). That is **domain provenance of data/patients**, not a projection of software *plan* state. [REF 2021 impact](https://results2021.ref.ac.uk/impact/submissions/5e99651b-6e7e-483f-9c16-18ecf8df5d60/impact)

Wittner & Formánek, ESWC 2024: even the two “state of the art” PROV toolkits (Prov Python, ProvToolbox) were **not fully compatible** while ISO 23494 was being drafted. [Compatibility Challenges…](https://link.springer.com/chapter/10.1007/978-3-031-77847-6_31) (search hit: ESWC 2024, pp. 340–343)

### 1.8 What I did **not** find (flagged)

- **No** maintained open-source *software-engineering* tool (CI, issue tracker, project planner, agent control plane) that emits a PROV-O/P-Plan JSON-LD projection of plan/gate state. Searches covered CWL/Galaxy/Nextflow/Snakemake, “provenance graph of our CI/plans”, and GitHub. **UNCONFIRMED absence is not proof**, but the engines that *do* think about this problem chose RO-Crate or native JSON.
- **No** production P-Plan emitter outside academic WINGS/OPMW dumps.
- Semantica (`docs.getsemantica.ai/guides/provenance/`, fetched via search 2026-08-24) advertises a PROV-O *field mapping* and `export_prov()`. This is a product marketing page, not a verified deployment; treat as **UNCONFIRMED**.
- ISO 23494 / Common Provenance Model is specimen/data provenance in life sciences, not plan control. Related, not the same job.

### 1.9 Scoreboard against the hypothesis

The hypothesis was “projecting plan/workflow state to PROV-O/P-Plan JSON-LD delivers durable value.”

The only team that did exactly that for workflow runs (CWLProv, TavernaProv) either **lost the interchange war to schema.org RO-Crate** or **retired the product**. The engines that are actually used (Galaxy, Nextflow, Snakemake, Airflow via OpenLineage) keep a **native record** and, if they project at all, project to RO-Crate or OpenLineage JSON — formats chosen so that *humans and existing registries* can join, not so that a reasoner can.

---

## 2. The abandonment pattern

This is the load-bearing evidence. Projects that *added* an RDF/JSON-LD/PROV projection of plan or workflow state, then removed, froze, or stopped consuming it.

### 2.1 Same community, same authors, newer format: CWLProv → WRROC

**VERIFIED.** CWLProv (PROV-O + BagIt RO) last spec commit **2022-12-20**. GitHub API `pushed_at=2022-12-20T10:54:22Z` on [`common-workflow-language/cwlprov`](https://github.com/common-workflow-language/cwlprov). The 2024 PLOS ONE paper by the same cluster of authors (Soiland-Reyes, Crusoe, Garijo, Leo, …) states CWLProv is supported **only by cwltool**, blames granularity + separate contextual metadata + multiple serialisations, and ships **schema.org JSON-LD** instead, with a SKOS mapping *to* PROV rather than PROV as the wire format. [PLOS ONE 19(9):e0309210](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0309210)

`runcrate convert` exists specifically to **leave CWLProv behind**: CWLProv bags in, WRROC crates out.

**Why (authors' words, not inference):** PROV modelled agent/activity/entity well and everything else poorly; engines would not implement Level-2 granularity; consumers needed authors/licence/citations in the *same* file.

### 2.2 Nextflow `nf-prov` deleted its first-party “legacy” provenance format

**VERIFIED from changelog.**

- 1.4.0 (2025-02-06): add WRROC; **deprecate legacy format**.
- 1.5.0 (2025-09-04): **“Remove legacy provenance format (#48)”**. README: use Nextflow **data lineage** instead.

[CHANGELOG.md](https://github.com/nextflow-io/nf-prov/blob/main/CHANGELOG.md) · [README](https://github.com/nextflow-io/nf-prov)

The replacement is **not** a better RDF mapping. It is a native JSON store (`.lineage/`, `lid://` URIs, `WorkflowRun`/`TaskRun`/`AgentRun`). [docs.seqera.io/nextflow/data-lineage](https://docs.seqera.io/nextflow/data-lineage) (experimental as of 25.04; docs describe `AgentRun` with model/prompt/tools — AgentO’s listed future work, implemented without AgentO).

### 2.3 TavernaProv: the cleanest PROV-O plan-graph exporter, product retired

**VERIFIED.** Apache Taverna retired **2020-02-20**. [incubator.apache.org/projects/taverna.html](https://incubator.apache.org/projects/taverna.html) · [eScience Lab](http://esciencelab.org.uk/announcements/2020/03/12/taverna-retirement/). Wikipedia’s stable description: TavernaProv = W3C PROV-O RDF inside a Research Object ZIP. Engine last release 3.1, **2016-07-01**. `apache/incubator-taverna-engine` archived **2025-07-02** (GitHub API).

Retirement vote was about contributor collapse, not “RDF is bad.” **INFERRED but load-bearing:** a production PROV-O plan projection does not keep a workflow engine alive; when the engine dies, the projection dies with it. No successor engine picked TavernaProv up. Galaxy/Nextflow picked RO-Crate.

### 2.4 Galaxy: third-party PROV-O exporter never became the product; first-party shipped RO-Crate

**VERIFIED.** [`albangaignard/galaxy-PROV`](https://github.com/albangaignard/galaxy-PROV) (2017, 2★) exists to fill “Galaxy cannot export provenance through a standard schema.” Galaxy 23 (2023) shipped RO-Crate + BCO instead. [galaxyproject.org/news/2023-02-23-…](https://galaxyproject.org/news/2023-02-23-structured-data-exports-ro-bco/). The PROV-O tool remains a sidecar.

### 2.5 ProvStore, the public PROV repository, is down

**VERIFIED by fetch 2026-08-26.** [openprovenance.org](https://openprovenance.org/): “**ProvStore is coming back soon.**” The Python `prov` library still advertises it as the extensive user. [pypi.org/project/prov](https://pypi.org/project/prov) (3.1.0, 2026-08-07). A public store for PROV documents not being reachable in 2026 is the opposite of “durable value.”

### 2.6 Wf4Ever / P-Plan / OPMW: EU-project ontologies, unmaintained records

**VERIFIED.** FAIRsharing on P-Plan: “This record is in need of a maintainer.” [FAIRsharing.RlEMBA](https://fairsharing.org/10.25504/FAIRsharing.RlEMBA). Ontology last `dct:modified` in vocab dumps: **2013-05-17**. Wf4Ever RO model superseded by RO-Crate (the RO-Crate related-work sections say so). OPMW remains a WINGS Linked-Data dump.

### 2.7 Drupal: RDF was in *core*, then thrown out because nobody used it

Not workflow provenance, but the most honest “we shipped an RDF projection of our application state” post-mortem in production web software.

**VERIFIED.**

- RDF module deprecated Drupal **9.5**, **removed from core in 10.0.0**. Change record: “previously installed as part of the standard install profile, but **many sites do not use the functionality it provides**. If you are not sure what RDF is, it is likely that you can safely uninstall it.” [drupal.org/node/3307288](https://www.drupal.org/node/3307288) · [core deprecation wiki](https://www.drupal.org/docs/core-modules-and-themes/deprecated-and-obsolete)
- Policy: [#2152459](https://www.drupal.org/project/drupal/issues/2152459) approved moving RDF to contrib; meta [#3273976](https://www.drupal.org/project/drupal/issues/3273976).
- What survived is **schema.org JSON-LD**, not RDF/RDFa: contrib [`json_ld_schema`](https://www.drupal.org/project/json_ld_schema) (“opinionated… schema.org and the JSON LD format”).

**INFERRED:** when a CMS has to pick between RDF-as-graph and JSON-LD-as-SEO-vocabulary, the graph loses. Same fork WRROC took.

### 2.8 Triple-store platforms retired; Wikidata is replacing Blazegraph

**VERIFIED.**

- **Apache Marmotta** (Linked Data Platform; KiWi triple store *on Postgres/MySQL/H2*): Top-Level 2013, **retired November 2020**, Attic April 2021, “vote by the project's committers due to prolonged inactivity.” [attic.apache.org/projects/marmotta.html](https://attic.apache.org/projects/marmotta.html). KiWi *was* “RDF in Postgres.” Apache still killed the product for lack of maintainers.
- Related Attic: Apache **Stanbol** (2020), **Clerezza** (2022), **Any23** (2023). [attic timeline](https://attic.apache.org/timeline.html)
- **Wikidata Query Service:** Blazegraph “ceased development in 2016” (Amazon acquisition). WMF FY26 backend replacement recommends **QLever**, not Postgres, because Blazegraph cannot ingest modern dumps. [Wikidata backend replacement](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/WDQS_backend_update/Backend_Replacement) (current as of 2026-08-11). This is not “we replaced the triple store with Postgres”; it is “the production SPARQL service is on an abandoned engine and the graph is a liability at scale.”

**Did not find (flagged UNCONFIRMED):** a clean public post-mortem of the form “we replaced our *application* triple store with Postgres and deleted the RDF projection” for a *plan/workflow* product. Closest confirmed shapes are Drupal (RDF out of core), Marmotta (RDF platform retired even though it sat on SQL), Nextflow (legacy provenance format deleted in favour of native JSON), CWLProv (frozen, converted away from).

### 2.9 Pattern, stated plainly

| Move | Typical reason given | What replaced it |
| --- | --- | --- |
| PROV-O of a workflow run | Too few engines implement it; context lives elsewhere | schema.org JSON-LD (RO-Crate) |
| First-party “legacy” provenance JSON | Engine grew a native lineage store | Nextflow `.lineage` / OpenLineage events |
| RDF in a CMS | “many sites do not use it” | schema.org JSON-LD |
| Linked Data platform | No committers | Attic; users told to fork |
| Public PROV repository | Operational gap (unexplained on the homepage) | “coming back soon” |

**INFERRED:** RDF projections die when they are nobody’s query API and everybody’s extra serialiser. Durable projections in this space are either (a) the native event store or (b) a JSON-LD profile that an *already-deployed registry* (WorkflowHub, Galaxy, Hugging Face, Google Dataset Search) will ingest. PROV-O/P-Plan is neither.

---

## 3. Where the join actually paid

Amendment I’s justification is the *join* to research-report provenance, evidence spans, ontology packages — not SPARQL over 214 packets. So: when did a cross-graph join actually deliver, and what was the minimum viable join?

### 3.1 RO-Crate: the join is a **directory + one JSON-LD file + a DOI**

**VERIFIED.** WorkflowHub uses Workflow RO-Crate as the **upload/exchange** format. A crate can cite a paper (`schema:citation`), name authors (ORCID), licence the workflow, and (via WRROC) attach a run. [about.workflowhub.eu/Workflow-RO-Crate](https://about.workflowhub.eu/Workflow-RO-Crate/) · [PLOS ONE WRROC](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0309210)

**What made it work:**

1. The join key is a **boring identifier** already in the scholarly graph: DOI, ORCID, checksum, workflow ID. Not `owl:equivalentClass`.
2. Consumers already exist (WorkflowHub, Galaxy, Zenodo, LifeMonitor). You do not stand up a triple store to get the join.
3. Contextual metadata and the run live in **the same JSON-LD document**. That is the exact failure CWLProv documented.
4. PROV is a **mapping**, optional, for people who already have a PROV toolchain.

**Minimum viable join:** `ro-crate-metadata.json` that WorkflowHub will accept, containing `citation` → paper DOI and `hasPart` → the workflow file.

### 3.2 Croissant 1.1: schema.org Dataset JSON-LD, PROV-O as an *overlay*

**VERIFIED.** Croissant is schema.org/`Dataset` JSON-LD for ML datasets. Hugging Face dataset-viewer **auto-generates** Croissant for every Hub dataset. [huggingface.co/docs/dataset-viewer/croissant](https://huggingface.co/docs/dataset-viewer/croissant). Repo [`mlcommons/croissant`](https://github.com/mlcommons/croissant): 890★, last push 2026-07-15.

Croissant **1.1** (announced 2026-02-12) “adopts the W3C PROV-O model for provenance” *on top of* schema.org, as optional `prov:wasDerivedFrom` / `prov:wasGeneratedBy` in the same JSON-LD context. [mlcommons.org/2026/02/croissant-1-1-standard](https://mlcommons.org/2026/02/croissant-1-1-standard) · [spec 1.1](https://docs.mlcommons.org/croissant/docs/croissant-spec-1.1.html)

MLCommons claims “700K datasets now carry Croissant metadata.” Treat the count as **marketing until independently counted**; Hub auto-generation is **VERIFIED**.

**What made it work:** Google Dataset Search already indexes schema.org Dataset. Adding `prov:` predicates did not require a new store. The join is “this dataset was derived from ImageNet” in a file Hugging Face already emits.

**This is the closest successful analogue to Amendment I, and it argues *against* P-Plan/AgentO as the spine.** Croissant did not subclass `pplan:Plan`. It put a few PROV predicates on a vocabulary search engines already eat.

### 3.3 Nanopublications: the join *is* the product (assertion ‖ provenance ‖ publication info)

**VERIFIED.** A nanopub is four (now sometimes five) named RDF graphs: head, assertion, provenance, publication-info (+ knowledge-provenance). Kuhn et al. 2018: **10.8 million** nanopubs / 378M triples analysed as one graph. [IEEE e-Science 2018](https://www.computer.org/csdl/proceedings-article/e-science/2018/915600a083/17D45VUZMZ1) · [guidelines](https://nanopub.net/guidelines/working_draft/)

2025 extension (PROV-K): 197,511 CORE gene-expression–cancer assertions with a fourth graph for multi-source evidence. [doi:10.1007/s00799-025-00431-x](https://link.springer.com/article/10.1007/s00799-025-00431-x) · [Zenodo 18256289](https://zenodo.org/records/18256289)

**What made it work:** every claim is born with its provenance graph; the join is structural, not a later projection. Trusty URIs make the nanopub immutable.

**Mismatch with packets:** packets are Markdown + an event chain. A nanopub-style join would mean minting a citable assertion (with evidence hash) per *claim in a research report*, not projecting 214 packet folds to `pplan:Step`.

### 3.4 ORKG: the join that paid is **comparisons**, and the system of record is Neo4j

**VERIFIED.** Open Research Knowledge Graph ([orkg.org/data](https://www.orkg.org/data)): REST + SPARQL + RDF dump. Production TIB service. 2019 architecture paper: data lives in **Neo4j LPG**, with RDF import/export for SPARQL. [ar5iv 1901.10816](https://ar5iv.labs.arxiv.org/html/1901.10816)

What users actually do: fill a **template** for a paper’s contribution, then build a **Comparison** table across papers. SPARQL is available; the UI comparison is the join that gets cited. 2026 JVSTA paper runs SPARQL over an ORKG comparison of ALD thin films. [pubs.aip.org …/032408](https://pubs.aip.org/avs/jva/article/44/3/032408/3387295)

**What made it work:** a shared *template* (research problem, method, metric), not OWL alignment of workflow ontologies. RDF is an access path. The join key is “these contributions instantiate the same template.”

### 3.5 What did **not** pay, in the same literature

WEST, D-PROV, ProvONE, OPMW, P-Plan, wfprov: the PLOS ONE WRROC related-work section lists them as **one-system-per-model**, not interoperable. That is a published admission that PROV-O extensions of workflow plans did not become a join fabric.

### 3.6 Minimum viable join, for *this* team (INFERRED from the above)

Joins that historically paid share three properties:

1. **A shared identifier that already exists** (DOI of a report, content hash of an evidence file, packet slug, git SHA). Not a newly minted `https://w3id.org/agentic-ai/onto#WorkflowStep`.
2. **One document a deployed consumer already parses** (RO-Crate, Croissant, ORKG template, nanopub). Not a custom JSON-LD context plus `owl:equivalentClass`.
3. **The join is written at claim-creation time**, not reconstructed by projecting planner state.

A PROV-O/P-Plan/AgentO projection of the packet fold provides (1) only if you *also* mint DOIs/ORCIDs/hashes, (2) for no current consumer, (3) after the fact. That is the expensive side of every failed projection in §2.

---

## 4. AgentO status check

Checked live on **2026-08-26**, one day after the 2026-08-25 mapping note.

### 4.1 w3id redirect and ontology file — still revision 0.2

**VERIFIED by curl (insecure TLS to sepses; certificate chain incomplete from this environment, content fetched anyway):**

- `https://w3id.org/agentic-ai/onto` → 302 → `http://sepses.ifs.tuwien.ac.at/onto` → 301 → `https://sepses.ifs.tuwien.ac.at/onto/` (200).
- Turtle: `https://sepses.ifs.tuwien.ac.at/onto/ontology.ttl`, **27,755 bytes**, `Last-Modified: Fri, 05 Dec 2025 03:24:05 GMT`.
- Header of the Turtle, fetched this session:

```turtle
<http://www.w3id.org/agentic-ai/onto> rdf:type owl:Ontology ;
    ...
    owl:versionInfo 0.2 .
```

- Widoco HTML `index-en.html` (5,737 bytes, same Last-Modified): “**Revision: 0.2**”, Authors: Kabul Kurniawan, Contributors: Fajar J. Ekaputra. **Evaluation section is empty** (leftover `-->` in the page text). `evaluation/evaluation-en.html` is **404**. Provenance page is a stub: “Ontology created by: Kabul Kurniawan.”
- JSON-LD serialisation exists (`ontology.jsonld`, 45,952 bytes, same date). No `knowledge-graph.ttl`, `kg.ttl`, `patterns.ttl`, or `examples/` at that host (**404**).

**Has it moved past 0.2 since 2026-08-25?** **No.** File timestamp is December 2025; `owl:versionInfo` is still `0.2`.

### 4.2 Zenodo record doi:10.5281/zenodo.18342624

**VERIFIED by web_fetch.** Concept DOI `10.5281/zenodo.18342624` resolves to version record **18342625**.

- Published **22 January 2026**, **Version v1**.
- Type: Data paper.
- Listed creator on the Zenodo landing page: **KURNIAWAN, KABUL** only (UGM). Paper authors on Springer (Ekelhart, Kurniawan, Ekaputra, Kiesling) are **not** all on the Zenodo record.
- File: `agento.zip`, **7.6 kB**, md5 `c753ef8581fbc9d480c6188f8125e9c3`.
- No v2 / v0.3 visible. Curl of the HTML page returned **403**; JSON API redirected 18342624 → 18342625. Stats (downloads, citations) **UNCONFIRMED** this session (API HTML-redirected, HTML 403).

Springer chapter: Ekelhart et al., ESWC 2026, LNCS 16550 pp. 298–320, first online **08 May 2026**. [link.springer.com/chapter/10.1007/978-3-032-25159-6_16](https://link.springer.com/chapter/10.1007/978-3-032-25159-6_16). Univie record lists the Zenodo DOI as the paper DOI (they reused it). [ucrisportal.univie.ac.at](https://ucrisportal.univie.ac.at/en/publications/agento-an-ontology-for-modeling-agentic-ai-systems/)

### 4.3 Adopters, citations, successor work

**VERIFIED (negative):**

- GitHub repo search `AgentO ontology agentic`: one unrelated hit, [`tamasbartha/AgentOntology`](https://github.com/tamasbartha/AgentOntology) (0★, 2026-05-21) — not this ontology.
- GitHub repo search `sepses agentic`: two **student-class** repos from June 2026 (`Software-Engineering-2026-Class/kelompok4-cyber-kg-agentic`, `…/Sepses-Agentic-AI-cskg-kel-1`), 0★ each.
- Code search for `w3id.org/agentic-ai/onto` via GitHub API: **requires authentication** this session; **UNCONFIRMED** whether any public code imports the IRI besides the authors.
- npm `@ilam/agento-mcp` is a **different product** (Claude Code enforcement MCP). Ignore.

**Citations:** ESWC 2026 paper has been public ~3.5 months. No independent citation count was successfully fetched (Google Scholar snippet tools did not return a count). **UNCONFIRMED.**

**Accompanying KG (66 patterns: AutoGen 6, CrewAI 16, LangGraph 9, Mastra 35):** described in the paper (operator’s 2026-08-25 mapping note). **Not hosted** next to the ontology on sepses. No public growth signal found. **INFERRED:** frozen at the paper’s corpus.

### 4.4 Future work from the paper: execution traces, MCP/A2A

**VERIFIED from the 2026-08-25 mapping note (paper §6), not re-read in full this session:** AgentO “refuses to model runtime flags, function calls, loops, or invocation semantics; execution traces and MCP/A2A alignment are listed as future work.”

**Have they landed in AgentO?** **No** — ontology still 0.2, no new classes in the December 2025 TTL for traces/MCP/A2A (the TTL subclasses `prov:Agent`, `p-plan:Plan`, `p-plan:Step`, BEAM `Resource`/`Context`; no MCP or A2A IRIs).

**Have they landed elsewhere, which is the more important question?**

- **MCP/A2A:** A2A v1.0 stable March 2026; A2A joined AAIF 2026-08-14. [aaif.io/blog/a2a-joins-aaif](https://aaif.io/blog/a2a-joins-aaif). AgentOven, OpenAgents, etc. speak A2A+MCP as **JSON-RPC protocols**, not OWL.
- **Execution traces:** OpenTelemetry GenAI semantic conventions (agent spans, MCP, `execute_tool`) — dedicated repo [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai) (282★). Nextflow lineage `AgentRun` records model, prompt template, tools, skills, output schema. [docs.seqera.io/nextflow/data-lineage#agent-runs](https://docs.seqera.io/nextflow/data-lineage)
- Third-party [`a2a-settlement/otel-agent-provenance`](https://github.com/a2a-settlement/otel-agent-provenance) exists *because* “OTel gen_ai.\* tells you *what* an agent did… not *why you should trust the output*.” That is the provenance gap, filled with OTel attributes, not AgentO.

**INFERRED:** AgentO’s future work is being done by OTel, A2A, MCP, and Nextflow lineage, none of which import AgentO.

### 4.5 Maturity verdict for Amendment I

Revision **0.2**, one listed ontology creator on the artefact, empty evaluation page, 7.6 kB zip, no public KG dump, no independent adopters found, future work not landed *in AgentO*. Mapping *to* it as `owl:equivalentClass` from a 0.2 IRI that has not moved in eight months is a coupling with no counterparty.

---

## 5. Competing shapes (what you would reach for *today*)

If the job is “plan + run provenance in 2026,” these are the live formats. PROV-O column is “what PROV-O has that this lacks / vice versa.”

| Shape | What it actually models | What PROV-O/P-Plan has that it doesn’t | What it has that PROV-O doesn’t | Who uses it (this session) |
| --- | --- | --- | --- | --- |
| **OpenLineage** | Job / Run / Dataset events, START/COMPLETE, facets (schema, SQL, parent run, column lineage). JSON, HTTP. | Agents as first-class `prov:Agent` with roles; plans as `prov:Plan`; qualified relations; OWL reasoning. | Runtime *event stream* with producers/consumers; column-level lineage; warehouse/Airflow/Spark/dbt integrations; Postgres-backed Marquez. | LF AI graduate. [`OpenLineage/OpenLineage`](https://github.com/OpenLineage/OpenLineage) **2,626★**, pushed **2026-08-26**. Datadog 2026 talk: ~40 producers/consumers, “de facto standard for data lineage.” [openlineage.io object model](https://openlineage.io/docs/spec/object-model/) · [Datadog talk](https://www.youtube.com/watch?v=a9S0SoXFXcQ) |
| **OpenTelemetry GenAI semconv** | Spans/metrics/events: `chat`, `invoke_agent`, `execute_tool`, MCP, eval results, tokens, cost. | Derivation/invalidation/bundles; cryptographic-grade provenance; plan templates. | Latency, tokens, errors, parent/child agent topology, vendor backends (Grafana, Langfuse, Honeycomb). MCP conventions. | Status: **Development**. Repo [`semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai) 282★. [opentelemetry.io gen-ai](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/) |
| **in-toto / SLSA** | Signed Statement + Predicate about a **subject digest**. SLSA Provenance predicate: how an *artifact* was built. Layout can name pipeline steps. | Generic Entity/Activity/Agent graph; scholarly citations; plans not tied to a build. | **Signatures (DSSE)**, policy verification, GitHub generator, cosign, admission control. Immutable attestations. | [`in-toto/attestation`](https://github.com/in-toto/attestation) 371★, push 2026-08-24. SLSA v1.2 approved as of Aug 2026 commentary. [slsa.dev FAQ](https://slsa.dev/faq) |
| **CloudEvents / CDEvents** | Envelope: `id`, `source`, `type`, `time`, `subject`, `data`. CDEvents specialises this for CI/CD (pipeline, build, test, ticket). | Any semantic graph; derivation; plans. | Transport bindings (HTTP, Kafka, MQTT, …); CNCF graduation **2024-01-25**; Azure Event Grid first-class. | [`cloudevents/spec`](https://github.com/cloudevents/spec) **5,878★**. [cdevents.dev/docs](https://cdevents.dev/docs/) |
| **Croissant** | schema.org Dataset + file/record layers + optional `prov:` overlay + DUO usage policies. | Workflow *plans* and step graphs. | Dataset search join (Google/HF/Kaggle); loaders in TF/PyTorch. | [`mlcommons/croissant`](https://github.com/mlcommons/croissant) 890★. HF auto-emits. |
| **schema.org Action** (`CreateAction`, `HowToStep`, `ControlAction`, `OrganizeAction`) | Agent / object / instrument / result / startTime / actionStatus. **This is what WRROC uses.** | Qualified PROV relations; bundles; invalidation; OWL constraints. | 10k–100k domains in Google’s July 2026 index; human-readable JSON; Bioschemas workflow types. | [schema.org/Action](https://schema.org/Action) (V30.0, 2026-03-19). Usage stats on that page. |
| **Nextflow lineage** | Native `WorkflowRun` / `TaskRun` / `AgentRun` / `FileOutput` JSON, content-addressed `lid://`. | Interop with anyone who isn’t Nextflow. | Model/prompt/tools on agent runs; `lineage diff` of two task hashes; `fromLineage` channel. | Experimental 25.04+. [docs](https://docs.seqera.io/nextflow/data-lineage) |
| **RO-Crate / WRROC** | Packaging + schema.org JSON-LD of process/workflow/provenance runs. | Fine-grained PROV constraints; SPARQL-native. | Packaging, citations, re-execution (`runcrate run`), WorkflowHub. | See §1.2. |
| **PROV-O + P-Plan** | Entity / Activity / Agent / Plan / Step / Variable; `correspondsToStep`. | — | Qualified usage/generation; invalidation; bundles; OWL. | Libraries (`trungdong/prov` 138★, ProvToolbox 82★). **No live plan-control product.** |

**INFERRED ranking for *this* team’s actual jobs:**

- Gate/run *receipts* that a verifier can check: **in-toto/SLSA** (or the existing packet event chain with hashes). PROV-O does not sign.
- “What ran, with which model, which tools, how long”: **OTel GenAI** + the event chain. AgentO does not model this (paper future work).
- Join a packet to a paper/dataset: **RO-Crate or a Croissant-shaped schema.org JSON-LD**, identifiers first.
- Data-pipeline lineage if they ever grow a warehouse: **OpenLineage**.
- Internal fold query over 214 packets: **the event chain + JSON**, as D8 already says.

PROV-O still wins at *vocabulary completeness* for “who influenced what, with a plan, across invalidation.” That completeness has not been the reason anything in §1 shipped.

---

## 6. X / Twitter sweep

Searched 2026-08-26 via X keyword + semantic search. Honest finding first: **there is almost no practitioner conversation about PROV-O or RDF projections of engineering/plan metadata.** Hits for `RDF` are Refuse-Derived Fuel and SEO. That absence is itself evidence.

### 6.1 Dated posts with engagement (VERIFIED URLs)

**Dismissive / “this does not pay”**

- **Glenn Gabe (@glenngabe), 2026-05-11.** Ahrefs study: 1,885 pages added JSON-LD schema Aug 2025–Mar 2026; AI citations barely moved vs 4,000 controls. **212 likes, 41 reposts, 15 quotes, 160 bookmarks, 32,690 views.** [x.com/glenngabe/status/2053883924980326821](https://x.com/glenngabe/status/2053883924980326821) — closest large-N result on “JSON-LD projection → join with an external graph (AI Overviews/ChatGPT).” The join did not show up in citations.
- **Natasha Malpani (@natashamalpani), 2025-08-24.** Agents collapse in production; “people are throwing everything at the problem: scratchpads, tree logs, **bolted-on knowledge graphs. most of it is duct tape.**” Knowledge graphs “outside big tech… never broke through given they were too expensive to build, too hard to keep fresh.” **402 likes, 33 reposts, 9 quotes, 396 bookmarks, 45,696 views.** [x.com/natashamalpani/status/1959517257350197447](https://x.com/natashamalpani/status/1959517257350197447)
- **Dan Brickley (@danbri), 2021-11-19** (schema.org co-founder, still the relevant practitioner voice): “at Google we don't generally call it ‘semantic web’, at this point the phrase isn't helpful. But ideas and specs from the RDF are plenty relevant (rdfa, json-ld, …).” **1 like, 1 repost.** Same thread: “Semantic Web was a fancy sounding name we had to rebrand RDF into, because tech industry was XML obsessed and RDF had a bad aura. The name might be extinct but the core ideas quietly got some traction.” [x.com/danbri/status/1461696024997765124](https://x.com/danbri/status/1461696024997765124) · [x.com/danbri/status/1461705862905573377](https://x.com/danbri/status/1461705862905573377)
- **Dan Brickley, 2024-03-27:** “The scientific American SW article was not a definition or a spec, more an attempt at marketing. … Semantic Web was a project to improve the Web. We did that already.” **0 likes, 91 views.** [x.com/danbri/status/1773042388748931440](https://x.com/danbri/status/1773042388748931440)
- **Bart Hanssens (@BartHanssens), 2026-01-28:** “XML is widely used, so is JSON, YAML got some attention, now TOON… and for the knowledge graph peeps there's RDF/XML, JSON-LD, Turtle… **standards are great, so many to choose from**.” **1 like, 141 views.** [x.com/BartHanssens/status/2016534719286948010](https://x.com/BartHanssens/status/2016534719286948010)
- **Shea (@sheacurran), 2026-04-20:** “Anyone can put anything in schema.org, llms.txt, or a JSON-LD block, and AI ingests it. **No cryptographic binding between claim and entity.** So — genuine question — is this the next frontier, or a solution in search of a problem?” **1 like, 17 views.** [x.com/sheacurran/status/2046293265948057635](https://x.com/sheacurran/status/2046293265948057635) — this is the SLSA-shaped objection to “just emit JSON-LD.”

**Pro-graph, but not PROV-O of plans**

- **Giedrius Trump (@Trumpyla), 2026-08-03.** Long manifesto: RDF + SKOS + OWL + SHACL + JSON-LD + **PROV-O** as a “versioned semantic treaty between agents.” Quote-tweet **24,531 views / 3 likes**; original part 2 **39,233 views / 6 likes**. [x.com/Trumpyla/status/2084290381261193582](https://x.com/Trumpyla/status/2084290381261193582) — high views, almost no endorsement. Reads as a design essay, not a deployment report. He himself writes “The efficiency claim also remains a hypothesis. Dumping an ontology into every prompt may cost more tokens than it saves.”
- **Kingsley Uyi Idehen (@kidehen), 2026-04-16.** Demo: “AI Agent readable knowledge graph using JSON-LD and terms from schema.org.” **0 likes, 815 views.** [x.com/kidehen/status/2044917769389388155](https://x.com/kidehen/status/2044917769389388155) — OpenLink/Virtuoso founder; the RDF-vendor voice. Low engagement.
- **Nolan Nichols (@bnolannichols), 2026-07-11.** schema.org JSON-LD/YAML-LD + LinkML as “Linked Open Knowledge Format.” **0 likes, 818 views.** [x.com/bnolannichols/status/2075961645650895177](https://x.com/bnolannichols/status/2075961645650895177)
- **Aloysius Dominic (@AloysiusDomini2), 2026-08-25.** Student/indie “Developer Project Intelligence” turning GitHub activity into a knowledge graph. **7 likes, 67 views.** [x.com/AloysiusDomini2/status/2092305217689968643](https://x.com/AloysiusDomini2/status/2092305217689968643)

**What *is* the 2026 graph conversation (not RDF)**

- **Smart Tech Flow (@TechFlow99), 2026-05-06.** “Graphify” / Karpathy LLM knowledge bases: folder → Obsidian vault, “no vector database.” **981 likes, 108 reposts, 1,981 bookmarks, 90,818 views.** [x.com/TechFlow99/status/2051998109547614700](https://x.com/TechFlow99/status/2051998109547614700) — this is the popular “knowledge graph” in 2026 and it is **not triples**.
- **leopardracer (@leopardracer), 2026-07-23.** Anthropic engineer graph of agents (Task → Researcher → Planner → …). **428 likes, 54,510 views.** [x.com/leopardracer/status/2080399365504475501](https://x.com/leopardracer/status/2080399365504475501) — LangGraph-shaped, not OWL.
- **max.berlin (@maxjendrall), 2026-08-26.** “increasingly hate seeing the n8n/retool style node based graph.” **1 like, 108 views.** [x.com/maxjendrall/status/2092654976904380790](https://x.com/maxjendrall/status/2092654976904380790)

**PROV-O specifically:** keyword search for `PROV-O` / `W3C PROV` / `triple store` + abandoned/postgres returned **noise** (IndexedDB “triple store”, a joke “took me a month to move from postgres to triple store,” 2 likes). No practitioner thread about emitting PROV-O from CI or planners.

### 6.2 Sentiment, without spinning it

- **schema.org JSON-LD** is a live SEO/AEO argument, and the best 2026 measurement (Ahrefs via Gabe) says **adding it did not move AI citations**.
- **Knowledge graphs** are a live agent-memory argument. The high-engagement take is Malpani’s: bolted-on KGs are duct tape; the expensive/freshness problem is why they failed outside big tech; hybrid retrieval might now work. That is *not* an argument for OWL projections of planner state.
- **RDF/OWL/PROV-O** is a specialist/vendor/manifesto register (Idehen, Trumpyla) with views that do not convert to likes.
- **Dan Brickley**, the person who would know, treats “Semantic Web” as a retired brand and JSON-LD/RDFa as the residue that mattered.
- Nobody on X is asking for a PROV-O/P-Plan projection of their project packets.

---

## Verdict

**Gate it on proving one concrete join first. Do not build the PROV-O/P-Plan/AgentO JSON-LD projection now. Do not “skip” identifiers, hashes, and a consumer-shaped export forever — skip *this vocabulary spine*.**

The default hypothesis — “projecting plan/workflow state to PROV-O/P-Plan JSON-LD delivers durable value” — is **refuted** by the people who tried it.

### Single strongest argument to skip / defer the projection

CWLProv *was* Amendment I: a derived, content-addressed Research Object of a workflow run, PROV-O (and JSON-LD) included, native files remaining authoritative. The authors later wrote that it was adopted by **one engine**, then they replaced the interchange with schema.org JSON-LD because PROV did not carry the join (authors, licence, paper, files) in one document and other engines would not emit it. TavernaProv did the same job and the product retired. Nextflow deleted its first-party legacy provenance format in 2025 and told users to use a **native JSON lineage store**. P-Plan has needed a FAIRsharing maintainer for years. AgentO is still `owl:versionInfo 0.2` with an empty evaluation page and no public KG dump. There is no consumer that will SPARQL this team’s 214 packets against research reports *because of* `pplan:Step`.

### Single strongest argument to do *something* in this neighbourhood

The joins that paid (WorkflowHub ↔ papers, Croissant ↔ Dataset Search/Hugging Face, nanopubs ↔ claims, ORKG comparisons) all used **one JSON-LD-ish document plus boring identifiers** (DOI, ORCID, checksum). Croissant 1.1 even shows the surviving PROV pattern: a few `prov:wasDerivedFrom` / `prov:wasGeneratedBy` predicates **on a schema.org document a search engine already eats**, not a P-Plan TBox. If this team ever has a *named consumer* — e.g. “emit a Workflow-Run-Crate-shaped file so a research report can `citation` the packet run that produced it” — a **read-only schema.org/RO-Crate projection of the fold**, with packet slug + content hashes + report DOIs, is the version of Amendment I that has a track record. AgentO `owl:equivalentClass` links are optional annotations on that document, not the reason to exist.

### What “proving one concrete join” means here (INFERRED, operational)

Pick **one** downstream artefact that already exists (a research-report Markdown file, an evidence span, an ontology package). Give it a stable ID. Put the packet ID, the git SHA, and the evidence hash in that artefact *and* in one export file a third-party tool already parses (RO-Crate `ro-crate-metadata.json` is the evidenced choice; Croissant if the artefact is a dataset). Query that join without a triple store (`jq`, WorkflowHub, Zenodo). If that join is used twice in anger, *then* spend time on a JSON-LD `@context`. If it is not, the event chain already is the provenance graph.

### What not to bind to

- AgentO IRIs as the projection’s primary types (0.2, no adopters, no traces).
- P-Plan as the plan vocabulary of record (unmaintained; WRROC used `HowToStep` instead).
- A SPARQL endpoint over packets as the success metric (D8 already forbids the graph as SoR; 214 rows do not need it).

### Method caveats

- Firecrawl MCP was rate-limited; fetches used `web_fetch`, `web_search`, `curl -k` to sepses, GitHub API, X search.
- sepses TLS certificate did not verify from this environment; Turtle content and `Last-Modified` still retrieved.
- Zenodo HTML 403 via curl; landing page retrieved via `web_fetch`. Download/citation stats **UNCONFIRMED**.
- GitHub code search for AgentO IRIs **UNCONFIRMED** (API auth).
- Croissant “700K datasets” is a vendor claim.
- X engagement numbers are as returned by the search API on 2026-08-26.

---



