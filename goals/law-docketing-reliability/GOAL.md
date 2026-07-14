# GOAL: prove docketing reminders cannot fail silently

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: approved patent deadlines are checked, escalated, acknowledged, and
recoverable, while an independent monitor alerts with the app and desktop off.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/law-docketing-reliability/README.md`
- `goals/law-docketing-reliability/SPEC.md`
- `goals/law-docketing-reliability/PLAN.md`
- `goals/law-docketing-reliability/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: sequential ODP polling, heartbeats, external monitoring, escalation and
  acknowledgment, bounded cursor recovery, open-deadline/Outlook
  reconciliation, attorney-visible recovery evidence, and focused tests.
- Out: legal-date computation, new matter types, vendor deadline engines,
  two-way Outlook sync, app-local-only monitoring, and promotion to docket of
  record.

Workflow:

1. Inspect the source exploration, patent spine contract, live source, and
   current worktree.
2. Confirm the external monitor is outside the app/desktop failure domain and
   record the selection evidence before implementation.
3. Implement the smallest schema-first, Effect-first reliability path satisfying
   `SPEC.md`, preserving unrelated worktree changes.
4. Keep the patent spine lifecycle/records contract as the dependency boundary;
   coordinate contract drift explicitly.
5. Kill the app and prove the alert still arrives, then restore it and prove
   bounded backfill, reconciliation, recovery reporting, and heartbeat resume.
6. Update packet evidence/status as readiness changes.
7. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] The kill-app independent alert and restore/recovery test passes.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/law-docketing-reliability/GOAL.md)" -le 4000
jq . goals/law-docketing-reliability/ops/manifest.json
git diff --check -- goals/law-docketing-reliability
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when the independent failure and recovery proof is green and the work
ships as a PR driven to mergeable through Yeet; otherwise report blockers with
file/command evidence.
