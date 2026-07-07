# Brief

<!-- Stage 3. Shape Up pitch at fat-marker fidelity. -->

## Problem

The repo's skills are hand-written and hand-tuned. PR #295 restructured them
into SkillOpt's measured-optimal shape (lean single-document cores,
300–2,000 tokens) but nothing *measures* whether a skill actually improves
agent behavior, and nothing improves a skill except a human editing prose.
Meanwhile every ingredient of a training loop already exists in-tree —
a proven codex-sdk rollout runner (jsdoc-worker-eval), benchmark schemas +
DuckDB storage (ai-metrics), deterministic law-scorers (schema-first lint,
tsgo diagnostics), throwaway worktrees, and a Phoenix experiment surface —
they have just never been composed. SkillOpt (MIT, benchmarked inside both
of our harnesses) is the missing optimizer.

## Appetite

One goal packet, codex-implemented, Claude-orchestrated. Repo changes land
as ONE normal gated PR (harness + corpus + provisioning); training runs are
local and write only packet history + local ai-metrics state. Park without
shame if harness integration proves infeasible — the park writeup is itself
a deliverable.

## Solution Sketch

1. **Corpus (B1)** — ≥10 schema-authoring tasks derived from repo law and
   history (schema-first inventory findings and their fixes, crispening
   policy cards, LiteralKit/Model.Class exercises). Each task: a prompt
   (work order in a prepared worktree), reference criteria, and an expected
   check set — stored as ai-metrics `BenchmarkCase` rows (prompt by
   hash/reference, per the privacy contract).
2. **Scorer (B2)** — one command wrapping `beep lint schema-first` + tsgo
   Effect diagnostics + biome over the rollout's diff into a scalar in
   [0,1] + violation breakdown; recorded as `BenchmarkRun` rows.
3. **Runner (B3)** — generalize `QualityWorkerEval`'s codex-sdk pattern:
   per rollout, `beep worktree new` a disposable checkout, inject the
   candidate SKILL.md, run the task at `sandboxMode: workspace-write`,
   score the diff, tear down. Serial first; bounded parallelism only if the
   appetite demands it.
4. **Loop (B4)** — `uv run skillopt` (flake-provisioned) trains
   `.claude/skills/schema-first-development/SKILL.md` against the corpus
   with a held-out validation split; artifacts (best_skill.md, per-epoch
   scores, rejected-edit log) land in the goal packet's `history/`.
5. **Phoenix (B5, stretch)** — log rollouts/scores as Phoenix experiments
   via `@beep/phoenix` + `beep agent-effectiveness` bundles (dry-run
   default, confirmation-gated), reviving the superseded phoenix-enrichment
   experiments/evals slices.

## Rabbit Holes

- **Corpus perfectionism**: 10 honest tasks beat 50 speculative ones; derive
  from real historical violations, time-box authoring.
- **Rollout cost spiral**: minutes/rollout × tasks × epochs — pick SkillOpt
  mini-batch settings for an overnight-at-most first run; cache worktree
  bootstraps (shared base + `git worktree` is already cheap).
- **Scorer gaming**: a skill could learn to write trivial code that passes
  lints; reference criteria must include task completion checks, not just
  law compliance.
- **Sandbox landmines** (all known, all documented): codex can't commit in
  worktrees, can't call GitHub, bun-vitest workers fail in-sandbox (scorer
  runs node path or outside sandbox).
- **Phoenix scope creep**: B5 is a stretch; the pilot verdict must not
  depend on it.

## No-Gos

- Shipping/adopting the trained skill (follow-on decision with data).
- Raw transcript access for SkillOpt (sealed archive stays sealed;
  purpose-built tasks + deploy-safe metadata only).
- Vendoring SkillOpt code (pip dependency only).
- New always-loaded context; any skill-body change beyond the training
  target.
- Weakening any gate to make rollouts pass.
