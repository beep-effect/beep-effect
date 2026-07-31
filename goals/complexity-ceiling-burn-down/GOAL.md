# GOAL: Burn down the cognitive->15 tail and promote the health ratchet

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every function above cognitive complexity 15 has an executed triage
verdict (real refactor, `thresholdOverrides` waiver with reason + review date,
or `ignorePatterns` with provenance), the committed health baseline
(`standards/fallow.health.regression-baseline.jsonc`) has shrunk to match, and
the fallow health lane is promoted from advisory to blocking after three
recorded clean runs.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/complexity-ceiling-burn-down/README.md`
- `goals/complexity-ceiling-burn-down/SPEC.md`
- `goals/complexity-ceiling-burn-down/PLAN.md`
- `goals/complexity-ceiling-burn-down/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, law 23 in
`standards/effect-laws-v1.md`, and the 2026-07-30 entry in
`standards/architecture/DECISIONS.md`. Higher-priority repo standards outrank
packet prose when they conflict. Calibration evidence and the five wave-1
refactor seams live in `research/calibration.md`; the target list in
`research/tail-inventory.md` (refresh it in P0 from `bun run fallow:health`).

Scope:

- In: tail-function owning packages (mostly `packages/tooling` CLI and
  `packages/foundation/ui-system`), `.fallowrc.jsonc` overrides/ignores, the
  health baseline, CiLane/FallowQuality lane wiring (promotion PR only), this
  packet.
- Out: lowering the ceiling to 6; refactoring the 7-15 band; new fallow
  features beyond the two P0 evaluations; skills plugin; hooks.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. **No appeasement:** a refactor must be defensible with the gate off — real
   seams only; otherwise take the override path. Crispen doctrine outranks the
   metric.
4. Preserve unrelated user/worktree changes.
5. Rebaseline (`bun run fallow:health:baseline:write`) only at wave
   boundaries, in the wave's PR; the baseline only shrinks.
6. Update packet evidence/status as readiness changes.
7. At P4 Close, write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] `bun run fallow:health:baseline:check` exits 0; zero critical complexity
      findings remain unwaived.
- [ ] Suppression totals not above the 2026-07-30 backfilled inventory.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/complexity-ceiling-burn-down/GOAL.md)" -le 4000
jq . goals/complexity-ceiling-burn-down/ops/manifest.json
git diff --check -- goals/complexity-ceiling-burn-down
bun run fallow:health:baseline:check
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
