# GOAL: Packet Archive Mechanics

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Ship `beep goals harvest` and `beep goals archive` (Goals family, `--kind goals|explorations`), the manifest `archive` block and `retentionReason`, doctor and INDEX support, the public archive repo, then sweep every terminal packet off `main` in sequential hash-verified batches of about 50; the harvest ledger is committed before batch 1.

Decisions already made (do not reopen): `explorations/packet-archive-and-alpha-harvest/DECISIONS.md`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/packet-archive-mechanics/README.md`
- `goals/packet-archive-mechanics/SPEC.md`
- `goals/packet-archive-mechanics/PLAN.md`
- `goals/packet-archive-mechanics/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Goals/**` and `Explore/**` schemas, `scripts/references.json`, `goals/README.md`, `explorations/README.md`, the closeout skill, every tombstoned packet and inbound link, the archive repo.
- Out: judging the ledger; new statuses; archive branches or disk copies; reference, paused, parked, active packets; parallel batch PRs.

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
test "$(wc -m < goals/packet-archive-mechanics/GOAL.md)" -le 4000
jq . goals/packet-archive-mechanics/ops/manifest.json
git diff --check -- goals/packet-archive-mechanics
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug packet-archive-mechanics`,
then adopt with `bun run beep goals set-status packet-archive-mechanics <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/packet-archive-mechanics/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
