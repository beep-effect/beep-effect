# Baseline: Agent Configuration Surface (2026-07-05)

Explorer-agent inventory; facts only. Paths relative to repo root.

## Instruction files

- Root `CLAUDE.md`: 3,610 B / 55 lines. Root `AGENTS.md`: 4,537 B / 62 lines. Separate files (no symlink). Combined always-loaded weight ≈ 2,033 tokens.
- **No contradictions, but divergence**: 11 rules appear only in CLAUDE.md (schema defaults, focused changes, service composition, match helpers, effect helper modules, docs/ + explorations/ context, prompt-cache discipline ×5) and 18 only in AGENTS.md (schema-first models, typed errors/tagged unions, LiteralKit no-`as const`, service boundaries, `beep architecture` codegen, graphiti-memory as primary knowledge base + proxy routing + fallbacks + preference order + group_ids gotcha, effect-v4 skill routing, shadcn/MUI routing).
- Nested instruction files: 14 CLAUDE.md/AGENTS.md across packages/{shared,foundation,drivers,epistemic} = **142,405 B (~35.6k tokens)**; plus explorations/AGENTS.md (2,670 B).
- Stale-reference check: AGENTS.md correctly marks the retired repo-exports catalog as retired (lines 29–31).

## Skills

- `.claude/skills/`: **29 skills, 533,500 B total (~133k tokens if all loaded)**; 18 repo-local, 10 GitHub-pinned (mattpocock ×2, DietrichGebert/ponytail ×6, shadcn-ui ×1, vercel/turborepo ×1).
- Heavyweights: effect-first-development 34,707 B/784 lines; turborepo 28,471 B/951; atom-reactivity-specialist 28,282 B/788; schema-model-specialist 20,044 B/525; jsdoc-annotation-specialist 17,841 B/497.
- Minimal (intentional wrappers): effect-v4-imports 850 B; mcp-graphiti-memory 1,250 B; mcp-jetbrains 1,124 B; grill-me 147 B stub.
- `skills-lock.json` v1: SHA256 hash-pins all skills; GitHub refs pinned to `main` branch (hash is the integrity anchor, ref is floating).
- Plugin skills (Codex-configured, outside root registry): box, datamoat, github ×4, notion ×4 = 48,624 B.

## Settings & Codex wiring

- `.claude/settings.json` (164 B): no hooks, no permissions allowlist; two official plugins disabled. `.claude/settings.local.json`: single JetBrains-scratch Bash allow. No `.claude/agents/`, `commands/`, `workflows/` dirs.
- `.codex/config.toml` (2,624 B): skills mirror of skills-lock (29 enabled, include_instructions=true); WebStorm MCP bridge (port 64542); apps feature off.
- Codex instruction source: AGENTS.md (+ per-skill SKILL.md). **Codex never reads CLAUDE.md; Claude never reads AGENTS.md.**

## Goal/exploration overlap (pre-surgery)

- `agent-effectiveness-loop` — phase1-complete (Phoenix-backed feedback loop; PR merged).
- `agent-effectiveness-phoenix-enrichment` — pending-planning (Phoenix-native annotations/datasets/evals).
- `agent-effectiveness-workflow-integration` — pending-planning (evidence loops → repo workflows/CI).
- `yeet-operator-clarity` — active, P0–P4 completed, P5 closeout in_progress.
- `yeet-pr-closeout-loop` — active (retry, review-fix tier, closeout gates; note: its verificationCommands still reference the retired repo-exports catalog).
- `repo-quality-throughput` — complete (rqt-001..010); `repo-quality-convergence` — local-proof-complete; `repo-quality-acceleration` — superseded-reference; `yeet-agent-ergonomics` — completed-retained.
- Explorations: 23 active packets; no duplicate of this initiative.
