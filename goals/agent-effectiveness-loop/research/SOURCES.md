# Agent Effectiveness Loop — Sources & Provenance

- **Source exploration:** none. This packet was authored directly on
  2026-05-16, before `explorations/` existed. The Phase 0 research lanes
  under this directory are the primary ledger.
- **Provenance:** [`research/README.md`](./README.md) (lane index),
  [`synthesis-ranked-execution-plan.md`](./synthesis-ranked-execution-plan.md)
  (ranked plan that selected the Phase 1 slice).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `phoenix-capability-map` | Phoenix feature inventory mapped to coding-agent opportunities | arize-ai/phoenix docs | [`phoenix-capability-map.md:35`](./phoenix-capability-map.md#capability-matrix) (Capability Matrix), [`:165`](./phoenix-capability-map.md#recommended-first-uses) (Recommended First Uses) | observability / evals | reference |
| `live-phoenix-state-audit` | Sanitized read-only audit of the deployed dankserver Phoenix | this repo | [`live-phoenix-state-audit.md:62`](./live-phoenix-state-audit.md#projects) (Projects), [`:118`](./live-phoenix-state-audit.md#audit-readout) (Audit Readout) | live evidence | reference |
| `repo-eval-metrics-surface-audit` | Existing repo eval, metrics, labels, benchmarks, scorecards, OTLP surfaces | this repo | [`repo-eval-metrics-surface-audit.md:92`](./repo-eval-metrics-surface-audit.md#surface-inventory) (Surface Inventory), [`:183`](./repo-eval-metrics-surface-audit.md#agent-effectiveness-reuse-guidance) (Reuse Guidance) | repo inventory | reuse |
| `agent-effectiveness-opportunity-map` | Candidate evals, diagnostics, scorecards, CLI workflows | this repo | [`agent-effectiveness-opportunity-map.md:115`](./agent-effectiveness-opportunity-map.md#ranked-opportunity-table) (Ranked Opportunity Table), [`:527`](./agent-effectiveness-opportunity-map.md#annotation-schema-candidates) (Annotation Schema Candidates) | opportunity ranking | reference |
| `synthesis-ranked-execution-plan` | Ranked execution plan and selected first slice | this repo | [`synthesis-ranked-execution-plan.md:20`](./synthesis-ranked-execution-plan.md#executive-decision) (Executive Decision), [`:50`](./synthesis-ranked-execution-plan.md#phase-1-contract) (Phase 1 Contract) | plan | implemented (Phase 1) |

**How these inform implementation:** the capability map and opportunity map
bounded Phase 1 to a local, no-mutation trust gate plus metadata-only
annotation plans; the surface audit fixed the architecture homes
(`@beep/repo-ai-metrics` for semantics, `@beep/repo-cli` for commands); the
live audit set the read-only and sanitized-evidence rules.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Arize Phoenix (public docs only; no code vendored) | Elastic License 2.0 (not verified in-repo) | reference-only | API and feature vocabulary for datasets, experiments, annotations, prompts, evals |

No upstream code was ported. The Phoenix driver in this repo targets the
public HTTP/GraphQL API.

## 3. External research sources

Registered in `ops/manifest.json` `externalReferences`:

- Phoenix docs index — <https://arize.com/docs/phoenix/llms.txt>
- Phoenix coding-agent integrations —
  <https://arize.com/docs/phoenix/integrations/developer-tools/coding-agents>
- Running experiments —
  <https://arize.com/docs/phoenix/datasets-and-experiments/how-to-experiments/run-experiments>
- Code evaluators —
  <https://arize.com/docs/phoenix/evaluation/how-to-evals/code-evaluators>
- Evaluating Phoenix traces (feedback and annotations) —
  <https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces>

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | extend (added `agent-effectiveness.ts`: report schemas, evidence aggregation, privacy checks) |
| `@beep/repo-cli` | `packages/tooling/tool/cli/src/commands/AgentEffectiveness` | NET-NEW command group (doctor, annotations, datasets, prompts, experiments, phoenix) |
| `@beep/observability` | `packages/foundation/capability/observability` | boundary (runtime OTLP helpers; developer AI analytics semantics must not move here; not imported by the Phase 1 surfaces) |
| `@beep/infra` | `infra/` (dankserver topology and Phoenix deployment) | reuse (read-only target) |
| `goals/ai-metrics-stack` | packet | input (privacy contract, DuckDB evidence, scorecards, labels, benchmarks) |
| `goals/jsdoc-worker-eval` | packet | input (read-only worker-eval report, `beep-jsdoc-worker-eval` Phoenix project) |

## 5. Cross-links & provenance

- Delivered through PR #167 and PR #168 (2026-05-20); closeout in
  `history/outputs/phase1-closeout.md`, live proof in
  `history/outputs/phase1-live-proof.md`, reflection in
  `history/reflections/2026-08-29-codex.md`.
- Deferred Phase 2/3 → `agent-effectiveness-phoenix-enrichment` and
  `agent-effectiveness-workflow-integration` (2026-05-20) → superseded by
  `goals/agent-pipeline-velocity` (2026-07-05, PR #295) → deleted in PR #401
  (2026-07-14).
- Current successor for agent-effectiveness measurement:
  `goals/coding-agent-effectiveness-evidence-loop` (names this packet as
  retained, non-reopened evidence).
- Later additions to the same command group, owned elsewhere:
  `beep agent-effectiveness evals` from `goals/skillopt-training-pilot`
  (PR #309) and `goals/harness-evidence-ledger` (PR #1362).
