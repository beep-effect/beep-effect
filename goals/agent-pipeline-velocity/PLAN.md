# Agent Pipeline Velocity Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Gate & Quick Strikes | in_progress | Merge PR #291; greptile-only lineup (B1, Chrome-early); read-only PR cache (B2); main green verify/fill (B3). | Main check-runs 0 failures; gate defaults trimmed; PR lanes read cache. |
| P1 Agent Effectiveness | pending | Single-source instruction generator + drift gate; nested-instruction audit; heavyweight-skill progressive disclosure; settings allowlist; context-tooling verdict. | SPEC acceptance items for instruction/skills/settings pass; verdict recorded. |
| P2 Pipeline rqt-011+ (Fable-direct) | pending | Instrument phase wall-times → baseline; concurrency benchmark 3→{8,16,24}; parity lanes in verify; rqt leftovers in measured-win order; scoped crispen + debt ledger. | Baseline + deltas recorded per rqt convention; verify includes parity lanes; no gate weakened. |
| P3 Worktrees | pending | `beep worktree new/remove/doctor` + standards update; incremental migration begins. | Smoke round-trip green; standard documents helper flow. |
| P4 Yeet: PR to mergeable | pending | Single PR: repair → verify → publish --pr → monitor → greptile closeout. | Hosted checks green; greptile gate satisfied; user merges. |
| P5 Close | pending | Reflection, REPO_RATING delta note, memory updates, ledger/ATLAS final sync. | Closeout checklist done; reflection lint passes. |

## P3 Closeout Checklist

(Applies at P5 Close.)

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` (frontmatter must validate
   against `ReflectionFrontmatter`; quote the date; no backtick-leading plain
   scalars).
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- **Sequencing gate**: PR #291 (`codex/yeet-verify-repair`) merges before any
  code-touching phase; B1 browser work may proceed immediately.
- **Labor split**: Claude leads/verifies/approves; Codex fleet executes
  mechanical lanes (jsdoc warning burndown, config sweeps) —
  deliverable-on-disk, one agent one artifact. **P2 analysis/redesign is
  Fable-direct** (user mandate, DECISIONS 2026-07-05).
- Instrument before optimizing: every P2 change carries a before/after number
  in `history/` (rqt-011+ entries, repo-quality-throughput conventions).
- Crispen discipline: refactor only what an identified optimization needs;
  everything else lands in the debt ledger (`history/crispen-debt.md`).
- Preserve unrelated worktree changes; user + codex agents share checkouts.
- Deep-research addendum (`wf_67c7da82-92f`) merges into research/SOURCES.md
  when it lands; it informs P1 choices (context tooling, token budgets) but
  does not block P0.

## Verification Commands

```sh
test "$(wc -m < goals/agent-pipeline-velocity/GOAL.md)" -le 4000
jq . goals/agent-pipeline-velocity/ops/manifest.json
rg -n "agent-pipeline-velocity|GOAL.md|agentLaunchers|packetAnchorDocument" goals/agent-pipeline-velocity
git diff --check -- goals/agent-pipeline-velocity
bun run beep lint reflection-artifacts
```
