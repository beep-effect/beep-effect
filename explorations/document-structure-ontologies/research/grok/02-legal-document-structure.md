# Legal & Patent Document Structure Standards — Survey for beep-effect

**Lane:** Grok sweep 02 — legal/patent document structure
**Packet:** `explorations/document-structure-ontologies`
**Date:** 2026-08-11
**Audience:** agents and designers wiring ontology-aided drafting + retrieval over `@beep/md` (canonical markdown AST), `@beep/pandoc-ast`, `@beep/lexical-schema`, `@beep/rdf`, `@beep/ontology`
**Scope:** segment-level typing (claims, abstract, background, office-action parts), drafting idioms/rules, licenses, and fit for a professional-desktop patent/OA drafting agent stack

---

## 1. Executive summary

This lane surveys **legal and patent document structure standards and ontologies** that could sit *above* beep-effect’s recursive Inline/Block AST family (DoCO/PO/DEO were already assessed elsewhere in the packet). The central question is not “which XML dialect should replace Markdown,” but:

> Which artefacts give **stable segment types** and **drafting constraints** that can be layered as annotations / named sections / SHACL-like rules over a markdown-canonical AST, while remaining honest about patent-office exchange formats?

### Verdict in one paragraph

For **US/EPO-style patent application drafting and OA responses**, the highest-leverage sources are **not** parliamentary LegalDocML stacks, but (1) **USPTO structural law + guidance** (37 CFR 1.77 / MPEP §608, claim formalities), (2) **WIPO ST.96 / legacy ST.36 + USPTO bulk DTDs** as interchange segment vocabularies (claims, abstract, description, bibliographic), and (3) a **small, home-grown patent-document role ontology** that reuses those segment names and claim-graph relations. **Akoma Ntoso / LegalDocML** is excellent for hierarchical legal *texts* (acts, judgments, amendments) and for *drafting-rule encoding patterns* (Schematron on structure), but it is a poor direct model of patent claims. **LegalRuleML**, **LKIF**, and **FLINT** encode *norms and deontic structure*, not patent document layout—useful for rule-checking idioms, not for section typing of a specification. **ELI/ECLI** are citation/identifier + metadata ontologies, not body segment taxonomies. Academic patent KGs (e.g. ESWC 2023 challenges paper, engineering patent-KGs) confirm the section model (title/abstract/claims/description) but do **not** ship a reusable open ontology of patent *document structure* ready to vendor.

### Ranked shortlist (fit for beep-effect professional-desktop)

| Rank | Artefact | Primary value | Segment typing | Drafting rules | License posture (verify before vendor) |
| ---: | --- | --- | --- | --- | --- |
| 1 | **USPTO 37 CFR 1.77 + MPEP §608** (+ claim-drafting materials) | Canonical US application section order + claim formalities | **Excellent** (Background, Summary, Detailed Description, Claims, Abstract, …) | **Excellent** (idioms, formality, enablement language) | US federal works / public domain for official text; treat as normative sources |
| 2 | **WIPO ST.96** (+ ST.36 legacy) | Interoperable patent/IP XML segment & data dictionary | **Excellent** at interchange grain (claims, abstract, description, bib) | Weak as prose rules; strong as structural schema constraints | WIPO standards documents freely published; implementers’ reuse of XSDs is standard industry practice—confirm any office-specific license on derived schemas |
| 3 | **USPTO patent application/grant DTDs** (bulk XML) | Concrete US segment elements already in the wild | **Excellent** for published applications/grants | Limited (schema, not practice guide) | USPTO data/DTDs as government-published technical artefacts |
| 4 | **Claim structure model** (preamble / transition / body; independent/dependent) | Graph over claims for agents | **Excellent** at claim substructure | **Excellent** (EPO Guidelines F-IV; USPTO claim drafting) | Guidance documents public; model is descriptive, not a single licensed ontology |
| 5 | **Akoma Ntoso / OASIS LegalDocML** | Hierarchical legal docs + reference model + Schematron drafting patterns | Strong for legislation/judgments; **weak for patents** | Strong patterns (numbered hierarchy, amendments); not patent idioms | OASIS Standard; free to implement under OASIS IPR Policy (RF-oriented TC); copyrighted text |
| 6 | **ELI (+ ELI-DL) ontology** | Legislation identifiers + FRBR-ish metadata | Weak for body segments; strong for resource identity | Weak | EU Publications Office vocabularies; public-sector reuse |
| 7 | **LegalRuleML** | Normative rules, deontics, interpretations | N/A for patent sections | Strong for *encoding* legal norms as rules | OASIS Standard 2021; same OASIS posture |
| 8 | **FLINT / LKIF-Core** | Act/fact frames; legal core concepts | N/A | Moderate (norm frames, not doc layout) | FLINT Apache-2.0 (+ MPL SHACL); LKIF research ontology (check repo LICENSE) |
| 9 | **MetaLex / LexML** | National/legislative interchange history | Moderate (legislation) | Moderate | CEN workshop / national projects—license varies |
| 10 | **Academic patent KGs / ontologies** | Confirms section model + claim extraction research | Partial / ad hoc | Rarely drafting idioms | Paper-dependent (often CC / all-rights-reserved PDFs) |

**Bottom line for beep-effect:** treat **MPEP/CFR + claim structure** as the *semantic* source of truth for patent *roles*, **ST.96/USPTO DTD element names** as the *interchange vocabulary*, **DoCO/DEO** (prior lane) as the *generic rhetorical* layer, and **AKN/LegalRuleML** as *pattern libraries* for hierarchical legal text and rule markup—not as the primary patent document ontology.

---

## 2. Assessment criteria (how candidates were scored)

Each artefact was scored against beep-effect’s stated use case: agents in `apps/professional-desktop` drafting **patent applications** and **office-action responses**, with ontology-aided retrieval and AST/structure rules.

| Criterion | Question |
| --- | --- |
| **C1 Segment typing** | Does it name document parts at a grain that can annotate `@beep/md` blocks/headings (claim, abstract, background, rejection grounds, …)? |
| **C2 Claim / normative substructure** | Independent/dependent claims, preamble/transition/body, citation to prior claims, or analogous normative structure? |
| **C3 Drafting idioms & rules** | Does it encode *how* to write (formality, order, single-sentence claims, enablement), not only *where* text sits? |
| **C4 Interchange realism** | Used by USPTO/EPO/WIPO or national offices for real filing/publication data? |
| **C5 Ontology/RDF friendliness** | OWL/RDFS/JSON-LD/TTL available, or only DTD/XSD? |
| **C6 Layerability over markdown AST** | Can it be a *role annotation layer* without forcing XML-as-source-of-truth? |
| **C7 License / vendorability** | Clear enough for a public monorepo (`@beep/*`) to reference, port, or generate from? |
| **C8 OA / prosecution fit** | Covers office actions, responses, amendments—not only issued patents? |

Scores in later tables use: **H** high / **M** medium / **L** low / **—** not applicable.

---

## 3. Landscape map

```
                    ┌─────────────────────────────────────┐
                    │  Norms / deontics / rules           │
                    │  LegalRuleML · LKIF · FLINT         │
                    └──────────────────▲──────────────────┘
                                       │ optional rule layer
┌──────────────────────┐    ┌──────────┴───────────┐    ┌────────────────────────┐
│ Legislative /        │    │ Document structure   │    │ Patent interchange     │
│ judicial XML         │    │ (segment roles)      │    │ ST.96 · ST.36 · DTDs    │
│ AKN / LegalDocML     │◄──►│ MPEP 1.77 · claims   │◄──►│ EPO OPS bulk           │
│ MetaLex · LexML      │    │ DoCO/DEO (generic)   │    │ CIPO ST.96 dumps       │
└──────────────────────┘    └──────────┬───────────┘    └────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │ Identifiers / citation metadata     │
                    │ ELI · ECLI · FRBR-style work/expr   │
                    └─────────────────────────────────────┘

beep-effect spine:  @beep/md AST  →  role annotations (patent segments)
                  →  @beep/rdf vocabs  →  taxonomy loader (TTL/JSON-LD)
                  →  agents (retrieval + structure rules)
```

**Important separation:** parliamentary/judicial standards optimize for *provisions, articles, recitals, judgments*. Patent applications optimize for *disclosure + claims as legal fences*. Forcing patents into AKN hierarchicalStructure is a category error; mapping *claims* to article-like containers loses claim-dependency semantics.

---

## 4. Akoma Ntoso / OASIS LegalDocML

### 4.1 What it is

**Akoma Ntoso** (“Architecture for Knowledge-Oriented Management of African Normative Texts using Open Standards and Ontologies”) is an XML vocabulary for **parliamentary, legislative, and judicial** documents. It became **OASIS Standard** under the LegalDocML TC as **Akoma Ntoso Version 1.0** (approved **29 Aug 2018**).

- Landing / standard page: https://www.oasis-open.org/standard/akn-v1-0/
- Vocabulary (Part 1): https://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part1-vocabulary/akn-core-v1.0-os-part1-vocabulary.html
  (also linked from the OASIS standard page)
- XML schemas distribution: http://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part2-specs/schemas/
- Full ZIP: http://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/akn-core-v1.0-os.zip
- OASIS open repository (schemas/examples): https://github.com/oasis-open/legaldocml-akomantoso
- Overview article (Wikipedia): https://en.wikipedia.org/wiki/Akoma_Ntoso
- Design narrative (Balisage): https://www.balisage.net/Proceedings/vol24/html/Palmirani01/BalisageVol24-Palmirani01.html
- UN HLCM overview of document types: https://unsceb-hlcm.github.io/part1/index-13.html

### 4.2 Document types and shared structure

The vocabulary explicitly targets bills, acts, debates, judgments, amendments, gazettes, and residual `<doc>` types—not patent applications. The OASIS vocabulary text states support for parliamentary/committee records, legislation life-cycle, and judgments, and that **all document types share basic structures** with metadata, addressing, and references.

Document-structure families commonly cited in AKN materials include:

| Structure family | Example roots | Intent |
| --- | --- | --- |
| Hierarchical | `<bill>`, `<act>` | Normative text in chapters/sections/articles/clauses |
| Debate | `<debate>` | Transcript structure (speakers, Q&A) |
| Judgment | `<judgment>` | Court decision narrative parts |
| Amendment | `<amendment>` | Formal modification instructions |
| Collection | `<officialGazette>`, `<documentCollection>`, … | Compilations |
| Open / residual | `<doc>`, debate reports | Catch-all |

AKN’s hierarchical vocabulary includes familiar legal segment names: **preamble, section, paragraph, clause, article, chapter, part**, plus metadata blocks (identification, FRBR-style work/expression/manifestation/item thinking appears in the vocabulary’s referencing model). See the vocabulary’s discussions of hierarchy, document types, and references:
https://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part1-vocabulary/akn-core-v1.0-os-part1-vocabulary.html

### 4.3 Drafting rules / idioms

AKN is stronger on **structural validity** than on “how a patent attorney writes.” Notable drafting-adjacent features:

1. **Hierarchy + numbering discipline** — documents can encode that articles/paragraphs are sequential and nested; the vocabulary discusses expert markup of organizational functions (articles, chapters, sections).
2. **Schematron embedded in XSD appinfo** — the vocabulary shows patterns asserting e.g. that `heading` must be first child of `article` and `num` second (see the vocabulary’s Schematron example around article structure). This is a **directly transferable pattern** for beep-effect: structure rules as separate validators over annotated AST, not as hand-written if-ladders.
3. **Neutral vs semantic containers** — discussion of enclosing text in neutral `<paragraph>` vs semantic `<article>` maps cleanly to “markdown heading + role annotation.”
4. **Amendments as first-class** — useful analog for claim amendments / mark-up in prosecution, though the AKN amendment model is legislative, not USPTO claim amendment practice.

### 4.4 Segment typing vs patent needs

| Patent need | AKN analog | Fit |
| --- | --- | --- |
| Claims (independent/dependent) | articles/clauses? | **Poor** — dependency graph & claim categories missing |
| Abstract | ? (not patent abstract) | **Poor** |
| Background / detailed description | hierarchical sections | **Partial** as generic sections only |
| Office action | judgment-like? | **Stretch** — wrong domain model |
| Cross-cites to statutes | AKN references | **Strong** if drafting cites legislation |

### 4.5 License / reuse

- Spec text: **Copyright © OASIS Open**; free to copy for development/implementation with notices; not free to modify the OASIS document itself outside TC process (standard OASIS copyright block in the vocabulary HTML).
- IPR: LegalDocML TC IPR page https://www.oasis-open.org/committees/legaldocml/ipr.php ; OASIS IPR Policy overview https://www.oasis-open.org/policies-guidelines/ipr/
- Open repository examples: https://github.com/oasis-open/legaldocml-akomantoso (see repo for license files; schemas track the OASIS release).
- Third-party libs (illustrative only): Apache-2.0 claimed for https://github.com/bungenix/akomantoso-lib ; AGPL for https://github.com/Sinar/go-akomantoso — **do not confuse library licenses with the standard’s IPR**.

### 4.6 Scores

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M (legal) / L (patent) | L | M–H patterns | H (legislatures/courts) | M (XML+metadata ontology) | H as annotation inspiration | M (OASIS) | L |

**Beep-effect use:** study **pattern** (hierarchical roles + Schematron + FRBR-ish citation), do **not** adopt AKN as patent document schema. Optional later: AKN export for *legislative* work products if professional-desktop expands beyond IP.

---

## 5. LegalRuleML (OASIS)

### 5.1 What it is

**LegalRuleML Core Specification Version 1.0** is an **OASIS Standard** (publication series 2021; OS HTML: https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html ; latest stage: https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/legalruleml-core-spec-v1.0.html).

- OASIS standard page: https://www.oasis-open.org/standard/legalruleml-core-specification-version-1-0-oasis-standard/
- Announcement: https://www.oasis-open.org/2021/09/08/legalruleml-core-specification-v1-0-oasis-standard-published/
- TC home: https://www.oasis-open.org/committees/legalruleml/
- GitHub TC materials: https://github.com/oasis-tcs/legalruleml
- Artefacts include **XSD, RelaxNG, XSLT, RDFS metamodel, diagrams, examples** under the OS tree (linked from the TC/standard pages), e.g. RDFS: https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/rdfs/

**Stated objective** (from the core spec front matter): extend RuleML with formal features specific to **legal norms, guidelines, policies and reasoning**, representing particularities of legal normative rules.

### 5.2 Segment typing?

**No.** LegalRuleML models *rules* (obligations, permissions, prohibitions, defeasibility, jurisdiction, temporal applicability, sources, interpretations)—not patent application section layout. It can *point at* source fragments but does not define `claim` / `background` document roles.

### 5.3 Drafting rules / idioms?

**Indirectly strong.** If beep-effect wants agents to enforce things like:

- “dependent claim must further limit referenced claim”
- “response must traverse each rejection ground”
- “do not introduce new matter”

…LegalRuleML (or a simpler internal Effect Schema rule model inspired by it) is the right *family* of formalisms. Full LegalRuleML adoption is heavy; the metamodel and examples are the teaching artefact.

Related: EU “reporting obligations” specialization PDF on Interoperable Europe:
https://interoperable-europe.ec.europa.eu/sites/default/files/news/2024-07/A%20LegalRuleML%20specialisation.pdf

### 5.4 License

OASIS Standard copyright + TC IPR: https://www.oasis-open.org/committees/legalruleml/ipr.php

### 5.5 Scores

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | M (norm structure) | H (norms) | M | H (RDFS) | M | M | M (as response logic) |

**Beep-effect use:** **do not** load LegalRuleML as patent document taxonomy. **Do** keep it on the shortlist for a later “normative rule IR” if agents need formal compliance checking beyond AST shape rules.

---

## 6. ELI and ECLI

### 6.1 ELI — European Legislation Identifier

**ELI** is a system of **HTTP URIs + ontology/metadata + embedding recommendations** for legislation, invited by EU Council conclusions and operated with Publications Office vocabularies.

- What is ELI?: https://eur-lex.europa.eu/eli-register/what_is_eli.html
  (also register background: https://eur-lex.europa.eu/eli-register/background.html)
- ELI Ontology dataset (EU Vocabularies): https://op.europa.eu/en/web/eu-vocabularies/model/-/resource/dataset/eli
  (dataset resource form also: https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http://publications.europa.eu/resource/dataset/eli)
- Wikipedia synthesis of pillars: https://en.wikipedia.org/wiki/European_Legislation_Identifier
- Council conclusions (2012 invitation): https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52012XG1026(01)
- Council conclusions (2017): https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52017XG1222(02)

**Pillars** (as summarized on the Wikipedia ELI page, citing the Council framework):

1. **URI template** components for jurisdiction/type/year/…/language
2. **ELI ontology / metadata** describing legislation (FRBRoo/CIDOC-CRM influenced common data model)
3. **Embedding** metadata in websites (RDFa / JSON-LD)
4. **Sync protocol** (e.g. Atom feeds of resources / updates)

**ELI-DL** (draft legislation):
https://joinup.ec.europa.eu/collection/eli-european-legislation-identifier/solution/eli-ontology-draft-legislation-eli-dl/about

**ELI/XML** and validator tooling are described on the Wikipedia page and EU Vocabulary sites (metadata-in-header patterns, not full body markup of every paragraph).

### 6.2 ECLI — European Case Law Identifier

**ECLI** standardizes **case-law identifiers** across EU jurisdictions so judgments can be cited uniformly.

- e-Justice portal: https://e-justice.europa.eu/topics/registers-business-insolvency-land/european-case-law-identifier-ecli_en

ECLI is an **identifier + metadata** convention, not a document body ontology. Relevant when beep-effect agents cite EU case law; irrelevant for patent claim trees.

### 6.3 Segment typing / drafting

| Need | ELI/ECLI |
| --- | --- |
| Patent abstract/claims/background | **No** |
| Legislation subdivision in URI (`/level 1…/`) | Partial (identification of subdivisions, not a full AST) |
| Drafting idioms | **No** |
| Cross-jurisdiction citation | **Yes** |

### 6.4 Scores

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L | — | L | H (EU legislation) | H | H (metadata side-car) | H (public vocab) | L |

**Beep-effect use:** optional **citation/metadata** vocabulary if the product cites EU legislation; not a patent structure ontology. Aligns with existing `@beep/rdf` DCTERMS/SKOS habits more than with Md AST constructors.

---

## 7. MetaLex, LexML, and national legal XML

### 7.1 CEN MetaLex

**CEN MetaLex** (Open XML interchange format for legal documents) is a European workshop/standardization effort for legal document interchange, historically influential and often discussed alongside AKN.

- Interoperable Europe catalogue entry: https://interoperable-europe.ec.europa.eu/collection/eu-semantic-interoperability-catalogue/solution/cen-metalex
- CEN workshop catalogue pointer: https://standards.iteh.ai/catalog/tc/cen/6fd2a7d3-e514-4eaa-a07c-02524434b59a/cen-ws-mlx
- Academic lineage (MetaLex + LKIF): Semantic Scholar record https://www.semanticscholar.org/paper/MetaLex-XML-and-the-Legal-Knowledge-Interchange-Boer-Winkels/46c59252d905d0e517707b98e7af166350e89449
- Cornell VoxPopuLII tag: https://blog.law.cornell.edu/voxpop/tag/cen-metalex/

**Assessment:** historically important bridge between legislative XML and knowledge interchange; for beep-effect 2026, **AKN supersedes MetaLex as the practical open legislative vocabulary** in most new deployments. Keep as citation in the research ledger, not as primary implementation target.

### 7.2 LexML (Brazil and family)

**LexML** is a civil-law multi-country initiative; **LexML Brasil** is the active national implementation network for legislative/legal information using XML + HTTP protocols.

- LexML (general): https://en.wikipedia.org/wiki/LexML
- LexML Brasil: https://en.wikipedia.org/wiki/LexML_Brasil
- Project history (VoxPopuLII): https://blog.law.cornell.edu/voxpop/2010/10/15/lexml-brazil-project/
- Comparative commentary with AKN: https://www.popvox.org/blog/when-law-becomes-data

**Assessment:** valuable proof that national legal XML can scale; **not patent-specific**. Only prioritize if beep-effect expands to Brazilian legislative corpus work.

---

## 8. LKIF-Core and FLINT (normative conceptual layers)

### 8.1 LKIF-Core

The **Legal Knowledge Interchange Format** (Estrella project) includes **LKIF-Core**, an OWL-DL (+ SWRL) ontology of basic legal concepts (action, role, norm layers).

- Paper (CEUR): https://ceur-ws.org/Vol-321/paper3.pdf
- GitHub: https://github.com/RinkeHoekstra/lkif-core
- Wikipedia: https://en.wikipedia.org/wiki/Legal_Knowledge_Interchange_Format
- ASU pure record: https://asu.elsevierpure.com/en/publications/the-lkif-core-ontology-of-basic-legal-concepts/

**Fit:** conceptual legal core (norms, acts, agents)—**not** patent document sections. May inform a future “legal concept” vocab in `@beep/rdf` if modeling obligations in contracts/regulations; **orthogonal** to claim trees.

**License:** check the GitHub `LICENSE` before vendoring TTL; treat as research ontology until verified.

### 8.2 FLINT (local clone already present)

**FLINT** (TNO / Normative Systems) models **Acts, Facts, frames/slots** for normative interpretation—closer to “what an agent may do if preconditions hold” than to “Background of the Invention.”

- Local clone noted in packet context: `~/Downloads/ontologies/flint-ontology`
- Upstream-style docs referenced in README: https://normativesystems.gitlab.io/knowledge-modeling/flint-ontology/
- **License:** Apache License 2.0 for main sources; SHACL profiles under MPL 2.0 (per local README “Licensing” section)

**Fit:** potential **rule/act frame** layer for office-action response *strategies* (e.g. act = “traverse rejection under §103”), not for patent section typing. Complements LegalRuleML at a different abstraction.

---

## 9. Patent interchange: WIPO ST.36 and ST.96

This is the **center of gravity** for patent *document structure* as offices actually exchange it.

### 9.1 WIPO ST.36 — Processing of patent information using XML (legacy DTD era)

- Standard PDF (ST.36): https://www.wipo.int/documents/d/standards/docs-en-03-36-01.pdf
- Standards index / references: https://www.wipo.int/en/web/standards/part_03_st_ref
- Standards list entry context: https://www.wipo.int/en/web/standards/part_03_standards
- Implementation notes wiki (office usage): https://confluence.wipo.int/confluence/spaces/usestandards/pages/79888861/WIPO+Standard+ST.36+Processing+of+patent+information+using+XML
- Related Canadian ST.36 data product (historical/parallel): https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/patent-data-bibliographic-and-full-text-xml

**What ST.36 is:** a WIPO recommendation defining **DTDs, content models, international common elements (ICEs), naming conventions**, and a **model DTD for patent publications** (Annex A `xx-patent-document.dtd`), plus office-specific extension rules. It targets filing, processing, publishing, and exchange of bibliographic data, abstracts, and full text (see PDF introduction/scope).

**Document / business process DTDs** (illustrative table in the standard) cover filing, publishing, prosecution, grant, post-grant, etc.—i.e. **broader than issued patents only**.

**Segment-level signals visible in the standard text:**

- International common elements and model DTD for publications
- Explicit discussion of **claims numbering**, `claim-ref` / `id` / `idref` patterns for cross-references inside documents
- Elements such as **invention-title**, **priority-claims**, and application-body style content (with HTML-derived `p` etc.)
- Industry DTDs incorporated by reference (e.g. MathML, table models)

**Drafting rules?** Mostly **schema conventions** (naming, attributes, id discipline), not “write the background this way.”

**Status:** still relevant for **legacy bulk data** and transformation; **ST.96 is the modern successor** for new design (ST.96 explicitly addresses convertibility with ST.36).

### 9.2 WIPO ST.96 — IP information using XML Schema (current)

- Main recommendation PDF (revision noted in scrape as approved by CWS XML4IP Task Force; verify current version on site): https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf
- Annexes hub **Version 10.0**: https://www.wipo.int/standards/en/st96/v10-0/
  - Annex I DRC PDF
  - Annex II Data Dictionary PDF
  - **Annex III IP XML Schemas**: https://www.wipo.int/standards/en/st96/v10-0/annex-iii/index.html
  - Annex IV technical specification
  - Annex V implementation rules + tools
  - Annex VI transformation rules (incl. ST.36 bridges)
- Older annex listing style: https://www.wipo.int/en/web/cws/taskforce/xml4ip/st96/cws2/st96-annex-iii
- Design rules example (v7.1 Annex I): https://www.wipo.int/standards/en/st96/v7-1/annex-i/03-96-i.pdf

**Scope (from ST.96 PDF):** XML resources for **patents, trademarks, industrial designs, GIs, copyright (orphan works)**, extensible (e.g. UPOV PVP-XML). Goals: IPO interoperability, harmonization, compatibility/transformability with **ST.36 / ST.66 / ST.86**, consistent practice.

**Structure of the standard:**

| Annex | Role |
| --- | --- |
| I | Design Rules & Conventions |
| II | IP Data Dictionary (entities for filing/processing/publication/exchange) |
| III | XML Schema components (Common, Patent, Trademark, Design, External) |
| IV | Schema technical documentation |
| V | Implementation / customization guidance |
| VI | Transformation to/from ST.36 (and trademark/design siblings) |
| VII | Example instances |

**Segment-level typing for patents:** national implementations of ST.96 expose the practical segment set. Example — **CIPO Patent data ST.96 (XML)** lists:

- Bibliographic data
- **Title and abstract text**
- **Claims**
- **Disclosure and description**
- Priority claims, IPC, ST.27 legal status

Source: https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/patent-data-st96-xml

That list is almost exactly the **role ontology** a patent drafting agent needs at the top level.

**Namespaces:** ST.96 defines Common / Patent / Trademark / Design namespaces (see Annex I materials).

**Drafting rules:** schema constraints + “structured preferred over unstructured” policy in the standard; **not** MPEP-style prose idioms.

**License / reuse:** WIPO publishes standards for IPO and industry use. For monorepo vendoring of XSD subsets, prefer **generate TypeScript/Effect Schema from selected patent components** or maintain a **thin RDF/LiteralKit mirror of segment names** rather than importing the entire Annex III tree.

### 9.3 Scores (ST.36 / ST.96)

| | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ST.36 | H | M (claim-ref) | L | H (legacy) | L (DTD) | M | M | M |
| ST.96 | H | M–H | L–M | H (modern) | M (XSD; dictionary) | H | M–H | M |

---

## 10. USPTO document models (DTDs + MPEP/CFR structure)

### 10.1 Bulk XML DTDs

USPTO publishes **versioned DTDs** for patent grants and applications (and related products) on the XML Resources page:

https://www.uspto.gov/learning-and-resources/xml-resources

Examples linked there (non-exhaustive):

- `us-patent-grant-v47-2022-02-17.dtd`
- `us-patent-application-v46-2022-02-17.dtd`
- earlier v40–v45 lineages for grants and applications

These DTDs are the **concrete US segment vocabulary** in bulk data (description, claims, abstract, drawings references, biblio, etc.). They align historically with ST.36 ICE practice and are what most open-source patent parsers already understand.

**Bulk data portal (examination / office actions products):**
https://data.uspto.gov/bulkdata/datasets

Note: **PEDS retirement** communications (March 2025) redirect consumers to successor open-data products:
https://www.uspto.gov/system-status/20250212-patent-examination-data-system-peds-retirement

Agents working OA responses should track **current** USPTO open-data products for office-action XML rather than assuming PEDS forever.

### 10.2 37 CFR 1.77 / MPEP §608.01(a) — arrangement of application elements

This is the **strongest open specification of US patent application segment typing** for drafting UIs and agent scaffolds.

Primary source:
https://www.uspto.gov/web/offices/pac/mpep/s608.html
(section **608.01(a) Arrangement of Application**, citing **37 CFR 1.77**)

**Application order (high level, 1.77(a)):** transmittal → fees → ADS → **specification** → drawings → oath/declaration.

**Specification sections in order (1.77(b))** — the gold list for role annotations:

1. Title of the invention
2. Cross-reference to related applications
3. Federally sponsored research statement
4. Joint research agreement parties
5. Incorporation by reference (sequence listings, large tables, software appendix, Sequence Listing XML, …)
6. Prior disclosures by inventor
7. **Background of the invention**
8. **Brief summary of the invention**
9. Brief description of the drawings
10. **Detailed description of the invention**
11. **A claim or claims**
12. **Abstract of the disclosure**
13. Sequence Listing (as applicable)

Headings should appear in uppercase (1.77(c)). MPEP notes the order is **preferable** (not always strictly required) but is the normative framing examiners and practitioners expect.

**Related formal separation:** claims, abstract, and sequence listing commence on separate sheets; specification text rules in 37 CFR 1.71 / 1.72 appear in the same MPEP chapter.

### 10.3 Claim formalities and structure (drafting idioms)

**USPTO Claim drafting** (Invention-Con 2019 materials PDF):
https://www.uspto.gov/sites/default/files/documents/Claim%20drafting.pdf

Key structured claims content from that deck (and MPEP/CFR practice it summarizes):

- At least one claim required in a nonprovisional; independent vs dependent forms
- Dependent claim **must further limit** and incorporates referenced limitations
- Claims as **single sentence**; consistent terminology with disclosure; support/enablement
- Fee-era rule of thumb cited: 3 independent / 20 total before excess fees
- **Three-part claim anatomy:**
  1. **Preamble**
  2. **Transitional phrase** (open / closed / partially open — comprising / consisting of / …)
  3. **Body** (limitations)

This is **exactly** the sub-AST model agents need under a `Claim` segment—not something AKN or ELI provides.

**EPO claim structure (harmonized doctrine):**
https://www.epo.org/en/legal/guidelines-epc/2026/f_iv_3_4.html
(independent vs dependent claims; multiple dependencies; categories)

### 10.4 Office actions (structure without a formal ontology)

USPTO guidance for applicants:
https://www.uspto.gov/patents/maintain/responding-office-actions

There is **no widely adopted open OWL ontology of office-action parts** comparable to ST.96 for patents. Practitioner structure is conventional:

- Header / application identification
- Status (non-final / final / restriction / …)
- Claim rejections grouped by statutory basis (§101, §102, §103, §112, …)
- Claim objections / formality
- Allowable subject matter indications
- Conclusion / response period

Commercial guides (e.g. Practical Law, vendor blogs) restate this outline but are **not standards**. For beep-effect, **define a small proprietary (or FOSS) OA-response document role schema** informed by MPEP practice and bulk OA data fields—not wait for an OASIS TC.

### 10.5 Scores (USPTO stack)

| | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MPEP/CFR 1.77 | H | M | H | H (US practice) | L | H | H (public) | M |
| Claim drafting model | H | H | H | H | L | H | H | M |
| Application DTDs | H | M–H | L | H | L | M | H | L–M |
| OA guidance | M | L | M | H | L | H | H | H |

---

## 11. EPO / other office data models (brief)

- **Open Patent Services (OPS):** https://www.epo.org/en/searching-for-patents/data/web-services/ops
- **Bulk data manuals:** https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/manuals
- **Guidelines (claims):** https://www.epo.org/en/legal/guidelines-epc/2026/f_iv_3_4.html

EPO systems historically consume/produce XML aligned with WIPO families (ST.36 era documentation still circulates in third-party OPS schema mirrors). For beep-effect, treat EPO as:

1. **Doctrine source** for claim categories and dependency
2. **Interchange peer** via ST.96 direction of travel
3. Not as a separate document ontology to re-implement

---

## 12. Patent claim structure models (summary model for AST)

Independent of any single ontology file, the **claim structure model** is mature and should be first-class in beep-effect:

```
ClaimSet
  └─ Claim
       ├─ number: positive integer
       ├─ kind: Independent | Dependent
       ├─ dependsOn: Claim[]   // empty iff Independent
       ├─ preamble: Inline[]
       ├─ transition: Open | Closed | PartiallyOpen | Other(text)
       ├─ body: Limitation[]   // often list-like; still one grammatical sentence in US practice
       └─ category?: Method | Product | System | Composition | …
```

**Normative anchors:**

- USPTO claim drafting PDF: https://www.uspto.gov/sites/default/files/documents/Claim%20drafting.pdf
- MPEP §608 (claims form / disclosure relationship): https://www.uspto.gov/web/offices/pac/mpep/s608.html
- EPO Guidelines F-IV 3.4: https://www.epo.org/en/legal/guidelines-epc/2026/f_iv_3_4.html

**Academic / KG note:** claim texts are the preferred extraction surface for engineering KGs (e.g. Siddharth et al., Zuo et al.—cited in the ESWC 2023 position paper below). That reinforces treating claims as a **distinct subgraph**, not as ordinary markdown headings.

---

## 13. Academic work: patent document ontologies & KGs

### 13.1 “Diving into Knowledge Graphs for Patents” (ESWC 2023 workshop)

Open CEUR paper:
https://ceur-ws.org/Vol-3443/ESWC_2023_SemTech4STLD_paper_1.pdf

**Document structure as stated in the paper (section on patent complexity):** patents typically include:

- **Title** — precise, not marketing
- **Abstract** — brief overview for landscaping
- **Claims** — legal protection boundary; sensitive; omission risk
- **Description** — detailed components and uses
- **Images** — referenced from text
- **References** — prior patents / literature

The paper explicitly argues that **each section has a different intent**, so KG/ontology modules should be **section-specific**—highly aligned with beep-effect’s plan to annotate AST segments rather than dump whole documents into one bag-of-embeddings.

It also notes the **absence of mature, general patent KGs** relative to scholarly/medical domains, and points to claim-centric engineering KGs:

- Siddharth et al., *Engineering knowledge graph from patent database*, JCISE 2022 (cited as [13] in the CEUR paper)
- Zuo, Yin, Childs, *Patent-KG* for engineering design, Design Society 2022 (cited as [14])

Related open code mentioned for a CS-domain experiment: https://github.com/danilo-dessi/patent
HUPD dataset: https://huggingface.co/datasets/HUPD/hupd

### 13.2 Conceptual graphs from claim text

ScienceDirect record (paywalled abstract page):
https://www.sciencedirect.com/science/article/abs/pii/S095219761100217X

Shows long-running interest in **claim → conceptual graph** pipelines—useful citation for retrieval features, not a vendorable ontology.

### 13.3 “Developing an Ontology for the U.S. Patent System” (Taduri et al.)

Bibliographic records:

- ResearchGate: https://www.researchgate.net/publication/221585362_Developing_an_Ontology_for_the_US_Patent_System
- Semantic Scholar: https://www.semanticscholar.org/paper/Developing-an-ontology-for-the-U.S.-patent-system-Taduri-Lau/fe808afac6493d9e0bb946cf4d5384939043910b

Focus (from abstracts): integrating heterogeneous **patent system** information (documents + process), not a full open OWL product maintained as a standard. Treat as **prior art pointer**, not as drop-in TTL.

### 13.4 Practitioner “anatomy of a patent” (non-ontology, still useful)

- https://henry.law/blog/the-anatomy-of-a-patent/
- https://www.mololamken.com/knowledge-how-do-i-read-a-patent

These restate the same section inventory as MPEP/ST.96 in plain language—good for UX copy, not for formal schemas.

### 13.5 Assessment of academic stack

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M–H (descriptive) | H (claims focus) | L | L | L–M | H | L–M | L |

**Beep-effect use:** adopt their **section inventory + section-specific semantics** thesis; **do not** wait for a community patent-structure OWL that does not exist as a maintained standard.

---

## 14. Cross-link: SPAR DoCO / PO / DEO (already assessed)

Not re-litigated here; retained for composition:

- DoCO: https://sparontologies.github.io/doco/current/doco.html · https://github.com/SPAROntologies/doco
- PO: https://sparontologies.github.io/po/current/po.html
- DEO: http://purl.org/spar/deo

**Composition rule for beep-effect:**

| Layer | Ontology / model | Example |
| --- | --- | --- |
| Rhetorical / discourse | DEO + DoCO discourse classes | Introduction, Motivation, related work-like background rhetoric |
| Generic document components | DoCO | Section, Paragraph, Table, Figure |
| Patent **roles** | MPEP 1.77 + ST.96 names | `BackgroundOfInvention`, `Claims`, `Abstract` |
| Claim graph | Claim structure model | dependentOn, transition type |
| Norm checks | LegalRuleML-inspired / FLINT / Effect rules | “dependent must narrow” |

DoCO alone cannot distinguish **Background** from **Detailed Description** in a patent-meaningful way; patent roles are **domain specializations**.

---

## 15. Comparative matrix (all major candidates)

| Artefact | Segment typing | Claim model | Drafting idioms | Office interchange | RDF-ready | Layer on `@beep/md` | OA prosecution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AKN / LegalDocML | Legal hierarchy | No | Structural Schematron | Legislatures | Partial | Good as pattern | Weak |
| LegalRuleML | No | Norm rules | Strong (norms) | Limited | Yes (RDFS) | Side-car rules | Medium |
| ELI / ECLI | IDs / metadata | No | No | EU law / case law | Yes | Metadata only | No |
| MetaLex / LexML | Legislative | No | Medium | National | Varies | Medium | No |
| LKIF-Core | Concepts | No | Medium | Research | Yes | Concept tags | Low |
| FLINT | Act/fact frames | No | Medium | Research | Yes | Strategy frames | Medium |
| ST.36 | Patent ICE | claim-ref | Schema only | High (legacy) | No | Map element→role | Medium |
| **ST.96** | **Patent components** | **Strong potential** | Schema only | **High (modern)** | Dictionary→RDF possible | **Excellent** | Medium |
| **USPTO DTDs** | **US concrete** | **Yes** | Low | **High** | No | Good | Low–Med |
| **MPEP / 37 CFR 1.77** | **Best US list** | Via §608 | **Best open idioms** | Practice | Manual | **Excellent** | Medium |
| Claim drafting model | Claim parts | **Best** | **Best** | Practice | Manual | **Excellent** | Medium |
| Academic patent KGs | Sections descriptive | Extraction | Low | Research | Ad hoc | Good ideas | Low |
| DoCO/DEO (prior) | Generic | No | Rhetorical | Scholarly | Yes | Excellent generic | Low |

---

## 16. Ranked shortlist (with license notes)

### 1) USPTO structural law & guidance (MPEP §608, 37 CFR 1.77, claim drafting)

- **Why #1:** Directly names the segments agents must draft; carries formality idioms; already what attorneys internalize.
- **URLs:** https://www.uspto.gov/web/offices/pac/mpep/s608.html · https://www.uspto.gov/sites/default/files/documents/Claim%20drafting.pdf
- **License note:** Official USPTO/MPEP text is U.S. government work; safe to quote/paraphrase in product UX and to encode as schemas. Not an OWL file—**you author** the LiteralKit/Schema layer.
- **Action:** `PatentApplicationSection` LiteralKit mirroring 1.77(b); heading normalizers; agent prompts grounded in these names.

### 2) WIPO ST.96 (patent components + data dictionary)

- **Why #2:** International segment vocabulary + path to import/export; Annex VI bridges legacy ST.36.
- **URLs:** https://www.wipo.int/standards/en/st96/v10-0/ · https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf · https://www.wipo.int/standards/en/st96/v10-0/annex-iii/index.html
- **License note:** Free published WIPO standard; for vendoring XSDs, keep provenance + prefer generated subsets. Confirm any office-specific schema copyrights separately.
- **Action:** Align exported element names / RDF IRIs with ST.96 patent component names where possible; do not force ST.96 XML as editor native format.

### 3) USPTO application/grant DTDs + bulk data

- **Why #3:** Ground-truth US XML shapes for retrieval corpora and golden tests.
- **URL:** https://www.uspto.gov/learning-and-resources/xml-resources
- **License note:** Government-published technical resources; typical open use for parsers.
- **Action:** Fixtures for Md↔segment round-trips; ingestion into professional-desktop retrieval.

### 4) Claim structure model (US + EPO guidelines)

- **Why #4:** Sub-segment typing that DoCO/ST.96 top-level sections do not fully capture.
- **URLs:** USPTO claim drafting PDF (above); https://www.epo.org/en/legal/guidelines-epc/2026/f_iv_3_4.html
- **License note:** Encode as *your* schema; cite guidelines as normative references in docs/tests.
- **Action:** `Claim` schema in modeling package; dependency graph for agents (“if you amend claim 1, flag dependents”).

### 5) Akoma Ntoso (pattern library only)

- **Why #5:** Best open hierarchical legal document standard; Schematron/FRBR lessons transfer.
- **URLs:** https://www.oasis-open.org/standard/akn-v1-0/ · vocabulary HTML (section 4)
- **License note:** OASIS Standard; implement freely under OASIS IPR Policy; retain copyright notices if redistributing prose/XSD.
- **Action:** Optional; extract *patterns*, not patent document types.

### 6) ELI (+ ECLI)

- **Why #6:** Citation identity for EU law/case law side of an IP practice.
- **URLs:** https://eur-lex.europa.eu/eli-register/what_is_eli.html · https://op.europa.eu/en/web/eu-vocabularies/model/-/resource/dataset/eli · https://e-justice.europa.eu/topics/registers-business-insolvency-land/european-case-law-identifier-ecli_en
- **License note:** EU public vocabularies / public sector information—standard open reuse; retain attribution.
- **Action:** Only if product cites EU legislation/case law systematically.

### 7) LegalRuleML / FLINT / LKIF

- **Why #7:** Future formal checking layer, not segment inventory.
- **URLs:** LegalRuleML OS https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html · FLINT Apache-2.0 local clone · LKIF https://github.com/RinkeHoekstra/lkif-core
- **License note:** OASIS for LegalRuleML; Apache-2.0 for FLINT core; verify LKIF repo license before vendoring.
- **Action:** Deferred; prefer Effect-native rules first.

### 8) Academic patent KG work

- **Why #8:** Validates section-specific semantics; extraction ideas for retrieval.
- **URL:** https://ceur-ws.org/Vol-3443/ESWC_2023_SemTech4STLD_paper_1.pdf
- **License note:** CEUR workshop paper—cite; code repos may have separate licenses.
- **Action:** Literature pointer in RESEARCH ledger; not a vendored ontology.

### Explicit non-goals / deprioritize

- **Replacing `@beep/md` with AKN or ST.96 XML as canonical** — conflicts with full-document-editor architecture (Md canonical; Lexical/Pandoc projections).
- **Waiting for a perfect patent OWL from academia** — inventory is already fixed by MPEP/ST.96.
- **Using ELI as a patent abstract ontology** — wrong layer.

---

## 17. Fit for beep-effect (decision guidance)

### 17.1 What professional-desktop agents actually need

From the packet capture (patent applications + OA responses, retrieval, AST idioms):

1. **Named sections** while drafting (scaffold headings = 1.77 list)
2. **Claim graph** with dependency and transition semantics
3. **Retrieval units** at section and claim grain (not only whole-doc chunks)
4. **Structure rules** (“claims single sentence,” “dependent narrows,” “abstract length heuristics,” “don’t put claims mid-description”)
5. **Optional export** toward office XML (later) without polluting the editor core
6. **Citation** of patents, MPEP, case law, statutes

### 17.2 Recommended architecture (schema → service → impl)

Aligned with repo laws (schema-first, Effect services):

```
@beep/md Block/Inline          (canonical surface syntax)
        │
        ▼
PatentDocumentRole annotations (LiteralKit / Schema)
  - ApplicationSection = 1.77(b) names
  - Claim / ClaimSet / Limitation / Transition
  - OfficeActionSection / RejectionGround (home-grown)
        │
        ▼
Rhetorical overlay (optional DoCO/DEO classes)
        │
        ▼
Interchange mapping (ST.96 element names / USPTO DTD)
        │
        ▼
Rule layer (Effect Schema + tests; later LegalRuleML/FLINT if needed)
        │
        ▼
Agent tools: retrieve-by-role, lint-structure, draft-section, traverse-rejection
```

### 17.3 Mapping examples (markdown AST → roles)

| Markdown pattern | Role annotation |
| --- | --- |
| `# BACKGROUND OF THE INVENTION` + blocks | `BackgroundOfInvention` |
| `# BRIEF SUMMARY OF THE INVENTION` | `BriefSummary` |
| `# DETAILED DESCRIPTION ...` | `DetailedDescription` |
| `# CLAIMS` + ordered list / numbered paragraphs | `ClaimSet` |
| Numbered claim paragraph with “The method of claim 1, …” | `Claim` + `dependsOn: [1]` |
| `# ABSTRACT` | `AbstractOfDisclosure` |
| OA: `## Rejection under 35 U.S.C. § 103` | `RejectionGround` + statute ref |

None of this requires AKN elements in the editor.

### 17.4 What to vendor into `@beep/rdf` / `@beep/ontology`

| Asset | Vendor? | Form |
| --- | --- | --- |
| Patent application section IRIs (mirroring 1.77 + ST.96 labels) | **Yes** | Small TTL/JSON-LD + LiteralKit |
| Claim relation vocabulary | **Yes** | `dependentOn`, `hasPreamble`, … |
| Full ST.96 XSD tree | **No** (generate/map as needed) | External reference |
| Full AKN XSD | **No** | Pattern notes only |
| LegalRuleML RDFS | **Optional later** | Examples only first |
| ELI ontology | **Optional** | If EU legislation features ship |
| DoCO/DEO | **Yes** (prior lane) | Rhetorical layer |

### 17.5 Office-action gap (must own)

No standard surveyed provides a complete, open, patent-prosecution **response document ontology**. beep-effect should treat this as **NET-NEW schema work**, informed by:

- USPTO responding-to-OA pages: https://www.uspto.gov/patents/maintain/responding-office-actions
- Bulk OA datasets on https://data.uspto.gov/
- MPEP chapters on amendments/replies (follow-on research; not fully expanded in this lane)

### 17.6 Risks / rabbit holes

| Risk | Mitigation |
| --- | --- |
| Over-adopting AKN for patents | Keep AKN out of patent path; use only as hierarchical/legal pattern reference |
| Treating ST.96 as editor model | Map at export/import boundary only |
| Encoding all MPEP prose as ontology | Ontology = types/relations; prose = agent skill docs + linter messages |
| License fear blocking public domain MPEP-derived schemas | Separate “normative citation” from “our schema code” |
| OA XML churn (PEDS retirement) | Abstract OA ingestion behind an interface; track USPTO open data notices |
| Claim dependency edge cases (multiple dependent claims, EPO vs US) | Explicit jurisdiction parameter on claim rules |

### 17.7 Suggested first vertical slice

1. Author `PatentApplicationSection` + `Claim` schemas (Effect Schema / LiteralKit).
2. Seed taxonomy TTL consumed by existing ontology loader.
3. Heading→role detector over `@beep/md` for the 1.77 core sections.
4. Agent tool: `getSections(doc)` / `getClaimGraph(doc)` for retrieval.
5. One structure lint: dependent claims must reference an existing earlier claim.
6. Golden fixtures from a USPTO application XML snippet mapped into Md + roles.

This slice proves ontology-aided AST structure **without** waiting on LegalDocML or full ST.96 implementation.

---

## 18. Sources appendix (URL ledger)

### OASIS / legislative-judicial

- https://www.oasis-open.org/standard/akn-v1-0/
- https://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part1-vocabulary/akn-core-v1.0-os-part1-vocabulary.html
- http://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part2-specs/schemas/
- http://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/akn-core-v1.0-os.zip
- https://github.com/oasis-open/legaldocml-akomantoso
- https://www.oasis-open.org/committees/legaldocml/ipr.php
- https://en.wikipedia.org/wiki/Akoma_Ntoso
- https://www.balisage.net/Proceedings/vol24/html/Palmirani01/BalisageVol24-Palmirani01.html
- https://unsceb-hlcm.github.io/part1/index-13.html
- https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html
- https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/legalruleml-core-spec-v1.0.html
- https://www.oasis-open.org/standard/legalruleml-core-specification-version-1-0-oasis-standard/
- https://www.oasis-open.org/2021/09/08/legalruleml-core-specification-v1-0-oasis-standard-published/
- https://www.oasis-open.org/committees/legalruleml/
- https://github.com/oasis-tcs/legalruleml
- https://www.oasis-open.org/policies-guidelines/ipr/

### ELI / ECLI

- https://eur-lex.europa.eu/eli-register/what_is_eli.html
- https://eur-lex.europa.eu/eli-register/background.html
- https://op.europa.eu/en/web/eu-vocabularies/model/-/resource/dataset/eli
- https://en.wikipedia.org/wiki/European_Legislation_Identifier
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52012XG1026(01)
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52017XG1222(02)
- https://joinup.ec.europa.eu/collection/eli-european-legislation-identifier/solution/eli-ontology-draft-legislation-eli-dl/about
- https://e-justice.europa.eu/topics/registers-business-insolvency-land/european-case-law-identifier-ecli_en

### MetaLex / LexML / LKIF / FLINT

- https://interoperable-europe.ec.europa.eu/collection/eu-semantic-interoperability-catalogue/solution/cen-metalex
- https://en.wikipedia.org/wiki/LexML
- https://en.wikipedia.org/wiki/LexML_Brasil
- https://blog.law.cornell.edu/voxpop/2010/10/15/lexml-brazil-project/
- https://www.popvox.org/blog/when-law-becomes-data
- https://ceur-ws.org/Vol-321/paper3.pdf
- https://github.com/RinkeHoekstra/lkif-core
- https://en.wikipedia.org/wiki/Legal_Knowledge_Interchange_Format
- https://normativesystems.gitlab.io/knowledge-modeling/flint-ontology/

### WIPO / IPO patent XML

- https://www.wipo.int/documents/d/standards/docs-en-03-36-01.pdf
- https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf
- https://www.wipo.int/standards/en/st96/v10-0/
- https://www.wipo.int/standards/en/st96/v10-0/annex-iii/index.html
- https://www.wipo.int/en/web/standards/part_03_st_ref
- https://www.wipo.int/en/web/standards/part_03_standards
- https://confluence.wipo.int/confluence/spaces/usestandards/pages/79888861/WIPO+Standard+ST.36+Processing+of+patent+information+using+XML
- https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/patent-data-st96-xml
- https://www.wipo.int/standards/en/st96/v7-1/annex-i/03-96-i.pdf

### USPTO / EPO practice & data

- https://www.uspto.gov/learning-and-resources/xml-resources
- https://www.uspto.gov/web/offices/pac/mpep/s608.html
- https://www.uspto.gov/sites/default/files/documents/Claim%20drafting.pdf
- https://www.uspto.gov/patents/maintain/responding-office-actions
- https://data.uspto.gov/bulkdata/datasets
- https://www.uspto.gov/system-status/20250212-patent-examination-data-system-peds-retirement
- https://www.epo.org/en/legal/guidelines-epc/2026/f_iv_3_4.html
- https://www.epo.org/en/searching-for-patents/data/web-services/ops
- https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/manuals

### Academic / practitioner patent structure

- https://ceur-ws.org/Vol-3443/ESWC_2023_SemTech4STLD_paper_1.pdf
- https://github.com/danilo-dessi/patent
- https://huggingface.co/datasets/HUPD/hupd
- https://www.sciencedirect.com/science/article/abs/pii/S095219761100217X
- https://www.researchgate.net/publication/221585362_Developing_an_Ontology_for_the_US_Patent_System
- https://www.semanticscholar.org/paper/Developing-an-ontology-for-the-U.S.-patent-system-Taduri-Lau/fe808afac6493d9e0bb946cf4d5384939043910b
- https://henry.law/blog/the-anatomy-of-a-patent/
- https://www.mololamken.com/knowledge-how-do-i-read-a-patent

### SPAR (composition reference)

- https://sparontologies.github.io/doco/current/doco.html
- https://github.com/SPAROntologies/doco
- https://sparontologies.github.io/po/current/po.html
- http://purl.org/spar/deo

### Session scrapes (local provenance)

Research scrapes for this lane live under:

`explorations/document-structure-ontologies/research/grok/.firecrawl-02/`

(raw search JSON + markdown scrapes of the URLs above; not committed as the report of record—this file is).

---

## 19. One-page cheat sheet for implementers

**If you only remember five things:**

1. **Patent sections = 37 CFR 1.77 / MPEP §608**, not Akoma Ntoso articles.
2. **Claims = preamble + transition + body + dependency graph**, per USPTO/EPO practice guides.
3. **ST.96 / USPTO DTDs = interchange names**, not the editor’s native AST.
4. **LegalRuleML/FLINT/LKIF = optional norm engines**, not document layout.
5. **ELI/ECLI = citation identity** for EU materials; OA response structure is **NET-NEW**.

**Compose with existing beep bricks:** `@beep/md` canonical; DoCO/DEO rhetorical overlay; new patent-role vocab in `@beep/rdf` + taxonomy loader; agents consume roles for retrieval and structure lints.

---

*End of report — Grok lane 02 (legal/patent document structure).*
