# Lynx Reference-Ontologies Sweep

**Date:** 2026-08-06
**Scope:** Complete enumeration of <https://lynx-project.eu/data2/reference-ontologies>, plus the two
sibling resource pages it links from the same nav (`/data2/data-models`,
`/data2/domain-independent-vocabularies`), with 2026 availability, licence, and
patent/IP-practice relevance.
**Method:** page fetched and parsed from raw HTML (28,428 bytes) rather than a rendered summary, so the
enumeration is the full table, not a truncation. Every listed hyperlink (`rdf|xml` artifact link and
`doc` link, 30 URLs) was probed with `curl -sL` for HTTP status, content-type, byte size, and final
effective URL. Failures were re-probed with a browser User-Agent to separate bot-blocking from genuine
death, then DNS-checked to separate "domain gone" from "domain resolves, server down". Dead links were
traced to a current home via search + Wayback. Licences were read from the artifact itself
(`LICENSE` file, RDF triples, spec front matter) wherever one exists — not inferred.

---

## 0. Headline findings

1. **The list is 15 ontologies/standards, and it is a survey, not a dependency manifest.** Lynx's own
   LKG ontology imports exactly one of them — ELI. The other 14 were "considered as a reference".
   Treat this page as a landscape scan someone else already did, not as a tested stack.
2. **7 of 15 have at least one dead link; 4 are effectively dead projects.** Metalex, Nomothesia, NIR,
   and CHLexML are no longer live at the cited addresses. CHLexML and NIR were *formally* superseded by
   Akoma Ntoso; Metalex is marked `Archived` on the EU's own catalogue.
3. **Licence reality is better than expected for the parts worth taking.** LKIF-core (CC BY 4.0),
   eu-cbcm (CC BY 4.0), PCO (CC BY 3.0 CZ), and the Lynx LKG ontology itself (CC BY 4.0) are all
   port-with-attribution. Akoma Ntoso and LegalRuleML are OASIS royalty-free. **No copyleft anywhere in
   the list** — there is no clean-room constraint on this corpus.
4. **There is ZERO patent/IP-specific modelling in the entire list.** Nothing here models a patent, a
   claim, prosecution history, prior art, a patent family, or CPC/IPC classification. The patent layer
   is a net-new build that must be grounded in EPO/USPTO/WIPO sources outside Lynx. What this list
   *does* give patent practice is the layer underneath: document structure, legal-source citation with
   temporal validity, norm/right typology, and term lexicography.
5. **The most transferable single idea is not on the ontology list at all** — it is the LKG's use of
   NIF offset-anchored annotation to bind extracted entities back to exact character spans in the
   source document. That is the direct answer to the known in-repo gap where `AnnotatedDocument` drops
   entity char-spans.

---

## 1. Availability ledger — all 15 entries as listed

Status legend: **LIVE** = artifact resolves and returns real content. **MOVED** = dead at the Lynx URL,
current home found. **DEAD** = project and artifact both gone from the live web.

| # | Acronym | Name | Lynx artifact link status | Lynx doc link status | Verdict |
|---|---------|------|---------------------------|----------------------|---------|
| 1 | `akomantoso` | Akoma Ntoso | 200 `application/xml` 244,798 B | 200 | **LIVE** — actively evolving |
| 2 | `cdm` | Common Data Model | 200 (redir → `op.europa.eu`) | 200 | **LIVE** (host renamed) |
| 3 | `chlexml` | CHLexML | **404** | **404** | **MOVED** — and discontinued |
| 4 | `eli` | European Legislation Identifier | 200 only via content negotiation | soft-redirect to landing page | **LIVE** — link rot, not death |
| 5 | `laki` | Finlex Legislation Metadata Schema | 200 `text/turtle` 11,839 B | **dead** (LODE host down) | **LIVE** artifact, dead docs |
| 6 | `legalruleml` | LegalRuleML metamodel | 200 | 200 774,152 B | **LIVE** |
| 7 | `lexdania` | LexDania | 200 `text/xml` 24,681 B | 200 but JS shell, no content | **LIVE** artifact, dead docs |
| 8 | `lexicog` | OntoLex lexicog module | 200 `application/rdf+xml` 19,471 B | 200 57,088 B | **LIVE** |
| 9 | `lkif` | LKIF Legal Core Ontology | 200 | 200 | **LIVE** — actively maintained |
| 10 | `metalex` | CEN Metalex | **no HTTP response** | **no HTTP response** | **DEAD** — archive only |
| 11 | `nomothesia` | Nomothesia (Greek legislation) | **404** | **404** | **DEAD** — code survives |
| 12 | `nir` | Norme In Rete | **placeholder URL, never real** | **no HTTP response** | **MOVED** — superseded |
| 13 | `oikeus` | Finlex Case-law Metadata Schema | 200 `text/turtle` 7,610 B | **dead** (LODE host down) | **LIVE** artifact, dead docs |
| 14 | `pco` | Public Contracts Ontology | 200 49,867 B | 200 | **LIVE** but frozen 2017 |
| 15 | `eu-cbcm` | EU Cross-border Company Mobility | **404** (bad tag path) | 200 | **MOVED** — newer release exists |

Supporting Lynx infrastructure, probed at the same time:

| Endpoint | URL | Status |
|----------|-----|--------|
| LKG document browser | <http://lkg.lynx-project.eu/> | 200 |
| LKG terminologies (KOS) | <http://lkg.lynx-project.eu/kos> | 200, 84,654 B |
| SPARQL endpoint | <http://sparql.lynx-project.eu> | 200 |
| Data portal (CKAN) | <http://data.lynx-project.eu> | **DEAD** — DNS resolves (138.100.15.170), server does not respond |
| LKG ontology spec | <https://lynx-project.eu/doc/lkg/> | 200, 152,190 B |

---

## 2. Grouped catalogue

### 2.1 Legislative document standards — XML markup layer

These describe *how a statute is marked up as a document*, not what it means. They are structural
schemas, largely national, and they are the part of this list that has consolidated hardest around
Akoma Ntoso.

#### Akoma Ntoso — `akomantoso`
- **Domain:** legislation, parliamentary, and judicial document structure (XML vocabulary)
- **Maintainer/origin:** OASIS LegalDocumentML (LegalDocML) TC; originally a UN-DESA initiative for
  African parliaments
- **Canonical URL:** <https://www.oasis-open.org/standard/akn-v1-0/>;
  schema <https://docs.oasis-open.org/legaldocml/akn-core/v1.0/cs01/part2-specs/schemas/akomantoso30.xsd>;
  project site <http://www.akomantoso.org/>; TC page
  <https://www.oasis-open.org/committees/tc_home.php?wg_abbrev=legaldocml>
- **Availability 2026:** **LIVE and the most actively developed item on the list.** The XSD returns
  244,798 bytes of real schema. OASIS issued an invitation to comment on **Akoma Ntoso v2.0 Part 2
  (AKN 3.1)** before the call for consent as an OASIS Standard in **July 2026** —
  <http://www.oasis-open.org/2026/07/16/invitation-to-comment-on-akoma-ntoso-v2-0-part-2-akn-3-1-before-call-for-consent-as-oasis-standard/>
- **Licence:** OASIS IPR Policy, **RF on Limited Terms** (royalty-free) mode —
  <https://www.oasis-open.org/policies-guidelines/ipr/>. Permissive for implementation;
  spec text itself carries OASIS copyright with a reproduction grant. **Port-with-attribution** for the
  model; do not republish spec prose verbatim without the OASIS notice.
- **What it models:** A technology-neutral XML vocabulary for the full lifecycle of parliamentary,
  legislative, and judicial documents. It separates the document's *structural* hierarchy (part,
  chapter, article, paragraph, subparagraph) from its *semantic* markup (references, dates, roles,
  quoted structures, amendments) and its *metadata* block. It carries an FRBR-derived
  Work/Expression/Manifestation split so that "the Act", "the 2018 consolidated version in Spanish",
  and "this PDF" are distinct addressable things, and a naming convention that turns that split into
  resolvable URIs. Judicial documents get a first-class content model — introduction, background,
  motivation, decision — which is why Lynx used `akn:` predicates for Spanish Supreme Court judgments.
- **AKN4EU:** the EU's profile of Akoma Ntoso for inter-institutional legislative exchange —
  <https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http://publications.europa.eu/resource/dataset/akn4eu> (200)

#### CEN Metalex — `metalex`
- **Domain:** legislation, open XML interchange format + FRBR ontology
- **Maintainer/origin:** CEN Workshop Agreement CWA 15710:2010; workshop led from the University of
  Amsterdam (Alexander Boer, Rinke Hoekstra et al.)
- **Canonical URL (as listed, now dead):** <http://www.metalex.eu/> and
  <http://www.metalex.eu/metalex-cen.owl>
- **Availability 2026:** **DEAD.** `metalex.eu` resolves in DNS (145.100.130.13) but returns no HTTP
  response over either scheme; `doc.metalex.eu` (the MetaLex Document Server) is likewise unreachable.
  The EU's own catalogue entry is marked **Archived**, status "Completed", last update **08/12/2015** —
  <https://interoperable-europe.ec.europa.eu/collection/european-committee-standardization-cen/solution/metalex-open-xml-interchange-format-legal-and-legislative-resources>
  and <https://interoperable-europe.ec.europa.eu/collection/eu-semantic-interoperability-catalogue/solution/cen-metalex>
- **Current home:** archive only. The OWL is preserved at
  <https://web.archive.org/web/20201230160320/http://www.metalex.eu/metalex-cen.owl> (200, 56,636 bytes)
  and the site at <https://web.archive.org/web/20201230160320/http://www.metalex.eu/>. The CWA document
  itself is mirrored at
  <https://docs.vlaamsparlement.be/docs/biblio/opendigibib/monografie/2011/365_cwa15710.pdf>
- **Licence:** **UNKNOWN.** Neither the archived site nor the EU catalogue entry states a licence.
  → **reference-only.**
- **What it models:** A jurisdiction-neutral interchange format for sources of law and references to
  sources of law, plus an ontology that formalises the FRBR levels for legislation and an *event model
  for legislative modification* — how one act amends, repeals, or consolidates another over time.
  **Its afterlife is more important than its site:** ELI's own OWL states that it "reuses the property
  names from the Metalex ontology (http://www.metalex.eu/) to express the FRBR skeleton hierarchy:
  is_realized_by/realizes". Metalex is dead as a project but alive as ELI's substrate.

#### CHLexML — `chlexml`
- **Domain:** legislation (Swiss federal/cantonal legal acts), XML schema
- **Maintainer/origin:** eCH e-Government Standards association (Switzerland), with Verein eJustice.CH
- **Canonical URL (as listed):** two `ech.ch/alfresco` node-id download links — **both return HTTP 404**
- **Availability 2026:** **MOVED, and the standard is discontinued.** The Alfresco document-store URLs
  Lynx cited are gone (`ech.ch` itself is fine — 200 — so this is link rot from a CMS migration).
  Work on CHLexML as the standard for publishing legal provisions **was definitively discontinued and
  the project ended in November 2017**; the Federal Chancellery signalled as early as 2013 that it
  would adopt **Akoma Ntoso** instead for renewing federal official publications.
- **Current home:** standard record `eCH-0095 CHLexML V1.0` at <https://ech.ch/de/ech/ech-0095/1.0>
  (200); spec PDF at
  <https://ejustice.ch/wp-content/uploads/2024/10/STAN_d_DRA_2016-05-03_eCH-0095_V1.0_CHLexML.pdf>
  (200, 218,153 bytes); overview at <https://ejustice.ch/chlexml/> (200)
- **Licence:** eCH standards are published free of charge by the eCH association; no SPDX-style licence
  is attached. → **reference-only.**
- **What it models:** Building blocks for reproducing Swiss statutory texts in both content and
  structure — the article/paragraph/letter hierarchy of Swiss legal acts, with the multilingual
  (de/fr/it) parallelism Swiss law requires. Superseded; of historical interest only.

#### LexDania — `lexdania`
- **Domain:** legislation (Danish ministerial regulations), XML schema family
- **Maintainer/origin:** Danish Ministry of Justice (Retsinformation) — the schema's own annotation
  names the development committee: "Nina Koch, Retsinformation (Ministry of Justice); Ole Lianee, CSC"
- **Canonical URL:** schema
  <https://www.retsinformation.dk/offentlig/xml/schemas/2016/09/26/LexDania_2.1.xsd> (200, `text/xml`,
  24,681 bytes); doc link <https://www.lovtidende.dk/Forms/L0500.aspx?page=5>
- **Availability 2026:** **Artifact LIVE, documentation effectively dead.** The XSD downloads cleanly
  and is real. The `lovtidende.dk` doc link returns 200 but only a JavaScript app shell
  ("You need to enable JavaScript to run this app") — the deep link no longer addresses any content.
- **Licence:** **UNKNOWN** — Danish public-sector schema with no attached licence statement.
  → **reference-only.**
- **What it models:** A layered ("stratified") XML schema architecture behind the Danish legal
  information portal, defining the document types of Danish ministerial regulations and consolidated
  acts. Notable design point: LexDania is a *family* of schemas built from a shared base rather than a
  single monolith, letting each document type constrain a common vocabulary.

#### Norme In Rete — `nir`
- **Domain:** legislation (Italian normative documents), XML + URN identification standard
- **Maintainer/origin:** Italian "Norme in Rete" project (launched 2001 by the Ministry of Justice and
  AIPA/CNIPA); guidelines authored at CIRSFID, University of Bologna (Fabio Vitali et al.)
- **Canonical URL (as listed):** the XSD link is
  `http://www.private.you-know-italians.xsd` — **a placeholder joke, never a real URL**; the doc PDF at
  `vitali.web.cs.unibo.it` returns no HTTP response (host resolves to `loewng.cs.unibo.it`,
  130.136.1.142, server down)
- **Availability 2026:** **MOVED / superseded.** `normattiva.it` — the portal Lynx cites as the NIR
  consumer — is alive: <https://www.normattiva.it/> (200), <https://www.normattiva.it/staticPage/codifica>
  (200). But NIR itself has been superseded: Akoma Ntoso in its latest version replaced the XML markup
  format issued by AIPA's Circular of 22 April 2002.
- **Current home:** AgID guidelines for marking up normative documents —
  <https://www.agid.gov.it/sites/default/files/repository_files/linee_guida/linee_guida_marcatura_documenti_normativi_0.pdf>
  (200, 2,403,268 bytes); the current Normattiva XML/URN standard documentation at
  <https://lg-normattiva.readthedocs.io/> (200)
- **Licence:** Italian public-administration guidelines; no explicit reuse licence.
  → **reference-only.**
- **What it models:** Two things, and the second outlived the first. (a) An XML DTD/schema for Italian
  laws, decrees, and regulations. (b) A **URN-based unique identification scheme** for normative
  references — `urn:nir:stato:legge:2000-01-07;1` — that lets a citation inside one act resolve to
  another act without a registry lookup. That URN idea is one of the acknowledged principal
  inspirations for Akoma Ntoso's naming convention, and it is the transferable part.

---

### 2.2 Legal-resource metadata ontologies — RDF citation and identity layer

This is the layer that answers "what *is* this legal document, which version, in force when, and how do
I cite it". For a legal knowledge graph this is the load-bearing group.

#### European Legislation Identifier — `eli` ⭐
- **Domain:** legislation metadata, identification, and temporal versioning (OWL ontology + URI templates)
- **Maintainer/origin:** Publications Office of the European Union, under Council conclusions inviting
  Member States to adopt ELI
- **Canonical URL:** namespace `http://data.europa.eu/eli/ontology#`. The Lynx links
  (`publications.europa.eu/mdr/eli/`) now soft-redirect to a generic EU Vocabularies landing page, which
  reads as link rot — but the ontology **is** retrievable by following content negotiation:
  `http://data.europa.eu/eli/ontology` → 301 → `https://data.europa.eu/eli/ontology` → 307 →
  `http://publications.europa.eu/resource/distribution/eli/owl/owl/eli.owl` → 303 →
  `http://publications.europa.eu/resource/cellar/917d16b5-28f6-11e8-b5fe-01aa75ed71a1.0001.01/DOC_1`
  → **200 `application/rdf+xml`, 166,991 bytes**. URI templates spec:
  <http://publications.europa.eu/mdr/eli/documentation/uri_templates.html>
- **Availability 2026:** **LIVE.** Retrieved OWL carries `owl:versionInfo` values through **v1.5**.
- **Licence:** not stated inside the OWL. Publications Office material falls under the Commission's
  reuse policy (Decision 2011/833/EU). → treat as **reference-only until the reuse notice is confirmed
  in writing**; the *model* (class/property design) is freely reimplementable regardless.
- **What it models:** A descriptive framework for legislative resources built on FRBR:
  `eli:LegalResource` (the abstract act) → `eli:LegalExpression` (a language/version realisation) →
  `eli:Format` (a manifestation). Two features make it disproportionately valuable. First,
  **arbitrary-depth subdivision addressing**: `eli:LegalResourceSubdivision` with
  `eli:has_part`/`eli:is_part_of` models "a component of a legal act, at an arbitrary level of
  precision, like a chapter, an article, an alinea, a paragraph or a list item", and the URI templates
  make that addressable —
  `http://data.europa.eu/eli/dir/2000/31/art_1/par_2/oj`. Second, **temporal force**: `eli:in_force`
  distinguishes resources in force, partially in force, and repealed, so a query can ask what the law
  *was* on a date rather than only what it is now.
- **Why it matters here:** ELI is the only item on this list that Lynx's own LKG ontology actually
  imports, and Lynx explicitly chose it because it satisfied both the "metadata and content" and the
  "split till article level or equivalent" requirements — see <https://lynx-project.eu/data2/data-models>.

#### Common Data Model — `cdm`
- **Domain:** publication/bibliographic metadata for EU legal and official documents
- **Maintainer/origin:** Publications Office of the European Union
- **Canonical URL:** <https://op.europa.eu/en/web/eu-vocabularies/cdm> (200 — the Lynx
  `publications.europa.eu` link redirects here); dataset URI
  `http://publications.europa.eu/resource/dataset/cdm`
- **Availability 2026:** **LIVE** (host renamed `publications.europa.eu` → `op.europa.eu`; the old link
  still redirects). The page does not surface a version number, date, or direct OWL download; the
  files are distributed through the Cellar repository and ShowVoc
  (<https://showvoc.op.europa.eu/>, 200).
- **Licence:** **no licence statement on the page** — subject to the general Commission reuse policy.
  → **reference-only.**
- **What it models:** The ontology governing metadata for every resource in **Cellar**, the Publications
  Office's common repository — EUR-Lex acts, the Official Journal, EU case law, TED notices. Like ELI it
  is FRBR-based (Work / Expression / Manifestation / Item), but it is far broader and more
  publisher-centric: it models the relationships between the resource *types* the Office manages and
  their editorial views, not the internal structure of a legal text. In practice CDM is the metadata
  backbone behind EUR-Lex, and ELI is the interoperable public face of a subset of it.

#### Finlex Legislation Metadata Schema — `laki`
- **Domain:** legislation metadata (Finland), RDF schema
- **Maintainer/origin:** Semantic Finlex — Semantic Computing Research Group (SeCo), Aalto University /
  University of Helsinki (HELDIG), with the Finnish Ministry of Justice and Ministry of Finance
- **Canonical URL:** <http://purl.org/finlex/schema/laki/> — **200 `text/turtle`, 11,839 bytes**. The
  PURL content-negotiates to a SPARQL `CONSTRUCT` against the Linked Data Finland platform
  (`http://ldf.fi/schema/sparql`), which returns the schema as Turtle.
- **Availability 2026:** **Artifact LIVE, Lynx's documentation link DEAD.** Lynx pointed at LODE
  renderings on `eelst.cs.unibo.it` / `essepuntato.it`, and that host no longer responds. Live context
  instead: <https://seco.cs.aalto.fi/linkeddata/finnishlaw/> (200) and the current Finnish open legal
  data service <https://data.finlex.fi/> (200).
- **Licence:** **not stated in the RDF** (inspected — the returned Turtle contains labels and structure
  but no `dct:license` or `dct:rights` triple), and not stated on the Finlex landing page.
  → **reference-only.**
- **What it models:** The class and property vocabulary for Finnish statutes as linked data, built on
  the European ECLI and ELI standards. The retrieved Turtle shows a bilingual (fi/en) labelled
  vocabulary covering statute subdivision types (`Osa`/Part, `Alakohta`/Subparagraph,
  `Johdanto`/Preamble, `Johtolause`/Enacting clause, `Asetus`/Decree) and — the interesting part —
  **amendment and citation relations**: "Repeals statute (item)"
  (`Kumoaa säädöksen tai säädöksen kohdan`), "Refers to statute (item)", "Has reference", "Entry into
  force statute". That is an explicit graph of legislative change, modelled at item granularity.

#### Nomothesia — `nomothesia`
- **Domain:** legislation (Greek), OWL ontology + linked data platform
- **Maintainer/origin:** Department of Informatics and Telecommunications, National and Kapodistrian
  University of Athens (Ilias Chalkidis, Manolis Koubarakis et al.)
- **Canonical URL (as listed):** <http://legislation.di.uoa.gr/> and
  `http://legislation.di.uoa.gr/legislation.owl` — **both 404**; the alternate
  `http://legislation.di.uoa.gr/nomothesia.owl` cited in the literature is also **404**. The host
  resolves (88.197.53.231, `teleios2.di.uoa.gr`) and answers HTTP, so the server is up and the
  application is gone.
- **Availability 2026:** **DEAD as a service; source survives.** Current home:
  <https://github.com/iliaschalkidis/nomothesia> (200) — **Apache-2.0**, last pushed **2016-11-19**;
  API at <https://github.com/iliaschalkidis/nomothesia-api>. Primary paper: "Modeling and Querying
  Greek Legislation using Semantic Web Technologies", ESWC 2017 —
  <https://cgi.di.uoa.gr/~koubarak/publications/2017/eswc17-legislation.pdf>
- **Licence:** platform code **Apache-2.0** (permissive, port-with-attribution). The OWL file itself is
  no longer retrievable to confirm its own licence header. → code permissive, ontology **reference-only**
  until a copy is recovered.
- **What it models:** An OWL ontology adopting the ELI framework to represent the *content* of Greek
  legislation documents — the article/paragraph hierarchy — alongside their metadata (title, government
  gazette issue, publication date) and the modification relations between acts. It is the clearest
  published example of "take ELI, extend it for one national corpus", which makes it a useful design
  precedent even though the deployment is gone.

---

### 2.3 Case law

#### Finlex Case-law Metadata Schema — `oikeus`
- **Domain:** case law metadata (Finland), RDF schema
- **Maintainer/origin:** Semantic Finlex — SeCo, Aalto University, with the Finnish Ministry of Justice
- **Canonical URL:** <http://purl.org/finlex/schema/oikeus/> — **200 `text/turtle`, 7,610 bytes**, same
  PURL→`ldf.fi` content-negotiation route as `laki`
- **Availability 2026:** **Artifact LIVE, documentation link DEAD** (same dead LODE host as `laki`).
  Current portal <https://data.finlex.fi/> (200). Downstream successor project: **LawSampo** —
  <https://ceur-ws.org/Vol-3257/paper5.pdf>
- **Licence:** **not stated in the RDF.** → **reference-only.**
- **What it models:** The counterpart vocabulary to `laki`, covering Finnish court decisions — Supreme
  Court and Supreme Administrative Court judgments — as linked data keyed on **ECLI** (European Case Law
  Identifier). It carries the decision's identity, court, date, keywords, and the crucial cross-link
  from a decision to the statute sections it applies, which is what makes Semantic Finlex a graph
  rather than two disconnected datasets.
- **Note on the gap:** Lynx's own data-models page concedes the weakness of this whole area — "There is
  no relevant source of data except for some courts. No court has been considered in particular in the
  specs" — and fell back to modelling case law with ELI classes plus Akoma Ntoso predicates
  (`akn:meta`, `akn:heading`, `akn:introduction`, `akn:background`, `akn:motivation`, `akn:decision`).
  **There is no dedicated case-law ontology on this list.** See
  <https://lynx-project.eu/data2/data-models>.

---

### 2.4 Norms, rules, and legal upper ontology

This is the "what does the law *mean*" layer, and it contains the two most intellectually valuable
items on the list.

#### LKIF Core — `lkif` ⭐
- **Domain:** legal upper ontology / basic legal concepts (OWL DL)
- **Maintainer/origin:** originally the EU FP6 **ESTRELLA** project; repository maintained by Rinke
  Hoekstra
- **Canonical URL:** <https://github.com/RinkeHoekstra/lkif-core>
- **Availability 2026:** **LIVE and genuinely maintained** — 167 stars, **last pushed 2026-02-23**, not
  archived. Ships every module in both `.owl` and `.ttl`.
- **Licence:** **CC BY 4.0** — confirmed by reading the repository `LICENSE` file directly, which opens
  "Attribution 4.0 International". (The GitHub API reports `license: None` because the file is the bare
  CC legal text without a detectable SPDX header — do not trust the API here.)
  → **PORT-WITH-ATTRIBUTION.** This is the most permissively licensed substantive legal ontology on the
  list.
- **What it models:** 15 interlocking OWL modules layered from abstract to legal.
  *Abstract:* `top`, `place`, `mereology` (parts/wholes, containment, membership), `time` (an OWL DL
  implementation of Allen's interval theory), `spacetime`.
  *Basic:* `process` (changes, causal processes, physical objects), `role` (a typology of epistemic
  roles, functions, person roles, organisation roles, plus a `plays` relation), `action` (processes
  performed by an agent), `expression` (propositions, propositional attitudes — belief, intention —
  qualifications, statements, media).
  *Legal:* `legal-action` (public acts, public bodies, legal person, natural person),
  `legal-role` (legal professions), and **`norm`** — the payload — which defines norms as
  qualifications over the expression module, enumerates legal sources (legal documents, customary law),
  and supplies **a typology of rights and powers** grounded in Sartor (2006) and Rubino et al. (2006).
  *Framework:* `time-modification` (how legal expressions change over time) and `rules`.
- **Why it matters here:** the `norm` + `role` + `legal-action` triple is a ready-made, CC BY,
  Hohfeld-flavoured vocabulary for obligations, permissions, rights, and powers — and a patent is
  precisely a legal power held by a role-filler over a subject matter. This is the one item on the list
  that is both directly relevant *and* cleanly portable.

#### LegalRuleML — `legalruleml`
- **Domain:** legal norms as machine-executable rules (XML + RDF abstract syntax)
- **Maintainer/origin:** OASIS LegalRuleML TC (extends RuleML)
- **Canonical URL:** spec
  <https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html>
  (200, 774,152 bytes — the version-neutral URL Lynx cites resolves to this OASIS Standard text);
  RDFS serialisation
  <https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/csprd02/rdfs/> (200)
- **Availability 2026:** **LIVE**
- **Licence:** OASIS IPR Policy, royalty-free mode —
  <https://www.oasis-open.org/policies-guidelines/ipr/>. → **port-with-attribution** for the model.
- **What it models:** A metamodel that "captures the common meaning of domain terms as understood in the
  legal field, formalizes the connections among the various concepts and their representation in the
  language, and provides an RDF-based abstract syntax". Concretely it adds to plain rule languages the
  things law actually needs: **deontic operators** (obligation, permission, prohibition, right),
  **defeasibility** (a rule can be overridden by another — the exception structure of legal reasoning),
  **temporal parameters** (when the norm was enacted, when efficacious, when applicable to facts),
  **authorship and jurisdiction** (which authority issued the norm, where it binds), **alternatives**
  (penalties, reparations), and **isomorphism** — an explicit traceable link from each formal rule back
  to the natural-language provision it formalises.
- **Assessment:** the deontic + defeasible + isomorphism triad is the correct conceptual frame for
  encoding examination rules. The XML serialisation is heavyweight; take the concepts, not the syntax.

---

### 2.5 Contracts and procurement

#### Public Contracts Ontology — `pco`
- **Domain:** public procurement contracts (RDF/OWL)
- **Maintainer/origin:** Czech **OpenData.cz** initiative, developed under the EU **LOD2** project
- **Canonical URL:** <https://github.com/opendatacz/public-contracts-ontology>;
  RDF <https://raw.githubusercontent.com/opendatacz/public-contracts-ontology/master/public-contracts.rdf>
  (200, 49,867 bytes); also `.ttl`, an XSD for datatypes, `mappings/`, `modules/`, `schemes/`
- **Availability 2026:** **LIVE but frozen** — last pushed **2017-03-16**, 19 stars.
- **Licence:** **CC BY 3.0 CZ** — stated in the repository README: "The ontology is licenced under the
  terms of [Creative Commons By 3.0 licence](http://creativecommons.org/licenses/by/3.0/cz/). This is an
  open licence that allows to use, re-use, and re-distribute its contents subjected only to the
  requirement of attribution." → **PORT-WITH-ATTRIBUTION.**
- **What it models:** Structured data about the public-procurement lifecycle in RDF — the contracting
  authority, the tender notice, lots, criteria, bids, the awarded supplier, the contract, and attached
  payments. It deliberately reuses **GoodRelations** for business entities and prices, the UK
  **Payments Ontology** for spending, and TED (Tenders Electronic Daily) terminology for the
  procurement vocabulary. A design cookbook lives in the repo wiki; the LOD2 deliverable report is at
  <http://static.lod2.eu/Deliverables/deliverable-9a.1.1.pdf>.
- **Caveat:** this is *procurement*, not contracts-in-general. Lynx's own assessment of the contract
  landscape is blunt and worth quoting: "None of the existing contract ontologies fully satisfy the
  requirements of Lynx. In particular, the OMG Contracts Ontology intended for the financial sector
  does not provide a property/class to represent contract parts. The Media Contract Ontology, in the
  other hand, was thought for a specific type of contract and bundles many elements of no interest"
  (<https://lynx-project.eu/data2/data-models>). **Contract-part/clause modelling is an open gap in this
  entire landscape.**

---

### 2.6 Company law

#### EU Cross-border Company Mobility Ontology — `eu-cbcm`
- **Domain:** EU company law, cross-border corporate mobility (OWL)
- **Maintainer/origin:** Maastricht University Institute of Data Science (MaastrichtU-IDS)
- **Canonical URL:** docs <https://maastrichtu-ids.github.io/cbcm-ontology/> (200);
  repo <https://github.com/MaastrichtU-IDS/cbcm-ontology>
- **Availability 2026:** **MOVED — the Lynx artifact link is broken and outdated.** Lynx points at
  `releases/download/1.0/eu-cm-ontology_owlxml.owl`, which **404s** because the actual tag is `v1.0`,
  not `1.0`. More importantly the current release is **v1.2.2**, shipping five serialisations:
  <https://github.com/MaastrichtU-IDS/cbcm-ontology/releases/download/v1.2.2/eu-cmo-rdfxml-v1.2.2.owl>
  (plus turtle, JSON-LD, Manchester, OWL/XML). Last pushed 2022-02-11.
- **Licence:** **CC BY 4.0** — declared in the repository `LICENSE` and confirmed via the GitHub API
  (`spdx_id: CC-BY-4.0`). → **PORT-WITH-ATTRIBUTION.**
- **What it models:** Terminology drawn from EU company law governing how companies move across
  internal-market borders — cross-border mergers, divisions, and conversions/transfers of registered
  office, as harmonised by the Company Law Directive. It formalises the actors (company, member,
  creditor, employee, competent authority), the procedural steps and their required documents (draft
  terms, expert report, pre-conversion certificate), and the safeguards attached to each. The repo also
  ships `cbcm_ontology_terms_flatlist.csv` and tooltip texts — i.e. a term glossary layer alongside the
  OWL.

---

### 2.7 Lexical / terminological

#### OntoLex lexicog module — `lexicog` ⭐
- **Domain:** lexicography — dictionaries and lexical resources as linked data (RDF)
- **Maintainer/origin:** W3C **Ontology Lexicon (OntoLex) Community Group**; module editor Jorge Gracia
- **Canonical URL:** namespace <http://www.w3.org/ns/lemon/lexicog> (200, `application/rdf+xml`,
  19,471 bytes); specification <https://jogracia.github.io/ontolex-lexicog/> (200, 57,088 bytes); W3C
  copy <https://www.w3.org/2019/09/lexicog/>
- **Availability 2026:** **LIVE.** (Note: `w3.org` HTML pages return 403 to a plain curl UA — that is
  bot mitigation, not death; the RDF namespace itself serves correctly.)
- **Licence:** **no licence or copyright statement in the specification document** (checked). W3C
  Community Group reports are normally governed by the W3C Community Contributor License Agreement /
  Community Final Specification Agreement rather than an SPDX licence.
  → treat the vocabulary as freely usable by W3C CG convention, but **reference-only** for verbatim
  spec text.
- **What it models:** An OntoLex-lemon module for representing the *editorial structure* of a
  dictionary, as distinct from its linguistic content. Core OntoLex gives you `ontolex:LexicalEntry`
  and `ontolex:LexicalSense`; lexicog adds `LexicographicResource`, `LexicographicComponent`, and
  `Entry` so you can say **how** an entry is arranged in the specific resource it came from — headword
  vs. sub-entry, sense ordering, nesting — and thereby round-trip a real dictionary without flattening
  its structure. It composes with `vartrans` (translation and variation relations) and **LexInfo**
  (<https://lexinfo.net/ontology/3.0/lexinfo>, 200, 624,876 bytes) as the linguistic-category registry.
- **Lynx's use of it:** the domain-independent vocabularies page documents converting K Dictionaries /
  Lexicala multilingual data (Dutch, English, German, Spanish) from XML → JSON → JSON-LD under
  OntoLex-lemon + lexicog + vartrans + LexInfo + a custom KD ontology, validated iteratively by SPARQL
  queries. The resulting lexical graph drives query expansion (synonyms, inflections), ad-hoc
  terminology construction, and word-sense disambiguation in the Lynx search services.
  See <https://lynx-project.eu/data2/domain-independent-vocabularies> and
  <https://kln.lexicala.com/kln28/lonke-bosque-gil-ontolex-lemon-lexicog/>

---

## 3. Beyond the list — what the sibling pages add

The `reference-ontologies` page is only one third of Lynx's model documentation. Two sibling pages in
the same nav name additional vocabularies that never appear in the 15-row table but *are* part of
Lynx's actual design reasoning. Recording them here so the enumeration is not artificially bounded by
one table.

From **<https://lynx-project.eu/data2/data-models>**:

| Vocabulary | URL | Lynx's verdict |
|-----------|-----|----------------|
| OMG Contracts Ontology (FIBO) | <https://semanticommunity.info/Data_Science/Data_Science_for_FIBO/Financial_Industry_Business_Ontology_Foundations#10.8.2_Ontology:_Contracts> | Rejected — "does not provide a property/class to represent contract parts" |
| Media Contract Ontology (MCO, MPEG-21) | <http://www.semantic-web-journal.net/content/overview-mpeg-21-media-contract-ontology-1> | Rejected as primary — "thought for a specific type of contract and bundles many elements of no interest"; used for the sample encoding anyway |
| W3C Organization Ontology | `http://www.w3.org/TR/vocab-org/` | **Adopted** — "should be the data model of choice" for organisations, linked to PermID where possible |
| ISO 639 / ISO 3166 | — | Adopted as literals for language and jurisdiction; ELI's `eli:jurisdiction` is "the preferred form" over CreativeCommons' or OMG's |
| GeoNames / DBpedia | — | Adopted for geographic areas |

Lynx also flags two things it *needed and did not have*: "The GDPR in a structured form" and "A list of
types of clauses with respect to GDPR aspects."

From **<https://lynx-project.eu/data2/domain-independent-vocabularies>**: OntoLex-lemon core
(<https://www.w3.org/2016/05/ontolex/>), the `vartrans` module, **LexInfo 3.0**
(<https://lexinfo.net/ontology/3.0/lexinfo>), and a bespoke K Dictionaries ontology for categories
LexInfo lacked.

And the **LKG ontology itself** (<https://lynx-project.eu/doc/lkg/>) — namespace
`http://lkg.lynx-project.eu/def/`, **version 1.2**, **CC BY 4.0**
(`http://purl.org/NET/rdflicense/cc-by4.0`) — reuses:

| Prefix | Namespace |
|--------|-----------|
| `eli` | `http://data.europa.eu/eli/ontology#` |
| `nif` | `http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#` |
| `itsrdf` | `https://www.w3.org/2005/11/its/rdf#` |
| `prov` | `http://www.w3.org/ns/prov#` |
| `dct` / `dc` | `http://purl.org/dc/terms/`, `http://purl.org/dc/elements/1.1/` |
| `foaf` | `http://xmlns.com/foaf/spec/` |
| `vann` | `http://purl.org/vocab/vann/` |

**This is the single most important structural fact in the sweep:** of 15 surveyed reference ontologies,
the production LKG imports exactly one (ELI). Everything else in its actual model comes from generic
semantic-web infrastructure — NIF for text anchoring, ITS-RDF for entity linking, PROV for provenance,
Dublin Core for metadata. The legal-domain specificity lives in ELI plus Lynx's own classes.

---

## 4. Licence ledger and port discipline

| Ontology | Licence | Evidence | Port discipline |
|----------|---------|----------|-----------------|
| LKIF-core | **CC BY 4.0** | repo `LICENSE` reads "Attribution 4.0 International" | **port-with-attribution** |
| eu-cbcm | **CC BY 4.0** | GitHub API `spdx_id: CC-BY-4.0` + `LICENSE` | **port-with-attribution** |
| Lynx LKG ontology | **CC BY 4.0** | declared in spec, `purl.org/NET/rdflicense/cc-by4.0` | **port-with-attribution** |
| PCO | **CC BY 3.0 CZ** | README licence section, verbatim | **port-with-attribution** |
| Nomothesia (platform code) | **Apache-2.0** | GitHub API | **port-with-attribution**; ontology file itself unrecoverable |
| Akoma Ntoso | **OASIS IPR, RF on Limited Terms** | OASIS IPR policy + TC mode | **port-with-attribution** (model); keep OASIS notice on spec text |
| LegalRuleML | **OASIS IPR, royalty-free** | same | **port-with-attribution** (model) |
| lexicog / OntoLex | **no statement**; W3C CG convention | spec carries no copyright/licence block | **reference-only** for text; vocabulary use is conventional |
| ELI | **not stated in OWL**; EU reuse policy | inspected 166,991-byte OWL | **reference-only** pending written confirmation |
| CDM | **not stated**; EU reuse policy | page carries no licence | **reference-only** |
| laki / oikeus | **not stated in RDF** | inspected returned Turtle — no `dct:license`/`dct:rights` | **reference-only** |
| CHLexML (eCH-0095) | eCH free publication, no SPDX | eCH standard record | **reference-only** |
| LexDania | **unknown** | no statement anywhere | **reference-only** |
| NIR | Italian PA guidelines, no reuse licence | AgID guideline PDF | **reference-only** |
| Metalex | **unknown** — site dead, EU entry silent | Interoperable Europe archived entry | **reference-only** |

**Net position: no copyleft anywhere.** There is no AGPL/GPL/MPL item in this corpus, so nothing here
forces a clean-room reimplementation. The binding constraint is the opposite one — *unknown* licences
on the EU and national-government artifacts (ELI, CDM, Finlex, LexDania, NIR, Metalex), which means
their **models can be reimplemented freely but their files should not be vendored** without confirming
reuse terms.

---

## 5. Relevance to patent/IP practice and legal-document knowledge graphs

### 5.1 The gap that defines the answer

**Not one of the 15 ontologies models patents or intellectual property.** There is no class for a
patent application, a claim, an independent vs. dependent claim, a priority date, a patent family, a
prior-art reference, an office action, an examiner rejection, a CPC/IPC classification, an assignment,
or a licence grant. The Lynx corpus was built for three pilots — labour law, employment/consumer
contracts, and occupational-safety standards — and the ontology survey reflects that.

Consequence: a patent/IP knowledge graph cannot be assembled from this list. It must be assembled from
this list's **document, citation, norm, and terminology layers** plus a patent-domain layer sourced
elsewhere (EPO OPS, USPTO Open Data Portal, WIPO ST.96, CPC scheme data). The value of this sweep is
that it settles the *substrate* question and tells you exactly which four bricks are worth taking.

### 5.2 Tier 1 — directly relevant, and licence-clean

| Ontology | Why it transfers to patent/IP work | Licence posture |
|----------|-----------------------------------|-----------------|
| **ELI** ⭐ | The FRBR Work/Expression/Manifestation split plus arbitrary-depth `LegalResourceSubdivision` addressing is exactly the model needed to cite **35 U.S.C. §103**, **37 C.F.R. §1.56**, or an MPEP section as a resolvable, part-addressable node. Its `eli:in_force` temporal states are the missing piece most legal-tech data models get wrong: pre-AIA vs. post-AIA §102/§103 is a *versioned expression* problem, and ELI already solved it. Adopt the pattern; it is also the only reference ontology Lynx actually shipped. | model freely reimplementable; files reference-only |
| **Akoma Ntoso** ⭐ | The judicial content model (`introduction` / `background` / `motivation` / `decision`) maps almost one-to-one onto PTAB decisions, appeal briefs, and office actions. Its structural/semantic/metadata three-way separation and its naming convention are the most battle-tested document model in the space — and it is the standard everything else on this list converged onto (Switzerland, Italy, and the EU all migrated *to* it). Actively advancing to AKN 3.1 in 2026, so it is a safe long-horizon bet. | OASIS royalty-free |
| **LKIF-core** ⭐ | The `norm` module's **typology of rights and powers** (Sartor 2006, Rubino et al. 2006) plus `legal-role` and `legal-action` give a ready vocabulary for what a patent *is* jurisprudentially — a legal power held by a role-filler (assignee) against the world, with obligations (disclosure, maintenance fees) attached. Also supplies OWL-DL time (Allen intervals) and mereology, both of which you need for claim-scope containment and priority-chain reasoning. **CC BY 4.0 and still maintained in 2026** — the best licence/quality ratio on the list. | **port-with-attribution** |
| **lexicog / OntoLex-lemon** ⭐ | Patent claim construction *is* lexicography — the applicant may act as their own lexicographer, and a specification's definitional passages are dictionary entries in all but name. lexicog's separation of `LexicographicResource` / `Entry` / `LexicalSense` models "this term, as defined in this specification, has this sense" without collapsing it into a global ontology. Directly supports term-disambiguation, synonym expansion in prior-art search, and multilingual family alignment (EP/JP/CN equivalents). | vocabulary conventionally usable; spec text reference-only |

### 5.3 Tier 2 — structurally useful, adopt selectively

- **LegalRuleML** — the deontic + defeasible + **isomorphism** frame is the right way to encode
  patentability rules with a traceable link from each formal rule back to the statutory text that
  authorises it. Isomorphism in particular is a governance requirement for any system that reasons
  about examination: you must be able to show *which provision* produced a conclusion. Take the
  concepts; the XML serialisation is disproportionate.
- **The LKG's NIF + ITS-RDF pattern** (not on the ontology list — from
  <https://lynx-project.eu/doc/lkg/>) — NIF anchors annotations to exact character offsets in the source
  string, and ITS-RDF carries the entity link and confidence. This is the standards-based answer to
  span-lossy NLP handoff, and it is directly applicable to the repo's known
  `AnnotatedDocument`-drops-char-spans gap and to the `EvidenceSpan` value-object decision. **Highest
  practical payoff per unit of effort of anything found in this sweep.**
- **eu-cbcm** (CC BY 4.0) — models corporate actors, competent authorities, and the document-bearing
  procedural steps of cross-border corporate change. Patent **assignment chains** are the same shape:
  an entity-to-entity transfer, evidenced by a recorded document, validated by an authority. Worth
  mining for the actor/authority/evidence triple even though the domain differs.
- **PCO** (CC BY 3.0 CZ) — the tender→award→contract→payment chain plus GoodRelations reuse is a decent
  precedent for licence agreements and royalty streams. Frozen since 2017; mine the design, do not
  depend on it.

### 5.4 Tier 3 — reference only

`cdm`, `laki`, `oikeus`, `nomothesia`, `chlexml`, `lexdania`, `nir`, `metalex`. National XML schemas and
national metadata vocabularies. Their value is as **design precedent** — especially `laki`'s explicit
amendment relations ("Repeals statute (item)", "Refers to statute (item)") and Metalex's legislative
*event* model, both of which are good prior art for modelling prosecution-history events. None should
be adopted as dependencies; four of the eight are dead or discontinued.

### 5.5 Two structural warnings inherited from Lynx

1. **Clause-level contract modelling is unsolved in this entire landscape.** Lynx evaluated the OMG/FIBO
   Contracts Ontology and the MPEG-21 Media Contract Ontology and rejected both — FIBO because it
   cannot represent contract *parts*. Any patent-licence or assignment modelling will hit the same wall
   and will need net-new design (ELI's `LegalResourceSubdivision` is the most promising borrowed
   primitive).
2. **Case law is the thinnest layer.** Lynx's own note — "There is no relevant source of data except for
   some courts. No court has been considered in particular in the specs" — means the only case-law
   modelling on offer is `oikeus` (Finland, licence unknown) and Akoma Ntoso's judicial content model.
   For patent practice, where Federal Circuit and PTAB decisions are load-bearing, plan on building this
   layer rather than adopting one.

---

## 6. Dead-link ledger — current homes

| Listed link | Status | Current home |
|-------------|--------|--------------|
| `ech.ch/alfresco/...02d08802...` (CHLexML rdf) | 404 | <https://ech.ch/de/ech/ech-0095/1.0> |
| `ech.ch/alfresco/...f6c00c61...` (CHLexML doc) | 404 | <https://ejustice.ch/wp-content/uploads/2024/10/STAN_d_DRA_2016-05-03_eCH-0095_V1.0_CHLexML.pdf> · <https://ejustice.ch/chlexml/> |
| `publications.europa.eu/mdr/eli/` + `eli.owl` | soft-redirect to landing page | content-negotiate `http://data.europa.eu/eli/ontology` → <http://publications.europa.eu/resource/cellar/917d16b5-28f6-11e8-b5fe-01aa75ed71a1.0001.01/DOC_1> |
| `eelst.cs.unibo.it/apps/LODE/...laki` | host down | schema itself at <http://purl.org/finlex/schema/laki/>; context <https://seco.cs.aalto.fi/linkeddata/finnishlaw/>, <https://data.finlex.fi/> |
| `eelst.cs.unibo.it/apps/LODE/...oikeus` | host down | <http://purl.org/finlex/schema/oikeus/> |
| `lovtidende.dk/Forms/L0500.aspx?page=5` | 200 but empty JS shell | schema still live at <https://www.retsinformation.dk/offentlig/xml/schemas/2016/09/26/LexDania_2.1.xsd> |
| `metalex.eu` + `metalex-cen.owl` | no HTTP response | <https://web.archive.org/web/20201230160320/http://www.metalex.eu/metalex-cen.owl> · EU entry (archived) <https://interoperable-europe.ec.europa.eu/collection/eu-semantic-interoperability-catalogue/solution/cen-metalex> · CWA <https://docs.vlaamsparlement.be/docs/biblio/opendigibib/monografie/2011/365_cwa15710.pdf> |
| `legislation.di.uoa.gr/` + `legislation.owl` | 404 | <https://github.com/iliaschalkidis/nomothesia> (Apache-2.0) · paper <https://cgi.di.uoa.gr/~koubarak/publications/2017/eswc17-legislation.pdf> |
| `www.private.you-know-italians.xsd` (NIR) | never a real URL — placeholder left in the page | <https://lg-normattiva.readthedocs.io/> |
| `vitali.web.cs.unibo.it/twiki/pub/NIR/...pdf` | no HTTP response | <https://www.agid.gov.it/sites/default/files/repository_files/linee_guida/linee_guida_marcatura_documenti_normativi_0.pdf> |
| `cbcm-ontology/releases/download/1.0/...` | 404 (tag is `v1.0`, and superseded) | <https://github.com/MaastrichtU-IDS/cbcm-ontology/releases/download/v1.2.2/eu-cmo-rdfxml-v1.2.2.owl> |
| `data.lynx-project.eu` (CKAN portal) | no HTTP response | no replacement found; <http://lkg.lynx-project.eu/> and <http://sparql.lynx-project.eu> are still up |

---

## 7. Recommendation

Take four things and leave eleven.

1. **ELI's FRBR + subdivision + temporal-force pattern** as the citation and versioning spine for
   statutory/regulatory sources (35 U.S.C., 37 C.F.R., MPEP). Reimplement the model; do not vendor.
2. **Akoma Ntoso's document model** — the structural/semantic/metadata separation and the judicial
   content model — as the shape for prosecution and decision documents. OASIS royalty-free, actively
   advancing in 2026.
3. **LKIF-core's `norm` / `legal-role` / `legal-action` modules** as the rights-and-powers vocabulary.
   CC BY 4.0, maintained through 2026, so this one can be genuinely ported with attribution.
4. **The LKG's NIF-offset annotation pattern** for binding extracted entities to exact character spans —
   the highest-leverage, lowest-cost item found, and the direct fix for span-lossy NLP handoff.

Everything else is design precedent to read once and cite, not a dependency to adopt. And the patent
layer proper — claims, families, prior art, classification, prosecution events — has no prior art in
this corpus and needs its own grounding pass against EPO/USPTO/WIPO sources.
