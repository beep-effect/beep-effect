# SPAR Document Annotation Wire Spec

## Objective

The identity/RDF vocabulary pipeline emits attributed pinned DOCO, DEO, FaBiO,
and CiTO modules; typed OA/PROV annotations target stable AST node ids; and a
deterministic fold turns flat Md headings into a DOCO-typed section tree.

## Non-Goals

- Runtime OWL reasoning or semantic inference.
- Patent claim semantics inside DOCO.
- PO as RDF vocabulary.
- Syntax-AST rhetoric tags.
- FOLIO/Lynx seed ingestion or MCP browse tools.

## Source Hierarchy

The ceremony request, repo instructions, source exploration BRIEF/DECISIONS/
MAP/SOURCES, this SPEC, PLAN, then GOAL.

## Target Surfaces

- `packages/foundation/modeling/identity/src/Vocab.ts`
- `packages/foundation/modeling/rdf/src/Vocab/`
- `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts`
- The smallest appropriate annotation/fold module and focused tests

## Constraints

- Acquire version-pinned upstream artifacts with exact notices: each notice states
  the license its pinned artifact declares (D9 and D13), CC BY 4.0 for pinned
  DOCO, DEO, FaBiO and CiTO. The older DEO CC-BY 3.0 observation describes
  the ontology page and 2015-07-03 release; D9 supersedes it.
- Repair generator-owned output at its registry/acquisition/generator source.
- OA targets use stable AST node ids; bodies compose document types/intents
  with PROV.
- The section fold is deterministic over heading levels and preserves source
  nodes; malformed level changes receive typed diagnostics.
- Allow per-instance refinement for multi-pattern DOCO classes.

## Acceptance Criteria

- [ ] Four terms modules generate from pinned attributed inputs with drift proof.
- [ ] Exports and notices are complete.
- [ ] Typed annotations encode/decode OA target plus SPAR/PROV body.
- [ ] A flat Md heading fixture folds deterministically into a section tree.
- [ ] Patent claim meaning and runtime reasoning remain absent.

## Decision Log

| Decision | Inherited contract |
| --- | --- |
| D1 | This goal owns wire vocab plus annotations. |
| D2 | Generate all four terms modules; PO remains LiteralKit. |
| D3 | Patent schema stays in law-practice. |
| D4 | MCP browse tools remain a later goal. |
| D5 | PO annotations are consumed only as AST structure context. |
| D6 | No FOLIO slice here. |
| D7 | Include the DOCO section fold; ship third. |
| D8 | Lynx routes to the taxonomy goal. |

## First Vertical Slice

Generate a minimal exercised term set, fold one Md heading fixture, and
round-trip one OA annotation over the resulting AST node.

## Stop Conditions

- Exact upstream artifact/license/notices cannot be pinned.
- The generator would be bypassed by hand-authored output.
- Annotation requires patent semantics or runtime reasoning.

## P0 decisions (2026-10-09)

| Decision | Choice and reason | Reversal |
| --- | --- | --- |
| D9 Release selection | Latest dated releases at commit-pinned raw URLs: DOCO 2026-06-25, DEO 2026-08-14, FaBiO and CiTO 2026-09-03. Dated paths and matching version IRIs name the release; current is a moving alias. | Change release, commit, URL and digest in the acquisition target, regenerate, then update this constraint, provenance ledger and notices together. |
| D10 Node identity | Document revision IRI plus a structural source path (zero-based block index). Stable across repeated folds of the same revision; edits require a new revision IRI. No syntax node fields. | Version the path scheme and migrate annotation targets; retain old revision resources. |
| D11 Placement | Put the Md adapter/fold next to WebAnnotation in RDF, with a single RDF to Md dependency. Md syntax stays canonical; no package is created. | Move the adapter and remove the dependency and project reference together. |
| D12 Registry | Generated SPAR registry merged with CoreVocab as SparVocab. Core inventory remains independently generated. | Remove the merged registry and consumers, then regenerate SPAR outputs. |
| D13 Artifact licenses | All four pinned artifacts declare CC BY 4.0; all four pinned repository LICENSE.md files are Attribution 4.0. DEO's inherited CC-BY 3.0 ledger observation is historical. D9 and this row supersede this packet's prior constraint and exploration D2's older page statement for these releases. | Revert D9, this row, constraint, ledger pins, acquisition constants and notices together; an older release requires its own license notice. |
| D14 Term policy | Curated generator input: DOCO Section, SectionTitle, Paragraph, List, Figure, Title; DEO Introduction, Methods; FaBiO Report; CiTO cites, citesAsEvidence. Validate explicit class/property declarations in the byte-pinned Turtle and hash sorted selected local names. Runtime constants cover exercised terms only. | Extend the checked-in filter and semantic digest, regenerate and update drift/fixture tests. |
| D15 Fold recovery | Attach a heading to the nearest preceding lower-level section; emit a tagged level-jump diagnostic for missing intermediate levels. Keep the heading as the first source child. PO comes only from constructor annotations, with optional per-instance refinement in the annotation body. | Version the fold and migrate consumers with fixtures covering the new recovery rule. |

## Frozen synthetic fixtures

A revision has blocks: h1 “Overview”, paragraph “Generic technical notes”,
h3 “Detail” (deliberate jump), paragraph “Measured observations”, h2 “Methods”,
h3 “Procedure”. A DOCO Title body refines its pattern to block (multi-pattern
class); a second instance may refine Title to field. The OA annotation selects
the folded Detail heading's structural id, types its body as DOCO Title and
DEO Introduction, types the document as FaBiO Report, carries CiTO
citesAsEvidence toward a synthetic source, and attributes it through PROV.
