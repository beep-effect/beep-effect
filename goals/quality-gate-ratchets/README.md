# Quality Gate Ratchets

## Status

Lifecycle: `completed-retained` — merged as [PR #305](https://github.com/beep-effect/beep-effect/pull/305) (`ca9c6ec924`, 2026-07-06); main ruleset 10240248 ACTIVE with 17 required checks + PR-only pushes (direct-push refusal proven).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Turn the repo's declared-but-toothless quality gates into committed-baseline,
fail-on-regression ratchets — coverage, knip dead-code, jsdoc inventory,
doctrine-pinned boundaries, commitlint-in-CI — and finally protect `main`
with a real ruleset. One PR + post-merge ruleset enablement.

## Launch

```text
/goal follow the instructions in goals/quality-gate-ratchets/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance.

## Current Phase

Closed — all phases completed 2026-07-06.

## Latest Evidence

2026-07-06: PR #305 merged after 12 CI rounds (every red a real finding;
taxonomy in [`history/gate-proofs.md`](./history/gate-proofs.md)). Ruleset
live; direct push to main REFUSED ("17 of 17 required status checks are
expected"). Reflection:
[`history/reflections/2026-07-06-claude.md`](./history/reflections/2026-07-06-claude.md).
Deferred work: [`history/crispen-debt.md`](./history/crispen-debt.md) +
rqt-015 in gate-proofs.

## Notes

- **No exploration packet** (deliberate): research = `REPO_RATING.md`
  path-to-10 sections + `explorations/agent-pipeline-velocity/research/*` +
  the 2026-07-06 state recon; align = the grill session logged in this
  packet's SPEC decision log. Successor of `agent-pipeline-velocity`
  (PR #295); sibling-successor `skillopt-training-pilot` starts after this
  closes.
- **Execution mandate**: codex sub-agents implement; Claude orchestrates,
  reviews, verifies, and performs GitHub API writes (codex sandbox cannot).
- Ratchet style everywhere (no fixed floors, no advisory phase): committed
  baseline + fail-on-regression, reusing PR #294 per-owner ratchet machinery.
