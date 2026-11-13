# Skill Lane Probe — Sources & Provenance

- **Source exploration:** `explorations/skillopt-corpus-headroom` — primary ledger:
  `explorations/skillopt-corpus-headroom/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| P1 | First probe findings | this repository | `goals/skill-effect-probe/history/FINDINGS.md` | Why pass-or-fail measures sat at zero; pilot lane census | Reference; no run from it is evidence here |
| P2 | Laws-prompt pilot records | this repository | `goals/skill-effect-probe/history/p1-laws-pilot/runs.jsonl` | Run-to-run noise used for sizing; input to the first slice | Reference and test input |
| P3 | First probe rule and amendments | this repository | `goals/skill-effect-probe/research/2026-11-12-analysis-rule.md` | Exclusion rules, run configuration, scorer profile v3 | Reused unchanged |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| None | N/A | N/A | Nothing is ported; the runner is the installed `claude plugin eval`. |

## 3. External research sources

- Evan Miller, "Adding Error Bars to Evals: A Statistical Approach to Language
  Model Evaluations", <https://arxiv.org/abs/2411.00640>. Source of the
  paired and clustered analysis the first probe used. This goal keeps the
  clustered interval as a secondary line and decides on a within-task
  permutation test instead; the reason is in the exploration's
  `DECISIONS.md`, 2026-11-13.
- Claude Code plugin evals, <https://code.claude.com/docs/en/plugin-evals.md>,
  as cited in the exploration's `RESEARCH.md`.

## 4. In-repo capability references

- Probe commands, schemas and statistics:
  `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/SkillProbe.ts`,
  `SkillProbeSchemas.ts` and `SkillProbeStats.ts` in the same directory.
- Law scorer: `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalScorer.ts`.
- Harness ledger: `packages/tooling/tool/cli/src/commands/HarnessLedger/`.

## 5. Cross-links & provenance

- Exploration decisions: `explorations/skillopt-corpus-headroom/DECISIONS.md`, 2026-11-13.
- Exploration map: `explorations/skillopt-corpus-headroom/MAP.md`.
- Predecessor goal: `goals/skill-effect-probe`.
