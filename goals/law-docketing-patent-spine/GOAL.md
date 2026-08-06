# GOAL: deliver the US patent office-action approval spine

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a fixture-backed US patent office action and maintenance-fee event can
be observed, proposed, attorney-approved, durably reconciled, and pushed one way
to Outlook with exceptional-date and restart proof.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/law-docketing-patent-spine/README.md`
- `goals/law-docketing-patent-spine/SPEC.md`
- `goals/law-docketing-patent-spine/PLAN.md`
- `goals/law-docketing-patent-spine/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the named US Patent Office-Action Approval Spine across the scoped
  law-practice domain/use-case/table/server boundaries and the existing USPTO,
  PGlite, and M365 driver boundaries; focused fixtures, tests, and evidence.
- Out: trademarks, court orders, foreign work, vendor connectors, two-way
  calendar sync, broad deadline handroll, and promotion to docket of record.

Workflow:

1. Inspect the source exploration, live source, and current worktree.
2. Complete P0 authority refresh, rule-fixture derivation, and ODP/e-OA path
   checks before freezing contracts.
3. Implement the smallest schema-first, Effect-first slice satisfying `SPEC.md`.
4. Preserve unrelated user/worktree changes and keep decisions evidence-backed.
5. Coordinate the lifecycle/records contract with
   `goals/law-docketing-reliability`; do not claim patent v1 acceptance until its
   kill-app alert and recovery proof pass.
6. Update packet evidence/status as readiness changes.
7. At P4 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] The paired reliability acceptance edge is proven.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/law-docketing-patent-spine/GOAL.md)" -le 4000
jq . goals/law-docketing-patent-spine/ops/manifest.json
git diff --check -- goals/law-docketing-patent-spine
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when the complete proof matrix is green, the reliability sibling's
kill-app alert and recovery proof pass, and the work ships as a PR driven to
mergeable through Yeet; otherwise report blockers with file/command evidence.
