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

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug folio-lynx-taxonomy-browse`; add a `kind: decision` file there, never edit this block._

### research-intake-2026-11 routed 40 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 104 findings to this packet (40 affirmative, 3 critiques or disputes; 46 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- usesMethodIn: http://dublincore.org/documents/dcmi-type-vocabulary/ — Non-RDF consumers (JSON, relational and schema-based stacks) can adopt the terms by treating domains, ranges and sub-relations as soft guidance. This is a pattern for mapping DC terms into schema-firs
- usesMethodIn: https://arxiv.org/abs/2601.13806 — Concept-level legal KG schema (facts/issues/rules/conclusions) as an alternative to NER-style entity graphs; relevant to legal position and document-structure ontology design.
- usesMethodIn: https://arxiv.org/abs/2505.00039v4 — The graph is grounded in an LRMoo/FRBR Work–Expression ontology, applied at component granularity to legal norms.
- citesAsEvidence: https://arxiv.org/abs/2610.13695 — Deterministic regex-based structure extraction from official statute text yields the full legal-document hierarchy for a KG.
- supports: http://dublincore.org/specifications/dublin-core/dcmi-terms/2020-01-20/ — Non-RDF consumers, such as schema-first TypeScript models, may treat the formal RDF semantics as advisory guidance and need not enforce them as constraints.

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane `feat/research-intake-2026-11`

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

<!-- beep:decisions:end -->

## First Vertical Slice

Convert/load one small FOLIO branch and one Lynx-vetted seed, then navigate a
branch, concept, child, and parent through the existing toolkit handlers.

## Stop Conditions

- Lynx vetting/license proof or exact FOLIO license/pin is missing.
- The slice cannot fit TaxonomySeed without parallel vendor machinery.
- Tool delivery requires a new deployable or write surface.
