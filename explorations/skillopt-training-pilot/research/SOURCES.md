# SkillOpt Training Pilot — Sources & Provenance

- **Cluster / origin:** Successor-initiative planning (grill-with-docs 2026-07-06) + codex recon for that session + inherited SkillOpt corpus from `explorations/agent-pipeline-velocity`.
- **Provenance:** predecessor ledger `explorations/agent-pipeline-velocity/research/SOURCES.md` (primary for SkillOpt); approved plan (session-local `~/.claude/plans/ok-so-i-only-starry-planet.md`).

## 1. Mined source corpus

Not applicable — no upstream code is mined; SkillOpt is consumed as a pip tool.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) | MIT (verified 2026-07-05) | tool dependency (pip), no vendoring | The training loop itself: validation-gated text-space optimization of `.claude/skills/schema-first-development`; SkillOpt-Sleep evaluated only if the pilot proceeds. |

## 3. External research sources

- [microsoft/SkillOpt repo](https://github.com/microsoft/SkillOpt) · [MSR blog](https://www.microsoft.com/en-us/research/blog/skillopt-agent-skills-as-trainable-parameters/) · [docs/reproduction guide](https://microsoft.github.io/SkillOpt/docs/guideline.html) — inherited, verified 2026-07-05.
- `explorations/agent-pipeline-velocity/research/deep-research-report.json` — instruction/skill-economy findings contextualizing the 300–2,000-token band.

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| Rollout runner pattern | `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts` (+ Runpod variant, tests) | **generalize** (workspace-write, worktree targets) |
| Benchmark storage | `@beep/repo-ai-metrics` models/derived-storage (BenchmarkCase/BenchmarkRun/Scorecard, DuckDB) | reuse |
| Phoenix driver + bundles | `packages/drivers/phoenix`, `beep agent-effectiveness` command family | reuse (B5 stretch) |
| Scorer lanes | `beep lint schema-first`, tsgo Effect diagnostics, biome | reuse (wrap into scalar scorer) |
| Throwaway checkouts | `beep worktree new/remove/doctor` (PR #295) | reuse |
| Pilot target | `.claude/skills/schema-first-development/` (+ skills-lock re-pin) | training target |
| Privacy contract | `packages/tooling/library/ai-metrics/src/archive.ts` sealed-raw design | constraint |
| Provisioning surface | `flake.nix` | extend (python3 + uv) — NET-NEW pyproject/uv.lock |

## 5. Cross-links & provenance

- Predecessors: `goals/agent-pipeline-velocity` (completed, PR #295 — cite-and-align + skill restructure), `goals/quality-gate-ratchets` (completed, PR #305/#306 — gates + ruleset this pilot's PRs will clear), `goals/agent-effectiveness-loop` (phase1-complete — Phoenix substrate), superseded `agent-effectiveness-phoenix-enrichment` (B5 revives its experiments/evals slices under this provenance).
- Locked decisions: this packet's DECISIONS.md (seeded from grill 2026-07-06).
- Graduates to: `goals/skillopt-training-pilot` (pending BRIEF sign-off + decompose).
