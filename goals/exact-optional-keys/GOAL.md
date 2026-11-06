# GOAL: Exact optional schema keys

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Migrate S.optional, S.withDecodingDefault and S.OptionFromOptional fields to their exact *Key siblings with a tested codemod, and guard it with an EF-40 GritQL law

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/exact-optional-keys/README.md`
- `goals/exact-optional-keys/SPEC.md`
- `goals/exact-optional-keys/PLAN.md`
- `goals/exact-optional-keys/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: every Biome-linted TS file using the banned `effect/Schema` forms; the SchemaParityCodemod engine; policy-pack lint-rules; EF standards and schema-first skill docs.
- Out: `.repos/**`, `dist/**`, explicit `UndefinedOr`/`NullOr` unions, non-schema `optional` helpers.

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
test "$(wc -m < goals/exact-optional-keys/GOAL.md)" -le 4000
jq . goals/exact-optional-keys/ops/manifest.json
git diff --check -- goals/exact-optional-keys
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug exact-optional-keys`,
then adopt with `bun run beep goals set-status exact-optional-keys <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/exact-optional-keys/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
