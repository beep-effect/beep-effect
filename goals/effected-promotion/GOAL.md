# GOAL: Effected kit promotion

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every promotable `scratchpad/effected` module lives in its own
`@beep/*` package (wave plan in PLAN.md), the duplicates it replaces are
retired, and `@effected/github` is gone.

Status: the closing PR C proposes the closeout (SPEC D-60); the packet stays
`active` until `bun run beep goals completion refresh --slug effected-promotion`
verifies it. A resumed session finishes C's open gate work.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/effected-promotion/README.md`
- `goals/effected-promotion/SPEC.md`
- `goals/effected-promotion/PLAN.md`
- `goals/effected-promotion/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: new packages from the SPEC package map, `scratchpad/effected/**`,
  `scratchpad/test/**`, root wiring owned by `create-package`/`tsconfig-sync`,
  and the reuse sites in `research/promotion-map-2026-10-20.md`.
- Out: re-reviewing the port, npm publication, converging `@beep/md` and
  `@beep/markdown` (SPEC Non-Goals).

Workflow:

1. Inspect referenced files and current repo state.
2. Promote the next wave in PLAN.md with `bun run beep create-package`, or
   run the next adoption step; one PR each.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [x] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [x] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/effected-promotion/GOAL.md)" -le 4000
jq . goals/effected-promotion/ops/manifest.json
git diff --check -- goals/effected-promotion
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
