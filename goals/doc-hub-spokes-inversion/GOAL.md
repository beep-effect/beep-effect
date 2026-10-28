# GOAL: Doc Hub and Spokes Inversion

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Rename `@beep/md` to `@beep/doc` (namespace `Doc`), move the parse bridge and the HTML projection into their spokes, replace the Markdown string writer with a projection through `Markdown.stringify`, trim `SafeDocument` to hub-native rules, and amend effected-promotion D-02/D-50.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/doc-hub-spokes-inversion/README.md`
- `goals/doc-hub-spokes-inversion/SPEC.md`
- `goals/doc-hub-spokes-inversion/PLAN.md`
- `goals/doc-hub-spokes-inversion/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/foundation/modeling/{md->doc,markdown,html}`, import sites across apps and packages, `scratchpad/temp`, `goals/effected-promotion/SPEC.md` (one amendment row), changesets, cache baseline request.
- Out: lexical and pandoc behaviour, the persisted `Doc.Document` JSON encoding, any HTML string parser, one-tree convergence.

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
test "$(wc -m < goals/doc-hub-spokes-inversion/GOAL.md)" -le 4000
jq . goals/doc-hub-spokes-inversion/ops/manifest.json
git diff --check -- goals/doc-hub-spokes-inversion
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final implementation PR while
initiative.status stays active or paused. A proposal never reports achievement.
Done only when exact-head hosted readiness and merge evidence verify the proposal
through `bun run beep goals completion refresh --slug <slug>`, or when a blocker
that needs the operator is reported with file/command evidence.
