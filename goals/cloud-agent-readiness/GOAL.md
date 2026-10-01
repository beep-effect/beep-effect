# GOAL: make a fresh cloud container able to install, prove, and publish

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: one documented command takes a fresh hosted container from clone to a
green `bun install --frozen-lockfile` and a working `bun run beep --help`,
names any denied host instead of failing silently, hooks know the host they
are on, and a cloud session has a documented end state (proof quoted in the
PR body, branch pushed, PR opened through the GitHub API) with the operator
closeout named.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/cloud-agent-readiness/README.md`
- `goals/cloud-agent-readiness/SPEC.md` (decisions D1–D7)
- `goals/cloud-agent-readiness/PLAN.md`
- `goals/cloud-agent-readiness/ops/manifest.json`
- `goals/cloud-agent-readiness/research/2026-10-01-container-probe.md` (F1–F15)

Read those first, then `AGENTS.md`, `CLAUDE.md`, `docs/runbooks/agent-pools.md`,
and `.github/actions/setup-monorepo-ci/action.yml` (the known-good install
recipe). Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: `scripts/cloud-session-setup.sh` (new), `.claude/settings.json`,
  `.claude/hooks/*`, `.claude/helpers/graft-hooks.cjs`, one `AGENTS.md`
  section, `docs/runbooks/cloud-sessions.md` (new), cross-links in
  `docs/README.md` and `docs/runbooks/agent-pools.md`, one `docs/ROADMAP.md`
  row, `packages/tooling/library/ai-metrics` only for a `cloud` host literal,
  this packet.
- Out: moving Effect off `pkg.pr.new`; vendoring snapshots; secrets in the
  cloud; recorded QA in the cloud; Yeet token modes; Cursor/Codex lanes;
  editing `.bun-version` or `.bun-linux-x64.sha256`.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`; cite decisions as `(Dn)`
   and probe findings as `(Fn)`.
3. The setup script never edits tracked files, never calls `bun.sh/install`,
   never `cp`s over a busy binary, and verifies the bun archive against
   `.bun-linux-x64.sha256`.
4. Host detection is the explicit `BEEP_AGENT_HOST` variable; never guess.
5. If you are running in a cloud container, you are the P3 evidence: run the
   script, run one `package-verify --quick`, quote the output in the PR body,
   push, open the PR through the GitHub API, and write the dated `history/`
   note. The yeet closeout is operator-side (D4).
6. Preserve unrelated worktree changes; update packet evidence/status when
   readiness changes.
7. At P6 Close, write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/cloud-agent-readiness/GOAL.md)" -le 4000
jq . goals/cloud-agent-readiness/ops/manifest.json
git diff --check -- goals/cloud-agent-readiness scripts AGENTS.md docs .claude
shellcheck scripts/cloud-session-setup.sh
bash scripts/cloud-session-setup.sh --check
```

Stop and report before changing public API, schema (beyond the one literal),
dependencies, lockfiles, generated files, or destructive state unless `SPEC.md`
explicitly requires it. Stop if `pkg.pr.new` cannot be allowed or the bun
archive digest does not match.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
