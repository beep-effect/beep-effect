# GOAL: Practice Claude Code Mod

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Ship one Claude Code plugin from apps/practice-claude-mod that gives the attorney's sessions plain-language practice-kg tool rows, Right/Wrong verdict capture, a current-matter band with a visible timer, and five ported firm skills, tested on the operator machine and delivered to the attorney's PC by directory marketplace.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-claude-mod/README.md`
- `goals/practice-claude-mod/SPEC.md`
- `goals/practice-claude-mod/PLAN.md`
- `goals/practice-claude-mod/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `apps/practice-claude-mod/**` (new, via `bun run beep create-package`), one `docs/runbooks/` page, this packet, and `explorations/claude-mods-law-practice` state.
- Out: passive time capture or time entries, mods API calls outside the SPEC D9 envelope, Claude Desktop chat and the MCPB extension, managed settings, any send/file/calendar action, client text in the repo, machine names or private paths in the repo.

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
test "$(wc -m < goals/practice-claude-mod/GOAL.md)" -le 4000
jq . goals/practice-claude-mod/ops/manifest.json
git diff --check -- goals/practice-claude-mod
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
