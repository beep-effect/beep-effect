# GOAL: Yeet PR resume footer

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Every Yeet PR is a durable bookmark to its originating workspace and agent sessions, with a number-only resume block that leaks nothing local.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/yeet-pr-resume-footer/README.md`
- `goals/yeet-pr-resume-footer/SPEC.md`
- `goals/yeet-pr-resume-footer/PLAN.md`
- `goals/yeet-pr-resume-footer/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli` Yeet internals (`Provenance.ts`, new
  `PrSessionRegistry.ts`, `ProvenanceFooter.ts`, `Resume.ts`,
  `Resume.schemas.ts`, `PullRequest.ts`, `Monitor.ts`, `Planner.ts`,
  `Yeet.command.ts`, `internal/cli/Flags.ts`), their tests, `turbo.json`
  passthrough, `.claude/skills/yeet/SKILL.md`, a changeset, the CSF-007
  follow-up note, and this packet.
- Out: any public field carrying a path, env template, session/thread id, or
  harness resume command; Codex session names; PR 2 surfaces (`yeet link`,
  verify/repair rows, re-assert on reply/closeout/merge); dotfiles.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/yeet-pr-resume-footer/GOAL.md)" -le 4000
jq . goals/yeet-pr-resume-footer/ops/manifest.json
git diff --check -- goals/yeet-pr-resume-footer
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.

