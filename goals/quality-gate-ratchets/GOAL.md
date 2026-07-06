# GOAL: Make every declared quality gate a ratcheting, blocking gate

Repo root: the current working directory — the `beep-effect` checkout you are
running in. All paths repo-relative.

Outcome: coverage, knip, jsdoc-inventory, and boundary gates enforce
committed baselines fail-on-regression; commitlint runs in CI; main is
protected by a real ruleset — one PR + one post-merge API step.

Contract files (read in order): `goals/quality-gate-ratchets/SPEC.md`
(normative), `PLAN.md`, `ops/manifest.json`, `research/SOURCES.md`. Then
`AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md` §dependency graph.
Higher sources win.

Scope:

- In: vitest.shared.ts + root/driver coverage scripts; Quality/Tasks.ts (+
  internal) gate steps; new committed baselines under standards/;
  fallow.boundaries provenance schema/file/generator; Yeet internal
  Planner.ts prepare steps; .github/workflows/check.yml (coverage, knip,
  commitlint lanes); ruleset 10240248 (post-merge, via gh api, Claude only).
- Out: fixed coverage floors; test backfill; advisory phases; SkillOpt work;
  weakening any existing gate.

Lanes (codex sub-agents; one lane = one worktree = one deliverable):

- A1 coverage: baseline file + fail-on-drop compare replacing the
  VITEST_COVERAGE_REPORT_ONLY zeroing; CI coverage lane; strip
  --passWithNoTests from coverage scripts.
- A2 knip: gate step + committed findings baseline (fail on growth) + CI
  lane. THEN A4 jsdoc: inventory ratchet via #294 machinery (A2→A4
  sequential: shared files).
- A3 boundaries: doctrine-pinned deny rules (domain↛drivers/tables/server;
  tables↛server; ui↛server) surviving regeneration; boundaries-write out of
  yeet prepare; verify runs --check.
- A6 commitlint: CI job over PR/push range.

Workflow: lanes branch from feat/quality-gate-ratchets; Fable reviews and
merges each; P1 proves every gate two-way (synthetic regression fails,
revert passes — log in history/gate-proofs.md); P2 yeet repair → verify →
publish --pr → monitor → user merges; P3 Claude updates the ruleset and
proves direct-push refusal; P4 /reflect + closeout.

Acceptance (SPEC authoritative):

- [ ] Every gate two-way proven; baselines committed + regenerable.
- [ ] Boundaries: doctrine rules survive a regeneration round-trip; prepare
      no longer writes them.
- [ ] yeet verify green; single PR merged; ruleset live; direct push
      refused; next PR merges normally.
- [ ] Reflection written; reflection-artifacts lint passes.

Verification:

```sh
test "$(wc -m < goals/quality-gate-ratchets/GOAL.md)" -le 4000
jq . goals/quality-gate-ratchets/ops/manifest.json
bun run beep yeet verify
```

Stop and report before: weakening any gate; forking (vs reusing) the #294
ratchet machinery; any GitHub write from a codex sandbox; destructive state.

Done only when acceptance passes, or a blocker is reported with
file/command evidence.
