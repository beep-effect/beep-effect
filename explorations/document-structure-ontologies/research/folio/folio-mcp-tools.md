New [FOLIO MCP Server: Use FOLIO in Claude Code, Gemini CLI, and Codex »](https://openlegalstandard.org/resources/folio-mcp)

# FOLIO MCP Tools Reference

Complete reference for all 12 tools provided by the [FOLIO MCP Server](https://openlegalstandard.org/resources/folio-mcp). Each tool includes parameter documentation and examples using real FOLIO concepts.

The FOLIO MCP Server brings 18,000+ legal concepts — areas of law, document types, legal entities, and more — directly into AI coding assistants like Claude Code, Gemini CLI, and OpenAI Codex via the [Model Context Protocol](https://modelcontextprotocol.io/).

| Resource | Link |
| --- | --- |
| MCP Server Setup | [/resources/folio-mcp](https://openlegalstandard.org/resources/folio-mcp) |
| GitHub Repository | [github.com/alea-institute/folio-mcp](https://github.com/alea-institute/folio-mcp) |
| FOLIO API | [folio.openlegalstandard.org/docs](https://folio.openlegalstandard.org/docs) |
| PyPI Package | [pypi.org/project/folio-mcp](https://pypi.org/project/folio-mcp/) |

## Quick Reference

Jump to any tool or section:

#### Discovery Tools

- [list\_branches](https://openlegalstandard.org/resources/folio-mcp-tools/#list_branches) — List all taxonomy branches
- [search\_concepts](https://openlegalstandard.org/resources/folio-mcp-tools/#search_concepts) — Search by concept name
- [search\_definitions](https://openlegalstandard.org/resources/folio-mcp-tools/#search_definitions) — Search by definition text

#### Browsing Tools

- [get\_taxonomy\_branch](https://openlegalstandard.org/resources/folio-mcp-tools/#get_taxonomy_branch) — Browse a branch
- [get\_concept](https://openlegalstandard.org/resources/folio-mcp-tools/#get_concept) — Full concept details
- [get\_children](https://openlegalstandard.org/resources/folio-mcp-tools/#get_children) — Navigate down
- [get\_parents](https://openlegalstandard.org/resources/folio-mcp-tools/#get_parents) — Navigate up

#### Advanced Query Tools

- [query\_concepts](https://openlegalstandard.org/resources/folio-mcp-tools/#query_concepts) — Filtered concept search
- [query\_properties](https://openlegalstandard.org/resources/folio-mcp-tools/#query_properties) — Filtered property search
- [get\_properties](https://openlegalstandard.org/resources/folio-mcp-tools/#get_properties) — All OWL properties

#### Relationship and Export Tools

- [find\_connections](https://openlegalstandard.org/resources/folio-mcp-tools/#find_connections) — Semantic triples
- [export\_concept](https://openlegalstandard.org/resources/folio-mcp-tools/#export_concept) — Export to Markdown/JSON-LD/OWL

**Workflow Examples**: [Labeling Contract Clauses](https://openlegalstandard.org/resources/folio-mcp-tools/#workflow-1-labeling-contract-clauses) \| [Classifying Docket Motions](https://openlegalstandard.org/resources/folio-mcp-tools/#workflow-2-classifying-motions-in-a-bankruptcy-docket) \| [Client Intake](https://openlegalstandard.org/resources/folio-mcp-tools/#workflow-3-identifying-areas-of-law-for-client-intake) \| [Multilingual Glossary](https://openlegalstandard.org/resources/folio-mcp-tools/#workflow-4-building-a-multilingual-legal-glossary) \| [Schema Design](https://openlegalstandard.org/resources/folio-mcp-tools/#workflow-5-exploring-ontology-properties-for-schema-design)

* * *

## Discovery Tools

### list\_branches

List all FOLIO taxonomy branches with concept counts. This is the starting point for understanding what the ontology covers.

**Parameters**: None

**Returns**: JSON object mapping branch names to concept counts.

**Example**:

```
> list_branches()

{
  "actors_players": 6,
  "areas_of_law": 31,
  "asset_types": 4,
  "communication_modalities": 3,
  "currencies": 178,
  "data_formats": 17,
  "document_artifacts": 7,
  "engagement_terms": 14,
  "events": 14,
  "forum_venues": 3,
  "governmental_bodies": 10,
  "industries": 21,
  "languages": 487,
  "legal_authorities": 14,
  "legal_entities": 6,
  "locations": 8,
  "matter_narratives": 8,
  "matter_narrative_formats": 2,
  "objectives": 13,
  "services": 5,
  "standards_compatibilities": 5,
  "statuses": 3,
  "system_identifiers": 4
}
```

### search\_concepts

Search concepts by label (name) using fuzzy matching. This is the **primary entry point** for finding concepts — start here.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `query` | string | Yes | — | Search term (e.g., `"bankruptcy"`, `"trust"`) |
| `limit` | integer | No | 10 | Maximum results to return |

**Returns**: JSON array of `{iri, label, definition, score}`.

**Example**:

```
> search_concepts(query="assignment clause", limit=3)

[\
  {\
    "iri": "https://folio.openlegalstandard.org/...",\
    "label": "Assignment Clause",\
    "definition": "An Assignment Clause is a provision in a contract\
      that allows a party to transfer their rights or obligations\
      under the contract to another party.",\
    "score": 100.0\
  },\
  ...\
]
```

### search\_definitions

Search concepts by definition text. Use this when `search_concepts` doesn’t find what you need by name.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `query` | string | Yes | — | Search term to match against definitions |
| `limit` | integer | No | 10 | Maximum results to return |

**Returns**: JSON array of `{iri, label, definition, score}`.

**Example**:

```
> search_definitions(query="fiduciary duty", limit=3)

[\
  {\
    "iri": "https://folio.openlegalstandard.org/R7wZePVWBKLVfAUwDtboutg",\
    "label": "Agent Liability",\
    "definition": "Agent Liability refers to the legal responsibility\
      of an individual or entity acting as an agent for another\
      party, for any harm caused to a third party due to their\
      negligence or breach of fiduciary duty.",\
    "score": 100.0\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/R7ZUD4AC5YHqLtlGhBqc2Ti",\
    "label": "Fiduciary Relationship",\
    "definition": "A fiduciary relationship is a legal relationship\
      in which one party is entrusted with the care and management\
      of another party's assets or interests...",\
    "score": 100.0\
  },\
  ...\
]
```

* * *

## Browsing Tools

### get\_taxonomy\_branch

Get top-level concepts in a FOLIO taxonomy branch. Use [`list_branches`](https://openlegalstandard.org/resources/folio-mcp-tools/#list_branches) first to see available branch names.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `branch_name` | string | Yes | — | Branch name (e.g., `"areas_of_law"`, `"document_artifacts"`) |
| `max_depth` | integer | No | 1 | Depth limit. Keep at 1-2 to avoid large results. |

**Returns**: JSON array of `{iri, label, definition}` summaries.

**Example**:

```
> get_taxonomy_branch(branch_name="areas_of_law", max_depth=1)

[\
  {\
    "iri": "https://folio.openlegalstandard.org/RCIPwpgRpMs1eVz4vPid0pV",\
    "label": "Contract Law",\
    "definition": "The General Theory of Contracts is an umbrella\
      term used in civil law jurisdictions..."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/RMZ6lNihK8TG4Flhco1yTy",\
    "label": "Criminal Law",\
    "definition": "Law concerned with the punishment of individuals\
      who commit crimes."\
  },\
  ... // 31 areas of law total\
]
```

### get\_concept

Get the full record for a specific concept by IRI. Accepts short IDs (e.g., `"RCIPwpgRpMs1eVz4vPid0pV"`) or full IRIs.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `iri` | string | Yes | — | Concept IRI or short ID |

**Returns**: Full JSON with label, definition, alternative labels, translations, parent/child IRIs, cross-references, identifiers, and more.

**Example**:

```
> get_concept(iri="RCIPwpgRpMs1eVz4vPid0pV")

{
  "iri": "https://folio.openlegalstandard.org/RCIPwpgRpMs1eVz4vPid0pV",
  "label": "Contract Law",
  "definition": "The General Theory of Contracts is an umbrella
    term used in civil law jurisdictions...",
  "alternative_labels": ["General Theory of Contracts"],
  "translations": {},
  "sub_class_of": [\
    "https://folio.openlegalstandard.org/RSYBzf149Mi5KE0YtmpUmr"\
  ],
  "parent_class_of": [\
    "https://folio.openlegalstandard.org/RBrUb9V2u6f7iVR1RBNsyB1",\
    "https://folio.openlegalstandard.org/RCPtRu7JjCg1Do3DUtQofho",\
    "https://folio.openlegalstandard.org/RDlMcnPEFzMJer6LE0dJJj9",\
    ...\
  ],
  "see_also": [\
    "https://folio.openlegalstandard.org/R8xB67rtMDMgJgiTMAX9UXW"\
  ],
  "deprecated": false
}
```

### get\_children

Get child concepts of a given concept. Navigate the taxonomy incrementally rather than using deep `max_depth`.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `iri` | string | Yes | — | Concept IRI or short ID (not a branch name) |
| `max_depth` | integer | No | 1 | Depth limit for traversal |

**Returns**: JSON array of `{iri, label, definition}` summaries.

**Example**:

```
> get_children(iri="RCIPwpgRpMs1eVz4vPid0pV")

[\
  {\
    "iri": "https://folio.openlegalstandard.org/RBrUb9V2u6f7iVR1RBNsyB1",\
    "label": "Civil Contract Law",\
    "definition": "Civil Contract Law refers to a subset of Civil\
      Law that deals with agreements between private entities..."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/RCPtRu7JjCg1Do3DUtQofho",\
    "label": "Commercial Transactions Law",\
    "definition": "Law related to business contracts and agreements."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/RFG8cttIFCPLJVsOIlLOnY",\
    "label": "Employment Contracts Law",\
    "definition": "Employment Contracts Law refers to the legal\
      principles and regulations governing the agreements between\
      employers and employees..."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/RDlMcnPEFzMJer6LE0dJJj9",\
    "label": "Government Contracts Law",\
    "definition": "Laws relating to contracts in which the government\
      is a party."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/RIeTFTPy9Um78489NqJxjn",\
    "label": "Independent Contractor Law",\
    "definition": "A legal concept that pertains to the classification\
      and treatment of individuals who provide services as\
      non-employees..."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/R7mghrIauk4oJaakhl0B8pU",\
    "label": "Property Rights and Transactions Law",\
    "definition": "Law relating to the acquisition and transfer\
      of real property."\
  }\
]
```

### get\_parents

Get parent concepts of a given concept. Navigate upward in the taxonomy.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `iri` | string | Yes | — | Concept IRI or short ID (not a branch name) |
| `max_depth` | integer | No | 1 | Depth limit for traversal |

**Returns**: JSON array of `{iri, label, definition}` summaries.

**Example**:

```
> get_parents(iri="RCIPwpgRpMs1eVz4vPid0pV")

[\
  {\
    "iri": "https://folio.openlegalstandard.org/RSYBzf149Mi5KE0YtmpUmr",\
    "label": "Area of Law",\
    "definition": "The practice area into which a legal matter or\
      legal area of study falls (e.g., Criminal Law, Real Property\
      Law, Tax and Revenue Law)."\
  }\
]
```

* * *

## Advanced Query Tools

### query\_concepts

Query concepts with composable text and structural filters. More powerful than [`search_concepts`](https://openlegalstandard.org/resources/folio-mcp-tools/#search_concepts) — supports field-specific matching, structural constraints, and multiple match modes. All specified filters must match (AND logic).

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `label` | string | No | null | Match against concept label |
| `definition` | string | No | null | Match against definition text |
| `alt_label` | string | No | null | Match against alternative labels |
| `example` | string | No | null | Match against examples |
| `any_text` | string | No | null | Match against all text fields |
| `branch` | string | No | null | Limit to a taxonomy branch (e.g., `"AREA_OF_LAW"`) |
| `parent_iri` | string | No | null | Only descendants of this IRI |
| `has_children` | boolean | No | null | `true` = non-leaf only, `false` = leaf only |
| `deprecated` | boolean | No | false | Include deprecated concepts |
| `country` | string | No | null | Match against the country field |
| `match_mode` | string | No | `"substring"` | `"substring"`, `"exact"`, `"regex"`, or `"fuzzy"` |
| `limit` | integer | No | 20 | Maximum results |

**Returns**: JSON array of matching concepts.

**Example** — Find contract-related areas of law:

```
> query_concepts(label="contract", branch="AREA_OF_LAW", limit=3)

[\
  {\
    "iri": "https://folio.openlegalstandard.org/RBrUb9V2u6f7iVR1RBNsyB1",\
    "label": "Civil Contract Law",\
    "definition": "Civil Contract Law refers to a subset of Civil\
      Law that deals with agreements between private entities..."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/RCIPwpgRpMs1eVz4vPid0pV",\
    "label": "Contract Law",\
    "definition": "The General Theory of Contracts is an umbrella term..."\
  },\
  {\
    "iri": "https://folio.openlegalstandard.org/RDlMcnPEFzMJer6LE0dJJj9",\
    "label": "Government Contracts Law",\
    "definition": "Laws relating to contracts in which the government\
      is a party."\
  }\
]
```

**Example** — Find only leaf concepts (no children) matching “motion”:

```
> query_concepts(label="motion", has_children=false, limit=5)
```

### query\_properties

Query OWL object properties with composable filters. Use this instead of [`get_properties`](https://openlegalstandard.org/resources/folio-mcp-tools/#get_properties) when you need filtered results.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `label` | string | No | null | Match against property label |
| `definition` | string | No | null | Match against property definition |
| `domain_iri` | string | No | null | Only properties whose domain includes this class |
| `range_iri` | string | No | null | Only properties whose range includes this class |
| `has_inverse` | boolean | No | null | `true` = only properties with inverses |
| `match_mode` | string | No | `"substring"` | `"substring"`, `"exact"`, `"regex"`, or `"fuzzy"` |
| `limit` | integer | No | 20 | Maximum results |

**Returns**: JSON array of properties with `iri`, `label`, `definition`, `domain`, and `range`.

**Example**:

```
> query_properties(label="governs", limit=3)

[\
  {\
    "iri": "https://folio.openlegalstandard.org/...",\
    "label": "governedBy",\
    "definition": "Indicates the legal authority or body that\
      governs a particular entity or process.",\
    "domain": [...],\
    "range": [...]\
  },\
  ...\
]
```

### get\_properties

Get all OWL object properties defined in the FOLIO ontology. Returns the full list of relationship types (e.g., `"hasJurisdiction"`, `"appliesTo"`, `"governedBy"`).

**Parameters**: None

**Returns**: JSON array of all properties with `iri`, `label`, `definition`, `domain`, and `range`. This can be a large result set.

**Example**:

```
> get_properties()

[\
  {\
    "iri": "https://folio.openlegalstandard.org/...",\
    "label": "hasJurisdiction",\
    "definition": "Relates a legal concept to the jurisdiction\
      in which it applies.",\
    "domain": [...],\
    "range": [...]\
  },\
  ...\
]
```

* * *

## Relationship and Export Tools

### find\_connections

Find semantic connections (subject-property-object triples) between FOLIO concepts. At minimum, provide a `subject_iri`. Optionally filter by property and/or object.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `subject_iri` | string | Yes | — | IRI of the subject concept |
| `property_name` | string | No | null | Property name or IRI to filter by |
| `object_iri` | string | No | null | Object concept IRI to filter by |

**Returns**: JSON array of triples `[{subject: {...}, property: {...}, object: {...}}]`.

**Example**:

```
> find_connections(
    subject_iri="https://folio.openlegalstandard.org/R19C64e46C5480B0a9f4820a"
  )

[\
  {\
    "subject": {\
      "iri": "https://folio.openlegalstandard.org/R19C64e46C5480B0a9f4820a",\
      "label": "U.S. Bankruptcy Court - S.D. Ohio"\
    },\
    "property": {\
      "iri": "https://folio.openlegalstandard.org/...",\
      "label": "hasJurisdiction"\
    },\
    "object": {\
      "iri": "https://folio.openlegalstandard.org/...",\
      "label": "Southern District of Ohio"\
    }\
  },\
  ...\
]
```

**Note:** Not all concepts have connections. Many concepts only participate in the `subClassOf` hierarchy, which is accessed via [get\_children](https://openlegalstandard.org/resources/folio-mcp-tools/#get_children) and [get\_parents](https://openlegalstandard.org/resources/folio-mcp-tools/#get_parents) instead.

### export\_concept

Export a FOLIO concept in a specific format for integration or documentation.

**Parameters**:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `iri` | string | Yes | — | Concept IRI or short ID |
| `format` | string | No | `"markdown"` | `"markdown"`, `"jsonld"`, or `"owl_xml"` |

**Returns**: The concept in the requested format.

**Example** — Markdown export:

```
> export_concept(iri="RCIPwpgRpMs1eVz4vPid0pV", format="markdown")

# Contract Law

**IRI:** https://folio.openlegalstandard.org/RCIPwpgRpMs1eVz4vPid0pV

## Labels

**Alternative Labels:**
- General Theory of Contracts

## Definition

The General Theory of Contracts is an umbrella term used in civil
law jurisdictions, like Spain and Latin America, that refers to the
body of law that governs contracts...

## Sub Class Of
- https://folio.openlegalstandard.org/RSYBzf149Mi5KE0YtmpUmr

## Parent Class Of
- https://folio.openlegalstandard.org/R7mghrIauk4oJaakhl0B8pU
- https://folio.openlegalstandard.org/RBrUb9V2u6f7iVR1RBNsyB1
- ...
```

**Example** — JSON-LD export for system integration:

```
> export_concept(iri="RCIPwpgRpMs1eVz4vPid0pV", format="jsonld")
```

* * *

## Workflow Examples

These examples demonstrate multi-step workflows that combine multiple FOLIO MCP tools to accomplish real legal tasks. Each workflow shows the exact tool calls in sequence, so you can reproduce them in any MCP-compatible AI assistant.

### Workflow 1: Labeling Contract Clauses

Classify an indemnification clause in a commercial agreement by finding the matching FOLIO concept and its taxonomy path.

**Step 1** — Search for the clause type:

```
> search_concepts(query="indemnification clause")

[\
  {\
    "label": "Indemnification Clause",\
    "iri": "https://folio.openlegalstandard.org/...",\
    "definition": "An Indemnification Clause is a contractual provision\
      where one party agrees to compensate the other for certain\
      damages or losses."\
  },\
  ...\
]
```

**Step 2** — Get the full concept record with translations and identifiers:

```
> get_concept(iri="<iri from step 1>")
```

This returns alternative labels, translations (e.g., Spanish: “Clausula de Indemnizacion”), cross-references, and deprecation status.

**Step 3** — Find where it sits in the taxonomy:

```
> get_parents(iri="<iri from step 1>")

// Returns the parent concept (e.g., "Contractual Clause")
```

**Step 4** — Discover subtypes for finer-grained classification:

```
> get_children(iri="<iri from step 1>")

// Returns subtypes like:
//   - Indemnification by Buyer Clause
//   - Indemnification by Seller Clause
//   - Cross-Indemnification Clause
```

This gives an AI agent enough context to label the clause with both a broad category and a specific subtype, along with a standardized IRI for downstream systems.

### Workflow 2: Classifying Motions in a Bankruptcy Docket

Given a list of motions filed in a bankruptcy case, classify each against the FOLIO taxonomy.

**Step 1** — Browse the `document_artifacts` branch to understand the taxonomy:

```
> get_taxonomy_branch(branch_name="document_artifacts", max_depth=1)

// Returns top-level document categories:
//   - Transactional Documents
//   - Litigation Documents
//   - Regulatory Documents
//   - ...
```

**Step 2** — Search for a specific motion type:

```
> search_concepts(query="motion to dismiss")

[\
  {\
    "label": "Motion to Dismiss",\
    "iri": "https://folio.openlegalstandard.org/...",\
    "definition": "A Motion to Dismiss is a legal filing requesting\
      the court to dismiss the case..."\
  }\
]
```

**Step 3** — Get full details and the taxonomy path:

```
> get_concept(iri="<motion to dismiss iri>")
> get_parents(iri="<motion to dismiss iri>")

// Taxonomy path:
//   Motion to Dismiss -> Motion -> Litigation Document -> Document Types
```

**Step 4** — Export for integration into a docket management system:

```
> export_concept(iri="<motion to dismiss iri>", format="jsonld")
```

Repeat steps 2-4 for each motion in the docket: “Wages Motion”, “Pre-petition Payroll Motion”, “Scheduling Motion”, etc. The FOLIO taxonomy provides standardized labels and IRIs for each.

### Workflow 3: Identifying Areas of Law for Client Intake

During client intake, determine which practice areas apply to a new matter involving a data breach at a healthcare company.

**Step 1** — Browse all available areas of law:

```
> get_taxonomy_branch(branch_name="areas_of_law", max_depth=1)

// Returns 31 practice areas including:
//   - Health Law
//   - Information Security Law
//   - Insurance Law
//   - Personal Injury and Tort Law
```

**Step 2** — Search definitions for concepts related to the scenario:

```
> search_definitions(query="data breach healthcare")
```

**Step 3** — Use structural queries to narrow down:

```
> query_concepts(
    definition="unauthorized access",
    branch="AREA_OF_LAW",
    limit=5
  )
```

**Step 4** — Get children for each relevant area to find sub-specialties:

```
> get_children(iri="<Information Security Law iri>")

// Returns sub-areas like:
//   - Data Breach Law
//   - Privacy Law
//   - Cybersecurity Compliance
```

This workflow identifies that the matter touches Information Security Law, Health Law, and potentially Insurance Law — each with standardized FOLIO IRIs for matter management systems.

### Workflow 4: Building a Multilingual Legal Glossary

Create a glossary of bankruptcy terms with translations for a multinational law firm.

**Step 1** — Find the bankruptcy branch:

```
> search_concepts(query="bankruptcy", limit=5)

// Finds: "Bankruptcy and Financial Restructuring Practice",
//   "Bankruptcy Claims Practice", etc.
```

**Step 2** — Get the parent area and its children:

```
> get_children(
    iri="https://folio.openlegalstandard.org/R8g9E8c4U6pZQefIjUNRuDd"
  )

// Returns all sub-areas of Bankruptcy, Insolvency,
// and Restructuring Law.
```

**Step 3** — For each concept, retrieve the full record with translations:

```
> get_concept(iri="<each child iri>")

// Returns translations like:
//   es-es: "Ley de Quiebras"
//   fr-fr: "Droit de la faillite"
//   ja-jp: "破産法"
//   zh-cn: "破产法"
```

**Step 4** — Export each concept in a structured format:

```
> export_concept(iri="<iri>", format="markdown")
```

Repeat for each term to build a comprehensive multilingual glossary grounded in standardized legal concepts.

### Workflow 5: Exploring Ontology Properties for Schema Design

Design a database schema for a legal matter management system using FOLIO’s relationship types.

**Step 1** — List all object properties:

```
> get_properties()

// Returns all OWL object properties like:
//   hasJurisdiction, appliesTo, governedBy, hasParty, ...
```

**Step 2** — Query for properties relevant to your domain:

```
> query_properties(label="party", limit=5)

// Returns properties related to parties in legal matters.
```

**Step 3** — Find how properties connect specific concepts:

```
> find_connections(
    subject_iri="<a court concept iri>",
    property_name="hasJurisdiction"
  )
```

This reveals the actual relationship instances in the ontology, which can inform your schema’s foreign key relationships and join tables.

* * *

## Prompt Templates

The FOLIO MCP server includes 11 reusable prompt templates that guide AI assistants through structured classification workflows. Each template instructs the AI to search, browse the relevant taxonomy branch, navigate to the best match, and return a structured result with FOLIO Label, IRI, Definition, Confidence, and Reasoning.

See the [FOLIO MCP Server page](https://openlegalstandard.org/resources/folio-mcp#prompt-templates) for the full prompt table with arguments.

| Prompt | Taxonomy Branch(es) | Use Case |
| --- | --- | --- |
| classify-document | document\_artifacts | Classify a legal document type |
| identify-area-of-law | areas\_of\_law | Identify practice areas for a situation |
| classify-entity | actors\_players, legal\_entities | Classify a legal entity, role, or organization |
| classify-industry | industries | Classify the industry for a matter or client |
| identify-legal-authority | legal\_authorities | Identify authority type (statute, regulation, case law) |
| classify-event | events | Classify a legal event type |
| identify-service-type | services | Identify legal service type for a matter |
| identify-forum-venue | forum\_venues, governmental\_bodies | Identify forum, venue, or governmental body |
| identify-objective | objectives | Identify legal objectives for a matter |
| classify-asset | asset\_types | Classify an asset type |
| identify-engagement-terms | engagement\_terms | Identify engagement terms for billing arrangements |

* * *

## Tips and Best Practices

- **Start with `search_concepts()`** as the primary entry point. Fall back to `search_definitions()` when name-based search misses.
- **Keep `max_depth` at 1.** Navigate incrementally with `get_children()` rather than requesting deep trees.
- **Branch names are not IRIs.** Use `get_taxonomy_branch(“areas_of_law”)` for branches, and `get_children(iri)` / `get_parents(iri)` for concept IRIs.
- **Short IDs work everywhere.** Both `“RCIPwpgRpMs1eVz4vPid0pV”` and `“https://folio.openlegalstandard.org/RCIPwpgRpMs1eVz4vPid0pV”` are accepted.
- **Use `query_concepts()` for structured queries** — it supports field-specific matching, branch filtering, and leaf/non-leaf constraints that `search_concepts()` cannot.
- **Check for translations.** About 31% of FOLIO concepts include translations across 10+ languages including Spanish, French, Japanese, Chinese, and Hindi.
- **Export for integration.** Use `export_concept(format=“jsonld”)` for machine-readable output and `format=“owl_xml”` for semantic web tooling.

## Support

If you encounter any issues or have questions, please [open an issue on GitHub](https://github.com/alea-institute/folio-mcp/issues) or visit the [FOLIO community forum](https://discourse.openlegalstandard.org/c/folio-technical-discussion/folio-software/7).