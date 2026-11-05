# GOAL: effect/String migration

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Move native String method calls to effect/String so @effect/tsgo 0.55+ can arm preferEffectString at error

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/effect-string-migration/README.md`
- `goals/effect-string-migration/SPEC.md`
- `goals/effect-string-migration/PLAN.md`
- `goals/effect-string-migration/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: native `String.prototype` calls in `packages/**`, `apps/**`, `infra/**`
  and root TypeScript; the `@effect/tsgo` pin; the diagnostics profile and its
  closed schema.
- Out: behaviour changes, new exception or suppression inventories, tsc-rs.

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
test "$(wc -m < goals/effect-string-migration/GOAL.md)" -le 4000
jq . goals/effect-string-migration/ops/manifest.json
git diff --check -- goals/effect-string-migration
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug effect-string-migration`,
then adopt with `bun run beep goals set-status effect-string-migration <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/effect-string-migration/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
