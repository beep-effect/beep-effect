# GOAL: Practice Mail Tagging

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Tag the solo attorney Outlook mailbox by matter through the practice KG and auto-file attachments into the Box matter tree, reversibly.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-mail-tagging/README.md`
- `goals/practice-mail-tagging/SPEC.md`
- `goals/practice-mail-tagging/PLAN.md`
- `goals/practice-mail-tagging/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/law-practice/{domain,use-cases,server}` `MailTagging` modules,
  this packet, private state under `~/.local/state/beep/practice-mail-tagging/`.
- Out: `packages/drivers/m365` (workstream A), the PST backfill, any mail move
  or delete, client mail or documents in the repo.

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
test "$(wc -m < goals/practice-mail-tagging/GOAL.md)" -le 4000
jq . goals/practice-mail-tagging/ops/manifest.json
git diff --check -- goals/practice-mail-tagging
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
