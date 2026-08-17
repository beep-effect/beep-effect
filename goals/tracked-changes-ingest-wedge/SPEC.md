# Tracked-Changes Ingest Wedge Spec

## Objective

Prove whether OOXML insertion/deletion identity, content, and ordering survive
through the Pandoc-to-canonical Md seam, then ship the smallest
tracked-changes-aware ingest rung if U4 passes or record and implement the
explicit structural-representation fallback if semantic preservation is not
viable.

## Non-Goals

- Continuing semantic redline implementation after a hard U4 failure without a
  new operator decision.
- A corpus generator or legal-DMS taxonomy.
- A real client/OIP corpus in the first cycle.
- A general DOCX round-trip redesign or a claim that C&H proves practice-KG or
  general legal-AI quality.
- Changes to the Effect-native eval framework owned by the sibling goal.

## Source Hierarchy

1. The 2026-08-13 operator sign-off and ceremony request.
2. Repo instructions and required skills.
3. [`BRIEF.md`](../../explorations/harvey-lab-firm-knowledge/BRIEF.md),
   [`MAP.md`](../../explorations/harvey-lab-firm-knowledge/MAP.md), and
   [`DECISIONS.md`](../../explorations/harvey-lab-firm-knowledge/DECISIONS.md).
4. This `SPEC.md`, then `PLAN.md` and `GOAL.md`.

## Target Surfaces

- OOXML tracked-change fixtures and the current Pandoc AST mapping/codec.
- The canonical `@beep/md` model and relevant file-processing ingest seam.
- The sibling Effect-native eval framework for measurement.
- Focused preservation, ordering, fallback, and regression evidence.

## Constraints

- U4 is a P0 kill-gate, not a research checkbox: inspect `w:ins` and
  `w:del` identity, content, nesting/context, and order across OOXML, Pandoc,
  and canonical Md before semantic implementation.
- If U4 fails hard, stop the semantic design and use an explicit structural
  representation that retains the redline facts without pretending semantic
  fidelity.
- If U4 passes, land only the smallest tracked-changes-aware ingest rung.
- Evaluate synthetic C&H fixtures first through the sibling
  `effect-native-legal-eval` contract.
- Real diligence data comes later. Keep it out of the repo, out of telemetry,
  and out of shared corpus mounts. Model/provider choice is a per-matter
  configuration decision, not an architectural constraint.
- Preserve the canonical Md authority boundary; Pandoc/OOXML are projections
  and interchange seams, not a second document authority.

## Acceptance Criteria

- [ ] U4 records exact fixture bytes and whether insertion/deletion identity,
      content, context, and order survive at each boundary.
- [ ] A hard U4 failure halts semantic implementation and records the
      structural-representation fallback and operator re-entry condition.
- [ ] On a passing or bounded-partial spike, the smallest chosen representation
      preserves the proven redline facts in canonical ingest.
- [ ] Synthetic C&H fixtures are evaluated through the sibling eval framework.
- [ ] No OIP/client material leaves device or enters telemetry/remote eval.
- [ ] No corpus-generator, DMS-taxonomy, or broad DOCX redesign enters scope.

## Decision Log

| Decision | Ratified contract |
| --- | --- |
| Wedge | Tracked-changes-aware ingest is the legally meaningful first wedge. |
| U4 | The fixture spike is P0 and a real kill-gate. |
| Fallback | On hard semantic-seam failure, stop and use an explicit structural representation. |
| Corpus order | Synthetic C&H first; real diligence data later, kept out of the repo and telemetry. |
| Evaluation | Consume `effect-native-legal-eval`; do not recreate its framework. |
| Re-entry | Corpus generator and DMS taxonomy remain exploration MAP re-entry points. |

## First Vertical Slice

Run a tracked-change OOXML fixture through OOXML, Pandoc, and canonical Md;
report whether insertion/deletion identity and order survive; then prove the
smallest accepted semantic representation or the explicit structural fallback
against a synthetic C&H fixture.

## Stop Conditions

- U4 hard-fails semantic preservation and no explicit fallback is viable.
- The work would proceed semantically after a hard failure without operator
  re-approval.
- The sibling eval framework is unavailable and would need duplication.
- Any real OIP/client material would leave the device.
