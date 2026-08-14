# Effect-Native Legal Eval Spec

## Objective

Ship a repo-native, schema-first legal evaluation surface with typed rubric and
judge contracts, criterion isolation, all-pass plus diagnostic scoring,
closure/precision criteria, and neutral-band outcomes, then record one
operator-approved upstream C&H harness run as an external baseline.

## Non-Goals

- A Python LAB eval port or retained upstream harness runtime.
- Routine CI execution of the metered upstream baseline.
- A real client/OIP corpus in this cycle.
- Corpus-generator, DMS-taxonomy, tracked-changes ingest, practice-KG
  acceptance, or general legal-AI claims.

## Source Hierarchy

1. The 2026-08-13 operator sign-off and ceremony request.
2. Repo instructions and required skills.
3. [`BRIEF.md`](../../explorations/harvey-lab-firm-knowledge/BRIEF.md),
   [`MAP.md`](../../explorations/harvey-lab-firm-knowledge/MAP.md), and
   [`DECISIONS.md`](../../explorations/harvey-lab-firm-knowledge/DECISIONS.md).
4. This `SPEC.md`, then `PLAN.md` and `GOAL.md`.

## Target Surfaces

- Existing QA judge inventory/check/evidence surfaces.
- Existing worker-eval criterion-call patterns.
- A schema-first Effect-native rubric, result, scoring, and typed judge service
  surface in the appropriate tooling/evaluation boundary.
- On-demand synthetic C&H asset metadata, containment, and baseline evidence.

## Constraints

- Synthetic Calderwood & Harkness is the first and standing test asset; keep
  its large corpus on-demand and out of normal repo/gate weight.
- Run the upstream podman + pandoc + metered-key harness exactly once for
  external comparison, with explicit operator approval, cost bounds, cleanup,
  and no routine-CI dependency.
- Use LAB methodology as reference for a repo-native implementation, not as
  durable code/runtime.
- Preserve criterion-scoped calls, all-pass and diagnostic results,
  closure/precision criteria, neutral-band outcomes, and typed judge services.
- OIP confidentiality is hard: any later real data room stays on-device only
  and never enters telemetry, remote evaluation, cloud models, or C&H mounts.
- Record assumptions behind scoring and task classification.

## Acceptance Criteria

- [ ] Schema-first rubric, criterion, outcome, and aggregate result contracts
      decode and reject malformed inputs fail-closed.
- [ ] Criterion judge calls are isolated and produce both all-pass and
      diagnostic evidence, including closure/precision and neutral-band cases.
- [ ] The framework composes live judge/QA evidence rather than creating a
      parallel Python stack.
- [ ] One approved upstream C&H baseline run records exact harness revision,
      environment, model/judge profile, cost, outputs, and cleanup.
- [ ] Synthetic C&H remains on-demand and no OIP/client material leaves device
      or enters the baseline.
- [ ] The tracked-changes sibling can consume this framework without owning it.

## Decision Log

| Decision | Ratified contract |
| --- | --- |
| Standing asset | C&H and its graded tasks remain an on-demand standing test asset. |
| Framework | Build an Effect-native eval from methodology; do not port LAB Python as the durable runtime. |
| Baseline | Run the upstream podman + metered-key harness once for external comparison. |
| Corpus order | Synthetic C&H first; real diligence data later and on-device only under OIP confidentiality. |
| Goal split | Eval ships independently before the tracked-changes wedge. |
| Re-entry | Corpus generator and DMS taxonomy remain exploration MAP re-entry points. |

## First Vertical Slice

Evaluate a small synthetic C&H fixture with one closure criterion and one
neutral-band criterion, producing schema-valid criterion and aggregate
evidence comparable to the recorded upstream baseline.

## Stop Conditions

- Metered execution lacks explicit operator approval, a cost bound, or cleanup.
- The design requires retaining the Python harness as a normal runtime.
- Any OIP/client material would leave the device or enter telemetry/remote eval.
- The framework would duplicate rather than compose live judge/QA services.
