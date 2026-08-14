# GOAL: Ship lab apps and delete-package on a geometry substrate

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path. All paths below are repo-relative.

Outcome: `beep create-package` mints law-abiding lab apps under `apps/labs/*`
(nextjs, vite, service; tauri in P3) with a schema-validated lab manifest and
`beep labs list`, and `beep delete-package` fully prunes any leaf workspace
package/app with a green doctor pass, both driven by one schema-first
registration-geometry model.

Read first: `goals/lab-apps-lifecycle/{README,SPEC,PLAN}.md` and
`ops/manifest.json`, then `AGENTS.md` and the standards SPEC names. The SPEC
Decision Log D1–D14 is operator-ratified and locked — implement, don't
re-litigate. The six `research/*.md` reports are the evidence base; `research/02`
§19 and `research/05` §9 are the census and command spec.

Scope:

- In: repo-cli CreatePackage/DeletePackage/labs/geometry work, identity
  registration + orphan lint, one-time `apps/labs/*` glob and gate scoping,
  lab templates and manifest schema, GLOSSARY term, promotion runbook,
  round-trip verification, this packet.
- Out: production apps, slice retirement automation, cascade deletes outside
  labs, `beep labs promote` command, goals bootstrap, architecture-command
  or CI-topology redesign, relaxing any code law.

Workflow:

1. Follow PLAN phases in order; each implement phase is its own yeet PR with
   `lab-apps-lifecycle` in the PR title.
2. Load schema-first-development before schema work; effect-first-development
   before CLI work. Validate Effect v4 APIs against `.repos/effect`.
3. Reuse the reconstructive spine: `syncTsconfigAtRoot` inverts derived
   configs; never grow ConfigUpdater remove-APIs or TsMorphIntegrationService.
4. Delete-package refuses per `research/05` §9.4; `--force` never overrides
   dependents. Doctor must fail on the live #680 residue before P1 fixes it.
5. Preserve unrelated worktree changes.
6. At P6 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] SPEC acceptance criteria (Track A and Track B) are satisfied.
- [ ] First Vertical Slice round-trip is proven and recorded.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/lab-apps-lifecycle/GOAL.md)" -le 4000
jq . goals/lab-apps-lifecycle/ops/manifest.json
git diff --check -- goals/lab-apps-lifecycle
bun run beep goals doctor
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it — and when any SPEC
stop condition fires.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
