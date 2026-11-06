# GOAL: Research library acquisition routes

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Add the acquisition routes the library lacks: a @beep/firecrawl driver with a native web route, a Box route on @beep/box with per-file receipts, VidBee and alphaXiv import-result methods, per-hop citation extraction, and the routed-finding hop-2 gate with domain caps.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/research-library-routes/README.md`
- `goals/research-library-routes/SPEC.md`
- `goals/research-library-routes/PLAN.md`
- `goals/research-library-routes/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/drivers/firecrawl` (new via `bun run beep create-package`), `packages/tooling/tool/cli/src/commands/Research/Library/*` (acquire, inventory, import-result, qualify, hop-gate policy), their tests, `docs/runbooks/research-library.md`.
- Out: catalog model changes (consume research-library-ontology-core), full hop-2 crawl, transitive GitHub, X bodies, video files in objects/, any intake run, new paid endpoints.

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
test "$(wc -m < goals/research-library-routes/GOAL.md)" -le 4000
jq . goals/research-library-routes/ops/manifest.json
git diff --check -- goals/research-library-routes
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug research-library-routes`,
then adopt with `bun run beep goals set-status research-library-routes <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/research-library-routes/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
