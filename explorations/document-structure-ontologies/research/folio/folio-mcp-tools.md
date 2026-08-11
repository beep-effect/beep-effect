# FOLIO MCP tools — original research notes

Source: https://openlegalstandard.org/resources/folio-mcp-tools/

Captured: 2026-08-11. The upstream page's redistribution terms were not
verified, so this file keeps an original capability summary rather than the
full tools-reference page. Consult the linked page for current parameters and
examples.

## Capability shape

The reference groups twelve read-oriented tools into four jobs:

| Job | Upstream tool names | Packet relevance |
| --- | --- | --- |
| Discovery | `list_branches`, `search_concepts`, `search_definitions` | Give agents bounded entry points without requiring query-language fluency. |
| Browsing | `get_taxonomy_branch`, `get_concept`, `get_children`, `get_parents` | Supply hierarchy navigation for mid-draft legal classification. |
| Advanced query | `query_concepts`, `query_properties`, `get_properties` | Useful later; broader filters are not required for the first beep slice. |
| Relationship/export | `find_connections`, `export_concept` | Pattern donors for governed graph traversal and portable result shapes. |

The first beep implementation should add equivalents for branch listing,
concept lookup, child/parent traversal, and definition search to the existing
governed ontology toolkit. It should not add another MCP deployable or assume
that the upstream server's API/local storage model matches TaxonomyLoader.

## Operational observations

- Hierarchy calls are depth-bounded; the reference recommends shallow
  traversal to avoid oversized results.
- Search and query operations cap result counts.
- Concept export is offered in multiple graph/document formats upstream, but
  beep-effect can defer export until its existing provenance and validation
  contracts have an explicit use case.
- Example workflows cover clause labeling, docket-document classification,
  client-intake practice areas, multilingual glossaries, and property
  exploration. These are evidence for tool ergonomics, not proof that the
  underlying taxonomy is complete for patent-document structure.

## Provenance and use

This is a reference-only summary. Current schemas, parameter names, and
examples belong to the upstream page. Licensing and disposition are tracked
in [`../SOURCES.md`](../SOURCES.md).
