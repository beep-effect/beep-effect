# Agent Pool Doctrine Plan

## Status

P1 Implement, first slice landed and reviewed (2026-09-16): SHIP WITH FIXES applied; awaiting the
operator's go for commit/PR. Worktree `cursor-agent-pool`, branch
`explore/cursor-agent-pool`.

## Phases

- **P0 Research — completed** in the exploration: four grok-4.6 lanes (CLI surface, config parity,
  quota/models, field reports), a headless hooks smoke test, a live Codex meter probe.
- **P1 Implement**
  1. `.cursor/cli.json` deny list (Fable). Done first so the dogfood lane runs under it.
  2. Runbook `docs/runbooks/agent-pools.md` + `AGENTS.md` "Volume pools" (composer-2.5 lane, D15).
  3. `HookPulseAgentKind` += `cursor-cli`; `.claude/hooks/hook-pulse.sh` env knob; `.cursor/hooks/
     hook-pulse.sh` adapter; `.cursor/hooks.json`; conformance test (Fable).
  4. Review pass on `claude-opus-5-thinking-high` (D18) over the lane's prose.
  5. Optional PR 2: law-pulse on Cursor `postToolUse` (needs Cursor's `tool_input` shape for writes —
     `path`/`fileText`, not `file_path`); yeet-inbox P0 deny on `preToolUse`; model-pinned
     `.cursor/agents`; retire tsgo-045's duplicate recipe by citation.
- **P2 Verify** — package-verify, deny-list transcript check, pulse rows in the evidence ledger from
  the dogfood run, docs wrap check.
- **P3 Yeet** — `bun run beep yeet publish --start-pr-early --monitor --pr`; goal slug in the commit.
- **P4 Close** — reflection via `/reflect agent-pool-doctrine`; flip status in the same PR.

## P4 Closeout Checklist

- [ ] Reflection at `history/reflections/<date>-<agent>.md`; `bun run beep lint reflection-artifacts`.
- [ ] `bun run beep goals set-status agent-pool-doctrine completed-retained` in the final PR.
- [ ] `goals/agent-pool-picker` resumed (`set-status ... active`) with the merged seat map as input.
- [ ] Exploration README Trail updated; Atlas regenerated.

## Execution Notes

- Cursor's sandbox write-protects `.cursor/*.json`, `.claude/*.json`, `.git/hooks/**`: lanes author
  docs, Fable authors config.
- The permission protocol: the adapter must print `{"permission":"allow"}` on permission events.

## Verification Commands

```sh
bun run beep quality package-verify @beep/repo-ai-metrics --quick
jq . .cursor/hooks.json .cursor/cli.json goals/agent-pool-doctrine/ops/manifest.json
git diff --check -- AGENTS.md docs/runbooks/agent-pools.md .cursor
test "$(wc -m < goals/agent-pool-doctrine/GOAL.md)" -le 4000
```
