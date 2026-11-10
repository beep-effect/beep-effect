# GOAL: Run a merge queue on a lab branch and record how GitHub behaves

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a merge queue runs on the `queue-lab` branch behind a toy required
check, every row of the `SPEC.md` Observations table has a finding with
evidence, `@beep/github` has typed enqueue, dequeue and queue-entry calls, and
a go, park or kill verdict is recorded for `explorations/github-merge-queue`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/merge-queue-lab/README.md`
- `goals/merge-queue-lab/SPEC.md`
- `goals/merge-queue-lab/PLAN.md`
- `goals/merge-queue-lab/ops/manifest.json`

Read those first, then `explorations/github-merge-queue/BRIEF.md`,
`DECISIONS.md` and `research/github-semantics.md`, then `AGENTS.md`,
`CLAUDE.md`, and any governing standards named by `SPEC.md`. Higher-priority
repo standards outrank packet prose when they conflict.

Scope:

- In: the `queue-lab` branch and its toy workflow; a second ruleset targeting
  only `queue-lab`; `packages/drivers/github/src/PullRequest.ts` and tests;
  `goals/merge-queue-lab/` (ops script, findings, evidence); the verdict
  written back to `explorations/github-merge-queue/`.
- Out: ruleset 10240248 and any queue on `main`; every workflow on `main`;
  Yeet's merge path; S11, the review window and merge doctrine; real-lane
  parity; purchases.

Workflow:

1. Inspect referenced files and current repo state.
2. P1: cut `queue-lab`, add the toy workflow there, create the lab ruleset,
   send one synthetic pull request through it. Record findings 10b,
   10c, 6e, 6f. If no fleet identity can enqueue, go to closeout with a kill
   verdict.
3. P2: land the driver calls, write the lab script under `ops/`, work the
   rest of the Observations table.
4. Preserve unrelated user/worktree changes.
5. Tie every finding to a run or API response saved under
   `research/evidence/`.
6. At P4 Close, record the verdict, clean up synthetic pull requests, and
   write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/merge-queue-lab/GOAL.md)" -le 4000
jq . goals/merge-queue-lab/ops/manifest.json
git diff --check -- goals/merge-queue-lab
bun run beep ci ruleset --check
bun run beep quality package-verify @beep/github
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file with its
reason and how to reverse it, then continue. Land the reversal path for an
irreversible change before the change merges, and ship a breaking public API
or schema change with a major changeset. Escalate only what AGENTS.md
"Autonomy" lists.

Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
