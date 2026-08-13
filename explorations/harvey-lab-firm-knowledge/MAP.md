# Map — Harvey LAB Firm-Knowledge Mining

Status: DRAFT FOR OPERATOR BRIEF REVIEW 2026-08-13.

## Candidate Goals

| Order | Slug | Mission | Depends on | Capability boundary |
| --- | --- | --- | --- | --- |
| 1 | `effect-native-legal-eval` (not yet created) | Ship a schema-first Effect-native legal evaluation framework and record one upstream C&H baseline run for external comparison. | Existing judge/QA and worker-eval surfaces; operator approval for metered baseline. | Reuse typed judge services and evidence inventory patterns. LAB code is reference-only for roll-our-own despite MIT permission. NET-NEW: rubric/criterion/all-pass/neutral-band framework. |
| 2 | `tracked-changes-ingest-wedge` (not yet created) | Prove and ship tracked-changes-aware OOXML-to-canonical ingest, with U4 as a P0 kill-gate and structural fallback. | `effect-native-legal-eval`; U4 must pass before semantic implementation. | Reuse Pandoc/Md models and file-processing ingestion. NET-NEW: tracked-change preservation contract and fixtures. |

## Re-entry Points

| Candidate | Gate |
| --- | --- |
| `synthetic-legal-corpus-generator` (not yet created) | A private/non-public legal shape requires a shareable graded corpus and the eval goal is stable. |
| `legal-dms-task-taxonomy` (not yet created) | A consumer demands lifecycle/conflict/DMS classification and the unpublished 14-shape classifier has been independently re-derived. |

## Sequencing

Operator BRIEF review precedes any scaffold. The eval framework ships first
because it measures the wedge and owns the one baseline run. The tracked-
changes goal opens with U4; a hard failure stops semantic implementation and
records the structural fallback. Generator and DMS candidates reopen this
packet at `decompose` only when their gates fire.

## First Vertical Slice

Evaluate a small synthetic C&H fixture with one closure criterion and one
neutral-band criterion, then run a tracked-change OOXML fixture through the U4
seam and report whether insertion/deletion identity and order survive into the
canonical model.

## Inherited Risks

- Metered baseline execution requires explicit operator approval and complete
  cost/cleanup evidence.
- C&H remains on-demand and synthetic; OIP data stays on-device only.
- U4 is a real kill-gate, not a research checkbox.
