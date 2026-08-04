# GOAL: cut agent-to-mergeable wall-clock (tstyche removal + time/instantiation evidence)

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: tstyche is fully removed (its own PR, gated on inventory review), and
two evidence reports — quality-time inventory and instantiation census — are
merged as docs-only PRs with a reviewed remediation handoff and no remediation
landed.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/quality-speedup/README.md`
- `goals/quality-speedup/SPEC.md`
- `goals/quality-speedup/PLAN.md`
- `goals/quality-speedup/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict.

Scope:

- In: tstyche surfaces (configs, `*.tst.ts`, `dtslint/`, CLI code paths, the
  `dtslint-tsgo` lane, deps, docs); `goals/quality-speedup/research/**`.
- Out: any remediation derived from the B/C reports; toolchain replacement;
  editing immutable history under `goals/**`/`explorations/**`.

Workflow:

1. P0: verify instruments, then measure (census method from
   `goals/box-typecheck-cost` is binding — include floor probes, record tsgo
   version, report per-file numbers as marginals).
2. P1: execute the tstyche removal per the REVIEWED inventory only; delete the
   lane, don't no-op it; measure the before/after saving honestly.
3. P2: land the B/C reports docs-only; P3: stop and report remediation
   candidates; P4: closeout reflection via `/reflect`.
4. Preserve unrelated worktree changes; cite evidence for every claim.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/quality-speedup/GOAL.md)" -le 4000
jq . goals/quality-speedup/ops/manifest.json
git diff --check -- goals/quality-speedup
bun run beep tsconfig-sync --check
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, or generated files beyond
what Workstream A explicitly requires; when a `*.tst.ts` unique assertion
lacks sign-off; when removal needs edits outside the inventory; when an
instrument cannot be verified.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
