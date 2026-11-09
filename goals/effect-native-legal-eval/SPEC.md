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
   [`MAP.md`](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/harvey-lab-firm-knowledge/MAP.md), and
   [`DECISIONS.md`](../../explorations/harvey-lab-firm-knowledge/DECISIONS.md).
4. This `SPEC.md`, then `PLAN.md` and `GOAL.md`.

## Target Surfaces

- Existing QA judge inventory/check/evidence surfaces.
- Existing worker-eval criterion-call patterns (the command was retired in
  beep-cli-composition W0; source at [f16d82e9f1](https://github.com/beep-effect/beep-effect/blob/f16d82e9f16d72f64d42b40284bf2867566e796b/packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts#L639)).
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
- Any later real data room stays out of the repo, out of telemetry, and out of
  shared C&H mounts. Provider choice is per-matter configuration.
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
| Corpus order | Synthetic C&H first; real diligence data later, kept out of the repo and telemetry. |
| Goal split | Eval ships independently before the tracked-changes wedge. |
| Re-entry | Corpus generator and DMS taxonomy remain exploration MAP re-entry points. |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug effect-native-legal-eval`; add a `kind: decision` file there, never edit this block._

### research-intake-2026-11 routed 165 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 454 findings to this packet (165 affirmative, 33 critiques or disputes; 315 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- usesMethodIn: https://arxiv.org/abs/2610.33489 — Gold-set evaluation uses property constraints (must_call, must_not_call, must_ground, must_thread, must_abstain) instead of a fixed reference output, an eval design applicable to extraction tasks.
- citesAsEvidence: https://www.nber.org/papers/w35720 — The study reports blinded domain-expert scoring, a useful methodological precedent for evaluating patent-drafting quality independently of treatment knowledge. The capture does not supply the scoring
- citesAsEvidence: https://www.harvey.ai/blog/improving-agent-accuracy-with-harvey-graph — Case example: on a precedent-retrieval firm-knowledge task, the graph raised the result from 0% to 75% of rubric criteria.
- citesAsEvidence: https://www.harvey.ai/blog/harvey-everlaw-evidence-ediscovery — The announcement identifies MCP as the integration mechanism for querying an external evidence platform from a legal AI workspace. This is a concrete vendor-announced example of a legal application us
- citesAsEvidence: https://www.steptoe.com/en/news-publications/step-into-ip-blog/the-weekly-inference-cocounsel-verification-citations.html — Noland v. Land of the Free: multi-model checking without source text and an explicit instruction did not catch fabricated quotations.

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane feat/research-intake-2026-11

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

<!-- beep:decisions:end -->

## First Vertical Slice

Evaluate a small synthetic C&H fixture with one closure criterion and one
neutral-band criterion, producing schema-valid criterion and aggregate
evidence comparable to the recorded upstream baseline.

## Stop Conditions

- Metered execution lacks explicit operator approval, a cost bound, or cleanup.
- The design requires retaining the Python harness as a normal runtime.
- Any OIP/client material would leave the device or enter telemetry/remote eval.
- The framework would duplicate rather than compose live judge/QA services.
