# Research

## External Landscape

### 2026-07-05/06 — inherited (verified) SkillOpt corpus

Full provenance in [`research/SOURCES.md`](./research/SOURCES.md) and the
predecessor packet's deep-research report
(`explorations/agent-pipeline-velocity/research/deep-research-report.json`).
Load-bearing facts: MIT license (port-with-attribution permitted); optimizer
treats the skill document as trainable state with validation-gated bounded
edits; deployable artifact band 300–2,000 tokens (our restructured
schema-first-development core, 6,360 B ≈ 1.6k tokens, already sits inside
it); rollouts run inside real agent harnesses (Claude Code, Codex CLI) with
cross-harness transfer demonstrated; `pip install skillopt`, WebUI optional;
SkillOpt-Sleep (v0.2.0) automates offline harvest→train cycles behind the
same validation gate.

## In-Repo Capability Inventory

### 2026-07-06 — codex recon (full report summarized; produced for the grill session)

1. **Rollout runner pattern EXISTS**:
   `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts`
   runs `@openai/codex-sdk` workers with `approvalPolicy: "never"`,
   `sandboxMode: "read-only"`, network disabled, structured-JSON output
   contract, deterministic package-stratified task selection, isolated temp
   worker dirs, serial execution, per-packet status/timing; tests cover
   no-provider mode, score-range failures, Runpod provisioning/teardown
   (`packages/tooling/tool/cli/test/docgen.test.ts:2790-3275`). The pilot
   generalizes this to `workspace-write` in throwaway worktrees (schema tasks
   write code).
2. **Benchmark storage EXISTS**: `@beep/repo-ai-metrics`
   (`packages/tooling/library/ai-metrics/src/models.ts:403-720`) ships
   `BenchmarkCase` (prompt by hash/reference + expected checks),
   `BenchmarkRun` (pass/fail, quality gate, elapsed, config snapshot),
   `Scorecard`; derived DuckDB (`derived-storage.ts`) has tables for all of
   it, live at `.beep/ai-metrics/` (1.6GB DuckDB; only 2 cases/3 runs today —
   the corpus is ours to build).
3. **Phoenix integration EXISTS**: `packages/drivers/phoenix` (`@beep/phoenix`,
   @arizeai/phoenix-client) wraps datasets/prompts/experiments/annotations
   with an env-backed layer (`PHOENIX_API_KEY`, default localhost:6006) and
   service tests; `beep agent-effectiveness` command family (Phase 1 of
   `goals/agent-effectiveness-loop`, PRs #167/#168) provides doctor /
   annotations / datasets / prompts / experiments bundles — dry-run default,
   confirmation-gated live writes. Deferred phase-2 slices
   (phoenix-experiments, phoenix-evals) are exactly the B5 stretch.
4. **Privacy contract**: ai-metrics raw transcripts are AES-256-GCM sealed;
   prompt bodies are hash/reference-only by design
   (`packages/tooling/library/ai-metrics/src/archive.ts:68-122`). SkillOpt
   consumes purpose-built eval tasks + deploy-safe metadata ONLY.
5. **Python provisioning NOT FOUND**: no pyproject/uv/requirements anywhere;
   `flake.nix` (bun, node, typos, gitleaks, lefthook, docker-compose) is the
   reproducible surface → locked decision: python3 + uv in the flake +
   committed pyproject/uv.lock.
6. **Pilot target state**: `.claude/skills/schema-first-development/SKILL.md`
   6,360 B core + references/{examples,local-primitives,pattern-catalog,repo-laws}.md,
   repo-local in skills-lock.json — trainable in place, hash re-pin on change.
7. **Scorer machinery EXISTS**: schema-first policy lint
   (`bun run beep lint schema-first`, SFV4 rules + inventory), tsgo Effect
   diagnostics at error severity, biome — all invocable per-worktree; the
   quality-gate-ratchets integration (PR #305) demonstrated they catch real
   violations deterministically.

## Constraints Discovered

- Rollout cost: schema-authoring tasks run minutes each (worktree bootstrap
  + codex-sdk turn + scorer lanes); ≥10 tasks × N rollouts/epoch × epochs
  bounds the appetite — mini-batch + caching design required.
- The 17-check ruleset now gates main: the pilot's repo changes (flake, uv
  lock, eval harness code) ship as a normal gated PR; training RUNS happen
  locally and write only packet history + ai-metrics local state.
- Codex-sdk workers in sandboxes cannot commit in worktrees and cannot call
  GitHub APIs (established in quality-gate-ratchets); the runner design
  treats worktrees as disposable scoring targets, never publishing from them.
- `bunx --bun vitest` worker startup fails inside codex sandboxes (recon +
  gate lanes) — scorer invocations from the harness must use the node path
  or run outside the sandbox.
