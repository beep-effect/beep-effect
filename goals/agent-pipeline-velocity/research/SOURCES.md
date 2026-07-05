# Agent Pipeline Velocity — Sources & Provenance

- **Cluster / origin:** Session-embedded baseline (three Explore-agent sweeps over this repo, 2026-07-05) + grill-with-docs decision session + `/deep-research` external sweep (in flight).
- **Provenance:** REPO_RATING.md (repo root, 2026-07-05 assessment, 9 evidence agents); approved plan at `~/.claude/plans/ok-so-i-only-starry-planet.md` (session-local).

## 1. Mined source corpus

Not applicable — no upstream code corpus is being mined; this packet composes in-repo bricks.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | UNVERIFIED (as of 2026-07-05) | **reference-only until license verified** | Candidate context-optimization tooling; evaluation gated on measured benefit (BRIEF rabbit hole). |
| [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) | MIT (verified 2026-07-05 via repo page) | port-with-attribution | (a) 300–2,000-token optimal skill-artifact band as restructure target evidence; (b) SkillOpt-compatible single-document SKILL.md core design; (c) candidate optimizer for a successor skill-training goal atop Phoenix evals. Not vendored in this goal. |

(Deep-research report may add rows; verify each license before any adoption.)

## 3. External research sources

Deep-research report (11 verified findings, 105 agents, adversarial 3-vote
verification): [`deep-research-report.json`](./deep-research-report.json).
Its 23 sources (all appear in the on-disk report):

- https://code.claude.com/docs/en/large-codebases — layered/lazy CLAUDE.md, LSP plugins
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices — skill budget rules
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — context rot / JIT loading
- https://arxiv.org/abs/2602.11988 — context files weak-lever study (ETH/LogicStar)
- https://arxiv.org/pdf/2605.10039 — 1,650-session compliance factorial (size/splitting nulls, session decay)
- https://arxiv.org/html/2606.10209 — prune+summarize evictions design point (Microsoft)
- https://github.com/headroomlabs-ai/headroom — context compression (vendor numbers)
- https://turborepo.dev/docs/core-concepts/remote-caching · https://github.com/vercel/turborepo/issues/1188 — read-only PR cache control lineage
- https://www.blacksmith.sh/pricing · https://www.blacksmith.sh/blog/actions-pricing — runner economics
- https://www.infoq.com/news/2026/03/agents-context-file-value-review/ — corroboration
- https://dev.to/_vjk/best-ai-code-reviewer-in-2026-we-ran-4-in-parallel-for-3-weeks-146-prs-679-findings-1c0f — 4-parallel-reviewer evidence
- Remainder (secondary/corroborating, verbatim in report JSON): codegateway.dev agents-md playbook, augmentcode.com agents-md guide, yurukusa gist, morphllm.com agents-md guide, tessl.io agents-md standard, alexop.dev progressive disclosure, dev.to headroom review, yage.ai grep-agents essay, aider.chat repomap, vibecodinghub.org serena, tianpan.co monorepo context, code.claude.com skills truncation, anthropics/claude-plugins-official.
- User-supplied: microsoft/SkillOpt (§2 above).

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| Yeet planner/gates/status | `packages/tooling/tool/cli/src/commands/Yeet/internal/{Planner,Closeout,Handler,Status}.ts` | extend |
| Quality lanes | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` | extend |
| Turbo timing substrate | turbo `--summarize` + `beep ci append-turbo-summary` (`commands/Ci`) | reuse |
| rqt conventions & frontier | `goals/repo-quality-throughput/` (proof-parity-map.md, closeout) | reuse |
| Worktree spec | `standards/git-worktrees.md` | reuse as spec |
| CLI command framework | `packages/tooling/tool/cli/src/commands/*` | home for NET-NEW `Worktree` + instruction-generator commands |
| Skill pinning | `skills-lock.json`, `.codex/config.toml` | re-pin after restructure |
| CI wiring | `.github/workflows/check.yml`, `.github/actions/setup-monorepo-ci` | extend |
| Baseline reports | `research/baseline-{agent-config,pipeline,review-merge}.md` (this packet) | primary grounding |

## 5. Cross-links & provenance

- Exploration: `explorations/agent-pipeline-velocity/` (this packet) — `RESEARCH.md`, `DECISIONS.md` (8 locked decisions, 2026-07-05), `BRIEF.md`, `MAP.md`.
- Goal: `goals/agent-pipeline-velocity/` (graduated 2026-07-05); inherits this ledger as `goals/agent-pipeline-velocity/research/SOURCES.md`.
- Superseded packets: `goals/agent-effectiveness-phoenix-enrichment`, `goals/agent-effectiveness-workflow-integration`, `goals/yeet-operator-clarity`, `goals/yeet-pr-closeout-loop`.
- Rating context: `REPO_RATING.md` (root).
- Sequencing gate: PR #291 `codex/yeet-verify-repair`.
