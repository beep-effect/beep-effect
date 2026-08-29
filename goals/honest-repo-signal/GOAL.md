# GOAL: make first-party signal honest in one night

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path. All paths below are repo-relative.

Outcome: three VERSION-only drivers are gone, their owning goals are listed
in `research/FOLLOW-UPS.md`, cheap public-repo files exist, README tells the
truth about subtrees, and `AGENTS.md` has a Touch → Skill/Command table.

This is a compact `/goal` launcher. Treat the packet files as the contract:

- `goals/honest-repo-signal/README.md`
- `goals/honest-repo-signal/SPEC.md`
- `goals/honest-repo-signal/PLAN.md`
- `goals/honest-repo-signal/research/FOLLOW-UPS.md`
- `goals/honest-repo-signal/ops/manifest.json`

Read those first, then `AGENTS.md` and the architecture decisions named by
`SPEC.md`. Repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/drivers/{courtlistener,dol,federal-register}` and their
  workspace/tsconfig/coverage registrations; root `CONTRIBUTING.md`,
  `SECURITY.md`, `.github/CODEOWNERS`, PR/issue templates; `README.md`;
  `AGENTS.md` table only; delivery-packet README keep-scaffold sentence;
  this packet.
- Out: `@beep/protobuf`; implementing those three drivers; `beep goals
  bootstrap`; git history rewrite; UI coverage; CI fleet; KSA workstreams;
  `CODE_OF_CONDUCT.md`.

Workflow:

1. Confirm the three packages still export only `VERSION` and have no
   product consumers. Stop if that is false.
2. Delete the packages and every registration. Do not touch protobuf.
3. Keep `research/FOLLOW-UPS.md` as the resume map. Patch the delivery
   README so it no longer requires empty scaffolds.
4. Ship the public files and the README subtree policy.
5. Add the `AGENTS.md` table without net-growing the always-on kernel.
6. Verify with the matrix in `SPEC.md`. Yeet from a feature branch.
7. At P4 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md`.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Follow-ups name federal-register, dol, and courtlistener with owning
      goals and restart artifacts.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors.

Verification:

```sh
test "$(wc -m < goals/honest-repo-signal/GOAL.md)" -le 4000
jq . goals/honest-repo-signal/ops/manifest.json
test -z "$(git ls-files packages/drivers/courtlistener)"
test -z "$(git ls-files packages/drivers/dol)"
test -z "$(git ls-files packages/drivers/federal-register)"
# protobuf guard retired 2026-08-13: sibling clone removed it in PR #690
git diff --check -- goals/honest-repo-signal
```

Stop before changing public API, auth, infra, lockfiles, or generated
files unless `SPEC.md` requires it. Recreating a deleted driver in this
PR is a stop condition.

Done when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
