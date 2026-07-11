# P3 - Ontology-Informed Extraction And Agent Grounding

Date: 2026-07-08

Scope: research phase P3 for the legal-ontology-landscape exploration, focused on ontology-informed extraction and agent grounding for the later `goals/semantic-foundation` ontology slices.

## Method And Local Grounding

Requested read-first files were not present in this checkout: `explorations/legal-ontology-landscape/research/01-direction-grounding.md` and `explorations/legal-ontology-landscape/research/00-source-brief.md`. The packet also has no `assets/README.md` or manifest schema in this checkout. This report therefore grounds P3 against the live repo implementations named in the task plus Firecrawl-verified external sources.

The preferred Firecrawl CLI path was attempted through `op run`, but the session could not access the local 1Password/op daemon sockets. 1Password MCP authorization was also declined in-session, so the web evidence below was gathered through the Firecrawl MCP fallback with sequential calls. No package code was modified.

Repo baseline compared:

- `@beep/langextract` already has target-shaped prompts, JSON-only output parsing, bounded candidate/attribute sizes, candidate `confidence`, deterministic source alignment, and `GroundedExtraction` with `span`, `matchedText`, and `alignmentStatus` (`packages/foundation/capability/langextract/src/Extraction/index.ts`; `packages/foundation/capability/langextract/src/Service/index.ts`).
- LangExtract handoff already converts aligned extractions into `@beep/nlp/Handoff` entities with provenance and optional confidence (`packages/foundation/capability/langextract/src/Handoff/index.ts`; `packages/foundation/modeling/nlp/src/Handoff/Contract.ts`).
- `IrToLaw` already fails typed when required office-action labels are missing, empty, or unaligned, and maps the distinction span into a `TextAnchor` (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts`).
- `OfficeActionReview` already composes file processing -> LangExtract -> IrToLaw -> ClaimGate -> lifecycle transition -> projection (`packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts`).
- `ClaimGate` already builds a bounded SHACL-inspired dataset and validates it through the semantic-web service; the current public contract covers a bounded subset of target class, min/max count, and datatype checks (`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts`; `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`).

## (a) Patterns Catalog

1. Span-grounded structured extraction - verdict: adopt-pattern. Repo already does the core LangExtract-style move: extract target-labeled text, parse bounded JSON, align candidates back to source spans, carry `confidence`, and reject unaligned required legal labels before law-domain mapping. Genuinely missing: extraction-run metadata on each result (`usedModel`, `ontologyVersion`, `sourceChunk`, `extractionMethod`) and repeated-mention/source-chunk policies comparable to Google LangExtract's more mature alignment/visualization surface. Sources: Google LangExtract (`https://github.com/google/langextract`), local `@beep/langextract`.

2. Ontology-slice injection in prompts - verdict: adopt-pattern. Repo already has target names/descriptions and semantic-web/RDF/SHACL packages, but targets are not yet generated from ontology slices. Genuinely missing: a token-budgeted ontology-slice serializer that injects class IRIs, labels, allowed predicates, domain/range, required fields, examples, and `ontologyVersion` into LangExtract requests. Sources: ODKE+ (`https://arxiv.org/html/2509.04696v1`), TextMineX (`arxiv:2509.15098`), OntoGPT (`https://github.com/monarch-initiative/ontogpt`), Palantir OAG (`https://www.palantir.com/docs/foundry/ontology/ontology-augmented-generation/`).

3. Schema/ontology-guided recursive object extraction - verdict: inspire. Repo should not replace the current flat office-action extraction with arbitrary recursive extraction, but OntoGPT/SPIRES is a strong pattern for nested legal objects when the ontology slice demands it. Repo already maps a small extraction vocabulary into law entities through schema decoders. Genuinely missing: a controlled nested output mode for patent application -> claim -> rejection -> reference -> evidence relationships and email -> thread -> attachment -> matter links. Sources: OntoGPT, SPIRES (`pmcid:PMC10924283`), applied OntoGPT term-extraction study (`https://pmc.ncbi.nlm.nih.gov/articles/PMC12892472/`).

4. Provider-native constrained decoding from JSON Schema - verdict: inspire. Repo already constrains with prompt text, JSON parsing, schema decoding, and bounded candidate limits. Genuinely missing: an optional provider capability that passes JSON Schema or grammar constraints to models that support them, while keeping semantic validation in repo-owned schemas and SHACL. This should improve shape adherence but must not be treated as proof of legal truth. Sources: JSONSchemaBench (`arxiv:2501.10868`), `langextract-outlines` (`https://github.com/dottxt-ai/langextract-outlines`), Google LangExtract provider/schema support.

5. Ontology-aware post-extraction validation and repair loop - verdict: adopt-pattern. Repo already has typed decode failures in `IrToLaw` and a bounded SHACL ClaimGate after law mapping. Genuinely missing: an extraction-level validation gate before `IrToLaw` that checks ontology class/property constraints, domain/range, required spans, cardinality, and allowed label vocabularies, then emits a bounded repair prompt with exact SHACL-style violations and source spans. Sources: W3C SHACL (`https://www.w3.org/TR/shacl/`), SHACL-DS (`arxiv:2605.10540`), KG Construct validation tutorial (`https://kg-construct.github.io/tutorials/kcap2023/`).

6. Lightweight semantic support verifier - verdict: inspire. Repo already performs deterministic source alignment, which should remain the first grounding gate. Genuinely missing: an optional second-pass verifier for high-risk assertions that asks whether the aligned span actually supports the typed assertion, separate from extraction and before admission. Use this for brittle legal conclusions, not for every entity mention. Source: ODKE+ corroborator/grounder pattern.

7. Normalization and entity resolution before admission - verdict: adopt-pattern. Repo already decodes domain entities after extraction, and ClaimGate admits or rejects a candidate claim. Genuinely missing: canonical normalization for patent/application/publication numbers, WIPO country and kind codes, examiner/correspondent identities, assignees, statute/rejection labels, dates, and office identifiers before RDF assertion. Sources: WIPO standards hub (`https://www.wipo.int/en/web/standards`), WIPO ST.96 PDF (`https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf`), USPTO XML resources (`https://www.uspto.gov/learning-and-resources/xml-resources`), EPO bulk data manuals (`https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/manuals`).

8. Ontology-Augmented Generation / typed-object retrieval - verdict: inspire. Repo should use ontology slices to build retrieval packets and answer grounding, but should not adopt a broad GraphRAG summarization layer as the ingestion authority. Repo already has the narrow extraction -> law mapping -> ClaimGate path. Genuinely missing: retrieval views that return typed ontology objects, evidence spans, and validation status for agent prompts. Sources: Palantir OAG, OG-RAG (`https://arxiv.org/html/2412.15235v1`), Microsoft GraphRAG docs (`https://microsoft.github.io/graphrag/`).

9. Named-graph or dataset-aware validation - verdict: adopt-pattern. Repo already builds bounded datasets for ClaimGate, but current extraction/admission does not preserve graph boundaries for source artifact, extraction batch, ontology version, and validation run. Genuinely missing: named graph or dataset partitioning so validation reports can retain which source/batch produced each violation. Sources: W3C SHACL, SHACL-DS.

10. Patent XML standards-first extraction - verdict: adopt-pattern. Repo should prefer deterministic XML/DTD parsing for patent grants, applications, bibliographic data, assignments, citations, and office-action datasets whenever source XML is available. Repo already has file processing plus typed law mapping. Genuinely missing: ST.36/ST.96/USPTO/EPO parser adapters and canonical mappings into the semantic-foundation patent slice before LLM fallback. Sources: WIPO ST.96, WIPO ST.36 search result (`https://www.wipo.int/documents/d/standards/docs-en-tracked-changes-03-36-01_changes_2005-10.pdf`), USPTO XML resources, USPTO bulk data portal (`https://data.uspto.gov/bulkdata/datasets`), EPO EP full-text data (`https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/data`), EPO national full-text data (`https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/national-full-text-data`).

11. Email header/thread extraction before LLM matter-linking - verdict: adopt-pattern. Repo should treat email identifiers, threading, recipients, timestamps, attachments, and MIME/body extraction as deterministic ingestion fields, then use ontology-guided LLM extraction only for correspondence type, matter linkage, and legal-intent spans. Repo has no specialized email extractor in the compared loop. Genuinely missing: Microsoft Graph/Tika/MIME adapters and ontology terms for message, thread, attachment, sender/recipient, and matter relation. Sources: Microsoft Graph message resource (`https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0`), Apache Tika formats (`https://tika.apache.org/2.4.1/formats.html`), CMU Enron dataset (`https://www.cs.cmu.edu/~enron/`).

12. RDF-star / RDF 1.2 quoted triples for assertion metadata - verdict: inspire. Repo should not make quoted triples the only internal representation in v1, because RDF 1.2 is still a 2026 Candidate Recommendation and downstream tooling/canonicalization may vary. Repo already has PROV-O-aligned handoff provenance and RDF packages. Genuinely missing: an export/projection profile that can annotate assertion triples with confidence, source span, model, ontology version, and valid time once the store and validators support it. Sources: RDF 1.2 Concepts (`https://www.w3.org/TR/rdf12-concepts/`), RDF & SPARQL WG publications (`https://www.w3.org/groups/wg/rdf-star/publications`).

13. Free-form LLM triple admission without spans or shapes - verdict: reject. Repo already does better by requiring grounded spans in LangExtract/IrToLaw and SHACL-inspired ClaimGate validation. Genuinely missing: nothing worth adopting from this pattern; the semantic-foundation path should explicitly forbid ungrounded triples from entering the admitted graph.

14. Generic GraphRAG community summaries as legal fact authority - verdict: reject. Microsoft GraphRAG-style community summaries can help exploration and retrieval, but they should not be the authority for patent/email facts. Repo already has a narrower validate-before-admit loop. Genuinely missing: a typed retrieval facade over admitted facts, not a replacement ingestion authority. Source: Microsoft GraphRAG docs.

## (b) Patent/Email Extraction Sources And Tools Found

Patent standards and deterministic feeds:

- WIPO standards hub: WIPO Standards are the official framework for machine-readable IP information across patent prosecution stages. The page links XML standards including ST.36 and ST.96 and adjacent standards for country codes, kind codes, citations, dates, and numbering (`https://www.wipo.int/en/web/standards`).
- WIPO ST.96: official PDF described by search metadata as recommending XML resources for filing, publication, processing, and exchange of industrial property information (`https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf`).
- WIPO ST.36: official WIPO PDF result for patent information using XML; use as legacy patent XML grounding where ST.36 feeds are the source (`https://www.wipo.int/documents/d/standards/docs-en-tracked-changes-03-36-01_changes_2005-10.pdf`).
- USPTO XML Resources: official DTD/documentation page for patent grants and published applications, including grant full-text XML Version 4.7 ICE from July 2022 onward and application XML Version 4.6 ICE from July 2022 onward (`https://www.uspto.gov/learning-and-resources/xml-resources`).
- USPTO bulk data portal: official catalog includes patent application full text XML, patent grant full text XML, bibliographic XML, assignment XML, CPC MCF XML, office-action research data, parsed claims data, and AI patent datasets (`https://data.uspto.gov/bulkdata/datasets`).
- EPO EP full-text data: official EPO bulk data for EP-A and EP-B publications, machine-readable since 1978/1980, available as XML ST.36 and PDF/A frontfile/backfile (`https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/data`).
- EPO national full-text data: official EPO national full-text extracts for France, Spain, Switzerland, and the United Kingdom, XML ST.36 with frontfile/backfile delivery (`https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/national-full-text-data`).
- EPO manuals: official manuals page covering EBD, DOCDB, INPADOC legal event data, register data, OPS, and ST.36-compatible XML documentation (`https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/manuals`).

Patent XML to RDF and parser tooling:

- `SmartDataAnalytics/linked-uspto-patent-data`: README describes a workflow for downloading USPTO patent data, splitting XML into per-patent files, and triplifying patent data (`https://raw.githubusercontent.com/smartdataanalytics/linked-uspto-patent-data/HEAD/README.md`).
- `chillSen/USPTO-XML2RDF-Tool`: repository description says it is a simple tool to convert USPTO patent data to RDF Turtle syntax (`https://github.com/chillSen/USPTO-XML2RDF-Tool`).
- `lettergram/parse-uspto-xml`: README documents parsing USPTO XML applications from bulkdata.uspto.gov, primarily XML version 4.0+ from 2005 onward (`https://raw.githubusercontent.com/lettergram/parse-uspto-xml/HEAD/README.md`).

Patent NLP datasets and extraction papers:

- PEDANTIC (`arxiv:2505.21342`): 14k US patent claims annotated for indefiniteness reasons, built from USPTO office actions with LLM-assisted extraction and human validation.
- PANORAMA (`arxiv:2510.24774`): 8,143 US examination records preserving decision trails including original applications, cited references, non-final rejections, and notices of allowance.
- TRIZ-RAGNER (`arxiv:2602.23656`): retrieval-augmented patent NER for TRIZ contradiction mining; useful as an example of structured domain-knowledge injection for patent sentence extraction.
- Patent NER background hits included intellectual property entity recognition (`arxiv:2203.10717`), chemical patent NER (`arxiv:2007.12569`), and chemical reaction extraction in patents (`pmcid:PMC8727901`). These support domain-specific NER but are less directly aligned to office-action ontology slices than PEDANTIC/PANORAMA.

Email extraction sources and tools:

- Microsoft Graph message resource: exposes message `id`, `internetMessageId`, `conversationId`, `conversationIndex`, `from`, `sender`, recipients, `sentDateTime`, `receivedDateTime`, `subject`, `body`, `uniqueBody`, `internetMessageHeaders`, attachments, delta queries, and extensions (`https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0`).
- Apache Tika formats: supports mbox, RFC 822 single messages, Outlook PST, Outlook MSG, TNEF attachments, broad document metadata/text extraction, and optional NLP/NER integration (`https://tika.apache.org/2.4.1/formats.html`).
- CMU Enron dataset: public research corpus of about 0.5M messages from about 150 users, without attachments in the CMU distribution, useful for email tooling benchmarks but not legal-domain truth (`https://www.cs.cmu.edu/~enron/`).

Search gaps:

- Firecrawl GitHub searches did not find a public repository with the exact name `effect-langextract` or `effect-ontology`. The useful adjacent sources were Google LangExtract, `langextract-outlines`, and `ontograph-core` (`https://github.com/openshuyi/ontograph-core`) as a TypeScript ontology-to-OWL/SHACL/JSON-Schema inspiration source.

## (c) Provenance Stamping Recommendation

Recommendation: use a two-layer provenance profile. Canonical internal metadata should be PROV-O-aligned plus a narrow `https://ns.beep.sh/extr/` namespace; RDF-star/RDF 1.2 quoted triples should be an export/projection form for assertion-level annotations, not the only storage contract in v1. Treat each extraction run as a `prov:Activity` that `prov:used` the source chunk, ontology slice/version, prompt template, and model, and make each admitted assertion/entity `prov:wasGeneratedBy` that activity and `prov:wasDerivedFrom` the text anchor. Put extraction-specific fields in `extr:*`: `extr:confidence`, `extr:usedModel`, `extr:ontologyVersion`, `extr:sourceChunk`, `extr:extractionMethod`, `extr:alignmentStatus`, and optional `extr:promptHash`/`extr:shapeVersion`. When exporting RDF, annotate quoted triples with the same PROV/EXTR predicates and keep named graphs for batch/source boundaries. This gives Beep stable ns.beep.sh authority and interoperable provenance now, while preserving an RDF-star path once the repo's RDF canonicalization, SHACL, and downstream stores fully support quoted triples.

Rationale:

- PROV-O is the interoperable base: W3C PROV-O is a Recommendation for representing and exchanging provenance across systems and contexts, and the repo already has PROV-O-aligned NLP handoff provenance (`https://www.w3.org/TR/prov-o/`).
- EXTR is necessary because PROV-O does not standardize extraction-specific fields such as model name, ontology version, confidence score, extraction method, source chunk ID, alignment status, prompt hash, or shape version. Those should live under Beep authority, not as ad-hoc unowned terms.
- RDF-star/RDF 1.2 is attractive for assertion-level confidence and evidence, but RDF 1.2 Concepts was a Candidate Recommendation Snapshot on 2026-04-07 and syntax documents were still moving through the W3C publication pipeline in June/July 2026. Use it as an export shape and later internal optimization, not the only v1 persistence contract (`https://www.w3.org/TR/rdf12-concepts/`; `https://www.w3.org/groups/wg/rdf-star/publications`).
- Named graphs or dataset partitions should preserve source artifact, extraction batch, ontology version, and validation run boundaries. SHACL-DS is a useful research signal here because it explicitly targets dataset-aware validation without flattening named graph provenance (`arxiv:2605.10540`).

Minimum extraction metadata fields for `ns.beep.sh`:

- `extr:confidence`: decimal in `[0,1]`, aligned with the existing `UnitInterval` confidence fields.
- `extr:usedModel`: model/provider identifier or repo-owned model alias.
- `extr:ontologyVersion`: immutable ontology slice/version identifier.
- `extr:sourceChunk`: IRI or stable ID for the chunk/span carrier.
- `extr:extractionMethod`: controlled value such as `llm-schema-guided`, `xml-standards-parser`, `email-header-parser`, `repair-pass`, or `human-curated`.
- `extr:alignmentStatus`: carry existing LangExtract alignment status.
- `extr:promptHash` and `extr:shapeVersion`: optional but recommended for reproducible repair loops and validation reports.

## (d) Fetchable Ontology/Vocab Artifacts And Vendor Manifest Status

No files were saved under `explorations/legal-ontology-landscape/assets/vendor/` and no `manifest.jsonl` rows were appended in this P3 pass.

Reason: the task also required exactly one new file, and this checkout does not contain `explorations/legal-ontology-landscape/assets/README.md` or any manifest schema to follow. Creating vendor files plus a manifest would have violated the exact one-new-file output contract. The fetchable candidates below should be vendored later once the packet's asset schema is present:

- WIPO ST.96 official PDF: `https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf`
- WIPO ST.36 official PDF result: `https://www.wipo.int/documents/d/standards/docs-en-tracked-changes-03-36-01_changes_2005-10.pdf`
- USPTO current grant/application DTDs linked from `https://www.uspto.gov/learning-and-resources/xml-resources`
- EPO EBD/DOCDB/INPADOC manuals linked from `https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/manuals`
- Linked USPTO patent data / XML-to-RDF tooling references:
  - `https://raw.githubusercontent.com/smartdataanalytics/linked-uspto-patent-data/HEAD/README.md`
  - `https://github.com/chillSen/USPTO-XML2RDF-Tool`
  - `https://raw.githubusercontent.com/lettergram/parse-uspto-xml/HEAD/README.md`

Suggested manifest row shape once `assets/README.md` exists:

```json
{"phase":"P3","verified":false,"kind":"external-artifact","sourceUrl":"https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf","localPath":"assets/vendor/<filename>","title":"WIPO ST.96","notes":"Official WIPO XML standard candidate for patent/IP XML grounding."}
```

## Source Base

Firecrawl-verified web/GitHub sources:

- Google LangExtract: `https://github.com/google/langextract`
- LangExtract Outlines provider: `https://github.com/dottxt-ai/langextract-outlines`
- OntoGPT: `https://github.com/monarch-initiative/ontogpt`
- OntoGPT applied term extraction study: `https://pmc.ncbi.nlm.nih.gov/articles/PMC12892472/`
- ODKE+: `https://arxiv.org/html/2509.04696v1`
- Palantir Ontology-Augmented Generation: `https://www.palantir.com/docs/foundry/ontology/ontology-augmented-generation/`
- OG-RAG: `https://arxiv.org/html/2412.15235v1`
- Microsoft GraphRAG docs: `https://microsoft.github.io/graphrag/`
- W3C SHACL: `https://www.w3.org/TR/shacl/`
- KG Construct validation tutorial: `https://kg-construct.github.io/tutorials/kcap2023/`
- WIPO Standards hub: `https://www.wipo.int/en/web/standards`
- WIPO ST.96: `https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf`
- WIPO ST.36 search result: `https://www.wipo.int/documents/d/standards/docs-en-tracked-changes-03-36-01_changes_2005-10.pdf`
- USPTO XML Resources: `https://www.uspto.gov/learning-and-resources/xml-resources`
- USPTO bulk data portal: `https://data.uspto.gov/bulkdata/datasets`
- EPO EP full-text data: `https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/data`
- EPO national full-text data: `https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/national-full-text-data`
- EPO manuals: `https://www.epo.org/en/searching-for-patents/data/bulk-data-sets/manuals`
- Linked USPTO patent data README: `https://raw.githubusercontent.com/smartdataanalytics/linked-uspto-patent-data/HEAD/README.md`
- USPTO XML2RDF Tool: `https://github.com/chillSen/USPTO-XML2RDF-Tool`
- Parse USPTO XML README: `https://raw.githubusercontent.com/lettergram/parse-uspto-xml/HEAD/README.md`
- Microsoft Graph message resource: `https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0`
- Apache Tika supported formats: `https://tika.apache.org/2.4.1/formats.html`
- CMU Enron dataset: `https://www.cs.cmu.edu/~enron/`
- W3C PROV-O: `https://www.w3.org/TR/prov-o/`
- W3C RDF 1.2 Concepts: `https://www.w3.org/TR/rdf12-concepts/`
- RDF & SPARQL WG publications: `https://www.w3.org/groups/wg/rdf-star/publications`
- Ontograph Core: `https://github.com/openshuyi/ontograph-core`

Firecrawl Research paper IDs:

- SPIRES: `pmcid:PMC10924283`
- Wikontic: `arxiv:2512.00590`
- TextMineX: `arxiv:2509.15098`
- Ontology-grounded KG construction under Wikidata schema: `arxiv:2412.20942`
- JSONSchemaBench: `arxiv:2501.10868`
- SHACL-DS: `arxiv:2605.10540`
- PEDANTIC: `arxiv:2505.21342`
- PANORAMA: `arxiv:2510.24774`
- TRIZ-RAGNER: `arxiv:2602.23656`
