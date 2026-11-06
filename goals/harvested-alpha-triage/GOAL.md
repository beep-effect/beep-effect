# GOAL: Harvested Alpha Triage

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Judge the harvest ledger with three separate provider sessions (Opus 5.5 high, Grok 4.7 xhigh, GPT-6.1 Sol medium) into row-keyed verdict JSONL, merge deterministically, and seed `explorations/harvested-alpha-2026-11` at stage `shape` so its MAP graduates the still-open alpha into concrete goals.

Decisions already made (do not reopen): `explorations/packet-archive-and-alpha-harvest/DECISIONS.md`. Prerequisite: the ledger at `explorations/packet-archive-and-alpha-harvest/research/harvest/ledger.jsonl` exists on `main`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/harvested-alpha-triage/README.md`
- `goals/harvested-alpha-triage/SPEC.md`
- `goals/harvested-alpha-triage/PLAN.md`
- `goals/harvested-alpha-triage/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: verdict schema and merge step, `research/harvest/` verdict and merge files, the new `explorations/harvested-alpha-2026-11` packet.
- Out: archive mechanics, freeform packet reads, opening goals directly from clusters.

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
test "$(wc -m < goals/harvested-alpha-triage/GOAL.md)" -le 4000
jq . goals/harvested-alpha-triage/ops/manifest.json
git diff --check -- goals/harvested-alpha-triage
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug harvested-alpha-triage`,
then adopt with `bun run beep goals set-status harvested-alpha-triage <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/harvested-alpha-triage/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
