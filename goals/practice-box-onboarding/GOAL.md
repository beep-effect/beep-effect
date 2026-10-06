# GOAL: Practice Box Onboarding

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the solo attorney can file and retrieve his work in Box. His current
matter files are inventoried, mapped into the provisioned client/matter tree,
and migrated by a resumable, dry-run-first, content-hash-deduped engine in
`@beep/box-provisioning` that never touches a source; Box Drive install steps
and a one-page how-to are written; a private spot-check list is routed to him.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-box-onboarding/README.md`
- `goals/practice-box-onboarding/SPEC.md`
- `goals/practice-box-onboarding/PLAN.md`
- `goals/practice-box-onboarding/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/drivers/box-provisioning` (content-migration modules and
  tests); `docs/runbooks/practice-box-*.md`; this packet; the live Box tenant
  through reviewed-plan applies; private artifacts under the corpus home's
  `ops/box-onboarding/`.
- Out: email attachment auto-filing; the vault mirror; metadata and retention;
  mail archives; any delete or overwrite in Box; any write to a source;
  anything that costs money; client or matter names in tracked files.

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

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/practice-box-onboarding/GOAL.md)" -le 4000
jq . goals/practice-box-onboarding/ops/manifest.json
git diff --check -- goals/practice-box-onboarding
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
