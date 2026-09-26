# P2 rerun — annealed budget, Claude Code target: loop runs, score saturates on sandbox repair

2026-09-25. Config `tools/skillopt/configs/beeplaw.rerun-2026-09.yaml` (cosine
edit budget 4 -> 1 over 12 steps, 3 epochs, 4 rollout workers, 2 analyst
workers, `claude_chat` opus optimizer, `claude_code_exec` opus rollout target
after the Codex pool hit its usage limit; D14 amendment in `SPEC.md`). Same
8 train / 4 validation corpus and scorer as P5.

## Result

```text
baseline  soft=0.5015 (earlier attempt on the same items: 0.5431)
step 1    ACCEPT soft=0.9583  budget 4  dt=180 s
step 2    ACCEPT soft=1.0000  budget 4  dt=233 s
stopped after step 2: the gate is strict-greater, so nothing could be
accepted on a saturated selection set; 10 remaining steps would only
spend quota.
```

Artifacts here: `skills/skill_v0000..2.md`, `baseline-results.jsonl`,
`run-summary.log`. Raw `out/` and `run.log` are git-ignored.

## Reading

1. **The scorer sandbox sets the floor.** Every baseline item fails the tsgo
   lane on missing lib types (`TS2591`, `TS2503`, `TS2304`, `TS2550`); two
   items also fail on a tsconfig `extends` that does not resolve in the copied
   fixture (`TS5083`) and Biome processes zero files. Baseline soft scores
   (0.34 to 0.58, hard 0.0 everywhere) measure that breakage, not the skill.
   P5's Codex baseline (0.4714) almost certainly sat on the same floor, which
   also reframes P5's "appended guidance degraded validation" finding.
2. **Step 1 is evaluation-environment fitting.** Two of the three added
   paragraphs teach the agent to make the fixture tsconfig self-contained and
   to add a fixture-local Biome config. The loop learned to repair the scoring
   sandbox in one round. RRSI's pre-evaluation leakage critic (mechanism D)
   would reject this diff for encoding scorer specifics; nothing in the current
   loop screens it.
3. **Step 2 quotes a task into the skill.** The precision-audit rule is
   plausible law, but the added exception quotes a corpus task's own phrasing
   ("the repo utility that preserves the object shape") and names the helper
   to import. That is task-specific content, the paper's leakage class.
4. **Complexity accumulated.** The skill grew from 6,233 to 9,070 chars
   (+46%) in two accepted edits, the growth the skillopt SPEC non-goal forbids
   for shipped skills and the growth RRSI's cost-aware acceptance (F) prices.
5. **Noise band, first measurement.** Two baselines on identical inputs
   differed by 0.042 (0.5431 vs 0.5015). Any acceptance floor for this scorer
   must exceed that.

## Ledger rows

Both accepted candidates are filed as `proposed` rows in
`harness-ledger/rows/2026-09.jsonl` (`hl-20260925-873a855c`,
`hl-20260925-4fc1962c`) with the hypotheses above. Disposition is Benjamin's
call (D2). The evidence recommends `rejected` with reason "evaluation-environment
fitting / task-specific content"; that reason should be the first entry the
future leakage screen learns from.

## Verdict — PARK the rerun, fix the scorer first

The annealed budget did what the pilot's park condition predicted (edits were
accepted instead of uniformly rejected), but the accepted edits are sandbox
repair and task leakage, so no lift is claimable. Next: make the fixture copy
self-contained by construction, add the diff screen, re-measure the noise band
with three baseline runs, then rerun. Receipts in `research/OPPORTUNITIES.md`.
