# GOAL: resolve a PR, branch, lane or checkout to its owning session's route

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the planned `session resolve <key>` prints the owner, each route, its computed liveness and the send call, and sessions record their routes at start without being asked.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/session-route-resolver/README.md`
- `goals/session-route-resolver/SPEC.md`
- `goals/session-route-resolver/PLAN.md`
- `goals/session-route-resolver/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Session/**`, the two literal domains in `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts`, `.claude/hooks/session-ledger.sh`, `.codex/hooks.json`, `@beep/repo-cli` tests, the `orchestrate` and `closeout` skill text that tells agents how to find an owner.
- Out: any transport, mailbox, relay or poller; any write to another checkout's inbox; any session id in a PR body or tracked file; the meaning or fields of `SessionLedgerRow`.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/session-route-resolver/GOAL.md)" -le 4000
jq . goals/session-route-resolver/ops/manifest.json
git diff --check -- goals/session-route-resolver
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug session-route-resolver` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/session-route-resolver/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
