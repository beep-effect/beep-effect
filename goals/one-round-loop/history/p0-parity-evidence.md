# P0 parity evidence (D9 + Verification Matrix rows 1–3)

Evidence trail for the CI-lane inversion parity proof. Filled as the
P0 PR progresses; the thinning commit (orl-003) may not land before
§1 records matching verdicts.

## 1. Same-SHA shadow comparison (D9 / matrix row 1)

Shadow workflow: `.github/workflows/ci-lane-shadow.yml` (temporary,
workflow_dispatch). Both runs execute against the SAME head SHA on the
P0 PR branch, with check.yml still unmodified.

- Head SHA: _pending_
- check.yml run (unmodified, pull_request event): _pending run ID_
- ci-lane-shadow run (workflow_dispatch, same SHA): _pending run ID_

| Lane | check.yml verdict | Shadow verdict | CLI-echoed command matches CI body |
|---|---|---|---|
| Lint | _pending_ | _pending_ | _pending_ |
| Lint Policy | _pending_ | _pending_ | _pending_ |
| Repo Sanity | _pending_ | _pending_ | _pending_ |
| Check | _pending_ | _pending_ | _pending_ |
| Test Unit | _pending_ | _pending_ | _pending_ |
| Test Integration | _pending_ | _pending_ | _pending_ |
| Coverage Regression | _pending_ | _pending_ | _pending_ |
| Docgen | _pending_ | _pending_ | _pending_ |
| Codegen Drift | _pending_ | _pending_ | _pending_ |
| Professional Desktop IPC Stdio | _pending_ | _pending_ | _pending_ |
| Fallow Advisory Envelopes | _pending_ | _pending_ | _pending_ |
| Knip | _pending_ | _pending_ | _pending_ |
| JSDoc Ratchet | _pending_ | _pending_ | _pending_ |
| Commitlint | _pending_ | _pending_ | _pending_ |
| Nix Shell | _pending_ | _pending_ | _pending_ |
| SAST | _pending_ | _pending_ | _pending_ |

Excluded by class (parity by identity — workflow bodies unchanged):
PR Size Label, Secret Scanning, Security (OSV + dependency-review).
Excluded by event: Build (push-only; body exercised via `beep ci lane
build` in the local battery).

## 2. Local verdict parity fixtures (matrix row 2)

Fixture table: `../research/local-verdict-parity-fixtures.md`.
Fixture branch: `goals/one-round-loop-p0-parity-fixtures` (never merged).

- `beep ci local` run (fixture branch): _pending_
- Draft PR + check.yml run: _pending_
- Per-row verdict comparison: _pending_

## 3. Lane inventory single-sourcing (matrix row 3)

- `bun run beep ci lane --list` emits all 21 descriptors (19 runnable +
  pr-size + dependency-review) with class/replay/flags — verified by
  `packages/tooling/tool/cli/test/ci-lane.test.ts` (descriptor suite:
  21 entries, unique ids, frozen 17 required-context set).
- check.yml body thinning: _pending (orl-003)_.

## 4. Dogfood ledger (D4) — P0 PR

- Packet-authoring PR [#319](https://github.com/beep-effect/beep-effect/pull/319):
  docs-only; pre-P0 (no `beep ci local` yet); typos + packet hygiene
  proof; CI rounds: **1** (all 17 required checks green first round).
- P0 PR: `bun run beep ci local` (full battery) run from this branch
  before push: _pending log reference_.

### Pre-push battery round 1 (2026-07-07, failed → fixed locally)

The first full-battery run against the P0 branch itself caught four
defect classes locally — each would previously have been a CI round:

1. `lint-policy` / schema-first: exported pure-data alias
   `CiLaneRunOptions` → remodeled as an annotated `S.Class`.
2. `lint-policy` / dual-arity: `ciLaneStepsForTesting` (3 positional,
   not dual) and `ciLocalStepsForTesting` (4 positional) → both made
   `dual(3)`; the local-battery shape folded into a `CiLocalStepPlan`
   schema.
3. `lint-policy` / terse-effect: conditional optional-object spread →
   `O.getSomesStruct`.
4. Stale `standards/schema-catalog.generated.jsonc` (new Ci schemas) →
   regenerated via `lint schema-catalog --write`. NOTE: this gate is
   currently reachable only via `beep lint schema-catalog` — no CI lane
   runs it (observed while fixing; out of P0 scope).

Notable: the earlier bounded loop (`github-checks review-fix`, affected
lint) did NOT catch 1–3 — affected-mode lint suppresses repo-wide
policy steps, exactly the Lint-Policy shape delta in the parity table.

Operational lesson re-learned: a foreground `laws terse-effect --check`
probe ran concurrently with the battery's check lane and coincided with
a turbo child-process spawn failure (PlatformError) plus a possibly
spurious `@beep/xai` TS2589 — round 2 runs with zero concurrent
commands to get a clean signal.
