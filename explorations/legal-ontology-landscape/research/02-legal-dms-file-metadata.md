# P1 Legal DMS and File Metadata Ontology Landscape

Date: 2026-07-08

## Scope and input status

P1 serves the intake/filing taxonomy competency cluster: CQs 2, 3, 11, 15, and 19. The requested files `research/00-source-brief.md` and `research/01-direction-grounding.md` were not present in this checkout. `assets/README.md` appeared during final verification and confirms the manifest row schema used below. This report is therefore grounded in the exploration files that are present (`README.md`, `BRIEF.md`, `MAP.md`, `DECISIONS.md`, `ops/manifest.json`, `assets/README.md`) plus adjacent `goals/legal-document-intake` and `goals/semantic-foundation` context.

Artifact fetch status: Firecrawl search and search-with-scrape worked for evidence gathering, but exact artifact downloads did not. The prescribed `op run -- firecrawl ...` path could not authenticate because the 1Password daemon/socket was unavailable and the MCP authentication prompt was rejected. Direct `curl` also failed DNS resolution for both `www.dublincore.org` and `raw.githubusercontent.com`. The Firecrawl `scrape` tool was rejected by the client. No third-party payloads were downloaded and `assets/manifest.jsonl` remains empty, because there were no exact bytes or SHA-256 hashes to record.

## Verdict table

| Candidate | Verdict | License | Manifest row |
| --- | --- | --- | --- |
| SKOS | Adopt | W3C document-use terms | No, download blocked |
| Dublin Core Terms | Adopt | CC BY 4.0 | No, download blocked |
| PROV-O | Adopt | W3C document-use terms | No, download blocked |
| PAV | Slice | Apache-2.0 | No, download blocked |
| FOLIO | Slice | CC BY 4.0 for standard data; MIT for software surfaces | No, download blocked |
| NEPOMUK NIE/NFO/NCO/NMO | Slice | OSCAF / NEPOMUK software license | No, official files are `.rdfs`/`.trig`, and download blocked |
| Box metadata taxonomies and folder structure | Adopt as product constraint | Box proprietary docs terms | No artifact |
| iManage Work metadata/folder patterns | Inspire | iManage proprietary docs terms | No artifact |
| NetDocuments matter-centric/profile patterns | Inspire | NetDocuments proprietary docs terms | No artifact |
| XMP / XMP Media Management | Inspire | Adobe docs/spec terms; no reusable RDF ontology license verified | No artifact |
| W3C EXIF in RDF | Reject for M1 | W3C document-use terms | No artifact |
| PREMIS 3 OWL | Inspire | No explicit reusable ontology license verified in P1 | No, download blocked |
| schema.org DigitalDocument / EmailMessage | Inspire | schema.org terms under CC BY-SA 3.0 | No artifact |
| SPDX | Reject for M1 | SPDX project/license terms vary by spec/artifact | No artifact |
| SALI LMSS | Inspire | GitHub repo shows MIT, SALI site describes CC BY-ND for SALI-licensed materials | No, license ambiguity plus download blocked |
| Legal DMS ontology literature / Eunomos | Inspire | Paper/site publication terms, not a reusable ontology asset | No artifact |

## Candidate notes

### SKOS

Coverage: SKOS defines the RDF model for concept schemes, concepts, labels, notes, hierarchical relations, associative relations, and mapping relations. The W3C Recommendation says SKOS is a common data model for sharing and linking taxonomies, thesauri, classification schemes, and subject headings; it directly covers M1's repo-owned taxonomy seed. Source: https://www.w3.org/TR/skos-reference/

Namespace IRI: `http://www.w3.org/2004/02/skos/core#`.

Serialization availability: the SKOS Reference lists a normative RDF/XML namespace document at `http://www.w3.org/TR/skos-reference/skos.rdf`, plus the namespace URI via content negotiation. Source: https://www.w3.org/TR/skos-reference/#namespace-documents

License and maintenance: W3C Recommendation dated 2009-08-18; W3C document use rules apply from the Recommendation page. Source: https://www.w3.org/TR/skos-reference/

Verdict: Adopt. Use SKOS as the structural contract for M1 taxonomy seed: `skos:ConceptScheme`, `skos:Concept`, `skos:prefLabel`, `skos:altLabel`, `skos:hiddenLabel`, `skos:definition`, `skos:scopeNote`, `skos:broader`, `skos:narrower`, `skos:related`, `skos:exactMatch`, and `skos:closeMatch`. This directly supports CQs 2, 3, 15, and 19.

### Dublin Core Terms

Coverage: Dublin Core Terms covers resource description (`title`, `creator`, `identifier`, `type`, `format`), time (`created`, `modified`, `issued`), relation/versioning (`hasPart`, `isPartOf`, `hasVersion`, `isVersionOf`, `source`, `provenance`), and rights (`license`, `rights`, `accessRights`). Source: https://www.dublincore.org/specifications/dublin-core/dcmi-terms/

Namespace IRI: `http://purl.org/dc/terms/`.

Serialization availability: DCMI lists current terms artifacts in N-Triples, RDF/XML, and Turtle, including `dublin_core_terms.ttl` and `dublin_core_terms.rdf`. Source: https://www.dublincore.org/schemas/rdfs/

License and maintenance: DCMI documents are licensed under Creative Commons Attribution 4.0 unless otherwise indicated; the current DCMI site footer also shows active deployment in 2026. Source: https://www.dublincore.org/about/copyright/

Verdict: Adopt. Use DCTerms for generic document/resource metadata and avoid minting duplicate `created`, `modified`, `identifier`, `format`, `hasPart`, `isPartOf`, `source`, `provenance`, `rights`, and `accessRights` predicates under `https://ns.beep.sh/`. This supports CQs 2, 3, 11, 15, and 19.

### PROV-O

Coverage: PROV-O models provenance with `prov:Entity`, `prov:Activity`, `prov:Agent`, `prov:wasGeneratedBy`, `prov:used`, `prov:wasDerivedFrom`, `prov:wasRevisionOf`, `prov:hadPrimarySource`, `prov:wasAttributedTo`, and related qualified influence terms. Source: https://www.w3.org/TR/prov-o/

Namespace IRI: `http://www.w3.org/ns/prov#`.

Serialization availability: the Recommendation links the OWL encoding at `https://www.w3.org/ns/prov-o`; Turtle namespace documents are published at `https://www.w3.org/ns/prov.ttl`. Source: https://www.w3.org/TR/prov-o/

License and maintenance: W3C Recommendation dated 2013-04-30; W3C document use rules apply from the Recommendation page. Source: https://www.w3.org/TR/prov-o/

Verdict: Adopt. Use a narrow PROV-O profile for extraction lineage and lifecycle transitions: original file to extracted child, redline derived from draft, filed copy generated by filing activity, received copy generated by intake activity. This supports CQs 11 and 15.

### PAV

Coverage: PAV specializes PROV-O for provenance, authoring, and versioning. It has properties for created-by, authored-by, curated-by, imported-from, previous-version, version, and source access patterns useful when document authorship and digital-creation roles matter. Source: https://pav-ontology.github.io/pav/

Namespace IRI: `http://purl.org/pav/`.

Serialization availability: the PAV docs link RDF/XML at `https://pav-ontology.github.io/pav/pav.rdf`; the GitHub repo also includes `pav.rdf` and `pav-no-import.rdf`. Sources: https://pav-ontology.github.io/pav/ and https://github.com/pav-ontology/pav

License and maintenance: Apache-2.0 in the GitHub README; version 2.3.1 issued 2014-08-28, last modified 2015-03-16, with GitHub docs fixes in 2025. Sources: https://github.com/pav-ontology/pav and https://pav-ontology.github.io/pav/

Verdict: Slice. Prefer PROV-O first; use PAV only where its authoring/versioning predicates are materially clearer than generic `prov:*` for document lifecycle metadata. This supports CQ 15.

### FOLIO

Coverage: FOLIO is a CC-BY legal ontology/taxonomy with more than 18,000 legal concepts covering areas of law, document types, legal entities, governmental bodies, courts, and legal-services concepts. It explicitly supports case/matter management, document classification, API access, JSON, JSON-LD, OWL XML, and Markdown serializations. Sources: https://openlegalstandard.org/ and https://openlegalstandard.org/resources/folio-python-library

Namespace IRI: FOLIO class IRIs use `https://folio.openlegalstandard.org/...`; the Python docs show class IRIs such as `https://folio.openlegalstandard.org/RB8D8b89B9b18DB928b27dfe`. Source: https://openlegalstandard.org/resources/folio-python-library

Serialization availability: the source ontology is `FOLIO.owl` in GitHub, and the public API exports individual classes as JSON, JSON-LD, OWL XML, Markdown, and HTML. Sources: https://github.com/alea-institute/FOLIO and https://aleainstitute.ai/blog/posts/folio-api-mcp-tools/

License and maintenance: FOLIO standard data is CC BY 4.0; software surfaces are MIT where indicated. GitHub latest commit was 2026-05-26, and the public API/MCP update is dated 2026-03-19. Sources: https://github.com/alea-institute/FOLIO and https://aleainstitute.ai/blog/posts/folio-api-mcp-tools/

Verdict: Slice. M1 should not make FOLIO the source of truth. Use FOLIO as the primary alignment target via `skos:exactMatch` / `skos:closeMatch` for legal document and matter concepts that are actually verified. Mint Beep concept IRIs under `https://ns.beep.sh/` and attach FOLIO mappings as metadata. This supports CQs 2, 3, 15, and 19.

### NEPOMUK NIE/NFO/NCO/NMO

Coverage: NEPOMUK's Information Element ontology (NIE) covers desktop resources, filesystems, mailboxes, calendars, address books, data objects, information elements, data sources, content dates, MIME types, file/resource containment, version, legal/license metadata, and relation predicates. The Message Ontology (NMO) covers messages, email, IM, mailboxes, headers, recipients, attachments, message IDs, reply/reference chains, sent dates, and received dates. Sources: https://www.semanticdesktop.org/ontologies/2007/01/19/nie/ and https://www.semanticdesktop.org/ontologies/2007/03/22/nmo/

Namespace IRIs: `http://www.semanticdesktop.org/ontologies/2007/01/19/nie#`, `http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#`, `http://www.semanticdesktop.org/ontologies/2007/03/22/nco#`, and `http://www.semanticdesktop.org/ontologies/2007/03/22/nmo#`.

Serialization availability: official pages list `.rdfs` and `.trig` artifacts such as `nie_data.rdfs`, `nie_metadata.rdfs`, `nie.trig`, `nmo_data.rdfs`, `nmo_metadata.rdfs`, and `nmo.trig`. Sources: https://www.semanticdesktop.org/ontologies/2007/01/19/nie/ and https://www.semanticdesktop.org/ontologies/2007/03/22/nmo/

License and maintenance: OSCAF / NEPOMUK software license is linked from the ontology pages. NIE latest OSCAF Recommendation is 2013-08-28; NMO latest OSCAF Recommendation is 2012-06-13. Tracker/GNOME still publishes derived ontology docs, which is evidence of downstream reuse rather than active upstream governance. Sources: https://www.semanticdesktop.org/ontologies/2007/01/19/nie/ and https://tracker.api.gnome.org/nie-ontology.html

Verdict: Slice. Use as a design reference for file/email/message/attachment modeling, especially `nmo:Email`, `nmo:Mailbox`, `nmo:MessageHeader`, `nmo:messageId`, `nmo:inReplyTo`, `nmo:references`, `nmo:sentDate`, `nmo:receivedDate`, and `nmo:hasAttachment`. Do not import the whole semantic-desktop stack into M1. This supports CQ 11 strongly and CQs 2, 15, and 19 secondarily.

### Box metadata taxonomies and folder structure

Coverage: Box metadata taxonomies support reusable multi-level metadata fields, up to ten levels deep, CSV import, leaf-only/all-level selection, and API retrieval for whole taxonomies, subtrees, children, and levels. Box folder guidance frames taxonomy/folder structure as a foundational governance decision and distinguishes open versus closed folder taxonomies. Sources: https://support.box.com/hc/en-us/articles/46655752830739-Support-for-Multi-Level-Metadata-Taxonomies and https://docs.box.com/en/box-fundamentals/for-admins/getting-started/plan-your-folder-structure

Namespace IRI: none; this is product metadata/folder guidance, not an RDF ontology.

Serialization availability: product docs/API, not TTL/RDF/OWL.

License and maintenance: Box support/docs pages are proprietary product documentation; the folder-structure page was modified 2026-05-22 and the metadata docs were modified 2026-07-08. Sources: https://docs.box.com/en/box-fundamentals/for-admins/getting-started/plan-your-folder-structure and https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/using-metadata

Verdict: Adopt as a product constraint. M1 filing-path semantics must be Box-first: model a taxonomy that can project into Box's metadata taxonomy and folder hierarchy without assuming RDF support in Box itself. This supports CQs 2, 3, 15, and 19.

### iManage Work patterns

Coverage: iManage Work organizes matter/project content in workspaces; folders can hold documents and emails; documents have metadata profiles such as client, matter, attorney, jurisdiction, class, and subclass; document IDs include library, document number, and version; emails are treated as documents. Sources: https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html and https://docs.imanage.com/cc-help/10.4.0/en/Metadatas.html

Namespace IRI: none.

Serialization availability: product docs/API, not TTL/RDF/OWL.

License and maintenance: iManage proprietary docs; current cited docs are versioned under 10.4.0. Sources: https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html and https://docs.imanage.com/cc-help/10.4.0/en/Metadatas.html

Verdict: Inspire. Reuse the pattern, not the terms: workspace = matter/project container, folders below workspace, email-as-document, class/subclass as document-type controls, versioned document IDs. This supports CQs 3, 11, and 15.

### NetDocuments patterns

Coverage: NetDocuments describes matter-centric workspaces, profiles as metadata/document attributes, controlled profile lookup values, document-type filters as workspace filing locations/saved searches, official versions, check-in/check-out, ndMail, and document history. Sources: https://support.netdocuments.com/s/article/206239666 and https://support.netdocuments.com/s/article/205220350

Namespace IRI: none.

Serialization availability: product docs/API, not TTL/RDF/OWL.

License and maintenance: NetDocuments proprietary support docs.

Verdict: Inspire. Reuse the matter-centric profile/filter model as a validation point for local vault and Box mirror semantics. This supports CQs 3, 11, and 15.

### XMP and XMP Media Management

Coverage: XMP defines embedded metadata namespaces. XMP Media Management is for DAM systems and covers `xmpMM:DocumentID`, `xmpMM:InstanceID`, `xmpMM:OriginalDocumentID`, `xmpMM:DerivedFrom`, `xmpMM:RenditionClass`, `xmpMM:History`, `xmpMM:Ingredients`, `xmpMM:ManagedFrom`, and `xmpMM:VersionID`. Source: https://developer.adobe.com/xmp/docs/xmp-namespaces/xmp-mm/

Namespace IRI: `http://ns.adobe.com/xap/1.0/mm/`.

Serialization availability: embedded XMP RDF/XML packets in files; no standalone reusable TTL/OWL/RDF ontology artifact was verified in P1. Source: https://developer.adobe.com/xmp/docs/xmp-namespaces/

License and maintenance: Adobe documentation/spec terms; no reusable ontology license verified. Adobe docs show last updated 2026-03-02. Source: https://developer.adobe.com/xmp/docs/xmp-namespaces/xmp-mm/

Verdict: Inspire. Map extracted PDF/XMP fields into Beep metadata but do not use XMP as the governing vocabulary for document lifecycle. This supports CQ 15 and forensic metadata edge cases.

### W3C EXIF in RDF

Coverage: W3C's EXIF RDF vocabulary represents camera/image EXIF fields in RDF. Source: https://www.w3.org/2003/12/exif/

Namespace IRI: `http://www.w3.org/2003/12/exif/ns#`.

Serialization availability: RDF schema/vocabulary page.

License and maintenance: W3C document use rules; old vocabulary.

Verdict: Reject for M1. It is useful for image/photo evidence metadata but does not shape the document-class vocabulary, filing semantics, email linkage, or matter-centric taxonomy required now. Revisit only when image evidence becomes an intake milestone.

### PREMIS 3 OWL

Coverage: PREMIS models preservation Objects, Events, Agents, and Rights, with OWL/RDF encoding for preservation metadata and integration with DCTerms and PROV-O. Sources: https://www.loc.gov/standards/premis/ontology/owl-version3.html and https://www.loc.gov/standards/premis/ontology/ontology3-announcement.html

Namespace IRI: `http://www.loc.gov/premis/rdf/v3/`.

Serialization availability: Library of Congress links PREMIS 3 ontology resources and GitHub source, but exact `.ttl`/`.owl`/`.rdf` file bytes were not fetched in this session. Source: https://www.loc.gov/standards/premis/ontology/owl-version3.html

License and maintenance: no explicit reusable ontology license was verified during P1. PREMIS 3 ontology work was revised through 2018 and is tied to the PREMIS Data Dictionary 3.0. Sources: https://www.loc.gov/standards/premis/ontology/owl-version3.html and https://www.loc.gov/standards/premis/ontology/ontology3-announcement.html

Verdict: Inspire. PREMIS is a better fit for archival preservation than M1 intake taxonomy. Use its object/event/rights split as design pressure, but do not import or slice it until license and artifact URLs are verified. This supports CQ 19.

### schema.org DigitalDocument / EmailMessage

Coverage: schema.org has `DigitalDocument` and `EmailMessage` for public web interchange and JSON-LD-friendly descriptions. The schema.org release page lists full core/extension definition files in N-Triples, Quads, JSON-LD, and Turtle. Sources: https://schema.org/DigitalDocument, https://schema.org/EmailMessage, and https://schema.org/version/latest

Namespace IRI: `https://schema.org/`.

Serialization availability: N-Triples, Quads, JSON-LD, and Turtle for full schema.org releases. Source: https://schema.org/version/latest

License and maintenance: schema.org terms and vocabulary/docs are published under Creative Commons Attribution-ShareAlike 3.0. Source: https://schema.org/docs/terms.html

Verdict: Inspire. Use schema.org only for external JSON-LD publication/interchange, not internal M1 document-class or matter-filing semantics. It supports broad discoverability but is too shallow for CQs 3, 11, and 15.

### SPDX

Coverage: SPDX RDF models software package, file, checksum, relationship, and license-expression metadata. It is valuable when legal-document intake handles software artifacts or open-source license evidence. Source: https://spdx.github.io/spdx-spec/v3.0.1/annexes/rdf-model/

Namespace IRI: `https://spdx.org/rdf/3.0.1/terms/` for SPDX 3.0.1; legacy 2.x terms also exist at `http://spdx.org/rdf/terms#`. Sources: https://spdx.github.io/spdx-spec/v3.0.1/annexes/rdf-model/ and https://spdx.org/rdf/terms

Serialization availability: SPDX publishes RDF/OWL/SHACL model artifacts for the spec.

License and maintenance: SPDX has active spec releases, but the software-package domain is outside M1.

Verdict: Reject for M1. Do not pull SPDX into the legal DMS seed unless a concrete intake path needs software bills of materials or OSS license evidence.

### SALI LMSS

Coverage: SALI LMSS is a legal matter taxonomy/ontology with more than 18,000 tags and IRIs used by the SALI API standard. SALI's public site says LMSS describes key matter attributes such as services, areas of law, and industry, and supports export to CSV/JSON/XML. Sources: https://github.com/sali-legal/LMSS and https://sali.org/explore-the-standard/

Namespace IRI: exact tag base not verified from fetched OWL in P1; the GitHub README confirms each tag has a unique IRI.

Serialization availability: GitHub publishes `LMSS.owl`; the SALI site describes viewer exports to CSV/JSON/XML. Sources: https://github.com/sali-legal/LMSS and https://sali.org/explore-the-standard/

License and maintenance: GitHub presents the repository as MIT licensed; the SALI public site says SALI's license choice is CC BY-ND for SALI-licensed materials. The GitHub repo latest commit was 2026-03-10; latest formal release shown was v2.0.0 on 2023-03-03/04. Sources: https://github.com/sali-legal/LMSS and https://sali.org/explore-the-standard/

Verdict: Inspire. SALI is important for matter taxonomy comparison, but the P1 license mismatch and M1's FOLIO-first direction mean it should not be ingested now. Use it as a cross-check for later matter/service/area-of-law vocabulary decisions.

### Legal DMS ontology literature / Eunomos

Coverage: Eunomos is a legal document and knowledge management system based on legislative XML and legal ontologies. The paper emphasizes linking legal ontology concepts to legal sources, tracking meaning over time, supporting semi-automated classification, handling cross-references, and keeping updates current. Source: https://iris.unito.it/retrieve/handle/2318/1639620/337599/eunomos16.pdf

Namespace IRI: none for a reusable public DMS vocabulary in the cited paper.

Serialization availability: paper/PDF only for this P1 purpose.

License and maintenance: publication terms, not a reusable ontology asset.

Verdict: Inspire. The useful lesson is not an artifact; it is the doctrine that legal classification should keep concept identity separate from source evidence and should track change over time. This supports CQs 2, 15, and 19.

## Recommended M1 inputs

Reuse these external concepts/terms directly:

- SKOS: `skos:ConceptScheme`, `skos:Concept`, `skos:prefLabel`, `skos:altLabel`, `skos:hiddenLabel`, `skos:definition`, `skos:scopeNote`, `skos:broader`, `skos:narrower`, `skos:related`, `skos:exactMatch`, and `skos:closeMatch`.
- Dublin Core Terms: `dcterms:title`, `dcterms:identifier`, `dcterms:type`, `dcterms:format`, `dcterms:created`, `dcterms:modified`, `dcterms:issued`, `dcterms:source`, `dcterms:hasPart`, `dcterms:isPartOf`, `dcterms:hasVersion`, `dcterms:isVersionOf`, `dcterms:provenance`, `dcterms:rights`, `dcterms:license`, and `dcterms:accessRights`.
- PROV-O: `prov:Entity`, `prov:Activity`, `prov:Agent`, `prov:wasGeneratedBy`, `prov:used`, `prov:wasDerivedFrom`, `prov:wasRevisionOf`, `prov:hadPrimarySource`, `prov:wasAttributedTo`, `prov:generatedAtTime`, and `prov:atTime`.
- PAV, only where clearer than PROV/DCTerms: version and authorship predicates such as previous-version and authored/created/curated-by patterns.
- NEPOMUK NMO/NIE as a design slice for email and attachment modeling: message ID, reply/reference chain, sender/recipient roles, sent/received dates, mailbox membership, and attachment relation.

Reuse these as alignment targets, not source-of-truth taxonomies:

- FOLIO document/matter concepts where a specific `https://folio.openlegalstandard.org/...` class is vetted. Store these as `skos:exactMatch` or `skos:closeMatch` from Beep-owned concepts.
- SALI LMSS matter/service/area-of-law concepts only as comparative research until license posture is resolved.

Mint these under `https://ns.beep.sh/`:

- The repo-owned M1 concept scheme and every durable seed concept IRI.
- Document-class vocabulary: `draft`, `redline`, `filed`, `received`, `privileged`, and `extracted-child`.
- Filing-path semantics for local vault and Box mirror, including matter-root, intake-inbox, taxonomy-concept path segment, document class segment, and Box metadata projection keys.
- Beep-specific provenance activities for intake, classification, extraction, redline generation, filing, receipt, privilege review, and Box mirror synchronization.
- Beep-specific confidence/ClaimGate annotations that attach classifier evidence to a concept without making the classifier output the concept identity.

Do not mint duplicates for generic metadata already covered by DCTerms, SKOS, or PROV-O. Do not import whole FOLIO, SALI, NEPOMUK, PREMIS, schema.org, XMP, or SPDX into M1. Keep third-party ontology payloads gitignored under `assets/vendor/` and load them only through a manifest row with URL, license evidence, SHA-256, `phase:"P1"`, and `verified:false` after exact bytes are successfully fetched.

## Manifest follow-up

When network/auth is available, fetch and hash only the artifacts selected by the verdicts:

- `https://www.dublincore.org/specifications/dublin-core/dcmi-terms/dublin_core_terms.ttl`
- `https://www.w3.org/TR/skos-reference/skos.rdf`
- `https://www.w3.org/ns/prov.ttl`
- `https://pav-ontology.github.io/pav/pav.rdf`
- `https://raw.githubusercontent.com/alea-institute/FOLIO/main/FOLIO.owl`

Do not append SALI LMSS until the MIT versus CC BY-ND license conflict is resolved. Do not append NEPOMUK in P1 unless the asset schema allows `.rdfs`/`.trig` or a verified RDF/XML copy is fetched under an allowed extension.
