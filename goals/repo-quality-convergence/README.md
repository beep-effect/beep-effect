# Repo Quality Convergence

## Status

Lifecycle: `completed-retained`

**Complete — merged in PR #165**

On-demand reflection:
[`history/reflections/2026-08-29-codex.md`](./history/reflections/2026-08-29-codex.md).

## Mission

Bring the repository to a defensible **9/10 repo-health score** by closing
current quality blockers, adding durable release and governance guardrails, and
recording the evidence needed to prove the claim.

## Current Score

**Initial score:** 70 / 100

The repo has strong architecture, source-law, docgen, and CI foundations, but
the score is capped below 9/10 while local lint and Release are red.

Hard blockers at initiative start:

- `bun run lint` fails through `bun run beep lint schema-first` because
  generated docs examples are scanned as source-law inputs.
- The GitHub `Release` workflow fails on `main` because Changesets sees package
  names that no longer exist in the workspace graph.
- Tracked root config still references removed app workspaces.

## Reading Order

1. `SPEC.md` - normative rubric, hard blockers, and completion rules.
2. `history/outputs/current-state-evidence.md` - command, CI, and source
   evidence for the baseline.
3. `research/repo-health-scorecard.md` - weighted scorecard and scoring notes.
4. `PLAN.md` - implementation phases and proof checklist.
5. `history/outputs/stale-reference-inventory.md` - release/config/initiative
   drift inventory.

## Relationship To Existing Work

This initiative consumes `goals/repo-quality-acceleration` as evidence for
the measured performance portion of the score. It does not own CI speedup work;
that packet remains the home for optimization experiments.
