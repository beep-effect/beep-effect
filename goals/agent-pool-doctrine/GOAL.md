# GOAL: bind the volume-pool order and admit the Cursor lane

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `AGENTS.md` and `docs/runbooks/agent-pools.md` state the pool order
(Codex Astra above 5% → Cursor agent, fail-open → hold), the bucket-aware seat
map, and the structural guards; `.cursor/` carries the deny list and the pulse
hook adapter; `@beep/repo-ai-metrics` decodes `cursor-cli` rows; a real
headless `cursor-agent -p` run leaves pulse rows in the evidence ledger.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/agent-pool-doctrine/README.md`
- `goals/agent-pool-doctrine/SPEC.md`
- `goals/agent-pool-doctrine/PLAN.md`
- `goals/agent-pool-doctrine/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and
`explorations/cursor-agent-pool/{BRIEF,DECISIONS,RESEARCH}.md`. Higher-priority
repo standards outrank packet prose when they conflict.

Scope:

- In: `AGENTS.md` (one section), `docs/runbooks/agent-pools.md`, `.cursor/cli.json`,
  `.cursor/hooks.json`, `.cursor/hooks/hook-pulse.sh`, one env knob in
  `.claude/hooks/hook-pulse.sh`, `packages/tooling/library/ai-metrics`
  (`HookPulseAgentKind` literal + conformance test), this packet.
- Out: any Cursor usage meter or private endpoint; CLIProxyAPI changes; skills
  or agents mirrors; `codex exec` lane behaviour; the picker command.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`; cite decisions as `(Dn)`.
3. Preserve unrelated user/worktree changes.
4. Lanes author docs; `.cursor/*.json` is sandbox-protected, so config is
   written by the orchestrating session.
5. Update packet evidence/status if readiness changes.
6. At P4 Close, write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep quality package-verify @beep/repo-ai-metrics --quick
jq . .cursor/hooks.json .cursor/cli.json goals/agent-pool-doctrine/ops/manifest.json
git diff --check -- AGENTS.md docs/runbooks/agent-pools.md .cursor
test "$(wc -m < goals/agent-pool-doctrine/GOAL.md)" -le 4000
```

Stop and report before changing public API, schema (beyond the one literal),
dependencies, lockfiles, generated files, or destructive state unless `SPEC.md`
explicitly requires it. Never run a lane with `--sandbox disabled`.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
