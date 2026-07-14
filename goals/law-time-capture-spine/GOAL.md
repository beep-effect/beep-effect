# GOAL: deliver the manual law-time capture spine

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Tom can run a visible manual timer, associate real matter/task context,
review an evidence-bounded candidate duration and narrative, edit or dispose of
it, explicitly approve it with history, and render a duplicate-safe CSV/prebill
preview without a network dependency or competing billing ledger.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/law-time-capture-spine/README.md`
- `goals/law-time-capture-spine/SPEC.md`
- `goals/law-time-capture-spine/PLAN.md`
- `goals/law-time-capture-spine/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the Slice 1 manual spine across scoped law-practice domain, use-case,
  table, server, and professional-desktop surfaces; redacted fixtures, focused
  tests, pilot evidence, and packet evidence.
- Out: billing/accounting system-of-record behavior, FreshBooks integration,
  M365 signals, PST reconstruction, profitability views, LEDES/UTBMS, invoices,
  payments, trust accounting, and unrelated packages.

Workflow:

1. Inspect the exploration, live source, and current worktree.
2. During P0, derive the native prosecution task set from real matters supplied
   by Tom; freeze schema-first models and the deletion contract before build.
3. Implement the smallest Effect-first vertical satisfying `SPEC.md`.
4. Preserve unrelated changes and keep all evidence purpose-bounded/redacted.
5. Prove the approval firewall, idempotency, retention, revocation, and pilot
   thresholds; do not substitute inferred duration for explicit timer duration.
6. Update packet evidence/status as readiness changes.
7. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unapproved entry is exportable and repeated previews create no duplicates.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/law-time-capture-spine/GOAL.md)" -le 4000
jq . goals/law-time-capture-spine/ops/manifest.json
git diff --check -- goals/law-time-capture-spine
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when the full acceptance/pilot matrix is green and the work ships as
a PR driven to mergeable through Yeet; otherwise report blockers with
file/command evidence.
