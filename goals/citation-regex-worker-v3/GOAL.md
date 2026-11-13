# GOAL: Citation Regex Worker V3

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Serve a request's regex jobs from one child process at a time in a per-invocation native lane, under a parent timer per job, keeping SIGKILL retirement and capacity release only on confirmed death.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/citation-regex-worker-v3/README.md`
- `goals/citation-regex-worker-v3/SPEC.md`
- `goals/citation-regex-worker-v3/PLAN.md`
- `goals/citation-regex-worker-v3/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/law-practice/server/src/internal/Citation/` native and regex worker modules, `CitationEngine.limits.ts`, `packages/law-practice/server/test/`, `vitest.shards.json`, isolation evidence, this packet.
- Out: worker threads, an engine-lived pool, the stock RPC worker pool, sessions for Diff, Markup or Recognizer, limit values, extraction output.

Workflow:

1. Read the design, `explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`, then inspect current repo state.
   Work the slices in `PLAN.md` in order; start with B1, the native lane, once slice A2 of `citation-engine-install-once` has merged.
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
test "$(wc -m < goals/citation-regex-worker-v3/GOAL.md)" -le 4000
jq . goals/citation-regex-worker-v3/ops/manifest.json
git diff --check -- goals/citation-regex-worker-v3
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug citation-regex-worker-v3` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/citation-regex-worker-v3/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
