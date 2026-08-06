# GOAL: derive a read-only fleet mirror over sibling checkouts

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `beep worktree fleet` reports, per checkout sharing this origin, its
branch, head, dirty count, liveness, conflict-vs-`main`, and whether `main` moved
onto a measured policy path — every field **measured or `unknown`**, never
inferred.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/fleet-mirror/README.md`
- `goals/fleet-mirror/SPEC.md`
- `goals/fleet-mirror/PLAN.md`
- `goals/fleet-mirror/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards `SPEC.md`
names. Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Worktree/` and its tests.
- Out: claims, leases, enforcement, ambient delivery (`AgentBrief.fleet` — rung
  2, blocked on PR-I), `Yeet/internal/*`, merge queue, cross-machine, new
  packages, `worktree doctor`'s existing row schema.

Three laws that decide most judgment calls here:

1. **Measured or `unknown`.** Never infer a field from a proxy; never default to
   the safe-sounding value. A falsely-`clean` or falsely-`dormant` field is a
   silent miss, worse than an absent one. If a signal cannot be made correct
   without inferring, stop and report.
2. **Read-only.** The scan writes nothing into any checkout except its own
   scanner ODB cache, and never blocks anything.
3. **Design order: schema → `Context.Service` contract → implementation.**

Workflow:

1. Inspect referenced files and current repo state.
2. P0 first: **measure** the policy surface against recent first-parent `main`
   commits. No path enters it unmeasured — an intuition-built list touched 52.6%
   of recent commits and would have hard-failed half of all publishes.
3. Make the smallest change that satisfies `SPEC.md`.
4. Preserve unrelated user/worktree changes; never `git add -A`.
5. Keep decisions tied to evidence from files, tests, docs, or command output.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md`); `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] The proof test reconstructs the #551 shape — `main` moves onto a measured
      policy path while a checkout holds a branch that never touched the changed
      file — and asserts signal 3 fires while signals 1 and 2 stay **silent**.
      That collision has no textual conflict; a mirror that cannot tell those
      apart is not carrying Mode B.
- [ ] Tests assert unreadable `/proc` yields `unknown` not `dormant`, and an
      unmaterialized `merge-tree` target yields `unknown` not `clean`.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/fleet-mirror/GOAL.md)" -le 4000
jq . goals/fleet-mirror/ops/manifest.json
git diff --check -- goals/fleet-mirror
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
