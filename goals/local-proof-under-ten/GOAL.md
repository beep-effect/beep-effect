# GOAL: Local Proof Under Ten

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: local publish p95 at most 8 min and verify p50 at most 10 min on
the fleet census, zero earlyoom-killed admitted gates over 7 days, no failing
stale-green fixture, by extending the existing QualityScheduler: lane or
package admission units, measured weights, final-check and agent-shell work
admitted, bounded advisory coverage in publish, local shadow partitions,
monitor back-off, and time-to-certainty's C4.2 and re-seed seams.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/local-proof-under-ten/README.md`
- `goals/local-proof-under-ten/SPEC.md`
- `goals/local-proof-under-ten/PLAN.md`
- `goals/local-proof-under-ten/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli` (scheduler, Yeet final-check, monitor,
  review window, proof ledger, wave order, coverage scope) and its tests;
  `apps/labs/ciops`; yeet and orchestrate skills; the AGENTS.md lines D12
  and D15 amend; this packet.
- Out: GitHub reads, the monitor identity and the REST reserve (the three
  github-* goals); SCHE-09, MEAS-* and PERIL-11 (certainty-scorecard);
  COVE-02 to COVE-04, TEST-10, ROUT-07 (route-soundness-repair); edits to
  the `goals/time-to-certainty` packet; enforced reuse under the R2 pause;
  any proof-depth reduction.
- Needs: `ci/certainty-scorecard`, `ci/route-soundness` (`requires`).

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

- [ ] `SPEC.md` acceptance criteria are satisfied, each lever through its
      gate in the order of `PLAN.md` Slices, at most three open PRs.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/local-proof-under-ten/GOAL.md)" -le 4000
jq . goals/local-proof-under-ten/ops/manifest.json
git diff --check -- goals/local-proof-under-ten
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug local-proof-under-ten` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/local-proof-under-ten/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
