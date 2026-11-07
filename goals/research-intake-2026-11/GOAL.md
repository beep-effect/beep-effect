# GOAL: Research intake 2026-11

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Run and mine the library's third intake: Box nightlies, the Nov-5 aggregation (papers, link list, VidBee bundles, private DM archive) at hop 0, hop 1 in full, gated hop 2; T1/T2/T3 mining into CiTO-typed, SKOS-routed findings; deep-research per gap cluster; per-hop coverage; routing amendments. Box legal-ontology pile: download, dedupe, T1 only.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/research-intake-2026-11/README.md`
- `goals/research-intake-2026-11/SPEC.md`
- `goals/research-intake-2026-11/PLAN.md`
- `goals/research-intake-2026-11/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the out-of-repo library (new intake snapshots, objects, receipts), `mine` library commands and tests, `goals/research-intake-2026-11/research/*`, routing amendments in owning packets.
- Out: implementing routed findings, T2 reads of the 449-PDF pile, X post bodies, video files in objects/, October intake accounting; nothing private or client-derived enters the repo.

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
test "$(wc -m < goals/research-intake-2026-11/GOAL.md)" -le 4000
jq . goals/research-intake-2026-11/ops/manifest.json
git diff --check -- goals/research-intake-2026-11
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug research-intake-2026-11`,
then adopt with `bun run beep goals set-status research-intake-2026-11 <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/research-intake-2026-11/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
