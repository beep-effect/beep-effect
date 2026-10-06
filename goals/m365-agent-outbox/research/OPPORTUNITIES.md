# M365 Agent Outbox — Friction Receipts

## 2026-10-06: `yeet publish` cannot push a docs-only branch while `main` carries a cheap-gate red

- **Doing:** publishing slice 0 (packet prose and one runbook, no code).
- **Evidence:** `bun run beep yeet publish` stopped at
  `lint:effect-vitest: exit 1` with `6 new finding(s) in 2 file(s)`, both
  under `packages/tooling/tool/cli/test/` (`models-check.test.ts`,
  `models-init-command.test.ts`). The branch touches neither file; the red is
  on `main` and is owned by the open inherited-reds PR. `publish` has no way
  to proceed on an attributed inherited red, so the branch was pushed with
  `git push` and the draft PR opened with `gh pr create`.
- **Would have prevented it:** cheap-gates attributing a red lane to the base
  (the same lane red at the merge-base) and letting `publish` push with the
  red recorded as inherited, as the fallow gates already do with their
  `introduced` / `inherited` split.

## 2026-10-06: a fresh Claude worktree fails every turbo-backed cheap gate in two seconds

- **Doing:** the first `yeet publish` in a new `.claude/worktrees/<name>` lane.
- **Evidence:** twelve of fifteen cheap-gate lanes exited 1 in about two
  seconds each with `Native Turbo is not installed; discovery will not install
  or emulate a client.` `bun install --frozen-lockfile` fixed all of them.
- **Would have prevented it:** a cheap-gates preflight that checks for the
  native turbo binary once and fails with "run `bun install`" instead of
  twelve unrelated-looking reds.
