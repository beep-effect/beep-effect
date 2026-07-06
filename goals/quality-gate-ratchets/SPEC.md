# Quality Gate Ratchets Spec

## Objective

In one PR plus one post-merge API step: (A1) coverage thresholds stop being
zeroed — a committed per-package baseline is compared fail-on-drop in the
quality lane and a CI coverage lane; driver `--passWithNoTests` removed.
(A2) knip runs as a gate with a committed findings baseline (fail on growth).
(A3) boundary provenance gains doctrine-pinned deny rules
(domain↛drivers/tables/server; tables↛server; ui↛server) that regeneration
cannot overwrite; `fallow:boundaries:write` leaves yeet prepare; verify runs
`--check`. (A4) jsdoc inventory totals ratchet (fail on increase vs
committed inventory). (A6) commitlint runs in CI over the PR/push range.
(A5, post-merge) ruleset 10240248 targets the default branch with
required status checks (verify matrix + Build And Test), pull-request-only
changes, deletion/non-FF kept, admin bypass.

## Non-Goals

- Fixed coverage floors or any threshold beyond fail-on-regression.
- Vertical-slice test backfill (organic via ratchet; possible later campaign).
- Advisory/report-only phases for the new gates.
- Weakening or removing any existing gate.
- SkillOpt pilot work (separate successor packet).

## Source Hierarchy

1. User objective (grill session 2026-07-06, logged in approved plan + this spec).
2. `AGENTS.md`, `CLAUDE.md`, required skills (`yeet`, `turborepo`, `effect-first-development`).
3. `standards/ARCHITECTURE.md` (dependency graph for A3), `goals/repo-quality-throughput/` conventions.
4. This `SPEC.md`. 5. `PLAN.md`. 6. `GOAL.md`. 7. `research/`, `ops/`, `history/`.

## Target Surfaces

- `vitest.shared.ts`, root `package.json` coverage script, driver package.json coverage scripts (A1).
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (+ internal) — knip step, coverage compare, jsdoc ratchet (A1/A2/A4).
- New committed baselines under `standards/` (coverage baseline, knip baseline; naming per existing `fallow.*.regression-baseline` convention).
- `standards/fallow.boundaries.provenance.jsonc` + generator + `standards/fallow.boundaries.provenance.schema.json` (A3).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` prepare steps (A3).
- `.github/workflows/check.yml` — coverage lane, knip lane, commitlint job (A1/A2/A6).
- Ruleset 10240248 via `gh api` (A5, post-merge, Claude only).
- `#294 ratchet machinery` (reuse; extend, do not fork).

## Constraints

- Ratchets only: committed baseline + fail-on-regression; every gate must be
  provable both ways (synthetic regression fails; revert passes).
- Codex sub-agents implement lanes; **no GitHub API writes from codex**; one
  lane = one agent = one worktree = one deliverable.
- Lanes A2 and A4 both touch `Quality/Tasks.ts`/`check.yml` — sequenced, not parallel.
- A5 runs only after the PR merges and its check names exist on main.
- Baselines must be regenerable via a documented command (drift = regenerate + review, not hand-edit).
- Conventional commits; preserve unrelated worktree changes.

## Acceptance Criteria

- [ ] Each of A1/A2/A3/A4/A6 demonstrably fires on a synthetic regression and passes on revert (evidence in history/).
- [ ] `VITEST_COVERAGE_REPORT_ONLY` zeroing path removed or subordinated to baseline-compare; zero `--passWithNoTests` in coverage scripts.
- [ ] `standards/fallow.boundaries.provenance.jsonc` contains doctrine-pinned rules; regeneration round-trip preserves them; yeet prepare no longer writes boundaries.
- [ ] jsdoc + knip baselines committed; gates wired in both quality lane and CI.
- [ ] commitlint CI job green on this PR (its own commits are conventional).
- [ ] `bun run beep yeet verify` green; single PR merged.
- [ ] Post-merge: ruleset live (required checks + PR-only), direct push to main refused (tested), next PR merges normally.
- [ ] Reflection written; `bun run beep lint reflection-artifacts` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/quality-gate-ratchets/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/quality-gate-ratchets/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/quality-gate-ratchets` | Passes |
| Ratchet proofs | synthetic-regression runs logged in `history/gate-proofs.md` | Each gate fails/passes correctly |
| Full proof | `bun run beep yeet verify` | Green |
| Ruleset | `gh api repos/:owner/:repo/rulesets/10240248` | required_status_checks + pull_request present |
| Direct-push refusal | test push to main after A5 | Refused |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- A ratchet cannot be made two-way provable (fires on regression AND passes on revert).
- A change would weaken full proof, hosted checks, or closeout gates.
- #294 ratchet machinery proves non-reusable without forking it (stop; redesign with user).
- Required credentials/cost/destructive side effects not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
