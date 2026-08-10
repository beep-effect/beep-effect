# Friction & opportunity ledger

Receipts recorded at the moment the friction happened, per the repo law in
`AGENTS.md` (§Docs & Knowledge). Newest first.

## 2026-08-10 — parked branches pay a 197-hunk tax for comment-only campaigns

- **Doing:** merging latest `main` into the parked `feat/evidence-loop-p0-and-fixes`
  branch to reopen it as the wrap-up PR.
- **Evidence:** 11 files conflicted with 197 hunks, all from PR #608's repo-wide
  JSDoc carrier retirement rewording comments in files this branch had rewritten
  (`packages/tooling/library/ai-metrics/src/*`, the AIMetrics/AgentEffectiveness
  commands, `Flags.ts`). Every hunk of main's side proved comment-only — the
  per-file non-comment diff-line count was 0 — and pre-cutover besides (it still
  exported `DEFAULT_AI_METRICS_DATA_ROOT`, which the P0 cutover deletes).
  Resolution: all 11 as `--ours` (merge commit `25e9fffeb0`), then a full green
  `yeet verify` as the safety net.
- **Prevented by:** merging `main` into parked branches promptly after any
  repo-wide mechanical campaign lands, or running the campaign's codemod on the
  parked branch instead of hand-adjudicating hunks. A `git merge` driver or
  helper that auto-resolves hunks whose incoming side is provably comment-only
  would erase this entire class.

## 2026-08-10 — lock-moving merges leave tsgo incremental state poisoned

- **Doing:** first `yeet verify` after merging a `main` that bumped the effect
  subtree (`bun.lock` moved).
- **Evidence:** `@beep/xai`, `@beep/ui`, `@beep/box` failed check/build with
  TS2589 plus *located* `unknown`-cascade TS2345s in files the branch never
  touched — deterministically reproducible under `turbo --force`, which busts
  the turbo cache but not tsgo's `.tsbuildinfo` incremental state.
  `find <pkg> -name '*.tsbuildinfo' -delete` then rerun → 22/22 green.
  Distinguish from the no-location TS2589 load flake by reproducibility.
- **Prevented by:** a repair step (or `yeet repair` heuristic) that invalidates
  tsgo incremental state whenever `bun.lock` changed since the last verify.
  Until then: `bun install` **and** tsbuildinfo deletion after every
  lock-moving merge.

## 2026-08-10 — the committed 16 MB JSDoc inventory is dead weight

- **Doing:** answering "do we still need `standards/jsdoc-documentation.inventory.jsonc`?"
- **Evidence:** the `quality:jsdoc-ratchet` CI lane regenerates a fresh
  inventory to `.beep/ci/jsdoc-documentation.inventory.jsonc` and ratchets that
  against the 34-line `standards/jsdoc-totals.regression-baseline.jsonc`
  (`CiLane.ts:835-853`). Nothing reads the committed 16 MB snapshot; it inflates
  every clone and poisons diffs whenever regenerated.
- **Opportunity:** a separate chore PR from clean `main` (per
  `standards/generated-artifacts.policy.md`): drop the committed inventory, point
  `defaultJSDocInventoryPath` at the `.beep/ci` output, update the policy table.
  Keep the generator, the baseline, and the ratchet — the ratchet still guards
  live debt (63 packages needing remediation, 548 multi-paragraph descriptions).
