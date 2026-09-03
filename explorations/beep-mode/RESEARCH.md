# Research

<!-- Stage 1. Dated record, newest first. External landscape + in-repo capability inventory. -->

## 2026-08-29 — pstack distillation (four Codex lanes, `--effort medium`)

Upstream: `cursor/plugins` `pstack/` at rev `68836dd` (v0.14.5, MIT, Lauren
Tan). A local checkout was used for the following reports:

1. [`01-poteto-mode-and-playbooks.md`](./research/pstack-distillation/01-poteto-mode-and-playbooks.md)
   — the mode's non-negotiables, autonomy, subagent defaults, reply rules,
   sticky-mode frontmatter; all 23 playbooks with baked-in assumptions
   (Graphite, Cursor `Task`, model slugs, control-ui/cli, deslop, Bugbot,
   `/loop`) mapped to repo equivalents; the upstream orchestration and PR
   watcher scripts assessed against `bun run beep yeet monitor`; disposition table (1 keep,
   18 adapt, 4 drop).
2. [`02-principles-vs-repo-doctrine.md`](./research/pstack-distillation/02-principles-vs-repo-doctrine.md)
   — rule/trigger/tell for each of the 21 principles; matrix against
   `AGENTS.md`, `standards/effect-laws-v1.md`, `standards/ARCHITECTURE.md`,
   `.patterns/`, `standards/effect-first-development.md`,
   `standards/schema-first-development-prompt.md`: 2 already covered, 12
   extend, 3 conflict, 4 new; nine repo laws with no pstack principle.
3. [`03-situational-skills-overlap.md`](./research/pstack-distillation/03-situational-skills-overlap.md)
   — 23 situational skills + 2 agents + benny: purpose, Cursor assumptions,
   per-harness portability (Claude Code / Codex / Grok CLI), verdict
   (COMPLEMENT / DUPLICATE / NAME-COLLISION / SUPERSEDED-BY-REPO); how the
   multi-model panels pick models and how to re-point them at the operator's
   Fable / Sol / Grok routing.
4. [`04-guide-and-packaging.md`](./research/pstack-distillation/04-guide-and-packaging.md)
   — operating model in 15 lines, recipes and pitfalls, reproducible blinded
   eval methodology, plugin manifest and `/setup-pstack` role schema,
   `cursor-team-kit` dependencies, MIT attribution obligations.

## 2026-08-29 — in-repo capability inventory

- Skill root and sharing: `.claude/skills` (source of truth) →
  `.agents/skills` symlink (Codex) → `.codex/config.toml` skills table, all
  kept in sync by `bun run beep skills update`
  (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts`,
  `skills-lock.json`). Grok CLI scans `.claude/skills` + `.agents/skills`
  (per the locally installed Grok skills guide); Cursor scans `.agents/skills`,
  `.cursor/skills`, `.claude/skills`, and its Codex-specific skills directory
  (cursor.com/docs/context/skills).
- Agents: `.claude/agents/*.md` (7) hand-mirrored to `.codex/agents/*.toml`.
- Overlapping skills: `adhd`, `grilling`/`grill-me`/`grill-with-docs`,
  `quality-review-fix-loop`, `yeet`, `browser-qa-loop`, `qa-session-ops`,
  `explore`, `reflect`, `unslop`, `teach`, `crispen`,
  `effect-first-development`, `schema-first-development`,
  `jsdoc-annotation-specialist`.
- Principle re-surfacing: `.claude/hooks/law-pulse.sh` (every 5th edit).
- Eval machinery: `goals/skillopt-training-pilot` (rollout runner, law
  scorers, Phoenix); `goals/skill-contract-kernel` (`@beep/skill-contract`).
- Related capture: `explorations/INBOX.md` `agent-config-canonicalization`.
