# Naming Conventions

Standards for naming ontology entities, minting identifiers, writing
definitions, and managing labels and synonyms. All skills must follow
these conventions.

## Class Names

- **Format**: `CamelCase` (e.g., `MusicalInstrument`, `StringQuartet`)
- **Rule**: Singular nouns, never plural (`Instrument` not `Instruments`)
- **Compound terms**: No underscores or hyphens in class names
- **Avoid**: Abbreviations unless universally understood in the domain

### Mass Nouns

- **Rule**: Avoid bare mass nouns as class labels. Convert to count-compatible
  forms, typically with "portion of ...".
- **Examples**: `PortionOfBlood`, `PortionOfTissue`, `PortionOfWater`
- **Why**: OWL classes represent universals whose instances are countable
  particulars; mass terms are often ambiguous without individuation.

## Property Names

- **Object properties**: `camelCase` verb phrases (e.g., `hasComponent`,
  `partOf`, `participatesIn`)
- **Data properties**: `camelCase`. Use `has` prefix for domain-specific or
  ambiguous attributes (e.g., `hasWeight`, `hasStartDate`). Bare names are
  acceptable when aligned to a well-known vocabulary (e.g., schema.org) and
  unambiguous in context (e.g., `title`, `url`, `publishedDate`). Avoid bare
  names that collide with OWL/RDFS keywords — e.g., use `siteDomain` instead
  of `domain` to avoid confusion with `rdfs:domain`.
- **Inverse naming**: Use symmetric pairs — `hasPart` / `partOf`,
  `produces` / `producedBy`

### Property Naming Anti-Patterns

- **Anti-pattern**: Encoding class/domain/range in the property name
  (`plantHasBloomColor`, `patientHasBodyTemperature`)
- **Why it's wrong**: Over-specialized names reduce reuse and encourage
  duplicate properties for each class.
- **Preferred**: Keep relation names generic and constrain usage with
  domain/range or class restrictions (`hasColor`, `hasTemperature`).

## Individual Names

- **Named individuals**: `CamelCase` proper nouns (e.g., `Stradivarius1721`)
- **Test individuals**: Prefix with `test_` (e.g., `test_Piano01`)

## Identifier Minting

### OBO-style IDs (preferred for biomedical/scientific ontologies)

- Format: `{PREFIX}_{7-digit-number}` (e.g., `MYONT_0000001`)
- Prefix registered with OBO Foundry (or local prefix for project ontologies)
- IDs are opaque — never encode semantics in the numeric part
- Never reuse IDs, even after deprecation

### IRI-style IDs (for project-specific ontologies)

- Format: `{base-iri}/{ClassName}` or `{base-iri}#{ClassName}`
- Use `#` fragment for small ontologies (single-document retrieval)
- Use `/` path for large ontologies (per-term dereferencing)
- Base IRI must be a stable, resolvable URL when possible

## IRI Governance

Use a stable, documented IRI policy for long-term persistence.

- **Entity IRI pattern**: `https://<authority>/<domain>/<module>/<name>`
- **Document IRI pattern**: `https://<authority>/<domain>/<release-artifact>`
- **Versioning**: Keep entity IRIs immutable; version ontology documents using
  `owl:versionIRI` and `owl:versionInfo`
- **Do not change published entity IRIs**: deprecate terms instead
- **Persistence options**: use PURL or redirect-capable hostname management
- **Skolemization**: minimize blank nodes in released artifacts; mint stable
  IRIs when entities need external reference
- **Best-practice criteria**: availability, understandability, simplicity,
  persistence, manageability

## Labels and Annotations

Every entity MUST have:

| Annotation | Property | Requirement |
|-----------|----------|-------------|
| Label | `rdfs:label` | Exactly one per language tag |
| Definition | `skos:definition` | Required for classes and properties |
| Definition source | `dcterms:source` or `obo:IAO_0000119` | Required when definition is sourced |

### Label Rules

- Lowercase unless proper noun (e.g., "musical instrument", not "Musical Instrument")
- No abbreviations without expansion in synonym
- English (`@en`) is the default language tag
- One preferred label per language; additional forms go in synonyms

## Synonyms

Use OBO-in-OWL synonym properties:

| Property | Use When |
|----------|----------|
| `oio:hasExactSynonym` | Fully interchangeable in all contexts |
| `oio:hasRelatedSynonym` | Related but not interchangeable |
| `oio:hasBroadSynonym` | Synonym is broader than the term |
| `oio:hasNarrowSynonym` | Synonym is narrower than the term |

For production ontologies with multiple user communities, add context
annotations for labels/synonyms (for example `:prefLabelContext` and
`:altLabelContext`) and define those annotation properties in the ontology.

## Definitions: Genus-Differentia Pattern

All definitions MUST follow the genus-differentia pattern:

> "A **[parent class]** that **[differentia]**."

Examples:

| Term | Definition |
|------|-----------|
| Piano | A keyboard instrument that produces sound by hammers striking strings |
| Violin | A string instrument that is played with a bow |
| Jazz Trio | A musical ensemble that consists of exactly three performers playing jazz |

### Definition Quality Criteria

- Necessary and sufficient: captures exactly the intended extension
- No circular references (don't use the term being defined)
- No negation-only definitions ("an X that is not Y")
- Specific differentia (not "a type of X" or "a kind of X")

## Full Vocabulary Entry (Extended)

Use this two-tier approach:

- **Minimum required**: `rdfs:label`, `skos:definition`, `dcterms:source`
- **Recommended for production**: extended annotation set below

| Field | Suggested Annotation Property |
|------|-------------------------------|
| abbreviation | `skos:altLabel` (mark abbreviation in note/profile) |
| explanatoryNote | `skos:note` |
| usageNote | `skos:usageNote` |
| dependsOn | `schema:isBasedOn` |
| termOrigin | `dcterms:source` |
| definitionOrigin | `prov:wasDerivedFrom` |
| adaptedFrom | `prov:wasDerivedFrom` |
| conceptStatus | `owl:deprecated` (boolean) plus status note |
| conceptStatusDate | `dcterms:modified` |
| steward | `dcterms:creator` or `dcterms:contributor` |

## Namespace Usage

- Always use prefixed CURIEs in human-readable contexts (e.g., `BFO:0000001`)
- Always declare prefixes — see `_shared/namespaces.json` for canonical map
- Never use bare IRIs in documentation or KGCL patches
- Project-specific prefixes must be registered in the ontology header and
  in `namespaces.json`
