# FOLIO and Lynx Taxonomy Browse Spec

## Objective

A pinned IP-relevant FOLIO slice and Lynx-vetted `lkg.ttl` slice convert into
the repo's TaxonomySeed shape, validate/load fail-closed, and are navigable
through read-only tools in the existing ontology MCP toolkit.

## Non-Goals

- All 18k FOLIO classes or live FOLIO APIs.
- A new taxonomy MCP deployable.
- Runtime OWL reasoning or persistent external graph authority.
- Lynx patent/IP semantics or unlicensed ELI/lexicog vendoring.
- Patent-document or SPAR-wire implementation.

## Source Hierarchy

The ceremony request, repo instructions, document-structure D6–D8, Lynx
DECISIONS/SOURCES for `lkg.ttl`, this SPEC, PLAN, then GOAL.

## Target Surfaces

- `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts`
- `TaxonomyLoader.ts` and `TaxonomyRegistry.ts`
- `packages/ontology/use-cases/src/tools/OntologyToolkit.ts`
- `packages/ontology/server/src/tools/OntologyToolHandlers.ts`
- Pinned acquisition/conversion inputs, notices, fixtures, and tests

## Constraints

- FOLIO is limited to IP Law, UTBMS PA*/TR*, USPTO/government entities, and
  coarse document types at one pinned release.
- Lynx owns artifact vetting/license proof; this goal cannot proceed on an
  inferred license.
- Both sources convert into the same repo-owned TaxonomySeed JSON-LD contract.
- Loader validation stays fail-closed and preserves source-specific provenance.
- Browse tools are read-only equivalents of list branches, get concept,
  children, parents, and search definitions, under existing budgets/transport.

## Acceptance Criteria

- [ ] Exact FOLIO and Lynx inputs, licenses, checksums, conversion rules, and
      notices are recorded.
- [ ] Both curated slices validate as TaxonomySeed and load fail-closed.
- [ ] Read-only browse tools expose branch/concept/child/parent/search results.
- [ ] Existing ontology-tool governance, transport, and integration harness are reused.
- [ ] No full-vocabulary or live-API dependency enters runtime.

## Decision Log

| Decision | Inherited contract |
| --- | --- |
| D1 | This goal composes taxonomy and MCP layers only. |
| D2 | SPAR vocabulary is a sibling goal. |
| D3 | Patent schema stays in law-practice. |
| D4 | Extend the existing toolkit with read-only browse tools. |
| D5 | PO annotations are out of scope. |
| D6 | Vendor only a pinned vetted IP-relevant FOLIO slice. |
| D7 | Ship fourth after the other campaign goals. |
| D8 | Lynx `lkg.ttl` uses this TaxonomySeed machinery; Lynx owns vetting/license. |

## First Vertical Slice

Convert/load one small FOLIO branch and one Lynx-vetted seed, then navigate a
branch, concept, child, and parent through the existing toolkit handlers.

## Stop Conditions

- Lynx vetting/license proof or exact FOLIO license/pin is missing.
- The slice cannot fit TaxonomySeed without parallel vendor machinery.
- Tool delivery requires a new deployable or write surface.
