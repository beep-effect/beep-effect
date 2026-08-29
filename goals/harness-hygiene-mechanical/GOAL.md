# GOAL: mechanical harness hygiene — dead skills, cache prefix, three laws

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the four zero-signal skills are deleted, AGENTS.md's permanent cache
prefix carries no volatile operational state, and the three agent-requested
laws (same-PR packet-state flips, verification-failure attribution taxonomy,
durable on-disk handoffs) are added — nothing else about the law surface
changes.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/harness-hygiene-mechanical/README.md`
- `goals/harness-hygiene-mechanical/SPEC.md`
- `goals/harness-hygiene-mechanical/PLAN.md`
- `goals/harness-hygiene-mechanical/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `.claude/skills/ponytail-audit`, `.claude/skills/ponytail-debt`,
  `.claude/skills/ponytail-gain`, `.claude/skills/ponytail-help` (delete);
  `AGENTS.md` (evict volatile state to owned surfaces; add three laws in one
  batched edit — it is the prompt-cache prefix); destination docs for evicted
  prose (`standards/memory-architecture/*` pointers or equivalent owned
  surface); packet docs/evidence.
- Out: any other skill (no consolidation of collision clusters); any law
  DELETION (lint-duplicated rules stay until H1 evidence or replay gating);
  nested AGENTS.md files; settings/hooks; CI.

Model economy (operator requirement): the operator's weekly Fable 5 limit is
scarce. Fable/Opus sessions plan, design, and review ONLY. Route all
token-heavy lanes (reference scans, law drafting research, bulk analysis) to
codex via the codex plugin with `--model gpt-5.6-sol --effort medium`, one
artifact per agent.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`; batch all AGENTS.md
   edits into one pass (cache-prefix law).
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence — cite the pulse
   (`explorations/agent-effectiveness-pulse/research/pulse-report.md`) and
   reflections counts for each law's rationale; frame the same-PR law as
   requested ergonomics (H4 refuted, H9 partial).
5. Update packet evidence/status if the implementation changes readiness.
6. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/harness-hygiene-mechanical/GOAL.md)" -le 4000
jq . goals/harness-hygiene-mechanical/ops/manifest.json
git diff --check -- goals/harness-hygiene-mechanical
test ! -d .claude/skills/ponytail-audit
rg -n "same-PR|attribution|handoff" AGENTS.md
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
