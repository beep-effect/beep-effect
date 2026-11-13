# GOAL: Lane Cockpit Spike

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a read-only live lanes board runs as a lab app in a terminal, proven
by frame tests, and one working day of operator use has decided keep or kill.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/lane-cockpit-spike/README.md`
- `goals/lane-cockpit-spike/SPEC.md`
- `goals/lane-cockpit-spike/PLAN.md`
- `goals/lane-cockpit-spike/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: a new lab app named `lane-cockpit` under `apps/labs/` (create it with
  `bun run beep create-package`), its one dependency `@textjs/react@1.6.1`,
  the lockfile, this packet.
- Out: `@beep/repo-cli`, `@beep/cli-kit`, `@beep/ui`, `@textjs/app`, any
  write to the ledger or to a lane, any second panel. See `SPEC.md` Non-Goals.

Budget: one working day. If two hours in no frame is drawn from real
`bun run beep session open --json` data, stop, record why, close as killed.
A killed spike with the lab deleted is a successful close.

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
test "$(wc -m < goals/lane-cockpit-spike/GOAL.md)" -le 4000
jq . goals/lane-cockpit-spike/ops/manifest.json
git diff --check -- goals/lane-cockpit-spike
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug lane-cockpit-spike` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/lane-cockpit-spike/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
