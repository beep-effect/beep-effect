# P2 legal core and IP ontology landscape

Date: 2026-07-08.

This P2 pass serves CQs 1, 4-10, 14, 18, and 19 from `01-direction-grounding.md`, with emphasis on M2 classification SKOS sources and M3 role/deadline/obligation vocabulary. The read-first packet now exists; earlier in-session Firecrawl CLI access through `op run` was blocked by the local 1Password daemon sandbox, so source collection used Firecrawl MCP searches/extraction and local cached ontology bytes only where an upstream URL had been observed.

## Executive verdict

- M2 should not use FOLIO, LKIF, or OWL legal-core class hierarchies for IPC/CPC/Nice. Use official IPC, CPC, and Nice machine-readable downloads as SKOS `ConceptScheme`s with edition/date tracking.
- M3 should reuse PROV-O and ODRL terms by IRI in local vocabulary mappings, slice LKIF role/norm patterns, map to FOLIO legal-practice labels, and mint IP-prosecution roles/deadline terms under `https://ns.beep.sh/`.
- Mandatory historical candidates mostly fail the P2 reuse bar because no current fetchable OWL/TTL artifact was observed. CopyrightOnto is the exception: Firecrawl observed Rhizomik artifact URLs, local bytes were available, and the TTL headers carry CC-BY-SA-4.0 license annotations.

## Artifact pack status

Vendored under `assets/vendor/` and recorded in `assets/manifest.jsonl` with `phase:"P2"` and `verified:false`:

- FOLIO OWL, source family observed at `https://github.com/alea-institute/FOLIO` and FOLIO API/MCP pages at `https://openlegalstandard.org/resources/folio-api/` and `https://openlegalstandard.org/folio-mcp-server-ai-agents`.
- LKIF-Core slices: `lkif-core`, `action`, `role`, `legal-role`, `legal-action`, `expression`, and `norm`, source family observed at `https://github.com/RinkeHoekstra/lkif-core`.
- IAO `iao.owl`, source family observed at `http://obofoundry.org/ontology/iao.html` and `https://github.com/information-artifact-ontology/IAO/blob/master/iao.owl`.
- CopyrightOnto actions, creation, and rights slices. Firecrawl extraction observed `https://rhizomik.net/ontologies/copyrightonto.owl`, `https://rhizomik.net/ontologies/copyrightonto-creationmodel.owl`, and `https://rhizomik.net/ontologies/copyrightonto-rightsmodel.owl`.

Not vendored in P2: PROV-O, ODRL, LRMoo, Akoma Ntoso, ELI, ECLI, FOAF, and ORG. Their URLs were observed and are recommended as external reuse targets, but raw artifact byte fetching was unavailable in this session; manifest rows would be misleading without checksums.

## Core candidates

### FOLIO

- Coverage: broad legal taxonomy with matter/practice labels, actors, legal entities, document artifacts, forums/venues, events, services, standards compatibility, system identifiers, and objectives. The observed taxonomy page lists 24 top-level branches, including Actor/Player, Legal Entity, Document Artifact, Event, Forums/Venues, Area of Law, and Standards Compatibility (`https://openlegalstandard.org/resources/folio-python-library/taxonomy`).
- Namespace IRI: `https://folio.openlegalstandard.org/`; this is declared in the vendored OWL header and matches the public taxonomy sample IRI pattern from `https://openlegalstandard.org/resources/folio-python-library/taxonomy`.
- Artifact availability: `FOLIO.owl` in the public repository at `https://github.com/alea-institute/FOLIO`; API and MCP access were observed at `https://openlegalstandard.org/resources/folio-api/` and `https://openlegalstandard.org/folio-mcp-server-ai-agents`.
- License: CC-BY-4.0 for data and MIT for source/tooling, from the repository README/license statement observed at `https://github.com/alea-institute/FOLIO`.
- Maintenance status: active; Firecrawl observed the public repository with a latest commit date of 2026-05-26 at `https://github.com/alea-institute/FOLIO`.
- Verdict: slice. Use FOLIO as the legal-practice label and mapping backbone for CQs 1, 4-8, 14, 18, and 19, but do not use it as the M2 classification source and do not rely on it alone for time-bounded IP roles.

### LKIF-Core

- Coverage: 15-module legal core covering top, time, process, role, action, expression, legal-action, legal-role, norm, and rules; the repository README and CEUR paper describe the module set and legal role/norm focus (`https://github.com/RinkeHoekstra/lkif-core`, `https://ceur-ws.org/Vol-321/paper3.pdf`).
- Namespace IRIs: `http://www.estrellaproject.org/lkif-core/lkif-core.owl`, with module namespaces such as `http://www.estrellaproject.org/lkif-core/role.owl#` and `http://www.estrellaproject.org/lkif-core/legal-role.owl#`; these are declared in the vendored TTL headers and source repository files at `https://github.com/RinkeHoekstra/lkif-core`.
- Artifact availability: OWL and TTL modules are available in the public repository at `https://github.com/RinkeHoekstra/lkif-core`.
- License: CC-BY-4.0, declared by `dct:license <https://creativecommons.org/licenses/by/4.0/>` in the vendored TTL headers and observed in the repository source family at `https://github.com/RinkeHoekstra/lkif-core`.
- Maintenance status: active repository but old ontology content; Firecrawl observed a 2026-02-23 repository commit and the ontology headers still identify ESTRELLA 2007-2008 / LKIF-Core 1.1.
- Verdict: slice. Reuse the role and norm patterns for CQ18 and obligation reasoning for CQs 1, 7, and 8; avoid wholesale import into the operational schema.

### IAO

- Coverage: information content entities and artifacts. The OBO and GitHub artifact locations were observed at `http://obofoundry.org/ontology/iao.html` and `https://github.com/information-artifact-ontology/IAO/blob/master/iao.owl`.
- Namespace IRI: `http://purl.obolibrary.org/obo/iao.owl`; the vendored OWL header declares this ontology IRI and version IRI `http://purl.obolibrary.org/obo/iao/2026-03-30/iao.owl`.
- Artifact availability: `iao.owl` was observed in the IAO repository at `https://github.com/information-artifact-ontology/IAO/blob/master/iao.owl`; the local byte cache was used because MCP scrape of the raw upstream artifact was rejected.
- License: CC-BY-4.0, from the ontology `terms:license` annotation in the vendored bytes and the observed source artifact page at `https://github.com/information-artifact-ontology/IAO/blob/master/iao.owl`.
- Maintenance status: active; the vendored artifact declares `owl:versionInfo` 2026-03-30 and the source repository was observed at `https://github.com/information-artifact-ontology/IAO`.
- Verdict: slice. Use for generic document/information-artifact semantics in CQ19 and evidence-bearing records; keep legal document taxonomy in FOLIO/local intake terms.

### LRMoo / FRBRoo

- Coverage: Work/Expression/Manifestation/Item-style bibliographic and cultural-heritage identity. LRMoo v1.0 release and RDF implementation were observed at `https://cidoc-crm.org/lrmoo/fm_releases`, `https://www.ifla.org/news/newly-available-object-oriented-lrm-conceptual-model/`, and `https://gitlab.isl.ics.forth.gr/cidoc-crm/compatible-models/lrmoo/-/blob/main/1.0/LRMoo_v1.0.rdf`.
- Namespace IRI: not verified in P2; an OntoME namespace page was observed at `https://ontome.net/namespace/218`.
- Artifact availability: RDF implementation observed at `https://gitlab.isl.ics.forth.gr/cidoc-crm/compatible-models/lrmoo/-/blob/main/1.0/LRMoo_v1.0.rdf`.
- License: not verified in P2 from a fetched source.
- Maintenance status: active/standardized; LRMoo v1.0 stable release was observed as approved by IFLA at `https://cidoc-crm.org/lrmoo/fm_releases`.
- Verdict: inspire. Use the pattern for copyright work identity and document versioning, but do not import for M2 or M3.

### PROV-O

- Coverage: provenance for entities, activities, agents, derivation, attribution, association, roles, revisions, primary sources, quotations, and timing; the W3C recommendation and ontology URLs were observed at `https://www.w3.org/TR/prov-o/` and `https://www.w3.org/ns/prov-o.owl`.
- Namespace IRI: `http://www.w3.org/ns/prov#`, from the observed W3C ontology content at `https://www.w3.org/ns/prov-o.owl`.
- Artifact availability: `https://www.w3.org/ns/prov-o.owl` was observed as an RDF/XML ontology artifact.
- License: not separately verified in P2; review W3C document/software license terms before vendoring bytes.
- Maintenance status: W3C Recommendation dated 2013-04-30, observed at `https://www.w3.org/TR/prov-o/`.
- Verdict: adopt by IRI. Use for CQ4 chain-of-title/prosecution-history activities and CQ19 custody/access-policy provenance; vendor in a later verification pass when raw byte fetch is available.

### ODRL 2.2

- Coverage: policies, permissions, prohibitions, duties, assets, parties, actions, constraints, and agreements for license terms. W3C ODRL Information Model, Vocabulary, and namespace pages were observed at `https://www.w3.org/TR/odrl-model/`, `https://www.w3.org/TR/odrl-vocab/`, and `https://www.w3.org/ns/odrl/2/`.
- Namespace IRI: `http://www.w3.org/ns/odrl/2/`, from the namespace page at `https://www.w3.org/ns/odrl/2/`.
- Artifact availability: the namespace page lists machine-readable artifacts including `https://www.w3.org/ns/odrl/2/ODRL22.ttl`, `https://www.w3.org/ns/odrl/2/ODRL22.rdf`, `https://www.w3.org/ns/odrl/2/ODRL22.nt`, and `https://www.w3.org/ns/odrl/2/ODRL22.json`.
- License: not separately verified in P2; review W3C document/software license terms before vendoring bytes.
- Maintenance status: W3C Recommendation family, observed at `https://www.w3.org/TR/odrl-model/` and `https://www.w3.org/TR/odrl-vocab/`; namespace page revision observed as 2.2.
- Verdict: adopt by IRI. Use for license terms in M3, especially duties, prohibitions, permissions, and license-party roles; do not use ODRL to model patent-prosecution roles like inventor or examiner.

### LegalRuleML

- Coverage: XML standard for legal norms, defeasibility, temporal validity, jurisdiction, and deontic operators; observed at `https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/legalruleml-core-spec-v1.0.html` and `https://www.oasis-open.org/standard/legalruleml-core-specification-version-1-0-oasis-standard/`.
- Namespace IRI: no OWL/TTL namespace suitable for the M2/M3 vocabulary was observed in P2.
- Artifact availability: OASIS XML Schema/Relax NG standard artifacts, not a reusable OWL/TTL ontology for this packet's M2/M3 work.
- License: not evaluated beyond the OASIS standard pages observed above.
- Maintenance status: OASIS Standard published 2021, observed at `https://www.oasis-open.org/2021/09/08/legalruleml-core-specification-v1-0-oasis-standard-published/`.
- Verdict: reject for P2 implementation. It can inspire future rule representation, but it does not answer M2 classification or M3 role/deadline vocabulary needs now.

### UFO-L

- Coverage: legal relators, Hohfeld/Alexy-inspired legal relations, legal roles, and legal acts; observed project/paper sources include `https://nemo.inf.ufes.br/en/projetos/ufo-l/`, `https://ceur-ws.org/Vol-4129/paper2.pdf`, and `https://nemo.inf.ufes.br/wp-content/papercite-data/pdf/a_pattern_for_the_representation_of_legal_relations_in_a_legal_core_ontology_2016.pdf`.
- Namespace IRI: no fetchable OWL/TTL namespace IRI was observed.
- Artifact availability: no fetchable OWL/TTL artifact observed in P2.
- License: not verified in P2.
- Maintenance status: research/project material only; no current artifact maintenance surface observed.
- Verdict: inspire. Use the relator/Hohfeld pattern to avoid making `Inventor`, `Assignee`, `Licensee`, or `Examiner` enduring person subclasses.

## Mandatory user-found candidates

| Candidate | Coverage | Namespace IRI | Artifact availability | License | Maintenance status | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| FOLaw | Historic legal core ontology / functional ontology of law, observed through comparison-paper sources including `https://ceur-ws.org/Vol-118/paper2.pdf`. | None observed. | No fetchable OWL/TTL artifact observed. | Not verified. | Historic paper source only. | reject - no fetchable artifact. It can inform background only; LKIF/FOLIO cover the practical P2 needs better. |
| LRI-Core | Historic legal core ontology compared with FOLaw, observed at `https://ceur-ws.org/Vol-118/paper2.pdf`. | None observed. | No fetchable OWL/TTL artifact observed. | Not verified. | Historic paper source only. | reject - no fetchable artifact. LKIF is the reusable descendant/source family for role/norm work. |
| NEURONA | Data-protection legal ontology candidate found in search results and secondary papers. | None observed. | No fetchable OWL/TTL artifact observed. | Not verified. | Paper/secondary-source only in P2. | reject - no fetchable artifact. Privacy scope is also outside M2/M3. |
| ALIS IP | IP ontology merging legal and technical perspectives, observed through paper/project references including `https://cordis.europa.eu/project/id/027968/de`. | None observed. | No fetchable OWL/TTL artifact observed. | Not verified. | EU project/paper source only in P2. | reject - no fetchable artifact. Useful search term only. |
| Carneades | Legal argumentation system/prototype, observed at `https://carneades.github.io/about-carneades/` and `https://github.com/carneades/carneades-4`. | None observed for OWL/TTL ontology reuse. | No fetchable legal ontology OWL/TTL artifact observed. | Not evaluated for ontology reuse. | Software project, not P2 ontology source. | reject - no fetchable ontology artifact. It may inspire argumentation UX later, not M2/M3. |
| DSAP | Data Sharing Agreement privacy ontology candidate observed through `https://ceur-ws.org/Vol-2275/paper3.pdf`. | None observed. | No fetchable OWL/TTL artifact observed. | Not verified. | Paper source only in P2. | reject - no fetchable artifact. Privacy/data-sharing niche does not serve M2/M3 now. |
| IPROnto | Digital-rights/IPR ontology described by the seed brief at `https://dmag.ac.upc.edu/ontologies/ipronto/index.html` and JURIX paper at `https://jurix.nl/pdf/j03-12.pdf`. | No current namespace IRI was verified in P2. | No currently fetchable OWL/TTL artifact was observed by P2 search. | Not verified. | Dated 2003-era source; no current artifact maintenance observed. | reject - no currently fetchable artifact. CopyrightOnto and ODRL are better for rights/license semantics. |
| PrOnto | GDPR/privacy compliance ontology, observed via publication sources including `https://link.springer.com/chapter/10.1007/978-3-030-00178-0_9`. | None observed for OWL/TTL artifact reuse. | No fetchable OWL/TTL artifact observed; sources emphasize LegalRuleML-style compliance modeling. | Not verified. | Publication source only in P2. | reject - no fetchable OWL/TTL artifact. Out of scope for IP prosecution M2/M3. |
| Copyright Ontology (Rhizomik) | Copyright creation/actions/rights lifecycle; observed at `https://rhizomik.net/ontologies/copyrightonto` and exact artifacts `https://rhizomik.net/ontologies/copyrightonto.owl`, `https://rhizomik.net/ontologies/copyrightonto-creationmodel.owl`, and `https://rhizomik.net/ontologies/copyrightonto-rightsmodel.owl`. | `https://rhizomik.net/ontologies/copyrightonto.owl#`, `https://rhizomik.net/ontologies/copyrightonto-creationmodel.owl#`, and `https://rhizomik.net/ontologies/copyrightonto-rightsmodel.owl#`. | Fetchable artifacts observed by Firecrawl extraction; local TTL bytes were vendored and checksummed. | CC-BY-SA-4.0 from the ontology license annotations and local upstream license file; evidence URLs are the artifact URLs above. | Slow; Firecrawl extraction and ontology headers observed 2019-09-02. | slice. Use for copyright-specific rights/work concepts, not patent/trademark docketing or classifications. |

## M2 classification sources

- IPC: Use WIPO IPC 2026.01 master files. Download page: https://www.wipo.int/classifications/ipc/en/ITsupport/Version20260101/. Exact observed master-files directory: https://www.wipo.int/ipc/itos4ipc/ITSupport_and_download_area/20260101/MasterFiles/. Scheme ZIP: https://www.wipo.int/ipc/itos4ipc/ITSupport_and_download_area/20260101/MasterFiles/ipc_scheme_20260101.zip. Format: IPC XML master files; convert nested `ipcEntry` hierarchy to SKOS `ConceptScheme` with `skos:notation`, `skos:broader`/`skos:narrower`, `skos:prefLabel`, and edition `2026.01`. Terms: WIPO classification page says master files are freely available; WIPO terms page at https://www.wipo.int/en/web/terms-of-use puts online WIPO content under CC BY 4.0 unless service-specific terms apply.
- CPC: Use official CPC bulk data page: https://www.cooperativepatentclassification.org/cpcSchemeAndDefinitions/bulk. It exposes CPC scheme/definition XML schemas plus List of CPC Valid symbols (2026.05), CPC Validity file (2026.05), and CPC Title List (2026.05). Linked data page: https://www.cooperativepatentclassification.org/cpcSchemeAndDefinitions/CPCopenLinkedData. Format: CPC XML plus symbol/title/validity tables; load as a separate SKOS scheme from IPC and store edition `2026.05`. Terms/license: official CPC pages were observed; reuse only with CPC site/EPO/USPTO terms review before package commit because this pass did not find an OSI-style license.
- Nice: Use WIPO Nice Classification NCL(13-2026). Download page: https://www.wipo.int/classifications/nice/en/ITsupport/Version20260101/index.html. Public browser/download UI: https://nclpub.wipo.int/enfr/. Observed PDF endpoint for class headings: https://nclpub.wipo.int/enfr/pdf-download.pdf?lang=en&tab=class_headings&dateInForce=20260101. Format: WIPO downloadable master files plus Excel/Word/PDF exports; load classes and goods/services terms as SKOS with edition `13-2026` / date in force `20260101`. Terms: WIPO classification page says master files and Excel/Word/PDF files are freely available; WIPO open-access terms apply unless service-specific terms supersede them.
- Locarno/Vienna brief: Defer for M2 unless design/trademark-figurative workflows pull them. Locarno page https://www.wipo.int/en/web/classification-locarno exposes downloadable master files; Vienna page https://www.wipo.int/en/web/classification-vienna and VCL(10-2026) IT page https://www.wipo.int/classifications/vienna/en/ITsupport/Version20260101/index.html expose reference/download files. Model them with the same SKOS edition-tracking pattern if pulled.

## M3 vocabulary recommendations

Reuse by IRI:

- Provenance: use PROV-O `prov:Entity`, `prov:Activity`, `prov:Agent`, `prov:wasDerivedFrom`, `prov:wasGeneratedBy`, `prov:wasAttributedTo`, `prov:qualifiedAssociation`, `prov:hadRole`, `prov:startedAtTime`, and `prov:endedAtTime` for CQ4 chain of title, prosecution history, and CQ19 document custody. Source: `https://www.w3.org/TR/prov-o/` and `https://www.w3.org/ns/prov-o.owl`.
- License terms: use ODRL `odrl:Policy`, `odrl:Agreement`, `odrl:Permission`, `odrl:Prohibition`, `odrl:Duty`, `odrl:Asset`, `odrl:Party`, `odrl:action`, and `odrl:constraint` for license/permission/duty terms. Source: `https://www.w3.org/TR/odrl-model/`, `https://www.w3.org/TR/odrl-vocab/`, and `https://www.w3.org/ns/odrl/2/`.
- Enduring party identity: use FOAF/ORG as lightweight external mappings for people and organizations: `foaf:Person` from `http://xmlns.com/foaf/spec/` and `org:Organization` / `org:Membership` from `https://www.w3.org/TR/vocab-org/`. In repo schemas, keep `LegalClient`, `LegalContact`, patent assignee, examiner, and law-firm contact identity under local IDs and map outward.
- Legal-practice labels: map to FOLIO Actor/Player, Legal Entity, Document Artifact, Event, Area of Law, and Standards Compatibility branches where exact or close labels exist. Source: `https://openlegalstandard.org/resources/folio-python-library/taxonomy`.
- Role/norm design: slice LKIF `role:Role`, `role:plays`, `role:played_by`, `legal-role:Legal_Role`, and norm concepts as design input only. Source: `https://github.com/RinkeHoekstra/lkif-core`.

Mint under `https://ns.beep.sh/`:

- Enduring party classes and IDs that the law-practice domain owns: `beep:Party`, `beep:NaturalPersonParty`, `beep:OrganizationParty`, `beep:LawFirm`, `beep:PatentOffice`, `beep:TrademarkOffice`, and `beep:PartyIdentifier`.
- Time-bounded role classes: `beep:InventorRole`, `beep:ApplicantRole`, `beep:AssigneeRole`, `beep:OwnerRole`, `beep:ExaminerRole`, `beep:AttorneyOfRecordRole`, `beep:CorrespondentRole`, `beep:ClientContactRole`, `beep:SignerRole`, `beep:LicenseeRole`, and `beep:LicensorRole`. Model each as a role assignment/association with holder, matter or asset scope, source evidence, start/end times, and authority event. Do not make these subclasses of person or organization.
- Chain-of-title events: `beep:AssignmentRecordation`, `beep:MergerOwnershipChange`, `beep:SecurityInterestRecordation`, `beep:ReleaseRecordation`, and `beep:LicenseGrantEvent`. Link them to PROV activities and source instruments.
- Docketing/deadline terms: `beep:Deadline`, `beep:DocketingEvent`, `beep:StatutoryDueDate`, `beep:SoftDueDate`, `beep:OfficeActionResponseDeadline`, `beep:MaintenanceFeeDeadline`, `beep:AnnuityDeadline`, `beep:IDSDeadline`, `beep:RCEDueDate`, `beep:AppealDeadline`, `beep:ContinuationDeadline`, `beep:NationalStageDeadline`, `beep:StatementOfUseDeadline`, `beep:Section8Deadline`, `beep:Section9RenewalDeadline`, and `beep:Section15DeclarationDeadline`.
- Document/security classes: `beep:PrivilegedCorrespondence`, `beep:OfficeCorrespondence`, `beep:FiledProsecutionPaper`, `beep:AssignmentRecord`, `beep:DisclosureMaterial`, `beep:PriorArtDocument`, `beep:BillingAdminRecord`, and local retention/access-policy classes for CQ19. Map these to FOLIO/IAO where possible; keep policy decisions local.

## Akoma Ntoso, ELI, and ECLI

- Akoma Ntoso: relevant as XML identifier/markup inspiration for statutory, legislative, and judicial-style legal documents, but not a direct office-action ontology. OASIS LegalDocML standard pages were observed at `https://www.oasis-open.org/standard/akn-v1-0/` and `https://docs.oasis-open.org/legaldocml/akn-core/v1.0/`.
- ELI: relevant for persistent identifiers and FRBR-like legal-resource modeling for legislation; observed at `https://eur-lex.europa.eu/eli-register/what_is_eli.html` and `https://data.europa.eu/eli/ontology`.
- ECLI: relevant only as a case-law identifier pattern; observed at `https://eur-lex.europa.eu/EN/legal-content/summary/european-case-law-identifier.html`.
- Verdict: inspire. Use their identifier lessons for source citations and legal authority records; do not adopt them as M2/M3 vocabularies for USPTO/Trademark Office filings.

## CQ and milestone mapping

- CQs 1, 7, and 8: mint local docketing/deadline vocabulary, backed by PROV activities and FOLIO/IAO document labels. LKIF norm vocabulary is design input for obligations, not the operational source of truth.
- CQ4: adopt PROV-O by IRI for chain-of-title and provenance records; mint IP-specific ownership-change events locally.
- CQ5 and CQ18: keep enduring party identity separate from time-bounded roles. Use LKIF/UFO-L role/relator patterns, FOAF/ORG outward mappings, and local role assignment records.
- CQs 9 and 10: use official IPC/CPC/Nice SKOS concept schemes with edition tracking. Defer Locarno/Vienna until trademark/design workflows need them.
- CQ14: use PROV-O and local evidence-span records for claim limitation/distinction assertions; no surveyed ontology should own the accepted fact.
- CQ19: use FOLIO/IAO/PROV mappings for document category and custody, but mint retention/access-policy vocabulary locally.
