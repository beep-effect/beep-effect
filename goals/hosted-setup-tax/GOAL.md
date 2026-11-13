# GOAL: Hosted Setup Tax

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: hosted CI stops paying for duplicate work and needless setup, with
no proof-depth change, and the Property Laws oracle census plus the residual
file split (D26) land. Proof: certainty-scorecard runner-minutes per green
code run p50 at most 244 (baseline 264), each lever's minutes attributed
once in dedup order (#3028-#3030, #3040, #3043, #3046 and sibling minutes never counted), all required
contexts present.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/hosted-setup-tax/README.md`
- `goals/hosted-setup-tax/SPEC.md`
- `goals/hosted-setup-tax/PLAN.md`
- `goals/hosted-setup-tax/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `.github/workflows/check.yml` jobs named in SPEC;
  `packages/tooling/tool/cli`
  (CoverageScope, Lint Policy plan, CiLane, GithubChecks, tests);
  `packages/tooling/test-kit/fc-runs`; root `trustedDependencies`; this packet.
- Out: lowering floors, seeds, census, corpus replay or required contexts;
  HOST-05 sharding (read only after the split slice); heavy-pool-diet, route-soundness-repair and main-verdict
  work; shard layout; cache reuse; spend.
- Needs: `ci/certainty-scorecard`, `ci/route-soundness` (ROUT-07, PERIH-10).

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`, in PLAN.md slice order.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria met, each lever behind its gate.
- [ ] MAP.md reviewer constraints held (HOST-09, PERIH-04, PERIL-01).
- [ ] One hosted `lint:shadcn` owner; each CI-YAML slice has a tested revert.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/hosted-setup-tax/GOAL.md)" -le 4000
jq . goals/hosted-setup-tax/ops/manifest.json
git diff --check -- goals/hosted-setup-tax
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug hosted-setup-tax` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/hosted-setup-tax/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
