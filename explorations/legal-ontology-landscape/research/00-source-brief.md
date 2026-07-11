# Research sources for a Palantir-style IP Law ontology

**This brief curates the literature and tooling you need to build a Palantir-Foundry-style operational ontology for intellectual property law on top of FalkorDB, organized into six working layers:** (A) Palantir's operational-ontology paradigm, (B) formal ontology-engineering foundations, (C) legal-domain core ontologies and document standards, (D) IP-specific ontologies and rights-expression languages, (E) IP-law doctrinal primary sources that ground the concepts, and (F) bridges between property graphs and OWL/SHACL plus the concrete tooling. Each entry includes a URL and a one-to-two-sentence note on why it matters. **A key orientation: Palantir's "ontology" is a closed-world operational knowledge graph with objects, links, and actions, whereas the formal-ontology world (OWL/BFO/SHACL) is open-world and model-theoretic** — your IP Law Ontology will need to borrow the conceptual rigor of the latter while adopting the object-action-function pattern of the former, and FalkorDB's property-graph model sits between them with its own impedance costs.

The collection prioritizes primary sources (W3C recommendations, OASIS standards, ISO specs, treaty texts, office manuals, canonical GitHub repos) over secondary commentary, and flags every legal-domain ontology's maintenance status honestly. Roughly one-third of historical "legal ontologies" are academic artifacts that have not been maintained since ~2010, so the practical reuse candidates are narrower than the literature suggests.

## A. Palantir's operational ontology paradigm

**Palantir Foundry docs — Ontology overview**: https://www.palantir.com/docs/foundry/ontology/overview — Canonical definition of the Ontology as "an operational layer for the organization" with semantic (objects, properties, links) and kinetic (actions, functions, dynamic security) elements. Start here; every other Palantir concept hangs off this page.

**Core concepts**: https://www.palantir.com/docs/foundry/ontology/core-concepts — Defines object types, properties, shared properties, link types, action types, interfaces, Object Views, and roles. This is the single most dense primer on the modeling vocabulary.

**Object and link types — Type reference**: https://www.palantir.com/docs/foundry/object-link-types/type-reference — Authoritative glossary distinguishing object-type definitions (metadata) from object instances (data), with object type groups, value types, and property types.

**Object types overview**: https://www.palantir.com/docs/foundry/object-link-types/object-types-overview — Explains the dataset-row analogy: an object type is like a dataset schema, an object instance is like a row, an object set is like a filtered view.

**Link types overview**: https://www.palantir.com/docs/foundry/object-link-types/link-types-overview — Describes schema-level relationship definitions and many-to-many links backed by their own datasources — critical for modeling things like assignments, licenses, and citations that carry their own attributes.

**Action types overview**: https://www.palantir.com/docs/foundry/action-types/overview — Defines actions as transactional, validated, auditable edits to objects/properties/links. **Actions are the kinetic counterpart to objects and the most under-appreciated Palantir primitive** — for IP workflows they map directly to filing, assigning, licensing, renewing, abandoning.

**Properties — Base types**: https://www.palantir.com/docs/foundry/object-link-types/base-types — Lists supported property types including vector (for embeddings), geopoint/geoshape, attachment, time series, media reference, cipher text, struct. Vector properties are the hook for semantic search over claim text or office actions.

**Required properties**: https://www.palantir.com/docs/foundry/object-link-types/required-properties — Covers validation semantics at index time vs. action time. This is the closest Palantir gets to SHACL-style cardinality constraints.

**Metadata — Type classes**: https://www.palantir.com/docs/foundry/object-link-types/metadata-typeclasses — Type classes carry rendering and indexing hints (being migrated to the Capabilities page). Use these for domain-specific display of patent numbers, IPC codes, etc.

**Metadata — Statuses**: https://www.palantir.com/docs/foundry/object-link-types/metadata-statuses — Active / experimental / deprecated / example / endorsed lifecycle states for objects, links, actions. Mirrors a governance-lite alternative to OBO Foundry's deprecation patterns.

**Interfaces**: Accessible under the Ontology docs section — Interfaces give you object-type polymorphism (shared shape across types). The natural home for abstractions like `IPRight`, `Licensable`, `Registrable` that `Patent`, `Trademark`, `Copyright`, and `TradeSecret` would implement.

**AIP overview**: https://www.palantir.com/docs/foundry/aip/overview — Describes AIP as the LLM layer grounded in the ontology. The ontology is the source of truth that constrains the LLM's reasoning surface.

**AIP Logic overview**: https://www.palantir.com/docs/foundry/logic/overview — No-code environment for LLM-powered functions that take ontology objects as typed inputs. The closest analog to a SPARQL-query-plus-reasoner for natural-language questions.

**AIP Logic — Getting started**: https://www.palantir.com/docs/foundry/logic/getting-started — Walks through blocks (create variable, apply action, execute function, use LLM) and the chain-of-thought debugger. Useful for structuring agentic IP-analyst workflows.

**AIP Agent Studio overview**: https://www.palantir.com/docs/foundry/agent-studio/overview — Build agents with ontology, document, and custom-tool context, deployable via OSDK. This is where a "Patent Prosecution Assistant" or "FTO Analyst" agent would live.

**AIP features catalog**: https://www.palantir.com/docs/foundry/aip/aip-features — Enumerates AIP hooks in Pipeline Builder, Workshop, Notepad, Scheduler, plus the Palantir MCP server that exposes ontology context to external AI IDEs.

**Workshop AIP Agent widget**: https://www.palantir.com/docs/foundry/workshop/widgets-aip-agent — How agents integrate into end-user apps, including object traversal, property reading/filtering, and aggregations — **the reference pattern for grounded tool-use on an ontology**.

**Blog: Building with AIP — Logic Tools for RAG/OAG**: https://blog.palantir.com/building-with-palantir-aip-logic-tools-for-rag-oag-fdaf8938d02e — Introduces "Ontology Augmented Generation" (OAG) as a generalization of RAG: retrieve structured objects and their relations rather than text chunks. Directly relevant to grounding IP-law LLM answers.

**Towards AI — "The Context Advantage: How Palantir AIP Operates the Modern Enterprise"**: https://towardsai.net/p/machine-learning/the-context-advantage-how-palantir-aip-operates-the-modern-enterprise — Third-party explainer on why ontology-grounded context beats model-centric approaches for enterprise reasoning.

**Supply Chain Today — "Palantir Ontology Overview"**: https://www.supplychaintoday.com/palantir-ontology-overview/ — Useful outsider summary including the 2021-2025 timeline of the ontology's emergence as a first-class Foundry product.

**Palantir platform page — Ontology**: https://www.palantir.com/platforms/ontology/ — Marketing overview with the "digital twin" framing. Shallow but useful for executive-level framing.

## B. Formal ontology-engineering foundations

**BFO 2020 GitHub (ISO/IEC 21838-2:2021)**: https://github.com/BFO-ontology/BFO-2020 — **The canonical top-level ontology for domain ontologies that need ISO-grade rigor; adopted January 2024 as the DoD/IC baseline**. Divides entities into continuants (objects, qualities, roles, dispositions, functions) and occurrents (processes) — maps surprisingly well to IP concepts like a patent (continuant) vs. prosecution (occurrent).

**ISO/IEC 21838-2:2021**: https://www.iso.org/standard/74572.html — The standard itself. Free download at https://standards.iso.org/iso-iec/21838/-2/ed-1/en/.

**NCOR Wiki — BFO 2020**: https://ncorwiki.buffalo.edu/index.php/BFO_2020 — Hub maintained by Barry Smith's group with user guides, IRIs table, and links to the Common Logic axiomatization.

**Arp, Smith & Spear — *Building Ontologies with Basic Formal Ontology* (MIT Press, 2015)**: https://mitpress.mit.edu/9780262527811/building-ontologies-with-basic-formal-ontology/ — The textbook. If you adopt BFO, this is required reading for ontology authors; it teaches the discipline of class-vs-instance-vs-role distinctions that novice ontology builders invariably botch.

**DOLCE + DnS (Descriptions and Situations)**: http://www.loa.istc.cnr.it/dolce/overview.html — Laboratory for Applied Ontology's cognitive-bias upper ontology, with the Descriptions & Situations extension that natively supports roles, norms, and plans. **Historically the preferred upper ontology for legal work because DnS handles deontic/normative content more gracefully than BFO**.

**UFO / OntoUML (Guizzardi)**: https://ontouml.org/ and https://github.com/OntoUML/ontouml-vocabulary — Unified Foundational Ontology with tooling (OntoUML editor, gUFO as an OWL projection). Strong story for kinds, subkinds, roles, phases, and relators — the "relator" pattern is ideal for modeling assignments and licenses as first-class entities.

**UFO-L (Griffo, Almeida, Guizzardi)**: https://nemo.inf.ufes.br/en/projects/ufo-l/ — UFO extension specifically for the legal domain, modeling legal relators, legal roles, and legal acts. The most philosophically careful legal core ontology published in the last decade.

**OBO Foundry**: https://obofoundry.org/ — Principles (open, orthogonal, identifier scheme, BFO-aligned). Even if you don't join, the principles are a governance template and the ODK tooling is reusable.

**Information Artifact Ontology (IAO)**: https://github.com/information-artifact-ontology/IAO — BFO-aligned ontology of documents, information content entities, and their bearers. **Essential for IP** because patents, registrations, and opinions are exactly the "information content entities" IAO models.

**Relations Ontology (RO)**: https://github.com/oborel/obo-relations — Vetted relation vocabulary (`part of`, `has role`, `participates in`, `derives from`). Reuse rather than invent inverse properties.

**OBO Academy / OBOOK**: https://oboacademy.github.io/obook/ — Free, actively maintained curriculum on ontology engineering, ODK, ROBOT, pull-request-driven governance. Best practical training on the web.

**W3C OWL 2 Primer**: https://www.w3.org/TR/owl2-primer/ — Gentle intro. Read before the spec.

**W3C OWL 2 Structural Specification**: https://www.w3.org/TR/owl2-syntax/ — Normative reference.

**W3C OWL 2 Profiles (EL, QL, RL)**: https://www.w3.org/TR/owl2-profiles/ — Profile choice drives which reasoner you can use at what scale. For a law ontology, OWL 2 EL gives you tractable class subsumption; OWL 2 RL gives you rule-based inference friendly to Datalog/SPARQL engines.

**W3C RDF 1.1 Concepts**: https://www.w3.org/TR/rdf11-concepts/ — Foundational data model.

**W3C RDF 1.2 / RDF-star (in progress)**: https://www.w3.org/groups/wg/rdf-star/ — Triple-as-subject support is the cleanest way to attach provenance, confidence, and temporal validity to legal assertions.

**W3C SPARQL 1.1**: https://www.w3.org/TR/sparql11-overview/ — Query language and federation.

**W3C SHACL Core**: https://www.w3.org/TR/shacl/ — **The shape/constraint language you will actually use for validation, far more than OWL itself**. Cardinality, datatype, closed-world-style constraints.

**W3C SHACL Advanced Features**: https://www.w3.org/TR/shacl-af/ — SHACL-SPARQL, rules, functions. Gives you derivation rules that OWL cannot express cleanly.

**"Validating RDF Data" (Labra Gayo et al., 2017, free book)**: http://book.validatingrdf.com/ — Definitive SHACL + ShEx text with worked examples.

**SKOS (Simple Knowledge Organization System)**: https://www.w3.org/TR/skos-reference/ — The right choice for classification hierarchies like IPC, CPC, Locarno, Nice, Vienna. **Do not model classifications as OWL class hierarchies — use SKOS ConceptSchemes** to keep class semantics pristine.

**DCMI Terms (Dublin Core)**: https://www.dublincore.org/specifications/dublin-core/dcmi-terms/ — `dcterms:creator`, `dcterms:date`, `dcterms:license`, `dcterms:rights`. Ubiquitous; reuse.

**W3C PROV-O**: https://www.w3.org/TR/prov-o/ — Provenance ontology for activities, agents, and entities. Indispensable for audit-trails on filings, amendments, assignments, chain of title.

**FOAF**: http://xmlns.com/foaf/spec/ — Lightweight model of people and organizations. Use for inventors, assignees, agents.

**schema.org**: https://schema.org/ — Pragmatic vocabulary especially useful for `CreativeWork`, `License`, `legislation:Legislation` extension.

**DCAT 3**: https://www.w3.org/TR/vocab-dcat-3/ — Dataset catalog vocabulary — relevant for publishing IP datasets and for aligning with EU data-portal patterns.

**ORG (W3C Organization Ontology)**: https://www.w3.org/TR/vocab-org/ — Organization structure, useful for law firms, patent offices, corporate assignees.

**Ontology Design Patterns catalog**: http://ontologydesignpatterns.org/ — Reusable micro-patterns: Part-Whole, Participation, Role, Time-Indexed Participation, N-ary Relation, Description & Situation. **Time-Indexed Participation is the pattern for licenses and assignments whose parties and scope evolve over time**.

**Hitzler, Gangemi et al. — *Ontology Engineering with Ontology Design Patterns* (IOS Press, 2016)**: https://www.iospress.com/catalog/books/ontology-engineering-with-ontology-design-patterns-foundations-and-applications — The patterns book.

**Kendall & McGuinness — *Ontology Engineering* (Morgan & Claypool, 2019)**: https://link.springer.com/book/10.1007/978-3-031-79486-5 — Compact modern textbook on competency questions, pattern-based authoring, and tooling.

**Allemang, Hendler & Gandon — *Semantic Web for the Working Ontologist* (3rd ed., 2020)**: https://dl.acm.org/doi/book/10.1145/3382097 — The most readable OWL/SPARQL/SHACL book. Start here if the team is new to RDF.

**Noy & McGuinness — "Ontology Development 101"**: https://protege.stanford.edu/publications/ontology_development/ontology101.pdf — Old but still the shortest useful "how to start" paper.

**Gruninger & Fox (1995) — Competency questions methodology**: http://stl.mie.utoronto.ca/publications/gruninger-ijcai95.pdf — The discipline of writing down the questions your ontology must answer before modeling. **Do this for IP use cases (e.g., "Which subsidiaries own patents with unpaid maintenance fees expiring in Q3?") before you write a single OWL class**.

**OntoClean (Guarino & Welty)**: https://dl.acm.org/doi/10.1145/503124.503150 — Meta-properties (rigidity, identity, unity, dependence) that surface taxonomic errors. Catches mistakes like making `Licensee` a subclass of `Person` when it should be a role played by a Person.

**NeOn Methodology**: http://www.neon-project.org/nw/Welcome_to_the_NeOn_Project.html — Network-based ontology methodology with scenarios for reuse and re-engineering of non-ontological resources (which is what you're doing with statutes).

**Poveda-Villalón — LOT (Linked Open Terms)**: https://lot.linkeddata.es/ — Lightweight practical methodology with templates. More agile than NeOn.

**OOPS! (Ontology Pitfall Scanner)**: https://oops.linkeddata.es/ — Web tool that finds 40+ common modeling pitfalls. Run your draft through it weekly.

## C. Legal core ontologies and document/citation standards

**LKIF-Core (Hoekstra et al., ESTRELLA 2008) — GitHub**: https://github.com/RinkeHoekstra/lkif-core — **The most complete freely-available OWL core legal ontology**, 15 modules covering top, mereology, time, process, role, action, expression, legal-action, legal-role, norm, and rules. Not actively maintained since ~2015 but still the most reused baseline; plan to fork and modernize rather than import blindly.

**LKIF-Core paper (CEUR Vol-321)**: https://ceur-ws.org/Vol-321/paper3.pdf — Principled write-up with the methodology. Read before touching the OWL.

**LKIF-Core — IOS Press chapter (Hoekstra, Breuker, Di Bello, Boer, 2009)**: https://ebooks.iospress.nl/volumearticle/4813 — Definitive publication.

**Wikipedia — LKIF**: https://en.wikipedia.org/wiki/Legal_Knowledge_Interchange_Format — Historical context on ESTRELLA and the OWL-DL + SWRL hybrid design.

**Financial Regulation Ontology (FRO) tutorial reusing LKIF**: https://finregont.com/tutorial-chapter2-load-law/ — Shows how to populate LKIF with US Code and CFR — a directly transferable pattern for loading 35 USC, 17 USC, 15 USC.

**Akoma Ntoso (OASIS LegalDocML)**: https://www.oasis-open.org/committees/tc_home.php?wg_abbrev=legaldocml — XML standard for legislative, judicial, and parliamentary documents. **The canonical document schema for marking up patents, statutes, opinions**; pair with an OWL layer for semantics.

**Akoma Ntoso official site**: http://www.akomantoso.org/ — Vocabulary, naming conventions, examples.

**CEN Metalex**: http://www.metalex.eu/ — Earlier generic XML schema for legal sources, now largely superseded by Akoma Ntoso but cited widely.

**European Legislation Identifier (ELI)**: https://eur-lex.europa.eu/eli-register/about.html — Persistent URI scheme and RDF ontology (`http://data.europa.eu/eli/ontology`) for legislation. Reuse for EU directives (DSM, InfoSoc, Trade Secrets).

**ECLI (European Case Law Identifier)**: https://e-justice.europa.eu/content_european_case_law_identifier_ecli-175-en.do — Sister scheme for judicial decisions.

**FRBRoo → LRMoo v1.0 (IFLA, April 2024)**: https://cidoc-crm.org/lrmoo and https://repository.ifla.org/items/94aedb49-2d6e-4a6d-9974-f33abb7e3c0e — **Work/Expression/Manifestation/Item hierarchy aligned with CIDOC CRM 7.1.3 — the proper way to model a copyrighted work's identity across editions, translations, performances, and copies**. LRMoo supersedes FRBRoo v2.4 (2016). Essential for copyright; also powers rights-scope reasoning in ODRL via the IFLA model.

**CIDOC CRM**: https://cidoc-crm.org/ — Event-centric conceptual reference model; LRMoo extends it.

**W3C PROV-O for legal provenance**: https://www.w3.org/TR/prov-o/ (listed in §B) — Model filing events, amendments, priority claims as `prov:Activity` instances with `prov:wasDerivedFrom` chains.

**LegalRuleML Core Specification v1.0 (OASIS Standard, 30 Aug 2021)**: https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html — Palmirani, Governatori, Athan, Boley, Paschke, Wyner. **The OASIS standard for representing legal rules with defeasibility, temporal validity, jurisdiction, and deontic operators** (obligation/permission/prohibition). Ontology-independent by design — pairs with whatever domain ontology you build.

**LegalRuleML TC page**: https://www.oasis-open.org/standard/legalruleml-core-specification-version-1-0-oasis-standard/ — Official landing.

**"Enabling reasoning with LegalRuleML" (Palmirani, Governatori et al., TPLP 2019)**: https://www.cambridge.org/core/journals/theory-and-practice-of-logic-programming/article/abs/enabling-reasoning-with-legalruleml/B595A9381624C7D96B4A27D579966D5E — Companion paper on operationalizing LegalRuleML with defeasible logic reasoners (SPINdle, Turnip).

**Core Legal Ontology (CLO) — Gangemi, Sagri, Tiscornia (DOLCE+DnS)**: https://link.springer.com/chapter/10.1007/11536328_5 — Legal concepts as descriptions and situations over DOLCE. Dense but philosophically well-founded.

**UFO-L (Griffo, Almeida, Guizzardi)**: https://nemo.inf.ufes.br/en/projects/ufo-l/ — Listed in §B; re-listed here because it is the most recent sustained attempt at a foundational legal ontology, with particular strength in modeling legal relators (rights-duties-no claims) per Hohfeld.

**PrOnto (Palmirani, Martoni, Rossi, Bartolini, Robaldo, 2018)**: https://link.springer.com/chapter/10.1007/978-3-030-00178-0_9 — GDPR/privacy ontology; relevant as a template for compliance-oriented ontologies that pair with LegalRuleML.

**Eurovoc (Publications Office, SKOS)**: https://op.europa.eu/en/web/eu-vocabularies/eurovoc — Multilingual thesaurus with IP-related concepts, licensed open, downloadable as SKOS.

**Lynx project — Legal Knowledge Graph (H2020, Montiel-Ponsoda, Rodriguez-Doncel)**: https://lynx-project.eu/ — Multilingual legal KG outputs including models for contracts, compliance documents, case law. Good recent EU-funded reference.

**MIREL project (Robaldo, Boella)**: https://www.mirelproject.eu/ — "Mining and Reasoning with Legal Texts" MSCA-RISE project; deliverables include LegalRuleML use, defeasible logic tools, and legal-text-to-rule pipelines.

**Caselaw Access Project (Harvard LIL)**: https://case.law/ — 6.7M US case opinions with structured metadata; data model documented at https://case.law/docs/. Primary ground truth for US case law.

**Cornell LII data model / eCFR**: https://www.law.cornell.edu/ and https://www.ecfr.gov/ — Cornell's LII publishes parsed USC/CFR; eCFR API returns section-level XML that can feed your ingestion pipeline.

**Stanford CodeX**: https://law.stanford.edu/codex-the-stanford-center-for-legal-informatics/ — Active research hub for computable contracts, legal specification languages (Catala, L4, Symboleo).

**Catala (Merigoux, INRIA)**: https://catala-lang.org/ — Domain-specific language for encoding legal rules directly from statute; mostly tax/benefits but the pattern transfers to IP administrative rules (fees, deadlines, form requirements).

## D. IP-specific ontologies and rights-expression languages

**IPROnto (Delgado, Gallego, Llorente, García — UPF/DMAG, 2003)**: https://dmag.ac.upc.edu/ontologies/ipronto/index.html — OWL-DL ontology of digital-rights concepts contributed to the MPEG-21 REL/RDD CfP. 113 classes, ALCHI DL expressivity. Dated but semantically careful.

**IPROnto JURIX paper (2003)**: https://jurix.nl/pdf/j03-12.pdf — Explains the static (classes for contracts, licenses, exploitation/moral rights, legal entity) and dynamic (content life cycle) views.

**Copyright Ontology (Roberto García, Rhizomik)**: https://rhizomik.net/html/ontologies/copyrightonto/ — García's PhD-derived OWL-DL copyright ontology, maintained with version history through 2014. Models work, creation, exploitation, moral rights over the copyright value chain. **Best extant OWL model of substantive copyright concepts; not abandoned but slow-moving**.

**"An OWL Copyright Ontology for Semantic DRM" (García & Gil, 2006)**: https://link.springer.com/chapter/10.1007/11915072_81 — Companion paper.

**ODRL 2.2 Information Model (W3C Rec, Feb 2018)**: https://www.w3.org/TR/odrl-model/ — **The W3C Recommendation for machine-readable permission/prohibition/obligation statements with constraints and duties**. Core model you would reuse wholesale for license-term expression.

**ODRL 2.2 Vocabulary & Expression**: https://www.w3.org/TR/odrl-vocab/ — Companion normative vocabulary.

**ODRL 2.2 Ontology namespace**: https://www.w3.org/ns/odrl/2/ — OWL 2 ontology file.

**ODRL Community Group (active work on v3)**: https://www.w3.org/community/odrl/ — Ongoing profiles (market data, dataspaces) and best-practice docs.

**ODRL Formal Semantics**: https://w3c.github.io/odrl/formal-semantics/ — Evaluator semantics clarifying when a policy is satisfied/violated. Important if you build a license-compatibility checker.

**ODRL Best Practices**: https://w3c.github.io/odrl/bp/ — Implementation guidance with JSON-LD examples.

**ODRL Landscape (evaluators & tooling)**: https://w3c.github.io/odrl/landscape/ — Inventory of ODRL evaluators and compliance checkers as of 2024–2025.

**IPTC RightsML 2.0** (ODRL profile for news): https://iptc.org/std/RightsML/2.0/RightsML_2.0-specification.html — Production profile demonstrating how to extend ODRL for an industry.

**ccREL (Creative Commons Rights Expression Language, W3C Member Submission 2008)**: https://www.w3.org/Submission/ccREL/ — Simpler REL for CC licenses; historically important, largely subsumed by ODRL.

**MPEG-21 REL (ISO/IEC 21000-5) and Media Contract Ontology (MCO)**: https://www.iso.org/standard/42726.html and Delgado et al. papers — Industrial REL heritage; MCO is the OWL/RDF formalization of MPEG-21 media contracts (Rodríguez-Doncel, Delgado, Boch).

**ODRL/License mapping work — Rodríguez-Doncel**: https://rodriguezdoncel.gitlab.io/ — Surveys and tools for modeling software and data licenses in ODRL.

**WIPO Standards (ST.96 XML for IP information)**: https://www.wipo.int/standards/en/ — ST.96 is the XML schema standard for patent, trademark, design, and geographical-indication filings across offices. Your ingest adapter for multi-jurisdictional patent data.

**WIPO Lex**: https://www.wipo.int/wipolex/ — Authoritative database of national IP laws, treaties, and judicial decisions. Primary source for foreign-law corpus building.

**PATENTSCOPE**: https://patentscope.wipo.int/search/ — WIPO's patent search covering PCT + ~70 national collections, with DOCDB-style bibliographic data.

**WIPO Pearl**: https://www.wipo.int/reference/en/wipopearl/ — Multilingual terminology portal for patent terminology in 10 languages. Useful for multilingual enrichment.

**EPO Linked Open EP Data**: https://data.epo.org/linked-data/ — EPO's RDF/SPARQL endpoint exposing European patent register data. **Rare existing linked-data-native IP source; study this for patterns**.

**EPO Open Patent Services (OPS)**: https://www.epo.org/en/searching-for-patents/data/web-services/ops — REST API for bibliographic, full-text, and register data.

**Espacenet**: https://worldwide.espacenet.com/ — EPO public search frontend.

**PATSTAT**: https://www.epo.org/en/searching-for-patents/business/patstat — EPO's worldwide patent statistical database, SQL-queryable; the standard data source for patent analytics.

**USPTO Open Data Portal**: https://data.uspto.gov/ — Official USPTO bulk data, APIs, and datasets.

**PatentsView (USPTO)**: https://patentsview.org/ — USPTO-maintained patent research data with disambiguated inventors and assignees, REST API, bulk downloads.

**Patent Public Search / PatFT / AppFT replacement**: https://ppubs.uspto.gov/pubwebapp/ — Current USPTO search frontend.

**Google Patents Public Datasets (BigQuery)**: https://console.cloud.google.com/marketplace/details/google_patents_public_datasets/google-patents-public-data — Global patent text and bibliographic data in BigQuery, including claim-level and CPC annotations.

**IPC (International Patent Classification, WIPO)**: https://www.wipo.int/classifications/ipc/en/ — Classification scheme; publish as SKOS for your graph. Scheme download: https://www.wipo.int/classifications/ipc/en/ITsupport/.

**CPC (Cooperative Patent Classification, EPO+USPTO)**: https://www.cooperativepatentclassification.org/ — Finer-grained classification used in most examiners' search strategies. **Ingest as SKOS ConceptScheme**; do not OWL-axiomatize the hierarchy.

**Locarno Classification (designs)**: https://www.wipo.int/classifications/locarno/en/ — Industrial design classification.

**Vienna Classification (figurative marks)**: https://www.wipo.int/classifications/vienna/en/ — Image elements in figurative trademarks.

**Nice Classification (trademark goods/services)**: https://www.wipo.int/classifications/nice/en/ — 45 classes, updated annually. **Model as SKOS with annual versions; `skos:exactMatch` across editions where applicable**.

**TMclass (EUIPO harmonized database)**: https://www.tmdn.org/tmclass/ — Harmonized terms across ~80 offices with Nice mapping; available via API.

**TMview / DesignView (EUIPO)**: https://www.tmdn.org/tmview/ and https://www.tmdn.org/tmdsview-web/ — Search across national TM/design registries; APIs available.

**EUIPO Open Data**: https://euipo.europa.eu/ohimportal/en/open-data — Bulk trademark and design data.

**Madrid Monitor (WIPO)**: https://www3.wipo.int/madrid/monitor/en/ — International TM register.

**Hague Express (WIPO)**: https://www.wipo.int/designdb/hague/en/ — International design register.

**UPOV PLUTO database**: https://www.upov.int/pluto/en/ — Plant variety rights.

**SPDX License List**: https://spdx.org/licenses/ — Not IP law per se, but **the canonical machine-readable identifier list for software licenses**; pair with ODRL for expressive semantics.

**Rodríguez-Doncel et al. — "A survey on licenses of Linked Data"**: http://www.semantic-web-journal.net/content/survey-licensing-linked-data — Taxonomy of license-ontology work, with critical assessment of what's reusable.

**"Legal Ontologies" (Casanovas, Rodríguez-Doncel, Palmirani et al.)** surveys — see JURIX proceedings at https://jurix.nl/ and the Artificial Intelligence and Law journal https://link.springer.com/journal/10506 — Primary venue for published IP/legal ontology work. Check AI & Law 2020-2026 for recent LLM-era papers.

**arxiv "patent ontology" / "intellectual property ontology"**: https://arxiv.org/search/?query=patent+ontology&searchtype=all — Recent ML-flavored work; most papers propose task-specific schemas rather than reusable ontologies — be skeptical.

**"An Ontology for the Expression of Intellectual Property Entities and Relations" (Academia.edu)**: https://www.academia.edu/18724521/ — One of the more serious attempts at a unified IP ontology, covering patent, TM, and copyright entities. Useful reference even if you don't adopt it.

## E. IP-law doctrinal sources (primary, for grounding ontology semantics)

### International treaties — all at wipo.int/wipolex

**Paris Convention (1883, as revised)**: https://www.wipo.int/wipolex/en/treaties/details/2 — Priority, national treatment, well-known marks. Grounds priority-date semantics.

**Berne Convention (1886, as revised)**: https://www.wipo.int/wipolex/en/treaties/details/15 — Automatic copyright, minimum rights, Art. 6bis moral rights, three-step test.

**TRIPS Agreement (WTO, 1994)**: https://www.wto.org/english/tratop_e/trips_e/t_agm0_e.htm — Minimum substantive standards across all IP types; the most important single treaty for global harmonization.

**Madrid Agreement + Protocol**: https://www.wipo.int/madrid/en/legal_texts/ — International trademark registration.

**Patent Cooperation Treaty (PCT)**: https://www.wipo.int/pct/en/texts/ — International patent filing system; models priority chains and national-phase entries.

**Hague Agreement (designs)**: https://www.wipo.int/hague/en/legal_texts/ — International design registration.

**UPOV Convention**: https://www.upov.int/upovlex/en/ — Plant variety rights.

**Budapest Treaty (microorganisms)**: https://www.wipo.int/wipolex/en/treaties/details/7 — Patent biological deposits.

**Rome Convention (neighboring rights)**: https://www.wipo.int/wipolex/en/treaties/details/17 — Performers, producers, broadcasters.

**WCT (WIPO Copyright Treaty)**: https://www.wipo.int/wipolex/en/treaties/details/16 and **WPPT**: https://www.wipo.int/wipolex/en/treaties/details/20 — Internet treaties.

**Marrakesh Treaty (accessibility)**: https://www.wipo.int/wipolex/en/treaties/details/843 — Copyright exceptions for visually impaired.

**Beijing Treaty (audiovisual performances)**: https://www.wipo.int/wipolex/en/treaties/details/841.

### United States

**35 U.S.C. (Patents)**: https://www.law.cornell.edu/uscode/text/35 — Cornell LII. Key sections: §101 (eligible subject matter), §102 (novelty), §103 (obviousness), §112 (written description, enablement, definiteness, means-plus-function), §154 (term), §161–164 (plant patents), §171 (design patents), §271 (infringement), §284 (damages), §285 (fees).

**MPEP (Manual of Patent Examining Procedure)**: https://www.uspto.gov/web/offices/pac/mpep/ — Current 9th ed. **Chapter 2100 on patentability is your ontology's most concentrated source of doctrinal constraints on claims, specifications, and prior art**.

**17 U.S.C. (Copyrights)**: https://www.law.cornell.edu/uscode/text/17 — §102 (subject matter), §106 (exclusive rights), §107 (fair use), §108–122 (exceptions), §201–205 (ownership, transfers), §203/304 (termination), §302–305 (duration), §411–412 (registration), §501–513 (infringement and remedies), §512 (DMCA safe harbors).

**US Copyright Office Compendium (3rd ed.)**: https://www.copyright.gov/comp3/ — Registration practice.

**15 U.S.C. §1051 et seq. (Lanham Act)**: https://www.law.cornell.edu/uscode/text/15/chapter-22 — §1052 (registrable marks), §1057 (certificates), §1072 (constructive notice), §1114/1125 (infringement, dilution, cybersquatting).

**TMEP (Trademark Manual of Examining Procedure)**: https://tmep.uspto.gov/ — Current edition.

**18 U.S.C. §1836 et seq. (Defend Trade Secrets Act, 2016)**: https://www.law.cornell.edu/uscode/text/18/1836 — Federal civil cause of action.

**Uniform Trade Secrets Act (1979/1985)**: https://www.uniformlaws.org/acts/trade-secrets — Adopted by nearly all states; definitional baseline.

**37 C.F.R. (Patent and TM rules)**: https://www.ecfr.gov/current/title-37 — Office rules of practice.

**USPTO Patent Trial and Appeal Board / PGR & IPR**: https://www.uspto.gov/patents/ptab — Post-grant review and inter partes review rules in 37 CFR Part 42.

### US case-law landmarks

**Alice Corp. v. CLS Bank (2014)** — §101 abstract-idea framework.
**Mayo v. Prometheus (2012)** — §101 natural-law/natural-phenomenon.
**KSR v. Teleflex (2007)** — obviousness flexibility.
**Phillips v. AWH (Fed. Cir. 2005, en banc)** — claim construction, intrinsic evidence primacy.
**Markman v. Westview (1996)** — claim construction as question of law.
**Nautilus v. Biosig (2014)** — §112 definiteness "reasonable certainty" standard.
**Festo v. Shoketsu (2002)** — prosecution-history estoppel and doctrine of equivalents.
**eBay v. MercExchange (2006)** — four-factor injunction test.
**Feist v. Rural Telephone (1991)** — copyright originality.
**Baker v. Selden (1879)** — idea/expression dichotomy.
**Google v. Oracle (2021)** — fair use of software APIs.
**Warhol v. Goldsmith (2023)** — fair use transformative-purpose narrowing.
**Abercrombie v. Hunting World (2d Cir. 1976)** — spectrum of distinctiveness.
**In re E.I. DuPont DeNemours (CCPA 1973)** — DuPont factors for likelihood of confusion.
All at https://supreme.justia.com/ or https://www.law.cornell.edu/supremecourt/text/.

### European

**European Patent Convention (EPC)**: https://www.epo.org/en/legal/epc — EPO legal basis.

**EPO Guidelines for Examination**: https://www.epo.org/en/legal/guidelines-epc — EPO's counterpart to the MPEP; major updates annually.

**EU Trade Mark Regulation (EUTMR) 2017/1001**: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017R1001.

**Community Design Regulation 6/2002**: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32002R0006.

**InfoSoc Directive 2001/29/EC**: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32001L0029 — Copyright harmonization.

**DSM Directive 2019/790**: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0790 — Arts. 15 (press publishers), 17 (platform liability), text-and-data-mining exceptions.

**EU Trade Secrets Directive 2016/943**: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L0943.

**UK IPO guidance**: https://www.gov.uk/government/organisations/intellectual-property-office.

### Authoritative secondary / treatises (for doctrinal grounding, not for copying)

Chisum, *Patents* (LexisNexis, looseleaf); Nimmer, *Nimmer on Copyright*; McCarthy, *McCarthy on Trademarks*; Milgrim, *Milgrim on Trade Secrets*. **Do not replicate text**; cite conceptually.

### WIPO study guides

**WIPO Intellectual Property Handbook**: https://www.wipo.int/publications/en/details.jsp?id=275 — Free, comprehensive global primer. Excellent "entity list" source for early ontology drafting.

## F. Bridges — property graphs, RDF, and concrete tooling

### Property graph ↔ RDF bridges

**W3C RDF 1.2 WG (RDF-star in progress)**: https://www.w3.org/groups/wg/rdf-star/ — Standard path to quoting triples for provenance and time.

**GQL (ISO/IEC 39075:2024)**: https://www.iso.org/standard/76120.html — The new ISO standard graph query language, convergence point for Cypher/PGQ. FalkorDB and Neo4j both trending toward GQL compatibility.

**openCypher**: https://opencypher.org/ — Community spec FalkorDB implements (see FalkorDB Cypher coverage: https://docs.falkordb.com/cypher/cypher-support.html).

**Neosemantics (neo4j-labs/neosemantics, "n10s")**: https://github.com/neo4j-labs/neosemantics — The reference tool for bidirectional RDF↔LPG translation. **No FalkorDB analog; you would need to build or fork**.

**"Knowledge Graphs" (Hogan, Blomqvist, Cochez et al., 2021)**: https://arxiv.org/abs/2003.02320 — Authoritative 130-page survey bridging LPG and RDF perspectives. Essential single reference.

**Barrasa & Webber — *Building Knowledge Graphs* (Manning, 2023)**: https://www.manning.com/books/building-knowledge-graphs — The practical LPG-centric counterpart.

**Robinson, Webber & Eifrem — *Graph Databases* (O'Reilly)**: https://www.oreilly.com/library/view/graph-databases-2nd/9781491930885/ — Canonical LPG introduction.

**Dave McComb — *The Data-Centric Revolution* and *Software Wasteland***: https://www.semanticarts.com/books/ — Opinionated but useful critiques of application-centric data modeling that motivate Palantir-style ontology thinking.

### Shape/schema/bridge frameworks

**LinkML**: https://linkml.io/linkml/ — **YAML-based schema language that generates OWL, SHACL, JSON Schema, SQL DDL, Python/Pydantic, TypeScript, GraphQL from one source**. Mungall et al. Recently peer-reviewed (GigaScience, 2026: https://academic.oup.com/gigascience/advance-article/doi/10.1093/gigascience/giaf152/8378082). **Strongest candidate for a polyglot schema hub bridging Palantir-style operational models to RDF-style reasoning**.

**LinkML OWL generator**: https://linkml.io/linkml/generators/owl.html — Explicit guidance on closed-world vs. open-world.

**LinkML SHACL generator**: https://linkml.io/linkml/generators/shacl.html — Validation shapes.

**ShEx (Shape Expressions)**: https://shex.io/ — Alternative to SHACL with cleaner semantics for some use cases. Labra Gayo + Prud'hommeaux.

**DCTAP (Dublin Core Tabular Application Profiles)**: https://www.dublincore.org/specifications/dctap/ — Spreadsheet-friendly shape sketching.

**SSSOM (Simple Standard for Sharing Ontology Mappings)**: https://mapping-commons.github.io/sssom/ — Tabular format for ontology/vocabulary crosswalks with rich metadata. Use when mapping IPC↔CPC, Nice editions, or internal-to-standard vocabularies.

**R2RML (W3C Rec)**: https://www.w3.org/TR/r2rml/ and **RML**: https://rml.io/specs/rml/ — RDB/CSV/JSON-to-RDF mappings. Feed structured ingestion.

**Ontop (OBDA platform)**: https://ontop-vkg.org/ — Virtual knowledge graph from SQL via R2RML; SPARQL over relational.

### Editors and authoring

**Protégé / WebProtégé**: https://protege.stanford.edu/ — Free reference OWL editor. Still the standard; clunky but reliable.

**TopBraid EDG / Composer**: https://www.topquadrant.com/products/topbraid-enterprise-data-governance/ — Commercial; strong SHACL tooling.

**Stardog Studio**: https://www.stardog.com/platform/ — Commercial editor tightly integrated with the Stardog DB.

**Menthor Editor (OntoUML)**: https://github.com/MenthorTools/menthor-editor — Desktop OntoUML modeling.

**VS Code Turtle/RDF extensions**: https://marketplace.visualstudio.com/search?term=turtle — Serviceable for day-to-day editing.

### CLI and build tooling

**ROBOT (OBO build tool)**: http://robot.obolibrary.org/ — The industry standard for ontology release pipelines: extract, merge, reason, validate, convert. Fits cleanly in CI/CD.

**OAK / oaklib (INCATools)**: https://github.com/INCATools/ontology-access-kit — Python library for unified access to OBO-world ontologies plus SPARQL and LLM-backed engines. Actively maintained 2024-2026.

**Ontology Development Kit (ODK)**: https://github.com/INCATools/ontology-development-kit — Opinionated project scaffold with ROBOT + GitHub Actions. Even if you're not OBO, steal this template.

### Programming libraries

**Python — RDFLib**: https://rdflib.readthedocs.io/ — Core RDF/SPARQL library.

**Python — Owlready2**: https://owlready2.readthedocs.io/ — OWL manipulation with a Pythonic object interface.

**Python — pySHACL**: https://github.com/RDFLib/pySHACL — Pure-Python SHACL validator.

**Python — LinkML runtime**: https://linkml.io/linkml/developers/manipulating-schemas.html — Schema manipulation and code generation.

**Java — OWL API**: https://github.com/owlcs/owlapi — De facto OWL manipulation library; Protégé sits on it.

**Java — Apache Jena + Fuseki**: https://jena.apache.org/ — Full RDF/SPARQL/reasoning stack; Fuseki is a standalone SPARQL server.

**Java — RDF4J**: https://rdf4j.org/ — Eclipse-hosted alternative to Jena with cleaner APIs.

**JS/TS — rdflib.js**: https://github.com/linkeddata/rdflib.js — Original Solid library, maintained.

**JS/TS — Comunica**: https://comunica.dev/ — Modular federated SPARQL engine in TypeScript; **the most actively developed JS semantic stack**.

**JS/TS — N3.js**: https://github.com/rdfjs/N3.js — Fast Turtle/N3/TriG parser/writer.

**JS/TS — Oxigraph (Rust core with JS/Python bindings)**: https://github.com/oxigraph/oxigraph — Embeddable SPARQL 1.1 database. **Pragmatic choice if you want RDF alongside your LPG without operating a Java server**.

**JS/TS — shacl-engine**: https://github.com/rdf-ext/shacl-engine — Modern SHACL validator in JS.

**JS/TS — sparqljs**: https://github.com/RubenVerborgh/SPARQL.js — SPARQL parser/serializer.

**Effect-TS compatibility note**: **None of the major RDF/SHACL TS libraries have native Effect hooks; you'll wrap them in Effect services yourself**. Oxigraph via its JS bindings is the cleanest candidate because its API is synchronous-ish and exception-based, trivially wrappable with `Effect.try`.

### Reasoners

**HermiT**: http://www.hermit-reasoner.com/ — OWL 2 DL reasoner; the benchmark for correctness.

**ELK**: https://liveontologies.github.io/elk-reasoner/ — OWL 2 EL, very fast. Use if your ontology is EL-profile-compatible.

**Openllet (Pellet fork)**: https://github.com/Galigator/openllet — OWL 2 DL with SWRL and explanation support.

**Konclude**: https://www.derivo.de/en/produkte/konclude/ — High-performance OWL 2 DL.

**RDFox**: https://www.oxfordsemantic.tech/product — Commercial, in-memory, Datalog + OWL 2 RL + SWRL.

### Graph stores

**FalkorDB (your choice)**: https://www.falkordb.com/ — **Redis-module property graph using sparse-matrix + GraphBLAS linear algebra; openCypher with GRAPH.QUERY**. Docs: https://docs.falkordb.com/. Cypher coverage: https://docs.falkordb.com/cypher/cypher-support.html. GitHub: https://github.com/FalkorDB/FalkorDB. Blog: https://www.falkordb.com/blog/graph-database-guide/. **Impedance mismatch to flag**: FalkorDB is LPG-only with no native OWL/SPARQL/SHACL; you will need a parallel RDF store (Oxigraph, Jena Fuseki) or translate shapes into application-level validation code. The `@falkordb/langchain-ts` integration (https://docs.langchain.com/oss/javascript/integrations/tools/falkordb) auto-generates Cypher from NL, the closest analog to AIP Logic's ontology-grounded generation.

**Neo4j**: https://neo4j.com/ — Reference LPG; largest ecosystem; has n10s for RDF bridge.

**Jena Fuseki**: https://jena.apache.org/documentation/fuseki2/ — OSS SPARQL server.

**Oxigraph**: https://github.com/oxigraph/oxigraph — OSS embeddable SPARQL DB in Rust.

**GraphDB (Ontotext)**: https://www.ontotext.com/products/graphdb/ — Commercial; strong RDFS+/OWL 2 RL reasoning, SHACL, FTS.

**Stardog**: https://www.stardog.com/ — Commercial RDF+graph with reasoning, virtualization.

**Virtuoso**: https://virtuoso.openlinksw.com/ — Established RDF/SQL hybrid; powers DBpedia.

**Amazon Neptune**: https://aws.amazon.com/neptune/ — Managed; supports both Gremlin/Cypher (property graph) and SPARQL (RDF) on separate engines.

**AllegroGraph**: https://allegrograph.com/ — Commercial RDF + neuro-symbolic features.

**QLever**: https://github.com/ad-freiburg/qlever — Very fast SPARQL engine from Freiburg, excellent for large KG scans.

### Publication and FAIR

**Linked Open Vocabularies (LOV)**: https://lov.linkeddata.es/dataset/lov/ — Curated registry — check before minting a new property.

**FAIR Principles**: https://www.go-fair.org/fair-principles/ — Findable, Accessible, Interoperable, Reusable; the governance mindset for an enterprise IP ontology.

**VoID**: https://www.w3.org/TR/void/ — Vocabulary of Interlinked Datasets; describe your IP KG with it.

**W3C "Best Practices for Publishing Linked Data"**: https://www.w3.org/TR/ld-bp/ — URI hygiene and content negotiation.

## Strategic conclusion and reuse verdicts

Your architecture should treat **Palantir's object/link/action pattern as the operational surface**, but **express the conceptual model in LinkML** so you can emit OWL+SHACL for formal reasoning and typed Python/TypeScript for runtime code. For the substance of IP law, **LKIF-Core + LegalRuleML + ODRL + LRMoo + IAO together cover ~80% of what you need at the abstract level** (legal acts, norms, rights, works, information artifacts, license terms), while **domain specifics (claim structure, classification, prosecution events) will be native modeling work grounded in MPEP Chapter 2100, the EPO Guidelines, 35/17/15 U.S.C., and the treaty-harmonized WIPO vocabulary**. Classifications like IPC, CPC, Nice, Locarno, and Vienna must be SKOS, never OWL classes. For the graph runtime, FalkorDB gives you fast LPG traversals and GraphRAG ergonomics but **leaves open-world reasoning and SHACL validation outside its native surface** — plan either (a) a companion Oxigraph/Jena instance populated from FalkorDB for offline reasoning and validation, or (b) validation moved into TypeScript SHACL-engine code at the application boundary with Effect-TS orchestration. The highest-leverage single move: **write the competency questions first** (Gruninger & Fox 1995), then adopt LinkML, then reuse LKIF-Core + IAO + LRMoo + ODRL by MIREOT-style slicing rather than wholesale import, and only then start modeling patent/TM/copyright/trade-secret specifics. Resist the temptation to invent what IAO, PROV-O, and ODRL already formalize.
